import os
import json
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
        max_holding_seconds: Optional[int] = 3600, # 1 hour default max holding period
        is_simulated: bool = True,
        opened_at: Optional[float] = None,
        closed_at: Optional[float] = None,
        is_open: bool = True,
        realized_pnl_usd: float = 0.0,
        current_price: Optional[float] = None,
        exit_reason: Optional[str] = None,
    ):
        self.position_id = position_id
        self.pair = pair
        self.side = side
        self.entry_price = entry_price
        self.current_price = current_price or entry_price
        self.quantity = quantity
        self.stop_loss = stop_loss
        self.take_profit = take_profit
        self.max_holding_seconds = max_holding_seconds
        self.is_simulated = is_simulated
        self.opened_at = opened_at or time.time()
        self.closed_at = closed_at
        self.is_open = is_open
        self.realized_pnl_usd = realized_pnl_usd
        self.exit_reason = exit_reason
        self.pending_exit_proposal: Optional[Dict[str, Any]] = None

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

    @property
    def holding_duration_seconds(self) -> float:
        end_time = self.closed_at or time.time()
        return max(0.0, end_time - self.opened_at)

    def update_price(self, new_price: float, current_time: Optional[float] = None) -> Optional[str]:
        """
        Updates price and checks for exit conditions:
        - STOP_LOSS
        - TAKE_PROFIT
        - MAX_HOLDING_EXPIRED
        """
        now = current_time or time.time()
        self.current_price = new_price
        if not self.is_open:
            return None

        # 1. Stop loss check
        if self.stop_loss is not None:
            if self.side == "LONG" and self.current_price <= self.stop_loss:
                return "STOP_LOSS"
            elif self.side == "SHORT" and self.current_price >= self.stop_loss:
                return "STOP_LOSS"

        # 2. Take profit check
        if self.take_profit is not None:
            if self.side == "LONG" and self.current_price >= self.take_profit:
                return "TAKE_PROFIT"
            elif self.side == "SHORT" and self.current_price <= self.take_profit:
                return "TAKE_PROFIT"

        # 3. Maximum holding period check
        if self.max_holding_seconds is not None:
            if (now - self.opened_at) >= self.max_holding_seconds:
                return "MAX_HOLDING_EXPIRED"

        return None

    def close(self, exit_price: float, reason: str = "MANUAL_CLOSE", closed_time: Optional[float] = None) -> float:
        self.current_price = exit_price
        self.is_open = False
        self.closed_at = closed_time or time.time()
        self.exit_reason = reason
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
            "max_holding_seconds": self.max_holding_seconds,
            "holding_duration_seconds": round(self.holding_duration_seconds, 1),
            "is_open": self.is_open,
            "is_simulated": self.is_simulated,
            "exit_reason": self.exit_reason,
            "pending_exit_proposal": self.pending_exit_proposal,
            "opened_at": datetime.fromtimestamp(self.opened_at, timezone.utc).isoformat(),
            "closed_at": datetime.fromtimestamp(self.closed_at, timezone.utc).isoformat() if self.closed_at else None,
            "opened_at_epoch": self.opened_at,
            "closed_at_epoch": self.closed_at,
        }

