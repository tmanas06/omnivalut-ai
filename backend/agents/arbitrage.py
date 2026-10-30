import uuid
from typing import Dict, Any, List
from backend.agents.base import BaseAgent
from backend.adapters.hskswap.adapter import HSKSwapAdapter
from backend.adapters.hskswap.constants import (
    FEE_LOW,
    FEE_MEDIUM,
    FEE_HIGH,
    TESTNET_WHSK,
    TESTNET_USDT,
    POOLS_TESTNET,
)

class ArbitrageAgent(BaseAgent):
    """
    Agent 2: Arbitrage Agent.
    Evaluates price dislocations across fee tiers (0.05%, 0.30%, 1.00%) on HSKSwap.
    Strictly accounts for pool swap fees, gas estimates, and slippage before declaring an opportunity executable.
    """

    def __init__(self, adapter: HSKSwapAdapter = None):
        super().__init__(
            agent_id="agent_arbitrage",
            name="Arbitrage Agent",
            description="Scans HSKSwap multi-fee-tier pools for intra-DEX route arbitrage and price dislocations on HashKey Chain.",
            execution_interval_seconds=15,
            supported_assets=["WHSK", "USDT"],
            supported_strategies=["INTRA_DEX_ARBITRAGE", "FEE_TIER_DISLOCATION"],
        )
        self.adapter = adapter or HSKSwapAdapter()

    async def execute_cycle(self, correlation_id: str) -> Dict[str, Any]:
        opportunities: List[Dict[str, Any]] = []
        evaluations: List[Dict[str, Any]] = []

        # Analyze WHSK/USDT across the 0.05% (500) and 0.30% (3000) pools
        test_amount = 50.0 # Standard trade probe: 50 WHSK
        gas_price_gwei = 0.5
        gas_units = 150000
        # Gas cost in USD: 150000 * 0.5 Gwei = 0.000075 HSK * $0.85 = ~$0.000064
        est_gas_usd = (gas_units * (gas_price_gwei * 1e-9)) * 0.85

        # Fetch quotes across both pools
        quote_low_fee = await self.adapter.get_quote(
            token_in=TESTNET_WHSK,
            token_out=TESTNET_USDT,
            amount_in=test_amount,
            fee=FEE_LOW,
        )
        quote_med_fee = await self.adapter.get_quote(
            token_in=TESTNET_WHSK,
            token_out=TESTNET_USDT,
            amount_in=test_amount,
            fee=FEE_MEDIUM,
        )

        price_low = quote_low_fee["execution_price"]
        price_med = quote_med_fee["execution_price"]
        price_diff = abs(price_low - price_med)
        pct_diff = (price_diff / min(price_low, price_med)) * 100 if min(price_low, price_med) > 0 else 0

        # Calculate executable net profit:
        # Buy on cheaper pool, sell on richer pool
        if price_low > price_med:
            cheaper_fee, richer_fee = FEE_MEDIUM, FEE_LOW
            gross_profit = (price_low - price_med) * test_amount
        else:
            cheaper_fee, richer_fee = FEE_LOW, FEE_MEDIUM
            gross_profit = (price_med - price_low) * test_amount

        total_fees = quote_low_fee["fee_amount"] + quote_med_fee["fee_amount"]
        slippage_cost = test_amount * price_low * 0.005 # 0.5% conservative slippage
        net_profit_usd = gross_profit - total_fees - est_gas_usd - slippage_cost

        is_economically_viable = (net_profit_usd > 0.25) # Requires at least $0.25 net profit

        eval_summary = {
            "pair": "WHSK/USDT",
            "venue_source": f"HSKSwap Pool (Fee: {cheaper_fee})",
            "venue_target": f"HSKSwap Pool (Fee: {richer_fee})",
            "price_source": min(price_low, price_med),
            "price_target": max(price_low, price_med),
            "spread_pct": round(pct_diff, 4),
            "gross_profit_usd": round(gross_profit, 4),
            "total_fees_usd": round(total_fees, 4),
            "estimated_gas_usd": round(est_gas_usd, 6),
            "slippage_provision_usd": round(slippage_cost, 4),
            "net_profit_usd": round(net_profit_usd, 4),
            "is_viable": is_economically_viable,
            "cross_venue_status": "Cross-DEX Arbitrage Unavailable (HSKSwap is primary HashKey DEX)",
        }
        evaluations.append(eval_summary)

        if is_economically_viable:
            opportunities.append({
                "id": str(uuid.uuid4()),
                "correlation_id": correlation_id,
                "agent_id": self.agent_id,
                "strategy": "INTRA_DEX_ARBITRAGE",
                "pair": "WHSK/USDT",
                "direction": "BUY",
                "source_venue": eval_summary["venue_source"],
                "target_venue": eval_summary["venue_target"],
                "quoted_price": eval_summary["price_source"],
                "estimated_price_impact_pct": quote_low_fee["price_impact_pct"],
                "estimated_gas_cost_usd": est_gas_usd,
                "expected_net_profit_usd": net_profit_usd,
                "trade_size_amount": test_amount,
                "status": "OPPORTUNITY_DETECTED",
            })

        return {
            "correlation_id": correlation_id,
            "opportunities": opportunities,
            "evaluations": evaluations,
            "pools_scanned": [POOLS_TESTNET["WHSK/USDT:500"], POOLS_TESTNET["WHSK/USDT:3000"]],
            "cross_venue_arbitrage_available": False,
        }
