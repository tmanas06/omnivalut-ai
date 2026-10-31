"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertOctagon,
  Sliders,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
  Zap,
  Check
} from "lucide-react";
import { fetchRiskPolicy, updateRiskPolicy, toggleEmergencyPause } from "@/lib/api";

interface RiskProps {
  onRefresh: () => void;
  activityLogs: any[];
}

export default function RiskCenter({ onRefresh, activityLogs }: RiskProps) {
  const [policy, setPolicy] = useState<any>({
    max_trade_allocation_pct: 10.0,
    max_slippage_pct: 1.0,
    max_daily_loss_pct: 3.0,
    max_portfolio_drawdown_pct: 10.0,
    max_concurrent_positions: 3,
    max_gas_cost_usd: 2.5,
    emergency_pause_active: false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>("sizing");

  useEffect(() => {
    fetchRiskPolicy()
      .then((res) => {
        if (res?.policy) setPolicy(res.policy);
      })
      .catch((e) => console.debug("Risk policy fetch:", e));
  }, []);

  const handleSliderChange = (key: string, val: number) => {
    setPolicy((prev: any) => ({ ...prev, [key]: val }));
    setSaveSuccess(false);
  };

  const handleSavePolicy = async () => {
    setIsSaving(true);
    try {
      await updateRiskPolicy({
        max_trade_allocation_pct: policy.max_trade_allocation_pct,
        max_slippage_pct: policy.max_slippage_pct,
        max_daily_loss_pct: policy.max_daily_loss_pct,
        max_portfolio_drawdown_pct: policy.max_portfolio_drawdown_pct,
        max_concurrent_positions: policy.max_concurrent_positions,
        max_gas_cost_usd: policy.max_gas_cost_usd,
      });
      setSaveSuccess(true);
      onRefresh();
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (e) {
      console.error("Save risk policy failed:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEmergency = async () => {
    const newState = !policy.emergency_pause_active;
    try {
      await toggleEmergencyPause(newState);
      setPolicy((prev: any) => ({ ...prev, emergency_pause_active: newState }));
      onRefresh();
    } catch (e) {
      console.error("Toggle pause failed:", e);
    }
  };

  // Filter rejected decisions
  const rejectedDecisions = (activityLogs || []).filter((log) => log.state === "REJECTED");

  const toggleCategory = (cat: string) => {
    setExpandedCategory(expandedCategory === cat ? null : cat);
  };

  const riskRuleGroups = [
    {
      id: "sizing",
      name: "Capital Allocation & Sizing",
      description: "Rules 1-3: Absolute position boundaries and portfolio concentration limits",
      rules: [
        { id: "R1", name: "Max Single Position Size", detail: `Limited to ${policy.max_trade_allocation_pct}% of total equity. Hard ceiling blocks oversized allocation.` },
        { id: "R2", name: "Max Concurrent Positions", detail: `Capped at ${policy.max_concurrent_positions} concurrent positions. Additional signals queued or discarded.` },
        { id: "R3", name: "Single Asset Concentration", detail: "Maximum 30% aggregate exposure per individual token pair across all strategies." },
      ]
    },
    {
      id: "drawdown",
      name: "Drawdown & Circuit Breakers",
      description: "Rules 4-6: Automated liquidation triggers and cumulative loss prevention",
      rules: [
        { id: "R4", name: "Daily Loss Circuit Breaker", detail: `Immediate trading halt if cumulative daily loss reaches ${policy.max_daily_loss_pct}%.` },
        { id: "R5", name: "Peak-to-Trough Drawdown Guard", detail: `Hard stop on new capital deployment if peak drawdown reaches ${policy.max_portfolio_drawdown_pct}%.` },
        { id: "R6", name: "Rapid Volatility Circuit Breaker", detail: "Automatic 15-minute trading cooldown during extreme 1-minute candle price dislocations (>5%)." },
      ]
    },
    {
      id: "microstructure",
      name: "Market Microstructure & Slippage",
      description: "Rules 7-10: On-chain AMM liquidity, price impact, and gas validation",
      rules: [
        { id: "R7", name: "Max Slippage Ceiling", detail: `Hard threshold of ${policy.max_slippage_pct}%. Executable QuoterV2 quote must be within bounds.` },
        { id: "R8", name: "Price Impact Threshold", detail: "Transactions rejected if estimated AMM tick pool price impact exceeds 0.50%." },
        { id: "R9", name: "Liquidity Depth Floor", detail: "Pools with active in-range liquidity under $10,000 equivalent are marked ineligible." },
        { id: "R10", name: "Gas Spike Protection", detail: `Transactions paused if estimated gas exceeds $${policy.max_gas_cost_usd} or base fee exceeds 50 Gwei.` },
      ]
    },
    {
      id: "custody",
      name: "Custody, Safety & Whitelist",
      description: "Rules 11-13: Contract verification and strict network barriers",
      rules: [
        { id: "R11", name: "Non-Custodial Signer Check", detail: "Private keys never leave encrypted server memory. Client approvals require EIP-712 / Web3." },
        { id: "R12", name: "Verified Contract Whitelist", detail: "Executions strictly restricted to verified HSKSwap V3 Router & Quoter contract addresses." },
        { id: "R13", name: "Strict Mainnet Protection", detail: "Mainnet trading permanently disabled in software build. HashKey Testnet (133) only." },
      ]
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="fintech-card p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-[#202838] border border-[#2A3445] flex items-center justify-center text-[#10B981]">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-semibold text-[#F1F5F9] tracking-tight">
                  Risk Center &amp; Safety Engine
                </h1>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#202838] text-[#10B981] border border-[#2A3445] font-medium">
                  13 Deterministic Rules
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Mathematical safety layer operating independently of AI agents. Non-negotiable execution boundaries.
              </p>
            </div>
          </div>

          {/* Global Circuit Breaker Toggle */}
          <button
            onClick={handleToggleEmergency}
            className={`px-4 py-2 rounded-lg font-medium text-xs flex items-center space-x-2 border transition ${
              policy.emergency_pause_active
                ? "bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/40 animate-pulse"
                : "bg-[#202838] text-[#F1F5F9] border-[#2A3445] hover:border-[#EF4444]/50 hover:text-[#EF4444]"
            }`}
          >
            <AlertOctagon className="h-4 w-4" />
            <span>
              {policy.emergency_pause_active ? "CIRCUIT BREAKER: HALTED" : "EMERGENCY HALT"}
            </span>
          </button>
        </div>
      </div>

      {/* Top 4 Priority Risk Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="fintech-card p-4">
          <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-1">
            <span>Circuit Breaker</span>
            <ShieldCheck className="h-4 w-4 text-[#10B981]" />
          </div>
          <div className="text-xl font-semibold text-[#F1F5F9] flex items-center space-x-2">
            <span className={`h-2 w-2 rounded-full ${policy.emergency_pause_active ? "bg-[#EF4444]" : "bg-[#10B981]"}`}></span>
            <span>{policy.emergency_pause_active ? "SYSTEM HALTED" : "ACTIVE / NORMAL"}</span>
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-1">Rule 4 &amp; 6 automated triggers active</p>
        </div>

        <div className="fintech-card p-4">
          <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-1">
            <span>Daily Loss Limit</span>
            <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
          </div>
          <div className="text-2xl font-semibold text-[#F1F5F9] num-tabular">
            {policy.max_daily_loss_pct}%
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-1">Cumulative intraday drawdown threshold</p>
        </div>

        <div className="fintech-card p-4">
          <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-1">
            <span>Max Position Sizing</span>
            <Layers className="h-4 w-4 text-[#3B82F6]" />
          </div>
          <div className="text-2xl font-semibold text-[#F1F5F9] num-tabular">
            {policy.max_trade_allocation_pct}%
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-1">Max equity per proposed signal</p>
        </div>

        <div className="fintech-card p-4">
          <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-1">
            <span>Slippage Ceiling</span>
            <Activity className="h-4 w-4 text-[#60A5FA]" />
          </div>
          <div className="text-2xl font-semibold text-[#F1F5F9] num-tabular">
            {policy.max_slippage_pct}%
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-1">QuoterV2 execution buffer</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Parameter Controls & Categorized Rules */}
        <div className="lg:col-span-2 space-y-6">
          {/* Policy Sliders Card */}
          <div className="fintech-card p-5">
            <div className="flex items-center justify-between border-b border-[#2A3445] pb-3 mb-5">
              <div className="flex items-center space-x-2">
                <Sliders className="h-4 w-4 text-[#3B82F6]" />
                <h2 className="text-sm font-semibold text-[#F1F5F9]">Enforced Parameter Controls</h2>
              </div>
              {saveSuccess && (
                <span className="text-xs text-[#10B981] font-medium flex items-center space-x-1">
                  <Check className="h-3.5 w-3.5" />
                  <span>Parameters Enforced</span>
                </span>
              )}
            </div>

            <div className="space-y-5">
              {/* Max Trade Allocation */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#F1F5F9] font-medium">Max Trade Allocation</span>
                  <span className="text-[#3B82F6] font-semibold num-tabular">{policy.max_trade_allocation_pct}% of capital</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="25"
                  step="0.5"
                  value={policy.max_trade_allocation_pct}
                  onChange={(e) => handleSliderChange("max_trade_allocation_pct", parseFloat(e.target.value))}
                  className="w-full accent-[#3B82F6] bg-[#202838] h-1.5 rounded cursor-pointer"
                />
                <span className="text-[11px] text-[#94A3B8] block">
                  Rejects any signal requesting &gt; {policy.max_trade_allocation_pct}% of current portfolio equity.
                </span>
              </div>

              {/* Max Slippage Tolerance */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#F1F5F9] font-medium">Maximum Slippage Ceiling</span>
                  <span className="text-[#3B82F6] font-semibold num-tabular">{policy.max_slippage_pct}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.1"
                  value={policy.max_slippage_pct}
                  onChange={(e) => handleSliderChange("max_slippage_pct", parseFloat(e.target.value))}
                  className="w-full accent-[#3B82F6] bg-[#202838] h-1.5 rounded cursor-pointer"
                />
                <span className="text-[11px] text-[#94A3B8] block">
                  Prevents front-running and excessive execution drift across DEX pools.
                </span>
              </div>

              {/* Max Daily Loss */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#F1F5F9] font-medium">Daily Loss Circuit Breaker</span>
                  <span className="text-[#EF4444] font-semibold num-tabular">{policy.max_daily_loss_pct}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={policy.max_daily_loss_pct}
                  onChange={(e) => handleSliderChange("max_daily_loss_pct", parseFloat(e.target.value))}
                  className="w-full accent-[#EF4444] bg-[#202838] h-1.5 rounded cursor-pointer"
                />
                <span className="text-[11px] text-[#94A3B8] block">
                  Immediately halts autonomous cycle if cumulative daily loss reaches this limit.
                </span>
              </div>

              {/* Max Portfolio Drawdown */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#F1F5F9] font-medium">Max Cumulative Drawdown</span>
                  <span className="text-[#EF4444] font-semibold num-tabular">{policy.max_portfolio_drawdown_pct}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="25"
                  step="1"
                  value={policy.max_portfolio_drawdown_pct}
                  onChange={(e) => handleSliderChange("max_portfolio_drawdown_pct", parseFloat(e.target.value))}
                  className="w-full accent-[#EF4444] bg-[#202838] h-1.5 rounded cursor-pointer"
                />
                <span className="text-[11px] text-[#94A3B8] block">
                  Hard ceiling protecting principal against multi-day adverse regime shifts.
                </span>
              </div>

              {/* Max Concurrent Positions */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#F1F5F9] font-medium">Max Concurrent Open Positions</span>
                  <span className="text-[#3B82F6] font-semibold num-tabular">{policy.max_concurrent_positions}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="1"
                  value={policy.max_concurrent_positions}
                  onChange={(e) => handleSliderChange("max_concurrent_positions", parseInt(e.target.value))}
                  className="w-full accent-[#3B82F6] bg-[#202838] h-1.5 rounded cursor-pointer"
                />
              </div>

              <div className="pt-3 border-t border-[#2A3445] flex justify-end">
                <button
                  onClick={handleSavePolicy}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-blue-600 text-white font-medium text-xs transition disabled:opacity-50"
                >
                  {isSaving ? "Enforcing Rules..." : "Update Risk Policy"}
                </button>
              </div>
            </div>
          </div>

          {/* Deterministic 13 Rules - Categorized & Structured */}
          <div className="fintech-card p-5">
            <div className="pb-3 border-b border-[#2A3445] mb-4">
              <h2 className="text-sm font-semibold text-[#F1F5F9]">
                13 Deterministic Safety Rules (Progressive Disclosure)
              </h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Organized into 4 functional defensive layers. Click to inspect technical parameters.
              </p>
            </div>

            <div className="space-y-3">
              {riskRuleGroups.map((group) => {
                const isExpanded = expandedCategory === group.id;
                return (
                  <div key={group.id} className="rounded-xl border border-[#2A3445] bg-[#151922] overflow-hidden">
                    <button
                      onClick={() => toggleCategory(group.id)}
                      className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#202838]/50 transition"
                    >
                      <div>
                        <span className="text-xs font-semibold text-[#F1F5F9] block">{group.name}</span>
                        <span className="text-[11px] text-[#94A3B8]">{group.description}</span>
                      </div>
                      <div className="text-[#94A3B8]">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-3.5 pt-1 space-y-2 border-t border-[#2A3445]/60 text-xs">
                        {group.rules.map((rule) => (
                          <div key={rule.id} className="p-2.5 rounded-lg bg-[#191F2B] border border-[#2A3445]/60 flex items-start space-x-2.5">
                            <span className="px-1.5 py-0.5 rounded bg-[#202838] border border-[#2A3445] text-[#3B82F6] font-mono text-[10px] font-semibold shrink-0 mt-0.5">
                              {rule.id}
                            </span>
                            <div>
                              <span className="font-medium text-[#F1F5F9]">{rule.name}</span>
                              <p className="text-[#94A3B8] text-[11px] mt-0.5 leading-relaxed">{rule.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (1 col): Rejected Proposals Audit Feed */}
        <div className="space-y-5">
          <div className="fintech-card p-5">
            <div className="border-b border-[#2A3445] pb-3 mb-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <XCircle className="h-4 w-4 text-[#EF4444]" />
                <h2 className="text-sm font-semibold text-[#F1F5F9]">Rejected Signals Audit</h2>
              </div>
              <span className="text-[11px] text-[#94A3B8] font-medium">
                {rejectedDecisions.length} Violations
              </span>
            </div>

            {rejectedDecisions.length === 0 ? (
              <div className="text-center py-12 text-[#94A3B8] text-xs">
                No risk violations detected. All agent proposals have satisfied current risk bounds.
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {rejectedDecisions.slice(-6).reverse().map((dec) => (
                  <div key={dec.id} className="bg-[#EF4444]/5 border border-[#EF4444]/30 p-3 rounded-xl text-xs">
                    <div className="flex items-center justify-between text-[#EF4444] mb-1">
                      <span className="font-semibold text-[11px]">VIOLATION DETECTED</span>
                      <span className="text-[10px] text-[#94A3B8]">
                        {new Date(dec.timestamp * 1000).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-[#F1F5F9] text-[11px] leading-relaxed">{dec.explanation}</p>
                    <div className="mt-2 text-[10px] text-[#94A3B8] flex justify-between border-t border-[#2A3445] pt-1.5 font-mono">
                      <span>CID: {dec.correlation_id?.slice(0, 8)}...</span>
                      <span className="text-[#EF4444] font-medium">Blocked</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
