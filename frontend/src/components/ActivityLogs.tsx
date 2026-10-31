"use client";

import React, { useState } from "react";
import { ListFilter, ExternalLink, ShieldCheck, AlertCircle, RefreshCw } from "lucide-react";

interface ActivityLogsProps {
  logs: any[];
  onRefresh: () => void;
}

export default function ActivityLogs({ logs, onRefresh }: ActivityLogsProps) {
  const [filterState, setFilterState] = useState<string>("ALL");

  const filteredLogs = logs.filter((log) => {
    if (filterState === "ALL") return true;
    return log.state === filterState;
  });

  return (
    <div className="fintech-card p-5 space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#2A3445] pb-3 gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#F1F5F9] flex items-center space-x-2">
            <ListFilter className="h-4 w-4 text-[#3B82F6]" />
            <span>Deterministic Orchestration &amp; Execution Audit Trail</span>
          </h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Audit trail of all agent reasoning cycles, deterministic risk decisions, and on-chain transactions.
          </p>
        </div>

        {/* Filter Badges */}
        <div className="flex items-center space-x-1 text-xs overflow-x-auto">
          {["ALL", "APPROVED", "REJECTED", "EXECUTED", "CLOSED"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterState(st)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                filterState === st
                  ? "bg-[#3B82F6] text-white"
                  : "bg-[#151922] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#2A3445]"
              }`}
            >
              {st}
            </button>
          ))}
          <button
            onClick={onRefresh}
            className="p-1 rounded-lg bg-[#202838] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#2A3445] ml-2 transition"
            title="Refresh logs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Logs Table / List */}
      {filteredLogs.length === 0 ? (
        <div className="text-center py-12 text-[#94A3B8] text-xs">
          No logs found matching filter &quot;{filterState}&quot;.
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#151922] border-b border-[#2A3445] text-[#94A3B8]">
              <tr>
                <th className="py-2.5 px-3 font-medium">State</th>
                <th className="py-2.5 px-3 font-medium">Correlation ID</th>
                <th className="py-2.5 px-3 font-medium">Explanation / Decision</th>
                <th className="py-2.5 px-3 font-medium">Time</th>
                <th className="py-2.5 px-3 font-medium text-right">Explorer / Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A3445]">
              {filteredLogs.slice().reverse().map((log: any) => {
                const txHash = log.metadata?.tx_hash;
                const isApproved = log.state === "APPROVED";
                const isRejected = log.state === "REJECTED";
                const isExecuted = log.state === "EXECUTED";
                const isClosed = log.state === "CLOSED";

                return (
                  <tr key={log.id} className="hover:bg-[#202838]/50 transition">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                          isApproved
                            ? "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30"
                            : isRejected
                            ? "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30"
                            : isExecuted
                            ? "bg-[#3B82F6]/10 text-[#60A5FA] border-[#3B82F6]/30"
                            : isClosed
                            ? "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30"
                            : "bg-[#202838] text-[#94A3B8] border-[#2A3445]"
                        }`}
                      >
                        {log.state}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#94A3B8] font-mono text-[11px]">
                      {log.correlation_id ? `${log.correlation_id.slice(0, 8)}...` : "--"}
                    </td>
                    <td className="py-2.5 px-3 text-[#F1F5F9] max-w-md leading-relaxed">
                      {log.explanation}
                    </td>
                    <td className="py-2.5 px-3 text-[#94A3B8] whitespace-nowrap text-[11px]">
                      {new Date(log.timestamp * 1000).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {txHash ? (
                        <a
                          href={`https://hashkey.blockscout.com/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-[#3B82F6] hover:underline text-[11px] font-mono"
                        >
                          <span>{txHash.slice(0, 10)}...</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-[#94A3B8]/60 text-[11px]">--</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
