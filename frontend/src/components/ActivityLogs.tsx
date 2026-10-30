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
    <div className="terminal-card p-5 space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
            <ListFilter className="h-4 w-4 text-cyan-400" />
            <span>Deterministic Orchestration & Execution Logs</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Audit trail of all agent reasoning cycles, deterministic risk decisions, and on-chain transactions.
          </p>
        </div>

        {/* Filter Badges */}
        <div className="flex items-center space-x-1 font-mono text-xs overflow-x-auto">
          {["ALL", "APPROVED", "REJECTED", "EXECUTED", "CLOSED"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterState(st)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                filterState === st
                  ? "bg-cyan-950 text-cyan-400 border border-cyan-800"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              {st}
            </button>
          ))}
          <button
            onClick={onRefresh}
            className="p-1 rounded bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 ml-2"
            title="Refresh logs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Logs Table / List */}
      {filteredLogs.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-xs font-mono">
          No logs found matching filter &quot;{filterState}&quot;.
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="sticky top-0 bg-[#0d111a] border-b border-slate-800 text-slate-400">
              <tr>
                <th className="py-2.5 px-3">State</th>
                <th className="py-2.5 px-3">Correlation ID</th>
                <th className="py-2.5 px-3">Explanation / Decision</th>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3 text-right">Explorer / Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredLogs.slice().reverse().map((log: any) => {
                const txHash = log.metadata?.tx_hash;
                const isApproved = log.state === "APPROVED";
                const isRejected = log.state === "REJECTED";
                const isExecuted = log.state === "EXECUTED";

                return (
                  <tr key={log.id} className="hover:bg-slate-900/40">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isApproved
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-900"
                            : isRejected
                            ? "bg-red-950 text-red-400 border border-red-900"
                            : isExecuted
                            ? "bg-cyan-950 text-cyan-400 border border-cyan-900"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {log.state}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                      {log.correlation_id ? `${log.correlation_id.slice(0, 8)}...` : "--"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-200 text-xs max-w-md">
                      {log.explanation}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                      {new Date(log.timestamp * 1000).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {txHash ? (
                        <a
                          href={`https://hashkey.blockscout.com/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 text-[11px]"
                        >
                          <span>{txHash.slice(0, 10)}...</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-slate-600 text-[11px]">--</span>
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
