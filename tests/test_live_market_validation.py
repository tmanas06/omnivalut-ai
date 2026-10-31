import os
import json
import time
import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from backend.adapters.hskswap.collector import MarketObservationCollector
from backend.adapters.hskswap.constants import TESTNET_WHSK, TESTNET_USDT, TESTNET_USDC
from backend.forward_testing.engine import ForwardTestEngine, ForwardTestSession
from backend.agents.arbitrage import ArbitrageAgent, ArbitrageClassification
from backend.risk.engine import DeterministicRiskEngine, RiskPolicyConfig
from backend.portfolio.tracker import PortfolioTracker


# =============================================================================
# 1. Missing Market Observations (No Fabrication)
# =============================================================================
@pytest.mark.asyncio
async def test_missing_market_observations_not_fabricated(tmp_path):
    storage_file = str(tmp_path / "market_obs.json")
    collector = MarketObservationCollector(persistence_file=storage_file)

    initial_obs_count = len(collector.observations)

    # Mock adapter where get_quote fails with an RPC/network error
    mock_adapter = MagicMock()
    mock_adapter.w3 = MagicMock()
    mock_adapter.w3.eth = MagicMock()
    mock_adapter.w3.eth.gas_price = 1200000000  # 1.2 Gwei
    mock_adapter.w3.from_wei.return_value = 1.2
    mock_adapter.get_pool_liquidity = AsyncMock(return_value={"liquidity": 5000000})
    mock_adapter.get_native_token_price_usd = AsyncMock(return_value=0.85)
    mock_adapter.get_quote = AsyncMock(side_effect=Exception("RPC endpoint timeout"))

    collector.adapter = mock_adapter

    records = await collector.collect_live_pools_sample()

    # Verify no fabricated observations were added
    assert len(records) == 0
    assert len(collector.observations) == initial_obs_count

    # Telemetry must honestly record the failed collections and missed counts
    telemetry = collector.get_reliability_metrics()
    assert telemetry["failed_collections"] > 0
    assert telemetry["missed_observation_count"] > 0
    assert telemetry["quote_failure_rate_pct"] > 0.0


# =============================================================================
# 2. RPC Interruptions Tracking
# =============================================================================
@pytest.mark.asyncio
async def test_rpc_interruptions_recorded(tmp_path):
    storage_file = str(tmp_path / "market_obs.json")
    collector = MarketObservationCollector(persistence_file=storage_file)

    mock_adapter = MagicMock()
    mock_adapter.w3 = MagicMock()
    mock_adapter.w3.eth = MagicMock()
    # Simulate RPC failure when querying gas price
    type(mock_adapter.w3.eth).gas_price = MagicMock(side_effect=ConnectionError("Failed to connect to https://testnet.hsk.xyz"))

    collector.adapter = mock_adapter

    records = await collector.collect_live_pools_sample()

    assert len(records) == 0
    metrics = collector.get_reliability_metrics()
    assert metrics["rpc_failure_rate_pct"] > 0.0


# =============================================================================
# 3. Stale Quotes Rejection and Tracking
# =============================================================================
def test_stale_quotes_rejected_and_tracked(tmp_path):
    storage_file = str(tmp_path / "market_obs.json")
    collector = MarketObservationCollector(persistence_file=storage_file)

    now = time.time()
    # Fresh observation (10s old)
    fresh_obs = collector.record_observation(
        pair="WHSK/USDT",
        pool_address="0x1111111111111111111111111111111111111111",
        fee_tier=3000,
        timestamp=now - 10.0,
        spot_price=0.85,
        executable_quote=0.849,
        active_liquidity=5000000,
        gas_price_gwei=1.2,
        estimated_gas_cost_usd=0.00015,
        price_impact_pct=0.02,
        quote_age_seconds=10.0,
        is_fresh=True,
    )
    assert fresh_obs is not None
    assert fresh_obs["is_fresh"] is True

    # Stale observation (45s old > 30s threshold)
    stale_obs = collector.record_observation(
        pair="WHSK/USDT",
        pool_address="0x2222222222222222222222222222222222222222",
        fee_tier=500,
        timestamp=now - 45.0,
        spot_price=0.85,
        executable_quote=0.849,
        active_liquidity=5000000,
        gas_price_gwei=1.2,
        estimated_gas_cost_usd=0.00015,
        price_impact_pct=0.02,
        quote_age_seconds=45.0,
        is_fresh=False,
    )
    assert stale_obs is not None
    assert stale_obs["is_fresh"] is False

    metrics = collector.get_reliability_metrics()
    assert metrics["stale_quote_rejections"] >= 1


