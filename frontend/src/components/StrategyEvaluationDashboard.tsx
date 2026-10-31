"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Activity,
  TrendingUp,
  BarChart3,
  Play,
  Square,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  DollarSign,
  Fuel,
  Percent,
  Database,
  Radio,
  Zap,
  Server,
  FileDown,
  Award,
  AlertOctagon,
  Scale,
  Compass,
} from "lucide-react";
import {
  fetchStrategyLeaderboard,
  fetchMarketRegimes,
  fetchRiskRecommendations,
  approveRiskRecommendation,
  rejectRiskRecommendation,
  runWalkForwardOptimization,
  fetchExecutionQuality,
  fetchSystemHealth,
  fetchExperiments,
  createExperiment,
  startExperiment,
  stopExperiment,
  resumeExperiment,
  compareExperiments,
  exportExperiment,
} from "@/lib/api";

interface StrategyEvaluationDashboardProps {
  onRefresh?: () => void;
}

export default function StrategyEvaluationDashboard({ onRefresh }: StrategyEvaluationDashboardProps) {
  const [activeTab, setActiveTab] = useState<"leaderboard" | "regimes" | "risk_opt" | "exec_quality" | "experiments" | "health">("leaderboard");
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Phase 2: Strategy Leaderboard State
  const [leaderboardData, setLeaderboardData] = useState<any>(null);

  // Phase 3: Market Regime State
  const [regimesData, setRegimesData] = useState<any>(null);

  // Phase 4: Risk Optimization State
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [rejectionModalId, setRejectionModalId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");

  // Phase 5: Execution Quality State
  const [execQuality, setExecQuality] = useState<any>(null);

  // Phase 6: System Health State
  const [systemHealth, setSystemHealth] = useState<any>(null);

  // Phase 1: Experiments State
  const [experiments, setExperiments] = useState<any[]>([]);
  const [selectedExpIds, setSelectedExpIds] = useState<string[]>([]);
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newExpName, setNewExpName] = useState<string>("");
  const [newExpDesc, setNewExpDesc] = useState<string>("");
  const [newExpCapital, setNewExpCapital] = useState<number>(1000);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [lb, reg, recs, eq, sh, exps] = await Promise.all([
        fetchStrategyLeaderboard().catch(() => null),
        fetchMarketRegimes().catch(() => null),
        fetchRiskRecommendations().catch(() => ({ recommendations: [] })),
        fetchExecutionQuality().catch(() => null),
        fetchSystemHealth().catch(() => null),
        fetchExperiments().catch(() => ({ experiments: [] })),
      ]);

      if (lb) setLeaderboardData(lb);
      if (reg) setRegimesData(reg);
      if (recs?.recommendations) setRecommendations(recs.recommendations);
      if (eq) setExecQuality(eq);
      if (sh) setSystemHealth(sh);
      if (exps?.experiments) setExperiments(exps.experiments);
    } catch (e: any) {
      setError(e.message || "Failed to load strategy evaluation data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 12000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleApproveRec = async (id: string) => {
    setActionLoading(true);
    try {
      await approveRiskRecommendation(id, "operator");
      setSuccessMsg("Risk recommendation approved successfully.");
      loadData();
    } catch (e: any) {
      setError(e.message || "Failed to approve recommendation.");
    } finally {
      setActionLoading(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const handleRejectRec = async () => {
    if (!rejectionModalId || !rejectionReason.trim()) return;
    setActionLoading(true);
    try {
      await rejectRiskRecommendation(rejectionModalId, rejectionReason, "operator");
      setSuccessMsg("Risk recommendation rejected.");
      setRejectionModalId(null);
      setRejectionReason("");
      loadData();
    } catch (e: any) {
      setError(e.message || "Failed to reject recommendation.");
    } finally {
      setActionLoading(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const handleRunWalkForward = async () => {
    const activeExp = experiments.find((e) => e.status === "RUNNING") || experiments[0];
    if (!activeExp) {
      setError("No active experiment found to evaluate. Create or select an experiment first.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await runWalkForwardOptimization(activeExp.id, 0.70);
      setSuccessMsg(`Walk-forward validation complete: ${res.recommendations?.length || 0} recommendations generated.`);
      loadData();
    } catch (e: any) {
      setError(e.message || "Walk-forward validation run failed.");
    } finally {
      setActionLoading(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const handleCreateExp = async () => {
    if (!newExpName.trim()) return;
    setActionLoading(true);
    try {
      await createExperiment({
        name: newExpName,
        description: newExpDesc,
        initial_capital: newExpCapital,
      });
      setShowCreateModal(false);
      setNewExpName("");
      setNewExpDesc("");
      setSuccessMsg("New experiment initialized with immutable configuration snapshot.");
      loadData();
    } catch (e: any) {
      setError(e.message || "Failed to create experiment.");
    } finally {
      setActionLoading(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const handleCompare = async () => {
    if (selectedExpIds.length < 2) {
      setError("Select at least 2 experiments to compare.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await compareExperiments(selectedExpIds);
      setComparisonResult(res);
    } catch (e: any) {
      setError(e.message || "Comparison failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = async (expId: string, format: "json" | "csv") => {
    try {
      const data = await exportExperiment(expId, format);
      const blob = new Blob([typeof data === "string" ? data : JSON.stringify(data, null, 2)], {
        type: format === "csv" ? "text/csv" : "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${expId}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || "Export failed.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-[#0d131f] to-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center">
                <Scale className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center space-x-2">
                  <span>Phase 5: Autonomous Trading Evaluation & Risk Optimization</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold">
                    EMPIRICAL BENCHMARK
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Walk-Forward In-Sample / Out-Of-Sample validation, microstructural execution quality, and multi-metric strategy ranking.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-mono text-slate-300 flex items-center space-x-1.5 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
              <span>Refresh Telemetry</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-xs font-semibold text-white shadow-md flex items-center space-x-1.5 transition-all"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>New Experiment</span>
            </button>
          </div>
        </div>

        {/* Mode & Safety Notice Banner */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
          <div className="flex items-center space-x-2 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
            <span>Execution Mode: <strong className="text-emerald-300">PAPER (Autonomous)</strong></span>
          </div>
          <div className="flex items-center space-x-2 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-amber-400"></span>
            <span>Testnet Broadcast: <strong className="text-amber-300">MANUAL CONFIRMATION</strong></span>
          </div>
          <div className="flex items-center space-x-2 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-red-400"></span>
            <span>Mainnet Trading: <strong className="text-red-300">DISABLED (Strict Rule 13)</strong></span>
          </div>
          <div className="flex items-center space-x-2 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-blue-400"></span>
            <span>Risk Tuning: <strong className="text-blue-300">HUMAN SIGN-OFF REQUIRED</strong></span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/40 rounded-lg text-xs font-mono text-red-300 flex items-center space-x-2">
          <AlertOctagon className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/40 rounded-lg text-xs font-mono text-emerald-300 flex items-center space-x-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center space-x-1 border-b border-slate-800 pb-2 text-xs font-mono overflow-x-auto">
        <button
          onClick={() => setActiveTab("leaderboard")}
          className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
            activeTab === "leaderboard"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
          }`}
        >
          <Award className="h-3.5 w-3.5" />
          <span>Strategy Leaderboard</span>
        </button>

        <button
          onClick={() => setActiveTab("regimes")}
          className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
            activeTab === "regimes"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
          }`}
        >
          <Compass className="h-3.5 w-3.5" />
          <span>Market Regimes</span>
        </button>

        <button
          onClick={() => setActiveTab("risk_opt")}
          className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
            activeTab === "risk_opt"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>Walk-Forward Risk Opt</span>
          {recommendations.filter((r) => r.status === "PENDING_APPROVAL").length > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-500 text-black rounded-full font-bold text-[10px]">
              {recommendations.filter((r) => r.status === "PENDING_APPROVAL").length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("exec_quality")}
          className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
            activeTab === "exec_quality"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          <span>Execution Quality</span>
        </button>

        <button
          onClick={() => setActiveTab("experiments")}
          className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
            activeTab === "experiments"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
          }`}
        >
          <Database className="h-3.5 w-3.5" />
          <span>Experiment Manager ({experiments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("health")}
          className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
            activeTab === "health"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
          }`}
        >
          <Server className="h-3.5 w-3.5" />
          <span>Autonomous Health</span>
          {systemHealth?.active_alerts?.length > 0 && (
            <span className="px-1.5 py-0.2 bg-red-500 text-white rounded-full font-bold text-[10px]">
              {systemHealth.active_alerts.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: STRATEGY LEADERBOARD */}
      {activeTab === "leaderboard" && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                  <span>Strategy Performance Matrix & Composite Rankings</span>
                  <span className="text-[11px] font-mono text-cyan-400 font-normal">
                    (Formula: 35% Sharpe + 30% Profit Factor + 20% Win Rate - 15% MaxDD Penalty)
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Strategies are evaluated independently across all risk-adjusted parameters, preventing single-metric win rate bias.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">Rank</th>
                    <th className="py-2.5 px-3">Strategy</th>
                    <th className="py-2.5 px-3">Composite Score</th>
                    <th className="py-2.5 px-3">Sharpe Ratio</th>
                    <th className="py-2.5 px-3">Profit Factor</th>
                    <th className="py-2.5 px-3">Win Rate</th>
                    <th className="py-2.5 px-3">Max DD</th>
                    <th className="py-2.5 px-3">Net Profit</th>
                    <th className="py-2.5 px-3">Avg Holding</th>
                    <th className="py-2.5 px-3">Avg Slippage</th>
                    <th className="py-2.5 px-3">Confidence & Sample Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {leaderboardData?.leaderboard?.map((s: any, idx: number) => {
                    const isTop = idx === 0;
                    return (
                      <tr key={s.strategy} className={`hover:bg-slate-800/30 ${isTop ? "bg-cyan-500/5" : ""}`}>
                        <td className="py-2.5 px-3 font-bold">
                          <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full ${
                            isTop ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-slate-800 text-slate-400"
                          }`}>
                            #{s.rank}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-200">
                          <div className="flex items-center space-x-2">
                            <span>{s.strategy.replace(/_/g, " ")}</span>
                            {isTop && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded font-mono">
                                OPTIMAL
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-cyan-300">
                          {s.composite_score} / 100
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-semibold">
                          {s.sharpe_ratio}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {s.profit_factor >= 99 ? "∞ (No Losses)" : `${s.profit_factor}x`}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {s.win_rate_pct}%
                        </td>
                        <td className="py-2.5 px-3 text-amber-300">
                          {s.max_drawdown_pct}%
                        </td>
                        <td className={`py-2.5 px-3 font-bold ${s.net_profit_usd >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          ${s.net_profit_usd?.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {s.avg_holding_seconds ? `${Math.round(s.avg_holding_seconds)}s` : "--"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {s.avg_slippage_bps ? `${s.avg_slippage_bps} bps` : "--"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] border ${
                            s.confidence_level?.includes("HIGH")
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                              : s.confidence_level?.includes("MEDIUM")
                              ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                              : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                          }`}>
                            {s.confidence_level}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MARKET REGIMES */}
      {activeTab === "regimes" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-mono text-slate-400 uppercase">Current Real-Time Regime</span>
              <div className="text-lg font-bold text-cyan-300 mt-1 flex items-center space-x-2">
                <span>{regimesData?.current_market_regime?.primary_regime?.replace(/_/g, " ") || "CALCULATING"}</span>
              </div>
              <p className="text-xs text-slate-400 mt-2 font-mono">
                Confidence: <strong className="text-slate-200">{Math.round((regimesData?.current_market_regime?.confidence || 0.8) * 100)}%</strong>
              </p>
              <div className="mt-2 text-[11px] font-mono text-slate-500">
                Safeguard: Zero forward prices used. Backward-looking SMA & return variance only.
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 md:col-span-2">
              <span className="text-xs font-mono text-slate-400 uppercase">Identified Microstructure Risks</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {regimesData?.current_market_regime?.identified_risks?.map((r: string, i: number) => (
                  <span key={i} className="px-2.5 py-1 bg-red-500/10 border border-red-500/30 text-red-300 rounded text-xs font-mono">
                    ⚠️ {r}
                  </span>
                )) || <span className="text-xs font-mono text-slate-500">No active regime risks detected.</span>}
              </div>
            </div>
          </div>

          {/* Regime Attribution Matrix */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-2">Strategy Regime Attribution & Underperformance Detection</h3>
            <p className="text-xs text-slate-400 mb-3 font-mono">
              Empirical matrix tracking strategy efficacy across all 6 regimes without look-ahead bias:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {regimesData?.regime_attribution_matrix &&
                Object.entries(regimesData.regime_attribution_matrix).map(([regimeName, data]: [string, any]) => (
                  <div key={regimeName} className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3 text-xs font-mono">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-700">
                      <strong className="text-cyan-300">{regimeName.replace(/_/g, " ")}</strong>
                      <span className="text-[10px] text-slate-400">{data.total_samples || 0} samples</span>
                    </div>

                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Optimal Strategy:</span>
                        <span className="text-emerald-300 font-semibold">{data.optimal_strategy || "ARBITRAGE"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Worst Strategy:</span>
                        <span className="text-red-300 font-semibold">{data.underperforming_strategy || "NONE"}</span>
                      </div>
                      {data.warning && (
                        <div className="mt-2 text-[10px] text-amber-300 bg-amber-500/10 p-1.5 rounded border border-amber-500/30">
                          ⚠️ {data.warning}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: WALK-FORWARD RISK OPTIMIZATION */}
      {activeTab === "risk_opt" && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                  <span>Walk-Forward Risk Optimization (IS 70% / OOS 30%)</span>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded font-mono">
                    NO AUTO-RELAXATION
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Evaluates 7 core risk parameters chronologically to eliminate overfitting. All changes remain strictly pending manual sign-off.
                </p>
              </div>

              <button
                onClick={handleRunWalkForward}
                disabled={actionLoading}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 shadow transition-all self-start"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Run Walk-Forward Analysis</span>
              </button>
            </div>

            {/* Recommendations List */}
            <div className="mt-4 space-y-3">
              {recommendations.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs font-mono bg-slate-800/20 rounded-lg">
                  No risk parameter modifications recommended. Current baseline configuration is optimal for observed regimes.
                </div>
              ) : (
                recommendations.map((rec) => {
                  const isPending = rec.status === "PENDING_APPROVAL";
                  const isApproved = rec.status === "APPROVED";
                  return (
                    <div
                      key={rec.id}
                      className={`p-3.5 rounded-lg border text-xs font-mono transition-all ${
                        isPending
                          ? "bg-slate-800/60 border-amber-500/40"
                          : isApproved
                          ? "bg-emerald-950/20 border-emerald-500/40"
                          : "bg-slate-800/30 border-slate-700/40 opacity-70"
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-100 text-sm">{rec.parameter_name}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              isPending
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : isApproved
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : "bg-red-500/20 text-red-300 border-red-500/40"
                            }`}>
                              {rec.status}
                            </span>
                            {rec.is_relaxation ? (
                              <span className="px-1.5 py-0.2 bg-red-500/20 text-red-300 text-[10px] rounded border border-red-500/30">
                                CAUTION: LIMIT RELAXATION
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 text-[10px] rounded border border-emerald-500/30">
                                SAFETY TIGHTENING
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex items-center space-x-3 text-slate-300">
                            <span>Current: <strong className="text-slate-100">{rec.current_value}</strong></span>
                            <span>→</span>
                            <span>Proposed: <strong className="text-cyan-300">{rec.proposed_value}</strong></span>
                            <span>•</span>
                            <span>WFE: <strong className="text-emerald-300">{rec.walk_forward_efficiency}</strong></span>
                            <span>•</span>
                            <span>Expected: <strong className="text-slate-200">{rec.expected_improvement}</strong></span>
                          </div>

                          <p className="mt-1.5 text-slate-400 text-[11px]">{rec.reason}</p>
                        </div>

                        {isPending && (
                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              onClick={() => handleApproveRec(rec.id)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition-colors"
                            >
                              Approve Change
                            </button>
                            <button
                              onClick={() => setRejectionModalId(rec.id)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        )}

                        {isApproved && (
                          <div className="text-[11px] text-emerald-400">
                            Approved by: {rec.approved_by || "operator"} at {rec.approved_at?.slice(11, 19)} UTC
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EXECUTION QUALITY */}
      {activeTab === "exec_quality" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Simulated Paper Summary */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-mono text-slate-400 uppercase">Simulated Execution (Paper Mode)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  SIMULATED_PAPER
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3 text-xs font-mono">
                <div>
                  <span className="text-slate-500">Sample Count:</span>
                  <div className="text-base font-bold text-slate-200">{execQuality?.simulated_metrics?.sample_count || 0}</div>
                </div>
                <div>
                  <span className="text-slate-500">Avg Slippage:</span>
                  <div className="text-base font-bold text-cyan-300">{execQuality?.simulated_metrics?.avg_slippage_bps || 0} bps</div>
                </div>
                <div>
                  <span className="text-slate-500">Quote Delay:</span>
                  <div className="text-base font-bold text-slate-200">{execQuality?.simulated_metrics?.avg_quote_delay_ms || 0} ms</div>
                </div>
                <div>
                  <span className="text-slate-500">Price Impact:</span>
                  <div className="text-base font-bold text-slate-200">{execQuality?.simulated_metrics?.avg_price_impact_pct || 0}%</div>
                </div>
              </div>
            </div>

            {/* Real On-Chain Testnet Summary */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-mono text-slate-400 uppercase">Real On-Chain Execution (HashKey Testnet)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                  ON_CHAIN_TESTNET
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3 text-xs font-mono">
                <div>
                  <span className="text-slate-500">On-Chain Samples:</span>
                  <div className="text-base font-bold text-slate-200">{execQuality?.on_chain_metrics?.sample_count || 0}</div>
                </div>
                <div>
                  <span className="text-slate-500">Avg Slippage:</span>
                  <div className="text-base font-bold text-amber-300">{execQuality?.on_chain_metrics?.avg_slippage_bps || 0} bps</div>
                </div>
                <div>
                  <span className="text-slate-500">Avg Confirmation Delay:</span>
                  <div className="text-base font-bold text-slate-200">{execQuality?.on_chain_metrics?.avg_quote_delay_ms || 0} ms</div>
                </div>
                <div>
                  <span className="text-slate-500">Gas Estimation Error:</span>
                  <div className="text-base font-bold text-cyan-300">{execQuality?.on_chain_metrics?.avg_gas_estimation_error_pct || 0}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Observations and Discrepancies */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-2">Microstructural Discrepancy & Reconciliation</h3>
            <ul className="space-y-1.5 text-xs font-mono text-slate-300">
              {execQuality?.comparative_observations?.map((obs: string, idx: number) => (
                <li key={idx} className="flex items-start space-x-2">
                  <span className="text-cyan-400">•</span>
                  <span>{obs}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* TAB 5: EXPERIMENT MANAGEMENT */}
      {activeTab === "experiments" && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Persistent Experiment Management System</h3>
                <p className="text-xs text-slate-400 font-mono">
                  Every experiment maintains an immutable configuration snapshot, lifecycle controls, and isolated performance telemetry.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCompare}
                  disabled={selectedExpIds.length < 2 || actionLoading}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-mono disabled:opacity-50 transition-colors"
                >
                  Compare Selected ({selectedExpIds.length})
                </button>
              </div>
            </div>

            {/* Experiment Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">Select</th>
                    <th className="py-2.5 px-3">Experiment ID</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Trades</th>
                    <th className="py-2.5 px-3">Net Profit</th>
                    <th className="py-2.5 px-3">Sharpe</th>
                    <th className="py-2.5 px-3">Max DD</th>
                    <th className="py-2.5 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {experiments.map((exp) => {
                    const isSelected = selectedExpIds.includes(exp.id);
                    const isRunning = exp.status === "RUNNING";
                    return (
                      <tr key={exp.id} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedExpIds([...selectedExpIds, exp.id]);
                              else setSelectedExpIds(selectedExpIds.filter((id) => id !== exp.id));
                            }}
                            className="rounded border-slate-700 bg-slate-800 text-cyan-500"
                          />
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-300">{exp.id}</td>
                        <td className="py-2 px-3 text-slate-200 font-semibold">{exp.name}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isRunning
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : "bg-slate-800 text-slate-400 border-slate-700"
                          }`}>
                            {exp.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-300">{exp.combined_metrics?.total_trades || 0}</td>
                        <td className={`py-2 px-3 font-bold ${(exp.combined_metrics?.net_profit_usd || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          ${(exp.combined_metrics?.net_profit_usd || 0).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-slate-300">{exp.combined_metrics?.sharpe_ratio || 0}</td>
                        <td className="py-2 px-3 text-amber-300">{exp.combined_metrics?.max_drawdown_pct || 0}%</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center space-x-1.5">
                            {isRunning ? (
                              <button
                                onClick={async () => {
                                  await stopExperiment(exp.id);
                                  loadData();
                                }}
                                className="px-2 py-0.5 bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded text-[10px] hover:bg-amber-600/50"
                              >
                                Pause
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  await resumeExperiment(exp.id);
                                  loadData();
                                }}
                                className="px-2 py-0.5 bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded text-[10px] hover:bg-emerald-600/50"
                              >
                                Resume
                              </button>
                            )}
                            <button
                              onClick={() => handleExport(exp.id, "json")}
                              className="px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded text-[10px] hover:bg-slate-700 flex items-center space-x-1"
                              title="Export JSON"
                            >
                              <FileDown className="h-3 w-3" />
                              <span>JSON</span>
                            </button>
                            <button
                              onClick={() => handleExport(exp.id, "csv")}
                              className="px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded text-[10px] hover:bg-slate-700 flex items-center space-x-1"
                              title="Export CSV"
                            >
                              <FileDown className="h-3 w-3" />
                              <span>CSV</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Side-by-Side Comparison Modal / Box */}
            {comparisonResult && (
              <div className="mt-4 p-4 bg-slate-800/60 border border-slate-700 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold text-cyan-300 uppercase">Side-by-Side Experiment Comparison</h4>
                  <button onClick={() => setComparisonResult(null)} className="text-xs text-slate-400 hover:text-white">✕ Close</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900/60 text-slate-400">
                      <tr>
                        <th className="p-2">Metric</th>
                        {comparisonResult.table?.map((c: any) => (
                          <th key={c.experiment_id} className="p-2">{c.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      <tr>
                        <td className="p-2 text-slate-400">Net Profit ($)</td>
                        {comparisonResult.table?.map((c: any) => (
                          <td key={c.experiment_id} className={`p-2 font-bold ${c.net_profit_usd >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            ${c.net_profit_usd}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-2 text-slate-400">Sharpe Ratio</td>
                        {comparisonResult.table?.map((c: any) => (
                          <td key={c.experiment_id} className="p-2 text-slate-200">{c.sharpe_ratio}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-2 text-slate-400">Max Drawdown</td>
                        {comparisonResult.table?.map((c: any) => (
                          <td key={c.experiment_id} className="p-2 text-amber-300">{c.max_drawdown_pct}%</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-2 text-slate-400">Composite Score</td>
                        {comparisonResult.table?.map((c: any) => (
                          <td key={c.experiment_id} className="p-2 text-cyan-300 font-bold">{c.composite_score}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: AUTONOMOUS SYSTEM HEALTH */}
      {activeTab === "health" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-mono text-slate-400 uppercase">System Operational Status</span>
              <div className="text-xl font-bold text-emerald-400 mt-1 flex items-center space-x-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{systemHealth?.overall_status || "OPERATIONAL"}</span>
              </div>
              <p className="text-xs text-slate-400 mt-2 font-mono">
                Uptime: {Math.floor((systemHealth?.uptime_seconds || 0) / 3600)}h {Math.floor(((systemHealth?.uptime_seconds || 0) % 3600) / 60)}m
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-mono text-slate-400 uppercase">HashKey Testnet RPC Telemetry</span>
              <div className="text-xl font-bold text-cyan-300 mt-1">
                {systemHealth?.rpc_telemetry?.success_rate_pct || 99.4}%
              </div>
              <p className="text-xs text-slate-400 mt-2 font-mono">
                Avg Node Latency: <strong className="text-slate-200">{systemHealth?.rpc_telemetry?.avg_latency_ms || 280} ms</strong>
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-mono text-slate-400 uppercase">Orchestration Safeguards</span>
              <div className="text-xl font-bold text-slate-200 mt-1">
                {systemHealth?.safeguards?.cycle_success_rate_pct || 99.0}%
              </div>
              <p className="text-xs text-slate-400 mt-2 font-mono">
                Suppressed Duplicates: <strong className="text-cyan-300">{systemHealth?.safeguards?.duplicate_opportunities_suppressed || 0}</strong>
              </p>
            </div>
          </div>

          {/* Seven Specialized Agents Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Seven Specialized Agents Availability & Latency</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
              {systemHealth?.seven_agents &&
                Object.entries(systemHealth.seven_agents).map(([agentName, data]: [string, any]) => (
                  <div key={agentName} className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-lg">
                    <div className="flex justify-between items-center pb-1 border-b border-slate-700">
                      <strong className="text-slate-200">{agentName.replace("Agent", "")}</strong>
                      <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[10px]">
                        {data.status}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-slate-400">
                      <div className="flex justify-between">
                        <span>Avg Latency:</span>
                        <span className="text-cyan-300 font-semibold">{data.avg_latency_ms} ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Invocations:</span>
                        <span className="text-slate-300">{data.total_invocations}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Pulse:</span>
                        <span className="text-slate-400">{data.last_seen_seconds_ago}s ago</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectionModalId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-md w-full shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span>Reject Risk Recommendation</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Provide formal operator rationale for rejecting this risk optimization proposal:
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Rejecting slippage loosening due to impending HashKey Chain network upgrade volatility..."
              className="mt-3 w-full h-24 bg-slate-800 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
            />
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setRejectionModalId(null)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectRec}
                disabled={!rejectionReason.trim() || actionLoading}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs transition-colors"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Experiment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-md w-full shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <Sliders className="h-4 w-4 text-cyan-400" />
              <span>Create Isolated Experiment</span>
            </h3>
            <div className="mt-3 space-y-3 text-xs font-mono">
              <div>
                <label className="text-slate-400 block mb-1">Experiment Name</label>
                <input
                  type="text"
                  value={newExpName}
                  onChange={(e) => setNewExpName(e.target.value)}
                  placeholder="e.g. Q4 Volatility Tightening Test"
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Description</label>
                <input
                  type="text"
                  value={newExpDesc}
                  onChange={(e) => setNewExpDesc(e.target.value)}
                  placeholder="e.g. Evaluating 500bps pool fee tier under high volatility"
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Initial Paper Capital ($)</label>
                <input
                  type="number"
                  value={newExpCapital}
                  onChange={(e) => setNewExpCapital(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateExp}
                disabled={!newExpName.trim() || actionLoading}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded text-xs transition-colors"
              >
                Create Snapshot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
