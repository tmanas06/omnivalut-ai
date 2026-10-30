import re
import json
import logging
from typing import Dict, Any, Optional
import httpx
from pydantic import BaseModel
from backend.config import settings

logger = logging.getLogger("omnivault.ai")

class ParsedIntent(BaseModel):
    intent: str
    action_type: str # "READ_ONLY", "RISK_UPDATE", "TRADE_PROPOSAL", "EMERGENCY_CONTROL"
    parameter: Optional[str] = None
    value: Optional[Any] = None
    unit: Optional[str] = None
    requires_confirmation: bool
    summary_message: str
    raw_query: str

class NaturalLanguageAgent:
    """
    Translates trader natural language prompts into strictly validated financial intents.
    Supports OpenRouter LLM API when configured, with a deterministic parsing fallback.
    """

    def __init__(self):
        self.api_key = settings.LLM_API_KEY
        self.model = settings.LLM_MODEL
        self.base_url = settings.LLM_BASE_URL

    async def parse_query(self, query: str, context: Optional[Dict[str, Any]] = None) -> ParsedIntent:
        q_clean = query.strip()
        q_lower = q_clean.lower()

        # Try LLM first if API key is provided
        if self.api_key:
            try:
                llm_result = await self._call_llm(q_clean, context)
                if llm_result:
                    return llm_result
            except Exception as e:
                logger.warning(f"LLM API call failed, falling back to deterministic parser: {e}")

        # Deterministic Regex & Keyword Parser
        return self._rule_based_parse(q_clean, q_lower)

    def _rule_based_parse(self, query: str, q: str) -> ParsedIntent:
        # 1. EMERGENCY PAUSE / RESUME
        if any(w in q for w in ["pause", "stop all trades", "halt trading", "freeze", "killswitch"]):
            return ParsedIntent(
                intent="PAUSE_TRADING",
                action_type="EMERGENCY_CONTROL",
                parameter="emergency_pause_active",
                value=True,
                requires_confirmation=True,
                summary_message="Emergency Circuit Breaker: Halting all new autonomous trades and executions.",
                raw_query=query,
            )
        if any(w in q for w in ["resume", "unpause", "start trading again", "continue trading"]):
            return ParsedIntent(
                intent="RESUME_TRADING",
                action_type="EMERGENCY_CONTROL",
                parameter="emergency_pause_active",
                value=False,
                requires_confirmation=True,
                summary_message="Disabling Emergency Circuit Breaker: Resuming normal multi-agent trading execution.",
                raw_query=query,
            )

        # 2. UPDATE RISK POLICY
        # "reduce maximum trade allocation to 5%"
        alloc_match = re.search(r"(?:allocation|trade size).*?(\d+(?:\.\d+)?)\s*%", q)
        if alloc_match:
            val = float(alloc_match.group(1))
            return ParsedIntent(
                intent="UPDATE_RISK_POLICY",
                action_type="RISK_UPDATE",
                parameter="max_trade_allocation_pct",
                value=val,
                unit="percentage",
                requires_confirmation=True,
                summary_message=f"Request to update Maximum Trade Allocation limit to {val}%.",
                raw_query=query,
            )

        # "set slippage to 0.5%"
        slip_match = re.search(r"slippage.*?(\d+(?:\.\d+)?)\s*%", q)
        if slip_match:
            val = float(slip_match.group(1))
            return ParsedIntent(
                intent="UPDATE_RISK_POLICY",
                action_type="RISK_UPDATE",
                parameter="max_slippage_pct",
                value=val,
                unit="percentage",
                requires_confirmation=True,
                summary_message=f"Request to update Maximum Slippage limit to {val}%.",
                raw_query=query,
            )

        # "set daily loss limit to 4%"
        loss_match = re.search(r"(?:daily loss|loss limit).*?(\d+(?:\.\d+)?)\s*%", q)
        if loss_match:
            val = float(loss_match.group(1))
            return ParsedIntent(
                intent="UPDATE_RISK_POLICY",
                action_type="RISK_UPDATE",
                parameter="max_daily_loss_pct",
                value=val,
                unit="percentage",
                requires_confirmation=True,
                summary_message=f"Request to update Maximum Daily Loss limit to {val}%.",
                raw_query=query,
            )

        # 3. TRADE PROPOSALS
        # "buy $50 worth of WHSK" or "buy 20 WHSK"
        buy_match = re.search(r"buy\s+(?:\$?\s*(\d+(?:\.\d+)?)\s*(?:worth of\s*)?([a-zA-Z\.\-]+)|\s*([a-zA-Z\.\-]+))", q)
        if buy_match:
            amount = float(buy_match.group(1)) if buy_match.group(1) else 25.0
            token = (buy_match.group(2) or buy_match.group(3) or "WHSK").upper()
            return ParsedIntent(
                intent="PROPOSE_MANUAL_TRADE",
                action_type="TRADE_PROPOSAL",
                parameter="pair",
                value=f"{token}/USDT",
                unit="USD",
                requires_confirmation=True,
                summary_message=f"Proposed Manual Swap: Buy ${amount:.2f} of {token} via HSKSwap on HashKey Chain.",
                raw_query=query,
            )

        # 4. READ-ONLY INQUIRIES (No Confirmation Needed)
        if any(w in q for w in ["open positions", "my positions", "active positions", "portfolio holding"]):
            return ParsedIntent(
                intent="GET_POSITIONS",
                action_type="READ_ONLY",
                requires_confirmation=False,
                summary_message="Retrieving active open positions, entry prices, and unrealized P&L...",
                raw_query=query,
            )

        if any(w in q for w in ["pnl", "profit and loss", "how much did i make", "returns", "performance"]):
            return ParsedIntent(
                intent="GET_PNL",
                action_type="READ_ONLY",
                requires_confirmation=False,
                summary_message="Aggregating realized & unrealized portfolio P&L metrics across HashKey Testnet...",
                raw_query=query,
            )

        if any(w in q for w in ["best opportunity", "opportunity", "find trade", "best signal", "what should i buy"]):
            return ParsedIntent(
                intent="GET_BEST_OPPORTUNITY",
                action_type="READ_ONLY",
                requires_confirmation=False,
                summary_message="Scanning live HSKSwap order book and technical indicators for top-scored trade opportunity...",
                raw_query=query,
            )

        if any(w in q for w in ["rejected", "why was", "rejection", "decline"]):
            return ParsedIntent(
                intent="EXPLAIN_REJECTION",
                action_type="READ_ONLY",
                requires_confirmation=False,
                summary_message="Inspecting deterministic risk engine audit logs for last rejected trade proposal...",
                raw_query=query,
            )

        if any(w in q for w in ["best agent", "top agent", "performing agent", "agent performance"]):
            return ParsedIntent(
                intent="GET_BEST_AGENT",
                action_type="READ_ONLY",
                requires_confirmation=False,
                summary_message="Evaluating win rates and signal accuracies across all 7 autonomous agents...",
                raw_query=query,
            )

        # Default fallback inquiry
        return ParsedIntent(
            intent="GENERAL_INQUIRY",
            action_type="READ_ONLY",
            requires_confirmation=False,
            summary_message="OmniVault AI Assistant: Ready to manage strategies, review risk rules, or inspect on-chain positions.",
            raw_query=query,
        )

    async def _call_llm(self, query: str, context: Optional[Dict[str, Any]]) -> Optional[ParsedIntent]:
        system_prompt = """You are the AI trading assistant for OmniVault AI on HashKey Chain.
Translate the user's message into a strict JSON intent conforming to this schema:
{
  "intent": "UPDATE_RISK_POLICY" | "PROPOSE_MANUAL_TRADE" | "PAUSE_TRADING" | "RESUME_TRADING" | "GET_POSITIONS" | "GET_PNL" | "GET_BEST_OPPORTUNITY" | "EXPLAIN_REJECTION" | "GET_BEST_AGENT" | "GENERAL_INQUIRY",
  "action_type": "READ_ONLY" | "RISK_UPDATE" | "TRADE_PROPOSAL" | "EMERGENCY_CONTROL",
  "parameter": string or null,
  "value": any or null,
  "unit": string or null,
  "requires_confirmation": boolean,
  "summary_message": string
}
Financial actions (trades, risk policy changes, pauses) MUST have requires_confirmation: true.
Read-only queries MUST have requires_confirmation: false.
Respond ONLY with raw valid JSON."""

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query},
            ],
            "response_format": {"type": "json_object"},
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                parsed["raw_query"] = query
                return ParsedIntent(**parsed)
        return None
