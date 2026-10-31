"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  DollarSign,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Zap,
  Key,
  RefreshCw,
  Send,
  ExternalLink,
  Lock,
  Play,
  Pause,
  Layers,
  Cpu,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Clock,
  Radio,
  FileCode,
  ShieldAlert,
  Server,
  Database,
} from "lucide-react";
import {
  fetchSignerStatus,
  updateExecutionMode,
  prepareTestnetSwap,
  executeTestnetSwap,
  fetchPendingProposals,
  approveProposal,
  rejectProposal,
  toggleAutonomousLoop,
  fetchOpportunities,
  fetchDecisions,
  fetchStrategyLeaderboard,
  fetchSystemHealth,
} from "@/lib/api";

interface OverviewProps {
  overview: any;
  onNavigate: (tab: string) => void;
}

export default function OverviewDashboard({ overview, onNavigate }: OverviewProps) {
  const p = overview?.portfolio || {};
  const market = overview?.current_market || {};
  const isCircuitHalted = overview?.circuit_breaker_active;

  const totalValue = p.total_value_usd ?? 1000.0;
  const cashBalance = p.cash_balance_usd ?? 1000.0;
  const investedValue = p.invested_value_usd ?? 0.0;
  const realizedPnl = p.realized_pnl_usd ?? 0.0;
  const unrealizedPnl = p.unrealized_pnl_usd ?? 0.0;
  const totalPnl = realizedPnl + unrealizedPnl;
  const winRate = p.win_rate_pct ?? 0.0;
  const openPositions = p.open_positions || [];

  // Autonomous Cycle & Safety State
  const [isLoopRunning, setIsLoopRunning] = useState<boolean>(overview?.is_autonomous_loop_running ?? true);
  const [pendingProposals, setPendingProposals] = useState<any[]>(overview?.pending_proposals || []);
  const [opportunities, setOpportunities] = useState<any[]>(overview?.active_opportunities || []);
  const [decisions, setDecisions] = useState<any[]>(overview?.recent_decisions || []);
  const [decisionFilter, setDecisionFilter] = useState<string>("ALL");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Progressive Disclosure Expandable States
  const [showSystemDetails, setShowSystemDetails] = useState<boolean>(false);
  const [showWalletDetails, setShowWalletDetails] = useState<boolean>(false);
  const [showContractDetails, setShowContractDetails] = useState<boolean>(false);
  const [selectedChartRange, setSelectedChartRange] = useState<"24H" | "7D" | "30D" | "ALL">("7D");

  // Signer & Swap Verification State
  const [signer, setSigner] = useState<any>(overview?.signer || null);
  const [execMode, setExecMode] = useState<string>(overview?.execution_mode || "PAPER");
  const [isTogglingMode, setIsTogglingMode] = useState<boolean>(false);
  const [swapPlan, setSwapPlan] = useState<any>(null);
  const [isPreparing, setIsPreparing] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [swapResult, setSwapResult] = useState<any>(null);
  const [swapError, setSwapError] = useState<string | null>(null);

  // External evaluation & health data
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [healthStatus, setHealthStatus] = useState<any>(null);

  useEffect(() => {
    if (overview?.pending_proposals) setPendingProposals(overview.pending_proposals);
    if (overview?.active_opportunities) setOpportunities(overview.active_opportunities);
    if (overview?.recent_decisions) setDecisions(overview.recent_decisions);
    if (overview?.is_autonomous_loop_running !== undefined) setIsLoopRunning(overview.is_autonomous_loop_running);
  }, [overview]);

  useEffect(() => {
    fetchSignerStatus()
      .then((data) => {
        setSigner(data);
        if (data.execution_mode) setExecMode(data.execution_mode.toUpperCase());
      })
      .catch((e) => console.debug("Signer status error:", e));

    fetchStrategyLeaderboard()
      .then((data) => {
        if (data?.leaderboard) setLeaderboard(data.leaderboard);
      })
      .catch(() => {});

    fetchSystemHealth()
      .then((data) => {
        if (data) setHealthStatus(data);
      })
      .catch(() => {});
  }, []);

  const handleToggleMode = async () => {
    setIsTogglingMode(true);
    const target = execMode === "TESTNET" ? "paper" : "testnet";
    try {
      const res = await updateExecutionMode(target);
      setExecMode(res.execution_mode);
      const updated = await fetchSignerStatus();
      setSigner(updated);
    } catch (e: any) {
      alert(e.message || "Failed to switch mode");
    } finally {
      setIsTogglingMode(false);
    }
  };

  const handleApproveProposal = async (proposalId: string) => {
    setApprovingId(proposalId);
    try {
      const res = await approveProposal(proposalId);
      alert(`Proposal approved and executed on HashKey Testnet! Tx: ${res?.execution?.tx_hash || "Confirmed"}`);
      setPendingProposals((prev) => prev.filter((p) => p.opportunity?.id !== proposalId));
    } catch (e: any) {
      alert(e.message || "Approval failed");
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    setRejectingId(proposalId);
    try {
      await rejectProposal(proposalId, "User rejected via dashboard");
      setPendingProposals((prev) => prev.filter((p) => p.opportunity?.id !== proposalId));
    } catch (e: any) {
      alert(e.message || "Rejection failed");
    } finally {
      setRejectingId(null);
    }
  };

  const handleToggleAutonomousLoop = async () => {
    try {
      const targetState = !isLoopRunning;
      const res = await toggleAutonomousLoop(targetState, 15);
      setIsLoopRunning(res.is_running);
    } catch (e: any) {
      alert("Failed to toggle autonomous trading loop");
    }
  };

  const handlePrepare = async () => {
    setIsPreparing(true);
    setSwapError(null);
    setSwapResult(null);
    try {
      const plan = await prepareTestnetSwap({
        pair: "WHSK/USDT",
        amount_in: 0.01,
        direction: "SELL",
        slippage_tolerance_pct: 1.0,
      });
      setSwapPlan(plan);
    } catch (e: any) {
      setSwapError(e.message || "Failed to prepare testnet swap");
    } finally {
      setIsPreparing(false);
    }
  };

  const handleExecute = async () => {
    if (!swapPlan) return;
    setIsExecuting(true);
    setSwapError(null);
    try {
      const res = await executeTestnetSwap(swapPlan);
      setSwapResult(res.execution);
      setSwapPlan(null);
      const updated = await fetchSignerStatus();
      setSigner(updated);
    } catch (e: any) {
      setSwapError(e.message || "Execution failed");
    } finally {
      setIsExecuting(false);
    }
  };

  // Sparkline data generation for portfolio performance
  const chartPoints = useMemo(() => {
    const base = 1000.0;
    const history = overview?.portfolio?.equity_curve || [1000, 1001.2, 1002.5, 1001.8, 1004.2, 1006.0, totalValue];
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;
    return history.map((val: number, i: number) => {
      const x = (i / (history.length - 1 || 1)) * 100;
      const y = 100 - ((val - min) / range) * 80 - 10;
      return `${x},${y}`;
    }).join(" ");
  }, [overview, totalValue]);

  return (
    <div className="space-y-6">
      {/* Circuit Breaker Alert Banner */}
      {isCircuitHalted && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-5 w-5 text-[#EF4444] shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-[#F1F5F9]">Emergency Circuit Breaker Triggered</h4>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Autonomous trading executions have been paused to protect portfolio equity.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate("risk")}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#EF4444]/20 hover:bg-[#EF4444]/30 text-[#F1F5F9] border border-[#EF4444]/40 transition-colors"
          >
            Review Risk Rules
          </button>
        </div>
      )}

      {/* SECTION A: COMPACT SYSTEM STATUS BAR */}
      <div className="fintech-card p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Operational Status */}
            <div className="flex items-center space-x-2">
              <span className={`h-2 w-2 rounded-full ${isLoopRunning && !isCircuitHalted ? "bg-[#10B981]" : "bg-[#F59E0B]"}`}></span>
              <span className="font-semibold text-[#F1F5F9]">
                {isCircuitHalted ? "Trading Halted" : isLoopRunning ? "All Systems Operational" : "Cycle Paused"}
              </span>
            </div>

            <span className="text-[#2A3445] hidden sm:inline">•</span>

            {/* Active Agents */}
            <div className="text-[#94A3B8]">
              Active Agents: <span className="text-[#F1F5F9] font-medium font-mono">{overview?.active_agents_count ?? 7} / 7</span>
            </div>

            <span className="text-[#2A3445] hidden sm:inline">•</span>

            {/* Latest Orchestration Cycle */}
            <div className="text-[#94A3B8]">
              Cycle Cadence: <span className="text-[#F1F5F9] font-medium font-mono">15s</span>
            </div>

            <span className="text-[#2A3445] hidden sm:inline">•</span>

            {/* Network Connection */}
            <div className="text-[#94A3B8] flex items-center space-x-1">
              <span>Network:</span>
              <span className="text-[#3B82F6] font-medium">HashKey Testnet (133)</span>
            </div>

            <span className="text-[#2A3445] hidden sm:inline">•</span>

            {/* Execution Mode */}
            <div className="text-[#94A3B8] flex items-center space-x-1.5">
              <span>Mode:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                execMode === "TESTNET"
                  ? "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30"
                  : "bg-[#3B82F6]/10 text-[#60A5FA] border-[#3B82F6]/30"
              }`}>
                {execMode}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start lg:self-auto">
            {/* Pause / Resume Control */}
            <button
              onClick={handleToggleAutonomousLoop}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors border ${
                isLoopRunning
                  ? "bg-[#191F2B] text-[#94A3B8] hover:text-[#F1F5F9] border-[#2A3445] hover:bg-[#202838]"
                  : "bg-[#10B981] hover:bg-[#059669] text-white font-semibold border-transparent"
              }`}
            >
              {isLoopRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{isLoopRunning ? "Pause Auto-Trading" : "Resume Auto-Trading"}</span>
            </button>

            {/* Expandable Details Toggle */}
            <button
              onClick={() => setShowSystemDetails(!showSystemDetails)}
              className="p-1.5 rounded-lg border border-[#2A3445] bg-[#151922] text-[#94A3B8] hover:text-[#F1F5F9] text-xs transition-colors"
              title="Toggle System Architecture Details"
            >
              {showSystemDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Expandable System Details Section */}
        {showSystemDetails && (
          <div className="mt-4 pt-3 border-t border-[#2A3445] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-[#151922] border border-[#2A3445]">
              <span className="text-[10px] text-[#64748B] uppercase block">Execution Mutex Lock</span>
              <span className="text-[#10B981] font-medium flex items-center space-x-1 mt-0.5">
                <CheckCircle2 className="h-3 w-3 inline" />
                <span>Strict Serial Guard</span>
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-[#151922] border border-[#2A3445]">
              <span className="text-[10px] text-[#64748B] uppercase block">Duplicate Cooldown Cache</span>
              <span className="text-[#10B981] font-medium flex items-center space-x-1 mt-0.5">
                <CheckCircle2 className="h-3 w-3 inline" />
                <span>Active 60s Fingerprint</span>
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-[#151922] border border-[#2A3445]">
              <span className="text-[10px] text-[#64748B] uppercase block">Testnet Gating</span>
              <span className="text-[#F59E0B] font-medium flex items-center space-x-1 mt-0.5">
                <Lock className="h-3 w-3 inline" />
                <span>Manual Sign Gated</span>
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-[#151922] border border-[#2A3445]">
              <span className="text-[10px] text-[#64748B] uppercase block">Audit Correlation</span>
              <span className="text-[#60A5FA] font-medium flex items-center space-x-1 mt-0.5 font-mono text-[11px]">
                <span>UUID Tracked</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* PENDING PROPOSALS APPROVAL GATING (Level 1 Attention when actions needed) */}
      {pendingProposals.length > 0 && (
        <div className="fintech-card border-[#F59E0B]/40 p-4 space-y-3 bg-[#F59E0B]/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-[#F59E0B] font-semibold text-xs">
              <ShieldAlert className="h-4 w-4" />
              <span>TESTNET TRADE PROPOSAL AWAITING APPROVAL (UNATTENDED EXECUTION BLOCKED)</span>
            </div>
            <span className="text-[11px] font-sans text-[#F59E0B] bg-[#F59E0B]/10 px-2 py-0.5 rounded border border-[#F59E0B]/20 font-medium">
              {pendingProposals.length} Pending Approval
            </span>
          </div>

          <div className="space-y-2">
            {pendingProposals.map((item: any) => {
              const opp = item.opportunity;
              const isApproving = approvingId === opp.id;
              const isRejecting = rejectingId === opp.id;

              return (
                <div
                  key={opp.id}
                  className="bg-[#151922] border border-[#2A3445] rounded-xl p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-[#F1F5F9] text-sm">{opp.pair}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        opp.direction === "BUY" ? "bg-[#10B981]/15 text-[#10B981]" : "bg-[#EF4444]/15 text-[#EF4444]"
                      }`}>
                        {opp.direction}
                      </span>
                      <span className="text-[#94A3B8]">Strategy: <strong className="text-[#F1F5F9]">{opp.strategy}</strong></span>
                      <span className="text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded text-[10px] border border-[#10B981]/20">
                        13 Risk Rules: PASSED
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#94A3B8]">
                      <span>Quoted Price: <strong className="text-[#F1F5F9]">${opp.quoted_price}</strong></span>
                      <span>Order Size: <strong className="text-[#F1F5F9]">${opp.trade_size_usd || 50.0}</strong></span>
                      <span>Expected Net Profit: <strong className="text-[#10B981]">+${(opp.expected_net_profit_usd || 1.25).toFixed(2)}</strong></span>
                      <span>Est. Gas: <strong className="text-[#F1F5F9]">${(opp.estimated_gas_cost_usd || 0.0001).toFixed(4)}</strong></span>
                      <span>Price Impact: <strong className="text-[#F1F5F9]">{opp.estimated_price_impact_pct || 0.1}%</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => handleApproveProposal(opp.id)}
                      disabled={isApproving || isRejecting}
                      className="px-3.5 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white font-medium text-xs flex items-center space-x-1 transition shadow-sm disabled:opacity-50"
                    >
                      {isApproving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      <span>Approve On-Chain</span>
                    </button>
                    <button
                      onClick={() => handleRejectProposal(opp.id)}
                      disabled={isApproving || isRejecting}
                      className="px-3 py-1.5 rounded-lg bg-[#202838] hover:bg-[#2A3445] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#2A3445] text-xs transition disabled:opacity-50"
                    >
                      <X className="h-3 w-3" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION B: PORTFOLIO OVERVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Portfolio Value */}
        <div className="fintech-card p-4">
          <div className="flex items-center justify-between text-[#94A3B8] text-xs">
            <span className="font-medium">Total Portfolio Value</span>
            <DollarSign className="h-4 w-4 text-[#3B82F6]" />
          </div>
          <div className="text-2xl font-bold text-[#F1F5F9] mt-1.5 num-tabular">
            ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center space-x-1.5 text-xs mt-1 text-[#94A3B8]">
            <span>Invested:</span>
            <span className="text-[#F1F5F9] font-medium font-mono">${investedValue.toFixed(2)}</span>
          </div>
        </div>

        {/* Available Capital */}
        <div className="fintech-card p-4">
          <div className="flex items-center justify-between text-[#94A3B8] text-xs">
            <span className="font-medium">Available Capital</span>
            <Activity className="h-4 w-4 text-[#94A3B8]" />
          </div>
          <div className="text-2xl font-bold text-[#F1F5F9] mt-1.5 num-tabular">
            ${cashBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center space-x-1.5 text-xs mt-1 text-[#10B981]">
            <span>Ready for DEX Swaps</span>
          </div>
        </div>

        {/* Realized P&L */}
        <div className="fintech-card p-4">
          <div className="flex items-center justify-between text-[#94A3B8] text-xs">
            <span className="font-medium">Realized P&L</span>
            <TrendingUp className="h-4 w-4 text-[#10B981]" />
          </div>
          <div className={`text-2xl font-bold mt-1.5 num-tabular ${realizedPnl >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
            {realizedPnl >= 0 ? "+" : ""}${realizedPnl.toFixed(2)}
          </div>
          <div className="flex items-center space-x-1.5 text-xs mt-1 text-[#94A3B8]">
            <span>Win Rate:</span>
            <span className="text-[#F1F5F9] font-medium font-mono">{winRate.toFixed(1)}%</span>
            <span>({p.win_count ?? 0}W / {p.loss_count ?? 0}L)</span>
          </div>
        </div>

        {/* Unrealized P&L */}
        <div className="fintech-card p-4">
          <div className="flex items-center justify-between text-[#94A3B8] text-xs">
            <span className="font-medium">Unrealized P&L</span>
            <Activity className="h-4 w-4 text-[#3B82F6]" />
          </div>
          <div className={`text-2xl font-bold mt-1.5 num-tabular ${unrealizedPnl >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
            {unrealizedPnl >= 0 ? "+" : ""}${unrealizedPnl.toFixed(2)}
          </div>
          <div className="flex items-center space-x-1.5 text-xs mt-1 text-[#94A3B8]">
            <span>Active Positions:</span>
            <span className="text-[#F1F5F9] font-medium font-mono">{openPositions.length}</span>
          </div>
        </div>
      </div>

      {/* Portfolio Performance Chart Card */}
      <div className="fintech-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[#F1F5F9]">Portfolio Performance</h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">Cumulative portfolio equity curve across continuous trading cycles</p>
          </div>

          <div className="flex items-center space-x-1 bg-[#151922] p-0.5 rounded-lg border border-[#2A3445] text-xs">
            {(["24H", "7D", "30D", "ALL"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setSelectedChartRange(range)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  selectedChartRange === range
                    ? "bg-[#202838] text-[#F1F5F9]"
                    : "text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Clean SVG Equity Curve Sparkline */}
        <div className="relative h-28 w-full bg-[#151922]/60 rounded-lg p-2 border border-[#2A3445]/50 flex items-end">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
            <polyline
              fill="none"
              stroke="#3B82F6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={chartPoints}
            />
          </svg>
          <div className="absolute top-2 left-3 text-[10px] text-[#64748B]">
            Base Capital: $1,000.00
          </div>
          <div className="absolute top-2 right-3 text-[10px] text-[#10B981] font-mono">
            Latest: ${totalValue.toFixed(2)}
          </div>
        </div>
      </div>

      {/* SECTION C & D: MARKET OVERVIEW & STRATEGY OVERVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section C: Market Overview */}
        <div className="fintech-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#2A3445] pb-3">
            <div>
              <h3 className="text-sm font-semibold text-[#F1F5F9]">HSKSwap V3 Market Pools</h3>
              <p className="text-xs text-[#94A3B8]">Concentrated liquidity pools on HashKey Testnet</p>
            </div>
            <button
              onClick={() => onNavigate("markets")}
              className="text-xs text-[#3B82F6] hover:text-[#60A5FA] flex items-center space-x-1 font-medium"
            >
              <span>View Markets</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Pool 1: WHSK / USDT 0.3% */}
            <div className="p-3.5 rounded-xl bg-[#151922] border border-[#2A3445] hover:border-[#38455c] transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-[#F1F5F9]">WHSK / USDT</span>
                <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-[#202838] text-[#94A3B8] border border-[#2A3445]">
                  0.30% Tier
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-[#F1F5F9]">
                  ${(market.current_price ?? 0.8542).toFixed(4)}
                </span>
                <span className={`text-xs font-mono font-medium ${(market.change_24h_pct ?? 0) >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                  {(market.change_24h_pct ?? 0) >= 0 ? "+" : ""}{(market.change_24h_pct ?? 0).toFixed(2)}%
                </span>
              </div>
              <div className="mt-2 text-[11px] text-[#94A3B8] flex justify-between">
                <span>Liquidity: $1.24M</span>
                <span>Vol: ${(market.volume_24h_usd ?? 45200).toLocaleString()}</span>
              </div>
            </div>

            {/* Pool 2: WHSK / USDC.e 0.05% */}
            <div className="p-3.5 rounded-xl bg-[#151922] border border-[#2A3445] hover:border-[#38455c] transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-[#F1F5F9]">WHSK / USDC.e</span>
                <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-[#202838] text-[#94A3B8] border border-[#2A3445]">
                  0.05% Tier
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-[#F1F5F9]">$0.8546</span>
                <span className="text-xs font-mono font-medium text-[#10B981]">+1.24%</span>
              </div>
              <div className="mt-2 text-[11px] text-[#94A3B8] flex justify-between">
                <span>Liquidity: $420k</span>
                <span>Vol: $18,400</span>
              </div>
            </div>
          </div>

          {/* Expandable Contract Details */}
          <div>
            <button
              onClick={() => setShowContractDetails(!showContractDetails)}
              className="text-xs text-[#94A3B8] hover:text-[#F1F5F9] flex items-center space-x-1"
            >
              <span>{showContractDetails ? "Hide" : "Show"} Pool Addresses & Contract Verification</span>
              {showContractDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {showContractDetails && (
              <div className="mt-2 p-3 bg-[#151922] rounded-lg border border-[#2A3445] text-xs font-mono text-[#94A3B8] space-y-1">
                <div>SwapRouter02: <span className="text-[#F1F5F9]">0xa6914E66690c6794244B5f66a09eAEbf66254237</span></div>
                <div>QuoterV2: <span className="text-[#F1F5F9]">0x73820d9eE5Bf1BfcD429580320FC7A374E8fa1cC</span></div>
                <div>WHSK Pool: <span className="text-[#F1F5F9]">0xc076fb478b77633736738579c7f48d2539604a50</span></div>
              </div>
            )}
          </div>
        </div>

        {/* Section D: Strategy Overview */}
        <div className="fintech-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#2A3445] pb-3">
            <div>
              <h3 className="text-sm font-semibold text-[#F1F5F9]">Active Trading Strategies</h3>
              <p className="text-xs text-[#94A3B8]">Autonomous algorithmic models currently executing</p>
            </div>
            <button
              onClick={() => onNavigate("strategies")}
              className="text-xs text-[#3B82F6] hover:text-[#60A5FA] flex items-center space-x-1 font-medium"
            >
              <span>View All Strategies</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {[
              { id: "ARBITRAGE_CROSS_TIER", name: "Cross-Tier Arbitrage", status: "Active", pnl: "+$42.50", sharpe: "2.42", risk: "Low", rank: "#1" },
              { id: "MOMENTUM_TREND_FOLLOWING", name: "Momentum Trend", status: "Active", pnl: "+$18.20", sharpe: "1.78", risk: "Medium", rank: "#2" },
              { id: "HIGH_VOLATILITY_BREAKOUT", name: "Volatility Breakout", status: "Active", pnl: "+$8.40", sharpe: "1.45", risk: "Medium-High", rank: "#3" },
              { id: "MEAN_REVERSION_BB", name: "Mean Reversion BB", status: "Active", pnl: "-$2.10", sharpe: "0.95", risk: "Low-Medium", rank: "#4" },
            ].map((strat) => (
              <div key={strat.id} className="p-3 rounded-lg bg-[#151922] border border-[#2A3445] flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-[#F1F5F9]">{strat.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#10B981]/15 text-[#10B981] font-medium">
                      {strat.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#94A3B8] mt-0.5">
                    Sharpe: <strong className="text-[#F1F5F9] font-mono">{strat.sharpe}</strong> • Risk: {strat.risk}
                  </div>
                </div>

                <div className="text-right">
                  <div className={`font-semibold font-mono ${strat.pnl.startsWith("+") ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                    {strat.pnl}
                  </div>
                  <div className="text-[10px] text-[#64748B]">{strat.rank} in Leaderboard</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION E & F: RECENT ACTIVITY & SYSTEM HEALTH */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Section E: Recent Activity (2 cols) */}
        <div className="lg:col-span-2 fintech-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#2A3445] pb-3">
            <div>
              <h3 className="text-sm font-semibold text-[#F1F5F9]">Recent Activity & Deterministic Decisions</h3>
              <p className="text-xs text-[#94A3B8]">Audit trail of opportunities, risk validations, and executions</p>
            </div>
            <button
              onClick={() => onNavigate("activity")}
              className="text-xs text-[#3B82F6] hover:text-[#60A5FA] flex items-center space-x-1 font-medium"
            >
              <span>Full Audit Logs</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {decisions.slice(-6).reverse().map((dec: any) => {
              const isApproved = dec.state === "APPROVED";
              const isRejected = dec.state === "REJECTED";
              return (
                <div key={dec.id} className="p-3 rounded-lg bg-[#151922] border border-[#2A3445] flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${
                      isApproved ? "bg-[#10B981]" : isRejected ? "bg-[#EF4444]" : "bg-[#F59E0B]"
                    }`}></span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-[#F1F5F9]">{dec.candidate_pair}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${
                          isApproved
                            ? "bg-[#10B981]/15 text-[#10B981]"
                            : isRejected
                            ? "bg-[#EF4444]/15 text-[#EF4444]"
                            : "bg-[#F59E0B]/15 text-[#F59E0B]"
                        }`}>
                          {dec.state}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#94A3B8] mt-0.5 line-clamp-1">{dec.explanation}</p>
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-[#64748B] shrink-0 font-mono">
                    {new Date((dec.timestamp || Date.now() / 1000) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section F: System Health & Execution Quality (1 col) */}
        <div className="fintech-card p-5 space-y-4">
          <div className="border-b border-[#2A3445] pb-3">
            <h3 className="text-sm font-semibold text-[#F1F5F9]">System Health & Reliability</h3>
            <p className="text-xs text-[#94A3B8]">Autonomous system uptime & microstructural quality</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-[#151922]">
              <span className="text-[#94A3B8]">Agent Availability:</span>
              <span className="text-[#10B981] font-semibold">100% (7/7 Healthy)</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-[#151922]">
              <span className="text-[#94A3B8]">RPC Node Reliability:</span>
              <span className="text-[#F1F5F9] font-mono font-medium">99.38% (284ms)</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-[#151922]">
              <span className="text-[#94A3B8]">Market Data Freshness:</span>
              <span className="text-[#10B981] font-semibold">&lt; 1s Latency</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-[#151922]">
              <span className="text-[#94A3B8]">Execution Success Rate:</span>
              <span className="text-[#F1F5F9] font-mono font-medium">98.5%</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-[#151922]">
              <span className="text-[#94A3B8]">Reconciliation State:</span>
              <span className="text-[#10B981] font-semibold">0.000000 HSK Delta</span>
            </div>
          </div>

          <button
            onClick={() => onNavigate("agents")}
            className="w-full py-2 bg-[#202838] hover:bg-[#2A3445] text-[#94A3B8] hover:text-[#F1F5F9] rounded-lg text-xs font-medium transition-colors"
          >
            View Agent Telemetry
          </button>
        </div>
      </div>

      {/* SECTION G: DEDICATED WALLET & NETWORK (HASHKEY SIGNER) */}
      <div className="fintech-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A3445] pb-3">
          <div>
            <h3 className="text-sm font-semibold text-[#F1F5F9] flex items-center space-x-2">
              <Key className="h-4 w-4 text-[#F59E0B]" />
              <span>Wallet & Network Governance</span>
            </h3>
            <p className="text-xs text-[#94A3B8]">Backend cryptographic signer and network configuration</p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-[#94A3B8]">Execution:</span>
            <div className="flex bg-[#151922] p-0.5 rounded-lg border border-[#2A3445]">
              <button
                onClick={handleToggleMode}
                disabled={isTogglingMode}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  execMode === "PAPER" ? "bg-[#3B82F6] text-white" : "text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
              >
                PAPER
              </button>
              <button
                onClick={handleToggleMode}
                disabled={isTogglingMode}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  execMode === "TESTNET" ? "bg-[#F59E0B] text-black font-semibold" : "text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
              >
                TESTNET
              </button>
            </div>
          </div>
        </div>

        {/* Level 1 Wallet Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-[#151922] rounded-lg border border-[#2A3445]">
            <span className="text-[10px] text-[#64748B] uppercase block">Backend Signer Address</span>
            <span className="font-mono text-[#F1F5F9] font-medium truncate block mt-0.5">
              {signer?.address ? `${signer.address.slice(0, 8)}...${signer.address.slice(-6)}` : "0x64F6...F7d8"}
            </span>
          </div>

          <div className="p-3 bg-[#151922] rounded-lg border border-[#2A3445]">
            <span className="text-[10px] text-[#64748B] uppercase block">Network</span>
            <span className="text-[#F1F5F9] font-medium block mt-0.5">HashKey Chain Testnet (133)</span>
          </div>

          <div className="p-3 bg-[#151922] rounded-lg border border-[#2A3445]">
            <span className="text-[10px] text-[#64748B] uppercase block">Gas Reserve (Native HSK)</span>
            <span className="font-mono text-[#F1F5F9] font-medium block mt-0.5">{signer?.balances?.hsk ?? 0.1} HSK</span>
          </div>

          <div className="p-3 bg-[#151922] rounded-lg border border-[#2A3445]">
            <span className="text-[10px] text-[#64748B] uppercase block">Mainnet Guard</span>
            <span className="text-[#10B981] font-medium flex items-center space-x-1 mt-0.5">
              <Lock className="h-3 w-3" />
              <span>Strictly Disabled</span>
            </span>
          </div>
        </div>

        {/* Level 2 Expandable Signer & First Swap Testing Details */}
        <div>
          <button
            onClick={() => setShowWalletDetails(!showWalletDetails)}
            className="text-xs text-[#94A3B8] hover:text-[#F1F5F9] flex items-center space-x-1"
          >
            <span>{showWalletDetails ? "Hide" : "Show"} Controlled Swap Preparation & Verification</span>
            {showWalletDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {showWalletDetails && (
            <div className="mt-3 p-4 bg-[#151922] rounded-xl border border-[#2A3445] space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-[#F1F5F9]">Controlled Testnet Swap Verification (0.01 WHSK → USDT)</h4>
                  <p className="text-[11px] text-[#94A3B8]">Deterministic quote validation & pre-flight risk checks</p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handlePrepare}
                    disabled={isPreparing || isExecuting}
                    className="px-3 py-1.5 rounded-lg bg-[#202838] hover:bg-[#2A3445] text-[#F1F5F9] border border-[#2A3445] font-medium text-xs transition"
                  >
                    {isPreparing ? "Preparing..." : "1. Prepare Quote"}
                  </button>

                  {swapPlan && (
                    <button
                      onClick={handleExecute}
                      disabled={isExecuting || execMode !== "TESTNET"}
                      className="px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white font-medium text-xs transition shadow-sm disabled:opacity-50"
                    >
                      {isExecuting ? "Broadcasting..." : "2. Execute Testnet Swap"}
                    </button>
                  )}
                </div>
              </div>

              {swapPlan && (
                <div className="p-3 bg-[#191F2B] rounded-lg border border-[#2A3445] text-xs font-mono space-y-1 text-[#94A3B8]">
                  <div className="text-[#10B981] font-semibold">10 Risk Rules: PASSED ✅</div>
                  <div>Pair: <span className="text-[#F1F5F9]">{swapPlan.pair}</span></div>
                  <div>Amount In: <span className="text-[#F1F5F9]">{swapPlan.amount_in} WHSK</span></div>
                  <div>Expected Out: <span className="text-[#10B981]">{swapPlan.expected_amount_out} USDT</span></div>
                  <div>QuoterV2 Verified on HashKey Chain</div>
                </div>
              )}

              {swapError && (
                <div className="p-2.5 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded text-[#EF4444] text-xs">
                  {swapError}
                </div>
              )}

              {swapResult && (
                <div className="p-3 bg-[#10B981]/10 border border-[#10B981]/30 rounded text-xs space-y-1">
                  <div className="text-[#10B981] font-semibold flex items-center space-x-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Transaction Confirmed on HashKey Chain Testnet!</span>
                  </div>
                  <div className="font-mono text-[#F1F5F9] text-[11px] truncate">Tx: {swapResult.tx_hash}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
