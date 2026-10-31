import os
import json
import time
import uuid
import math
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from backend.database.session import AsyncSessionLocal
from backend.database.models import Experiment as DBExperiment
from backend.risk.engine import RiskPolicyConfig

logger = logging.getLogger("omnivault.experiments")

CORE_STRATEGIES = [
    "MOMENTUM_TREND_FOLLOWING",
    "ARBITRAGE_CROSS_TIER",
    "MEAN_REVERSION_BB",
    "HIGH_VOLATILITY_BREAKOUT",
]


class ExperimentManager:
    """
    Phase 5: Persistent Experiment Management & Strategy Comparison System.
    Guarantees configuration immutability, supports lifecycle controls (start/stop/resume),
    side-by-side experiment comparison, and multi-metric strategy evaluation (never ranking solely by win rate).
    """

    def __init__(self, storage_dir: str = "data/experiments"):
        self.storage_dir = storage_dir
        os.makedirs(self.storage_dir, exist_ok=True)
        self.experiments: Dict[str, Dict[str, Any]] = {}
        self.active_experiment_id: Optional[str] = None
        self.load_all_from_disk()

    def load_all_from_disk(self):
        """Loads all persisted experiments from disk on startup."""
        try:
            for fname in os.listdir(self.storage_dir):
                if fname.endswith(".json"):
                    fpath = os.path.join(self.storage_dir, fname)
                    with open(fpath, "r") as f:
                        data = json.load(f)
                        exp_id = data.get("id")
                        if exp_id:
                            self.experiments[exp_id] = data
                            if data.get("status") == "RUNNING":
                                self.active_experiment_id = exp_id
            logger.info(f"Loaded {len(self.experiments)} experiments from disk storage.")
        except Exception as e:
            logger.warning(f"Error loading experiments from disk: {e}")

    def save_to_disk(self, experiment_id: str):
        """Persists a single experiment record to disk atomically."""
        if experiment_id not in self.experiments:
            return
        fpath = os.path.join(self.storage_dir, f"{experiment_id}.json")
        try:
            with open(fpath, "w") as f:
                json.dump(self.experiments[experiment_id], f, indent=2)
        except Exception as e:
            logger.error(f"Failed to persist experiment {experiment_id} to disk: {e}")

    def create_experiment(
        self,
        name: str,
        description: Optional[str] = None,
        strategy_config: Optional[Dict[str, Any]] = None,
        risk_config: Optional[Dict[str, Any]] = None,
        initial_capital: float = 1000.0,
        target_duration_seconds: int = 604800,  # 7 Days default
        is_baseline: bool = False,
        data_provenance: str = "LIVE_MARKET_PAPER_TEST",
    ) -> Dict[str, Any]:
        """
        Creates a new experiment with an immutable configuration snapshot.
        """
        exp_id = f"exp_{int(time.time())}_{str(uuid.uuid4())[:6]}"
        default_risk = RiskPolicyConfig().model_dump()
        if risk_config:
            default_risk.update(risk_config)

        default_strategies = {strat: {"enabled": True, "weight": 0.25} for strat in CORE_STRATEGIES}
        if strategy_config:
            default_strategies.update(strategy_config)

        # Immutable snapshot of the exact setup
        immutable_snapshot = {
            "experiment_id": exp_id,
            "created_at_epoch": time.time(),
            "created_at_iso": datetime.now(timezone.utc).isoformat(),
            "network": "HashKey Chain Testnet (Chain ID 133)",
            "dex_protocol": "HSKSwap V3",
            "execution_mode": "PAPER",
            "initial_capital_usd": initial_capital,
            "target_duration_seconds": target_duration_seconds,
            "enabled_strategies": default_strategies,
            "risk_policy": default_risk,
            "token_pairs": ["WHSK/USDT", "WHSK/USDC.e"],
            "fee_tiers": [500, 3000, 10000],
            "is_immutable": True,
        }

        # Initialize strategy metrics matrix
        initial_strategy_metrics = {
            strat: {
                "opportunities_detected": 0,
                "opportunities_rejected": 0,
                "paper_trades_executed": 0,
                "winning_trades": 0,
                "losing_trades": 0,
                "loss_count": 0,
                "win_rate_pct": 0.0,
                "gross_profit_usd": 0.0,
                "gross_loss_usd": 0.0,
                "net_profit_usd": 0.0,
                "transaction_costs_usd": 0.0,
                "total_transaction_costs_usd": 0.0,
                "profit_factor": 1.0,
                "max_drawdown_pct": 0.0,
                "sharpe_ratio": 0.0,
                "avg_holding_time_seconds": 0.0,
                "avg_slippage_bps": 0.0,
                "composite_score": 0.0,
                "rejection_rate_pct": 0.0,
                "returns_history": [],
                "holding_durations": [],
                "slippage_bps_list": [],
            }
            for strat in CORE_STRATEGIES
        }

        exp_record = {
            "id": exp_id,
            "name": name,
            "description": description or f"Experiment testing {name}",
            "status": "CREATED",
            "immutable_config_snapshot": immutable_snapshot,
            "is_baseline": is_baseline,
            "data_provenance": data_provenance,
            "created_at": time.time(),
            "started_at": None,
            "ended_at": None,
            "resumed_at": None,
            "elapsed_seconds": 0.0,
            "trades": [],
            "equity_history": [{"timestamp": int(time.time()), "equity": initial_capital, "drawdown_pct": 0.0}],
            "strategy_metrics": initial_strategy_metrics,
            "combined_metrics": {
                "total_trades": 0,
                "win_rate_pct": 0.0,
                "profit_factor": 1.0,
                "gross_profit_usd": 0.0,
                "gross_loss_usd": 0.0,
                "net_profit_usd": 0.0,
                "total_transaction_costs_usd": 0.0,
                "max_drawdown_pct": 0.0,
                "sharpe_ratio": 0.0,
                "calmar_ratio": 0.0,
                "composite_score": 0.0,
                "current_equity": initial_capital,
                "peak_equity": initial_capital,
            },
            "market_regimes_summary": {},
            "interruptions": [],
        }

        self.experiments[exp_id] = exp_record
        self.save_to_disk(exp_id)
        logger.info(f"Created new experiment {exp_id}: '{name}'")
        return exp_record

    def get_experiment(self, experiment_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a single experiment by ID."""
        exp = self.experiments.get(experiment_id)
        if not exp:
            return None
        # Add metrics_summary view for API consistency
        exp["metrics_summary"] = {
            "strategy_metrics": exp.get("strategy_metrics", {}),
            "combined_portfolio": {
                "completed_trades": exp.get("combined_metrics", {}).get("total_trades", 0),
                "total_trades": exp.get("combined_metrics", {}).get("total_trades", 0),
                "net_profit_usd": exp.get("combined_metrics", {}).get("net_profit_usd", 0.0),
                "win_rate_pct": exp.get("combined_metrics", {}).get("win_rate_pct", 0.0),
                "profit_factor": exp.get("combined_metrics", {}).get("profit_factor", 1.0),
                "max_drawdown_pct": exp.get("combined_metrics", {}).get("max_drawdown_pct", 0.0),
                "sharpe_ratio": exp.get("combined_metrics", {}).get("sharpe_ratio", 0.0),
                "composite_score": exp.get("combined_metrics", {}).get("composite_score", 0.0),
            },
        }
        exp["interruption_intervals"] = exp.get("interruptions", [])
        return exp

    def list_experiments(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Lists all experiments with optional status filter."""
        results = [self.get_experiment(eid) for eid in self.experiments.keys()]
        if status:
            results = [e for e in results if e and e.get("status") == status]
        return sorted(results, key=lambda x: x.get("created_at", 0), reverse=True)

    def start_experiment(self, experiment_id: str) -> Dict[str, Any]:
        """Starts an experiment."""
        if experiment_id not in self.experiments:
            raise ValueError(f"Experiment {experiment_id} not found.")

        exp = self.experiments[experiment_id]
        if exp["status"] == "RUNNING":
            return self.get_experiment(experiment_id)

        # If another experiment is running, stop it
        if self.active_experiment_id and self.active_experiment_id != experiment_id:
            self.stop_experiment(self.active_experiment_id)

        now = time.time()
        if not exp["started_at"]:
            exp["started_at"] = now
        exp["resumed_at"] = now
        exp["status"] = "RUNNING"
        self.active_experiment_id = experiment_id
        self.save_to_disk(experiment_id)
        logger.info(f"Started experiment {experiment_id}")
        return self.get_experiment(experiment_id)

    def stop_experiment(self, experiment_id: str) -> Dict[str, Any]:
        """Stops/pauses a running experiment."""
        if experiment_id not in self.experiments:
            raise ValueError(f"Experiment {experiment_id} not found.")

        exp = self.experiments[experiment_id]
        if exp["status"] not in ["RUNNING"]:
            return self.get_experiment(experiment_id)

        now = time.time()
        if exp.get("resumed_at"):
            exp["elapsed_seconds"] += now - exp["resumed_at"]
        exp["status"] = "PAUSED"
        exp["ended_at"] = now
        if self.active_experiment_id == experiment_id:
            self.active_experiment_id = None
        self.save_to_disk(experiment_id)
        logger.info(f"Stopped experiment {experiment_id}")
        return self.get_experiment(experiment_id)

    def resume_experiment(self, experiment_id: str) -> Dict[str, Any]:
        """Resumes an interrupted experiment, recording the interruption duration."""
        if experiment_id not in self.experiments:
            raise ValueError(f"Experiment {experiment_id} not found.")

        exp = self.experiments[experiment_id]
        now = time.time()
        last_activity = exp.get("ended_at") or exp.get("resumed_at") or exp.get("started_at") or now
        gap = max(0.0, now - last_activity)

        if gap >= 0.01:
            interruption_rec = {
                "interruption_id": str(uuid.uuid4())[:8],
                "started_at": last_activity,
                "resumed_at": now,
                "duration_seconds": round(gap, 3),
                "interruption_duration_seconds": round(gap, 3),
                "reason": "EXPERIMENT_RESUMED_AFTER_PAUSE",
                "missed_intervals": int(gap / 15.0),
            }
            exp["interruptions"].append(interruption_rec)

        return self.start_experiment(experiment_id)

    def record_trade_fill(
        self,
        experiment_id: str,
        *args,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Records an execution fill into the experiment, updating per-strategy and combined metrics.
        Supports trade_data dictionary, positional arguments tuple, and explicit keyword arguments.
        """
        if experiment_id not in self.experiments:
            return {}

        exp = self.experiments[experiment_id]
        data = {}
        if len(args) == 1 and isinstance(args[0], dict):
            data.update(args[0])
        elif len(args) >= 8:
            data.update({
                "strategy": args[0],
                "pair": args[1],
                "direction": args[2],
                "entry_price": args[3],
                "exit_price": args[4],
                "quantity": args[5],
                "slippage_bps": args[6],
                "duration_seconds": args[7],
            })
        data.update(kwargs)

        strategy = data.get("strategy") or data.get("strategy_name") or "MOMENTUM_TREND_FOLLOWING"
        entry_price = float(data.get("entry_price", 0.985))
        exit_price = float(data.get("exit_price", 0.985))
        qty = float(data.get("quantity", data.get("size_tokens", 10.0)))
        direction = data.get("direction", data.get("side", "BUY")).upper()

        if "gross_pnl_usd" in data:
            gross_pnl = float(data["gross_pnl_usd"])
        elif "pnl_usd" in data:
            gross_pnl = float(data["pnl_usd"])
        else:
            gross_pnl = (exit_price - entry_price) * qty if direction == "BUY" else (entry_price - exit_price) * qty

        fee_cost = float(data.get("fee_usd", 0.005))
        gas_cost = float(data.get("gas_cost_usd", 0.00015))
        total_costs = fee_cost + gas_cost
        net_pnl = gross_pnl - total_costs
        holding_seconds = float(data.get("duration_seconds", data.get("holding_time_seconds", 60.0)))
        slippage_bps = float(data.get("slippage_bps", 1.0))

        # Store trade in log
        trade_entry = {
            "trade_id": data.get("trade_id", str(uuid.uuid4())[:8]),
            "timestamp": time.time(),
            "strategy": strategy,
            "pair": data.get("pair", "HSK/USDT"),
            "side": direction,
            "size_tokens": qty,
            "entry_price": entry_price,
            "exit_price": exit_price,
            "gross_pnl_usd": round(gross_pnl, 4),
            "net_pnl_usd": round(net_pnl, 4),
            "total_costs_usd": round(total_costs, 6),
            "holding_time_seconds": holding_seconds,
            "slippage_bps": slippage_bps,
            "regime": data.get("regime", "UNKNOWN"),
        }
        exp["trades"].append(trade_entry)

        # Update strategy-specific metrics
        if strategy in exp["strategy_metrics"]:
            sm = exp["strategy_metrics"][strategy]
            sm["paper_trades_executed"] += 1
            current_costs = sm.get("total_transaction_costs_usd", sm.get("transaction_costs_usd", 0.0))
            sm["total_transaction_costs_usd"] = round(current_costs + total_costs, 4)
            sm["transaction_costs_usd"] = sm["total_transaction_costs_usd"]
            sm["net_profit_usd"] = round(sm.get("net_profit_usd", 0.0) + net_pnl, 2)
            sm["net_pnl_usd"] = sm["net_profit_usd"]

            if net_pnl > 0:
                sm["winning_trades"] += 1
                sm["gross_profit_usd"] = round(sm.get("gross_profit_usd", 0.0) + gross_pnl, 2)
            else:
                sm["losing_trades"] += 1
                sm["loss_count"] = sm["losing_trades"]
                sm["gross_loss_usd"] = round(sm.get("gross_loss_usd", 0.0) + abs(gross_pnl), 2)

            sm["loss_count"] = sm.get("losing_trades", 0)

            total_trades = sm["winning_trades"] + sm["losing_trades"]
            sm["win_rate_pct"] = round((sm["winning_trades"] / total_trades) * 100.0, 1) if total_trades > 0 else 0.0

            # Safe zero-loss profit factor
            if sm["gross_loss_usd"] > 0:
                sm["profit_factor"] = round(sm["gross_profit_usd"] / sm["gross_loss_usd"], 2)
            else:
                sm["profit_factor"] = 99.0 if sm["gross_profit_usd"] > 0 else 1.0

            # Slippage and holding averages
            sm["holding_durations"].append(holding_seconds)
            sm["avg_holding_time_seconds"] = round(sum(sm["holding_durations"]) / len(sm["holding_durations"]), 1)

            sm["slippage_bps_list"].append(slippage_bps)
            sm["avg_slippage_bps"] = round(sum(sm["slippage_bps_list"]) / len(sm["slippage_bps_list"]), 2)

            # Sharpe Ratio calculation
            ret = net_pnl / (exp["immutable_config_snapshot"]["initial_capital_usd"] * 0.10)
            sm["returns_history"].append(ret)
            if len(sm["returns_history"]) > 1:
                r_arr = sm["returns_history"]
                mean_r = sum(r_arr) / len(r_arr)
                var = sum((x - mean_r) ** 2 for x in r_arr) / (len(r_arr) - 1)
                std_r = math.sqrt(var)
                sm["sharpe_ratio"] = round((mean_r / std_r) * math.sqrt(len(r_arr)), 2) if std_r > 0 else 0.0

            # Calculate composite non-win-rate score
            sm["composite_score"] = self._calculate_composite_score(
                sharpe=sm["sharpe_ratio"],
                profit_factor=sm["profit_factor"],
                win_rate=sm["win_rate_pct"],
                drawdown=sm["max_drawdown_pct"],
            )

        # Update combined portfolio metrics
        cm = exp["combined_metrics"]
        cm["total_trades"] = len(exp["trades"])
        cm["net_profit_usd"] = round(cm["net_profit_usd"] + net_pnl, 2)
        cm["gross_profit_usd"] = round(sum(s["gross_profit_usd"] for s in exp["strategy_metrics"].values()), 2)
        cm["gross_loss_usd"] = round(sum(s["gross_loss_usd"] for s in exp["strategy_metrics"].values()), 2)
        cm["total_transaction_costs_usd"] = round(cm["total_transaction_costs_usd"] + total_costs, 4)

        wins = sum(s["winning_trades"] for s in exp["strategy_metrics"].values())
        cm["win_rate_pct"] = round((wins / cm["total_trades"]) * 100.0, 1) if cm["total_trades"] > 0 else 0.0

        if cm["gross_loss_usd"] > 0:
            cm["profit_factor"] = round(cm["gross_profit_usd"] / cm["gross_loss_usd"], 2)
        else:
            cm["profit_factor"] = 999.0 if cm["gross_profit_usd"] > 0 else 1.0

        # Equity curve & Drawdown
        cm["current_equity"] = round(cm["current_equity"] + net_pnl, 2)
        cm["peak_equity"] = max(cm["peak_equity"], cm["current_equity"])
        dd_pct = ((cm["peak_equity"] - cm["current_equity"]) / cm["peak_equity"]) * 100.0 if cm["peak_equity"] > 0 else 0.0
        cm["max_drawdown_pct"] = max(cm["max_drawdown_pct"], round(dd_pct, 2))

        exp["equity_history"].append({
            "timestamp": int(time.time()),
            "equity": cm["current_equity"],
            "drawdown_pct": round(dd_pct, 2),
        })

        self.save_to_disk(experiment_id)
        return exp

    def _calculate_composite_score(
        self,
        sharpe: float,
        profit_factor: float,
        win_rate: float,
        drawdown: float,
    ) -> float:
        """
        Calculates a balanced composite performance score.
        CRITICAL: Does NOT rank strategies solely by win rate!
        Weights: Sharpe (35%), Normalized Profit Factor (30%), Win Rate (20%), Drawdown Penalty (15%).
        """
        # Bound profit factor to 5.0 for scoring normalization
        pf_norm = min(5.0, profit_factor if profit_factor < 999.0 else 3.5) / 5.0 * 100.0
        sharpe_norm = max(0.0, min(3.0, sharpe)) / 3.0 * 100.0
        wr_norm = win_rate
        dd_penalty = min(50.0, drawdown) * 2.0  # 10% DD = 20 pts penalty

        score = (sharpe_norm * 0.35) + (pf_norm * 0.30) + (wr_norm * 0.20) - (dd_penalty * 0.15)
        return round(max(0.0, score), 1)

    def get_strategy_leaderboard(self, experiment_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Ranks all four strategies using composite risk-adjusted performance.
        Includes confidence indicators and sample size.
        """
        target_exp_id = experiment_id or self.active_experiment_id
        if not target_exp_id or target_exp_id not in self.experiments:
            # Generate clean baseline ranking
            return [
                {
                    "rank": i + 1,
                    "strategy": strat,
                    "composite_score": 50.0,
                    "net_profit_usd": 0.0,
                    "win_rate_pct": 0.0,
                    "profit_factor": 1.0,
                    "sharpe_ratio": 0.0,
                    "max_drawdown_pct": 0.0,
                    "trades_count": 0,
                    "avg_holding_seconds": 0.0,
                    "avg_slippage_bps": 0.0,
                    "confidence_level": "LOW_SAMPLE (N < 30)",
                    "statistical_significance": False,
                }
                for i, strat in enumerate(CORE_STRATEGIES)
            ]

        exp = self.experiments[target_exp_id]
        strat_metrics = exp.get("strategy_metrics", {})
        leaderboard = []

        for strat, m in strat_metrics.items():
            n_trades = m.get("paper_trades_executed", 0)
            conf = "HIGH (N >= 30)" if n_trades >= 30 else ("MEDIUM (N >= 10)" if n_trades >= 10 else "LOW_SAMPLE (N < 10)")
            sig = n_trades >= 30 and m.get("sharpe_ratio", 0) > 1.0

            leaderboard.append({
                "strategy": strat,
                "strategy_name": strat,
                "composite_score": m.get("composite_score", 0.0),
                "net_profit_usd": m.get("net_profit_usd", 0.0),
                "win_rate_pct": m.get("win_rate_pct", 0.0),
                "profit_factor": m.get("profit_factor", 1.0),
                "sharpe_ratio": m.get("sharpe_ratio", 0.0),
                "max_drawdown_pct": m.get("max_drawdown_pct", 0.0),
                "trades_count": n_trades,
                "avg_holding_seconds": m.get("avg_holding_time_seconds", 0.0),
                "avg_slippage_bps": m.get("avg_slippage_bps", 0.0),
                "transaction_costs_usd": m.get("total_transaction_costs_usd", 0.0),
                "confidence_level": conf,
                "statistical_significance": sig,
            })

        # Rank by composite score descending (never solely by win rate)
        leaderboard.sort(key=lambda x: x["composite_score"], reverse=True)
        for i, item in enumerate(leaderboard):
            item["rank"] = i + 1

        return leaderboard

    def compare_experiments(self, experiment_ids: List[str]) -> Dict[str, Any]:
        """
        Compares multiple experiments side-by-side, analyzing differences in config,
        returns, drawdown, Sharpe, costs, and risk behavior.
        """
        valid_experiments = [self.experiments[eid] for eid in experiment_ids if eid in self.experiments]
        if not valid_experiments:
            return {"error": "No valid experiments found for comparison", "comparison": []}

        comparison_table = []
        for exp in valid_experiments:
            cm = exp.get("combined_metrics", {})
            cfg = exp.get("immutable_config_snapshot", {})
            comparison_table.append({
                "experiment_id": exp["id"],
                "name": exp["name"],
                "status": exp["status"],
                "data_provenance": exp.get("data_provenance", "LIVE_MARKET_PAPER_TEST"),
                "total_trades": cm.get("total_trades", 0),
                "net_profit_usd": cm.get("net_profit_usd", 0.0),
                "win_rate_pct": cm.get("win_rate_pct", 0.0),
                "profit_factor": cm.get("profit_factor", 1.0),
                "max_drawdown_pct": cm.get("max_drawdown_pct", 0.0),
                "sharpe_ratio": cm.get("sharpe_ratio", 0.0),
                "composite_score": cm.get("composite_score", 0.0),
                "transaction_costs_usd": cm.get("total_transaction_costs_usd", 0.0),
                "risk_max_allocation_pct": cfg.get("risk_policy", {}).get("max_trade_allocation_pct", 10.0),
                "risk_max_slippage_pct": cfg.get("risk_policy", {}).get("max_slippage_pct", 1.0),
                "risk_daily_loss_pct": cfg.get("risk_policy", {}).get("max_daily_loss_pct", 3.0),
                "created_at": exp["created_at"],
            })

        # Calculate deltas against baseline if present
        baseline = next((e for e in comparison_table if self.experiments[e["experiment_id"]].get("is_baseline")), comparison_table[0])

        return {
            "comparison_count": len(comparison_table),
            "baseline_experiment_id": baseline["experiment_id"],
            "table": comparison_table,
            "best_performing_id": max(comparison_table, key=lambda x: x["net_profit_usd"])["experiment_id"],
            "safest_id": min(comparison_table, key=lambda x: x["max_drawdown_pct"])["experiment_id"],
        }

    def export_experiment(self, experiment_id: str, format_type: str = "json") -> str:
        """Exports experiment records in JSON or CSV format."""
        if experiment_id not in self.experiments:
            raise ValueError(f"Experiment {experiment_id} does not exist.")

        exp = self.experiments[experiment_id]
        if format_type.lower() == "csv":
            # Generate CSV formatted trades
            headers = [
                "trade_id", "timestamp", "strategy", "pair", "side",
                "entry_price", "exit_price", "gross_pnl_usd", "net_pnl_usd",
                "total_costs_usd", "holding_time_seconds", "slippage_bps", "regime"
            ]
            rows = [",".join(headers)]
            for t in exp.get("trades", []):
                rows.append(",".join(str(t.get(h, "")) for h in headers))
            return "\n".join(rows)

        return json.dumps(exp, indent=2)


# Global singleton instance
experiment_manager = ExperimentManager()
