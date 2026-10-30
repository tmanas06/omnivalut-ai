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
  const currentPrice = market.current_price ?? 0.8542;
  const portfolio = overview?.portfolio || {};
  const availableCash = portfolio.cash_balance_usd ?? 1000.0;

  useEffect(() => {
    fetchCandles(selectedPair, 60).then((data) => {
      if (data?.candles) setCandles(data.candles);
    });
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
  const estimatedSlippage = 0.15; // 0.15%
  const estGasUsd = 0.0001;

  return (
    <div className="space-y-6">
      {/* Pair Header & Live Stats */}
      <div className="terminal-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <select
            value={selectedPair}
            onChange={(e) => setSelectedPair(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-100 text-sm font-bold rounded px-3 py-1.5 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="WHSK/USDT">WHSK / USDT (0.3% Pool)</option>
            <option value="WHSK/USDC.e">WHSK / USDC.e (0.05% Pool)</option>
          </select>
          <div className="flex items-baseline space-x-2">
            <span className="text-xl font-bold font-mono text-slate-100">
              ${currentPrice.toFixed(4)}
            </span>
            <span className={`text-xs font-mono font-semibold ${(market.change_24h_pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {(market.change_24h_pct ?? 0) >= 0 ? "+" : ""}{(market.change_24h_pct ?? 0).toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-6 text-xs font-mono text-slate-400">
          <div>
            <span className="text-slate-500 block text-[10px]">24h Volume</span>
            <span className="text-slate-200">${(market.volume_24h_usd ?? 45200).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Volatility</span>
            <span className="text-slate-200">{((market.volatility ?? 0.025) * 100).toFixed(2)}%</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Pool Address</span>
            <span className="text-cyan-400">0xc076...4a50</span>
          </div>
        </div>
      </div>

      {/* Main Terminal View: Interactive Chart & Trade Order Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recharts Chart & Technical Indicators */}
        <div className="lg:col-span-2 space-y-4">
          <div className="terminal-card p-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <span className="text-xs font-semibold text-slate-300 font-mono">1m Price Feed & Moving Averages</span>
              <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400">
                <span className="flex items-center space-x-1">
                  <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
                  <span>Price</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
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
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(unix) => new Date(unix * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    stroke="#475569"
                    fontSize={10}
                    fontFamily="monospace"
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    stroke="#475569"
                    fontSize={10}
                    fontFamily="monospace"
                    tickFormatter={(val) => `$${val.toFixed(4)}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0b0f17", borderColor: "#1e293b", borderRadius: "0.375rem", fontSize: "11px", fontFamily: "monospace" }}
                    formatter={(value: any) => [`$${Number(value).toFixed(4)}`, "Price"]}
                    labelFormatter={(label: any) => new Date(label * 1000).toLocaleTimeString()}
                  />
                  <Area type="monotone" dataKey="close" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#priceGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Technical Indicators Matrix */}
          <div className="terminal-card p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 block">RSI (14)</span>
              <span className="text-cyan-400 font-bold text-sm">48.2</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Neutral Zone</span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 block">MACD Hist</span>
              <span className="text-emerald-400 font-bold text-sm">+0.0014</span>
              <span className="text-[10px] text-emerald-400 block mt-0.5">Bullish Momentum</span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Bollinger Bandwidth</span>
              <span className="text-slate-200 font-bold text-sm">1.8%</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Low Volatility</span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Volume Surge</span>
              <span className="text-slate-200 font-bold text-sm">1.12x</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Normal Volume</span>
            </div>
          </div>
        </div>

        {/* Right Column: Execution Form with Deterministic Risk Pre-Validation */}
        <div className="space-y-4">
          <div className="terminal-card p-5">
            <h3 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2.5 mb-4 flex items-center justify-between">
              <span>HSKSwap Swap Order</span>
              <span className="text-[10px] font-mono bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800">
                SwapRouter02
              </span>
            </h3>

            {/* Buy / Sell Tabs */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setDirection("BUY")}
                className={`py-2 text-xs font-bold rounded transition font-mono ${
                  direction === "BUY"
                    ? "bg-emerald-600 text-black shadow-md"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200"
                }`}
              >
                BUY WHSK
              </button>
              <button
                onClick={() => setDirection("SELL")}
                className={`py-2 text-xs font-bold rounded transition font-mono ${
                  direction === "SELL"
                    ? "bg-red-600 text-black shadow-md"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200"
                }`}
              >
                SELL WHSK
              </button>
            </div>

            {/* Trade Size Slider & Input */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Order Allocation ($)</span>
                <span className="text-slate-200 font-bold">${tradeSizeUsd.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="10"
                max={Math.min(500, availableCash)}
                step="5"
                value={tradeSizeUsd}
                onChange={(e) => setTradeSizeUsd(Number(e.target.value))}
                className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>Min: $10</span>
                <span>Max: ${Math.min(500, availableCash).toFixed(0)}</span>
              </div>
            </div>

            {/* Order Summary & Risk Parameters */}
            <div className="bg-slate-900/60 p-3 rounded border border-slate-800/80 my-4 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Estimated Received:</span>
                <span className="text-slate-100 font-semibold">
                  {estimatedTokens.toFixed(4)} {direction === "BUY" ? "WHSK" : "USDT"}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Price Impact / Slippage:</span>
                <span className="text-slate-200">{estimatedSlippage}%</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Estimated Gas:</span>
                <span className="text-slate-200">&lt; ${estGasUsd.toFixed(4)} HSK</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Stop Loss Target:</span>
                <span className="text-red-400">${(currentPrice * 0.985).toFixed(4)} (-1.5%)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Take Profit Target:</span>
                <span className="text-emerald-400">${(currentPrice * 1.035).toFixed(4)} (+3.5%)</span>
              </div>
            </div>

            {/* Error or Success Notice */}
            {tradeError && (
              <div className="bg-red-950/80 border border-red-800 rounded p-2.5 text-xs text-red-200 flex items-start space-x-2 my-3">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <span className="font-mono">{tradeError}</span>
              </div>
            )}
            {tradeSuccess && (
              <div className="bg-emerald-950/80 border border-emerald-800 rounded p-2.5 text-xs text-emerald-200 flex items-start space-x-2 my-3">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="font-mono">
                  Trade executed! Mode: {tradeSuccess.execution.execution_mode.toUpperCase()} • Tx:{" "}
                  {tradeSuccess.execution.tx_hash.slice(0, 14)}...
                </span>
              </div>
            )}

            {/* Execute Button */}
            <button
              onClick={handleExecute}
              disabled={isSubmitting}
              className={`w-full py-2.5 rounded font-bold text-xs uppercase tracking-wider font-mono transition-all ${
                direction === "BUY"
                  ? "bg-emerald-500 hover:bg-emerald-400 text-black"
                  : "bg-red-500 hover:bg-red-400 text-black"
              } disabled:opacity-50`}
            >
              {isSubmitting ? "Validating Risk..." : `Submit ${direction} via HSKSwap`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
