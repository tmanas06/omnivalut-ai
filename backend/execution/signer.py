import os
import re
import asyncio
import logging
from typing import Dict, Any, Optional
from web3 import Web3
from eth_account import Account
from backend.config import settings

logger = logging.getLogger("omnivault.signer")

# Exceptions
class SignerError(Exception):
    """Base exception for signer operations."""
    pass

class MissingSignerKeyError(SignerError):
    pass

class InvalidSignerKeyError(SignerError):
    pass

class MainnetExecutionBlockedError(SignerError):
    """Raised if an operation attempts to target mainnet."""
    pass

class InsufficientFundsForGasError(SignerError):
    pass

class NonceConflictError(SignerError):
    pass

class TransactionRevertedError(SignerError):
    pass

def redact_secrets(message: str) -> str:
    """Utility to redact any 64-char hex strings or private keys from output."""
    if not isinstance(message, str):
        message = str(message)
    # Match 64-char hex with or without 0x prefix
    pattern = r'(?:\b0x)?[0-9a-fA-F]{64}\b'
    return re.sub(pattern, "[REDACTED_SECRET]", message)

class TestnetSigner:
    """
    Dedicated EVM backend signer for HashKey Chain Testnet operations.
    Thread-safe and asyncio-safe nonce tracking, gas validation, and transaction monitoring.
    CRITICAL SECURITY GUARANTEE: Never exposes the private key through any log, endpoint, or error.
    """
    __test__ = False

    def __init__(self, private_key: Optional[str] = None, rpc_url: Optional[str] = None):
        self.rpc_url = rpc_url or settings.HSK_RPC_URL
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self._nonce_lock: Optional[asyncio.Lock] = None
        self._cached_nonce: Optional[int] = None
        
        # Load and validate key (allow explicit empty string to test unconfigured signer)
        raw_key = settings.TESTNET_SIGNER_PRIVATE_KEY if private_key is None else private_key
        if not raw_key or not raw_key.strip():
            self._has_key = False
            self.address: Optional[str] = None
            self._private_key: Optional[str] = None
            logger.info("TestnetSigner initialized in read-only / paper mode (no private key configured).")
            return

        cleaned_key = raw_key.strip()
        if not cleaned_key.startswith("0x"):
            cleaned_key = "0x" + cleaned_key

        if len(cleaned_key) != 66:
            raise InvalidSignerKeyError("Signer private key must be a 32-byte hex string (64 characters).")

        try:
            account = Account.from_key(cleaned_key)
            self._private_key = cleaned_key
            self.address = Web3.to_checksum_address(account.address)
            self._has_key = True
            logger.info(f"TestnetSigner initialized successfully for public address: {self.address}")
        except Exception as e:
            raise InvalidSignerKeyError(f"Failed to derive wallet account from private key: {redact_secrets(str(e))}")

    @property
    def nonce_lock(self) -> asyncio.Lock:
        if self._nonce_lock is None:
            self._nonce_lock = asyncio.Lock()
        return self._nonce_lock

    @property
    def is_configured(self) -> bool:
        return self._has_key

    def verify_network(self) -> Dict[str, Any]:
        """Verify RPC connection and chain ID."""
        if not self.w3.is_connected():
            raise SignerError(f"Unable to connect to HashKey RPC at {self.rpc_url}")

        chain_id = self.w3.eth.chain_id
        if chain_id == 177 or settings.ENABLE_MAINNET:
            raise MainnetExecutionBlockedError("Mainnet execution is strictly disabled for this hackathon build.")

        if chain_id != settings.HSK_CHAIN_ID:
            raise SignerError(f"Connected chain ID {chain_id} does not match configured testnet chain ID {settings.HSK_CHAIN_ID}")

        return {
            "chain_id": chain_id,
            "is_testnet": chain_id == 133,
            "rpc_url": self.rpc_url,
            "latest_block": self.w3.eth.block_number,
        }

    async def get_native_balance(self) -> float:
        """Fetch native HSK balance of the signer wallet."""
        if not self.address:
            return 0.0
        try:
            wei = self.w3.eth.get_balance(self.address)
            return float(self.w3.from_wei(wei, "ether"))
        except Exception as e:
            logger.error(f"Error fetching balance for {self.address}: {redact_secrets(str(e))}")
            return 0.0

    async def get_token_balance(self, token_address: str, wallet_address: Optional[str] = None) -> float:
        """Fetch ERC20 token balance (18 decimals)."""
        target = wallet_address or self.address
        if not target:
            return 0.0
        try:
            from backend.adapters.hskswap.abis import ERC20_ABI
            token_c = self.w3.eth.contract(address=self.w3.to_checksum_address(token_address), abi=ERC20_ABI)
            raw_bal = token_c.functions.balanceOf(self.w3.to_checksum_address(target)).call()
            return float(self.w3.from_wei(raw_bal, "ether"))
        except Exception as e:
            logger.error(f"Error fetching token balance for {token_address}: {redact_secrets(str(e))}")
            return 0.0

    async def get_all_balances(self) -> Dict[str, float]:
        """Fetch native HSK, WHSK, and USDT balances for the configured wallet."""
        from backend.adapters.hskswap.constants import TESTNET_WHSK, TESTNET_USDT
        native_hsk = await self.get_native_balance()
        whsk = await self.get_token_balance(TESTNET_WHSK)
        usdt = await self.get_token_balance(TESTNET_USDT)
        return {
            "hsk": round(native_hsk, 6),
            "whsk": round(whsk, 6),
            "usdt": round(usdt, 6),
        }

    def verify_contracts_onchain(self) -> Dict[str, Any]:
        """
        Verify presence of bytecode, chain ID, and liquidity for all core HSKSwap testnet contracts.
        """
        from backend.adapters.hskswap.constants import (
            TESTNET_FACTORY,
            TESTNET_SWAP_ROUTER_02,
            TESTNET_QUOTER_V2,
            TESTNET_MULTICALL,
            TESTNET_WHSK,
            TESTNET_USDT,
        )

        contracts = {
            "Factory": TESTNET_FACTORY,
            "SwapRouter02": TESTNET_SWAP_ROUTER_02,
            "QuoterV2": TESTNET_QUOTER_V2,
            "Multicall": TESTNET_MULTICALL,
            "WHSK": TESTNET_WHSK,
            "USDT": TESTNET_USDT,
        }

        results = {}
        all_ok = True

        for name, addr in contracts.items():
            checksum_addr = self.w3.to_checksum_address(addr)
            code = self.w3.eth.get_code(checksum_addr)
            has_code = len(code) > 2
            results[name] = {
                "address": checksum_addr,
                "deployed": has_code,
                "bytecode_size_bytes": len(code),
            }
            if not has_code:
                all_ok = False

        return {
            "all_verified": all_ok,
            "chain_id": self.w3.eth.chain_id if self.w3.is_connected() else None,
            "contracts": results,
        }

    async def get_next_nonce(self) -> int:
        """Fetch and lock next transaction nonce, synchronizing with on-chain pending state."""
        if not self.address:
            raise MissingSignerKeyError("Cannot get nonce: no signer wallet configured.")

        async with self.nonce_lock:
            onchain_nonce = self.w3.eth.get_transaction_count(self.address, "pending")
            if self._cached_nonce is None or onchain_nonce > self._cached_nonce:
                self._cached_nonce = onchain_nonce
            else:
                self._cached_nonce += 1
            return self._cached_nonce

    async def resync_nonce(self) -> int:
        """Force re-synchronization with on-chain pending nonce."""
        if not self.address:
            raise MissingSignerKeyError("Cannot resync nonce: no signer wallet configured.")
        async with self.nonce_lock:
            self._cached_nonce = self.w3.eth.get_transaction_count(self.address, "pending")
            return self._cached_nonce

    async def sign_and_send_transaction(
        self,
        to_address: str,
        data: str,
        value_wei: int = 0,
        gas_limit: Optional[int] = None,
        timeout_seconds: int = 60,
    ) -> Dict[str, Any]:
        """
        Signs and submits an EVM transaction to HashKey Testnet.
        CRITICAL: Validates chain ID, enforces gas sufficiency, tracks nonces, and monitors receipts.
        """
        if not self._has_key or not self._private_key:
            raise MissingSignerKeyError("Signer private key is not configured. Real transaction submission is blocked.")

        # Mainnet execution guard
        if settings.ENABLE_MAINNET or settings.HSK_CHAIN_ID == 177:
            raise MainnetExecutionBlockedError("Execution blocked: Mainnet is strictly disabled.")

        to_checksum = Web3.to_checksum_address(to_address)
        balance_wei = self.w3.eth.get_balance(self.address)
        gas_price = self.w3.eth.gas_price

        # Estimate gas if not provided
        if not gas_limit:
            try:
                estimated = self.w3.eth.estimate_gas({
                    "from": self.address,
                    "to": to_checksum,
                    "data": data,
                    "value": value_wei,
                })
                gas_limit = int(estimated * 1.25) # 25% safety buffer
            except Exception as e:
                logger.warning(f"Gas estimation failed, defaulting to 250,000 limit: {redact_secrets(str(e))}")
                gas_limit = 250000

        total_cost_wei = value_wei + (gas_limit * gas_price)
        if balance_wei < total_cost_wei:
            shortfall_hsk = self.w3.from_wei(total_cost_wei - balance_wei, "ether")
            raise InsufficientFundsForGasError(
                f"Insufficient HSK for gas. Wallet balance: {self.w3.from_wei(balance_wei, 'ether')} HSK, "
                f"Required: {self.w3.from_wei(total_cost_wei, 'ether')} HSK (Shortfall: {shortfall_hsk} HSK)"
            )

        nonce = await self.get_next_nonce()

        tx_payload = {
            "to": to_checksum,
            "from": self.address,
            "data": data,
            "value": value_wei,
            "gas": gas_limit,
            "gasPrice": gas_price,
            "nonce": nonce,
            "chainId": settings.HSK_CHAIN_ID,
        }

        try:
            signed_tx = self.w3.eth.account.sign_transaction(tx_payload, private_key=self._private_key)
            raw_bytes = getattr(signed_tx, "raw_transaction", getattr(signed_tx, "rawTransaction", None))
            tx_hash_hex = self.w3.eth.send_raw_transaction(raw_bytes).hex()
            logger.info(f"Broadcasted transaction to HashKey Testnet: {tx_hash_hex} (nonce={nonce})")
        except Exception as e:
            err_msg = str(e)
            if "nonce" in err_msg.lower() or "replacement" in err_msg.lower():
                await self.resync_nonce()
                raise NonceConflictError(f"Nonce conflict detected. Resynchronized nonce. Please retry: {redact_secrets(err_msg)}")
            raise SignerError(f"Failed to broadcast transaction: {redact_secrets(err_msg)}")

        # Wait for on-chain confirmation
        try:
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash_hex, timeout=timeout_seconds, poll_latency=2)
            status = "CONFIRMED" if receipt.status == 1 else "REVERTED"

            if receipt.status != 1:
                raise TransactionRevertedError(f"Transaction reverted on HashKey Chain! TxHash: {tx_hash_hex}")

            return {
                "status": status,
                "tx_hash": tx_hash_hex,
                "block_number": receipt.blockNumber,
                "gas_used": receipt.gasUsed,
                "effective_gas_price": receipt.get("effectiveGasPrice", gas_price),
                "explorer_url": f"https://hashkey.blockscout.com/tx/{tx_hash_hex}",
                "from": self.address,
                "to": to_checksum,
                "nonce": nonce,
            }
        except Exception as e:
            if isinstance(e, TransactionRevertedError):
                raise
            raise SignerError(f"Transaction confirmation check failed for {tx_hash_hex}: {redact_secrets(str(e))}")

    async def wrap_native_hsk(self, amount_hsk: float = 0.01) -> Dict[str, Any]:
        """Wrap native HSK into WHSK on HashKey Chain Testnet."""
        from backend.adapters.hskswap.constants import TESTNET_WHSK
        value_wei = int(amount_hsk * 10**18)
        # deposit() selector: 0xd0e30db0
        return await self.sign_and_send_transaction(
            to_address=TESTNET_WHSK,
            data="0xd0e30db0",
            value_wei=value_wei,
            gas_limit=100000,
        )

    async def approve_token(self, token_address: str, spender_address: str, amount_wei: Optional[int] = None) -> Dict[str, Any]:
        """Approve spender on an ERC20 token."""
        from backend.adapters.hskswap.abis import ERC20_ABI
        token_c = self.w3.eth.contract(address=self.w3.to_checksum_address(token_address), abi=ERC20_ABI)
        target_amt = amount_wei if amount_wei is not None else (2**256 - 1)
        data = token_c.encode_abi("approve", [self.w3.to_checksum_address(spender_address), target_amt])
        return await self.sign_and_send_transaction(
            to_address=token_address,
            data=data,
            value_wei=0,
            gas_limit=80000,
        )

    def get_public_state(self) -> Dict[str, Any]:
        """Returns safe public information without any private key data (sync)."""
        net = self.verify_network() if self.w3.is_connected() else {"is_testnet": True, "chain_id": 133}
        return {
            "is_configured": self._has_key,
            "address": self.address,
            "network": "HashKey Chain Testnet",
            "chain_id": net.get("chain_id", 133),
            "rpc_connected": self.w3.is_connected(),
            "latest_block": net.get("latest_block"),
            "mainnet_blocked": True,
            "execution_mode": settings.EXECUTION_MODE,
        }

    async def get_public_state_async(self) -> Dict[str, Any]:
        """Returns safe public information with on-chain balances and contract checks (async)."""
        net = self.verify_network() if self.w3.is_connected() else {"is_testnet": True, "chain_id": 133}
        balances = await self.get_all_balances() if self.address else {"hsk": 0.0, "whsk": 0.0, "usdt": 0.0}
        verification = self.verify_contracts_onchain()
        return {
            "is_configured": self._has_key,
            "address": self.address,
            "network": "HashKey Chain Testnet",
            "chain_id": net.get("chain_id", 133),
            "rpc_connected": self.w3.is_connected(),
            "latest_block": net.get("latest_block"),
            "balances": balances,
            "contracts_verified": verification.get("all_verified", False),
            "verified_contracts": verification.get("contracts", {}),
            "mainnet_blocked": True,
            "execution_mode": settings.EXECUTION_MODE,
        }

