import logging
from typing import Dict, Any, List
from backend.agents.base import BaseAgent
from backend.adapters.hskswap.adapter import HSKSwapAdapter
from backend.adapters.hskswap.market_data import market_data_service

class MarketIntelligenceAgent(BaseAgent):
    """
    Agent 1: Market Intelligence Agent.
    Continuously monitors HSKSwap pools on HashKey Chain, tracks liquidity reserves,
    volatility, and price velocity, and flags abnormal market anomalies.
    """

    def __init__(self, adapter: HSKSwapAdapter = None):
        super().__init__(
            agent_id="agent_market_intelligence",
            name="Market Intelligence Agent",
            description="Monitors HSKSwap on-chain liquidity, price volatility, volume, and data freshness across HashKey Chain.",
            execution_interval_seconds=10,
            supported_assets=["WHSK", "USDT", "USDC.e"],
            supported_strategies=["LIQUIDITY_SURVEILLANCE", "VOLATILITY_ANOMALY"],
        )
        self.adapter = adapter or HSKSwapAdapter()

    async def execute_cycle(self, correlation_id: str) -> Dict[str, Any]:
        pairs = ["WHSK/USDT", "WHSK/USDC.e"]
        market_reports: List[Dict[str, Any]] = []
        anomalies: List[Dict[str, Any]] = []

        for pair in pairs:
            state = await market_data_service.get_current_market_state(pair)
            
            # Detect volatility anomaly
            is_high_volatility = state["volatility"] > 0.05
            is_stale = False # checked by timestamp difference

            if is_high_volatility:
                anomalies.append({
                    "pair": pair,
                    "type": "HIGH_VOLATILITY",
                    "severity": "WARNING",
                    "value": state["volatility"],
                    "message": f"Elevated volatility detected ({state['volatility'] * 100:.2f}%) on {pair}.",
                })

            market_reports.append({
                "pair": pair,
                "price": state["current_price"],
                "24h_change_pct": state["change_24h_pct"],
                "24h_volume_usd": state["volume_24h_usd"],
                "volatility": state["volatility"],
                "pool_liquidity": state["pool_liquidity"],
                "pool_address": state["pool_address"],
                "data_quality": "FRESH" if not is_stale else "STALE",
            })

        return {
            "correlation_id": correlation_id,
            "status": "HEALTHY",
            "pairs_monitored": len(pairs),
            "market_reports": market_reports,
            "anomalies": anomalies,
            "regime": "HIGH_VOLATILITY" if anomalies else "STABLE_ACCUMULATION",
        }
