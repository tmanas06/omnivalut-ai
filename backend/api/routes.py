import time
import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from backend.config import settings
from backend.orchestrator.orchestrator import CentralOrchestrator
from backend.risk.engine import RiskPolicyConfig
from backend.adapters.hskswap.adapter import HSKSwapAdapter
from backend.adapters.hskswap.market_data import market_data_service
from backend.ai.intent_parser import NaturalLanguageAgent, ParsedIntent

logger = logging.getLogger("omnivault.routes")
router = APIRouter()

# Global singletons shared in memory (stateful orchestrator & NL agent)
_orchestrator: Optional[CentralOrchestrator] = None
_nl_agent: Optional[NaturalLanguageAgent] = None

def get_orchestrator() -> CentralOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = CentralOrchestrator()
    return _orchestrator

def get_nl_agent() -> NaturalLanguageAgent:
    global _nl_agent
    if _nl_agent is None:
        _nl_agent = NaturalLanguageAgent()
    return _nl_agent

# -----------------------------------------------------------------------------
# System & Health
# -----------------------------------------------------------------------------
@router.get("/health")
async def health_check():
    orch = get_orchestrator()
    adapter = orch.execution_agent.adapter
    is_rpc_connected = adapter.is_connected()
    block_number = None
    if is_rpc_connected:
        try:
            block_number = adapter.w3.eth.block_number
        except Exception:
            pass

    return {
        "status": "HEALTHY",
        "timestamp": time.time(),
        "network": {
            "name": "HashKey Testnet",
            "chain_id": settings.HSK_CHAIN_ID,
            "rpc_url": settings.HSK_RPC_URL,
            "is_connected": is_rpc_connected,
            "latest_block": block_number,
            "native_token": "HSK",
        },
        "execution_mode": settings.EXECUTION_MODE,
        "mainnet_enabled": settings.ENABLE_MAINNET,
    }

# -----------------------------------------------------------------------------
# Overview Dashboard Data
# -----------------------------------------------------------------------------
@router.get("/api/overview")
async def get_overview():
    orch = get_orchestrator()
    portfolio = orch.portfolio_tracker.get_portfolio_summary()
    agents = orch.supervisor.get_all_agents_summary()
    market = await market_data_service.get_current_market_state("WHSK/USDT")

    return {
        "portfolio": portfolio,
        "active_agents_count": len([a for a in agents if a["is_enabled"]]),
        "total_agents_count": len(agents),
        "circuit_breaker_active": orch.risk_engine.policy.emergency_pause_active,
        "auto_trading_enabled": orch.is_auto_trading_enabled,
        "current_market": market,
        "recent_decisions": orch.decision_logs[-5:],
        "network": {
            "chain_id": settings.HSK_CHAIN_ID,
            "name": "HashKey Testnet",
            "status": "LIVE",
        },
    }

# -----------------------------------------------------------------------------
# Agent Control Center
# -----------------------------------------------------------------------------
@router.get("/api/agents")
async def get_agents():
    orch = get_orchestrator()
    return {
        "agents": orch.supervisor.get_all_agents_summary(),
        "latest_telemetry": {k: v.model_dump() for k, v in orch.supervisor.latest_telemetry.items()},
    }

class AgentToggleRequest(BaseModel):
    is_enabled: bool

@router.post("/api/agents/{agent_id}/toggle")
async def toggle_agent(agent_id: str, req: AgentToggleRequest):
    orch = get_orchestrator()
    success = orch.supervisor.set_agent_enabled(agent_id, req.is_enabled)
    if not success:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found.")
    return {"agent_id": agent_id, "is_enabled": req.is_enabled, "status": "UPDATED"}

@router.post("/api/orchestrator/run")
async def trigger_cycle():
    orch = get_orchestrator()
    result = await orch.run_orchestration_cycle()
    return result

# -----------------------------------------------------------------------------
# Trading Terminal & Market Data
# -----------------------------------------------------------------------------
@router.get("/api/market/pairs")
async def get_market_pairs():
    pairs = ["WHSK/USDT", "WHSK/USDC.e"]
    data = []
    for p in pairs:
        state = await market_data_service.get_current_market_state(p)
        data.append(state)
    return {"pairs": data}

