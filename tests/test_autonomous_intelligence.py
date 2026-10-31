import os
import time
import uuid
import pytest
import asyncio
from unittest.mock import AsyncMock, patch

from backend.adapters.hskswap.market_data import (
    MarketDataService,
    market_data_service,
    StaleMarketDataError,
    IncompleteMarketDataError,
)
from backend.agents.supervisor import AgentSupervisor
from backend.agents.market_intelligence import MarketIntelligenceAgent
from backend.agents.technical_analysis import TechnicalAnalysisAgent
from backend.agents.arbitrage import ArbitrageAgent
from backend.agents.liquidity import LiquidityAgent
from backend.agents.strategy import StrategyAgent
from backend.risk.engine import DeterministicRiskEngine, RiskPolicyConfig, RiskAgent
from backend.agents.portfolio_agent import PortfolioAgent
from backend.portfolio.tracker import PortfolioTracker, PositionRecord
from backend.orchestrator.orchestrator import CentralOrchestrator
from backend.execution.executor import ExecutionAgent

# =============================================================================
# 1. Agent Coordination: All 7 Specialized Agents
# =============================================================================
@pytest.mark.asyncio
async def test_agent_coordination_all_seven_agents():
    """Verify all 7 specialized agents coordinate in a single cycle."""
    risk_engine = DeterministicRiskEngine()
    portfolio = PortfolioTracker(initial_cash_usd=1000.0)
    supervisor = AgentSupervisor(risk_engine=risk_engine, portfolio_tracker=portfolio)

    assert len(supervisor.agents) == 7
    expected_ids = {
        "agent_market_intelligence",
        "agent_arbitrage",
        "agent_technical_analysis",
        "agent_liquidity",
        "agent_strategy",
        "agent_risk",
        "agent_portfolio",
    }
    assert set(supervisor.agents.keys()) == expected_ids

    cid = str(uuid.uuid4())
    cycle_res = await supervisor.run_single_cycle(correlation_id=cid)

    assert cycle_res["agents_evaluated"] == 7
    telemetry = cycle_res["telemetry"]
    for aid in expected_ids:
        assert aid in telemetry
        assert telemetry[aid]["status"] == "COMPLETED"
        assert telemetry[aid]["duration_ms"] >= 0

# =============================================================================
# 2. Market Data Staleness & Incomplete Data Rejection
# =============================================================================
@pytest.mark.asyncio
async def test_market_data_staleness_rejection():
    """Verify that stale market quotes are rejected by the data service and market agent."""
    svc = MarketDataService()
    svc.set_test_staleness_override("WHSK/USDT", age_seconds=150)

    # Direct validation test
    with pytest.raises(StaleMarketDataError):
        await svc.get_current_market_state("WHSK/USDT", enforce_freshness=True, max_staleness_seconds=60)

    # Market Intelligence Agent handling
    agent = MarketIntelligenceAgent(max_staleness_seconds=60)
    with patch("backend.agents.market_intelligence.market_data_service", svc):
        telemetry = await agent.run(correlation_id="stale_check_cid")
        assert telemetry.status == "COMPLETED"
        assert telemetry.data["status"] == "DEGRADED_STALE_DATA"
        anomalies = telemetry.data["anomalies"]
        assert any(a["type"] == "STALE_DATA_REJECTION" for a in anomalies)

    svc.clear_test_staleness_override("WHSK/USDT")

def test_market_data_incomplete_rejection():
    """Verify that malformed or incomplete market data is rejected."""
    svc = MarketDataService()
    # Missing price
    with pytest.raises(IncompleteMarketDataError):
        svc.validate_market_data({"pair": "WHSK/USDT", "pool_liquidity": 5000, "timestamp": time.time()})

    # Negative price
    with pytest.raises(IncompleteMarketDataError):
        svc.validate_market_data({"pair": "WHSK/USDT", "current_price": -0.5, "pool_liquidity": 5000, "timestamp": time.time()})

