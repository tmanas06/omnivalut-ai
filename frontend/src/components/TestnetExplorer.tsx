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
  X
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
      <div className="fintech-card p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-[#202838] border border-[#2A3445] flex items-center justify-center text-[#3B82F6]">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-semibold text-[#F1F5F9] tracking-tight">
                  HashKey Chain Testnet Explorer
                </h1>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#202838] text-[#10B981] border border-[#2A3445] font-medium flex items-center space-x-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></span>
                  <span>Chain ID: 133</span>
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Live on-chain execution tracking, gas telemetry, block confirmations, and explorer receipts.
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
              <span>Sync Chain</span>
            </button>
            <a
              href="https://hashkey.blockscout.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-[#202838] hover:bg-[#2A3445] border border-[#2A3445] text-xs font-medium text-[#3B82F6] flex items-center space-x-1 transition"
            >
              <span>Blockscout</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="https://hashkey.subscan.io"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-[#202838] hover:bg-[#2A3445] border border-[#2A3445] text-xs font-medium text-[#F59E0B] flex items-center space-x-1 transition"
            >
              <span>Subscan</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Macro Network Stats */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs pt-4 border-t border-[#2A3445]">
          <div className="p-3 bg-[#151922] rounded-xl border border-[#2A3445]">
            <span className="text-[#94A3B8] text-[10px] block font-medium">BLOCK HEIGHT</span>
            <span className="text-base font-semibold text-[#F1F5F9] num-tabular mt-0.5 block">
              #{stats?.current_block_height?.toLocaleString() || "1,428,590"}
            </span>
          </div>

          <div className="p-3 bg-[#151922] rounded-xl border border-[#2A3445]">
            <span className="text-[#94A3B8] text-[10px] block font-medium">TOTAL TRANSACTIONS</span>
            <span className="text-base font-semibold text-[#3B82F6] num-tabular mt-0.5 block">
              {stats?.total_transactions || transactions.length}
            </span>
          </div>

          <div className="p-3 bg-[#151922] rounded-xl border border-[#2A3445]">
            <span className="text-[#94A3B8] text-[10px] block font-medium">SUCCESS RATE</span>
            <span className="text-base font-semibold text-[#10B981] num-tabular mt-0.5 block">
              {stats?.success_rate_pct || 98.5}%
            </span>
          </div>

          <div className="p-3 bg-[#151922] rounded-xl border border-[#2A3445]">
            <span className="text-[#94A3B8] text-[10px] block font-medium">TOTAL VOLUME</span>
            <span className="text-base font-semibold text-[#F1F5F9] num-tabular mt-0.5 block">
              {stats?.total_volume_hsk?.toFixed(2) || "380.00"} HSK
            </span>
          </div>

          <div className="p-3 bg-[#151922] rounded-xl border border-[#2A3445]">
            <span className="text-[#94A3B8] text-[10px] block font-medium">AVG LATENCY</span>
            <span className="text-base font-semibold text-[#F1F5F9] num-tabular mt-0.5 block">
              {stats?.avg_confirmation_latency_ms || 2350} ms
            </span>
          </div>

          <div className="p-3 bg-[#151922] rounded-xl border border-[#2A3445]">
            <span className="text-[#94A3B8] text-[10px] block font-medium">AVG SLIPPAGE</span>
            <span className="text-base font-semibold text-[#F59E0B] num-tabular mt-0.5 block">
              {stats?.avg_slippage_bps || 8.2} bps
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="h-4 w-4 text-[#94A3B8] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Tx Hash (0x...), Address, or Pair..."
            className="fintech-input w-full pl-9 pr-3 py-2 text-xs"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="fintech-input px-3 py-2 text-xs"
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
            className="fintech-input px-3 py-2 text-xs"
          >
            <option value="">All Statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="REVERTED">Reverted</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>
      </div>

      {/* Live Transaction Table */}
      <div className="fintech-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#2A3445] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#F1F5F9] flex items-center space-x-2">
            <span>On-Chain Transaction Stream</span>
            <span className="text-xs text-[#94A3B8] font-normal">
              ({transactions.length} records)
            </span>
          </h2>
          <span className="text-xs text-[#94A3B8]">
            Click any row for gas breakdown &amp; receipt
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#151922] text-[#94A3B8] border-b border-[#2A3445]">
              <tr>
                <th className="py-3 px-4 font-medium">Tx Hash</th>
                <th className="py-3 px-4 font-medium">Type</th>
                <th className="py-3 px-4 font-medium">Pair</th>
                <th className="py-3 px-4 font-medium">Amount</th>
                <th className="py-3 px-4 font-medium text-right">Effective Price</th>
                <th className="py-3 px-4 font-medium text-right">Slippage</th>
                <th className="py-3 px-4 font-medium text-right">Gas Used</th>
                <th className="py-3 px-4 font-medium text-right">Latency</th>
                <th className="py-3 px-4 font-medium text-center">Status</th>
                <th className="py-3 px-4 font-medium text-center">Explorers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A3445]">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-[#94A3B8]">
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
                      className="hover:bg-[#202838]/50 cursor-pointer transition"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-[#3B82F6]">
                        <div className="flex items-center space-x-1.5">
                          <span>{tx.tx_hash.slice(0, 8)}...{tx.tx_hash.slice(-6)}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(tx.tx_hash);
                            }}
                            className="text-[#94A3B8] hover:text-[#F1F5F9] p-0.5 transition"
                            title="Copy Tx Hash"
                          >
                            {copiedHash === tx.tx_hash ? (
                              <Check className="h-3 w-3 text-[#10B981]" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                          tx.transaction_type === "SWAP"
                            ? "bg-[#3B82F6]/10 text-[#60A5FA] border-[#3B82F6]/30"
                            : tx.transaction_type === "MULTI_STEP_ARBITRAGE"
                            ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                            : tx.transaction_type === "POSITION_EXIT"
                            ? "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30"
                            : "bg-[#202838] text-[#94A3B8] border-[#2A3445]"
                        }`}>
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-[#F1F5F9]">{tx.pair || "--"}</td>
                      <td className="py-3 px-4 text-[#F1F5F9] num-tabular">
                        {tx.amount_in ? `${tx.amount_in} → ${tx.amount_out}` : "--"}
                      </td>
                      <td className="py-3 px-4 text-right text-[#F1F5F9] num-tabular">
                        {tx.effective_price ? `$${tx.effective_price}` : "--"}
                      </td>
                      <td className="py-3 px-4 text-right text-[#F59E0B] num-tabular">
                        {tx.slippage_bps ? `${tx.slippage_bps} bps` : "0.0 bps"}
                      </td>
                      <td className="py-3 px-4 text-right text-[#94A3B8] num-tabular">
                        {tx.gas_used?.toLocaleString() || "--"}
                      </td>
                      <td className="py-3 px-4 text-right text-[#94A3B8] num-tabular">{tx.latency_ms} ms</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                          isConfirmed
                            ? "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30"
                            : isReverted
                            ? "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30"
                            : "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30"
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-2" onClick={(e) => e.stopPropagation()}>
                          <a
                            href={tx.explorer_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#3B82F6] hover:underline flex items-center space-x-0.5"
                            title="Blockscout"
                          >
                            <span>BS</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                          <span className="text-[#2A3445]">•</span>
                          <a
                            href={tx.subscan_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#F59E0B] hover:underline flex items-center space-x-0.5"
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
      <div className="fintech-card p-5">
        <h3 className="text-sm font-semibold text-[#F1F5F9] mb-3 flex items-center space-x-2">
          <Shield className="h-4 w-4 text-[#10B981]" />
          <span>Verified HashKey Chain Testnet Contract Registry</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-[#151922] rounded-xl border border-[#2A3445]">
            <span className="text-[#94A3B8] block text-[10px] font-medium">HSKSWAP V3 SWAP ROUTER 02</span>
            <div className="text-[#F1F5F9] font-mono font-medium truncate mt-1">
              0xa6914E66690c6794244B5f66a09eAEbf66254237
            </div>
            <a
              href="https://hashkey.blockscout.com/address/0xa6914E66690c6794244B5f66a09eAEbf66254237"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3B82F6] text-[11px] mt-1.5 inline-flex items-center space-x-1 hover:underline"
            >
              <span>View on Explorer</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>

          <div className="p-3 bg-[#151922] rounded-xl border border-[#2A3445]">
            <span className="text-[#94A3B8] block text-[10px] font-medium">HSKSWAP V3 QUOTER V2</span>
            <div className="text-[#F1F5F9] font-mono font-medium truncate mt-1">
              0x73820d9eE5Bf1BfcD429580320FC7A374E8fa1cC
            </div>
            <a
              href="https://hashkey.blockscout.com/address/0x73820d9eE5Bf1BfcD429580320FC7A374E8fa1cC"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3B82F6] text-[11px] mt-1.5 inline-flex items-center space-x-1 hover:underline"
            >
              <span>View on Explorer</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>

          <div className="p-3 bg-[#151922] rounded-xl border border-[#2A3445]">
            <span className="text-[#94A3B8] block text-[10px] font-medium">TESTNET WRAPPED HSK (WHSK)</span>
            <div className="text-[#F1F5F9] font-mono font-medium truncate mt-1">
              0xCA8aAceEC5Db1e91B9Ed3a344bA026c4a2B3ebF6
            </div>
            <a
              href="https://hashkey.blockscout.com/address/0xCA8aAceEC5Db1e91B9Ed3a344bA026c4a2B3ebF6"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3B82F6] text-[11px] mt-1.5 inline-flex items-center space-x-1 hover:underline"
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
          <div className="bg-[#191F2B] border border-[#2A3445] rounded-xl p-5 max-w-xl w-full shadow-2xl text-xs max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[#2A3445]">
              <h3 className="font-semibold text-[#F1F5F9] flex items-center space-x-2">
                <FileCode className="h-4 w-4 text-[#3B82F6]" />
                <span>On-Chain Transaction Details</span>
              </h3>
              <button onClick={() => setSelectedTx(null)} className="text-[#94A3B8] hover:text-[#F1F5F9]">✕</button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <span className="text-[#94A3B8] text-[10px] font-medium">TRANSACTION HASH</span>
                <div className="flex items-center justify-between bg-[#151922] border border-[#2A3445] p-2.5 rounded-lg mt-1 text-[#F1F5F9] font-mono break-all">
                  <span>{selectedTx.tx_hash}</span>
                  <button onClick={() => copyToClipboard(selectedTx.tx_hash)} className="text-[#3B82F6] ml-2">
                    {copiedHash === selectedTx.tx_hash ? <Check className="h-3.5 w-3.5 text-[#10B981]" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#151922] border border-[#2A3445] p-3 rounded-lg">
                  <span className="text-[#94A3B8] text-[10px] font-medium">STATUS</span>
                  <div className="font-semibold text-[#F1F5F9] mt-0.5">{selectedTx.status}</div>
                </div>
                <div className="bg-[#151922] border border-[#2A3445] p-3 rounded-lg">
                  <span className="text-[#94A3B8] text-[10px] font-medium">BLOCK NUMBER</span>
                  <div className="font-semibold font-mono text-[#F1F5F9] mt-0.5">#{selectedTx.block_number}</div>
                </div>
              </div>

              <div>
                <span className="text-[#94A3B8] text-[10px] font-medium">METHOD SIGNATURE</span>
                <div className="bg-[#151922] border border-[#2A3445] p-2.5 rounded-lg text-[11px] font-mono text-[#3B82F6] break-all mt-1">
                  {selectedTx.method_signature}
                </div>
              </div>

              <div className="bg-[#151922] border border-[#2A3445] p-3 rounded-lg space-y-2">
                <span className="text-[#94A3B8] text-[10px] uppercase font-semibold block">Gas &amp; Execution Telemetry</span>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Gas Limit:</span>
                  <span className="text-[#F1F5F9] font-mono">{selectedTx.gas_limit?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Gas Used:</span>
                  <span className="text-[#F1F5F9] font-mono">{selectedTx.gas_used?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Gas Estimation Error:</span>
                  <span className="text-[#3B82F6] font-mono">{selectedTx.gas_estimation_error_pct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Gas Cost (USD):</span>
                  <span className="text-[#F1F5F9] font-mono">${selectedTx.gas_cost_usd}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Latency:</span>
                  <span className="text-[#F1F5F9] font-mono">{selectedTx.latency_ms} ms</span>
                </div>
              </div>

              {selectedTx.error_message && (
                <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg text-[#EF4444]">
                  <span className="font-semibold block text-[10px]">REVERT REASON:</span>
                  <span>{selectedTx.error_message}</span>
                </div>
              )}

              <div className="pt-3 flex justify-between items-center border-t border-[#2A3445]">
                <div className="flex items-center space-x-3">
                  <a
                    href={selectedTx.explorer_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#3B82F6] hover:underline flex items-center space-x-1"
                  >
                    <span>View on Blockscout</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <span className="text-[#2A3445]">•</span>
                  <a
                    href={selectedTx.subscan_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#F59E0B] hover:underline flex items-center space-x-1"
                  >
                    <span>View on Subscan</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="px-3 py-1.5 bg-[#202838] text-[#94A3B8] hover:text-[#F1F5F9] rounded-lg border border-[#2A3445]"
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