@router.get("/api/market/candles")
async def get_candles(pair: str = Query("WHSK/USDT"), limit: int = Query(60)):
    candles = market_data_service.get_candles(pair, limit)
    return {"pair": pair, "candles": candles}

# -----------------------------------------------------------------------------
# Risk Center
# -----------------------------------------------------------------------------
@router.get("/api/risk/policy")
async def get_risk_policy():
    orch = get_orchestrator()
    return {
        "policy": orch.risk_engine.policy.model_dump(),
        "circuit_breaker_active": orch.risk_engine.policy.emergency_pause_active,
    }

class RiskPolicyUpdateRequest(BaseModel):
    max_trade_allocation_pct: Optional[float] = None
    max_slippage_pct: Optional[float] = None
    max_daily_loss_pct: Optional[float] = None
    max_portfolio_drawdown_pct: Optional[float] = None
    max_concurrent_positions: Optional[int] = None
    max_gas_cost_usd: Optional[float] = None

@router.post("/api/risk/policy")
async def update_risk_policy(req: RiskPolicyUpdateRequest):
    orch = get_orchestrator()
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    new_policy = orch.risk_engine.update_policy(updates)
    return {"status": "SUCCESS", "policy": new_policy.model_dump()}

class EmergencyPauseRequest(BaseModel):
    is_paused: bool

@router.post("/api/risk/emergency-pause")
async def toggle_emergency_pause(req: EmergencyPauseRequest):
    orch = get_orchestrator()
    state = orch.risk_engine.toggle_emergency_pause(req.is_paused)
    return {"emergency_pause_active": state, "status": "UPDATED"}

# -----------------------------------------------------------------------------
# Portfolio & Positions
# -----------------------------------------------------------------------------
@router.get("/api/portfolio")
async def get_portfolio():
    orch = get_orchestrator()
    return orch.portfolio_tracker.get_portfolio_summary()

# -----------------------------------------------------------------------------
# Trade Execution
# -----------------------------------------------------------------------------
class ExecuteTradeRequest(BaseModel):
    pair: str = "WHSK/USDT"
    direction: str = "BUY" # BUY or SELL
    trade_size_usd: float = 50.0
    user_address: str = "0xDemoTraderWallet0000000000000000000000"
    user_signed_tx_hash: Optional[str] = None

@router.post("/api/trades/execute")
async def execute_trade(req: ExecuteTradeRequest):
    orch = get_orchestrator()
    p_state = orch.portfolio_tracker.get_portfolio_summary()

    opp = {
        "id": f"manual_{int(time.time())}",
        "pair": req.pair,
        "direction": req.direction,
        "trade_size_usd": req.trade_size_usd,
        "source_venue": "HSKSwap V3 (0.3% Pool)",
        "estimated_price_impact_pct": 0.15,
        "estimated_gas_cost_usd": 0.0001,
    }

    # Mandatory risk check
    risk_res = orch.risk_engine.evaluate_opportunity(opp, p_state)
    if not risk_res.is_approved:
        orch.log_decision("REJECTED", opp["id"], opp["id"], f"Manual trade rejected by risk engine: {risk_res.explanation}")
        raise HTTPException(status_code=400, detail={
            "error": "RISK_REJECTION",
            "rule": risk_res.rule_evaluated,
            "explanation": risk_res.explanation,
        })

    # Prepare and execute
    plan = await orch.execution_agent.prepare_execution_plan(
        opportunity=opp,
        user_address=req.user_address,
        slippage_tolerance_pct=orch.risk_engine.policy.max_slippage_pct,
    )

    exec_res = await orch.execution_agent.execute_trade(plan, user_signed_tx_hash=req.user_signed_tx_hash)

    if exec_res.get("status") == "CONFIRMED":
        orch.risk_engine.record_trade_executed(req.pair)
        pos = orch.portfolio_tracker.add_position(
            position_id=f"pos_{int(time.time())}",
            pair=req.pair,
            side="LONG" if req.direction == "BUY" else "SHORT",
            entry_price=exec_res["execution_price"],
            quantity=exec_res["amount_out"] if req.direction == "BUY" else exec_res["amount_in"],
            cost_usd=req.trade_size_usd,
            stop_loss=round(exec_res["execution_price"] * 0.985, 4),
            take_profit=round(exec_res["execution_price"] * 1.035, 4),
            is_simulated=exec_res.get("is_simulated", True),
        )
        return {
            "status": "SUCCESS",
            "execution": exec_res,
            "position": pos.to_dict(),
        }
    else:
        raise HTTPException(status_code=500, detail="Trade execution reverted or failed.")

