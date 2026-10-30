"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Bot,
  Send,
  User,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Shield,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { sendAIChat, executeTrade, updateRiskPolicy, toggleEmergencyPause } from "@/lib/api";

interface AIAssistantProps {
  onRefresh: () => void;
}

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  parsedIntent?: any;
  requiresConfirmation?: boolean;
  actionData?: any;
  actionExecuted?: boolean;
  timestamp: string;
}

export default function AIAssistant({ onRefresh }: AIAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg_welcome",
      sender: "bot",
      text: "Hello! I am your OmniVault AI Assistant on HashKey Chain. You can ask me to monitor HSKSwap pools, adjust deterministic risk rules, evaluate open positions, or propose swaps.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const quickPrompts = [
    "Show my open positions",
    "What's my current profit and loss?",
    "Find the best available trading opportunity",
    "Reduce my maximum trade allocation to 5%",
    "Explain why the last trade was rejected",
    "Show me the best-performing agent",
    "Pause all new trades",
    "Buy $50 worth of WHSK",
  ];

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await sendAIChat(query);
      const botMsg: ChatMessage = {
        id: `bot_${Date.now()}`,
        sender: "bot",
        text: res.reply,
        parsedIntent: res.parsed_intent,
        requiresConfirmation: res.requires_confirmation,
        actionData: res.action_data,
        actionExecuted: false,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (e) {
      console.error("Chat error:", e);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: "bot",
          text: "I encountered an error communicating with the agent supervisor. Please try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAction = async (msgId: string, intent: any) => {
    try {
      if (intent.intent === "UPDATE_RISK_POLICY") {
        await updateRiskPolicy({ [intent.parameter]: intent.value });
      } else if (intent.intent === "PAUSE_TRADING") {
        await toggleEmergencyPause(true);
      } else if (intent.intent === "RESUME_TRADING") {
        await toggleEmergencyPause(false);
      } else if (intent.intent === "PROPOSE_MANUAL_TRADE") {
        await executeTrade({
          pair: intent.value || "WHSK/USDT",
          direction: "BUY",
          trade_size_usd: 50.0,
        });
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, actionExecuted: true, text: `${m.text}\n\n✅ Action successfully confirmed and enforced by deterministic risk engine.` } : m
        )
      );
      onRefresh();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  };

  return (
    <div className="terminal-card p-5 h-[650px] flex flex-col justify-between">
      {/* Header */}
      <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Bot className="h-5 w-5 text-cyan-400" />
          <h2 className="text-sm font-bold text-slate-100">Conversational Natural Language Interface</h2>
        </div>
        <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
          OpenRouter / Rule Parser Active
        </span>
      </div>

      {/* Suggested Quick Prompts Pills */}
      <div className="py-2 flex items-center space-x-2 overflow-x-auto border-b border-slate-900 pb-2">
        <span className="text-[10px] font-mono text-slate-500 shrink-0">Suggestions:</span>
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p)}
            className="text-[11px] font-mono whitespace-nowrap bg-slate-900 hover:bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-800 transition"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start space-x-3 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.sender === "bot" && (
              <div className="h-7 w-7 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-4 w-4" />
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-lg p-3.5 text-xs font-mono leading-relaxed ${
                m.sender === "user"
                  ? "bg-slate-800 text-slate-100 border border-slate-700"
                  : "bg-slate-900/90 text-slate-200 border border-slate-800"
              }`}
            >
              <div className="whitespace-pre-line">{m.text}</div>

              {/* Action Confirmation Banner */}
              {m.requiresConfirmation && !m.actionExecuted && (
                <div className="mt-3 p-3 bg-amber-950/40 border border-amber-800/80 rounded">
                  <div className="flex items-center space-x-2 text-amber-300 font-bold mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Explicit Financial Confirmation Required</span>
                  </div>
                  <p className="text-[11px] text-slate-300 mb-2">
                    Action: <span className="text-cyan-400 font-bold">{m.parsedIntent?.intent}</span>
                    {m.parsedIntent?.parameter && ` (${m.parsedIntent.parameter} = ${m.parsedIntent.value})`}
                  </p>
                  <button
                    onClick={() => handleConfirmAction(m.id, m.parsedIntent)}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded text-[11px] transition shadow"
                  >
                    Confirm & Execute Action
                  </button>
                </div>
              )}

              <div className="text-[9px] text-slate-500 text-right mt-1.5">{m.timestamp}</div>
            </div>

            {m.sender === "user" && (
              <div className="h-7 w-7 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400 animate-pulse">
            <Bot className="h-4 w-4" />
            <span>Agent supervisor analyzing intent...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="border-t border-slate-800 pt-3 flex items-center space-x-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask AI assistant (e.g. 'Show my positions', 'Buy $50 WHSK', 'Set slippage to 0.5%')..."
          className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3.5 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
        <button
          onClick={() => handleSend()}
          disabled={isLoading || !input.trim()}
          className="bg-cyan-600 hover:bg-cyan-500 text-black px-4 py-2 rounded-md font-bold text-xs flex items-center space-x-1.5 transition disabled:opacity-50"
        >
          <span>Send</span>
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