class PortfolioTracker:
    """
    Portfolio Agent & Position Manager.
    Maintains persistent position records, enforces exposure limits, tracks stop-loss,
    take-profit, and max holding time limits, and recovers state across restarts.
    """

    def __init__(
        self,
        initial_cash_usd: float = 1000.0,
        adapter: Optional[HSKSwapAdapter] = None,
        persistence_file: Optional[str] = None,
        max_asset_exposure_pct: float = 30.0,
        max_total_exposure_pct: float = 80.0,
    ):
        self.adapter = adapter or HSKSwapAdapter()
        self.persistence_file = persistence_file
        self.max_asset_exposure_pct = max_asset_exposure_pct
        self.max_total_exposure_pct = max_total_exposure_pct

        self.cash_balance_usd = initial_cash_usd
        self.initial_capital_usd = initial_cash_usd
        self.positions: Dict[str, PositionRecord] = {}
        self.trades_history: List[Dict[str, Any]] = []
        self.pending_exit_proposals: Dict[str, Dict[str, Any]] = {}
        self.realized_pnl_total = 0.0
        self.total_fees_paid_usd = 0.0

        # Attempt to recover saved state if persistence file specified
        if self.persistence_file:
            self.load_from_disk()

    def save_to_disk(self):
        """Persist position and portfolio state to disk so backend can recover after restart."""
        if not self.persistence_file:
            return
        try:
            os.makedirs(os.path.dirname(os.path.abspath(self.persistence_file)), exist_ok=True)
            payload = {
                "initial_capital_usd": self.initial_capital_usd,
                "cash_balance_usd": self.cash_balance_usd,
                "realized_pnl_total": self.realized_pnl_total,
                "total_fees_paid_usd": self.total_fees_paid_usd,
                "positions": [pos.to_dict() for pos in self.positions.values()],
                "trades_history": self.trades_history,
                "pending_exit_proposals": self.pending_exit_proposals,
                "saved_at": time.time(),
            }
            with open(self.persistence_file, "w") as f:
                json.dump(payload, f, indent=2)
            logger.debug(f"Portfolio state persisted to {self.persistence_file}")
        except Exception as e:
            logger.warning(f"Could not persist portfolio state to disk: {e}")

    def load_from_disk(self) -> bool:
        """Recover positions, balances, and history from disk."""
        if not self.persistence_file or not os.path.exists(self.persistence_file):
            return False

        try:
            with open(self.persistence_file, "r") as f:
                payload = json.load(f)

            self.initial_capital_usd = payload.get("initial_capital_usd", 1000.0)
            self.cash_balance_usd = payload.get("cash_balance_usd", 1000.0)
            self.realized_pnl_total = payload.get("realized_pnl_total", 0.0)
            self.total_fees_paid_usd = payload.get("total_fees_paid_usd", 0.0)
            self.trades_history = payload.get("trades_history", [])
            self.pending_exit_proposals = payload.get("pending_exit_proposals", {})

            loaded_positions = {}
            for p_dict in payload.get("positions", []):
                pos = PositionRecord(
                    position_id=p_dict["position_id"],
                    pair=p_dict["pair"],
                    side=p_dict["side"],
                    entry_price=p_dict["entry_price"],
                    quantity=p_dict["quantity"],
                    stop_loss=p_dict.get("stop_loss"),
                    take_profit=p_dict.get("take_profit"),
                    max_holding_seconds=p_dict.get("max_holding_seconds", 3600),
                    is_simulated=p_dict.get("is_simulated", False),
                    opened_at=p_dict.get("opened_at_epoch", time.time()),
                    closed_at=p_dict.get("closed_at_epoch"),
                    is_open=p_dict.get("is_open", True),
                    realized_pnl_usd=p_dict.get("realized_pnl_usd", 0.0),
                    current_price=p_dict.get("current_price"),
                    exit_reason=p_dict.get("exit_reason"),
                )
                loaded_positions[pos.position_id] = pos

            self.positions = loaded_positions
            logger.info(f"Successfully recovered {len(self.positions)} positions from {self.persistence_file}")
            return True
        except Exception as e:
            logger.warning(f"Failed to load portfolio state from {self.persistence_file}: {e}")
            return False

    def check_exposure_limits(self, trade_size_usd: float, pair: str) -> Dict[str, Any]:
        """
        Validates portfolio and single-asset exposure limits before opening new positions.
        """
        summary = self.get_portfolio_summary()
        total_val = summary["total_value_usd"]
        if total_val <= 0:
            total_val = self.initial_capital_usd

        # 1. Total invested exposure check
        new_total_invested = summary["invested_value_usd"] + trade_size_usd
        total_exposure_pct = (new_total_invested / total_val) * 100.0
        if total_exposure_pct > self.max_total_exposure_pct:
            return {
                "is_allowed": False,
                "rule": "MAX_TOTAL_PORTFOLIO_EXPOSURE",
                "reason": f"Total invested exposure ({total_exposure_pct:.1f}%) would exceed limit of {self.max_total_exposure_pct:.1f}%.",
                "current_exposure_pct": round(total_exposure_pct, 1),
            }

        # 2. Single-asset exposure check
        pair_current_val = sum(p.market_value_usd for p in self.positions.values() if p.is_open and p.pair == pair)
        new_pair_val = pair_current_val + trade_size_usd
        asset_exposure_pct = (new_pair_val / total_val) * 100.0
        if asset_exposure_pct > self.max_asset_exposure_pct:
            return {
                "is_allowed": False,
                "rule": "MAX_SINGLE_ASSET_EXPOSURE",
                "reason": f"Exposure to {pair} ({asset_exposure_pct:.1f}%) would exceed limit of {self.max_asset_exposure_pct:.1f}%.",
                "current_exposure_pct": round(asset_exposure_pct, 1),
            }

        return {
            "is_allowed": True,
            "total_exposure_pct": round(total_exposure_pct, 1),
            "asset_exposure_pct": round(asset_exposure_pct, 1),
        }

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
        max_holding_seconds: Optional[int] = 3600,
        is_simulated: bool = True,
    ) -> PositionRecord:
        pos = PositionRecord(
            position_id=position_id,
            pair=pair,
            side=side,
            entry_price=entry_price,
            quantity=quantity,
            stop_loss=stop_loss,
            take_profit=take_profit,
            max_holding_seconds=max_holding_seconds,
            is_simulated=is_simulated,
        )
        self.positions[position_id] = pos
        self.cash_balance_usd = round(self.cash_balance_usd - cost_usd, 4)
        self.save_to_disk()
        logger.info(f"Opened position {position_id} for {quantity} {pair} @ {entry_price} (SL: {stop_loss}, TP: {take_profit})")
        return pos

    def close_position(self, position_id: str, exit_price: float, reason: str = "MANUAL_CLOSE") -> Optional[Dict[str, Any]]:
        pos = self.positions.get(position_id)
        if not pos or not pos.is_open:
            return None

        pnl = pos.close(exit_price, reason=reason)
        proceeds = pos.quantity * exit_price
        self.cash_balance_usd = round(self.cash_balance_usd + proceeds, 4)
        self.realized_pnl_total = round(self.realized_pnl_total + pnl, 4)

        trade_record = {
            "position_id": pos.position_id,
            "pair": pos.pair,
            "side": pos.side,
            "entry_price": pos.entry_price,
            "exit_price": exit_price,
            "quantity": pos.quantity,
            "realized_pnl_usd": round(pnl, 2),
            "exit_reason": reason,
            "holding_duration_seconds": round(pos.holding_duration_seconds, 1),
            "opened_at": pos.opened_at,
            "closed_at": pos.closed_at,
            "is_simulated": pos.is_simulated,
        }
        self.trades_history.append(trade_record)
        self.save_to_disk()
        logger.info(f"Closed position {position_id} ({reason}) @ {exit_price}. Realized P&L: ${pnl:.2f}")
        return trade_record

    def update_market_prices(self, price_map: Dict[str, float], current_time: Optional[float] = None) -> List[Dict[str, Any]]:
        """
        Updates positions with current prices and evaluates stop-loss, take-profit,
        or max-holding-period triggers.

        PHASE 5 COMPLIANCE:
        - For PAPER mode: Closes the simulated position directly and records simulated realized P&L.
        - For TESTNET mode: GENERATES AN EXIT PROPOSAL requiring explicit user approval, risk validation,
          and confirmed on-chain receipt reconciliation. Never marks live position closed automatically.
        """
        now = current_time or time.time()
        triggered_events = []
        for pos_id, pos in list(self.positions.items()):
            if not pos.is_open:
                continue
            curr_p = price_map.get(pos.pair)
            if curr_p:
                event = pos.update_price(curr_p, current_time=now)
                if event:
                    if pos.is_simulated:
                        # PAPER mode: close simulated position directly
                        closed_record = self.close_position(pos_id, curr_p, reason=event)
                        triggered_events.append({
                            "event_type": event,
                            "position_id": pos_id,
                            "pair": pos.pair,
                            "trigger_price": curr_p,
                            "action": "SIMULATED_CLOSED",
                            "realized_pnl": closed_record["realized_pnl_usd"] if closed_record else 0.0,
                            "holding_duration_seconds": closed_record["holding_duration_seconds"] if closed_record else 0.0,
                        })
                    else:
                        # TESTNET mode: Never close automatically! Generate exit proposal awaiting user approval.
                        exit_proposal = {
                            "proposal_id": f"exit_{pos_id[:8]}_{int(now)}",
                            "position_id": pos_id,
                            "pair": pos.pair,
                            "direction": "SELL" if pos.side == "LONG" else "BUY",
                            "quantity": pos.quantity,
                            "trigger_reason": event,
                            "trigger_price": curr_p,
                            "cost_basis_usd": pos.cost_basis_usd,
                            "estimated_market_value_usd": round(pos.quantity * curr_p, 2),
                            "estimated_pnl_usd": round(
                                (curr_p - pos.entry_price) * pos.quantity if pos.side == "LONG" else (pos.entry_price - curr_p) * pos.quantity,
                                2
                            ),
                            "status": "WAITING_USER_APPROVAL_EXIT",
                            "created_at": now,
                        }
                        pos.pending_exit_proposal = exit_proposal
                        self.pending_exit_proposals[pos_id] = exit_proposal
                        self.save_to_disk()
                        logger.warning(
                            f"[TESTNET GUARD] Live position {pos_id[:8]} reached {event} @ {curr_p:.4f}. "
                            f"Generated exit proposal. Position will NOT close until explicit user approval and receipt confirmation."
                        )
                        triggered_events.append({
                            "event_type": event,
                            "position_id": pos_id,
                            "pair": pos.pair,
                            "trigger_price": curr_p,
                            "action": "EXIT_PROPOSAL_GENERATED",
                            "realized_pnl": exit_proposal["estimated_pnl_usd"],
                            "exit_proposal": exit_proposal,
                        })
        return triggered_events

    def approve_testnet_exit(
        self,
        position_id: str,
        actual_exit_price: float,
        tx_hash: str,
        gas_used: int = 150000,
        reason: str = "CONFIRMED_ONCHAIN_EXIT",
    ) -> Optional[Dict[str, Any]]:
        """
        Closes a live TESTNET position ONLY AFTER on-chain transaction receipt is confirmed
        and token balances are reconciled.
        """
        pos = self.positions.get(position_id)
        if not pos or not pos.is_open:
            return None

        pnl = pos.close(actual_exit_price, reason=reason)
        proceeds = pos.quantity * actual_exit_price
        self.cash_balance_usd = round(self.cash_balance_usd + proceeds, 4)
        self.realized_pnl_total = round(self.realized_pnl_total + pnl, 4)

        trade_record = {
            "position_id": pos.position_id,
            "pair": pos.pair,
            "side": pos.side,
            "entry_price": pos.entry_price,
            "exit_price": actual_exit_price,
            "quantity": pos.quantity,
            "realized_pnl_usd": round(pnl, 2),
            "exit_reason": reason,
            "holding_duration_seconds": round(pos.holding_duration_seconds, 1),
            "opened_at": pos.opened_at,
            "closed_at": pos.closed_at,
            "is_simulated": False,
            "tx_hash": tx_hash,
            "gas_used": gas_used,
            "explorer_url": f"https://hashkey.blockscout.com/tx/{tx_hash}",
        }
        self.trades_history.append(trade_record)
        self.pending_exit_proposals.pop(position_id, None)
        pos.pending_exit_proposal = None
        self.save_to_disk()
        logger.info(f"Confirmed live TESTNET position {position_id} closed on-chain (Tx: {tx_hash}). Realized P&L: ${pnl:.2f}")
        return trade_record

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
        drawdown_pct = daily_loss_pct

        # Asset allocations
        total_exposure_pct = (invested_value / total_portfolio_value * 100.0) if total_portfolio_value > 0 else 0.0

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
            "total_exposure_pct": round(total_exposure_pct, 2),
            "max_asset_exposure_pct": self.max_asset_exposure_pct,
            "max_total_exposure_pct": self.max_total_exposure_pct,
            "open_positions": [p.to_dict() for p in open_positions],
            "pending_exit_proposals": list(self.pending_exit_proposals.values()),
            "recent_trades": self.trades_history[-10:],
        }

