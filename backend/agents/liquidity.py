import logging
from typing import Dict, Any, List
from backend.agents.base import BaseAgent
from backend.adapters.hskswap.adapter import HSKSwapAdapter
from backend.adapters.hskswap.constants import POOLS_TESTNET, FEE_MEDIUM, TESTNET_WHSK, TESTNET_USDT

class LiquidityAgent(BaseAgent):
    """
    Agent 4: Liquidity Agent.
    Evaluates constant-product & concentrated pool depth, computes market impact curves,
    and enforces maximum allowable price impact boundaries.
    """

    def __init__(self, adapter: HSKSwapAdapter = None, max_impact_pct: float = 2.0):
        super().__init__(
            agent_id="agent_liquidity",
            name="Liquidity & Market Depth Agent",
            description="Analyzes HSKSwap pool reserves, slippage curves, and rejects trades exceeding market impact thresholds.",
            execution_interval_seconds=15,
            supported_assets=["WHSK", "USDT", "USDC.e"],
            supported_strategies=["LIQUIDITY_DEPTH_AUDIT", "SLIPPAGE_PROTECTION"],
        )
        self.adapter = adapter or HSKSwapAdapter()
        self.max_impact_pct = max_impact_pct

    async def execute_cycle(self, correlation_id: str) -> Dict[str, Any]:
        pool_address = POOLS_TESTNET["WHSK/USDT:3000"]
        liq_info = await self.adapter.get_pool_liquidity(pool_address)
        raw_liquidity = liq_info.get("liquidity", 0)

        # Depth curve evaluation for different standard order sizes
        depth_curves = []
        for test_size in [10.0, 50.0, 100.0, 500.0, 1000.0]:
            quote = await self.adapter.get_quote(
                token_in=TESTNET_WHSK,
                token_out=TESTNET_USDT,
                amount_in=test_size,
                fee=FEE_MEDIUM,
            )
            impact = quote["price_impact_pct"]
            is_acceptable = impact <= self.max_impact_pct

            depth_curves.append({
                "size_tokens": test_size,
                "size_usd": round(test_size * 0.8542, 2),
                "estimated_price_impact_pct": impact,
                "is_acceptable": is_acceptable,
            })

        return {
            "correlation_id": correlation_id,
            "pool_address": pool_address,
            "raw_liquidity": raw_liquidity,
            "active": raw_liquidity > 0,
            "fee_tier": FEE_MEDIUM,
            "max_configured_impact_pct": self.max_impact_pct,
            "depth_curves": depth_curves,
            "health_status": "OPTIMAL_LIQUIDITY" if raw_liquidity > 0 else "LOW_LIQUIDITY_WARNING",
        }

    async def evaluate_trade_impact(self, token_in: str, token_out: str, amount_in: float, fee: int = FEE_MEDIUM) -> Dict[str, Any]:
        """
        Public validator method called by the Central Orchestrator / Risk Engine.
        """
        quote = await self.adapter.get_quote(token_in, token_out, amount_in, fee)
        impact = quote["price_impact_pct"]
        is_allowed = impact <= self.max_impact_pct

        return {
            "is_allowed": is_allowed,
            "price_impact_pct": impact,
            "max_allowed_pct": self.max_impact_pct,
            "rejection_reason": f"Price impact of {impact:.2f}% exceeds maximum limit of {self.max_impact_pct:.2f}%" if not is_allowed else None,
            "quote": quote,
        }