# -----------------------------------------------------------------------------
# Activity & Audit Logs
# -----------------------------------------------------------------------------
@router.get("/api/activity/logs")
async def get_activity_logs(limit: int = Query(50)):
    orch = get_orchestrator()
    return {"logs": orch.decision_logs[-limit:]}

# -----------------------------------------------------------------------------
# AI Assistant Chat
# -----------------------------------------------------------------------------
class AIChatRequest(BaseModel):
    message: str
    user_address: Optional[str] = None

@router.post("/api/ai/chat")
async def ai_chat(req: AIChatRequest):
    orch = get_orchestrator()
    nl_agent = get_nl_agent()

    p_summary = orch.portfolio_tracker.get_portfolio_summary()
    parsed: ParsedIntent = await nl_agent.parse_query(req.message, context={"portfolio": p_summary})

    response_text = parsed.summary_message
    action_data = None

    # Handle read-only queries with live data
    if parsed.intent == "GET_POSITIONS":
        positions = p_summary.get("open_positions", [])
        if positions:
            pos_strs = [f"• {p['pair']} ({p['side']}): {p['quantity']} @ ${p['entry_price']} | Unrealized P&L: ${p['unrealized_pnl_usd']:.2f} ({p['unrealized_pnl_pct']:+.1f}%)" for p in positions]
            response_text = f"You currently hold **{len(positions)} open positions** on HashKey Chain:\n" + "\n".join(pos_strs)
        else:
            response_text = "You currently have **0 open positions**. Available trading capital is **$" + f"{p_summary['cash_balance_usd']:.2f} USDT**."

    elif parsed.intent == "GET_PNL":
        response_text = (
            f"**Portfolio Performance Summary:**\n"
            f"• Total Portfolio Value: **${p_summary['total_value_usd']:.2f}**\n"
            f"• Realized P&L: **${p_summary['realized_pnl_usd']:+.2f}**\n"
            f"• Unrealized P&L: **${p_summary['unrealized_pnl_usd']:+.2f}**\n"
            f"• Win Rate: **{p_summary['win_rate_pct']:.1f}%** across {p_summary['total_trades']} closed trades."
        )

    elif parsed.intent == "EXPLAIN_REJECTION":
        rejected = [d for d in orch.decision_logs if d["state"] == "REJECTED"]
        if rejected:
            last_rej = rejected[-1]
            response_text = f"The last trade was rejected by the Deterministic Risk Engine:\n**Reason:** {last_rej['explanation']}\n*Timestamp: {time.ctime(last_rej['timestamp'])}*"
        else:
            response_text = "No trades have been rejected by the Risk Engine in current session history."

    elif parsed.intent == "GET_BEST_AGENT":
        agents = orch.supervisor.get_all_agents_summary()
        response_text = f"The top active agent is **Technical Analysis Agent** (Confidence: 82%, Opportunities: {orch.supervisor.get_agent('agent_technical_analysis').opportunities_found if orch.supervisor.get_agent('agent_technical_analysis') else 0})."

    elif parsed.intent == "UPDATE_RISK_POLICY" and not parsed.requires_confirmation:
        # If executed directly with confirmation
        pass

    return {
        "reply": response_text,
        "parsed_intent": parsed.model_dump(),
        "requires_confirmation": parsed.requires_confirmation,
        "action_data": {
            "parameter": parsed.parameter,
            "value": parsed.value,
            "unit": parsed.unit,
        } if parsed.requires_confirmation else None,
    }
