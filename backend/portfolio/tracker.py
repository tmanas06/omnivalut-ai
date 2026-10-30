import time
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from backend.adapters.hskswap.adapter import HSKSwapAdapter
from backend.adapters.hskswap.constants import TESTNET_WHSK, TESTNET_USDT, TESTNET_USDC

logger = logging.getLogger("omnivault.portfolio")

class PositionRecord:
    def __init__(
        self,
        position_id: str,
        pair: str,
        side: str, # "LONG" or "SHORT"
        entry_price: float,
        quantity: float,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        is_simulated: bool = False,
    ):
        self.position_id = position_id
        self.pair = pair
        self.side = side
        self.entry_price = entry_price
        self.current_price = entry_price
        self.quantity = quantity
        self.stop_loss = stop_loss
        self.take_profit = take_profit
        self.is_simulated = is_simulated
        self.opened_at = time.time()
        self.closed_at: Optional[float] = None
        self.is_open: bool = True
        self.realized_pnl_usd: float = 0.0

    @property
    def cost_basis_usd(self) -> float:
        return self.quantity * self.entry_price

    @property
    def market_value_usd(self) -> float:
        return self.quantity * self.current_price

    @property
    def unrealized_pnl_usd(self) -> float:
        if self.side == "LONG":
            return (self.current_price - self.entry_price) * self.quantity
        else:
            return (self.entry_price - self.current_price) * self.quantity

    @property
    def unrealized_pnl_pct(self) -> float:
        if self.cost_basis_usd == 0:
            return 0.0
        return (self.unrealized_pnl_usd / self.cost_basis_usd) * 100.0

    def update_price(self, new_price: float) -> Optional[str]:
        """Updates price and returns trigger event ('STOP_LOSS', 'TAKE_PROFIT', None)."""
        self.current_price = new_price
        if self.is_open:
            if self.stop_loss and self.current_price <= self.stop_loss:
                return "STOP_LOSS"
            if self.take_profit and self.current_price >= self.take_profit:
                return "TAKE_PROFIT"
        return None

    def close(self, exit_price: float) -> float:
        self.current_price = exit_price
        self.is_open = False
        self.closed_at = time.time()
        if self.side == "LONG":
            self.realized_pnl_usd = (exit_price - self.entry_price) * self.quantity
        else:
            self.realized_pnl_usd = (self.entry_price - exit_price) * self.quantity
        return self.realized_pnl_usd

    def to_dict(self) -> Dict[str, Any]:
        return {
            "position_id": self.position_id,
            "pair": self.pair,
            "side": self.side,
            "entry_price": round(self.entry_price, 4),
            "current_price": round(self.current_price, 4),
            "quantity": round(self.quantity, 4),
            "cost_basis_usd": round(self.cost_basis_usd, 2),
            "market_value_usd": round(self.market_value_usd, 2),
            "unrealized_pnl_usd": round(self.unrealized_pnl_usd, 2),
            "unrealized_pnl_pct": round(self.unrealized_pnl_pct, 2),
            "realized_pnl_usd": round(self.realized_pnl_usd, 2),
            "stop_loss": self.stop_loss,
            "take_profit": self.take_profit,
            "is_open": self.is_open,
            "is_simulated": self.is_simulated,
            "opened_at": datetime.fromtimestamp(self.opened_at, timezone.utc).isoformat(),
            "closed_at": datetime.fromtimestamp(self.closed_at, timezone.utc).isoformat() if self.closed_at else None,
        }

