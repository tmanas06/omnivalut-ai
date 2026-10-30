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

  useEffect(() => {
    fetchRiskPolicy().then((res) => {
      if (res?.policy) setPolicy(res.policy);
    });
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

  // Extract rejected decisions from logs
  const rejectedDecisions = (activityLogs || []).filter((log) => log.state === "REJECTED");

  return (
    <div className="space-y-6">
      {/* Risk Engine Header */}
      <div className="terminal-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
            <Lock className="h-5 w-5 text-emerald-400" />
            <span>Deterministic Risk Management Engine</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Independent mathematical safety layer. AI agents propose trades; the deterministic engine enforces non-negotiable boundaries.
          </p>
        </div>

        {/* Global Circuit Breaker Toggle */}
        <button
          onClick={handleToggleEmergency}
          className={`px-4 py-2 rounded font-bold text-xs font-mono flex items-center space-x-2 border transition ${
            policy.emergency_pause_active
              ? "bg-red-950 text-red-300 border-red-700 animate-pulse"
              : "bg-slate-900 text-slate-300 border-slate-700 hover:border-red-600 hover:text-red-400"
          }`}
        >
          <AlertOctagon className="h-4 w-4" />
          <span>
            {policy.emergency_pause_active ? "CIRCUIT BREAKER: HALTED" : "ENABLE EMERGENCY PAUSE"}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Configurable Rule Sliders */}
        <div className="lg:col-span-2 space-y-5">
          <div className="terminal-card p-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-5">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                <Sliders className="h-4 w-4 text-cyan-400" />
                <span>Deterministic Risk Parameters</span>
              </h3>
              {saveSuccess && (
                <span className="text-xs text-emerald-400 font-mono flex items-center space-x-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Parameters Enforced</span>
                </span>
              )}
            </div>

            <div className="space-y-5">
              {/* Max Trade Allocation */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300 font-semibold">Max Trade Allocation</span>
                  <span className="text-cyan-400 font-bold">{policy.max_trade_allocation_pct}% of capital</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="25"
                  step="0.5"
                  value={policy.max_trade_allocation_pct}
                  onChange={(e) => handleSliderChange("max_trade_allocation_pct", parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 font-mono block">
                  Rejects any proposal seeking more than {policy.max_trade_allocation_pct}% of available portfolio equity.
                </span>
              </div>

              {/* Max Slippage Tolerance */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300 font-semibold">Maximum Slippage Ceiling</span>
                  <span className="text-cyan-400 font-bold">{policy.max_slippage_pct}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.1"
                  value={policy.max_slippage_pct}
                  onChange={(e) => handleSliderChange("max_slippage_pct", parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 font-mono block">
                  Prevents front-running and excessive market impact on shallow DEX liquidity pools.
                </span>
              </div>

              {/* Max Daily Loss */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300 font-semibold">Daily Loss Circuit Breaker</span>
                  <span className="text-red-400 font-bold">{policy.max_daily_loss_pct}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={policy.max_daily_loss_pct}
                  onChange={(e) => handleSliderChange("max_daily_loss_pct", parseFloat(e.target.value))}
                  className="w-full accent-red-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 font-mono block">
                  Immediately halts all new trades if cumulative daily drawdown reaches this threshold.
                </span>
              </div>

              {/* Max Portfolio Drawdown */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300 font-semibold">Max Cumulative Drawdown</span>
                  <span className="text-red-400 font-bold">{policy.max_portfolio_drawdown_pct}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="25"
                  step="1"
                  value={policy.max_portfolio_drawdown_pct}
                  onChange={(e) => handleSliderChange("max_portfolio_drawdown_pct", parseFloat(e.target.value))}
                  className="w-full accent-red-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 font-mono block">
                  Hard floor preventing deep portfolio capital erosion across multi-day drawdowns.
                </span>
              </div>

              {/* Max Concurrent Positions */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300 font-semibold">Max Concurrent Open Positions</span>
                  <span className="text-cyan-400 font-bold">{policy.max_concurrent_positions}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="1"
                  value={policy.max_concurrent_positions}
                  onChange={(e) => handleSliderChange("max_concurrent_positions", parseInt(e.target.value))}
                  className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded cursor-pointer"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end">
                <button
                  onClick={handleSavePolicy}
                  disabled={isSaving}
                  className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-xs font-mono transition"
                >
                  {isSaving ? "Enforcing Rules..." : "Update Risk Policy"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (1 col): Rejected Trades Audit Log */}
        <div className="space-y-5">
          <div className="terminal-card p-5">
            <h3 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2.5 mb-3 flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <XCircle className="h-4 w-4 text-red-400" />
                <span>Rejected Proposals Audit</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {rejectedDecisions.length} Violations
              </span>
            </h3>

            {rejectedDecisions.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs font-mono">
                No risk violations detected. All agent proposals have satisfied current risk bounds.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {rejectedDecisions.slice(-6).reverse().map((dec) => (
                  <div key={dec.id} className="bg-red-950/30 border border-red-900/60 p-3 rounded text-xs font-mono">
                    <div className="flex items-center justify-between text-red-400 mb-1">
                      <span className="font-bold text-[11px]">VIOLATION DETECTED</span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(dec.timestamp * 1000).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">{dec.explanation}</p>
                    <div className="mt-2 text-[10px] text-slate-500 flex justify-between border-t border-red-950/80 pt-1.5">
                      <span>CID: {dec.correlation_id.slice(0, 8)}...</span>
                      <span className="text-red-400">Execution Blocked</span>
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
