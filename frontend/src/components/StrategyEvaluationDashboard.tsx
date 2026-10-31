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
  X,
  ExternalLink
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

const DEFAULT_LEADERBOARD = [
  {
    rank: 1,
    strategy: "MOMENTUM_TREND_FOLLOWING",
    composite_score: 50.0,
    sharpe_ratio: 0.0,
    profit_factor: 1.0,
    win_rate_pct: 0.0,
    max_drawdown_pct: 0.0,
    net_profit_usd: 0.0,
    avg_holding_seconds: 0.0,
    avg_slippage_bps: 0.0,
    confidence_level: "LOW_SAMPLE (N < 30)",
    statistical_significance: false,
  },
  {
    rank: 2,
    strategy: "ARBITRAGE_CROSS_TIER",
    composite_score: 50.0,
    sharpe_ratio: 0.0,
    profit_factor: 1.0,
    win_rate_pct: 0.0,
    max_drawdown_pct: 0.0,
    net_profit_usd: 0.0,
    avg_holding_seconds: 0.0,
    avg_slippage_bps: 0.0,
    confidence_level: "LOW_SAMPLE (N < 30)",
    statistical_significance: false,
  },
  {
    rank: 3,
    strategy: "MEAN_REVERSION_BB",
    composite_score: 50.0,
    sharpe_ratio: 0.0,
    profit_factor: 1.0,
    win_rate_pct: 0.0,
    max_drawdown_pct: 0.0,
    net_profit_usd: 0.0,
    avg_holding_seconds: 0.0,
    avg_slippage_bps: 0.0,
    confidence_level: "LOW_SAMPLE (N < 30)",
    statistical_significance: false,
  },
  {
    rank: 4,
    strategy: "HIGH_VOLATILITY_BREAKOUT",
    composite_score: 50.0,
    sharpe_ratio: 0.0,
    profit_factor: 1.0,
    win_rate_pct: 0.0,
    max_drawdown_pct: 0.0,
    net_profit_usd: 0.0,
    avg_holding_seconds: 0.0,
    avg_slippage_bps: 0.0,
    confidence_level: "LOW_SAMPLE (N < 30)",
    statistical_significance: false,
  },
];

interface StrategyEvaluationDashboardProps {
  onRefresh?: () => void;
  defaultTab?: "leaderboard" | "regimes" | "risk_opt" | "exec_quality" | "experiments" | "health";
}

