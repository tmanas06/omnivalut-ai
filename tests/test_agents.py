import pytest
import asyncio
from backend.agents.market_intelligence import MarketIntelligenceAgent
from backend.agents.arbitrage import ArbitrageAgent
from backend.agents.technical_analysis import TechnicalAnalysisAgent
from backend.agents.liquidity import LiquidityAgent

@pytest.mark.asyncio
async def test_market_intelligence_agent():
    agent = MarketIntelligenceAgent()
    assert agent.agent_id == "agent_market_intelligence"
    telemetry = await agent.run(correlation_id="test_mkt_1")
    assert telemetry.status == "COMPLETED"
    assert telemetry.data is not None
    assert "market_reports" in telemetry.data
    assert len(telemetry.data["market_reports"]) >= 1

@pytest.mark.asyncio
async def test_arbitrage_agent():
    agent = ArbitrageAgent()
    assert agent.agent_id == "agent_arbitrage"
    telemetry = await agent.run(correlation_id="test_arb_1")
    assert telemetry.status == "COMPLETED"
    assert "evaluations" in telemetry.data
    evals = telemetry.data["evaluations"]
    assert len(evals) >= 1
    # Check that net profit formula subtracted fees and gas
    ev = evals[0]
    assert "net_profit_usd" in ev
    assert "gross_profit_usd" in ev
    assert "total_fees_usd" in ev
    assert ev["net_profit_usd"] <= ev["gross_profit_usd"]

@pytest.mark.asyncio
async def test_technical_analysis_agent():
    agent = TechnicalAnalysisAgent()
    assert agent.agent_id == "agent_technical_analysis"
    telemetry = await agent.run(correlation_id="test_ta_1")
    assert telemetry.status == "COMPLETED"
    assert "signals" in telemetry.data
    signals = telemetry.data["signals"]
    assert len(signals) >= 1
    sig = signals[0]
    assert sig["signal_type"] in ["BUY", "SELL", "HOLD"]
    assert 0 <= sig["confidence"] <= 100
    assert "indicator_values" in sig
    assert "rsi_14" in sig["indicator_values"]
    assert "macd" in sig["indicator_values"]
    assert "bollinger_bands" in sig["indicator_values"]

@pytest.mark.asyncio
async def test_liquidity_agent():
    agent = LiquidityAgent(max_impact_pct=2.0)
    assert agent.agent_id == "agent_liquidity"
    telemetry = await agent.run(correlation_id="test_liq_1")
    assert telemetry.status == "COMPLETED"
    assert "depth_curves" in telemetry.data
    curves = telemetry.data["depth_curves"]
    assert len(curves) >= 1

    # Verify impact evaluation validator
    check = await agent.evaluate_trade_impact("0xCA8aAceEC5Db1e91B9Ed3a344bA026c4a2B3ebF6", "0x98B6173A8B7DFc52ce8bc88f1184a918A1CCaa4F", 25.0)
    assert "is_allowed" in check
    assert "price_impact_pct" in check
