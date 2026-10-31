import logging
from typing import Dict, Any, List
from backend.agents.base import BaseAgent
from backend.adapters.hskswap.adapter import HSKSwapAdapter
from backend.adapters.hskswap.market_data import (
    market_data_service,
    StaleMarketDataError,
    IncompleteMarketDataError,
)

logger = logging.getLogger("omnivault.agent.market_intelligence")

class MarketIntelligenceAgent(BaseAgent):
    """
    Agent 1: Market Intelligence Agent.
    Continuously monitors HSKSwap pools on HashKey Chain across fee tiers (0.05%, 0.3%, 1.0%),
    tracks pool liquidity, trading volume, price changes, price impact, and historical price observations.
    Strictly detects and rejects stale or incomplete market data.
    """

    def __init__(self, adapter: HSKSwapAdapter = None, max_staleness_seconds: int = 60):
        super().__init__(
            agent_id="agent_market_intelligence",
            name="Market Intelligence Agent",
            description="Monitors HSKSwap multi-tier liquidity, price changes, volume, price impact, and data freshness across HashKey Chain.",
            execution_interval_seconds=10,
            supported_assets=["WHSK", "USDT", "USDC.e"],
            supported_strategies=["LIQUIDITY_SURVEILLANCE", "VOLATILITY_ANOMALY", "FEE_TIER_MONITORING"],
        )
        self.adapter = adapter or HSKSwapAdapter()
        self.max_staleness_seconds = max_staleness_seconds

    async def execute_cycle(self, correlation_id: str) -> Dict[str, Any]:
        pairs = ["WHSK/USDT", "WHSK/USDC.e"]
        market_reports: List[Dict[str, Any]] = []
        anomalies: List[Dict[str, Any]] = []
        fee_tier_intelligence: Dict[str, Any] = {}

        for pair in pairs:
            try:
                state = await market_data_service.get_current_market_state(
                    pair,
                    enforce_freshness=False,
                    max_staleness_seconds=self.max_staleness_seconds,
                )
                # Strict completeness & staleness check
                market_data_service.validate_market_data(state, max_age_seconds=self.max_staleness_seconds)
            except StaleMarketDataError as ex:
                logger.warning(f"Market data staleness detected for {pair}: {ex}")
                anomalies.append({
                    "pair": pair,
                    "type": "STALE_DATA_REJECTION",
                    "severity": "CRITICAL",
                    "message": str(ex),
                })
                continue
            except IncompleteMarketDataError as ex:
                logger.warning(f"Incomplete market data for {pair}: {ex}")
                anomalies.append({
                    "pair": pair,
                    "type": "INCOMPLETE_DATA_REJECTION",
                    "severity": "CRITICAL",
                    "message": str(ex),
                })
                continue

            # Fetch multi-fee tier data for primary trading pair
            if pair == "WHSK/USDT":
                fee_tier_intelligence = await market_data_service.get_fee_tier_comparison(pair)

            # Detect volatility anomaly
            is_high_volatility = state["volatility"] > 0.05
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
                "fee_tiers": state.get("fee_tiers_supported", []),
                "historical_observations_count": state.get("historical_observations_count", 0),
                "data_quality": state.get("data_quality", "FRESH"),
                "age_seconds": state.get("age_seconds", 0.0),
                "last_updated": state["last_updated"],
            })

        has_stale_rejection = any(a["type"] == "STALE_DATA_REJECTION" for a in anomalies)
        status = "DEGRADED_STALE_DATA" if has_stale_rejection else "HEALTHY"

        return {
            "correlation_id": correlation_id,
            "status": status,
            "pairs_monitored": len(pairs),
            "market_reports": market_reports,
            "fee_tier_intelligence": fee_tier_intelligence,
            "anomalies": anomalies,
            "regime": "HIGH_VOLATILITY" if any(a["type"] == "HIGH_VOLATILITY" for a in anomalies) else "STABLE_ACCUMULATION",
        }

