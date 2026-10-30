"use client";

import React, { useState } from "react";
import {
  Zap,
  Activity,
  Layers,
  ShieldCheck,
  CheckCircle,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Clock,
  Terminal,
  Cpu,
} from "lucide-react";
import { toggleAgent } from "@/lib/api";

interface AgentProps {
  agentsData: any;
  onRefresh: () => void;
}

export default function AgentControlCenter({ agentsData, onRefresh }: AgentProps) {
  const agents = agentsData?.agents || [];
  const telemetry = agentsData?.latest_telemetry || {};
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggle = async (agentId: string, currentState: boolean) => {
    setTogglingId(agentId);
    try {
      await toggleAgent(agentId, !currentState);
      onRefresh();
    } catch (e) {
      console.error("Toggle agent failed:", e);
    } finally {
      setTogglingId(null);
    }
  };

  const agentIcons: Record<string, any> = {
    agent_market_intelligence: Activity,
    agent_arbitrage: Layers,
    agent_technical_analysis: Zap,
    agent_liquidity: Cpu,
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
            <Cpu className="h-5 w-5 text-cyan-400" />
            <span>Autonomous Multi-Agent Control Center</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Specialized AI trading agents collaborating under deterministic risk engine supervision.
          </p>
        </div>
        <div className="mt-3 sm:mt-0 flex items-center space-x-2 font-mono text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Orchestrator Cycle: 15s interval</span>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {agents.map((agent: any) => {
          const Icon = agentIcons[agent.agent_id] || Terminal;
          const tData = telemetry[agent.agent_id] || {};
          const isToggling = togglingId === agent.agent_id;

          return (
            <div
              key={agent.agent_id}
              className={`terminal-card p-5 transition-all ${
                !agent.is_enabled ? "opacity-60 bg-slate-950/60" : "hover:border-cyan-800/60"
              }`}
            >
              {/* Header: Name, Status & Toggle */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2.5 rounded-lg ${agent.is_enabled ? "bg-cyan-950/60 text-cyan-400 border border-cyan-800/80" : "bg-slate-900 text-slate-500"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{agent.name}</h3>
                    <div className="flex items-center space-x-2 mt-0.5 font-mono text-[11px]">
                      <span className="text-slate-400">{agent.agent_id}</span>
                      <span className="text-slate-600">•</span>
                      <span
                        className={`font-semibold ${
                          agent.status === "RUNNING"
                            ? "text-amber-400"
                            : agent.status === "ERROR"
                            ? "text-red-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {agent.is_enabled ? agent.status : "PAUSED"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Enable/Disable Toggle */}
                <button
                  onClick={() => handleToggle(agent.agent_id, agent.is_enabled)}
                  disabled={isToggling}
                  className="text-slate-400 hover:text-slate-200 transition focus:outline-none"
                  title={agent.is_enabled ? "Disable Agent" : "Enable Agent"}
                >
                  {agent.is_enabled ? (
                    <ToggleRight className="h-7 w-7 text-cyan-400" />
                  ) : (
                    <ToggleLeft className="h-7 w-7 text-slate-600" />
                  )}
                </button>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-300 mt-3 line-clamp-2">
                {agent.description}
              </p>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-xs font-mono">
                <div className="bg-slate-900/50 p-2 rounded">
                  <span className="text-[10px] text-slate-500 block">Total Runs</span>
                  <span className="text-slate-200 font-bold">{agent.total_runs}</span>
                </div>
                <div className="bg-slate-900/50 p-2 rounded">
                  <span className="text-[10px] text-slate-500 block">Opportunities</span>
                  <span className="text-cyan-400 font-bold">{agent.opportunities_found}</span>
                </div>
                <div className="bg-slate-900/50 p-2 rounded">
                  <span className="text-[10px] text-slate-500 block">Interval</span>
                  <span className="text-slate-200 font-bold">{agent.execution_interval_seconds}s</span>
                </div>
              </div>

              {/* Supported Strategies & Assets */}
              <div className="mt-3.5 space-y-1.5 text-[11px] font-mono">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-500">Strategies:</span>
                  <div className="flex flex-wrap gap-1">
                    {(agent.supported_strategies || []).map((s: string) => (
                      <span key={s} className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 text-[10px]">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-slate-500">Assets:</span>
                  <span className="text-slate-300">{(agent.supported_assets || []).join(", ")}</span>
                </div>
              </div>

              {/* Telemetry Output Snippet */}
              {tData?.data && (
                <div className="mt-3 p-2 bg-black/40 rounded border border-slate-900 text-[10px] font-mono text-slate-400">
                  <span className="text-slate-500">Telemetry: </span>
                  <span className="text-slate-300">
                    Cycle completed in {tData.duration_ms}ms • Signals: {tData.signals_produced} • Opps: {tData.opportunities_found}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
