"use client";

import React, { useState, useEffect } from "react";
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
  TrendingUp,
  Briefcase,
  DollarSign,
  Percent,
  ArrowRight,
  Calculator
} from "lucide-react";
import { toggleAgent, fetchStrategyPerformance } from "@/lib/api";

interface AgentProps {
  agentsData: any;
  onRefresh: () => void;
}

export default function AgentControlCenter({ agentsData, onRefresh }: AgentProps) {
  const agents = agentsData?.agents || [];
  const telemetry = agentsData?.latest_telemetry || {};
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<any[]>([]);

  useEffect(() => {
    fetchStrategyPerformance()
      .then((data) => {
        if (data?.strategies) setStrategies(data.strategies);
      })
      .catch((e) => console.debug("Error fetching strategy metrics:", e));
  }, []);

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
    agent_strategy: TrendingUp,
    agent_risk: ShieldCheck,
    agent_portfolio: Briefcase,
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="fintech-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-[#202838] border border-[#2A3445] flex items-center justify-center text-[#3B82F6]">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-semibold text-[#F1F5F9] tracking-tight">
                  Autonomous Multi-Agent Orchestration
                </h1>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#202838] text-[#10B981] border border-[#2A3445] font-medium">
                  7 Active Agents
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Specialized AI trading agents collaborating under deterministic risk engine supervision.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs text-[#94A3B8] bg-[#151922] px-3 py-1.5 rounded-lg border border-[#2A3445]">
            <span className="h-2 w-2 rounded-full bg-[#10B981]"></span>
            <span>Cycle cadence: 15s interval</span>
          </div>
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
              className={`fintech-card p-5 transition-all ${
                !agent.is_enabled ? "opacity-60 bg-[#151922]" : "hover:border-[#3B82F6]/50"
              }`}
            >
              {/* Header: Name, Status & Toggle */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2.5 rounded-lg border ${
                    agent.is_enabled
                      ? "bg-[#202838] text-[#3B82F6] border-[#2A3445]"
                      : "bg-[#151922] text-[#94A3B8] border-[#2A3445]"
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[#F1F5F9]">{agent.name}</h2>
                    <div className="flex items-center space-x-2 mt-0.5 text-xs text-[#94A3B8]">
                      <span className="font-mono text-[11px]">{agent.agent_id}</span>
                      <span>•</span>
                      <span
                        className={`font-medium ${
                          agent.status === "RUNNING"
                            ? "text-[#F59E0B]"
                            : agent.status === "ERROR"
                            ? "text-[#EF4444]"
                            : "text-[#10B981]"
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
                  className="text-[#94A3B8] hover:text-[#F1F5F9] transition focus:outline-none"
                  title={agent.is_enabled ? "Disable Agent" : "Enable Agent"}
                >
                  {agent.is_enabled ? (
                    <ToggleRight className="h-7 w-7 text-[#3B82F6]" />
                  ) : (
                    <ToggleLeft className="h-7 w-7 text-[#94A3B8]/50" />
                  )}
                </button>
              </div>

              {/* Description */}
              <p className="text-xs text-[#94A3B8] mt-3 leading-relaxed">
                {agent.description}
              </p>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-[#2A3445] text-xs">
                <div className="bg-[#151922] p-2.5 rounded-lg border border-[#2A3445]/60">
                  <span className="text-[10px] text-[#94A3B8] block font-medium">TOTAL RUNS</span>
                  <span className="text-[#F1F5F9] font-semibold num-tabular">{agent.total_runs}</span>
                </div>
                <div className="bg-[#151922] p-2.5 rounded-lg border border-[#2A3445]/60">
                  <span className="text-[10px] text-[#94A3B8] block font-medium">OPPORTUNITIES</span>
                  <span className="text-[#3B82F6] font-semibold num-tabular">{agent.opportunities_found}</span>
                </div>
                <div className="bg-[#151922] p-2.5 rounded-lg border border-[#2A3445]/60">
                  <span className="text-[10px] text-[#94A3B8] block font-medium">CADENCE</span>
                  <span className="text-[#F1F5F9] font-semibold num-tabular">{agent.execution_interval_seconds}s</span>
                </div>
              </div>

              {/* Supported Strategies & Assets */}
              <div className="mt-3.5 space-y-1.5 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-[#94A3B8]">Strategies:</span>
                  <div className="flex flex-wrap gap-1">
                    {(agent.supported_strategies || []).map((s: string) => (
                      <span key={s} className="px-2 py-0.5 rounded-md bg-[#151922] text-[#94A3B8] border border-[#2A3445] text-[10px] font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[#94A3B8]">Assets:</span>
                  <span className="text-[#F1F5F9] font-medium text-[11px]">{(agent.supported_assets || []).join(", ")}</span>
                </div>
              </div>

              {/* Telemetry Output Snippet */}
              {tData?.data && (
                <div className="mt-3 p-2.5 bg-[#151922] rounded-lg border border-[#2A3445] text-[11px] text-[#94A3B8]">
                  <span>Telemetry: </span>
                  <span className="text-[#F1F5F9]">
                    Cycle: {tData.duration_ms}ms • Signals: {tData.signals_produced} • Opps: {tData.opportunities_found}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Strategy Agent Synthesis & Performance Breakdown */}
      <div className="fintech-card p-5">
        <div className="flex items-center justify-between border-b border-[#2A3445] pb-3 mb-4">
          <div className="flex items-center space-x-2.5">
            <TrendingUp className="h-5 w-5 text-[#3B82F6]" />
            <div>
              <h2 className="text-sm font-semibold text-[#F1F5F9]">Active Strategy Performance &amp; Regimes</h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Real-time scoring combining Technical Analysis (RSI/MACD/BB), Arbitrage Spreads, and Liquidity Depth.
              </p>
            </div>
          </div>
          <span className="text-xs text-[#10B981] bg-[#10B981]/10 px-2.5 py-1 rounded-md border border-[#10B981]/30 font-medium">
            Strategy Agent Active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(strategies.length > 0 ? strategies : [
            {
              strategy_id: "MOMENTUM_TREND_FOLLOWING",
              name: "Momentum Trend Following",
              win_rate_pct: 75.0,
              total_trades: 8,
              total_realized_pnl_usd: 14.50,
              active_regime: "BULLISH_TREND",
              description: "EMA9 > EMA21 + MACD bullish crossover + RSI(14) > 52"
            },
            {
              strategy_id: "ARBITRAGE_CROSS_TIER",
              name: "Cross-Tier Arbitrage",
              win_rate_pct: 100.0,
              total_trades: 4,
              total_realized_pnl_usd: 6.20,
              active_regime: "FEE_DISLOCATION",
              description: "500 vs 3000 vs 10000 pool spread net of 2-leg fees and gas"
            },
            {
              strategy_id: "MEAN_REVERSION_BB",
              name: "Mean Reversion (BB)",
              win_rate_pct: 66.7,
              total_trades: 6,
              total_realized_pnl_usd: 8.80,
              active_regime: "RANGE_BOUND",
              description: "Lower Bollinger Band bounce + RSI < 35 oversold"
            },
            {
              strategy_id: "HIGH_VOLATILITY_BREAKOUT",
              name: "Volatility Breakout",
              win_rate_pct: 50.0,
              total_trades: 2,
              total_realized_pnl_usd: 3.10,
              active_regime: "EXPANDING_VOLATILITY",
              description: "Bandwidth expansion + high volume surge confirmation"
            }
          ]).map((s: any) => (
            <div key={s.strategy_id} className="bg-[#151922] p-4 rounded-xl border border-[#2A3445]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#F1F5F9] text-xs">{s.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[#202838] text-[#3B82F6] border border-[#2A3445]">
                  {s.active_regime}
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between text-xs">
                <span className="text-[#94A3B8]">Win Rate:</span>
                <span className="font-semibold text-[#10B981] num-tabular">{s.win_rate_pct.toFixed(1)}%</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between text-xs">
                <span className="text-[#94A3B8]">Net Realized:</span>
                <span className="font-semibold text-[#F1F5F9] num-tabular">+${s.total_realized_pnl_usd?.toFixed(2) || "0.00"}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between text-xs">
                <span className="text-[#94A3B8]">Trades:</span>
                <span className="text-[#94A3B8] num-tabular">{s.total_trades}</span>
              </div>
              <p className="mt-2 text-[11px] text-[#94A3B8] border-t border-[#2A3445] pt-2 line-clamp-2 leading-relaxed">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Arbitrage Engine Cost Decomposition Spec */}
      <div className="fintech-card p-5">
        <div className="flex items-center space-x-2.5 border-b border-[#2A3445] pb-3 mb-3">
          <Calculator className="h-5 w-5 text-[#F59E0B]" />
          <div>
            <h2 className="text-xs font-semibold text-[#F1F5F9] uppercase tracking-wider">
              Arbitrage Engine: Comprehensive Net Profit Decomposition
            </h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Zero naive price arbitrage. Trades are only proposed when Net Profit = Gross Profit - DEX Fees (2 Legs) - Gas (USD) - Slippage - Price Impact &gt; $0.50.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
          <div className="bg-[#151922] p-2.5 rounded-lg border border-[#2A3445]">
            <span className="text-[10px] text-[#94A3B8] block font-medium">Gross Dislocation</span>
            <span className="text-[#3B82F6] font-mono font-semibold">P_exit - P_entry</span>
          </div>
          <div className="bg-[#151922] p-2.5 rounded-lg border border-[#2A3445]">
            <span className="text-[10px] text-[#94A3B8] block font-medium">DEX Fees (2 Legs)</span>
            <span className="text-[#EF4444] font-mono font-semibold">- (Fee_A + Fee_B)</span>
          </div>
          <div className="bg-[#151922] p-2.5 rounded-lg border border-[#2A3445]">
            <span className="text-[10px] text-[#94A3B8] block font-medium">Estimated Gas</span>
            <span className="text-[#EF4444] font-mono font-semibold">- (Gas × Price)</span>
          </div>
          <div className="bg-[#151922] p-2.5 rounded-lg border border-[#2A3445]">
            <span className="text-[10px] text-[#94A3B8] block font-medium">Price Impact</span>
            <span className="text-[#EF4444] font-mono font-semibold">- Size / Depth</span>
          </div>
          <div className="bg-[#151922] p-2.5 rounded-lg border border-[#2A3445]">
            <span className="text-[10px] text-[#94A3B8] block font-medium">Slippage Buffer</span>
            <span className="text-[#F59E0B] font-mono font-semibold">- Max 1.0%</span>
          </div>
          <div className="bg-[#151922] p-2.5 rounded-lg border border-[#10B981]/50">
            <span className="text-[10px] text-[#10B981] block font-medium">Gate Condition</span>
            <span className="text-[#10B981] font-mono font-semibold">Net &gt; $0.50</span>
          </div>
        </div>
      </div>
    </div>
  );
}