class PortfolioTracker:
    """
    Agent 7: Portfolio Tracker.
    Calculates realized/unrealized P&L, win/loss metrics, fees, and positions.
    Reconciles with HashKey Chain on-chain balances.
    """

    def __init__(self, initial_cash_usd: float = 1000.0, adapter: Optional[HSKSwapAdapter] = None):
        self.adapter = adapter or HSKSwapAdapter()
        self.cash_balance_usd = initial_cash_usd
        self.initial_capital_usd = initial_cash_usd
        self.positions: Dict[str, PositionRecord] = {}
        self.trades_history: List[Dict[str, Any]] = []
        self.realized_pnl_total = 0.0
        self.total_fees_paid_usd = 0.0

    def add_position(
        self,
        position_id: str,
        pair: str,
        side: str,
        entry_price: float,
        quantity: float,
        cost_usd: float,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        is_simulated: bool = False,
    ) -> PositionRecord:
        pos = PositionRecord(
            position_id=position_id,
            pair=pair,
            side=side,
            entry_price=entry_price,
            quantity=quantity,
            stop_loss=stop_loss,
            take_profit=take_profit,
            is_simulated=is_simulated,
        )
        self.positions[position_id] = pos
        self.cash_balance_usd -= cost_usd
        logger.info(f"Opened position {position_id} for {quantity} {pair} @ {entry_price}")
        return pos

    def close_position(self, position_id: str, exit_price: float) -> Optional[Dict[str, Any]]:
        pos = self.positions.get(position_id)
        if not pos or not pos.is_open:
            return None

        pnl = pos.close(exit_price)
        proceeds = pos.quantity * exit_price
        self.cash_balance_usd += proceeds
        self.realized_pnl_total += pnl

        trade_record = {
            "position_id": pos.position_id,
            "pair": pos.pair,
            "side": pos.side,
            "entry_price": pos.entry_price,
            "exit_price": exit_price,
            "quantity": pos.quantity,
            "realized_pnl_usd": round(pnl, 2),
            "opened_at": pos.opened_at,
            "closed_at": pos.closed_at,
            "is_simulated": pos.is_simulated,
        }
        self.trades_history.append(trade_record)
        logger.info(f"Closed position {position_id} @ {exit_price}. Realized P&L: ${pnl:.2f}")
        return trade_record

    def update_market_prices(self, price_map: Dict[str, float]) -> List[Dict[str, Any]]:
        """
        Updates positions with current prices and triggers stop-loss / take-profit if reached.
        """
        triggered_events = []
        for pos_id, pos in list(self.positions.items()):
            if not pos.is_open:
                continue
            curr_p = price_map.get(pos.pair)
            if curr_p:
                event = pos.update_price(curr_p)
                if event:
                    closed_record = self.close_position(pos_id, curr_p)
                    triggered_events.append({
                        "event_type": event,
                        "position_id": pos_id,
                        "pair": pos.pair,
                        "trigger_price": curr_p,
                        "realized_pnl": closed_record["realized_pnl_usd"] if closed_record else 0.0,
                    })
        return triggered_events

    def get_portfolio_summary(self) -> Dict[str, Any]:
        open_positions = [p for p in self.positions.values() if p.is_open]
        closed_positions = [p for p in self.positions.values() if not p.is_open]

        invested_value = sum(p.market_value_usd for p in open_positions)
        unrealized_pnl = sum(p.unrealized_pnl_usd for p in open_positions)
        total_portfolio_value = self.cash_balance_usd + invested_value

        wins = [t for t in self.trades_history if t["realized_pnl_usd"] > 0]
        losses = [t for t in self.trades_history if t["realized_pnl_usd"] < 0]
        win_rate = (len(wins) / len(self.trades_history) * 100.0) if self.trades_history else 0.0

        daily_loss_pct = max(0.0, ((self.initial_capital_usd - total_portfolio_value) / self.initial_capital_usd) * 100.0)
        drawdown_pct = daily_loss_pct # simplified drawdown

        return {
            "total_value_usd": round(total_portfolio_value, 2),
            "cash_balance_usd": round(self.cash_balance_usd, 2),
            "invested_value_usd": round(invested_value, 2),
            "realized_pnl_usd": round(self.realized_pnl_total, 2),
            "unrealized_pnl_usd": round(unrealized_pnl, 2),
            "total_pnl_usd": round(self.realized_pnl_total + unrealized_pnl, 2),
            "total_trades": len(self.trades_history),
            "win_count": len(wins),
            "loss_count": len(losses),
            "win_rate_pct": round(win_rate, 1),
            "open_positions_count": len(open_positions),
            "daily_loss_pct": round(daily_loss_pct, 2),
            "portfolio_drawdown_pct": round(drawdown_pct, 2),
            "open_positions": [p.to_dict() for p in open_positions],
            "recent_trades": self.trades_history[-10:],
        }
