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
  ArrowRight
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
    <div className="fintech-card p-5 h-[650px] flex flex-col justify-between">
      {/* Header */}
      <div className="border-b border-[#2A3445] pb-3 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-lg bg-[#202838] border border-[#2A3445] flex items-center justify-center text-[#3B82F6]">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#F1F5F9]">AI Portfolio &amp; Trading Assistant</h2>
            <p className="text-[11px] text-[#94A3B8]">Natural language queries parsed into deterministic API and risk calls</p>
          </div>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#202838] text-[#3B82F6] border border-[#2A3445] font-medium">
          Intent Engine Active
        </span>
      </div>

      {/* Suggested Quick Prompts Pills */}
      <div className="py-2.5 flex items-center space-x-2 overflow-x-auto border-b border-[#2A3445]/60 pb-2">
        <span className="text-[11px] text-[#94A3B8] font-medium shrink-0">Suggestions:</span>
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p)}
            className="text-xs whitespace-nowrap bg-[#151922] hover:bg-[#202838] text-[#94A3B8] hover:text-[#F1F5F9] px-3 py-1 rounded-full border border-[#2A3445] transition"
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
              <div className="h-7 w-7 rounded-lg bg-[#202838] text-[#3B82F6] border border-[#2A3445] flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-3.5 w-3.5" />
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-xl p-3.5 text-xs leading-relaxed ${
                m.sender === "user"
                  ? "bg-[#3B82F6] text-white"
                  : "bg-[#151922] text-[#F1F5F9] border border-[#2A3445]"
              }`}
            >
              <div className="whitespace-pre-line">{m.text}</div>

              {/* Action Confirmation Banner */}
              {m.requiresConfirmation && !m.actionExecuted && (
                <div className="mt-3 p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg">
                  <div className="flex items-center space-x-2 text-[#F59E0B] font-semibold mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Explicit Operator Confirmation Required</span>
                  </div>
                  <p className="text-[11px] text-[#94A3B8] mb-2.5">
                    Action: <span className="text-[#F1F5F9] font-medium">{m.parsedIntent?.intent}</span>
                    {m.parsedIntent?.parameter && ` (${m.parsedIntent.parameter} = ${m.parsedIntent.value})`}
                  </p>
                  <button
                    onClick={() => handleConfirmAction(m.id, m.parsedIntent)}
                    className="px-3 py-1.5 bg-[#10B981] hover:bg-emerald-600 text-white font-medium rounded-lg text-xs transition"
                  >
                    Confirm &amp; Execute Action
                  </button>
                </div>
              )}

              <div className={`text-[10px] mt-1.5 ${m.sender === "user" ? "text-blue-200 text-right" : "text-[#94A3B8]"}`}>
                {m.timestamp}
              </div>
            </div>

            {m.sender === "user" && (
              <div className="h-7 w-7 rounded-lg bg-[#202838] text-[#94A3B8] border border-[#2A3445] flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center space-x-2 text-xs text-[#3B82F6] animate-pulse">
            <Bot className="h-4 w-4" />
            <span>Agent supervisor analyzing intent...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="border-t border-[#2A3445] pt-3 flex items-center space-x-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask AI assistant (e.g. 'Show my positions', 'Buy $50 WHSK', 'Set slippage to 0.5%')..."
          className="flex-1 fintech-input text-xs py-2 px-3.5"
        />
        <button
          onClick={() => handleSend()}
          disabled={isLoading || !input.trim()}
          className="bg-[#3B82F6] hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium text-xs flex items-center space-x-1.5 transition disabled:opacity-50"
        >
          <span>Send</span>
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
