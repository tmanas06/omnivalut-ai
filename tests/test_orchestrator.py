import pytest
from backend.orchestrator.orchestrator import CentralOrchestrator
from backend.risk.engine import DeterministicRiskEngine
from backend.portfolio.tracker import PortfolioTracker

@pytest.mark.asyncio
async def test_orchestrator_full_cycle():
    orch = CentralOrchestrator()
    result = await orch.run_orchestration_cycle()
    assert "correlation_id" in result
    assert "portfolio" in result
    assert "recent_decisions" in result
    assert len(orch.decision_logs) >= 1

@pytest.mark.asyncio
async def test_orchestrator_rejects_excessive_slippage():
    orch = CentralOrchestrator()
    # Tighten max slippage to 0.01%
    orch.risk_engine.policy.max_slippage_pct = 0.01
    
    opp = {
        "id": "opp_test_slip",
        "pair": "WHSK/USDT",
        "direction": "BUY",
        "trade_size_usd": 50.0,
        "source_venue": "HSKSwap V3 (0.3% Pool)",
        "estimated_price_impact_pct": 0.50, # 0.50% > 0.01%
    }
    p_state = orch.portfolio_tracker.get_portfolio_summary()
    res = orch.risk_engine.evaluate_opportunity(opp, p_state)
    assert res.is_approved is False
    assert res.violation_code == "SLIPPAGE_EXCEEDED"

@pytest.mark.asyncio
async def test_orchestrator_emergency_pause_halts_execution():
    orch = CentralOrchestrator()
    orch.risk_engine.toggle_emergency_pause(True)

    opp = {
        "id": "opp_test_pause",
        "pair": "WHSK/USDT",
        "direction": "BUY",
        "trade_size_usd": 50.0,
        "source_venue": "HSKSwap V3 (0.3% Pool)",
        "estimated_price_impact_pct": 0.10,
    }
    p_state = orch.portfolio_tracker.get_portfolio_summary()
    res = orch.risk_engine.evaluate_opportunity(opp, p_state)
    assert res.is_approved is False
    assert res.violation_code == "CIRCUIT_BREAKER_ACTIVE"
