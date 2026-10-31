"use client";

import React, { useState, useEffect } from "react";
import { Shield, Activity, Wallet, AlertOctagon, RefreshCw, Radio } from "lucide-react";
import { connectWallet, getNativeBalance } from "@/lib/web3";
import { toggleEmergencyPause, triggerOrchestrationCycle, fetchSignerStatus } from "@/lib/api";

interface NavbarProps {
  circuitBreakerActive: boolean;
  onRefresh: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Navbar({
  circuitBreakerActive,
  onRefresh,
  activeTab,
  setActiveTab,
}: NavbarProps) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [hskBalance, setHskBalance] = useState<string>("0.00");
  const [signerData, setSignerData] = useState<any>(null);
  const [isCycling, setIsCycling] = useState<boolean>(false);
  const [isTogglingPause, setIsTogglingPause] = useState<boolean>(false);

  useEffect(() => {
    fetchSignerStatus()
      .then((data) => setSignerData(data))
      .catch((e) => console.debug("Signer fetch:", e));

    if (typeof window !== "undefined" && (window as any).ethereum) {
      const ethereum = (window as any).ethereum;
      ethereum.request({ method: "eth_accounts" }).then((accounts: string[]) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          getNativeBalance(accounts[0]).then(setHskBalance);
        }
      });

      ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          getNativeBalance(accounts[0]).then(setHskBalance);
        } else {
          setWalletAddress(null);
        }
      });
    }
  }, []);

  const handleConnect = async () => {
    const res = await connectWallet();
    if (res) {
      setWalletAddress(res.address);
      const bal = await getNativeBalance(res.address);
      setHskBalance(bal);
    }
  };

  const handleManualCycle = async () => {
    setIsCycling(true);
    try {
      await triggerOrchestrationCycle();
      onRefresh();
    } catch (e) {
      console.error("Cycle run failed:", e);
    } finally {
      setIsCycling(false);
    }
  };

  const handleEmergencyToggle = async () => {
    setIsTogglingPause(true);
    try {
      await toggleEmergencyPause(!circuitBreakerActive);
      onRefresh();
    } catch (e) {
      console.error("Emergency toggle failed:", e);
    } finally {
      setIsTogglingPause(false);
    }
  };

  const navItems = [
    { id: "overview", label: "Overview" },
    { id: "validation", label: "Quant Validation" },
    { id: "evaluation", label: "Strategy Eval" },
    { id: "explorer", label: "Testnet Explorer" },
    { id: "agents", label: "Agent Control" },
    { id: "terminal", label: "Trading Terminal" },
    { id: "portfolio", label: "Portfolio" },
    { id: "risk", label: "Risk Center" },
    { id: "assistant", label: "AI Assistant" },
    { id: "activity", label: "Activity Logs" },
  ];

  return (
    <header className="border-b border-slate-800 bg-[#0a0d14] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Chain Tag */}
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center font-bold text-black shadow-md">
              <Shield className="h-5 w-5 text-black" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base tracking-wider text-slate-100">
                  OMNIVAULT<span className="text-cyan-400">.AI</span>
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold flex items-center space-x-1 shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                  <span>TESTNET</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">Autonomous DEX Multi-Agent</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex space-x-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === item.id
                    ? "bg-slate-800 text-cyan-300 border border-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right Actions: Signer, Mode, Quick Cycle, Pause, Wallet */}
          <div className="flex items-center space-x-2.5">
            {/* Backend Signer Public Address & HSK Balance */}
            {signerData?.is_configured && (
              <div
                className="hidden lg:flex items-center space-x-2 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md text-[11px] font-mono"
                title={`Dedicated Testnet Signer: ${signerData.address}`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                <span className="text-slate-400">Signer:</span>
                <span className="text-cyan-300 font-bold">
                  {signerData.address?.slice(0, 6)}...{signerData.address?.slice(-4)}
                </span>
                <span className="text-emerald-400 font-semibold">
                  {signerData.balances?.hsk ?? 0.1} HSK
                </span>
              </div>
            )}

            {/* Execution Mode */}
            <div className="hidden sm:flex items-center space-x-1 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono">
              <span className="text-slate-500">MODE:</span>
              <span className={`font-bold ${signerData?.execution_mode?.toLowerCase() === "testnet" ? "text-amber-400" : "text-cyan-400"}`}>
                {(signerData?.execution_mode || "PAPER").toUpperCase()}
              </span>
            </div>

            {/* Run Cycle Button */}
            <button
              onClick={handleManualCycle}
              disabled={isCycling}
              title="Trigger immediate multi-agent evaluation cycle"
              className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center space-x-1 border border-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isCycling ? "animate-spin text-cyan-400" : ""}`} />
              <span className="hidden xl:inline">Run Cycle</span>
            </button>

            {/* Emergency Pause Killswitch */}
            <button
              onClick={handleEmergencyToggle}
              disabled={isTogglingPause}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-1 border transition-all ${
                circuitBreakerActive
                  ? "bg-red-950/80 text-red-400 border-red-700 animate-pulse"
                  : "bg-slate-900 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border-slate-800"
              }`}
            >
              <AlertOctagon className="h-3.5 w-3.5" />
              <span>{circuitBreakerActive ? "HALTED" : "Pause"}</span>
            </button>

            {/* Wallet Connect */}
            {walletAddress ? (
              <div className="flex items-center space-x-2 bg-slate-900 border border-slate-700 px-3 py-1 rounded-md text-xs font-mono">
                <span className="text-slate-400">{hskBalance} HSK</span>
                <span className="text-cyan-400 font-bold">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                className="flex items-center space-x-1.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-black font-semibold text-xs px-3 py-1.5 rounded-md transition-all shadow"
              >
                <Wallet className="h-3.5 w-3.5 text-black" />
                <span className="hidden sm:inline">Connect MetaMask</span>
                <span className="sm:hidden">Connect</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