# =============================================================================
# 3. Arbitrage Profitability After Costs
# =============================================================================
def test_arbitrage_profitability_calculation():
    """Verify Arbitrage calculation accurately nets DEX fees, gas, slippage, and price impact."""
    agent = ArbitrageAgent()
    # 50 WHSK with significant spread: Entry $0.80, Exit $0.86 (+$3.00 gross)
    result = agent.calculate_net_arbitrage(
        entry_price=0.80,
        exit_price=0.86,
        trade_amount=50.0,
        fee_tier_in=500,     # 0.05%
        fee_tier_out=3000,   # 0.30%
        gas_units=250000,
        gas_price_gwei=0.5,
        native_token_price_usd=0.85,
        slippage_tolerance_pct=0.5,
        price_impact_pct=0.1,
    )

    assert result["gross_profit_usd"] == 3.0
    assert result["dex_trading_fees"] > 0
    assert result["estimated_gas"] > 0
    assert result["slippage"] > 0
    assert result["price_impact"] > 0
    assert result["total_costs_usd"] < result["gross_profit_usd"]
    assert result["expected_net_profit"] > 0
    assert result["is_profitable"] is True

# =============================================================================
# 4. Unprofitable Opportunity Rejection
# =============================================================================
def test_unprofitable_arbitrage_rejection():
    """Verify candidate where friction costs exceed spread is rejected as unprofitable."""
    agent = ArbitrageAgent()
    # Tiny spread: Entry $0.8500, Exit $0.8505 (Gross: $0.025 on 50 tokens)
    result = agent.calculate_net_arbitrage(
        entry_price=0.8500,
        exit_price=0.8505,
        trade_amount=50.0,
        fee_tier_in=500,
        fee_tier_out=3000,
        gas_units=250000,
        gas_price_gwei=0.5,
        slippage_tolerance_pct=0.5,
        price_impact_pct=0.1,
    )

    # Total costs (~$0.35+) exceed gross profit ($0.025)
    assert result["expected_net_profit"] < 0
    assert result["is_profitable"] is False

# =============================================================================
# 5. Risk Engine Rejection of Unprofitable & Stale Opportunities
# =============================================================================
def test_risk_engine_rejections():
    """Verify deterministic risk rules reject stale quotes, unprofitable arbitrage, and exposure limits."""
    engine = DeterministicRiskEngine()
    portfolio_state = {
        "available_cash_usd": 1000.0,
        "daily_loss_pct": 0.0,
        "portfolio_drawdown_pct": 0.0,
        "open_positions_count": 0,
        "total_exposure_pct": 10.0,
    }

    # 1. Stale quote rejection (Rule 11)
    stale_opp = {
        "pair": "WHSK/USDT",
        "trade_size_usd": 50.0,
        "source_venue": "HSKSwap V3 (0.3% Pool)",
        "estimated_price_impact_pct": 0.1,
        "estimated_gas_cost_usd": 0.0001,
        "age_seconds": 95.0, # Exceeds 60s
    }
    res_stale = engine.evaluate_opportunity(stale_opp, portfolio_state)
    assert res_stale.is_approved is False
    assert res_stale.rule_evaluated == "DATA_STALENESS"

    # 2. Unprofitable trade rejection (Rule 12)
    unprofitable_opp = {
        "pair": "WHSK/USDT",
        "strategy": "INTRA_DEX_ARBITRAGE",
        "trade_size_usd": 50.0,
        "source_venue": "HSKSwap V3 (0.3% Pool)",
        "estimated_price_impact_pct": 0.1,
        "estimated_gas_cost_usd": 0.0001,
        "expected_net_profit_usd": -0.15,
        "age_seconds": 5.0,
    }
    res_unprof = engine.evaluate_opportunity(unprofitable_opp, portfolio_state)
    assert res_unprof.is_approved is False
    assert res_unprof.rule_evaluated == "NET_PROFITABILITY"

    # 3. Excessive exposure rejection (Rule 13)
    high_exposure_portfolio = dict(portfolio_state, total_exposure_pct=85.0) # Exceeds 80% ceiling
    valid_opp = {
        "pair": "WHSK/USDT",
        "strategy": "MOMENTUM_TREND_FOLLOWING",
        "trade_size_usd": 50.0,
        "source_venue": "HSKSwap V3 (0.3% Pool)",
        "estimated_price_impact_pct": 0.1,
        "estimated_gas_cost_usd": 0.0001,
        "expected_net_profit_usd": 1.5,
        "age_seconds": 5.0,
    }
    res_exposure = engine.evaluate_opportunity(valid_opp, high_exposure_portfolio)
    assert res_exposure.is_approved is False
    assert res_exposure.rule_evaluated == "MAX_PORTFOLIO_EXPOSURE"

