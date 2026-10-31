"use client";

import React, { useState } from "react";
import { Briefcase, CheckCircle, TrendingUp, TrendingDown, Clock, ShieldCheck, Layers, Activity } from "lucide-react";

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
      <div className="fintech-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-[#202838] border border-[#2A3445] flex items-center justify-center text-[#3B82F6]">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-semibold text-[#F1F5F9] tracking-tight">
                  Portfolio Accounting &amp; Reconciliation
                </h1>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#202838] text-[#10B981] border border-[#2A3445] font-medium">
                  Disk Sync Active
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Realized and unrealized P&amp;L continuously reconciled against on-chain HashKey Testnet holdings.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-5 text-xs">
            <div className="text-right">
              <span className="text-[#94A3B8] block text-[10px] font-medium">REALIZED P&amp;L</span>
              <span className={`text-base font-semibold num-tabular ${(p.realized_pnl_usd ?? 0) >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                {(p.realized_pnl_usd ?? 0) >= 0 ? "+" : ""}${(p.realized_pnl_usd ?? 0).toFixed(2)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[#94A3B8] block text-[10px] font-medium">UNREALIZED P&amp;L</span>
              <span className={`text-base font-semibold num-tabular ${(p.unrealized_pnl_usd ?? 0) >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                {(p.unrealized_pnl_usd ?? 0) >= 0 ? "+" : ""}${(p.unrealized_pnl_usd ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1 border-b border-[#2A3445] pb-2 text-xs">
        <button
          onClick={() => setActiveTab("OPEN")}
          className={`px-3.5 py-1.5 rounded-lg font-medium transition ${
            activeTab === "OPEN"
              ? "bg-[#3B82F6] text-white"
              : "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#202838]"
          }`}
        >
          Open Positions ({openPositions.length})
        </button>
        <button
          onClick={() => setActiveTab("CLOSED")}
          className={`px-3.5 py-1.5 rounded-lg font-medium transition ${
            activeTab === "CLOSED"
              ? "bg-[#3B82F6] text-white"
              : "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#202838]"
          }`}
        >
          Closed Trades History ({closedTrades.length})
        </button>
      </div>

      {/* Tables */}
      {activeTab === "OPEN" ? (
        <div className="fintech-card overflow-hidden">
          {openPositions.length === 0 ? (
            <div className="text-center py-12 text-[#94A3B8] text-xs">
              No open positions held. Autonomous agents will allocate capital once favorable market conditions align.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#151922] text-[#94A3B8] border-b border-[#2A3445]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Pair</th>
                    <th className="py-3 px-4 font-medium">Side</th>
                    <th className="py-3 px-4 font-medium text-right">Quantity</th>
                    <th className="py-3 px-4 font-medium text-right">Entry Price</th>
                    <th className="py-3 px-4 font-medium text-right">Current Price</th>
                    <th className="py-3 px-4 font-medium text-right">Stop Loss</th>
                    <th className="py-3 px-4 font-medium text-right">Take Profit</th>
                    <th className="py-3 px-4 font-medium text-center">Holding / Max</th>
                    <th className="py-3 px-4 font-medium text-center">Mode</th>
                    <th className="py-3 px-4 font-medium text-right">Unrealized P&amp;L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A3445]">
                  {openPositions.map((pos: any) => (
                    <tr key={pos.position_id} className="hover:bg-[#202838]/50 transition">
                      <td className="py-3 px-4 font-semibold text-[#F1F5F9]">{pos.pair}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                            pos.side === "LONG"
                              ? "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30"
                              : "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30"
                          }`}
                        >
                          {pos.side}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-[#F1F5F9] num-tabular">{pos.quantity.toFixed(4)}</td>
                      <td className="py-3 px-4 text-right text-[#94A3B8] num-tabular">${pos.entry_price.toFixed(4)}</td>
                      <td className="py-3 px-4 text-right font-medium text-[#F1F5F9] num-tabular">${pos.current_price.toFixed(4)}</td>
                      <td className="py-3 px-4 text-right text-[#EF4444] num-tabular">${pos.stop_loss?.toFixed(4) || "--"}</td>
                      <td className="py-3 px-4 text-right text-[#10B981] num-tabular">${pos.take_profit?.toFixed(4) || "--"}</td>
                      <td className="py-3 px-4 text-center text-[#94A3B8]">
                        {pos.holding_duration_seconds ? (pos.holding_duration_seconds / 60).toFixed(0) : 0}m / {((pos.max_holding_seconds || 3600) / 60).toFixed(0)}m
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#202838] text-[#94A3B8] border border-[#2A3445] font-medium">
                          {pos.is_simulated ? "PAPER" : "TESTNET"}
                        </span>
                      </td>
                      <td className={`py-3 px-4 text-right font-semibold num-tabular ${pos.unrealized_pnl_usd >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
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
        <div className="fintech-card overflow-hidden">
          {closedTrades.length === 0 ? (
            <div className="text-center py-12 text-[#94A3B8] text-xs">
              No closed trade records in current session.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#151922] text-[#94A3B8] border-b border-[#2A3445]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Pair</th>
                    <th className="py-3 px-4 font-medium">Side</th>
                    <th className="py-3 px-4 font-medium text-right">Entry Price</th>
                    <th className="py-3 px-4 font-medium text-right">Exit Price</th>
                    <th className="py-3 px-4 font-medium text-right">Quantity</th>
                    <th className="py-3 px-4 font-medium">Exit Reason</th>
                    <th className="py-3 px-4 font-medium text-center">Mode</th>
                    <th className="py-3 px-4 font-medium text-center">Exit Time</th>
                    <th className="py-3 px-4 font-medium text-right">Realized P&amp;L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A3445]">
                  {closedTrades.map((t: any, idx: number) => (
                    <tr key={idx} className="hover:bg-[#202838]/50 transition">
                      <td className="py-3 px-4 font-semibold text-[#F1F5F9]">{t.pair}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-[#202838] text-[#94A3B8] font-medium border border-[#2A3445]">
                          {t.side}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-[#94A3B8] num-tabular">${t.entry_price?.toFixed(4)}</td>
                      <td className="py-3 px-4 text-right text-[#F1F5F9] font-medium num-tabular">${t.exit_price?.toFixed(4)}</td>
                      <td className="py-3 px-4 text-right text-[#94A3B8] num-tabular">{t.quantity?.toFixed(4)}</td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#3B82F6]/10 text-[#60A5FA] border border-[#3B82F6]/30 font-medium">
                          {t.exit_reason || "MANUAL_CLOSE"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-[#202838] text-[#94A3B8] border border-[#2A3445] font-medium">
                          {t.is_simulated ? "Paper" : "Testnet"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-[#94A3B8] text-[11px]">
                        {t.closed_at ? new Date(t.closed_at * 1000).toLocaleTimeString() : "--"}
                      </td>
                      <td className={`py-3 px-4 text-right font-semibold num-tabular ${t.realized_pnl_usd >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
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
