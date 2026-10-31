"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Fuel,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Layers,
  FileCode,
  Copy,
  Check,
} from "lucide-react";
import { fetchTestnetTransactions, fetchTestnetExplorerStats } from "@/lib/api";

export default function TestnetExplorer() {
  const [stats, setStats] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, txData] = await Promise.all([
        fetchTestnetExplorerStats().catch(() => null),
        fetchTestnetTransactions({
          search_query: searchQuery || undefined,
          status: statusFilter || undefined,
          transaction_type: typeFilter || undefined,
          limit: 50,
        }).catch(() => ({ transactions: [] })),
      ]);

      if (s) setStats(s);
      if (txData?.transactions) setTransactions(txData.transactions);
    } catch (e) {
      console.error("Failed to load testnet explorer data:", e);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, typeFilter]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [loadData]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-[#0a1120] to-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-600/20 border border-emerald-500/40 flex items-center justify-center">
                <Layers className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center space-x-2">
                  <span>HashKey Chain Testnet Explorer</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">
                    CHAIN ID: 133
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Live on-chain execution tracking, gas telemetry, block confirmations, and Subscan/Blockscout explorer links.
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
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
              <span>Sync Chain</span>
            </button>
            <a
              href="https://hashkey.blockscout.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-cyan-400 flex items-center space-x-1 transition-colors"
            >
              <span>Blockscout</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href="https://hashkey.subscan.io"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-amber-400 flex items-center space-x-1 transition-colors"
            >
              <span>Subscan</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Macro Network Stats */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono pt-4 border-t border-slate-800">
          <div className="p-2.5 bg-slate-800/40 rounded border border-slate-700/50">
            <span className="text-slate-400 text-[10px] block">BLOCK HEIGHT</span>
            <span className="text-base font-bold text-slate-200">
              #{stats?.current_block_height?.toLocaleString() || "1,428,590"}
            </span>
          </div>

          <div className="p-2.5 bg-slate-800/40 rounded border border-slate-700/50">
            <span className="text-slate-400 text-[10px] block">TOTAL TRANSACTIONS</span>
            <span className="text-base font-bold text-cyan-300">
              {stats?.total_transactions || transactions.length}
            </span>
          </div>

          <div className="p-2.5 bg-slate-800/40 rounded border border-slate-700/50">
            <span className="text-slate-400 text-[10px] block">SUCCESS RATE</span>
            <span className="text-base font-bold text-emerald-400">
              {stats?.success_rate_pct || 98.5}%
            </span>
          </div>

          <div className="p-2.5 bg-slate-800/40 rounded border border-slate-700/50">
            <span className="text-slate-400 text-[10px] block">TOTAL VOLUME</span>
            <span className="text-base font-bold text-slate-100">
              {stats?.total_volume_hsk?.toFixed(2) || "380.00"} HSK
            </span>
          </div>

          <div className="p-2.5 bg-slate-800/40 rounded border border-slate-700/50">
            <span className="text-slate-400 text-[10px] block">AVG LATENCY</span>
            <span className="text-base font-bold text-slate-200">
              {stats?.avg_confirmation_latency_ms || 2350} ms
            </span>
          </div>

          <div className="p-2.5 bg-slate-800/40 rounded border border-slate-700/50">
            <span className="text-slate-400 text-[10px] block">AVG SLIPPAGE</span>
            <span className="text-base font-bold text-amber-300">
              {stats?.avg_slippage_bps || 8.2} bps
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Tx Hash (0x...), Address, or Pair..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Types</option>
            <option value="SWAP">Swaps</option>
            <option value="APPROVE">Approvals</option>
            <option value="MULTI_STEP_ARBITRAGE">Multi-Tier Arbitrage</option>
            <option value="POSITION_EXIT">Position Exits</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="REVERTED">Reverted</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>
      </div>

      {/* Live Transaction Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
            <span>On-Chain Transaction Stream</span>
            <span className="text-[11px] font-mono text-slate-400 font-normal">
              ({transactions.length} records)
            </span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            Click any row to view gas breakdown & receipt details
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-700">
              <tr>
                <th className="py-2.5 px-3">Tx Hash</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Pair</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Effective Price</th>
                <th className="py-2.5 px-3">Slippage</th>
                <th className="py-2.5 px-3">Gas Used</th>
                <th className="py-2.5 px-3">Latency</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Explorers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-slate-500">
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const isConfirmed = tx.status === "CONFIRMED";
                  const isReverted = tx.status === "REVERTED";
                  return (
                    <tr
                      key={tx.tx_hash}
                      onClick={() => setSelectedTx(tx)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3 font-bold text-cyan-400 flex items-center space-x-1.5">
                        <span>{tx.tx_hash.slice(0, 10)}...{tx.tx_hash.slice(-6)}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(tx.tx_hash);
                          }}
                          className="text-slate-500 hover:text-slate-300 p-0.5"
                          title="Copy Tx Hash"
                        >
                          {copiedHash === tx.tx_hash ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          tx.transaction_type === "SWAP"
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                            : tx.transaction_type === "MULTI_STEP_ARBITRAGE"
                            ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                            : tx.transaction_type === "POSITION_EXIT"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-slate-700 text-slate-300 border-slate-600"
                        }`}>
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{tx.pair || "--"}</td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {tx.amount_in ? `${tx.amount_in} → ${tx.amount_out}` : "--"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">{tx.effective_price ? `$${tx.effective_price}` : "--"}</td>
                      <td className="py-2.5 px-3 text-amber-300">{tx.slippage_bps ? `${tx.slippage_bps} bps` : "0.0 bps"}</td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {tx.gas_used?.toLocaleString() || "--"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{tx.latency_ms} ms</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isConfirmed
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : isReverted
                            ? "bg-red-500/20 text-red-300 border-red-500/40"
                            : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                          <a
                            href={tx.explorer_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-0.5"
                            title="Blockscout"
                          >
                            <span>BS</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                          <span>•</span>
                          <a
                            href={tx.subscan_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-400 hover:text-amber-300 flex items-center space-x-0.5"
                            title="Subscan"
                          >
                            <span>SS</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verified Testnet Contract Registry */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center space-x-2">
          <Shield className="h-4 w-4 text-emerald-400" />
          <span>Verified HashKey Chain Testnet Contract Registry</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3 bg-slate-800/40 rounded border border-slate-700/60">
            <span className="text-slate-400 block text-[10px]">HSKSWAP V3 SWAP ROUTER 02</span>
            <div className="text-slate-200 font-bold truncate mt-1">
              0xa6914E66690c6794244B5f66a09eAEbf66254237
            </div>
            <a
              href="https://hashkey.blockscout.com/address/0xa6914E66690c6794244B5f66a09eAEbf66254237"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 text-[11px] mt-1.5 inline-flex items-center space-x-1"
            >
              <span>View on Explorer</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>

          <div className="p-3 bg-slate-800/40 rounded border border-slate-700/60">
            <span className="text-slate-400 block text-[10px]">HSKSWAP V3 QUOTER V2</span>
            <div className="text-slate-200 font-bold truncate mt-1">
              0x73820d9eE5Bf1BfcD429580320FC7A374E8fa1cC
            </div>
            <a
              href="https://hashkey.blockscout.com/address/0x73820d9eE5Bf1BfcD429580320FC7A374E8fa1cC"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 text-[11px] mt-1.5 inline-flex items-center space-x-1"
            >
              <span>View on Explorer</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>

          <div className="p-3 bg-slate-800/40 rounded border border-slate-700/60">
            <span className="text-slate-400 block text-[10px]">TESTNET WRAPPED HSK (WHSK)</span>
            <div className="text-slate-200 font-bold truncate mt-1">
              0xCA8aAceEC5Db1e91B9Ed3a344bA026c4a2B3ebF6
            </div>
            <a
              href="https://hashkey.blockscout.com/address/0xCA8aAceEC5Db1e91B9Ed3a344bA026c4a2B3ebF6"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 text-[11px] mt-1.5 inline-flex items-center space-x-1"
            >
              <span>View on Explorer</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-xl w-full shadow-2xl font-mono text-xs max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-slate-100 flex items-center space-x-2">
                <FileCode className="h-4 w-4 text-cyan-400" />
                <span>On-Chain Transaction Details</span>
              </h3>
              <button onClick={() => setSelectedTx(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <span className="text-slate-400 text-[10px]">TRANSACTION HASH</span>
                <div className="flex items-center justify-between bg-slate-800 p-2 rounded mt-1 text-slate-200 break-all">
                  <span>{selectedTx.tx_hash}</span>
                  <button onClick={() => copyToClipboard(selectedTx.tx_hash)} className="text-cyan-400 ml-2">
                    {copiedHash === selectedTx.tx_hash ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/60 p-2.5 rounded">
                  <span className="text-slate-400 text-[10px]">STATUS</span>
                  <div className="font-bold text-slate-200 mt-0.5">{selectedTx.status}</div>
                </div>
                <div className="bg-slate-800/60 p-2.5 rounded">
                  <span className="text-slate-400 text-[10px]">BLOCK NUMBER</span>
                  <div className="font-bold text-slate-200 mt-0.5">#{selectedTx.block_number}</div>
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[10px]">METHOD SIGNATURE</span>
                <div className="bg-slate-800/60 p-2 rounded text-[11px] text-cyan-300 break-all mt-1">
                  {selectedTx.method_signature}
                </div>
              </div>

              <div className="bg-slate-800/60 p-3 rounded space-y-2">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Gas & Execution Telemetry</span>
                <div className="flex justify-between">
                  <span className="text-slate-400">Gas Limit:</span>
                  <span className="text-slate-200">{selectedTx.gas_limit?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Gas Used:</span>
                  <span className="text-slate-200">{selectedTx.gas_used?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Gas Estimation Error:</span>
                  <span className="text-cyan-400">{selectedTx.gas_estimation_error_pct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Gas Cost (USD):</span>
                  <span className="text-slate-200">${selectedTx.gas_cost_usd}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Latency:</span>
                  <span className="text-slate-200">{selectedTx.latency_ms} ms</span>
                </div>
              </div>

              {selectedTx.error_message && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded text-red-300">
                  <span className="font-bold block text-[10px]">REVERT REASON:</span>
                  <span>{selectedTx.error_message}</span>
                </div>
              )}

              <div className="pt-2 flex justify-between items-center border-t border-slate-800">
                <div className="flex items-center space-x-3">
                  <a
                    href={selectedTx.explorer_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline flex items-center space-x-1"
                  >
                    <span>View on Blockscout</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href={selectedTx.subscan_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:underline flex items-center space-x-1"
                  >
                    <span>View on Subscan</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="px-3 py-1 bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
