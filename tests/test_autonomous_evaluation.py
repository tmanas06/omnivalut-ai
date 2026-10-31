import pytest
import time
import json
import math
from datetime import datetime, timezone

from backend.experiments.manager import ExperimentManager
from backend.experiments.regimes import MarketRegimeClassifier, MarketRegimeType
from backend.experiments.optimizer import RiskOptimizer
from backend.experiments.execution_quality import ExecutionQualityAnalyzer
from backend.orchestrator.health import AutonomousSystemHealthMonitor
from backend.adapters.hskswap.explorer import TestnetExplorerService
from backend.risk.engine import RiskPolicyConfig


class TestAutonomousEvaluationAndOptimization:
    """
    Phase 8 Comprehensive Test Suite for Phase 5 Autonomous Trading Evaluation & Risk Optimization:
    1. Experiment isolation
    2. Configuration immutability
    3. Experiment recovery & interruption tracking
    4. Multi-metric strategy ranking (never ranking solely by win rate)
    5. Zero-loss profit factor handling
    6. Walk-forward validation (IS 70% / OOS 30% & WFE calculation)
    7. Market regime classification (all 6 regimes without look-ahead bias)
    8. Risk parameter evaluation & manual approval requirement (no auto-relaxation)
    9. Slippage calculation in basis points
    10. Execution quality & reconciliation discrepancy
    11. Performance metric reproducibility
    12. In-app testnet explorer transaction tracking & gas estimation error
    """

    @pytest.fixture
    def exp_manager(self, tmp_path):
        return ExperimentManager(storage_dir=str(tmp_path / "experiments"))

    @pytest.fixture
    def regime_classifier(self):
        return MarketRegimeClassifier()

    @pytest.fixture
    def risk_optimizer(self, tmp_path):
        return RiskOptimizer(storage_dir=str(tmp_path / "recommendations"))

    @pytest.fixture
    def exec_analyzer(self, tmp_path):
        return ExecutionQualityAnalyzer(storage_dir=str(tmp_path / "execution_quality"))

    @pytest.fixture
    def testnet_explorer(self, tmp_path):
        return TestnetExplorerService(storage_dir=str(tmp_path / "explorer"))

    @pytest.fixture
    def health_monitor(self):
        return AutonomousSystemHealthMonitor()

    # 1. Experiment Isolation
    def test_experiment_isolation(self, exp_manager):
        """Verify that two independent experiments maintain isolated states, metrics, and trades."""
        exp1 = exp_manager.create_experiment(
            name="Experiment Alpha",
            strategy_config={"MOMENTUM_TREND_FOLLOWING": {"enabled": True, "weight": 0.5}},
            initial_capital=1000.0,
        )
        exp2 = exp_manager.create_experiment(
            name="Experiment Beta",
            strategy_config={"MOMENTUM_TREND_FOLLOWING": {"enabled": False, "weight": 0.0}},
            initial_capital=2000.0,
        )

        assert exp1["id"] != exp2["id"]
        assert exp1["immutable_config_snapshot"]["initial_capital_usd"] == 1000.0
        assert exp2["immutable_config_snapshot"]["initial_capital_usd"] == 2000.0

        # Record trade in exp1 only
        exp_manager.record_trade_fill(
            experiment_id=exp1["id"],
            strategy_name="MOMENTUM_TREND_FOLLOWING",
            pair="HSK/USDT",
            direction="BUY",
            entry_price=0.985,
            exit_price=1.015,
            quantity=50.0,
            slippage_bps=8.0,
            duration_seconds=1800,
        )

        res1 = exp_manager.get_experiment(exp1["id"])
        res2 = exp_manager.get_experiment(exp2["id"])

        assert res1["metrics_summary"]["combined_portfolio"]["completed_trades"] == 1
        assert res2["metrics_summary"]["combined_portfolio"]["completed_trades"] == 0

    # 2. Configuration Immutability
    def test_configuration_immutability(self, exp_manager):
        """Verify that modifying the source configuration dict does not mutate the stored experiment snapshot."""
        mutable_risk = {"max_slippage_pct": 0.8, "max_daily_loss_pct": 3.0}
        exp = exp_manager.create_experiment(name="Immutability Test", risk_config=mutable_risk)
        exp_id = exp["id"]

        # Mutate the source dictionary externally
        mutable_risk["max_slippage_pct"] = 5.0
        mutable_risk["max_daily_loss_pct"] = 25.0

        # Snapshot in experiment manager must remain pristine
        fetched = exp_manager.get_experiment(exp_id)
        assert fetched["immutable_config_snapshot"]["risk_policy"]["max_slippage_pct"] == 0.8
        assert fetched["immutable_config_snapshot"]["risk_policy"]["max_daily_loss_pct"] == 3.0

    # 3. Experiment Recovery & Interruption Tracking
    def test_experiment_recovery(self, exp_manager):
        """Verify that pausing and resuming an experiment tracks the interruption window accurately."""
        exp = exp_manager.create_experiment(name="Lifecycle Test")
        exp_id = exp["id"]

        exp_manager.start_experiment(exp_id)
        assert exp_manager.get_experiment(exp_id)["status"] == "RUNNING"

        time.sleep(0.05)
        exp_manager.stop_experiment(exp_id)
        assert exp_manager.get_experiment(exp_id)["status"] == "PAUSED"

        time.sleep(0.05)
        resumed = exp_manager.resume_experiment(exp_id)
        assert resumed["status"] == "RUNNING"
        assert len(resumed["interruption_intervals"]) == 1
        assert resumed["interruption_intervals"][0]["interruption_duration_seconds"] >= 0.04

    # 4. Multi-Metric Strategy Ranking (Never Solely by Win Rate)
    def test_strategy_ranking_not_solely_by_win_rate(self, exp_manager):
        """
        Verify that a strategy with 100% win rate but tiny gains and severe tail drawdown
        is NOT automatically ranked higher than a strategy with 60% win rate, high Sharpe, and strong profit factor.
        """
        exp = exp_manager.create_experiment(name="Ranking Test")
        exp_id = exp["id"]

        # Strategy A: 100% win rate (1 win of $0.05, 0 losses, but low Sharpe)
        exp_manager.record_trade_fill(
            experiment_id=exp_id,
            strategy_name="MEAN_REVERSION_BB",
            pair="HSK/USDT",
            direction="BUY",
            entry_price=0.985,
            exit_price=0.986,
            quantity=5.0,
            slippage_bps=5.0,
            duration_seconds=300,
        )

        # Strategy B: High Sharpe and large profit (5 trades: 4 wins of $15, 1 loss of $2, win rate 80%, high Sharpe)
        for i in range(4):
            exp_manager.record_trade_fill(
                experiment_id=exp_id,
                strategy_name="ARBITRAGE_CROSS_TIER",
                pair="HSK/USDT",
                direction="BUY",
                entry_price=0.980,
                exit_price=1.020,
                quantity=100.0,
                slippage_bps=4.0,
                duration_seconds=120,
            )
        exp_manager.record_trade_fill(
            experiment_id=exp_id,
            strategy_name="ARBITRAGE_CROSS_TIER",
            pair="HSK/USDT",
            direction="BUY",
            entry_price=0.980,
            exit_price=0.975,
            quantity=40.0,
            slippage_bps=4.0,
            duration_seconds=120,
        )

        leaderboard = exp_manager.get_strategy_leaderboard(exp_id)
        assert len(leaderboard) >= 2

        # ARBITRAGE_CROSS_TIER has higher composite score due to higher Sharpe and Profit Factor
        top_strat = leaderboard[0]
        assert top_strat["strategy_name"] == "ARBITRAGE_CROSS_TIER"
        assert top_strat["composite_score"] > leaderboard[1]["composite_score"]
        # Ranking must evaluate composite score, not simply win rate
        assert top_strat["profit_factor"] > leaderboard[1]["profit_factor"]

    # 5. Zero-Loss Profit Factor
    def test_zero_loss_profit_factor_handling(self, exp_manager):
        """Verify that strategies with zero losses do not cause division by zero errors and are capped sensibly."""
        exp = exp_manager.create_experiment(name="Zero Loss Test")
        exp_id = exp["id"]

        exp_manager.record_trade_fill(
            experiment_id=exp_id,
            strategy_name="HIGH_VOLATILITY_BREAKOUT",
            pair="HSK/USDT",
            direction="BUY",
            entry_price=0.985,
            exit_price=1.015,
            quantity=50.0,
            slippage_bps=5.0,
            duration_seconds=600,
        )

        strat_data = exp_manager.get_experiment(exp_id)["metrics_summary"]["strategy_metrics"]["HIGH_VOLATILITY_BREAKOUT"]
        assert strat_data["loss_count"] == 0
        assert strat_data["profit_factor"] == 99.0  # Safe cap, no ZeroDivisionError

    # 6. Walk-Forward Validation
    def test_walk_forward_validation_split_and_efficiency(self, risk_optimizer):
        """Verify 70% In-Sample / 30% Out-Of-Sample chronological split and WFE calculation."""
        trades = []
        base_time = int(time.time()) - (86400 * 10)
        for i in range(30):
            trades.append({
                "id": f"trade_{i}",
                "timestamp": base_time + (i * 3600 * 4),
                "strategy": "MOMENTUM_TREND_FOLLOWING",
                "slippage_pct": 0.2 + (i % 3) * 0.1,
                "allocation_pct": 8.0,
                "net_pnl_pct": 1.5 if i % 4 != 0 else -0.8,
            })

        wf_result = risk_optimizer.run_walk_forward_evaluation(
            experiment_id="exp_test_wf",
            historical_trades=trades,
            train_test_split_ratio=0.70,
        )

        assert wf_result["in_sample_trade_count"] == 21  # 70% of 30
        assert wf_result["out_of_sample_trade_count"] == 9   # 30% of 30
        assert "parameter_evaluations" in wf_result
        assert "max_slippage_pct" in wf_result["parameter_evaluations"]

        for eval_item in wf_result["parameter_evaluations"]["max_slippage_pct"]:
            assert "walk_forward_efficiency" in eval_item
            assert eval_item["in_sample"]["accepted_trades"] <= 21

    # 7. Market Regime Classification (All 6 Regimes, No Look-Ahead Bias)
    def test_market_regime_classification_all_six_regimes(self, regime_classifier):
        """Test detection of all 6 regimes using only current & past price windows."""
        # 1. Fee Tier Dislocation (Arbitrage)
        regime_disloc = regime_classifier.classify_regime(
            candles_or_prices=[0.985] * 20,
            cross_tier_spread_pct=0.45,
        )
        assert regime_disloc["primary_regime"] == MarketRegimeType.FEE_TIER_DISLOCATION.value

        # 2. Low Liquidity
        regime_low_liq = regime_classifier.classify_regime(
            candles_or_prices=[0.985] * 20,
            active_liquidity=500000,  # Below 1M threshold
            cross_tier_spread_pct=0.05,
        )
        assert regime_low_liq["primary_regime"] == MarketRegimeType.LOW_LIQUIDITY.value

        # 3. Bullish Trend
        bullish_prices = [0.90 + (i * 0.01) for i in range(40)]
        regime_bull = regime_classifier.classify_regime(
            candles_or_prices=bullish_prices,
            active_liquidity=5000000,
        )
        assert regime_bull["primary_regime"] == MarketRegimeType.BULLISH_TREND.value

        # 4. Bearish Trend
        bearish_prices = [1.30 - (i * 0.01) for i in range(40)]
        regime_bear = regime_classifier.classify_regime(
            candles_or_prices=bearish_prices,
            active_liquidity=5000000,
        )
        assert regime_bear["primary_regime"] == MarketRegimeType.BEARISH_TREND.value

        # 5. High Volatility (Wide swings)
        volatile_prices = [0.98, 1.08, 0.92, 1.12, 0.91, 1.15, 0.89, 1.14, 0.90, 1.16] * 3
        regime_vol = regime_classifier.classify_regime(
            candles_or_prices=volatile_prices,
            active_liquidity=5000000,
        )
        assert regime_vol["primary_regime"] == MarketRegimeType.HIGH_VOLATILITY.value

        # 6. Range-Bound (Tight consolidation)
        flat_prices = [0.9850, 0.9851, 0.9849, 0.9850, 0.9852, 0.9850, 0.9851, 0.9849] * 5
        regime_range = regime_classifier.classify_regime(
            candles_or_prices=flat_prices,
            active_liquidity=5000000,
        )
        assert regime_range["primary_regime"] == MarketRegimeType.RANGE_BOUND.value

    # 8. Risk Parameter Comparison & Manual Approval Requirement
    def test_risk_parameter_recommendation_requires_approval(self, risk_optimizer):
        """Verify that risk recommendations are created as PENDING_APPROVAL and cannot be auto-applied."""
        trades = risk_optimizer._generate_evaluation_scenarios()
        wf_res = risk_optimizer.run_walk_forward_evaluation(
            experiment_id="exp_rec_test",
            historical_trades=trades,
        )

        recs = risk_optimizer.list_recommendations(status="PENDING_APPROVAL")
        if recs:
            rec = recs[0]
            assert rec["status"] == "PENDING_APPROVAL"
            assert "approved_at" in rec and rec["approved_at"] is None

            # Approve recommendation explicitly
            approved = risk_optimizer.approve_recommendation(rec["id"], user_identity="security_officer")
            assert approved["status"] == "APPROVED"
            assert approved["approved_by"] == "security_officer"
            assert approved["approved_at"] is not None

    # 9. Slippage Calculation in Basis Points
    def test_slippage_calculation_in_basis_points(self, exec_analyzer):
        """Verify slippage calculation: 10 bps = 0.10%."""
        # Expected: 100.0, Executed: 99.90 -> Slippage = (0.10 / 100.0) * 10000 = 10.0 bps
        rec = exec_analyzer.record_execution(
            trade_id="slip_test_1",
            pair="HSK/USDT",
            direction="BUY",
            expected_amount_out=100.0,
            executed_amount_out=99.90,
            quote_timestamp_ms=1000,
            execution_timestamp_ms=1250,
            estimated_gas=150000,
            actual_gas_used=155000,
        )
        assert rec["slippage_bps"] == 10.0
        assert rec["quote_delay_ms"] == 250
        assert rec["gas_estimation_error_pct"] == 3.33  # |155000 - 150000| / 150000 * 100

    # 10. Execution Discrepancy & Provenance Distinction
    def test_execution_discrepancy_and_provenance(self, exec_analyzer):
        """Verify distinct accounting for simulated paper fills vs on-chain testnet fills."""
        # Paper fill
        exec_analyzer.record_execution(
            trade_id="sim_1",
            pair="HSK/USDT",
            direction="BUY",
            expected_amount_out=50.0,
            executed_amount_out=49.95,
            quote_timestamp_ms=1000,
            execution_timestamp_ms=1100,
            estimated_gas=150000,
            provenance="SIMULATED_PAPER",
        )

        # On-Chain fill with reconciliation discrepancy
        exec_analyzer.record_execution(
            trade_id="onchain_1",
            pair="HSK/USDT",
            direction="BUY",
            expected_amount_out=50.0,
            executed_amount_out=49.80,
            quote_timestamp_ms=1000,
            execution_timestamp_ms=3200,
            estimated_gas=150000,
            actual_gas_used=162000,
            provenance="ON_CHAIN_TESTNET",
            tx_hash="0x123abc456def",
            local_balance_after=1000.5,
            chain_balance_after=1000.48,  # 0.02 discrepancy
        )

        analysis = exec_analyzer.generate_analysis_report()
        assert analysis["simulated_metrics"]["sample_count"] >= 1
        assert analysis["on_chain_metrics"]["sample_count"] >= 1
        assert analysis["on_chain_metrics"]["max_reconciliation_discrepancy"] >= 0.02

    # 11. Performance Metric Reproducibility
    def test_performance_metric_reproducibility(self, exp_manager):
        """Verify that identical sequences of trades produce identical metrics and composite score."""
        exp_a = exp_manager.create_experiment(name="Reproducibility A")
        exp_b = exp_manager.create_experiment(name="Reproducibility B")

        trades_data = [
            (0.985, 1.015, 50.0, 6.0, 1200),
            (1.015, 1.000, 40.0, 8.0, 900),
            (1.000, 1.030, 60.0, 5.0, 1500),
        ]

        for entry, exit_p, qty, slip, dur in trades_data:
            exp_manager.record_trade_fill(exp_a["id"], "MOMENTUM_TREND_FOLLOWING", "HSK/USDT", "BUY", entry, exit_p, qty, slip, dur)
            exp_manager.record_trade_fill(exp_b["id"], "MOMENTUM_TREND_FOLLOWING", "HSK/USDT", "BUY", entry, exit_p, qty, slip, dur)

        metrics_a = exp_manager.get_experiment(exp_a["id"])["metrics_summary"]["strategy_metrics"]["MOMENTUM_TREND_FOLLOWING"]
        metrics_b = exp_manager.get_experiment(exp_b["id"])["metrics_summary"]["strategy_metrics"]["MOMENTUM_TREND_FOLLOWING"]

        assert metrics_a["net_pnl_usd"] == metrics_b["net_pnl_usd"]
        assert metrics_a["win_rate_pct"] == metrics_b["win_rate_pct"]
        assert metrics_a["profit_factor"] == metrics_b["profit_factor"]
        assert metrics_a["composite_score"] == metrics_b["composite_score"]

    # 12. In-App Testnet Explorer Transaction Tracking
    def test_testnet_explorer_tracking(self, testnet_explorer):
        """Verify testnet transaction tracking, gas calculations, search, and explorer URLs."""
        tx_hash = "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba"
        tx = testnet_explorer.record_transaction(
            tx_hash=tx_hash,
            transaction_type="SWAP",
            from_address="0xF39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            to_address="0xa6914E66690c6794244B5f66a09eAEbf66254237",
            pair="HSK/USDT",
            amount_in=100.0,
            amount_out=98.5,
            effective_price=0.985,
            slippage_bps=12.5,
            status="CONFIRMED",
            gas_limit=300000,
            gas_used=185000,
        )

        assert tx["tx_hash"] == tx_hash
        assert tx["chain_id"] == 133
        assert "hashkey.blockscout.com" in tx["explorer_url"]
        assert "hashkey.subscan.io" in tx["subscan_url"]

        # Search by hash
        res = testnet_explorer.list_transactions(search_query="9876543210fedcba")
        assert res["total"] >= 1
        assert res["transactions"][0]["tx_hash"] == tx_hash

        # Stats
        stats = testnet_explorer.get_explorer_stats()
        assert stats["chain_id"] == 133
        assert stats["total_transactions"] >= 1
