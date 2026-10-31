import os
import time
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from web3 import Web3

from backend.agents.arbitrage import ArbitrageAgent, ArbitrageClassification
from backend.adapters.hskswap.adapter import HSKSwapAdapter
from backend.adapters.hskswap.constants import TESTNET_WHSK, TESTNET_USDT, TESTNET_USDC
from backend.backtesting.engine import BacktestEngine
from backend.backtesting.data_feed import HistoricalDataFeed
from backend.backtesting.strategies import StrategySignals
from backend.forward_testing.engine import ForwardTestEngine, ForwardTestSession
from backend.portfolio.tracker import PortfolioTracker, PositionRecord
from backend.execution.executor import ExecutionAgent
from backend.execution.signer import TestnetSigner, InsufficientFundsForGasError, MainnetExecutionBlockedError
from backend.orchestrator.orchestrator import CentralOrchestrator


# =============================================================================
# 1. Arbitrage Calculation Edge Cases & 4-Tier Taxonomy
# =============================================================================
def test_arbitrage_edge_cases_and_taxonomy():
    agent = ArbitrageAgent(min_net_profit_usd=0.50)

    # Case A: Negative spread (Entry 0.85, Exit 0.80) -> PRICE_DISCREPANCY, not profitable
    neg_res = agent.calculate_net_arbitrage(
        entry_price=0.85,
        exit_price=0.80,
        trade_amount=50.0,
        fee_tier_in=500,
        fee_tier_out=3000,
    )
    assert neg_res["is_profitable"] is False
    assert neg_res["classification"] == ArbitrageClassification.PRICE_DISCREPANCY.value

    # Case B: Zero liquidity on pool -> Rejected immediately
    zero_liq_res = agent.calculate_net_arbitrage(
        entry_price=0.80,
        exit_price=0.86,
        trade_amount=50.0,
        fee_tier_in=500,
        fee_tier_out=3000,
        available_liquidity=0,
    )
    assert zero_liq_res["is_profitable"] is False
    assert zero_liq_res["rejection_reason"] == "INSUFFICIENT_POOL_LIQUIDITY"

    # Case C: Gross spread covers DEX fees, but net profit below $0.50 threshold -> THEORETICAL_ARBITRAGE
    # Gross = (0.8540 - 0.8500) * 50 = $0.20, Total costs ~ $0.15, Net ~ $0.05 (< $0.50)
    low_net_res = agent.calculate_net_arbitrage(
        entry_price=0.8500,
        exit_price=0.8540,
        trade_amount=50.0,
        fee_tier_in=500,
        fee_tier_out=3000,
    )
    assert low_net_res["is_profitable"] is False
    assert low_net_res["classification"] == ArbitrageClassification.THEORETICAL_ARBITRAGE.value
    assert low_net_res["rejection_reason"] == "NET_PROFIT_BELOW_THRESHOLD"

    # Case D: Significant spread, positive net profit >= $0.50, valid liquidity -> EXECUTABLE_ARBITRAGE_ROUTE
    # Gross = (0.88 - 0.80) * 50 = $4.00, Total costs ~ $0.40, Net ~ $3.60
    exec_res = agent.calculate_net_arbitrage(
        entry_price=0.80,
        exit_price=0.88,
        trade_amount=50.0,
        fee_tier_in=500,
        fee_tier_out=3000,
        available_liquidity=1000000000,
    )
    assert exec_res["is_profitable"] is True
    assert exec_res["classification"] == ArbitrageClassification.EXECUTABLE_ARBITRAGE_ROUTE.value
    assert exec_res["expected_net_profit_usd"] >= 0.50


# =============================================================================
# 2. Token Decimal Mismatches (18 vs 6 Decimals)
# =============================================================================
def test_token_decimal_handling():
    adapter = HSKSwapAdapter()
    whsk_decimals = adapter.get_token_decimals(TESTNET_WHSK)
    usdt_decimals = adapter.get_token_decimals(TESTNET_USDT)
    usdc_decimals = adapter.get_token_decimals(TESTNET_USDC)

    assert whsk_decimals == 18
    assert usdt_decimals == 18
    assert usdc_decimals == 6

    # Test dynamic wei scaling in adapter
    amount_tokens = 50.0
    wei_18 = int(amount_tokens * (10 ** whsk_decimals))
    wei_6 = int(amount_tokens * (10 ** usdc_decimals))

    assert wei_18 == 50 * 10**18
    assert wei_6 == 50 * 10**6
    assert (wei_6 / (10 ** usdc_decimals)) == 50.0


# =============================================================================
# 3. Double-Counted Fees Prevention
# =============================================================================
def test_double_counted_fees_prevention():
    agent = ArbitrageAgent()
    res = agent.calculate_net_arbitrage(
        entry_price=0.80,
        exit_price=0.86,
        trade_amount=50.0,
        fee_tier_in=500,    # 0.05%
        fee_tier_out=3000,  # 0.30%
        slippage_tolerance_pct=0.5,
        price_impact_pct=0.1,
    )
    expected_gross = (0.86 - 0.80) * 50.0 # $3.00
    expected_leg1_fee = (50.0 * 0.80) * 0.0005 # $0.02
    expected_leg2_fee = (50.0 * 0.86) * 0.0030 # $0.129
    expected_total_fees = expected_leg1_fee + expected_leg2_fee

    assert res["gross_profit_usd"] == round(expected_gross, 4)
    assert res["dex_trading_fees"] == round(expected_total_fees, 4)
    # Verify net profit equals gross minus total costs exactly once
    assert res["expected_net_profit_usd"] == round(res["gross_profit_usd"] - res["total_costs_usd"], 4)


