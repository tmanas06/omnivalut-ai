"use client";

import React, { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowDownUp,
  Sliders,
  ShieldAlert,
  CheckCircle,
  AlertCircle,
  Fuel,
  Percent,
  Layers,
  Sparkles,
  TrendingUp,
  Terminal,
  Activity
} from "lucide-react";
import { fetchCandles, executeTrade } from "@/lib/api";

interface TerminalProps {
  overview: any;
  onRefresh: () => void;
}

export default function TradingTerminal({ overview, onRefresh }: TerminalProps) {
  const [selectedPair, setSelectedPair] = useState("WHSK/USDT");
  const [direction, setDirection] = useState<"BUY" | "SELL">("BUY");
  const [tradeSizeUsd, setTradeSizeUsd] = useState(50);
  const [candles, setCandles] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<any | null>(null);

  const market = overview?.current_market || {};
  const currentPrice = market.current_price ?? 0.8124;
  const portfolio = overview?.portfolio || {};
  const availableCash = portfolio.cash_balance_usd ?? 1000.0;

  useEffect(() => {
    fetchCandles(selectedPair, 60)
      .then((data) => {
        if (data?.candles) setCandles(data.candles);
      })
      .catch((e) => console.debug("Candles fetch:", e));
  }, [selectedPair]);

  const handleExecute = async () => {
    setIsSubmitting(true);
    setTradeError(null);
    setTradeSuccess(null);

    try {
      const res = await executeTrade({
        pair: selectedPair,
        direction: direction,
        trade_size_usd: tradeSizeUsd,
      });
      setTradeSuccess(res);
      onRefresh();
    } catch (err: any) {
      setTradeError(err.message || "Trade rejected by Risk Engine.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pre-calculate trade metrics
  const estimatedTokens = direction === "BUY" ? tradeSizeUsd / currentPrice : tradeSizeUsd;
  const estimatedSlippage = 0.12; // 0.12%
  const estGasUsd = 0.0001;

  return (
    <div className="space-y-6">
      {/* Pair Header & Live Stats */}
      <div className="fintech-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <select
            value={selectedPair}
            onChange={(e) => setSelectedPair(e.target.value)}
            className="fintech-input text-xs font-semibold px-3 py-1.5"
          >
            <option value="WHSK/USDT">WHSK / USDT (0.3% Pool)</option>
            <option value="WHSK/USDC.e">WHSK / USDC.e (0.05% Pool)</option>
          </select>
          <div className="flex items-baseline space-x-2">
            <span className="text-xl font-semibold text-[#F1F5F9] num-tabular">
              ${currentPrice.toFixed(4)}
            </span>
            <span className={`text-xs font-medium num-tabular ${(market.change_24h_pct ?? 0) >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
              {(market.change_24h_pct ?? 0) >= 0 ? "+" : ""}{(market.change_24h_pct ?? 0).toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-6 text-xs text-[#94A3B8]">
          <div>
            <span className="text-[#94A3B8] block text-[10px] font-medium">24H VOLUME</span>
            <span className="text-[#F1F5F9] font-medium num-tabular">${(market.volume_24h_usd ?? 48920).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[#94A3B8] block text-[10px] font-medium">VOLATILITY</span>
            <span className="text-[#F1F5F9] font-medium num-tabular">{((market.volatility ?? 0.024) * 100).toFixed(2)}%</span>
          </div>
          <div>
            <span className="text-[#94A3B8] block text-[10px] font-medium">POOL CONTRACT</span>
            <span className="text-[#3B82F6] font-mono">0x8920...43e7</span>
          </div>
        </div>
      </div>

      {/* Main Terminal View: Interactive Chart & Trade Order Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recharts Chart & Technical Indicators */}
        <div className="lg:col-span-2 space-y-4">
          <div className="fintech-card p-5">
            <div className="flex items-center justify-between border-b border-[#2A3445] pb-3 mb-4">
              <span className="text-xs font-semibold text-[#F1F5F9]">1m Price Feed &amp; Moving Averages</span>
              <div className="flex items-center space-x-3 text-xs text-[#94A3B8]">
                <span className="flex items-center space-x-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#3B82F6]"></span>
                  <span>Price</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#10B981]"></span>
                  <span>EMA 9</span>
                </span>
              </div>
            </div>

            {/* Price Chart */}
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={candles}>
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(unix) => new Date(unix * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    stroke="#475569"
                    fontSize={10}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    stroke="#475569"
                    fontSize={10}
                    tickFormatter={(val) => `$${val.toFixed(4)}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#191F2B", borderColor: "#2A3445", borderRadius: "0.5rem", fontSize: "11px" }}
                    formatter={(value: any) => [`$${Number(value).toFixed(4)}`, "Price"]}
                    labelFormatter={(label: any) => new Date(label * 1000).toLocaleTimeString()}
                  />
                  <Area type="monotone" dataKey="close" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#priceGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Technical Indicators Matrix */}
          <div className="fintech-card p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-[#151922] p-3 rounded-lg border border-[#2A3445]">
              <span className="text-[10px] text-[#94A3B8] block font-medium">RSI (14)</span>
              <span className="text-[#3B82F6] font-semibold text-sm num-tabular">48.2</span>
              <span className="text-[11px] text-[#94A3B8] block mt-0.5">Neutral Zone</span>
            </div>
            <div className="bg-[#151922] p-3 rounded-lg border border-[#2A3445]">
              <span className="text-[10px] text-[#94A3B8] block font-medium">MACD HIST</span>
              <span className="text-[#10B981] font-semibold text-sm num-tabular">+0.0014</span>
              <span className="text-[11px] text-[#10B981] block mt-0.5">Bullish Momentum</span>
            </div>
            <div className="bg-[#151922] p-3 rounded-lg border border-[#2A3445]">
              <span className="text-[10px] text-[#94A3B8] block font-medium">BOLLINGER BANDWIDTH</span>
              <span className="text-[#F1F5F9] font-semibold text-sm num-tabular">1.8%</span>
              <span className="text-[11px] text-[#94A3B8] block mt-0.5">Low Volatility</span>
            </div>
            <div className="bg-[#151922] p-3 rounded-lg border border-[#2A3445]">
              <span className="text-[10px] text-[#94A3B8] block font-medium">VOLUME SURGE</span>
              <span className="text-[#F1F5F9] font-semibold text-sm num-tabular">1.12x</span>
              <span className="text-[11px] text-[#94A3B8] block mt-0.5">Normal Volume</span>
            </div>
          </div>
        </div>

        {/* Right Column: Execution Form with Deterministic Risk Pre-Validation */}
        <div className="space-y-4">
          <div className="fintech-card p-5">
            <div className="flex items-center justify-between border-b border-[#2A3445] pb-3 mb-4">
              <h2 className="text-sm font-semibold text-[#F1F5F9]">HSKSwap Order Placement</h2>
              <span className="text-[10px] font-sans bg-[#202838] text-[#3B82F6] px-2 py-0.5 rounded border border-[#2A3445] font-medium">
                SwapRouter02
              </span>
            </div>

            {/* Buy / Sell Tabs */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setDirection("BUY")}
                className={`py-2 text-xs font-semibold rounded-lg transition ${
                  direction === "BUY"
                    ? "bg-[#10B981] text-white"
                    : "bg-[#151922] text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
              >
                BUY WHSK
              </button>
              <button
                onClick={() => setDirection("SELL")}
                className={`py-2 text-xs font-semibold rounded-lg transition ${
                  direction === "SELL"
                    ? "bg-[#EF4444] text-white"
                    : "bg-[#151922] text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
              >
                SELL WHSK
              </button>
            </div>

            {/* Trade Size Slider & Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#94A3B8]">Order Allocation ($)</span>
                <span className="text-[#F1F5F9] font-semibold num-tabular">${tradeSizeUsd.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="10"
                max={Math.min(500, availableCash)}
                step="5"
                value={tradeSizeUsd}
                onChange={(e) => setTradeSizeUsd(Number(e.target.value))}
                className="w-full accent-[#3B82F6] bg-[#202838] h-1.5 rounded cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-[#94A3B8] num-tabular">
                <span>Min: $10</span>
                <span>Max: ${Math.min(500, availableCash).toFixed(0)}</span>
              </div>
            </div>

            {/* Order Summary & Risk Parameters */}
            <div className="bg-[#151922] p-3.5 rounded-xl border border-[#2A3445] my-4 space-y-2 text-xs">
              <div className="flex justify-between text-[#94A3B8]">
                <span>Estimated Received:</span>
                <span className="text-[#F1F5F9] font-semibold num-tabular">
                  {estimatedTokens.toFixed(4)} {direction === "BUY" ? "WHSK" : "USDT"}
                </span>
              </div>
              <div className="flex justify-between text-[#94A3B8]">
                <span>Price Impact / Slippage:</span>
                <span className="text-[#F1F5F9] num-tabular">{estimatedSlippage}%</span>
              </div>
              <div className="flex justify-between text-[#94A3B8]">
                <span>Estimated Gas:</span>
                <span className="text-[#F1F5F9] num-tabular">&lt; ${estGasUsd.toFixed(4)} HSK</span>
              </div>
              <div className="flex justify-between text-[#94A3B8]">
                <span>Stop Loss Target:</span>
                <span className="text-[#EF4444] font-medium num-tabular">${(currentPrice * 0.985).toFixed(4)} (-1.5%)</span>
              </div>
              <div className="flex justify-between text-[#94A3B8]">
                <span>Take Profit Target:</span>
                <span className="text-[#10B981] font-medium num-tabular">${(currentPrice * 1.035).toFixed(4)} (+3.5%)</span>
              </div>
            </div>

            {/* Error or Success Notice */}
            {tradeError && (
              <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-2.5 text-xs text-[#EF4444] flex items-start space-x-2 my-3">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{tradeError}</span>
              </div>
            )}
            {tradeSuccess && (
              <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg p-2.5 text-xs text-[#10B981] flex items-start space-x-2 my-3">
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Trade executed! Mode: {tradeSuccess.execution?.execution_mode?.toUpperCase()} • Tx:{" "}
                  {tradeSuccess.execution?.tx_hash?.slice(0, 14)}...
                </span>
              </div>
            )}

            {/* Execute Button */}
            <button
              onClick={handleExecute}
              disabled={isSubmitting}
              className={`w-full py-2.5 rounded-lg font-medium text-xs transition disabled:opacity-50 ${
                direction === "BUY"
                  ? "bg-[#10B981] hover:bg-emerald-600 text-white"
                  : "bg-[#EF4444] hover:bg-red-600 text-white"
              }`}
            >
              {isSubmitting ? "Validating Risk..." : `Submit ${direction} via HSKSwap`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
