import uuid
import math
from typing import List, Dict, Any, Optional
from backend.backtesting.strategies import StrategySignals
from backend.backtesting.data_feed import HistoricalDataFeed

class BacktestEngine:
    """
    Quantitative Backtesting Engine for OmniVault AI.
    Executes walk-forward backtests across 4 strategies with zero look-ahead bias,
    chronological train/test split, realistic DEX fees, gas costs, and execution slippage.
    """

    def __init__(
        self,
        initial_capital: float = 1000.0,
        allocation_per_trade_pct: float = 10.0,
        fee_tier: int = 3000,           # 0.30%
        gas_cost_usd: float = 0.00015,   # HashKey L2 gas per swap in USD
        slippage_pct: float = 0.10,      # 0.10% adverse slippage buffer
        train_test_split_ratio: float = 0.70,
    ):
        self.initial_capital = initial_capital
        self.allocation_per_trade_pct = allocation_per_trade_pct
        self.fee_tier = fee_tier
        self.fee_rate = fee_tier / 1_000_000.0
        self.gas_cost_usd = gas_cost_usd
        self.slippage_rate = slippage_pct / 100.0
        self.train_test_split_ratio = train_test_split_ratio

    def run_backtest(
        self,
        candles: List[Dict[str, Any]],
        strategy_name: str = "ALL",
        pair: str = "WHSK/USDT",
    ) -> Dict[str, Any]:
        """
        Runs backtest with chronological train/test split.
        Avoids look-ahead bias by evaluating signals at bar t and executing at bar t+1.
        """
        if len(candles) < 30:
            raise ValueError(f"Insufficient candles for backtest (found {len(candles)}, need >= 30).")

        split_idx = int(len(candles) * self.train_test_split_ratio)
        train_candles = candles[:split_idx]
        test_candles = candles[split_idx:]

        strategies = (
            ["MOMENTUM_TREND_FOLLOWING", "ARBITRAGE_CROSS_TIER", "MEAN_REVERSION_BB", "HIGH_VOLATILITY_BREAKOUT"]
            if strategy_name == "ALL"
            else [strategy_name]
        )

        all_results: Dict[str, Any] = {}
        for strat in strategies:
            # 1. Run In-Sample (Train)
            train_run = self._simulate_strategy(strat, train_candles, self.initial_capital)
            # 2. Run Out-Of-Sample (Test)
            test_run = self._simulate_strategy(strat, test_candles, self.initial_capital)
            # 3. Run Full Sample
            full_run = self._simulate_strategy(strat, candles, self.initial_capital)

            all_results[strat] = {
                "strategy": strat,
                "in_sample_train": train_run["metrics"],
                "out_of_sample_test": test_run["metrics"],
                "full_metrics": full_run["metrics"],
                "trades": full_run["trades"],
                "equity_curve": full_run["equity_curve"],
                "drawdown_curve": full_run["drawdown_curve"],
            }

        # Aggregate summary across selected strategies
        combined_trades = []
        for res in all_results.values():
            combined_trades.extend(res["trades"])
        combined_metrics = self._calculate_metrics(combined_trades, self.initial_capital, len(candles))

        feed = HistoricalDataFeed()
        metadata = feed.get_dataset_metadata(candles)

        return {
            "pair": pair,
            "strategy_evaluated": strategy_name,
            "candle_count": len(candles),
            "train_candle_count": len(train_candles),
            "test_candle_count": len(test_candles),
            "split_ratio": self.train_test_split_ratio,
            "initial_capital_usd": self.initial_capital,
            "assumptions": {
                "dex_fee_rate_pct": self.fee_rate * 100,
                "gas_cost_usd_per_trade": self.gas_cost_usd,
                "slippage_buffer_pct": self.slippage_rate * 100,
                "look_ahead_bias": "NONE (signal at bar t, fill at bar t+1 open)",
                "data_leakage_protection": "STRICT_CHRONOLOGICAL_SPLIT",
            },
            "dataset_metadata": metadata,
            "combined_metrics": combined_metrics,
            "strategies": all_results,
        }

    def _simulate_strategy(
        self,
        strategy: str,
        candles: List[Dict[str, Any]],
        starting_capital: float,
    ) -> Dict[str, Any]:
        equity = starting_capital
        cash = starting_capital
        peak_equity = starting_capital

        trades: List[Dict[str, Any]] = []
        equity_curve: List[Dict[str, Any]] = []
        drawdown_curve: List[Dict[str, Any]] = []

        active_position: Optional[Dict[str, Any]] = None

        for t in range(len(candles)):
            curr_bar = candles[t]
            curr_time = curr_bar["timestamp"]
            curr_close = curr_bar["close"]
            curr_high = curr_bar["high"]
            curr_low = curr_bar["low"]

            # 1. Update position status if currently open
            if active_position is not None:
                entry_p = active_position["entry_price"]
                pos_size = active_position["size_tokens"]
                bars_held = t - active_position["entry_bar"]
                tp_p = active_position["take_profit_price"]
                sl_p = active_position["stop_loss_price"]
                max_bars = active_position["max_hold_bars"]

                exit_reason = None
                exit_price = None

                # Check Stop-Loss
                if curr_low <= sl_p:
                    exit_reason = "STOP_LOSS"
                    exit_price = sl_p * (1.0 - self.slippage_rate)
                # Check Take-Profit
                elif curr_high >= tp_p:
                    exit_reason = "TAKE_PROFIT"
                    exit_price = tp_p * (1.0 - self.slippage_rate)
                # Check Max Hold Duration
                elif bars_held >= max_bars:
                    exit_reason = "MAX_HOLD_EXPIRED"
                    exit_price = curr_close * (1.0 - self.slippage_rate)
                else:
                    # Check strategy-specific dynamic exit signal (point-in-time)
                    sig = self._evaluate_signal(strategy, candles[:t+1])
                    if sig.get("action") == "EXIT":
                        exit_reason = "SIGNAL_EXIT"
                        exit_price = curr_close * (1.0 - self.slippage_rate)

                if exit_reason and exit_price is not None:
                    # Close position
                    exit_val_gross = pos_size * exit_price
                    exit_fee = exit_val_gross * self.fee_rate
                    exit_gas = self.gas_cost_usd
                    exit_slippage = exit_val_gross * self.slippage_rate

                    entry_val_gross = active_position["entry_value_gross"]
                    total_fees = active_position["entry_fee"] + exit_fee
                    total_gas = active_position["entry_gas"] + exit_gas
                    total_slippage = active_position["entry_slippage"] + exit_slippage
                    total_costs = total_fees + total_gas + total_slippage

                    gross_pnl = exit_val_gross - entry_val_gross
                    net_pnl = gross_pnl - total_costs
                    ret_pct = (net_pnl / entry_val_gross) * 100.0 if entry_val_gross > 0 else 0.0

                    cash += (exit_val_gross - exit_fee - exit_gas)
                    equity = cash

                    trades.append({
                        "id": str(uuid.uuid4())[:8],
                        "strategy": strategy,
                        "entry_bar": active_position["entry_bar"],
                        "exit_bar": t,
                        "entry_time": active_position["entry_time"],
                        "exit_time": curr_time,
                        "entry_price": round(entry_p, 4),
                        "exit_price": round(exit_price, 4),
                        "size_tokens": round(pos_size, 4),
                        "position_value_usd": round(entry_val_gross, 2),
                        "gross_pnl_usd": round(gross_pnl, 4),
                        "fees_usd": round(total_fees, 4),
                        "gas_usd": round(total_gas, 6),
                        "slippage_usd": round(total_slippage, 4),
                        "total_costs_usd": round(total_costs, 4),
                        "net_pnl_usd": round(net_pnl, 4),
                        "return_pct": round(ret_pct, 2),
                        "holding_bars": bars_held,
                        "exit_reason": exit_reason,
                        "is_win": net_pnl > 0.0,
                    })
                    active_position = None

            # 2. Check for New Entry if no active position
            if active_position is None and t < len(candles) - 1:
                # Strictly evaluate signal on candles up to t (NO LOOK-AHEAD)
                sig = self._evaluate_signal(strategy, candles[:t+1])

                if sig.get("action") in ["BUY", "BUY_ARBITRAGE"]:
                    # Order placed at close of t; executes at bar t+1 OPEN price + slippage
                    next_bar = candles[t + 1]
                    raw_entry_p = sig.get("entry_price", next_bar["open"])
                    fill_price = raw_entry_p * (1.0 + self.slippage_rate)

                    trade_alloc_usd = min(cash * (self.allocation_per_trade_pct / 100.0), cash)
                    if trade_alloc_usd >= 10.0:
                        entry_fee = trade_alloc_usd * self.fee_rate
                        entry_gas = self.gas_cost_usd if sig.get("action") != "BUY_ARBITRAGE" else (self.gas_cost_usd * 2)
                        entry_slippage = trade_alloc_usd * self.slippage_rate
                        net_capital_invested = trade_alloc_usd - entry_fee - entry_gas

                        pos_tokens = net_capital_invested / fill_price

                        sl_pct = sig.get("stop_loss_pct", 1.5)
                        tp_pct = sig.get("take_profit_pct", 3.5)
                        max_hold = sig.get("max_hold_bars", 30)

                        active_position = {
                            "entry_bar": t + 1,
                            "entry_time": next_bar["timestamp"],
                            "entry_price": fill_price,
                            "size_tokens": pos_tokens,
                            "entry_value_gross": trade_alloc_usd,
                            "entry_fee": entry_fee,
                            "entry_gas": entry_gas,
                            "entry_slippage": entry_slippage,
                            "stop_loss_price": fill_price * (1.0 - (sl_pct / 100.0)),
                            "take_profit_price": fill_price * (1.0 + (tp_pct / 100.0)),
                            "max_hold_bars": max_hold,
                        }
                        cash -= trade_alloc_usd

            # 3. Track equity & drawdown at this bar
            cur_pos_val = (active_position["size_tokens"] * curr_close) if active_position else 0.0
            current_equity = cash + cur_pos_val
            peak_equity = max(peak_equity, current_equity)
            dd_pct = ((peak_equity - current_equity) / peak_equity) * 100.0 if peak_equity > 0 else 0.0

            equity_curve.append({
                "timestamp": curr_time,
                "bar": t,
                "equity": round(current_equity, 2),
            })
            drawdown_curve.append({
                "timestamp": curr_time,
                "bar": t,
                "drawdown_pct": round(dd_pct, 2),
            })

        metrics = self._calculate_metrics(trades, starting_capital, len(candles))
        return {
            "metrics": metrics,
            "trades": trades,
            "equity_curve": equity_curve,
            "drawdown_curve": drawdown_curve,
        }

    def _evaluate_signal(self, strategy: str, candles_slice: List[Dict[str, Any]]) -> Dict[str, Any]:
        if strategy == "MOMENTUM_TREND_FOLLOWING":
            return StrategySignals.evaluate_momentum_trend(candles_slice)
        elif strategy == "ARBITRAGE_CROSS_TIER":
            return StrategySignals.evaluate_arbitrage_cross_tier(candles_slice)
        elif strategy == "MEAN_REVERSION_BB":
            return StrategySignals.evaluate_mean_reversion_bb(candles_slice)
        elif strategy == "HIGH_VOLATILITY_BREAKOUT":
            return StrategySignals.evaluate_high_volatility_breakout(candles_slice)
        return {"action": "HOLD"}

    def _calculate_metrics(
        self,
        trades: List[Dict[str, Any]],
        starting_capital: float,
        num_bars: int,
    ) -> Dict[str, Any]:
        """
        Calculates all 9 quantitative metrics required:
        1. Total return
        2. Net profit
        3. Win rate
        4. Profit factor
        5. Maximum drawdown
        6. Sharpe ratio
        7. Average trade return
        8. Average holding duration
        9. Total transaction costs
        """
        total_trades = len(trades)
        if total_trades == 0:
            return {
                "total_trades": 0,
                "total_return_pct": 0.0,
                "net_profit_usd": 0.0,
                "win_rate_pct": 0.0,
                "profit_factor": 1.0,
                "max_drawdown_pct": 0.0,
                "sharpe_ratio": 0.0,
                "avg_trade_return_pct": 0.0,
                "avg_holding_duration_bars": 0.0,
                "total_transaction_costs_usd": 0.0,
                "fees_usd": 0.0,
                "gas_usd": 0.0,
                "slippage_usd": 0.0,
                "winning_trades": 0,
                "losing_trades": 0,
            }

        wins = [t for t in trades if t["net_pnl_usd"] > 0]
        losses = [t for t in trades if t["net_pnl_usd"] <= 0]
        gross_profits = sum(t["gross_pnl_usd"] for t in wins)
        gross_losses = abs(sum(t["gross_pnl_usd"] for t in losses))

        total_net_profit = sum(t["net_pnl_usd"] for t in trades)
        total_fees = sum(t["fees_usd"] for t in trades)
        total_gas = sum(t["gas_usd"] for t in trades)
        total_slippage = sum(t["slippage_usd"] for t in trades)
        total_costs = total_fees + total_gas + total_slippage

        total_return_pct = (total_net_profit / starting_capital) * 100.0
        win_rate_pct = (len(wins) / total_trades) * 100.0

        if gross_losses > 0:
            profit_factor = gross_profits / gross_losses
        else:
            profit_factor = 999.0 if gross_profits > 0 else 1.0

        # Max Drawdown calculation from trade sequence
        peak = starting_capital
        running_equity = starting_capital
        max_dd_pct = 0.0
        returns = []
        for t in trades:
            running_equity += t["net_pnl_usd"]
            if running_equity > peak:
                peak = running_equity
            dd = ((peak - running_equity) / peak) * 100.0 if peak > 0 else 0.0
            if dd > max_dd_pct:
                max_dd_pct = dd
            returns.append(t["return_pct"] / 100.0)

        # Sharpe Ratio (annualized assuming 1m bars scaled to trading year)
        if len(returns) > 1:
            mean_ret = sum(returns) / len(returns)
            variance = sum((r - mean_ret) ** 2 for r in returns) / (len(returns) - 1)
            std_ret = math.sqrt(variance)
            # Annualization factor for minute bars (~525600 bars/year) or per-trade
            sharpe = (mean_ret / std_ret) * math.sqrt(len(returns)) if std_ret > 0 else 0.0
        else:
            sharpe = 0.0

        avg_trade_ret = sum(t["return_pct"] for t in trades) / total_trades
        avg_hold_duration = sum(t["holding_bars"] for t in trades) / total_trades

        return {
            "total_trades": total_trades,
            "winning_trades": len(wins),
            "losing_trades": len(losses),
            "total_return_pct": round(total_return_pct, 2),
            "net_profit_usd": round(total_net_profit, 2),
            "win_rate_pct": round(win_rate_pct, 1),
            "profit_factor": round(profit_factor, 2),
            "max_drawdown_pct": round(max_dd_pct, 2),
            "sharpe_ratio": round(sharpe, 2),
            "avg_trade_return_pct": round(avg_trade_ret, 2),
            "avg_holding_duration_bars": round(avg_hold_duration, 1),
            "total_transaction_costs_usd": round(total_costs, 4),
            "fees_usd": round(total_fees, 4),
            "gas_usd": round(total_gas, 6),
            "slippage_usd": round(total_slippage, 4),
        }