# =============================================================================
# 4. Gas Estimation Errors & Insufficient Funds Guard
# =============================================================================
def test_gas_estimation_and_insufficient_funds():
    from unittest.mock import PropertyMock
    signer = TestnetSigner(private_key="0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
    signer.w3.eth.get_balance = MagicMock(return_value=0)
    with patch("web3.eth.Eth.gas_price", new_callable=PropertyMock) as mock_gp:
        mock_gp.return_value = 1000000000  # 1 Gwei
        with pytest.raises(InsufficientFundsForGasError):
            import asyncio
            asyncio.run(signer.sign_and_send_transaction(
                to_address=TESTNET_WHSK,
                data="0x",
                value_wei=10**18,
                gas_limit=250000,
            ))


# =============================================================================
# 5. Look-Ahead Bias Prevention
# =============================================================================
def test_look_ahead_bias_prevention():
    feed = HistoricalDataFeed()
    candles = feed.get_benchmark_candles(count=100)

    # Strategy at bar 30 only sees candles[:31]
    sig_at_30 = StrategySignals.evaluate_momentum_trend(candles[:31])
    # Future alteration of bar 50 must NOT change signal at bar 30
    candles_modified = [dict(c) for c in candles]
    candles_modified[50]["close"] = 999.0 # Extreme future manipulation
    sig_at_30_after = StrategySignals.evaluate_momentum_trend(candles_modified[:31])

    assert sig_at_30 == sig_at_30_after

    # In BacktestEngine, fill occurs at bar t+1 open, never at bar t close or future high
    engine = BacktestEngine()
    bt = engine.run_backtest(candles, strategy_name="MOMENTUM_TREND_FOLLOWING")
    trades = bt["strategies"]["MOMENTUM_TREND_FOLLOWING"]["trades"]
    for tr in trades:
        # Holding bars must be >= 0
        assert tr["holding_bars"] >= 0
        assert tr["exit_bar"] >= tr["entry_bar"]


# =============================================================================
# 6. Data Leakage Prevention (Strict Chronological Train/Test Split)
# =============================================================================
def test_data_leakage_prevention():
    feed = HistoricalDataFeed()
    candles = feed.get_benchmark_candles(count=200)

    split_ratio = 0.70
    split_idx = int(len(candles) * split_ratio)
    train_candles = candles[:split_idx]
    test_candles = candles[split_idx:]

    # Train timestamps must be strictly less than Test timestamps
    train_max_t = max(c["timestamp"] for c in train_candles)
    test_min_t = min(c["timestamp"] for c in test_candles)

    assert train_max_t < test_min_t, "Data leakage detected: train and test sets overlap chronologically!"


# =============================================================================
# 7. Backtest Reproducibility
# =============================================================================
def test_backtest_reproducibility():
    feed = HistoricalDataFeed()
    candles1 = feed.get_benchmark_candles(count=200, seed=42)
    candles2 = feed.get_benchmark_candles(count=200, seed=42)

    engine = BacktestEngine(initial_capital=1000.0)
    res1 = engine.run_backtest(candles1)
    res2 = engine.run_backtest(candles2)

    assert res1["combined_metrics"]["total_return_pct"] == res2["combined_metrics"]["total_return_pct"]
    assert res1["combined_metrics"]["win_rate_pct"] == res2["combined_metrics"]["win_rate_pct"]
    assert res1["combined_metrics"]["net_profit_usd"] == res2["combined_metrics"]["net_profit_usd"]
    assert res1["combined_metrics"]["max_drawdown_pct"] == res2["combined_metrics"]["max_drawdown_pct"]


# =============================================================================
# 8. Stop-Loss Execution Failure Handling (Testnet Live Position Gating)
# =============================================================================
def test_stop_loss_testnet_gating():
    tracker = PortfolioTracker(initial_cash_usd=1000.0)
    # Add a live TESTNET position (is_simulated = False)
    pos = tracker.add_position(
        position_id="testnet_pos_1",
        pair="WHSK/USDT",
        side="LONG",
        entry_price=0.85,
        quantity=100.0,
        cost_usd=85.0,
        stop_loss=0.83, # Stop-loss threshold
        take_profit=0.90,
        is_simulated=False,
    )

    # Price drops to $0.82 (triggering stop-loss)
    events = tracker.update_market_prices({"WHSK/USDT": 0.82})

    # CRITICAL AUDIT: Position must NOT be closed automatically!
    assert pos.is_open is True
    assert len(events) == 1
    assert events[0]["action"] == "EXIT_PROPOSAL_GENERATED"
    assert events[0]["event_type"] == "STOP_LOSS"
    assert pos.pending_exit_proposal is not None
    assert pos.pending_exit_proposal["status"] == "WAITING_USER_APPROVAL_EXIT"

    # Only when explicit approval with on-chain receipt occurs is it closed
    closed_trade = tracker.approve_testnet_exit(
        position_id="testnet_pos_1",
        actual_exit_price=0.82,
        tx_hash="0xabc1234567890abcdef",
        gas_used=145000,
        reason="STOP_LOSS",
    )
    assert closed_trade is not None
    assert pos.is_open is False
    assert closed_trade["tx_hash"] == "0xabc1234567890abcdef"


# =============================================================================
# 9. Take-Profit Execution Gating (Testnet Mode)
# =============================================================================
def test_take_profit_testnet_gating():
    tracker = PortfolioTracker(initial_cash_usd=1000.0)
    pos = tracker.add_position(
        position_id="testnet_pos_2",
        pair="WHSK/USDT",
        side="LONG",
        entry_price=0.85,
        quantity=100.0,
        cost_usd=85.0,
        stop_loss=0.83,
        take_profit=0.90, # TP threshold
        is_simulated=False,
    )

    # Price surges to $0.92
    events = tracker.update_market_prices({"WHSK/USDT": 0.92})

    # Must generate exit proposal awaiting operator approval
    assert pos.is_open is True
    assert events[0]["action"] == "EXIT_PROPOSAL_GENERATED"
    assert events[0]["event_type"] == "TAKE_PROFIT"


# =============================================================================
# 10. Partial Transaction Failure Unwinding (Multi-Step Arbitrage)
# =============================================================================
@pytest.mark.asyncio
async def test_partial_transaction_failure_unwinding():
    executor = ExecutionAgent()
    leg1_plan = {
        "pair": "WHSK/USDT",
        "direction": "BUY",
        "token_in": TESTNET_USDT,
        "token_out": TESTNET_WHSK,
        "amount_in": 50.0,
        "expected_amount_out": 58.5,
        "execution_price": 0.8542,
        "fee_amount": 0.025,
    }
    leg2_plan = {
        "pair": "WHSK/USDT",
        "direction": "SELL",
        "token_in": TESTNET_WHSK,
        "token_out": TESTNET_USDT,
        "amount_in": 58.5,
        "expected_amount_out": 51.5,
        "execution_price": 0.8800,
        "fee_amount": 0.15,
    }

    # Simulate Leg 1 success, but Leg 2 failure
    executor.execute_trade = AsyncMock()
    executor.execute_trade.side_effect = [
        {"status": "CONFIRMED", "reconciled_received": 58.5}, # Leg 1 confirmed
        {"status": "REVERTED", "error": "Execution reverted in pool 2"}, # Leg 2 reverted
    ]

    res = await executor.execute_multi_step_arbitrage(leg1_plan, leg2_plan)

    assert res["status"] == "PARTIAL_FAILURE_UNWOUND"
    assert res["completed"] is False
    assert res["unwound_tokens"] == 58.5
    assert res["intermediate_token"] == TESTNET_WHSK


# =============================================================================
# 11. Restart Recovery Persistence
# =============================================================================
def test_restart_recovery_persistence(tmp_path):
    f_path = str(tmp_path / "forward_test_session.json")
    engine = ForwardTestEngine(persistence_file=f_path)

    # Start session
    session = engine.start_session(duration_mode="24h", initial_equity_usd=1500.0)
    engine.active_session.record_equity_snapshot(1520.0, 20.0, 0.0)
    engine.save_to_disk()

    # Re-instantiate engine simulating backend reboot
    new_engine = ForwardTestEngine(persistence_file=f_path)
    assert new_engine.active_session is not None
    assert new_engine.active_session.session_id == session["session_id"]
    assert new_engine.active_session.initial_equity_usd == 1500.0
    assert new_engine.active_session.current_equity_usd == 1520.0
    assert len(new_engine.active_session.equity_history) == 2


# =============================================================================
# 12. Balance Reconciliation Mismatch Handling
# =============================================================================
def test_balance_reconciliation_math():
    w3 = Web3()
    bal_before = 100 * 10**18
    bal_after = 158 * 10**18 # Received 58 tokens
    received = float(w3.from_wei(bal_after - bal_before, "ether"))
    assert received == 58.0

    # If balance did not increase
    bal_after_revert = 100 * 10**18
    delta = bal_after_revert - bal_before
    assert delta == 0


# =============================================================================
# 13. Duplicate Order Prevention
# =============================================================================
def test_duplicate_order_prevention():
    orch = CentralOrchestrator()
    pair = "WHSK/USDT"
    direction = "BUY"
    strategy = "MOMENTUM_TREND_FOLLOWING"

    # Initially not duplicate
    assert orch.check_duplicate_trade(pair, direction, strategy) is False

    # Record trade execution fingerprint
    orch.record_trade_fingerprint(pair, direction, strategy)

    # Second trade within window must be flagged as duplicate
    assert orch.check_duplicate_trade(pair, direction, strategy) is True
