import logging
from typing import Dict, Any

logger = logging.getLogger("omnivault.allocator")

class CapitalAllocator:
    """
    Computes precise trade allocation and position sizing.
    Combines portfolio capital, signal confidence, and maximum allocation ceiling.
    """

    def __init__(self, default_allocation_pct: float = 5.0, max_allocation_pct: float = 10.0):
        self.default_allocation_pct = default_allocation_pct
        self.max_allocation_pct = max_allocation_pct

    def compute_allocation(
        self,
        opportunity: Dict[str, Any],
        portfolio_state: Dict[str, Any],
    ) -> Dict[str, Any]:
        available_cash = portfolio_state.get("cash_balance_usd", 1000.0)
        confidence = opportunity.get("signal_confidence", 65.0)

        # Dynamic scaling based on confidence: 50% -> 5% allocation, 90% -> 10% allocation
        scaled_pct = self.default_allocation_pct + ((confidence - 50.0) / 40.0) * (self.max_allocation_pct - self.default_allocation_pct)
        target_allocation_pct = max(2.0, min(self.max_allocation_pct, scaled_pct))

        target_usd = (available_cash * (target_allocation_pct / 100.0))
        # Ensure minimal trade size ($10) and cap at available cash
        allocated_usd = max(10.0, min(available_cash, target_usd))

        quoted_price = opportunity.get("quoted_price", 0.8542)
        quantity = allocated_usd / quoted_price if quoted_price > 0 else 0.0

        return {
            "allocated_usd": round(allocated_usd, 2),
            "allocated_pct": round(target_allocation_pct, 2),
            "token_quantity": round(quantity, 4),
            "quoted_price": quoted_price,
            "confidence_score": confidence,
            "sizing_model": "CONFIDENCE_WEIGHTED_KELLY_FRACTION",
        }
