import logging
from typing import Dict, Any, Optional
from backend.agents.base import BaseAgent
from backend.portfolio.tracker import PortfolioTracker

logger = logging.getLogger("omnivault.agent.portfolio")

class PortfolioAgent(BaseAgent):
    """
    Agent 7: Portfolio Agent.
    Continuously monitors portfolio health, active positions, realized/unrealized P&L,
    stop-loss and take-profit distances, holding durations, and asset exposure limits.
    """

    def __init__(self, portfolio_tracker: Optional[PortfolioTracker] = None):
        super().__init__(
            agent_id="agent_portfolio",
            name="Portfolio Management Agent",
            description="Tracks balances, open positions, realized/unrealized P&L, win rates, and exposure limits across HashKey Chain.",
            execution_interval_seconds=10,
            supported_assets=["WHSK", "USDT", "USDC.e"],
            supported_strategies=["PORTFOLIO_ACCOUNTING", "EXPOSURE_MANAGEMENT", "POSITION_SURVEILLANCE"],
        )
        self.tracker = portfolio_tracker or PortfolioTracker()

    async def execute_cycle(self, correlation_id: str) -> Dict[str, Any]:
        summary = self.tracker.get_portfolio_summary()
        return {
            "correlation_id": correlation_id,
            "status": "HEALTHY",
            "total_value_usd": summary["total_value_usd"],
            "cash_balance_usd": summary["cash_balance_usd"],
            "invested_value_usd": summary["invested_value_usd"],
            "realized_pnl_usd": summary["realized_pnl_usd"],
            "unrealized_pnl_usd": summary["unrealized_pnl_usd"],
            "total_pnl_usd": summary["total_pnl_usd"],
            "win_rate_pct": summary["win_rate_pct"],
            "open_positions_count": summary["open_positions_count"],
            "total_exposure_pct": summary.get("total_exposure_pct", 0.0),
            "open_positions": summary["open_positions"],
        }
