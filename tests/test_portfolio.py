import pytest
from backend.portfolio.tracker import PortfolioTracker

def test_portfolio_initial_state():
    tracker = PortfolioTracker(initial_cash_usd=1000.0)
    summary = tracker.get_portfolio_summary()
    assert summary["cash_balance_usd"] == 1000.0
    assert summary["total_value_usd"] == 1000.0
    assert summary["invested_value_usd"] == 0.0
    assert summary["open_positions_count"] == 0
    assert summary["realized_pnl_usd"] == 0.0

def test_portfolio_add_and_update_position():
    tracker = PortfolioTracker(initial_cash_usd=1000.0)
    # Buy 100 WHSK @ $0.80 = $80 cost
    pos = tracker.add_position(
        position_id="pos_1",
        pair="WHSK/USDT",
        side="LONG",
        entry_price=0.80,
        quantity=100.0,
        cost_usd=80.0,
        stop_loss=0.76, # -5%
        take_profit=0.88, # +10%
    )
    assert tracker.cash_balance_usd == 920.0
    assert pos.cost_basis_usd == 80.0
    assert pos.unrealized_pnl_usd == 0.0

    # Price rises to $0.85 -> +$5 gain
    tracker.update_market_prices({"WHSK/USDT": 0.85})
    summary = tracker.get_portfolio_summary()
    assert summary["invested_value_usd"] == 85.0
    assert summary["unrealized_pnl_usd"] == 5.0
    assert summary["total_value_usd"] == 920.0 + 85.0

def test_portfolio_stop_loss_trigger():
    tracker = PortfolioTracker(initial_cash_usd=1000.0)
    tracker.add_position(
        position_id="pos_sl",
        pair="WHSK/USDT",
        side="LONG",
        entry_price=0.80,
        quantity=100.0,
        cost_usd=80.0,
        stop_loss=0.75,
        take_profit=0.90,
    )

    # Price drops to $0.74 <= stop_loss $0.75
    events = tracker.update_market_prices({"WHSK/USDT": 0.74})
    assert len(events) == 1
    assert events[0]["event_type"] == "STOP_LOSS"
    assert events[0]["trigger_price"] == 0.74
    # Loss: (0.74 - 0.80) * 100 = -$6.00
    assert events[0]["realized_pnl"] == -6.00

    summary = tracker.get_portfolio_summary()
    assert summary["open_positions_count"] == 0
    assert summary["realized_pnl_usd"] == -6.00
    assert summary["loss_count"] == 1
    assert summary["win_count"] == 0

def test_portfolio_take_profit_trigger():
    tracker = PortfolioTracker(initial_cash_usd=1000.0)
    tracker.add_position(
        position_id="pos_tp",
        pair="WHSK/USDT",
        side="LONG",
        entry_price=0.80,
        quantity=100.0,
        cost_usd=80.0,
        stop_loss=0.75,
        take_profit=0.90,
    )

    # Price rises to $0.92 >= take_profit $0.90
    events = tracker.update_market_prices({"WHSK/USDT": 0.92})
    assert len(events) == 1
    assert events[0]["event_type"] == "TAKE_PROFIT"
    # Gain: (0.92 - 0.80) * 100 = +$12.00
    assert events[0]["realized_pnl"] == 12.00

    summary = tracker.get_portfolio_summary()
    assert summary["open_positions_count"] == 0
    assert summary["realized_pnl_usd"] == 12.00
    assert summary["win_count"] == 1
    assert summary["win_rate_pct"] == 100.0
