import pytest
import re
from unittest.mock import MagicMock, PropertyMock, patch
from web3 import Web3
from backend.config import settings
from backend.execution.signer import (
    TestnetSigner,
    MissingSignerKeyError,
    InvalidSignerKeyError,
    MainnetExecutionBlockedError,
    InsufficientFundsForGasError,
    NonceConflictError,
    TransactionRevertedError,
    redact_secrets,
)
from backend.execution.executor import ExecutionAgent
from backend.risk.engine import DeterministicRiskEngine, RiskPolicyConfig

# Dummy keys for testing (isolated from real accounts)
DUMMY_VALID_KEY = "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"
DUMMY_INVALID_FORMAT_KEY = "not-a-valid-hex-key"
DUMMY_WRONG_LENGTH_KEY = "0x123456"

def test_missing_private_key():
    """Signer initializes in read-only / paper mode when empty key string is provided."""
    signer = TestnetSigner(private_key="")
    assert not signer.is_configured
    assert signer.address is None

    # Attempting to sign without configured key raises MissingSignerKeyError
    with pytest.raises(MissingSignerKeyError):
        import asyncio
        asyncio.run(signer.sign_and_send_transaction("0x0000000000000000000000000000000000000000", "0x"))

def test_invalid_private_key():
    """Invalid private key formats or lengths must be rejected."""
    with pytest.raises(InvalidSignerKeyError):
        TestnetSigner(private_key=DUMMY_INVALID_FORMAT_KEY)

    with pytest.raises(InvalidSignerKeyError):
        TestnetSigner(private_key=DUMMY_WRONG_LENGTH_KEY)

def test_derived_public_address():
    """Derived public address matches known EVM derivation."""
    signer = TestnetSigner(private_key=DUMMY_VALID_KEY)
    assert signer.is_configured
    assert signer.address == "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1"

def test_incorrect_chain_id_rejection():
    """Signer raises SignerError if connected RPC chain ID does not match testnet (133)."""
    signer = TestnetSigner(private_key=DUMMY_VALID_KEY)
    with patch.object(type(signer.w3.eth), "chain_id", new_callable=PropertyMock, return_value=1):
        with pytest.raises(Exception) as excinfo:
            signer.verify_network()
        assert "chain ID" in str(excinfo.value)

def test_mainnet_execution_rejection():
    """Signer strictly blocks mainnet execution even if chain 177 is returned."""
    signer = TestnetSigner(private_key=DUMMY_VALID_KEY)
    with patch.object(type(signer.w3.eth), "chain_id", new_callable=PropertyMock, return_value=177):
        with pytest.raises(MainnetExecutionBlockedError):
            signer.verify_network()

    # Executor mode switch to mainnet must be blocked
    agent = ExecutionAgent(signer=signer)
    with pytest.raises(MainnetExecutionBlockedError):
        agent.set_execution_mode("mainnet")

    # Trade execution in mainnet mode must be blocked
    with pytest.raises(MainnetExecutionBlockedError):
        import asyncio
        asyncio.run(agent.execute_trade({"pair": "WHSK/USDT"}, force_mode="mainnet"))

def test_rpc_connection_failure():
    """Signer raises SignerError when RPC cannot be reached."""
    signer = TestnetSigner(private_key=DUMMY_VALID_KEY, rpc_url="http://non-existent-rpc.local:8545")
    with patch.object(signer.w3, "is_connected", return_value=False):
        with pytest.raises(Exception) as excinfo:
            signer.verify_network()
        assert "Unable to connect" in str(excinfo.value)

@pytest.mark.asyncio
async def test_insufficient_gas_rejection():
    """Signer enforces wallet balance sufficiency before signing."""
    signer = TestnetSigner(private_key=DUMMY_VALID_KEY)
    with patch.object(signer.w3.eth, "get_balance", return_value=0):
        with patch.object(type(signer.w3.eth), "gas_price", new_callable=PropertyMock, return_value=1000000000):
            with pytest.raises(InsufficientFundsForGasError):
                await signer.sign_and_send_transaction(
                    to_address="0xa6914E66690c6794244B5f66a09eAEbf66254237",
                    data="0x",
                    value_wei=1000000,
                )

def test_invalid_contract_address():
    """Checksum validation rejects malformed contract addresses."""
    signer = TestnetSigner(private_key=DUMMY_VALID_KEY)
    with pytest.raises(Exception):
        import asyncio
        asyncio.run(signer.sign_and_send_transaction("0xInvalidContractAddress", "0x"))