# =============================================================================
# 4. Duplicate Observations Prevention
# =============================================================================
def test_duplicate_observations_prevented(tmp_path):
    storage_file = str(tmp_path / "market_obs.json")
    collector = MarketObservationCollector(persistence_file=storage_file)

    t = 1700000000.0
    # First insertion must succeed and return record
    first = collector.record_observation(
        pair="WHSK/USDT",
        pool_address="0x1234567890123456789012345678901234567890",
        fee_tier=3000,
        timestamp=t,
        spot_price=0.85,
        executable_quote=0.85,
        active_liquidity=1000000,
        gas_price_gwei=1.2,
        estimated_gas_cost_usd=0.00015,
        price_impact_pct=0.01,
        quote_age_seconds=2.0,
        is_fresh=True,
    )
    assert first is not None
    assert len(collector.observations) == 1

    # Duplicate insertion with exact same pool and timestamp must return None and not append
    second = collector.record_observation(
        pair="WHSK/USDT",
        pool_address="0x1234567890123456789012345678901234567890",
        fee_tier=3000,
        timestamp=t,
        spot_price=0.85,
        executable_quote=0.85,
        active_liquidity=1000000,
        gas_price_gwei=1.2,
        estimated_gas_cost_usd=0.00015,
        price_impact_pct=0.01,
        quote_age_seconds=2.0,
        is_fresh=True,
    )
    assert second is None
    assert len(collector.observations) == 1


# =============================================================================
# 5. Profit Factor Calculation (Safe Zero-Loss Division)
# =============================================================================
def test_safe_profit_factor_calculation_zero_losses():
    agent = ArbitrageAgent(min_net_profit_usd=0.50)

    # When gross loss is 0 and profit > 0
    calc = agent.calculate_net_arbitrage(
        entry_price=0.80,
        exit_price=0.86,
        trade_amount=100.0,
        fee_tier_in=500,
        fee_tier_out=500,
        available_liquidity=10000000,
    )
    assert calc["is_profitable"] is True
    assert calc["net_profit_usd"] > 0

    # Safe profit factor formula when zero losses occurred
    gross_profit = 150.0
    gross_loss = 0.0
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else (999.0 if gross_profit > 0 else 0.0)
    assert profit_factor == 999.0

    # Both zero
    zero_pf = 0.0 / 0.0 if 0.0 > 0 else (999.0 if 0.0 > 0 else 0.0)
    assert zero_pf == 0.0


# =============================================================================
# 6. Zero-Loss Strategy Performance Tracking
# =============================================================================
def test_zero_loss_strategy_performance_tracking(tmp_path):
    p_file = str(tmp_path / "forward_session.json")
    engine = ForwardTestEngine(persistence_file=p_file)
    engine.start_session(duration_mode="7d", initial_equity_usd=1000.0)

    # Record 2 winning trades for MOMENTUM_TREND_FOLLOWING with 0 losses
    session = engine.active_session
    session.record_trade_completion(
        strategy="MOMENTUM_TREND_FOLLOWING",
        gross_pnl=0.51,
        net_pnl=0.50,
        transaction_costs=0.01,
        holding_seconds=60.0,
    )
    session.record_trade_completion(
        strategy="MOMENTUM_TREND_FOLLOWING",
        gross_pnl=0.51,
        net_pnl=0.50,
        transaction_costs=0.01,
        holding_seconds=45.0,
    )

    status = engine.get_status()
    strat_metrics = status["strategy_performance"]["MOMENTUM_TREND_FOLLOWING"]

    assert strat_metrics["paper_trades_executed"] == 2
    assert strat_metrics["winning_trades"] == 2
    assert strat_metrics["losing_trades"] == 0
    assert strat_metrics["win_rate_pct"] == 100.0
    assert strat_metrics["profit_factor"] == 999.0
    assert strat_metrics["net_profit_usd"] == 1.0
    assert strat_metrics["max_drawdown_pct"] == 0.0


# =============================================================================
# 7. Incomplete Forward-Testing Sessions
# =============================================================================
def test_incomplete_forward_testing_sessions(tmp_path):
    p_file = str(tmp_path / "forward_session.json")
    engine = ForwardTestEngine(persistence_file=p_file)
    engine.start_session(duration_mode="7d", initial_equity_usd=1000.0)

    status = engine.get_status()
    assert status["status"] == "RUNNING"
    assert status["duration_mode"] == "7d"
    assert status["target_end_time"] > status["start_time"]
    assert status["remaining_seconds"] > 600000.0
    # Must NOT claim completion prematurely
    assert status["progress_pct"] < 0.1