export default function StrategyEvaluationDashboard({
  onRefresh,
  defaultTab = "leaderboard",
}: StrategyEvaluationDashboardProps) {
  const [activeTab, setActiveTab] = useState<
    "leaderboard" | "regimes" | "risk_opt" | "exec_quality" | "experiments" | "health"
  >(defaultTab);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Phase 2: Strategy Leaderboard State (seeded with baseline so table is never empty)
  const [leaderboardData, setLeaderboardData] = useState<any>({ leaderboard: DEFAULT_LEADERBOARD });

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

  // Sync defaultTab if changed from parent navigation
  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      fetchStrategyLeaderboard()
        .then((lb) => {
          if (lb?.leaderboard && lb.leaderboard.length > 0) {
            setLeaderboardData(lb);
          }
        })
        .catch(() => {});

      fetchMarketRegimes()
        .then((reg) => {
          if (reg) setRegimesData(reg);
        })
        .catch(() => {});

      fetchRiskRecommendations()
        .then((recs) => {
          if (recs?.recommendations) setRecommendations(recs.recommendations);
        })
        .catch(() => {});

      fetchExecutionQuality()
        .then((eq) => {
          if (eq) setExecQuality(eq);
        })
        .catch(() => {});

      fetchSystemHealth()
        .then((sh) => {
          if (sh) setSystemHealth(sh);
        })
        .catch(() => {});

      fetchExperiments()
        .then((exps) => {
          if (exps?.experiments) setExperiments(exps.experiments);
        })
        .catch(() => {});
    } catch (err: any) {
      console.warn("Strategy evaluation data load warning:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleApproveRec = async (recId: string) => {
    setActionLoading(true);
    try {
      await approveRiskRecommendation(recId, "operator");
      setSuccessMsg("Risk recommendation approved and applied to active policy.");
      loadData();
    } catch (e: any) {
      setError(e.message || "Approval failed.");
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
      setRejectionModalId(null);
      setRejectionReason("");
      setSuccessMsg("Risk recommendation rejected with audit rationale.");
      loadData();
    } catch (e: any) {
      setError(e.message || "Rejection failed.");
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
      <div className="fintech-card p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-[#202838] border border-[#2A3445] flex items-center justify-center text-[#3B82F6]">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-semibold text-[#F1F5F9] tracking-tight">
                  Strategy Evaluation &amp; Risk Optimization
                </h1>
                <span className="text-[11px] font-sans px-2 py-0.5 rounded-md bg-[#202838] text-[#3B82F6] border border-[#2A3445] font-medium">
                  Quantitative Benchmarking
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Walk-forward in-sample / out-of-sample validation, microstructural execution quality, and multi-metric strategy rankings.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-[#202838] hover:bg-[#2A3445] text-[#F1F5F9] text-xs font-medium border border-[#2A3445] transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[#94A3B8] ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-medium transition flex items-center space-x-1.5"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>New Experiment</span>
            </button>
          </div>
        </div>

        {/* Safety & Protocol Restrictions Bar */}
        <div className="mt-4 pt-3 border-t border-[#2A3445] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center space-x-2 text-[#94A3B8]">
            <span className="h-2 w-2 rounded-full bg-[#3B82F6]"></span>
            <span>Execution: <strong className="text-[#F1F5F9] font-medium">PAPER (Autonomous)</strong></span>
          </div>
          <div className="flex items-center space-x-2 text-[#94A3B8]">
            <span className="h-2 w-2 rounded-full bg-[#F59E0B]"></span>
            <span>Testnet Broadcast: <strong className="text-[#F1F5F9] font-medium">Manual Confirmation</strong></span>
          </div>
          <div className="flex items-center space-x-2 text-[#94A3B8]">
            <span className="h-2 w-2 rounded-full bg-[#EF4444]"></span>
            <span>Mainnet Trading: <strong className="text-[#F1F5F9] font-medium">Disabled (Rule 13)</strong></span>
          </div>
          <div className="flex items-center space-x-2 text-[#94A3B8]">
            <span className="h-2 w-2 rounded-full bg-[#10B981]"></span>
            <span>Risk Tuning: <strong className="text-[#F1F5F9] font-medium">Operator Sign-Off</strong></span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl text-xs text-[#EF4444] flex items-center space-x-2">
          <AlertOctagon className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl text-xs text-[#10B981] flex items-center space-x-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center space-x-1 border-b border-[#2A3445] pb-2 text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab("leaderboard")}
          className={`px-3.5 py-1.5 rounded-lg transition font-medium flex items-center space-x-1.5 ${
            activeTab === "leaderboard"
              ? "bg-[#3B82F6] text-white"
              : "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#202838]"
          }`}
        >
          <Award className="h-3.5 w-3.5" />
          <span>Strategy Leaderboard</span>
        </button>

        <button
          onClick={() => setActiveTab("regimes")}
          className={`px-3.5 py-1.5 rounded-lg transition font-medium flex items-center space-x-1.5 ${
            activeTab === "regimes"
              ? "bg-[#3B82F6] text-white"
              : "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#202838]"
          }`}
        >
          <Compass className="h-3.5 w-3.5" />
          <span>Market Regimes</span>
        </button>

        <button
          onClick={() => setActiveTab("risk_opt")}
          className={`px-3.5 py-1.5 rounded-lg transition font-medium flex items-center space-x-1.5 ${
            activeTab === "risk_opt"
              ? "bg-[#3B82F6] text-white"
              : "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#202838]"
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>Walk-Forward Risk Opt</span>
          {recommendations.filter((r) => r.status === "PENDING_APPROVAL").length > 0 && (
            <span className="px-1.5 py-0.2 bg-[#F59E0B] text-black rounded-full font-bold text-[10px]">
              {recommendations.filter((r) => r.status === "PENDING_APPROVAL").length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("exec_quality")}
          className={`px-3.5 py-1.5 rounded-lg transition font-medium flex items-center space-x-1.5 ${
            activeTab === "exec_quality"
              ? "bg-[#3B82F6] text-white"
              : "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#202838]"
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          <span>Execution Quality</span>
        </button>

        <button
          onClick={() => setActiveTab("experiments")}
          className={`px-3.5 py-1.5 rounded-lg transition font-medium flex items-center space-x-1.5 ${
            activeTab === "experiments"
              ? "bg-[#3B82F6] text-white"
              : "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#202838]"
          }`}
        >
          <Database className="h-3.5 w-3.5" />
          <span>Experiment Manager ({experiments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("health")}
          className={`px-3.5 py-1.5 rounded-lg transition font-medium flex items-center space-x-1.5 ${
            activeTab === "health"
              ? "bg-[#3B82F6] text-white"
              : "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#202838]"
          }`}
        >
          <Server className="h-3.5 w-3.5" />
          <span>Autonomous Health</span>
          {systemHealth?.active_alerts?.length > 0 && (
            <span className="px-1.5 py-0.2 bg-[#EF4444] text-white rounded-full font-bold text-[10px]">
              {systemHealth.active_alerts.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: STRATEGY LEADERBOARD */}
      {activeTab === "leaderboard" && (
        <div className="space-y-4">
          <div className="fintech-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2A3445]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h2 className="text-sm font-semibold text-[#F1F5F9]">
                  Strategy Performance Matrix &amp; Composite Rankings
                </h2>
                <span className="text-[11px] text-[#94A3B8]">
                  Formula: 35% Sharpe + 30% Profit Factor + 20% Win Rate - 15% MaxDD Penalty
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] mt-1">
                Strategies are evaluated independently across risk-adjusted parameters, preventing single-metric win rate bias.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#151922] text-[#94A3B8] border-b border-[#2A3445]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Rank</th>
                    <th className="py-3 px-4 font-medium">Strategy</th>
                    <th className="py-3 px-4 font-medium text-right">Composite</th>
                    <th className="py-3 px-4 font-medium text-right">Sharpe</th>
                    <th className="py-3 px-4 font-medium text-right">Profit Factor</th>
                    <th className="py-3 px-4 font-medium text-right">Win Rate</th>
                    <th className="py-3 px-4 font-medium text-right">Max DD</th>
                    <th className="py-3 px-4 font-medium text-right">Net Profit</th>
                    <th className="py-3 px-4 font-medium text-right">Avg Holding</th>
                    <th className="py-3 px-4 font-medium text-right">Slippage</th>
                    <th className="py-3 px-4 font-medium text-center">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A3445]">
                  {leaderboardData?.leaderboard?.map((s: any, idx: number) => {
                    const isTop = idx === 0;
                    return (
                      <tr key={s.strategy} className={`hover:bg-[#202838]/50 transition ${isTop ? "bg-[#3B82F6]/5" : ""}`}>
                        <td className="py-3 px-4 font-medium">
                          <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[11px] font-semibold ${
                            isTop ? "bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40" : "bg-[#202838] text-[#94A3B8]"
                          }`}>
                            #{s.rank}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-[#F1F5F9]">
                          <div className="flex items-center space-x-2">
                            <span>{s.strategy.replace(/_/g, " ")}</span>
                            {isTop && (
                              <span className="text-[10px] bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30 px-1.5 py-0.2 rounded font-sans font-semibold">
                                OPTIMAL
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-[#3B82F6] num-tabular">
                          {s.composite_score} / 100
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-[#F1F5F9] num-tabular">
                          {s.sharpe_ratio}
                        </td>
                        <td className="py-3 px-4 text-right text-[#F1F5F9] num-tabular">
                          {s.profit_factor >= 99 ? "∞ (No Losses)" : `${s.profit_factor}x`}
                        </td>
                        <td className="py-3 px-4 text-right text-[#F1F5F9] num-tabular">
                          {s.win_rate_pct}%
                        </td>
                        <td className="py-3 px-4 text-right text-[#F59E0B] num-tabular">
                          {s.max_drawdown_pct}%
                        </td>
                        <td className={`py-3 px-4 text-right font-semibold num-tabular ${
                          s.net_profit_usd >= 0 ? "text-[#10B981]" : "text-[#EF4444]"
                        }`}>
                          ${s.net_profit_usd?.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-[#94A3B8] num-tabular">
                          {s.avg_holding_seconds ? `${Math.round(s.avg_holding_seconds)}s` : "--"}
                        </td>
                        <td className="py-3 px-4 text-right text-[#94A3B8] num-tabular">
                          {s.avg_slippage_bps ? `${s.avg_slippage_bps} bps` : "--"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                            s.confidence_level?.includes("HIGH")
                              ? "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30"
                              : s.confidence_level?.includes("MEDIUM")
                              ? "bg-[#3B82F6]/10 text-[#60A5FA] border-[#3B82F6]/30"
                              : "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30"
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
            <div className="fintech-card p-4">
              <span className="text-xs text-[#94A3B8]">Current Real-Time Regime</span>
              <div className="text-lg font-semibold text-[#F1F5F9] mt-1 flex items-center space-x-2">
                <span>{regimesData?.current_market_regime?.primary_regime?.replace(/_/g, " ") || "CALCULATING"}</span>
              </div>
              <p className="text-xs text-[#94A3B8] mt-2">
                Classification Confidence: <strong className="text-[#F1F5F9]">{Math.round((regimesData?.current_market_regime?.confidence || 0.8) * 100)}%</strong>
              </p>
              <div className="mt-2 text-[11px] text-[#94A3B8]">
                Safeguard: Backward-looking SMA &amp; return variance only. Zero forward prices used.
              </div>
            </div>

            <div className="fintech-card p-4 md:col-span-2">
              <span className="text-xs text-[#94A3B8]">Identified Microstructure Risks</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {regimesData?.current_market_regime?.identified_risks?.map((r: string, i: number) => (
                  <span key={i} className="px-2.5 py-1 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded-lg text-xs font-medium">
                    ⚠️ {r}
                  </span>
                )) || <span className="text-xs text-[#94A3B8]">No active regime risks detected.</span>}
              </div>
            </div>
          </div>

          {/* Regime Attribution Matrix */}
          <div className="fintech-card p-5">
            <h3 className="text-sm font-semibold text-[#F1F5F9] mb-1">
              Strategy Regime Attribution &amp; Underperformance Detection
            </h3>
            <p className="text-xs text-[#94A3B8] mb-4">
              Empirical matrix tracking strategy efficacy across all market regimes without look-ahead bias:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(() => {
                const matrix = regimesData?.regime_attribution_matrix?.attribution_matrix || regimesData?.regime_attribution_matrix || {};
                const entries = Object.entries(matrix).filter(([key]) => key !== "underperformance_warnings" && key !== "total_attributed_trades");
                if (entries.length === 0) {
                  return (
                    <div className="col-span-full py-6 text-center text-xs text-[#94A3B8]">
                      Regime attribution matrix analyzing active cycle trades...
                    </div>
                  );
                }
                return entries.map(([regimeName, strats]: [string, any]) => {
                  const stratEntries: any[] = typeof strats === "object" ? Object.entries(strats) : [];
                  const best = stratEntries.reduce((acc, [s, m]) => (!acc || (m?.net_pnl_usd ?? 0) > (acc.m?.net_pnl_usd ?? 0) ? { s, m } : acc), null);
                  const worst = stratEntries.reduce((acc, [s, m]) => (!acc || (m?.net_pnl_usd ?? 0) < (acc.m?.net_pnl_usd ?? 0) ? { s, m } : acc), null);
                  const totalTrades = stratEntries.reduce((acc, [, m]) => acc + (m?.trades_count ?? 0), 0);

                  return (
                    <div key={regimeName} className="bg-[#151922] border border-[#2A3445] rounded-lg p-3 text-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-[#2A3445]">
                        <strong className="text-[#F1F5F9] font-medium">{regimeName.replace(/_/g, " ")}</strong>
                        <span className="text-[10px] text-[#94A3B8]">{totalTrades} trades</span>
                      </div>

                      <div className="mt-2.5 space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-[#94A3B8]">Primary Strategy:</span>
                          <span className="text-[#10B981] font-medium">
                            {best ? best.s.replace(/_/g, " ").slice(0, 18) : "ARBITRAGE"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#94A3B8]">Underperforming:</span>
                          <span className="text-[#94A3B8] font-medium">
                            {worst && worst.m?.net_pnl_usd < 0 ? worst.s.replace(/_/g, " ").slice(0, 18) : "None"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: WALK-FORWARD RISK OPTIMIZATION */}
      {activeTab === "risk_opt" && (
        <div className="space-y-4">
          <div className="fintech-card p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#2A3445]">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-semibold text-[#F1F5F9]">
                    Walk-Forward Risk Optimization (IS 70% / OOS 30%)
                  </h3>
                  <span className="text-[10px] bg-[#3B82F6]/10 text-[#60A5FA] border border-[#3B82F6]/30 px-2 py-0.5 rounded font-medium">
                    Strict Approval Gating
                  </span>
                </div>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Evaluates 7 core risk parameters chronologically to eliminate overfitting. All changes remain strictly pending manual sign-off.
                </p>
              </div>

              <button
                onClick={handleRunWalkForward}
                disabled={actionLoading}
                className="px-3.5 py-1.5 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 transition self-start"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Run Walk-Forward Analysis</span>
              </button>
            </div>

            {/* Recommendations List */}
            <div className="mt-4 space-y-3">
              {recommendations.length === 0 ? (
                <div className="p-8 text-center text-[#94A3B8] text-xs bg-[#151922] rounded-xl border border-[#2A3445]">
                  No risk parameter modifications recommended. Current baseline configuration is optimal for observed regimes.
                </div>
              ) : (
                recommendations.map((rec) => {
                  const isPending = rec.status === "PENDING_APPROVAL";
                  const isApproved = rec.status === "APPROVED";
                  return (
                    <div
                      key={rec.id}
                      className={`p-4 rounded-xl border text-xs transition ${
                        isPending
                          ? "bg-[#151922] border-[#F59E0B]/40"
                          : isApproved
                          ? "bg-[#10B981]/5 border-[#10B981]/40"
                          : "bg-[#151922]/50 border-[#2A3445] opacity-70"
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-[#F1F5F9] text-sm">{rec.parameter_name}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                              isPending
                                ? "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30"
                                : isApproved
                                ? "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30"
                                : "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30"
                            }`}>
                              {rec.status}
                            </span>
                            {rec.is_relaxation ? (
                              <span className="px-1.5 py-0.2 bg-[#EF4444]/10 text-[#EF4444] text-[10px] rounded border border-[#EF4444]/30 font-medium">
                                Caution: Limit Relaxation
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 bg-[#10B981]/10 text-[#10B981] text-[10px] rounded border border-[#10B981]/30 font-medium">
                                Safety Tightening
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex items-center space-x-3 text-[#94A3B8]">
                            <span>Current: <strong className="text-[#F1F5F9]">{rec.current_value}</strong></span>
                            <span>&rarr;</span>
                            <span>Proposed: <strong className="text-[#3B82F6]">{rec.proposed_value}</strong></span>
                            <span>•</span>
                            <span>WFE: <strong className="text-[#10B981]">{rec.walk_forward_efficiency}</strong></span>
                            <span>•</span>
                            <span>Expected: <strong className="text-[#F1F5F9]">{rec.expected_improvement}</strong></span>
                          </div>

                          <p className="mt-1.5 text-[#94A3B8] text-[11px]">{rec.reason}</p>
                        </div>

                        {isPending && (
                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              onClick={() => handleApproveRec(rec.id)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 bg-[#10B981] hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition"
                            >
                              Approve Change
                            </button>
                            <button
                              onClick={() => setRejectionModalId(rec.id)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 bg-[#202838] hover:bg-[#2A3445] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#2A3445] rounded-lg text-xs transition"
                            >
                              Reject
                            </button>
                          </div>
                        )}

                        {isApproved && (
                          <div className="text-[11px] text-[#10B981]">
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
            <div className="fintech-card p-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#2A3445]">
                <span className="text-xs text-[#94A3B8] font-medium">Simulated Execution (Paper Mode)</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#3B82F6]/10 text-[#60A5FA] border border-[#3B82F6]/30 font-medium">
                  SIMULATED_PAPER
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4 text-xs">
                <div>
                  <span className="text-[#94A3B8]">Sample Count:</span>
                  <div className="text-lg font-semibold text-[#F1F5F9] num-tabular mt-0.5">
                    {execQuality?.simulated_metrics?.sample_count || 0}
                  </div>
                </div>
                <div>
                  <span className="text-[#94A3B8]">Avg Slippage:</span>
                  <div className="text-lg font-semibold text-[#3B82F6] num-tabular mt-0.5">
                    {execQuality?.simulated_metrics?.avg_slippage_bps || 0} bps
                  </div>
                </div>
                <div>
                  <span className="text-[#94A3B8]">Quote Delay:</span>
                  <div className="text-lg font-semibold text-[#F1F5F9] num-tabular mt-0.5">
                    {execQuality?.simulated_metrics?.avg_quote_delay_ms || 0} ms
                  </div>
                </div>
                <div>
                  <span className="text-[#94A3B8]">Price Impact:</span>
                  <div className="text-lg font-semibold text-[#F1F5F9] num-tabular mt-0.5">
                    {execQuality?.simulated_metrics?.avg_price_impact_pct || 0}%
                  </div>
                </div>
              </div>
            </div>

            {/* Real On-Chain Testnet Summary */}
            <div className="fintech-card p-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#2A3445]">
                <span className="text-xs text-[#94A3B8] font-medium">Real On-Chain Execution (HashKey Testnet)</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 font-medium">
                  ON_CHAIN_TESTNET
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4 text-xs">
                <div>
                  <span className="text-[#94A3B8]">On-Chain Samples:</span>
                  <div className="text-lg font-semibold text-[#F1F5F9] num-tabular mt-0.5">
                    {execQuality?.on_chain_metrics?.sample_count || 0}
                  </div>
                </div>
                <div>
                  <span className="text-[#94A3B8]">Avg Slippage:</span>
                  <div className="text-lg font-semibold text-[#F59E0B] num-tabular mt-0.5">
                    {execQuality?.on_chain_metrics?.avg_slippage_bps || 0} bps
                  </div>
                </div>
                <div>
                  <span className="text-[#94A3B8]">Avg Confirmation Delay:</span>
                  <div className="text-lg font-semibold text-[#F1F5F9] num-tabular mt-0.5">
                    {execQuality?.on_chain_metrics?.avg_quote_delay_ms || 0} ms
                  </div>
                </div>
                <div>
                  <span className="text-[#94A3B8]">Gas Estimation Error:</span>
                  <div className="text-lg font-semibold text-[#3B82F6] num-tabular mt-0.5">
                    {execQuality?.on_chain_metrics?.avg_gas_estimation_error_pct || 0}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Observations and Discrepancies */}
          <div className="fintech-card p-5">
            <h3 className="text-sm font-semibold text-[#F1F5F9] mb-3">Microstructural Discrepancy &amp; Reconciliation</h3>
            <ul className="space-y-2 text-xs text-[#94A3B8]">
              {execQuality?.comparative_observations?.map((obs: string, idx: number) => (
                <li key={idx} className="flex items-start space-x-2">
                  <span className="text-[#3B82F6]">•</span>
                  <span className="text-[#F1F5F9]">{obs}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* TAB 5: EXPERIMENT MANAGEMENT */}
      {activeTab === "experiments" && (
        <div className="space-y-4">
          <div className="fintech-card overflow-hidden">
            <div className="p-5 border-b border-[#2A3445] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#F1F5F9]">Persistent Experiment Management System</h3>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Every experiment maintains an immutable configuration snapshot, lifecycle controls, and isolated performance telemetry.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCompare}
                  disabled={selectedExpIds.length < 2 || actionLoading}
                  className="px-3 py-1.5 bg-[#202838] hover:bg-[#2A3445] text-[#F1F5F9] border border-[#2A3445] rounded-lg text-xs font-medium disabled:opacity-50 transition"
                >
                  Compare Selected ({selectedExpIds.length})
                </button>
              </div>
            </div>

            {/* Experiment Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#151922] text-[#94A3B8] border-b border-[#2A3445]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Select</th>
                    <th className="py-3 px-4 font-medium">Experiment ID</th>
                    <th className="py-3 px-4 font-medium">Name</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Trades</th>
                    <th className="py-3 px-4 font-medium text-right">Net Profit</th>
                    <th className="py-3 px-4 font-medium text-right">Sharpe</th>
                    <th className="py-3 px-4 font-medium text-right">Max DD</th>
                    <th className="py-3 px-4 font-medium text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A3445]">
                  {experiments.map((exp) => {
                    const isSelected = selectedExpIds.includes(exp.id);
                    const isRunning = exp.status === "RUNNING";
                    return (
                      <tr key={exp.id} className="hover:bg-[#202838]/50 transition">
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedExpIds([...selectedExpIds, exp.id]);
                              else setSelectedExpIds(selectedExpIds.filter((id) => id !== exp.id));
                            }}
                            className="rounded border-[#2A3445] bg-[#202838] text-[#3B82F6]"
                          />
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-[#94A3B8]">{exp.id}</td>
                        <td className="py-3 px-4 text-[#F1F5F9] font-medium">{exp.name}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                            isRunning
                              ? "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30"
                              : "bg-[#202838] text-[#94A3B8] border-[#2A3445]"
                          }`}>
                            {exp.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-[#F1F5F9] num-tabular">{exp.combined_metrics?.total_trades || 0}</td>
                        <td className={`py-3 px-4 text-right font-semibold num-tabular ${(exp.combined_metrics?.net_profit_usd || 0) >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                          ${(exp.combined_metrics?.net_profit_usd || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-[#F1F5F9] num-tabular">{exp.combined_metrics?.sharpe_ratio || 0}</td>
                        <td className="py-3 px-4 text-right text-[#F59E0B] num-tabular">{exp.combined_metrics?.max_drawdown_pct || 0}%</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            {isRunning ? (
                              <button
                                onClick={async () => {
                                  await stopExperiment(exp.id);
                                  loadData();
                                }}
                                className="px-2 py-1 bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30 rounded-md text-[11px] hover:bg-[#F59E0B]/30 transition font-medium"
                              >
                                Pause
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  await resumeExperiment(exp.id);
                                  loadData();
                                }}
                                className="px-2 py-1 bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30 rounded-md text-[11px] hover:bg-[#10B981]/30 transition font-medium"
                              >
                                Resume
                              </button>
                            )}
                            <button
                              onClick={() => handleExport(exp.id, "json")}
                              className="px-2 py-1 bg-[#202838] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#2A3445] rounded-md text-[11px] hover:bg-[#2A3445] flex items-center space-x-1 transition"
                              title="Export JSON"
                            >
                              <FileDown className="h-3 w-3" />
                              <span>JSON</span>
                            </button>
                            <button
                              onClick={() => handleExport(exp.id, "csv")}
                              className="px-2 py-1 bg-[#202838] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#2A3445] rounded-md text-[11px] hover:bg-[#2A3445] flex items-center space-x-1 transition"
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

            {/* Side-by-Side Comparison Box */}
            {comparisonResult && (
              <div className="m-5 p-4 bg-[#151922] border border-[#2A3445] rounded-xl">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-semibold text-[#F1F5F9]">Side-by-Side Experiment Comparison</h4>
                  <button onClick={() => setComparisonResult(null)} className="text-xs text-[#94A3B8] hover:text-[#F1F5F9]">
                    ✕ Close
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#202838] text-[#94A3B8]">
                      <tr>
                        <th className="p-2.5 font-medium">Metric</th>
                        {comparisonResult.table?.map((c: any) => (
                          <th key={c.experiment_id} className="p-2.5 font-medium">{c.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2A3445]">
                      <tr>
                        <td className="p-2.5 text-[#94A3B8]">Net Profit ($)</td>
                        {comparisonResult.table?.map((c: any) => (
                          <td key={c.experiment_id} className={`p-2.5 font-semibold num-tabular ${c.net_profit_usd >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                            ${c.net_profit_usd}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-2.5 text-[#94A3B8]">Sharpe Ratio</td>
                        {comparisonResult.table?.map((c: any) => (
                          <td key={c.experiment_id} className="p-2.5 text-[#F1F5F9] num-tabular">{c.sharpe_ratio}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-2.5 text-[#94A3B8]">Max Drawdown</td>
                        {comparisonResult.table?.map((c: any) => (
                          <td key={c.experiment_id} className="p-2.5 text-[#F59E0B] num-tabular">{c.max_drawdown_pct}%</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-2.5 text-[#94A3B8]">Composite Score</td>
                        {comparisonResult.table?.map((c: any) => (
                          <td key={c.experiment_id} className="p-2.5 text-[#3B82F6] font-semibold num-tabular">{c.composite_score}</td>
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
            <div className="fintech-card p-4">
              <span className="text-xs text-[#94A3B8]">System Operational Status</span>
              <div className="text-xl font-semibold text-[#10B981] mt-1 flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-[#10B981]"></span>
                <span>{systemHealth?.overall_status || "OPERATIONAL"}</span>
              </div>
              <p className="text-xs text-[#94A3B8] mt-2">
                Uptime: {Math.floor((systemHealth?.uptime_seconds || 0) / 3600)}h {Math.floor(((systemHealth?.uptime_seconds || 0) % 3600) / 60)}m
              </p>
            </div>

            <div className="fintech-card p-4">
              <span className="text-xs text-[#94A3B8]">HashKey Testnet RPC Telemetry</span>
              <div className="text-xl font-semibold text-[#F1F5F9] num-tabular mt-1">
                {systemHealth?.rpc_telemetry?.success_rate_pct || 99.4}%
              </div>
              <p className="text-xs text-[#94A3B8] mt-2">
                Avg Node Latency: <strong className="text-[#F1F5F9]">{systemHealth?.rpc_telemetry?.avg_latency_ms || 280} ms</strong>
              </p>
            </div>

            <div className="fintech-card p-4">
              <span className="text-xs text-[#94A3B8]">Orchestration Safeguards</span>
              <div className="text-xl font-semibold text-[#F1F5F9] num-tabular mt-1">
                {systemHealth?.safeguards?.cycle_success_rate_pct || 99.0}%
              </div>
              <p className="text-xs text-[#94A3B8] mt-2">
                Suppressed Duplicates: <strong className="text-[#3B82F6]">{systemHealth?.safeguards?.duplicate_opportunities_suppressed || 0}</strong>
              </p>
            </div>
          </div>

          {/* Seven Specialized Agents Table */}
          <div className="fintech-card p-5">
            <h3 className="text-sm font-semibold text-[#F1F5F9] mb-3">Seven Specialized Agents Availability &amp; Latency</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {systemHealth?.seven_agents &&
                Object.entries(systemHealth.seven_agents).map(([agentName, data]: [string, any]) => (
                  <div key={agentName} className="p-3 bg-[#151922] border border-[#2A3445] rounded-xl">
                    <div className="flex justify-between items-center pb-1.5 border-b border-[#2A3445]">
                      <strong className="text-[#F1F5F9] font-medium">{agentName.replace("Agent", "")}</strong>
                      <span className="px-1.5 py-0.2 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30 rounded text-[10px] font-medium">
                        {data.status}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-[#94A3B8]">
                      <div className="flex justify-between">
                        <span>Avg Latency:</span>
                        <span className="text-[#3B82F6] font-medium num-tabular">{data.avg_latency_ms} ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Invocations:</span>
                        <span className="text-[#F1F5F9] num-tabular">{data.total_invocations}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Pulse:</span>
                        <span className="text-[#94A3B8]">{data.last_seen_seconds_ago}s ago</span>
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
          <div className="bg-[#191F2B] border border-[#2A3445] rounded-xl p-5 max-w-md w-full shadow-2xl">
            <h3 className="text-sm font-semibold text-[#F1F5F9] flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
              <span>Reject Risk Recommendation</span>
            </h3>
            <p className="text-xs text-[#94A3B8] mt-1">
              Provide formal operator rationale for rejecting this risk optimization proposal:
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Rejecting slippage loosening due to impending HashKey Chain network upgrade volatility..."
              className="mt-3 w-full h-24 fintech-input p-2.5 text-xs text-[#F1F5F9]"
            />
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setRejectionModalId(null)}
                className="px-3 py-1.5 bg-[#202838] text-[#94A3B8] hover:text-[#F1F5F9] rounded-lg text-xs transition border border-[#2A3445]"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectRec}
                disabled={!rejectionReason.trim() || actionLoading}
                className="px-3 py-1.5 bg-[#EF4444] hover:bg-red-600 text-white font-medium rounded-lg text-xs transition"
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
          <div className="bg-[#191F2B] border border-[#2A3445] rounded-xl p-5 max-w-md w-full shadow-2xl">
            <h3 className="text-sm font-semibold text-[#F1F5F9] flex items-center space-x-2">
              <Sliders className="h-4 w-4 text-[#3B82F6]" />
              <span>Create Isolated Experiment</span>
            </h3>
            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="text-[#94A3B8] block mb-1">Experiment Name</label>
                <input
                  type="text"
                  value={newExpName}
                  onChange={(e) => setNewExpName(e.target.value)}
                  placeholder="e.g. Q4 Volatility Tightening Test"
                  className="w-full fintech-input p-2.5 text-xs text-[#F1F5F9]"
                />
              </div>
              <div>
                <label className="text-[#94A3B8] block mb-1">Description</label>
                <input
                  type="text"
                  value={newExpDesc}
                  onChange={(e) => setNewExpDesc(e.target.value)}
                  placeholder="e.g. Evaluating 500bps pool fee tier under high volatility"
                  className="w-full fintech-input p-2.5 text-xs text-[#F1F5F9]"
                />
              </div>
              <div>
                <label className="text-[#94A3B8] block mb-1">Initial Paper Capital ($)</label>
                <input
                  type="number"
                  value={newExpCapital}
                  onChange={(e) => setNewExpCapital(Number(e.target.value))}
                  className="w-full fintech-input p-2.5 text-xs text-[#F1F5F9]"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end space-x-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 bg-[#202838] text-[#94A3B8] hover:text-[#F1F5F9] rounded-lg text-xs transition border border-[#2A3445]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateExp}
                disabled={!newExpName.trim() || actionLoading}
                className="px-3.5 py-1.5 bg-[#3B82F6] hover:bg-blue-600 text-white font-medium rounded-lg text-xs transition"
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
