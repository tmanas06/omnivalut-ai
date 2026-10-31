"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Shield,
  Activity,
  Wallet,
  AlertTriangle,
  RefreshCw,
  Radio,
  ChevronDown,
  Layers,
  Sliders,
  Cpu,
  Zap,
  Lock,
  ExternalLink,
  Menu,
  X,
  FileCode,
  Terminal,
  Bot,
  ScrollText,
} from "lucide-react";
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
  const [moreMenuOpen, setMoreMenuOpen] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSignerStatus()
      .then((data) => setSignerData(data))
      .catch((e) => console.debug("Signer fetch:", e));

    if (typeof window !== "undefined" && (window as any).ethereum) {
      const ethereum = (window as any).ethereum;
      ethereum
        .request({ method: "eth_accounts" })
        .then((accounts: string[]) => {
          if (accounts && accounts.length > 0) {
            setWalletAddress(accounts[0]);
            getNativeBalance(accounts[0]).then(setHskBalance).catch((err) => console.debug("Balance fetch:", err));
          }
        })
        .catch((err: any) => console.debug("Accounts check:", err));

      ethereum.on?.("accountsChanged", (accounts: string[]) => {
        if (accounts && accounts.length > 0) {
          setWalletAddress(accounts[0]);
          getNativeBalance(accounts[0]).then(setHskBalance).catch((err) => console.debug("Balance fetch:", err));
        } else {
          setWalletAddress(null);
        }
      });
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  // Primary navigation tabs
  const primaryNav = [
    { id: "overview", label: "Overview" },
    { id: "markets", label: "Markets" },
    { id: "strategies", label: "Strategies" },
    { id: "experiments", label: "Experiments" },
    { id: "analytics", label: "Analytics" },
  ];

  // Secondary / More grouped navigation items
  const secondaryNav = [
    { id: "explorer", label: "Testnet Explorer", icon: FileCode, desc: "On-chain transaction tracking" },
    { id: "agents", label: "Agent Control", icon: Cpu, desc: "7 specialized trading agents" },
    { id: "risk", label: "Risk Center", icon: Shield, desc: "13 deterministic safety rules" },
    { id: "terminal", label: "Trading Terminal", icon: Terminal, desc: "HSKSwap V3 execution interface" },
    { id: "portfolio", label: "Portfolio Analytics", icon: Activity, desc: "Asset allocation & mark-to-market" },
    { id: "assistant", label: "AI Assistant", icon: Bot, desc: "Natural language intent parsing" },
    { id: "activity", label: "Activity Logs", icon: ScrollText, desc: "Complete deterministic audit trail" },
  ];

  const isSecondaryActive = secondaryNav.some((item) => item.id === activeTab);

  return (
    <header className="border-b border-[#2A3445] bg-[#151922] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Badges */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setActiveTab("overview")}
              className="flex items-center space-x-2.5 text-left focus:outline-none"
            >
              <div className="h-8 w-8 rounded-lg bg-[#202838] border border-[#2A3445] flex items-center justify-center text-[#3B82F6]">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <span className="font-semibold text-sm text-[#F1F5F9] tracking-tight">
                  OmniVault <span className="text-[#3B82F6] font-normal text-xs">AI</span>
                </span>
              </div>
            </button>

            {/* Network & Execution Status */}
            <div className="hidden sm:flex items-center space-x-2 pl-2 border-l border-[#2A3445]">
              <span className="text-[11px] font-sans px-2 py-0.5 rounded-md bg-[#202838] text-[#94A3B8] border border-[#2A3445] flex items-center space-x-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></span>
                <span>HashKey Testnet (133)</span>
              </span>

              <span className={`text-[11px] font-sans px-2 py-0.5 rounded-md border font-medium ${
                (signerData?.execution_mode || "paper").toUpperCase() === "TESTNET"
                  ? "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30"
                  : "bg-[#3B82F6]/10 text-[#60A5FA] border-[#3B82F6]/30"
              }`}>
                {(signerData?.execution_mode || "paper").toUpperCase()} MODE
              </span>
            </div>
          </div>

          {/* Desktop Primary Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {primaryNav.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-[#202838] text-[#F1F5F9] border border-[#2A3445]"
                      : "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#191F2B]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}

            {/* "More" Dropdown Menu */}
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors ${
                  isSecondaryActive
                    ? "bg-[#202838] text-[#F1F5F9] border border-[#2A3445]"
                    : "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#191F2B]"
                }`}
              >
                <span>More</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${moreMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {moreMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-[#191F2B] border border-[#2A3445] rounded-xl shadow-xl py-1.5 z-50">
                  <div className="px-3 py-1.5 text-[10px] font-medium text-[#64748B] uppercase tracking-wider">
                    Platform Tools & Modules
                  </div>
                  {secondaryNav.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setMoreMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 flex items-start space-x-2.5 transition-colors ${
                          isActive ? "bg-[#202838] text-[#F1F5F9]" : "text-[#94A3B8] hover:bg-[#202838] hover:text-[#F1F5F9]"
                        }`}
                      >
                        <Icon className="h-4 w-4 text-[#3B82F6] shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-medium text-[#F1F5F9]">{item.label}</div>
                          <div className="text-[10px] text-[#64748B]">{item.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Right Action Controls & Wallet Connection */}
          <div className="flex items-center space-x-2.5">
            {/* Cycle Trigger Button */}
            <button
              onClick={handleManualCycle}
              disabled={isCycling}
              title="Trigger an autonomous 9-stage multi-agent orchestration cycle"
              className="p-1.5 rounded-lg border border-[#2A3445] bg-[#191F2B] hover:bg-[#202838] text-[#94A3B8] hover:text-[#F1F5F9] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isCycling ? "animate-spin text-[#3B82F6]" : ""}`} />
            </button>

            {/* Circuit Breaker Toggle */}
            <button
              onClick={handleEmergencyToggle}
              disabled={isTogglingPause}
              title={circuitBreakerActive ? "Resume trading" : "Emergency Pause"}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center space-x-1.5 transition-colors ${
                circuitBreakerActive
                  ? "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/40"
                  : "bg-[#191F2B] text-[#94A3B8] hover:text-[#F1F5F9] border-[#2A3445]"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${circuitBreakerActive ? "bg-[#EF4444] animate-pulse" : "bg-[#10B981]"}`}></span>
              <span className="hidden sm:inline">{circuitBreakerActive ? "Halted" : "Operational"}</span>
            </button>

            {/* Wallet Connect Pill */}
            {walletAddress ? (
              <div className="flex items-center bg-[#191F2B] border border-[#2A3445] rounded-lg px-2.5 py-1 space-x-2 text-xs">
                <span className="font-mono text-[#F1F5F9]">{parseFloat(hskBalance).toFixed(3)} HSK</span>
                <span className="text-[#2A3445]">•</span>
                <span className="font-mono text-[#94A3B8]">
                  {walletAddress.slice(0, 5)}...{walletAddress.slice(-4)}
                </span>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                className="px-3 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-medium flex items-center space-x-1.5 shadow-sm transition-colors"
              >
                <Wallet className="h-3.5 w-3.5" />
                <span>Connect</span>
              </button>
            )}

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-lg border border-[#2A3445] bg-[#191F2B] text-[#94A3B8]"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#2A3445] py-3 space-y-2">
            <div className="grid grid-cols-2 gap-1.5 pb-2 border-b border-[#2A3445]">
              {primaryNav.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium text-left ${
                    activeTab === item.id
                      ? "bg-[#202838] text-[#F1F5F9] border border-[#2A3445]"
                      : "text-[#94A3B8] hover:bg-[#191F2B]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="pt-1">
              <span className="text-[10px] text-[#64748B] uppercase font-medium block px-2 mb-1">
                More Modules
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {secondaryNav.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium text-left ${
                      activeTab === item.id
                        ? "bg-[#202838] text-[#3B82F6]"
                        : "text-[#94A3B8] hover:bg-[#191F2B]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
