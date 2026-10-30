import pytest
import time
from backend.risk.engine import DeterministicRiskEngine, RiskPolicyConfig

def test_risk_engine_default_policy():
    engine = DeterministicRiskEngine()
    assert engine.policy.max_trade_allocation_pct == 10.0
    assert engine.policy.max_slippage_pct == 1.0
    assert engine.policy.max_daily_loss_pct == 3.0
    assert engine.policy.max_portfolio_drawdown_pct == 10.0
    assert engine.policy.max_concurrent_positions == 3
    assert engine.policy.emergency_pause_active is False

def test_risk_engine_rejects_emergency_pause():
    engine = DeterministicRiskEngine()
    engine.toggle_emergency_pause(True)

    opp = {
        "pair": "WHSK/USDT",
        "trade_size_usd": 50.0,
        "source_venue": "HSKSwap V3 (0.3% Pool)",
        "estimated_price_impact_pct": 0.2,
    }
    p_state = {"available_cash_usd": 1000.0, "open_positions_count": 0}

    result = engine.evaluate_opportunity(opp, p_state)
    assert result.is_approved is False
    assert result.rule_evaluated == "EMERGENCY_PAUSE"
    assert result.violation_code == "CIRCUIT_BREAKER_ACTIVE"

def test_risk_engine_rejects_untrusted_token():
    engine = DeterministicRiskEngine()
    opp = {
        "pair": "SCAM/USDT",
        "trade_size_usd": 50.0,
        "source_venue": "HSKSwap V3 (0.3% Pool)",
        "estimated_price_impact_pct": 0.2,
    }
    p_state = {"available_cash_usd": 1000.0, "open_positions_count": 0}

    result = engine.evaluate_opportunity(opp, p_state)
    assert result.is_approved is False
    assert result.rule_evaluated == "TOKEN_ALLOWLIST"
    assert result.violation_code == "UNTRUSTED_TOKEN"

def test_risk_engine_rejects_excessive_allocation():
    engine = DeterministicRiskEngine()
    # 10% of 1000 is 100. Trade size 150 is 15% -> violation!
    opp = {
        "pair": "WHSK/USDT",
        "trade_size_usd": 150.0,
        "source_venue": "HSKSwap V3 (0.3% Pool)",
        "estimated_price_impact_pct": 0.2,
    }
    p_state = {"available_cash_usd": 1000.0, "open_positions_count": 0}

    result = engine.evaluate_opportunity(opp, p_state)
    assert result.is_approved is False
    assert result.rule_evaluated == "MAX_TRADE_ALLOCATION"
    assert result.violation_code == "ALLOCATION_EXCEEDED"

def test_risk_engine_rejects_excessive_slippage():
    engine = DeterministicRiskEngine()
    # Slippage limit is 1.0%. Estimated impact 2.4% -> violation!
    opp = {
        "pair": "WHSK/USDT",
        "trade_size_usd": 50.0,
        "source_venue": "HSKSwap V3 (0.3% Pool)",
        "estimated_price_impact_pct": 2.4,
    }
    p_state = {"available_cash_usd": 1000.0, "open_positions_count": 0}

    result = engine.evaluate_opportunity(opp, p_state)
    assert result.is_approved is False
    assert result.rule_evaluated == "MAX_SLIPPAGE"
    assert result.violation_code == "SLIPPAGE_EXCEEDED"

def test_risk_engine_rejects_max_concurrent_positions():
    engine = DeterministicRiskEngine()
    opp = {
        "pair": "WHSK/USDT",
        "trade_size_usd": 50.0,
        "source_venue": "HSKSwap V3 (0.3% Pool)",
        "estimated_price_impact_pct": 0.2,
    }
    # Currently 3 positions open (limit is 3) -> violation!
    p_state = {"available_cash_usd": 1000.0, "open_positions_count": 3}

    result = engine.evaluate_opportunity(opp, p_state)
    assert result.is_approved is False
    assert result.rule_evaluated == "MAX_CONCURRENT_POSITIONS"
    assert result.violation_code == "CONCURRENT_POSITIONS_FULL"

def test_risk_engine_approves_compliant_trade():
    engine = DeterministicRiskEngine()
    opp = {
        "pair": "WHSK/USDT",
        "trade_size_usd": 50.0, # 5% of 1000 -> OK
        "source_venue": "HSKSwap V3 (0.3% Pool)",
        "estimated_price_impact_pct": 0.15, # < 1.0% -> OK
        "estimated_gas_cost_usd": 0.0001, # < $2.50 -> OK
    }
    p_state = {
        "available_cash_usd": 1000.0,
        "open_positions_count": 1,
        "daily_loss_pct": 0.0,
        "portfolio_drawdown_pct": 0.0,
    }

    result = engine.evaluate_opportunity(opp, p_state)
    assert result.is_approved is True
    assert result.rule_evaluated == "ALL_RULES_PASSED"
    assert result.violation_code is None