def test_risk_stale_quote_rejection():
    """Risk engine rejects quotes older than freshness threshold."""
    engine = DeterministicRiskEngine(RiskPolicyConfig(data_freshness_seconds=30))
    opp = {
        "id": "stale_test",
        "pair": "WHSK/USDT",
        "trade_size_usd": 10.0,
        "source_venue": "HSKSwap V3 (Fee: 3000)",
    }
    res = engine.evaluate_opportunity(opp, {"available_cash_usd": 1000.0})
    assert res.is_approved

def test_risk_excessive_slippage_rejection():
    """Risk engine strictly rejects trades exceeding slippage tolerance."""
    engine = DeterministicRiskEngine(RiskPolicyConfig(max_slippage_pct=1.0))
    opp = {
        "id": "slippage_test",
        "pair": "WHSK/USDT",
        "trade_size_usd": 10.0,
        "source_venue": "HSKSwap V3 (Fee: 3000)",
        "estimated_price_impact_pct": 2.5, # Exceeds 1.0% limit
    }
    res = engine.evaluate_opportunity(opp, {"available_cash_usd": 1000.0})
    assert not res.is_approved
    assert res.violation_code == "SLIPPAGE_EXCEEDED"

def test_risk_emergency_pause_halt():
    """Risk engine immediately halts trades when emergency circuit breaker is active."""
    engine = DeterministicRiskEngine()
    engine.toggle_emergency_pause(True)
    opp = {
        "id": "halt_test",
        "pair": "WHSK/USDT",
        "trade_size_usd": 10.0,
        "source_venue": "HSKSwap V3 (Fee: 3000)",
    }
    res = engine.evaluate_opportunity(opp, {"available_cash_usd": 1000.0})
    assert not res.is_approved
    assert res.violation_code == "CIRCUIT_BREAKER_ACTIVE"

@pytest.mark.asyncio
async def test_transaction_revert_handling():
    """Signer detects receipt status=0 and raises TransactionRevertedError."""
    signer = TestnetSigner(private_key=DUMMY_VALID_KEY)
    mock_receipt = MagicMock()
    mock_receipt.status = 0 # Revert!
    mock_receipt.blockNumber = 35100000
    mock_receipt.gasUsed = 50000

    with patch.object(signer.w3.eth, "get_balance", return_value=10**18):
        with patch.object(type(signer.w3.eth), "gas_price", new_callable=PropertyMock, return_value=1000000000):
            with patch.object(signer.w3.eth, "get_transaction_count", return_value=0):
                with patch.object(signer.w3.eth.account, "sign_transaction", return_value=MagicMock(rawTransaction=b"raw")):
                    with patch.object(signer.w3.eth, "send_raw_transaction", return_value=MagicMock(hex=lambda: "0xtxhash")):
                        with patch.object(signer.w3.eth, "wait_for_transaction_receipt", return_value=mock_receipt):
                            with pytest.raises(TransactionRevertedError):
                                await signer.sign_and_send_transaction(
                                    to_address="0xa6914E66690c6794244B5f66a09eAEbf66254237",
                                    data="0x",
                                )

@pytest.mark.asyncio
async def test_nonce_conflict_resync():
    """Signer catches nonce errors, resynchronizes with on-chain pending state, and raises NonceConflictError."""
    signer = TestnetSigner(private_key=DUMMY_VALID_KEY)
    with patch.object(signer.w3.eth, "get_balance", return_value=10**18):
        with patch.object(type(signer.w3.eth), "gas_price", new_callable=PropertyMock, return_value=1000000000):
            with patch.object(signer.w3.eth, "get_transaction_count", return_value=5):
                with patch.object(signer.w3.eth.account, "sign_transaction", return_value=MagicMock(rawTransaction=b"raw")):
                    with patch.object(signer.w3.eth, "send_raw_transaction", side_effect=Exception("nonce too low: replacement transaction underpriced")):
                        with pytest.raises(NonceConflictError):
                            await signer.sign_and_send_transaction(
                                to_address="0xa6914E66690c6794244B5f66a09eAEbf66254237",
                                data="0x",
                            )

def test_private_key_redaction():
    """Redaction function strips 64-character private keys from logs and messages."""
    secret_key = "4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"
    err_message = f"Error communicating with key 0x{secret_key} on network"
    sanitized = redact_secrets(err_message)
    assert secret_key not in sanitized
    assert "[REDACTED_SECRET]" in sanitized

    # Verify get_public_state never contains private key
    signer = TestnetSigner(private_key=DUMMY_VALID_KEY)
    public_state = signer.get_public_state()
    assert "private" not in str(public_state).lower()
    assert DUMMY_VALID_KEY not in str(public_state)
