"use client";

import React, { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import OverviewDashboard from "@/components/OverviewDashboard";
import AgentControlCenter from "@/components/AgentControlCenter";
import TradingTerminal from "@/components/TradingTerminal";
import PortfolioManager from "@/components/PortfolioManager";
import RiskCenter from "@/components/RiskCenter";
import AIAssistant from "@/components/AIAssistant";
import ActivityLogs from "@/components/ActivityLogs";
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
    <div className="min-h-screen bg-[#080a0f] text-slate-100 flex flex-col font-sans">
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
          <OverviewDashboard overview={overview} onNavigate={setActiveTab} />
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
      <footer className="border-t border-slate-900 bg-[#06080c] py-4 text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-300">OmniVault AI</span>
            <span>•</span>
            <span>HSK Chain India Hackathon (Track: AI Agent Trading)</span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${wsConnected ? "bg-emerald-400" : "bg-amber-400"}`}></span>
              <span>WS Telemetry: {wsConnected ? "Connected" : "Polling"}</span>
            </div>
            <span>•</span>
            <a
              href="https://hashkey.blockscout.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
            >
              <span>HashKey Explorer</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