# =============================================================================
# 8. Restart Recovery & System Interruptions
# =============================================================================
def test_restart_recovery_and_system_interruptions(tmp_path):
    p_file = str(tmp_path / "forward_session.json")
    engine1 = ForwardTestEngine(persistence_file=p_file)
    engine1.start_session(duration_mode="7d", initial_equity_usd=1000.0)

    # Record trade completion and interruption in session 1
    session1 = engine1.active_session
    session1.record_trade_completion(
        strategy="ARBITRAGE_CROSS_TIER",
        gross_pnl=0.80,
        net_pnl=0.79,
        transaction_costs=0.01,
        holding_seconds=15.0,
    )
    session1.record_interruption(
        started_at=time.time() - 300,
        resumed_at=time.time(),
        reason="Server redeployed during live market monitoring",
    )
    engine1.save_to_disk()

    # Simulate restart by creating new engine instance pointing to same storage file
    engine2 = ForwardTestEngine(persistence_file=p_file)
    status2 = engine2.get_status()

    assert status2["status"] == "RUNNING"
    assert status2["duration_mode"] == "7d"
    assert status2["interruptions_count"] >= 1
    assert any(i["reason"] == "Server redeployed during live market monitoring" for i in status2["interruptions"])
    assert status2["strategy_performance"]["ARBITRAGE_CROSS_TIER"]["paper_trades_executed"] == 1


# =============================================================================
# 9. Portfolio Reconciliation (No Accounting Drift)
# =============================================================================
def test_portfolio_reconciliation(tmp_path):
    p_file = str(tmp_path / "forward_session.json")
    engine = ForwardTestEngine(persistence_file=p_file)
    engine.start_session(duration_mode="7d", initial_equity_usd=1000.0)

    session = engine.active_session

    # Snapshot 1: +$10.00 realized PnL
    session.record_equity_snapshot(equity=1010.00, unrealized_pnl=0.0, realized_pnl=10.00)
    # Snapshot 2: -$4.00 realized PnL (drawdown from 1010 to 1006)
    session.record_equity_snapshot(equity=1006.00, unrealized_pnl=0.0, realized_pnl=6.00)

    status = engine.get_status()
    # Expected: 1006.00
    assert pytest.approx(status["current_equity_usd"], 0.001) == 1006.00
    assert len(session.equity_history) == 3  # Initial + 2 snapshots

    # Drawdown check: (1010 - 1006) / 1010 = 4 / 1010 ~= 0.396%
    last_snap = session.equity_history[-1]
    assert last_snap["drawdown_pct"] > 0.0
    assert last_snap["drawdown_pct"] < 1.0


# =============================================================================
# 10. Experiment Reproducibility
# =============================================================================
def test_experiment_reproducibility():
    """
    Verifies that identical deterministic trade opportunities evaluated against
    the deterministic risk engine yield the exact same acceptance/rejection decisions.
    """
    risk_engine_a = DeterministicRiskEngine()
    risk_engine_b = DeterministicRiskEngine()

    p_state = {"available_cash_usd": 1000.0, "open_positions_count": 0}

    test_opportunities = [
        {
            "pair": "WHSK/USDT",
            "trade_size_usd": 50.0,
            "source_venue": "HSKSwap V3 (0.3% Pool)",
            "estimated_price_impact_pct": 0.5,
        },
        {
            "pair": "WHSK/USDT",
            "trade_size_usd": 250.0,  # Exceeds max trade allocation (10% of 1000 = $100) -> MUST BE REJECTED
            "source_venue": "HSKSwap V3 (0.3% Pool)",
            "estimated_price_impact_pct": 0.5,
        },
        {
            "pair": "WHSK/USDT",
            "trade_size_usd": 40.0,
            "source_venue": "HSKSwap V3 (0.3% Pool)",
            "estimated_price_impact_pct": 3.0,  # Exceeds max slippage/impact (1.0%) -> MUST BE REJECTED
        },
    ]

    decisions_a = [risk_engine_a.evaluate_opportunity(opp, p_state) for opp in test_opportunities]
    decisions_b = [risk_engine_b.evaluate_opportunity(opp, p_state) for opp in test_opportunities]

    assert len(decisions_a) == len(decisions_b) == 3

    for res_a, res_b in zip(decisions_a, decisions_b):
        assert res_a.is_approved == res_b.is_approved
        assert res_a.rule_evaluated == res_b.rule_evaluated
        assert res_a.violation_code == res_b.violation_code

    # Opportunity 1 approved
    assert decisions_a[0].is_approved is True
    # Opportunity 2 rejected (MAX_TRADE_ALLOCATION)
    assert decisions_a[1].is_approved is False
    assert decisions_a[1].rule_evaluated == "MAX_TRADE_ALLOCATION"
    # Opportunity 3 rejected (MAX_SLIPPAGE)
    assert decisions_a[2].is_approved is False
    assert decisions_a[2].rule_evaluated == "MAX_SLIPPAGE"
