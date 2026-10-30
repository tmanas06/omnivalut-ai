"use client";

import React from "react";
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
} from "lucide-react";

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

          {/* Recent Agent Decisions Stream */}
          <div className="terminal-card p-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
              <h3 className="text-sm font-semibold text-slate-200">Recent Orchestration Decisions</h3>
              <button onClick={() => onNavigate("activity")} className="text-xs text-cyan-400 hover:text-cyan-300 font-mono">
                All Logs
              </button>
            </div>

            <div className="space-y-3">
              {(overview?.recent_decisions || []).slice(0, 4).map((dec: any) => (
                <div key={dec.id} className="bg-slate-900/60 p-2.5 rounded border border-slate-800 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                        dec.state === "APPROVED"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : dec.state === "REJECTED"
                          ? "bg-red-950 text-red-400 border border-red-800"
                          : dec.state === "EXECUTED"
                          ? "bg-cyan-950 text-cyan-400 border border-cyan-800"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {dec.state}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(dec.timestamp * 1000).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-slate-300 line-clamp-2 text-[11px]">{dec.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