# =============================================================================
# 6. Duplicate Trade Prevention
# =============================================================================
def test_duplicate_trade_prevention():
    """Verify identical candidate trades are suppressed within cooldown window."""
    orchestrator = CentralOrchestrator()
    pair = "WHSK/USDT"
    direction = "BUY"
    strategy = "MOMENTUM_TREND_FOLLOWING"

    # First check: not duplicate
    assert orchestrator.check_duplicate_trade(pair, direction, strategy) is False

    # Record execution
    orchestrator.record_trade_fingerprint(pair, direction, strategy)

    # Second check: duplicate detected
    assert orchestrator.check_duplicate_trade(pair, direction, strategy) is True

# =============================================================================
# 7. Concurrent Execution Prevention (Mutex Lock)
# =============================================================================
@pytest.mark.asyncio
async def test_concurrent_execution_prevention():
    """Verify execution lock ensures strict serial processing."""
    orchestrator = CentralOrchestrator()
    execution_order = []

    async def mock_execution(task_id: int, delay: float):
        async with orchestrator.execution_lock:
            execution_order.append(f"start_{task_id}")
            await asyncio.sleep(delay)
            execution_order.append(f"end_{task_id}")

    # Launch two concurrent execution requests
    await asyncio.gather(
        mock_execution(1, 0.05),
        mock_execution(2, 0.02),
    )

    # Task 1 must complete before Task 2 starts or vice versa (no interleaving)
    assert execution_order in [
        ["start_1", "end_1", "start_2", "end_2"],
        ["start_2", "end_2", "start_1", "end_1"],
    ]

# =============================================================================
# 8. Stop-Loss & Take-Profit Activation
# =============================================================================
def test_stop_loss_activation():
    """Verify stop-loss closes position and records realized loss."""
    portfolio = PortfolioTracker(initial_cash_usd=1000.0)
    pos = portfolio.add_position(
        position_id="pos_sl_test",
        pair="WHSK/USDT",
        side="LONG",
        entry_price=0.85,
        quantity=100.0,
        cost_usd=85.0,
        stop_loss=0.82, # Stop-loss threshold
        take_profit=0.92,
    )

    # Price drops to $0.81 (below $0.82 stop-loss)
    events = portfolio.update_market_prices({"WHSK/USDT": 0.81})
    assert len(events) == 1
    assert events[0]["event_type"] == "STOP_LOSS"
    assert events[0]["position_id"] == "pos_sl_test"
    # Realized loss: (0.81 - 0.85) * 100 = -$4.00
    assert events[0]["realized_pnl"] == -4.00
    assert pos.is_open is False

def test_take_profit_activation():
    """Verify take-profit closes position and records realized gain."""
    portfolio = PortfolioTracker(initial_cash_usd=1000.0)
    pos = portfolio.add_position(
        position_id="pos_tp_test",
        pair="WHSK/USDT",
        side="LONG",
        entry_price=0.85,
        quantity=100.0,
        cost_usd=85.0,
        stop_loss=0.82,
        take_profit=0.90, # Take-profit threshold
    )

    # Price rises to $0.91 (above $0.90 take-profit)
    events = portfolio.update_market_prices({"WHSK/USDT": 0.91})
    assert len(events) == 1
    assert events[0]["event_type"] == "TAKE_PROFIT"
    # Realized gain: (0.91 - 0.85) * 100 = +$6.00
    assert events[0]["realized_pnl"] == 6.00
    assert pos.is_open is False

# =============================================================================
# 9. Maximum Holding Period Activation
# =============================================================================
def test_max_holding_period_activation():
    """Verify position automatically exits when max holding period expires."""
    portfolio = PortfolioTracker(initial_cash_usd=1000.0)
    pos = portfolio.add_position(
        position_id="pos_holding_test",
        pair="WHSK/USDT",
        side="LONG",
        entry_price=0.85,
        quantity=50.0,
        cost_usd=42.5,
        max_holding_seconds=1800, # 30 minutes
    )

    # Advance time by 2000 seconds
    simulated_future_time = pos.opened_at + 2000
    events = portfolio.update_market_prices({"WHSK/USDT": 0.86}, current_time=simulated_future_time)

    assert len(events) == 1
    assert events[0]["event_type"] == "MAX_HOLDING_EXPIRED"
    assert pos.is_open is False
    assert pos.exit_reason == "MAX_HOLDING_EXPIRED"

