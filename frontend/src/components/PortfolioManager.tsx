"use client";

import React, { useState } from "react";
import { Briefcase, CheckCircle, TrendingUp, TrendingDown, Clock, ShieldCheck } from "lucide-react";

interface PortfolioProps {
  portfolioData: any;
}

export default function PortfolioManager({ portfolioData }: PortfolioProps) {
  const [activeTab, setActiveTab] = useState<"OPEN" | "CLOSED">("OPEN");
  const p = portfolioData || {};
  const openPositions = p.open_positions || [];
  const closedTrades = p.recent_trades || [];

  return (
    <div className="space-y-6">
      {/* Portfolio Header Bar */}
      <div className="terminal-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
            <Briefcase className="h-5 w-5 text-cyan-400" />
            <span>Portfolio Accounting & Reconciliation</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Realized & unrealized P&L reconciled against on-chain HashKey Testnet holdings.
          </p>
        </div>

        <div className="flex items-center space-x-4 text-xs font-mono">
          <div className="text-right">
            <span className="text-slate-500 block text-[10px]">Realized P&L</span>
            <span className={`font-bold ${(p.realized_pnl_usd ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {(p.realized_pnl_usd ?? 0) >= 0 ? "+" : ""}${(p.realized_pnl_usd ?? 0).toFixed(2)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 block text-[10px]">Unrealized P&L</span>
            <span className={`font-bold ${(p.unrealized_pnl_usd ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {(p.unrealized_pnl_usd ?? 0) >= 0 ? "+" : ""}${(p.unrealized_pnl_usd ?? 0).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-800 pb-2 text-xs font-mono">
        <button
          onClick={() => setActiveTab("OPEN")}
          className={`px-3 py-1.5 rounded-md font-semibold transition ${
            activeTab === "OPEN"
              ? "bg-slate-800 text-cyan-300 border border-slate-700"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Open Positions ({openPositions.length})
        </button>
        <button
          onClick={() => setActiveTab("CLOSED")}
          className={`px-3 py-1.5 rounded-md font-semibold transition ${
            activeTab === "CLOSED"
              ? "bg-slate-800 text-cyan-300 border border-slate-700"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Closed Trades History ({closedTrades.length})
        </button>
      </div>

      {/* Tables */}
      {activeTab === "OPEN" ? (
        <div className="terminal-card p-5">
          {openPositions.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs font-mono">
              No open positions held. Autonomous agents will allocate capital once favorable market conditions align.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5">Pair</th>
                    <th className="py-2.5">Side</th>
                    <th className="py-2.5">Quantity</th>
                    <th className="py-2.5">Entry Price</th>
                    <th className="py-2.5">Current Price</th>
                    <th className="py-2.5">Stop Loss</th>
                    <th className="py-2.5">Take Profit</th>
                    <th className="py-2.5">Opened</th>
                    <th className="py-2.5 text-right">Unrealized P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {openPositions.map((pos: any) => (
                    <tr key={pos.position_id} className="hover:bg-slate-900/40">
                      <td className="py-3 font-bold text-slate-100">{pos.pair}</td>
                      <td className="py-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            pos.side === "LONG"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-900"
                              : "bg-red-950 text-red-400 border border-red-900"
                          }`}
                        >
                          {pos.side}
                        </span>
                      </td>
                      <td className="py-3 text-slate-300">{pos.quantity.toFixed(4)}</td>
                      <td className="py-3 text-slate-300">${pos.entry_price.toFixed(4)}</td>
                      <td className="py-3 text-slate-200">${pos.current_price.toFixed(4)}</td>
                      <td className="py-3 text-red-400">${pos.stop_loss?.toFixed(4) || "--"}</td>
                      <td className="py-3 text-emerald-400">${pos.take_profit?.toFixed(4) || "--"}</td>
                      <td className="py-3 text-slate-500 text-[11px]">{new Date(pos.opened_at).toLocaleTimeString()}</td>
                      <td className={`py-3 text-right font-bold ${pos.unrealized_pnl_usd >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {pos.unrealized_pnl_usd >= 0 ? "+" : ""}${pos.unrealized_pnl_usd.toFixed(2)} ({pos.unrealized_pnl_pct.toFixed(1)}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="terminal-card p-5">
          {closedTrades.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs font-mono">
              No closed trade records in current session.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5">Pair</th>
                    <th className="py-2.5">Side</th>
                    <th className="py-2.5">Entry Price</th>
                    <th className="py-2.5">Exit Price</th>
                    <th className="py-2.5">Quantity</th>
                    <th className="py-2.5">Mode</th>
                    <th className="py-2.5">Exit Time</th>
                    <th className="py-2.5 text-right">Realized P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {closedTrades.map((t: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="py-3 font-bold text-slate-100">{t.pair}</td>
                      <td className="py-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                          {t.side}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400">${t.entry_price?.toFixed(4)}</td>
                      <td className="py-3 text-slate-200">${t.exit_price?.toFixed(4)}</td>
                      <td className="py-3 text-slate-300">{t.quantity?.toFixed(4)}</td>
                      <td className="py-3">
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          {t.is_simulated ? "Paper" : "Testnet"}
                        </span>
                      </td>
                      <td className="py-3 text-slate-500 text-[11px]">
                        {t.closed_at ? new Date(t.closed_at * 1000).toLocaleTimeString() : "--"}
                      </td>
                      <td className={`py-3 text-right font-bold ${t.realized_pnl_usd >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {t.realized_pnl_usd >= 0 ? "+" : ""}${t.realized_pnl_usd.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
