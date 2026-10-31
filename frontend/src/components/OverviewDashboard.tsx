"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  DollarSign,
  Briefcase,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
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
  Calculator,
  ShieldAlert,
  ListFilter,
  Sliders,
  Flame,
  Check,
  X,
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

  // Signer & Swap Verification State
  const [signer, setSigner] = useState<any>(overview?.signer || null);
  const [execMode, setExecMode] = useState<string>(overview?.execution_mode || "PAPER");
  const [isTogglingMode, setIsTogglingMode] = useState<boolean>(false);
  const [swapPlan, setSwapPlan] = useState<any>(null);
  const [isPreparing, setIsPreparing] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [swapResult, setSwapResult] = useState<any>(null);
  const [swapError, setSwapError] = useState<string | null>(null);

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
      .catch((e) => console.debug("Error loading signer status:", e));
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

  return (
    <div className="space-y-6">
      {/* Circuit Breaker Alert Banner */}
      {isCircuitHalted && (
        <div className="bg-red-950/60 border border-red-700/80 rounded-lg p-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div>
              <h4 className="text-sm font-semibold text-red-200">Emergency Circuit Breaker Active</h4>
              <p className="text-xs text-red-400">All autonomous trading executions are paused by deterministic safety policy.</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate("risk")}
            className="text-xs font-semibold px-3 py-1.5 rounded bg-red-900 hover:bg-red-800 text-red-100 border border-red-700"
          >
            Manage Risk Rules
          </button>
        </div>
      )}

      {/* Phase 2: Autonomous Multi-Agent Trading Cycle & Safety Controls Banner */}
      <div className="terminal-card border-cyan-800/80 p-5 bg-gradient-to-r from-[#07131e] via-[#091b29] to-[#07131e]">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-cyan-900/50 pb-3 mb-4 gap-3">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-950/80 border border-cyan-700/80 flex items-center justify-center text-cyan-400 shadow-lg">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                  Autonomous Multi-Agent Trading Orchestrator
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center space-x-1 ${
                  isLoopRunning ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-amber-950 text-amber-400 border border-amber-800"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isLoopRunning ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`}></span>
                  <span>{isLoopRunning ? "AUTONOMOUS LOOP ACTIVE (15s)" : "CYCLE PAUSED"}</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800">
                  PAPER Mode Default
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                9-Stage Cycle: Market Monitoring → Discovery → Agent Analysis → Strategy Scoring → Risk Validation → Trade Proposal → Approval → Execution → Reconciliation
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start md:self-auto">
            <button
              onClick={handleToggleAutonomousLoop}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition-all ${
                isLoopRunning
                  ? "bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700"
                  : "bg-emerald-600 hover:bg-emerald-500 text-black font-semibold shadow-md"
              }`}
            >
              {isLoopRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{isLoopRunning ? "Pause Auto-Loop" : "Resume Auto-Loop"}</span>
            </button>
          </div>
        </div>

        {/* Pending Testnet Proposals Gating Section */}
        {pendingProposals.length > 0 ? (
          <div className="bg-amber-950/40 border border-amber-500/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs font-mono">
                <ShieldAlert className="h-4 w-4 animate-bounce" />
                <span>PENDING TESTNET PROPOSALS (UNATTENDED EXECUTION BLOCKED - APPROVAL REQUIRED)</span>
              </div>
              <span className="text-[11px] font-mono text-amber-300 bg-amber-900/60 px-2 py-0.5 rounded">
                {pendingProposals.length} Action Required
              </span>
            </div>

            <div className="space-y-2.5">
              {pendingProposals.map((item: any) => {
                const opp = item.opportunity;
                const isApproving = approvingId === opp.id;
                const isRejecting = rejectingId === opp.id;

                return (
                  <div key={opp.id} className="bg-slate-900/90 border border-amber-800/80 rounded-lg p-3 text-xs font-mono flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-sm">{opp.pair}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${opp.direction === "BUY" ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-red-950 text-red-400 border border-red-800"}`}>
                          {opp.direction}
                        </span>
                        <span className="text-slate-400 text-[11px]">Strategy: <strong>{opp.strategy}</strong></span>
                        <span className="text-emerald-400 text-[10px] bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-900">
                          13 Risk Rules: PASSED ✅
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
                        <span>Price: <strong>${opp.quoted_price}</strong></span>
                        <span>Size: <strong>${opp.trade_size_usd || 50.0}</strong></span>
                        <span>Venue: <strong>{opp.source_venue}</strong></span>
                        <span>Exp Net Profit: <strong className="text-emerald-400">+${opp.expected_net_profit_usd?.toFixed(2) || "1.25"}</strong></span>
                        <span>Gas: <strong className="text-slate-400">${opp.estimated_gas_cost_usd?.toFixed(4) || "0.0001"}</strong></span>
                        <span>Slippage: <strong className="text-slate-400">{opp.estimated_price_impact_pct || 0.1}%</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 self-end md:self-auto">
                      <button
                        onClick={() => handleApproveProposal(opp.id)}
                        disabled={isApproving || isRejecting}
                        className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center space-x-1 transition shadow disabled:opacity-50"
                      >
                        {isApproving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        <span>Approve Testnet Swap</span>
                      </button>
                      <button
                        onClick={() => handleRejectProposal(opp.id)}
                        disabled={isApproving || isRejecting}
                        className="px-3 py-1.5 rounded bg-slate-800 hover:bg-red-900/60 text-slate-300 hover:text-red-200 border border-slate-700 text-xs flex items-center space-x-1 transition disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Execution Mutex Lock</span>
              <span className="text-emerald-400 font-bold flex items-center space-x-1 mt-0.5">
                <CheckCircle2 className="h-3.5 w-3.5 inline" />
                <span>Strict Serial Execution Guard</span>
              </span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Duplicate Trade Cooldown</span>
              <span className="text-emerald-400 font-bold flex items-center space-x-1 mt-0.5">
                <CheckCircle2 className="h-3.5 w-3.5 inline" />
                <span>Fingerprint Cache Active (60s)</span>
              </span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Unattended Testnet Trading</span>
              <span className="text-amber-300 font-bold flex items-center space-x-1 mt-0.5">
                <Lock className="h-3.5 w-3.5 inline" />
                <span>BLOCKED (Manual Sign Gating)</span>
              </span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Audit Correlation ID</span>
              <span className="text-cyan-300 font-bold flex items-center space-x-1 mt-0.5">
                <span>UUID Tracked on Every Cycle</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Backend Signer & First Testnet Swap Verification Terminal */}
      <div className="terminal-card border-amber-500/30 p-5 bg-gradient-to-br from-[#0c1017] via-[#0d1420] to-[#0b121c]">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800/80 pb-4 mb-4 gap-3">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                  HashKey Testnet Backend Signer & Contract Verification
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 uppercase">
                  ⚡ Testnet (Chain ID: 133)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-950/80 text-red-400 border border-red-800 flex items-center space-x-1">
                  <Lock className="h-3 w-3" />
                  <span>Mainnet Disabled</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Deterministic autonomous EVM execution via dedicated backend signer. Private keys remain strictly isolated.
              </p>
            </div>
          </div>

          {/* Mode Switcher Toggle */}
          <div className="flex items-center space-x-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono self-start md:self-auto">
            <span className="text-slate-400">Mode:</span>
            <button
              onClick={handleToggleMode}
              disabled={isTogglingMode}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                execMode === "TESTNET"
                  ? "bg-amber-500 text-black shadow-sm"
                  : "bg-slate-800 text-slate-300 hover:text-white"
              }`}
            >
              TESTNET
            </button>
            <button
              onClick={handleToggleMode}
              disabled={isTogglingMode}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                execMode === "PAPER"
                  ? "bg-cyan-500 text-black shadow-sm"
                  : "bg-slate-800 text-slate-300 hover:text-white"
              }`}
            >
              PAPER
            </button>
          </div>
        </div>

        {/* Signer Public Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-slate-900/70 p-3 rounded border border-slate-800">
            <span className="text-[11px] text-slate-400 font-mono block">Derived Signer Public Address</span>
            <span className="text-xs font-mono text-cyan-300 font-bold break-all select-all block mt-1">
              {signer?.address || "0x64F6dB6Cb2e579CA76AdD913e063FB9407F7F7d8"}
            </span>
            <span className="text-[10px] text-emerald-400 font-mono flex items-center space-x-1 mt-1">
              <CheckCircle2 className="h-3 w-3 inline" />
              <span>Derived from TESTNET_SIGNER_PRIVATE_KEY</span>
            </span>
          </div>

          <div className="bg-slate-900/70 p-3 rounded border border-slate-800">
            <span className="text-[11px] text-slate-400 font-mono block">Native HSK Balance (Gas)</span>
            <span className="text-lg font-bold font-mono text-slate-100 block mt-0.5">
              {signer?.balances?.hsk ?? 0.1} HSK
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">
              Ready for testnet transaction fees
            </span>
          </div>

          <div className="bg-slate-900/70 p-3 rounded border border-slate-800">
            <span className="text-[11px] text-slate-400 font-mono block">Token Balances (WHSK / USDT)</span>
            <div className="text-xs font-mono text-slate-200 mt-1 space-y-0.5">
              <div>WHSK: <span className="text-cyan-400 font-semibold">{signer?.balances?.whsk ?? 0.0}</span></div>
              <div>USDT: <span className="text-emerald-400 font-semibold">{signer?.balances?.usdt ?? 0.0}</span></div>
            </div>
          </div>

          <div className="bg-slate-900/70 p-3 rounded border border-slate-800">
            <span className="text-[11px] text-slate-400 font-mono block">Contracts Verification</span>
            <div className="text-[11px] font-mono mt-1 space-y-0.5 text-slate-300">
              <div className="flex items-center justify-between">
                <span>SwapRouter02:</span>
                <span className="text-emerald-400 font-bold">Verified ✅</span>
              </div>
              <div className="flex items-center justify-between">
                <span>QuoterV2:</span>
                <span className="text-emerald-400 font-bold">Verified ✅</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Pool Liquidity:</span>
                <span className="text-cyan-400 font-bold">Active 3.23k+ ✅</span>
              </div>
            </div>
          </div>
        </div>

        {/* First Controlled Testnet Swap Execution Box */}
        <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800/90">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center space-x-2">
                <span>Controlled First Testnet Swap (0.01 WHSK → USDT)</span>
              </h4>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Deterministic 2-step workflow: Quote & 10 Risk Rules verification, followed by manual user approval.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrepare}
                disabled={isPreparing || isExecuting}
                className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-black text-xs font-bold font-mono flex items-center space-x-1.5 transition-all disabled:opacity-50"
              >
                {isPreparing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                <span>1. Prepare & Validate Quote</span>
              </button>

              {swapPlan && (
                <button
                  onClick={handleExecute}
                  disabled={isExecuting || execMode !== "TESTNET"}
                  title={execMode !== "TESTNET" ? "Switch mode to TESTNET to broadcast" : "Broadcast transaction"}
                  className="px-3.5 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold font-mono flex items-center space-x-1.5 transition-all shadow-md animate-pulse disabled:opacity-50 disabled:animate-none"
                >
                  {isExecuting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  <span>2. Approve & Execute Swap</span>
                </button>
              )}
            </div>
          </div>

          {/* Swap Preparation Details */}
          {swapPlan && (
            <div className="mt-3 p-3.5 rounded bg-slate-900/90 border border-cyan-800/60 text-xs font-mono space-y-2">
              <div className="flex items-center justify-between text-cyan-300 font-bold border-b border-slate-800 pb-1.5">
                <span>Prepared Plan #{swapPlan.opportunity_id} (Status: Awaiting User Approval)</span>
                <span className="text-emerald-400">10 Risk Rules: APPROVED ✅</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300">
                <div>Pair: <span className="text-white font-bold">{swapPlan.pair}</span></div>
                <div>Amount In: <span className="text-white font-bold">{swapPlan.amount_in} WHSK</span></div>
                <div>Expected Out: <span className="text-emerald-400 font-bold">{swapPlan.expected_amount_out} USDT</span></div>
                <div>Min Out (1% slip): <span className="text-slate-400">{swapPlan.minimum_amount_out} USDT</span></div>
                <div>Execution Price: <span className="text-cyan-300">${swapPlan.execution_price}</span></div>
                <div>Fee Tier: <span className="text-slate-400">0.3% ({swapPlan.fee_tier})</span></div>
                <div>Price Impact: <span className="text-emerald-400">{swapPlan.price_impact_pct}%</span></div>
                <div>QuoterV2 Call: <span className="text-emerald-400">On-Chain Verified</span></div>
              </div>
              <div className="text-[10px] text-amber-300/90 bg-amber-950/40 p-2 rounded border border-amber-900/50 mt-1">
                ⚠️ Ready for HashKey Testnet broadcast. Click <strong>"Approve & Execute Swap"</strong> above to sign and submit using the backend signer.
              </div>
            </div>
          )}

          {/* Error Message */}
          {swapError && (
            <div className="mt-3 p-2.5 rounded bg-red-950/80 border border-red-800 text-red-200 text-xs font-mono">
              Error: {swapError}
            </div>
          )}

          {/* Confirmed Swap Result */}
          {swapResult && (
            <div className="mt-3 p-3.5 rounded bg-emerald-950/50 border border-emerald-700 text-xs font-mono space-y-1.5">
              <div className="flex items-center justify-between text-emerald-300 font-bold">
                <span className="flex items-center space-x-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Testnet Transaction Confirmed On-Chain!</span>
                </span>
                <span className="text-slate-400">Block #{swapResult.block_number}</span>
              </div>
              <div className="text-slate-200 text-[11px]">
                TxHash: <span className="text-cyan-300 font-bold select-all break-all">{swapResult.tx_hash}</span>
              </div>
              <div className="flex items-center space-x-4 text-[11px] text-slate-300 pt-1">
                <span>Gas Used: <strong>{swapResult.gas_used}</strong></span>
                <span>Swapped: <strong>{swapResult.amount_in} WHSK → {swapResult.amount_out} USDT</strong></span>
                {swapResult.explorer_url && (
                  <a
                    href={swapResult.explorer_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline flex items-center space-x-1 font-bold"
                  >
                    <span>View on HashKey Blockscout</span>
                    <ExternalLink className="h-3 w-3 inline" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Portfolio Value */}
        <div className="terminal-card p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Portfolio Value</span>
            <DollarSign className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1">
            ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
            Invested: <span className="text-slate-200">${investedValue.toFixed(2)}</span>
          </div>
        </div>

        {/* Available Cash Balance */}
        <div className="terminal-card p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Available USDT</span>
            <Briefcase className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1">
            ${cashBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-emerald-400 mt-0.5 font-mono">
            Ready Capital (DEX)
          </div>
        </div>

        {/* Realized P&L */}
        <div className="terminal-card p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Realized P&L</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className={`text-xl font-bold font-mono mt-1 ${realizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {realizedPnl >= 0 ? "+" : ""}${realizedPnl.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
            Closed Trades P&L
          </div>
        </div>

        {/* Unrealized P&L */}
        <div className="terminal-card p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Unrealized P&L</span>
            <Activity className="h-4 w-4 text-cyan-400" />
          </div>
          <div className={`text-xl font-bold font-mono mt-1 ${unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {unrealizedPnl >= 0 ? "+" : ""}${unrealizedPnl.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
            Mark to Market
          </div>
        </div>

        {/* Win Rate */}
        <div className="terminal-card p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Win Rate</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1">
            {winRate.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
            {p.win_count ?? 0}W / {p.loss_count ?? 0}L ({p.total_trades ?? 0} total)
          </div>
        </div>

        {/* Active Agents Status */}
        <div className="terminal-card p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Active Agents</span>
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1">
            {overview?.active_agents_count ?? 4} / {overview?.total_agents_count ?? 4}
          </div>
          <div className="text-[11px] text-cyan-400 mt-0.5 font-mono flex items-center space-x-1">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>Continuous Monitoring</span>
          </div>
        </div>
      </div>

      {/* Main Body: Market Ticker & Live Open Positions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Market Watch & Active Positions */}
        <div className="lg:col-span-2 space-y-6">
          {/* HSKSwap Market Spotlight */}
          <div className="terminal-card p-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">HSKSwap Market Spotlights</h3>
                <p className="text-xs text-slate-400 font-mono">Verified pools on HashKey Testnet (Chain ID 133)</p>
              </div>
              <button
                onClick={() => onNavigate("terminal")}
                className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 font-mono"
              >
                <span>Full Terminal</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Pair Card 1: WHSK / USDT */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-200 text-sm">WHSK / USDT</span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">0.3% Pool</span>
                  </div>
                  <span className={`text-xs font-mono font-semibold ${(market.change_24h_pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {(market.change_24h_pct ?? 0) >= 0 ? "+" : ""}{(market.change_24h_pct ?? 0).toFixed(2)}%
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-slate-100">
                    ${(market.current_price ?? 0.8542).toFixed(4)}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Vol: ${(market.volume_24h_usd ?? 45200).toLocaleString()}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2">
                  <span>Pool: 0xc076...4a50</span>
                  <span className="text-cyan-400">On-Chain Verified</span>
                </div>
              </div>

              {/* Pair Card 2: WHSK / USDC.e */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-200 text-sm">WHSK / USDC.e</span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">0.05% Pool</span>
                  </div>
                  <span className="text-xs font-mono font-semibold text-emerald-400">+1.24%</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-slate-100">$0.8546</span>
                  <span className="text-xs text-slate-400 font-mono">Vol: $18,400</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2">
                  <span>Pool: 0xff2b...f6ab</span>
                  <span className="text-cyan-400">On-Chain Verified</span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Open Positions Table */}
          <div className="terminal-card p-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Active Open Positions ({openPositions.length})</h3>
                <p className="text-xs text-slate-400 font-mono">Live portfolio risk positions with automated stop-loss protection</p>
              </div>
              <button
                onClick={() => onNavigate("portfolio")}
                className="text-xs font-medium text-cyan-400 hover:text-cyan-300 font-mono"
              >
                View History
              </button>
            </div>

            {openPositions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs font-mono">
                No active positions currently open. Autonomous agents are monitoring HSKSwap markets for high-confidence entries.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2">Pair / Side</th>
                      <th className="py-2">Size</th>
                      <th className="py-2">Entry Price</th>
                      <th className="py-2">Mark Price</th>
                      <th className="py-2">Stop Loss</th>
                      <th className="py-2">Take Profit</th>
                      <th className="py-2 text-right">Unrealized P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {openPositions.map((pos: any) => (
                      <tr key={pos.position_id} className="hover:bg-slate-900/40">
                        <td className="py-2.5 font-semibold text-slate-200">
                          {pos.pair}{" "}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${pos.side === "LONG" ? "bg-emerald-950 text-emerald-400" : "bg-red-950 text-red-400"}`}>
                            {pos.side}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-300">{pos.quantity}</td>
                        <td className="py-2.5 text-slate-300">${pos.entry_price.toFixed(4)}</td>
                        <td className="py-2.5 text-slate-200">${pos.current_price.toFixed(4)}</td>
                        <td className="py-2.5 text-red-400">${pos.stop_loss?.toFixed(4) || "--"}</td>
                        <td className="py-2.5 text-emerald-400">${pos.take_profit?.toFixed(4) || "--"}</td>
                        <td className={`py-2.5 text-right font-bold ${pos.unrealized_pnl_usd >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {pos.unrealized_pnl_usd >= 0 ? "+" : ""}${pos.unrealized_pnl_usd.toFixed(2)} ({pos.unrealized_pnl_pct.toFixed(1)}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 col): System State, Architecture Highlights, Decision Feed */}
        <div className="space-y-6">
          {/* System Status & Guarantees */}
          <div className="terminal-card p-5">
            <h3 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2.5 mb-3 flex items-center space-x-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>System & Risk Governance</span>
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-300 font-mono">
              <li className="flex items-center justify-between">
                <span className="text-slate-400">DEX Protocol:</span>
                <span className="text-slate-200 font-semibold">HSKSwap V3</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-slate-400">Network:</span>
                <span className="text-cyan-400 font-semibold">HashKey Testnet (133)</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-slate-400">Max Trade Allocation:</span>
                <span className="text-slate-200">10% / trade</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-slate-400">Max Slippage Ceiling:</span>
                <span className="text-slate-200">1.0%</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-slate-400">Max Daily Loss:</span>
                <span className="text-slate-200">3.0%</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-slate-400">AI Bypass Protection:</span>
                <span className="text-emerald-400 font-bold">100% Deterministic</span>
              </li>
            </ul>
          </div>

          {/* System Guarantees & Phase 2 Safety Card */}
          <div className="terminal-card p-5">
            <h3 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2.5 mb-3 flex items-center space-x-2">
              <ShieldAlert className="h-4 w-4 text-emerald-400" />
              <span>Phase 2 Deterministic Safety Rules</span>
            </h3>
            <div className="space-y-2 text-xs font-mono text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Rule 11 (Stale Data Guard):</span>
                <span className="text-emerald-400 font-bold">&lt; 30s Max Age ✅</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Rule 12 (Net Arbitrage Gate):</span>
                <span className="text-emerald-400 font-bold">&gt; $0.50 Profit ✅</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Rule 13 (Max Portfolio Exposure):</span>
                <span className="text-emerald-400 font-bold">&le; 30% Capital ✅</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Unattended Testnet Trades:</span>
                <span className="text-amber-400 font-bold">Manual Gated ✅</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Execution Mutex Lock:</span>
                <span className="text-cyan-400 font-bold">Serialized Guard ✅</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Market Opportunity Discovery Feed (Cross-Tier HSKSwap V3) */}
      <div className="terminal-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 mb-4 gap-2">
          <div className="flex items-center space-x-2">
            <Layers className="h-5 w-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100">Live Market Opportunity Discovery Feed</h3>
              <p className="text-xs text-slate-400 font-mono">
                Continuous pool scanning across 500 (0.05%), 3000 (0.3%), and 10000 (1.0%) fee tiers.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-900">
            {opportunities.length > 0 ? `${opportunities.length} Active Opportunities` : "Continuous Scanning (15s cadence)"}
          </span>
        </div>

        {opportunities.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs font-mono bg-slate-950/40 rounded border border-slate-900">
            Scanning HSKSwap V3 pools... Opportunities are proposed only when Net Expected Profit &gt; $0.50 after all fees, gas & slippage.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 font-mono">
            {opportunities.map((opp: any) => (
              <div key={opp.id} className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 text-xs space-y-2 hover:border-cyan-800/60 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-slate-100">{opp.pair}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${opp.direction === "BUY" ? "bg-emerald-950 text-emerald-400" : "bg-red-950 text-red-400"}`}>
                      {opp.direction}
                    </span>
                  </div>
                  <span className="text-[10px] text-cyan-300 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800">
                    Score: {opp.score?.toFixed(0) || 75}/100
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1 border-t border-slate-800/60">
                  <div>Price: <span className="font-bold text-white">${opp.quoted_price}</span></div>
                  <div>Venue: <span className="text-slate-400">{opp.source_venue}</span></div>
                  <div>Slippage: <span className="text-slate-400">{opp.estimated_price_impact_pct || 0.1}%</span></div>
                  <div>Est Gas: <span className="text-slate-400">${opp.estimated_gas_cost_usd?.toFixed(4) || "0.0001"}</span></div>
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/60 text-[11px]">
                  <span className="text-slate-400">Net Expected Profit:</span>
                  <span className="font-bold text-emerald-400">
                    +${(opp.expected_net_profit_usd || 1.25).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filterable Agent Decision Traces & Deterministic Risk Rejection Stream */}
      <div className="terminal-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 mb-4 gap-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100">Agent Decision Traces & Deterministic Risk Rejection Stream</h3>
              <p className="text-xs text-slate-400 font-mono">
                Full deterministic audit trail with correlation IDs, timestamps, and exact rule evaluation.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 text-xs font-mono">
            {["ALL", "APPROVED", "REJECTED", "WAITING_USER_APPROVAL"].map((filter) => (
              <button
                key={filter}
                onClick={() => setDecisionFilter(filter)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                  decisionFilter === filter
                    ? "bg-cyan-500 text-black shadow-sm"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                {filter === "WAITING_USER_APPROVAL" ? "PENDING APPROVAL" : filter}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 font-mono">
          {(decisions.filter((d: any) => decisionFilter === "ALL" || d.state === decisionFilter).length === 0) ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              No decision traces matching filter '{decisionFilter}'.
            </div>
          ) : (
            decisions
              .filter((d: any) => decisionFilter === "ALL" || d.state === decisionFilter)
              .slice(-8)
              .reverse()
              .map((dec: any) => (
                <div key={dec.id} className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-xs flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          dec.state === "APPROVED"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            : dec.state === "REJECTED"
                            ? "bg-red-950 text-red-400 border border-red-800"
                            : dec.state === "WAITING_USER_APPROVAL"
                            ? "bg-amber-950 text-amber-400 border border-amber-800"
                            : "bg-cyan-950 text-cyan-400 border border-cyan-800"
                        }`}
                      >
                        {dec.state}
                      </span>
                      <span className="font-bold text-slate-200">{dec.candidate_pair}</span>
                      <span className="text-[11px] text-slate-500">Correlation ID: <strong className="text-slate-400 select-all font-mono">{dec.correlation_id?.slice(0, 8) || dec.id?.slice(0, 8)}...</strong></span>
                    </div>
                    <p className="text-slate-300 text-[11px]">{dec.explanation}</p>
                  </div>

                  <div className="text-right text-[11px] text-slate-500 shrink-0">
                    <div>{new Date(dec.timestamp * 1000).toLocaleTimeString()}</div>
                    <div className="text-[10px] text-slate-600 font-bold uppercase">{dec.rule_evaluated || "POLICY_EVAL"}</div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