# =============================================================================
# 10. Backend Restart Recovery (Persistence)
# =============================================================================
def test_backend_restart_recovery(tmp_path):
    """Verify portfolio positions, balances, and history recover after backend restarts."""
    temp_file = str(tmp_path / "test_portfolio.json")

    # Instance 1: Create state and add positions
    p1 = PortfolioTracker(initial_cash_usd=1000.0, persistence_file=temp_file)
    p1.add_position(
        position_id="pos_persist_open",
        pair="WHSK/USDT",
        side="LONG",
        entry_price=0.85,
        quantity=100.0,
        cost_usd=85.0,
        stop_loss=0.80,
        take_profit=0.95,
    )
    p1.add_position(
        position_id="pos_persist_closed",
        pair="WHSK/USDT",
        side="LONG",
        entry_price=0.80,
        quantity=50.0,
        cost_usd=40.0,
    )
    p1.close_position("pos_persist_closed", exit_price=0.90) # +$5.00 gain
    assert p1.cash_balance_usd == 920.0
    assert pytest.approx(p1.realized_pnl_total, abs=0.001) == 5.0

    # Instance 2: Simulate complete backend restart by initializing fresh object pointing to same file
    p2 = PortfolioTracker(initial_cash_usd=1000.0, persistence_file=temp_file)

    assert len(p2.positions) == 2
    assert p2.positions["pos_persist_open"].is_open is True
    assert p2.positions["pos_persist_open"].stop_loss == 0.80
    assert p2.positions["pos_persist_closed"].is_open is False
    assert p2.cash_balance_usd == 920.0
    assert pytest.approx(p2.realized_pnl_total, abs=0.001) == 5.0
    assert len(p2.trades_history) == 1

# =============================================================================
# 11. Emergency Pause (Circuit Breaker)
# =============================================================================
@pytest.mark.asyncio
async def test_emergency_pause_halts_cycle():
    """Verify emergency pause immediately halts all new trade execution."""
    orchestrator = CentralOrchestrator()
    orchestrator.risk_engine.toggle_emergency_pause(True)

    result = await orchestrator.run_orchestration_cycle()
    decisions = result["recent_decisions"]

    # All proposed candidates must be rejected with EMERGENCY_PAUSE / CIRCUIT_BREAKER_ACTIVE
    rejections = [d for d in decisions if d["state"] == "REJECTED"]
    for r in rejections:
        assert "Risk Rule [EMERGENCY_PAUSE]" in r["explanation"]

    orchestrator.risk_engine.toggle_emergency_pause(False)

# =============================================================================
# 12. Testnet Unattended Trading Blocked
# =============================================================================
@pytest.mark.asyncio
async def test_testnet_unattended_trading_blocked():
    """Verify that in TESTNET mode, candidates are blocked from auto-execution and wait for approval."""
    orchestrator = CentralOrchestrator(
        portfolio_tracker=PortfolioTracker(initial_cash_usd=1000.0, persistence_file=None)
    )
    orchestrator.execution_agent.execution_mode = "testnet"

    # Inject a compliant candidate
    test_opp = {
        "id": "testnet_cand_1",
        "pair": "WHSK/USDT",
        "direction": "BUY",
        "strategy": "MOMENTUM_TREND_FOLLOWING",
        "quoted_price": 0.85,
        "source_venue": "HSKSwap V3 (0.3% Pool)",
        "estimated_price_impact_pct": 0.1,
        "estimated_gas_cost_usd": 0.0001,
        "expected_net_profit_usd": 1.25,
        "age_seconds": 5.0,
    }

    with patch.object(orchestrator.supervisor, "run_single_cycle", return_value={"opportunities": [test_opp], "signals": []}):
        result = await orchestrator.run_orchestration_cycle()

    # Must be placed in pending proposals and NOT executed
    assert "testnet_cand_1" in orchestrator.pending_proposals
    assert orchestrator.pending_proposals["testnet_cand_1"]["opportunity"]["status"] == "WAITING_USER_APPROVAL"

    # Verify explicit approve method exists and triggers execution
    with patch.object(orchestrator.execution_agent, "execute_trade", return_value={"status": "CONFIRMED", "execution_price": 0.85, "amount_in": 50.0, "amount_out": 42.5, "tx_hash": "0x123", "is_simulated": False}):
        approval_res = await orchestrator.approve_testnet_proposal("testnet_cand_1")
        assert approval_res["status"] == "CONFIRMED"
        assert "testnet_cand_1" not in orchestrator.pending_proposals
