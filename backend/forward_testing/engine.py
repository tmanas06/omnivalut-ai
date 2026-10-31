import os
import json
import time
import uuid
import math
import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from backend.adapters.hskswap.market_data import market_data_service
from backend.adapters.hskswap.collector import market_collector
from backend.risk.engine import DeterministicRiskEngine, RiskEvaluationResult
from backend.portfolio.tracker import PortfolioTracker

logger = logging.getLogger("omnivault.forward_testing")

STRATEGY_NAMES = [
    "MOMENTUM_TREND_FOLLOWING",
    "ARBITRAGE_CROSS_TIER",
    "MEAN_REVERSION_BB",
    "HIGH_VOLATILITY_BREAKOUT",
]


class ForwardTestSession:
    """
    Phase 4 State Container for Persistent Live Market Forward Testing.
    Tracks independently for each strategy:
    - opportunities detected & rejected
    - paper trades executed
    - win rate, gross profit, net profit, transaction costs
    - profit factor (safe zero-loss handling)
    - max drawdown, Sharpe ratio, average holding time, average slippage
    - persistent equity snapshots and interruption logs.
    """

    def __init__(
        self,
        session_id: str,
        duration_mode: str = "7d",  # "24h", "7d", "30d"
        initial_equity_usd: float = 1000.0,
        start_time: Optional[float] = None,
        status: str = "RUNNING",  # "RUNNING", "PAUSED", "COMPLETED"
    ):
        self.session_id = session_id
        self.duration_mode = duration_mode
        self.initial_equity_usd = initial_equity_usd
        self.current_equity_usd = initial_equity_usd
        self.start_time = start_time or time.time()
        self.status = status

        # Target durations in seconds (7 days = 604,800 seconds)
        duration_map = {
            "24h": 86400,
            "7d": 604800,
            "30d": 2592000,
        }
        self.target_duration_seconds = duration_map.get(duration_mode, 604800)
        self.target_end_time = self.start_time + self.target_duration_seconds

        # Formal Experiment Configuration
        self.experiment_config = {
            "name": f"{duration_mode.upper()} Live Market Forward Paper Test",
            "network": "HashKey Testnet (Chain ID 133)",
            "dex_protocol": "HSKSwap V3",
            "trading_mode": "LIVE_MARKET_PAPER_TEST",
            "duration_mode": self.duration_mode,
            "target_duration_seconds": self.target_duration_seconds,
            "target_duration_days": 7 if self.duration_mode == "7d" else (1 if self.duration_mode == "24h" else 30),
            "risk_rules_enforced": 13,
            "enabled_strategies": STRATEGY_NAMES,
            "started_at_epoch": self.start_time,
            "started_at_iso": datetime.fromtimestamp(self.start_time, timezone.utc).isoformat(),
        }

        # Independent strategy tracking
        self.strategy_metrics: Dict[str, Dict[str, Any]] = {
            strat: {
                "opportunities_detected": 0,
                "opportunities_rejected": 0,
                "paper_trades_executed": 0,
                "winning_trades": 0,
                "losing_trades": 0,
                "win_rate_pct": 0.0,
                "gross_profit_usd": 0.0,
                "gross_loss_usd": 0.0,
                "net_profit_usd": 0.0,
                "total_transaction_costs_usd": 0.0,
                "profit_factor": 1.0,
                "max_drawdown_pct": 0.0,
                "sharpe_ratio": 0.0,
                "avg_holding_time_seconds": 0.0,
                "avg_slippage_bps": 0.0,
                "holding_durations": [],
                "slippage_bps_list": [],
                "returns_list": [],
            }
            for strat in STRATEGY_NAMES
        }

        self.equity_history: List[Dict[str, Any]] = [
            {
                "timestamp": int(self.start_time),
                "equity_usd": round(initial_equity_usd, 2),
                "unrealized_pnl_usd": 0.0,
                "realized_pnl_usd": 0.0,
                "drawdown_pct": 0.0,
            }
        ]
        self.trades: List[Dict[str, Any]] = []
        self.proposals_evaluated_count = 0
        self.proposals_approved_count = 0
        self.proposals_rejected_count = 0
        self.rejection_breakdown: Dict[str, int] = {}
        self.slippage_records: List[Dict[str, Any]] = []
        self.interruptions: List[Dict[str, Any]] = []
        self.last_cycle_time = self.start_time

    @property
    def elapsed_seconds(self) -> float:
        return max(0.0, time.time() - self.start_time)

    @property
    def remaining_seconds(self) -> float:
        return max(0.0, self.target_end_time - time.time())

    @property
    def progress_pct(self) -> float:
        if self.target_duration_seconds <= 0:
            return 100.0
        return min(100.0, round((self.elapsed_seconds / self.target_duration_seconds) * 100.0, 2))

    def record_interruption(self, started_at: float, resumed_at: float, reason: str = "BACKEND_DOWNTIME"):
        """Records an operational gap honestly without fabricating observations."""
        duration = max(0.0, resumed_at - started_at)
        missed = int(duration / 15.0)  # 15s standard cycle
        interruption_record = {
            "interruption_id": str(uuid.uuid4())[:8],
            "started_at": started_at,
            "resumed_at": resumed_at,
            "started_at_iso": datetime.fromtimestamp(started_at, timezone.utc).isoformat(),
            "resumed_at_iso": datetime.fromtimestamp(resumed_at, timezone.utc).isoformat(),
            "duration_seconds": round(duration, 1),
            "reason": reason,
            "missed_observation_intervals": missed,
        }
        self.interruptions.append(interruption_record)
        logger.warning(
            f"[EXPERIMENT AUDIT] Recorded session interruption of {duration:.1f}s. "
            f"Missed {missed} observation intervals."
        )

    def record_equity_snapshot(self, equity: float, unrealized_pnl: float, realized_pnl: float):
        self.current_equity_usd = round(equity, 2)
        peak = max([snap["equity_usd"] for snap in self.equity_history] + [self.initial_equity_usd])
        dd_pct = ((peak - self.current_equity_usd) / peak) * 100.0 if peak > 0 else 0.0

        self.equity_history.append({
            "timestamp": int(time.time()),
            "equity_usd": self.current_equity_usd,
            "unrealized_pnl_usd": round(unrealized_pnl, 2),
            "realized_pnl_usd": round(realized_pnl, 2),
            "drawdown_pct": round(dd_pct, 2),
        })

    def record_slippage(self, expected_price: float, simulated_price: float, pair: str, strategy: str = "UNKNOWN"):
        if expected_price <= 0:
            return
        slippage_pct = ((abs(simulated_price - expected_price)) / expected_price) * 100.0
        slippage_bps = slippage_pct * 100.0
        rec = {
            "timestamp": int(time.time()),
            "pair": pair,
            "strategy": strategy,
            "expected_price": round(expected_price, 4),
            "simulated_price": round(simulated_price, 4),
            "slippage_bps": round(slippage_bps, 2),
        }
        self.slippage_records.append(rec)
        if strategy in self.strategy_metrics:
            self.strategy_metrics[strategy]["slippage_bps_list"].append(slippage_bps)
            s_list = self.strategy_metrics[strategy]["slippage_bps_list"]
            self.strategy_metrics[strategy]["avg_slippage_bps"] = round(sum(s_list) / len(s_list), 2)

    def register_opportunity(self, strategy: str, is_approved: bool, rejection_rule: Optional[str] = None):
        """Updates per-strategy opportunity and rejection counts."""
        if strategy in self.strategy_metrics:
            self.strategy_metrics[strategy]["opportunities_detected"] += 1
            if not is_approved:
                self.strategy_metrics[strategy]["opportunities_rejected"] += 1

    def record_trade_completion(
        self,
        strategy: str,
        gross_pnl: float,
        net_pnl: float,
        transaction_costs: float,
        holding_seconds: float,
    ):
        """Updates strategy performance metrics upon paper trade closing."""
        if strategy not in self.strategy_metrics:
            return

        m = self.strategy_metrics[strategy]
        m["paper_trades_executed"] += 1
        m["net_profit_usd"] = round(m["net_profit_usd"] + net_pnl, 2)
        m["total_transaction_costs_usd"] = round(m["total_transaction_costs_usd"] + transaction_costs, 4)

        if net_pnl > 0:
            m["winning_trades"] += 1
            m["gross_profit_usd"] = round(m["gross_profit_usd"] + gross_pnl, 2)
        else:
            m["losing_trades"] += 1
            m["gross_loss_usd"] = round(m["gross_loss_usd"] + abs(gross_pnl), 2)

        total_completed = m["winning_trades"] + m["losing_trades"]
        m["win_rate_pct"] = round((m["winning_trades"] / total_completed) * 100.0, 1) if total_completed > 0 else 0.0

        # SAFE PROFIT FACTOR CALCULATION (zero-loss handling)
        if m["gross_loss_usd"] > 0:
            m["profit_factor"] = round(m["gross_profit_usd"] / m["gross_loss_usd"], 2)
        else:
            m["profit_factor"] = 999.0 if m["gross_profit_usd"] > 0 else 1.0

        # Holding duration
        m["holding_durations"].append(holding_seconds)
        m["avg_holding_time_seconds"] = round(sum(m["holding_durations"]) / len(m["holding_durations"]), 1)

        # Sharpe Ratio estimator
        if total_completed > 0 and self.initial_equity_usd > 0:
            ret = (net_pnl / (self.initial_equity_usd * 0.10))
            m["returns_list"].append(ret)
            if len(m["returns_list"]) > 1:
                r_arr = m["returns_list"]
                mean_r = sum(r_arr) / len(r_arr)
                var = sum((x - mean_r) ** 2 for x in r_arr) / (len(r_arr) - 1)
                std_r = math.sqrt(var)
                m["sharpe_ratio"] = round((mean_r / std_r) * math.sqrt(len(r_arr)), 2) if std_r > 0 else 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Serializes session state for observability dashboard and API responses."""
        # Calculate combined portfolio metrics
        all_completed = sum(m["winning_trades"] + m["losing_trades"] for m in self.strategy_metrics.values())
        all_wins = sum(m["winning_trades"] for m in self.strategy_metrics.values())
        comb_win_rate = round((all_wins / all_completed) * 100.0, 1) if all_completed > 0 else 0.0
        comb_gross_profit = sum(m["gross_profit_usd"] for m in self.strategy_metrics.values())
        comb_gross_loss = sum(m["gross_loss_usd"] for m in self.strategy_metrics.values())
        comb_profit_factor = (
            round(comb_gross_profit / comb_gross_loss, 2)
            if comb_gross_loss > 0
            else (999.0 if comb_gross_profit > 0 else 1.0)
        )

        return {
            "session_id": self.session_id,
            "status": self.status,
            "duration_mode": self.duration_mode,
            "experiment_config": self.experiment_config,
            "initial_equity_usd": self.initial_equity_usd,
            "current_equity_usd": self.current_equity_usd,
            "start_time": self.start_time,
            "target_end_time": self.target_end_time,
            "elapsed_seconds": round(self.elapsed_seconds, 1),
            "remaining_seconds": round(self.remaining_seconds, 1),
            "progress_pct": self.progress_pct,
            "total_trades": len(self.trades),
            "proposals_evaluated": self.proposals_evaluated_count,
            "proposals_approved": self.proposals_approved_count,
            "proposals_rejected": self.proposals_rejected_count,
            "rejection_breakdown": self.rejection_breakdown,
            "strategy_performance": {
                s_name: {k: v for k, v in data.items() if not k.endswith("_list") and not k.endswith("durations")}
                for s_name, data in self.strategy_metrics.items()
            },
            "combined_portfolio_metrics": {
                "total_trades": all_completed,
                "win_rate_pct": comb_win_rate,
                "profit_factor": comb_profit_factor,
                "gross_profit_usd": round(comb_gross_profit, 2),
                "gross_loss_usd": round(comb_gross_loss, 2),
                "net_profit_usd": round(sum(m["net_profit_usd"] for m in self.strategy_metrics.values()), 2),
                "total_costs_usd": round(sum(m["total_transaction_costs_usd"] for m in self.strategy_metrics.values()), 4),
            },
            "interruptions_count": len(self.interruptions),
            "interruptions": self.interruptions,
            "avg_slippage_bps": (
                round(sum(s["slippage_bps"] for s in self.slippage_records) / len(self.slippage_records), 2)
                if self.slippage_records else 0.0
            ),
            "equity_snapshots_count": len(self.equity_history),
            "last_cycle_time": self.last_cycle_time,
            "data_provenance": "LIVE_MARKET_PAPER_TEST (HashKey Testnet)",
        }


class ForwardTestEngine:
    """
    Persistent Paper Trading Forward Testing Engine.
    Executes continuous multi-day paper trading experiments against live HSKSwap Testnet pool quotes.
    Integrates all 13 deterministic risk rules, per-strategy quantitative metric tracking,
    system reliability telemetry, and restart recovery without fabricating observations.
    """

    def __init__(
        self,
        persistence_file: str = "data/forward_test_session.json",
        risk_engine: Optional[DeterministicRiskEngine] = None,
        portfolio_tracker: Optional[PortfolioTracker] = None,
    ):
        self.persistence_file = persistence_file
        self.risk_engine = risk_engine or DeterministicRiskEngine()
        self.portfolio_tracker = portfolio_tracker or PortfolioTracker(persistence_file="data/forward_portfolio.json")
        self.active_session: Optional[ForwardTestSession] = None
        self.load_from_disk()

    def start_session(
        self,
        duration_mode: str = "7d",
        initial_equity_usd: float = 1000.0,
    ) -> Dict[str, Any]:
        """Starts or re-initializes a forward testing session (24h, 7d, 30d)."""
        if duration_mode not in ["24h", "7d", "30d"]:
            raise ValueError(f"Invalid duration mode '{duration_mode}'. Must be one of ['24h', '7d', '30d'].")

        session_id = str(uuid.uuid4())[:8]
        self.active_session = ForwardTestSession(
            session_id=session_id,
            duration_mode=duration_mode,
            initial_equity_usd=initial_equity_usd,
        )
        self.save_to_disk()
        logger.info(f"Forward testing session {session_id} started ({duration_mode} mode).")
        return self.active_session.to_dict()

    def stop_session(self) -> Dict[str, Any]:
        if not self.active_session:
            return {"status": "NO_ACTIVE_SESSION"}
        self.active_session.status = "COMPLETED"
        self.save_to_disk()
        logger.info(f"Forward testing session {self.active_session.session_id} manually stopped.")
        return self.active_session.to_dict()

    def get_status(self) -> Dict[str, Any]:
        if not self.active_session:
            return {
                "has_active_session": False,
                "status": "IDLE",
                "message": "No active forward test session. Call /api/forward-test/start to begin.",
                "market_collector_telemetry": market_collector.get_reliability_metrics(),
            }
        return {
            "has_active_session": True,
            **self.active_session.to_dict(),
            "latest_equity": self.active_session.current_equity_usd,
            "total_trades": len(self.active_session.trades),
            "market_collector_telemetry": market_collector.get_reliability_metrics(),
        }

    def get_equity_curve(self) -> List[Dict[str, Any]]:
        if not self.active_session:
            return []
        return self.active_session.equity_history

    def get_slippage_analysis(self) -> Dict[str, Any]:
        if not self.active_session:
            return {"records": [], "avg_bps": 0.0}
        recs = self.active_session.slippage_records
        avg_bps = (sum(r["slippage_bps"] for r in recs) / len(recs)) if recs else 0.0
        return {
            "records": recs[-50:],
            "total_records": len(recs),
            "avg_slippage_bps": round(avg_bps, 2),
        }

    async def step_forward_cycle(
        self,
        market_quotes: Dict[str, Any],
        proposals: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Executes a single cycle using real HSKSwap Testnet market quotes.
        Gathers live observations via market_collector, applies 13 risk rules,
        simulates fills with slippage, updates strategy metrics, and reconciles equity.
        """
        if not self.active_session or self.active_session.status != "RUNNING":
            return {"status": "SKIPPED_NOT_RUNNING"}

        # Collect verified on-chain observations
        try:
            await market_collector.collect_live_pools_sample()
        except Exception as ex:
            logger.warning(f"Error sampling live pools in market collector: {ex}")

        # Check session duration
        if time.time() >= self.active_session.target_end_time:
            self.active_session.status = "COMPLETED"
            self.save_to_disk()
            logger.info(f"Forward testing session {self.active_session.session_id} finished target duration.")
            return {"status": "SESSION_COMPLETED", "session": self.active_session.to_dict()}

        self.active_session.last_cycle_time = time.time()
        p_summary = self.portfolio_tracker.get_portfolio_summary()

        executed_in_cycle = []
        for prop in proposals:
            self.active_session.proposals_evaluated_count += 1
            strat_name = prop.get("strategy", "MOMENTUM_TREND_FOLLOWING")

            risk_res: RiskEvaluationResult = self.risk_engine.evaluate_opportunity(prop, p_summary)

            if not risk_res.is_approved:
                self.active_session.proposals_rejected_count += 1
                rule = risk_res.rule_evaluated
                self.active_session.rejection_breakdown[rule] = self.active_session.rejection_breakdown.get(rule, 0) + 1
                self.active_session.register_opportunity(strat_name, is_approved=False, rejection_rule=rule)
                continue

            self.active_session.proposals_approved_count += 1
            self.active_session.register_opportunity(strat_name, is_approved=True)

            # Execution simulation with realistic DEX slippage (0.05% - 0.15%)
            expected_price = float(prop.get("quoted_price", 0.8542))
            import random
            slip_pct = random.uniform(0.0005, 0.0015)
            if prop.get("direction") == "BUY":
                simulated_exec_price = expected_price * (1.0 + slip_pct)
            else:
                simulated_exec_price = expected_price * (1.0 - slip_pct)

            self.active_session.record_slippage(
                expected_price=expected_price,
                simulated_price=simulated_exec_price,
                pair=prop.get("pair", "WHSK/USDT"),
                strategy=strat_name,
            )

            trade_cost = float(prop.get("trade_size_usd", 50.0))
            sim_pos = self.portfolio_tracker.add_position(
                position_id=str(uuid.uuid4())[:8],
                pair=prop.get("pair", "WHSK/USDT"),
                side="LONG" if prop.get("direction") == "BUY" else "SHORT",
                entry_price=simulated_exec_price,
                quantity=trade_cost / simulated_exec_price,
                cost_usd=trade_cost,
                stop_loss=prop.get("proposed_stop_loss"),
                take_profit=prop.get("proposed_take_profit"),
                is_simulated=True,
            )

            trade_record = {
                "id": str(uuid.uuid4())[:8],
                "opportunity_id": prop.get("id"),
                "strategy": strat_name,
                "pair": prop.get("pair"),
                "direction": prop.get("direction"),
                "expected_price": round(expected_price, 4),
                "simulated_price": round(simulated_exec_price, 4),
                "slippage_bps": round(slip_pct * 10000, 2),
                "amount_usd": round(trade_cost, 2),
                "timestamp": int(time.time()),
                "status": "SIMULATED_FILLED",
            }
            self.active_session.trades.append(trade_record)
            executed_in_cycle.append(trade_record)

        # Update position market valuations and process exits
        pair_p = market_quotes.get("price", 0.8542)
        exit_events = self.portfolio_tracker.update_market_prices({market_quotes.get("pair", "WHSK/USDT"): pair_p})

        # Record strategy P&L for completed exits
        for ev in exit_events:
            if ev.get("action") == "SIMULATED_CLOSED":
                # Match closed position
                p_id = ev.get("position_id")
                pos_rec = self.portfolio_tracker.positions.get(p_id)
                strat = "MOMENTUM_TREND_FOLLOWING"
                if pos_rec:
                    # Deduce strategy from matching trade record
                    for t in reversed(self.active_session.trades):
                        if t.get("pair") == pos_rec.pair:
                            strat = t.get("strategy", strat)
                            break
                r_pnl = ev.get("realized_pnl", 0.0)
                dur = ev.get("holding_duration_seconds", 60.0)
                costs = 50.0 * 0.003 + 0.00015  # DEX fee + gas
                self.active_session.record_trade_completion(
                    strategy=strat,
                    gross_pnl=r_pnl + costs,
                    net_pnl=r_pnl,
                    transaction_costs=costs,
                    holding_seconds=dur,
                )

        new_summary = self.portfolio_tracker.get_portfolio_summary()
        self.active_session.record_equity_snapshot(
            equity=new_summary["total_value_usd"],
            unrealized_pnl=new_summary["unrealized_pnl_usd"],
            realized_pnl=new_summary["realized_pnl_usd"],
        )
        self.save_to_disk()

        return {
            "session_id": self.active_session.session_id,
            "status": self.active_session.status,
            "executed_count": len(executed_in_cycle),
            "executed_trades": executed_in_cycle,
            "portfolio_summary": new_summary,
            "market_reliability": market_collector.get_reliability_metrics(),
        }

    def save_to_disk(self):
        """Persist session state to disk for restart recovery."""
        if not self.active_session:
            return
        try:
            os.makedirs(os.path.dirname(os.path.abspath(self.persistence_file)), exist_ok=True)
            payload = {
                "session": {
                    "session_id": self.active_session.session_id,
                    "duration_mode": self.active_session.duration_mode,
                    "initial_equity_usd": self.active_session.initial_equity_usd,
                    "current_equity_usd": self.active_session.current_equity_usd,
                    "start_time": self.active_session.start_time,
                    "target_duration_seconds": self.active_session.target_duration_seconds,
                    "target_end_time": self.active_session.target_end_time,
                    "status": self.active_session.status,
                    "proposals_evaluated_count": self.active_session.proposals_evaluated_count,
                    "proposals_approved_count": self.active_session.proposals_approved_count,
                    "proposals_rejected_count": self.active_session.proposals_rejected_count,
                    "rejection_breakdown": self.active_session.rejection_breakdown,
                    "last_cycle_time": self.active_session.last_cycle_time,
                    "experiment_config": self.active_session.experiment_config,
                    "strategy_metrics": self.active_session.strategy_metrics,
                    "interruptions": self.active_session.interruptions,
                },
                "equity_history": self.active_session.equity_history,
                "trades": self.active_session.trades,
                "slippage_records": self.active_session.slippage_records,
                "saved_at": time.time(),
            }
            with open(self.persistence_file, "w") as f:
                json.dump(payload, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not persist forward testing state: {e}")

    def load_from_disk(self) -> bool:
        """Loads state from disk, detects downtime interruptions, and recovers metrics."""
        if not os.path.exists(self.persistence_file):
            return False
        try:
            with open(self.persistence_file, "r") as f:
                payload = json.load(f)

            s_data = payload.get("session", {})
            session = ForwardTestSession(
                session_id=s_data.get("session_id", str(uuid.uuid4())[:8]),
                duration_mode=s_data.get("duration_mode", "7d"),
                initial_equity_usd=s_data.get("initial_equity_usd", 1000.0),
                start_time=s_data.get("start_time"),
                status=s_data.get("status", "COMPLETED"),
            )
            session.current_equity_usd = s_data.get("current_equity_usd", 1000.0)
            session.target_duration_seconds = s_data.get("target_duration_seconds", 604800)
            session.target_end_time = s_data.get("target_end_time", session.start_time + 604800)
            session.proposals_evaluated_count = s_data.get("proposals_evaluated_count", 0)
            session.proposals_approved_count = s_data.get("proposals_approved_count", 0)
            session.proposals_rejected_count = s_data.get("proposals_rejected_count", 0)
            session.rejection_breakdown = s_data.get("rejection_breakdown", {})
            session.last_cycle_time = s_data.get("last_cycle_time", time.time())
            session.interruptions = s_data.get("interruptions", [])

            # Recover per-strategy metrics
            if "strategy_metrics" in s_data:
                for strat, data in s_data["strategy_metrics"].items():
                    if strat in session.strategy_metrics:
                        session.strategy_metrics[strat].update(data)

            session.equity_history = payload.get("equity_history", [])
            session.trades = payload.get("trades", [])
            session.slippage_records = payload.get("slippage_records", [])

            # Interruption check on reboot
            now = time.time()
            gap = now - session.last_cycle_time
            if session.status == "RUNNING" and gap > 60.0:
                session.record_interruption(
                    started_at=session.last_cycle_time,
                    resumed_at=now,
                    reason="BACKEND_REBOOT_OR_DOWNTIME",
                )
                session.last_cycle_time = now

            self.active_session = session
            logger.info(f"Recovered forward test session {session.session_id} ({session.status}) from disk.")
            return True
        except Exception as e:
            logger.warning(f"Failed to recover forward test session: {e}")
            return False


# Global Singleton
forward_test_engine = ForwardTestEngine()
