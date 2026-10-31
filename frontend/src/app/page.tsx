"use client";

import React, { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import OverviewDashboard from "@/components/OverviewDashboard";
import MarketsDashboard from "@/components/MarketsDashboard";
import AgentControlCenter from "@/components/AgentControlCenter";
import TradingTerminal from "@/components/TradingTerminal";
import PortfolioManager from "@/components/PortfolioManager";
import RiskCenter from "@/components/RiskCenter";
import AIAssistant from "@/components/AIAssistant";
import ActivityLogs from "@/components/ActivityLogs";
import QuantitativeValidationDashboard from "@/components/QuantitativeValidationDashboard";
import StrategyEvaluationDashboard from "@/components/StrategyEvaluationDashboard";
import TestnetExplorer from "@/components/TestnetExplorer";
import {
  fetchOverview,
  fetchAgents,
  fetchPortfolio,
  fetchActivityLogs,
} from "@/lib/api";
import { Shield, ExternalLink, Radio } from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [overview, setOverview] = useState<any>(null);
  const [agentsData, setAgentsData] = useState<any>(null);
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // Load state from backend
  const refreshAllData = useCallback(async () => {
    try {
      const [ov, ag, pf, logs] = await Promise.all([
        fetchOverview().catch(() => null),
        fetchAgents().catch(() => null),
        fetchPortfolio().catch(() => null),
        fetchActivityLogs(50).catch(() => ({ logs: [] })),
      ]);

      if (ov) setOverview(ov);
      if (ag) setAgentsData(ag);
      if (pf) setPortfolioData(pf);
      if (logs?.logs) setActivityLogs(logs.logs);
    } catch (err) {
      console.warn("Failed to fetch dashboard data:", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshAllData();
    const interval = setInterval(refreshAllData, 10000);
    return () => clearInterval(interval);
  }, [refreshAllData]);

  // WebSocket Live Connection
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWs = () => {
      try {
        ws = new WebSocket("ws://localhost:8000/ws");
        ws.onopen = () => {
          setWsConnected(true);
        };
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "TRADE_EXECUTED" || data.type === "POSITION_CLOSED" || data.type === "PORTFOLIO_UPDATE") {
              refreshAllData();
            }
          } catch (e) {}
        };
        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimeout = setTimeout(connectWs, 3000);
        };
        ws.onerror = () => {
          setWsConnected(false);
          ws?.close();
        };
      } catch (err) {
        setWsConnected(false);
        reconnectTimeout = setTimeout(connectWs, 3000);
      }
    };

    connectWs();
    return () => {
      clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, [refreshAllData]);

  const circuitBreakerActive = overview?.circuit_breaker_active ?? false;

  return (
    <div className="min-h-screen bg-[#0F1117] text-[#F1F5F9] flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        circuitBreakerActive={circuitBreakerActive}
        onRefresh={refreshAllData}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "overview" && (
          <OverviewDashboard overview={overview} onNavigate={setActiveTab} onRefresh={refreshAllData} />
        )}
        {activeTab === "markets" && (
          <MarketsDashboard onNavigate={setActiveTab} />
        )}
        {(activeTab === "strategies" || activeTab === "evaluation") && (
          <StrategyEvaluationDashboard onRefresh={refreshAllData} defaultTab="leaderboard" />
        )}
        {activeTab === "experiments" && (
          <StrategyEvaluationDashboard onRefresh={refreshAllData} defaultTab="experiments" />
        )}
        {(activeTab === "analytics" || activeTab === "validation") && (
          <QuantitativeValidationDashboard onRefresh={refreshAllData} />
        )}
        {activeTab === "explorer" && (
          <TestnetExplorer />
        )}
        {activeTab === "agents" && (
          <AgentControlCenter agentsData={agentsData} onRefresh={refreshAllData} />
        )}
        {activeTab === "terminal" && (
          <TradingTerminal overview={overview} onRefresh={refreshAllData} />
        )}
        {activeTab === "portfolio" && (
          <PortfolioManager portfolioData={portfolioData} />
        )}
        {activeTab === "risk" && (
          <RiskCenter onRefresh={refreshAllData} activityLogs={activityLogs} />
        )}
        {activeTab === "assistant" && (
          <AIAssistant onRefresh={refreshAllData} />
        )}
        {activeTab === "activity" && (
          <ActivityLogs logs={activityLogs} onRefresh={refreshAllData} />
        )}
      </main>

      {/* Institutional Footer */}
      <footer className="border-t border-[#2A3445] bg-[#151922] py-4 text-xs font-sans text-[#94A3B8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-[#F1F5F9]">OmniVault AI</span>
            <span className="text-[#2A3445]">•</span>
            <span>Institutional Multi-Agent DeFi Asset Management</span>
            <span className="text-[#2A3445]">•</span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-[#202838] border border-[#2A3445] text-[#94A3B8]">
              HashKey Chain Testnet (133)
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${wsConnected ? "bg-[#10B981]" : "bg-[#F59E0B]"}`}></span>
              <span>WS Feed: {wsConnected ? "Connected" : "Polling"}</span>
            </div>
            <span className="text-[#2A3445]">•</span>
            <a
              href="https://hashkey.blockscout.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3B82F6] hover:text-blue-400 flex items-center space-x-1 transition"
            >
              <span>Blockscout Explorer</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
