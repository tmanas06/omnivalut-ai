import time
import uuid
import logging
from typing import Dict, Any, List, Optional, Callable, Awaitable
from backend.agents.supervisor import AgentSupervisor
from backend.risk.engine import DeterministicRiskEngine, RiskEvaluationResult
from backend.orchestrator.allocator import CapitalAllocator
from backend.execution.executor import ExecutionAgent
from backend.portfolio.tracker import PortfolioTracker
from backend.adapters.hskswap.market_data import market_data_service

logger = logging.getLogger("omnivault.orchestrator")

class CentralOrchestrator:
    """
    Central Orchestrator of OmniVault AI.
    Implements the deterministic state machine, coordinates agent execution cycles,
    enforces risk evaluation, manages capital allocation, and tracks execution outcomes.
    """

    def __init__(
        self,
        supervisor: Optional[AgentSupervisor] = None,
        risk_engine: Optional[DeterministicRiskEngine] = None,
        allocator: Optional[CapitalAllocator] = None,
        execution_agent: Optional[ExecutionAgent] = None,
        portfolio_tracker: Optional[PortfolioTracker] = None,
    ):
        self.supervisor = supervisor or AgentSupervisor()
        self.risk_engine = risk_engine or DeterministicRiskEngine()
        self.allocator = allocator or CapitalAllocator()
        self.execution_agent = execution_agent or ExecutionAgent()
        self.portfolio_tracker = portfolio_tracker or PortfolioTracker(initial_cash_usd=1000.0)
        
        # State & Decision logs
        self.decision_logs: List[Dict[str, Any]] = []
        self.active_candidates: Dict[str, Dict[str, Any]] = {}
        self.event_subscribers: List[Callable[[Dict[str, Any]], Awaitable[None]]] = []
        self.is_auto_trading_enabled: bool = True

    def subscribe_events(self, callback: Callable[[Dict[str, Any]], Awaitable[None]]):
        self.event_subscribers.append(callback)

    async def broadcast_event(self, event_type: str, payload: Dict[str, Any]):
        event = {
            "type": event_type,
            "timestamp": time.time(),
            "payload": payload,
        }
        for sub in list(self.event_subscribers):
            try:
                await sub(event)
            except Exception as e:
                logger.error(f"Error broadcasting event to subscriber: {e}")

    def log_decision(self, state: str, correlation_id: str, opportunity_id: str, explanation: str, metadata: Optional[Dict[str, Any]] = None):
        record = {
            "id": str(uuid.uuid4()),
            "correlation_id": correlation_id,
            "opportunity_id": opportunity_id,
            "state": state, # ANALYZING, OPPORTUNITY_DETECTED, RISK_CHECK, APPROVED, REJECTED, EXECUTION_PENDING, EXECUTED, FAILED
            "explanation": explanation,
            "timestamp": time.time(),
            "metadata": metadata or {},
        }
        self.decision_logs.append(record)
        if len(self.decision_logs) > 500:
            self.decision_logs.pop(0)
        logger.info(f"[{state}] Correlation: {correlation_id[:8]}... | {explanation}")
        return record

    async def run_orchestration_cycle(self) -> Dict[str, Any]:
        """
        Executes a complete lifecycle cycle across all layers.
        """
        cid = str(uuid.uuid4())
        self.log_decision("ANALYZING", cid, "", "Triggering autonomous multi-agent evaluation cycle.")

        # 1. Trigger agent cycle via Supervisor
        cycle_result = await self.supervisor.run_single_cycle(correlation_id=cid)
        opportunities = cycle_result.get("opportunities", [])
        signals = cycle_result.get("signals", [])

        # 2. Check position exits on portfolio (Stop-Loss / Take-Profit)
        market_state = await market_data_service.get_current_market_state("WHSK/USDT")
        exit_events = self.portfolio_tracker.update_market_prices({"WHSK/USDT": market_state["current_price"]})
        for ex in exit_events:
            self.log_decision(
                "CLOSED",
                cid,
                ex["position_id"],
                f"Position triggered {ex['event_type']} @ {ex['trigger_price']}. Realized P&L: ${ex['realized_pnl']:.2f}",
                metadata=ex,
            )
            await self.broadcast_event("POSITION_CLOSED", ex)

        # 3. Evaluate new opportunities
        processed_candidates = []
        for opp in opportunities:
            opp_id = opp["id"]
            self.log_decision("OPPORTUNITY_DETECTED", cid, opp_id, f"Candidate detected by {opp['agent_id']}: {opp['direction']} {opp['pair']} @ {opp['quoted_price']}", metadata=opp)

            # Sizing via Capital Allocator
            p_state = self.portfolio_tracker.get_portfolio_summary()
            allocation = self.allocator.compute_allocation(opp, p_state)
            opp["trade_size_usd"] = allocation["allocated_usd"]
            opp["token_quantity"] = allocation["token_quantity"]

            # 4. Mandatory Deterministic Risk Engine Check
            self.log_decision("RISK_CHECK", cid, opp_id, f"Evaluating candidate against 10 deterministic risk rules.")
            risk_result: RiskEvaluationResult = self.risk_engine.evaluate_opportunity(opp, p_state)

            if not risk_result.is_approved:
                # REJECTED BY RISK ENGINE
                self.log_decision(
                    "REJECTED",
                    cid,
                    opp_id,
                    f"REJECTED by Risk Rule [{risk_result.rule_evaluated}]: {risk_result.explanation}",
                    metadata={"risk_result": risk_result.model_dump()},
                )
                opp["status"] = "REJECTED"
                opp["rejection_reason"] = risk_result.explanation
                await self.broadcast_event("OPPORTUNITY_REJECTED", opp)
                processed_candidates.append(opp)
                continue

            # APPROVED BY RISK ENGINE
            self.log_decision(
                "APPROVED",
                cid,
                opp_id,
                f"APPROVED by Risk Engine: {risk_result.explanation}. Allocated: ${allocation['allocated_usd']:.2f}",
                metadata={"risk_result": risk_result.model_dump(), "allocation": allocation},
            )
            opp["status"] = "APPROVED"
            await self.broadcast_event("OPPORTUNITY_APPROVED", opp)

            # 5. Execution Phase (if Auto-Trading enabled)
            if self.is_auto_trading_enabled:
                self.log_decision("EXECUTION_PENDING", cid, opp_id, "Preparing swap route on HSKSwap SwapRouter02...")
                try:
                    plan = await self.execution_agent.prepare_execution_plan(
                        opportunity=opp,
                        user_address="0xDemoTraderWallet0000000000000000000000",
                        slippage_tolerance_pct=self.risk_engine.policy.max_slippage_pct,
                    )

                    exec_result = await self.execution_agent.execute_trade(plan)
                    if exec_result.get("status") == "CONFIRMED":
                        # Record cooldown in risk engine
                        self.risk_engine.record_trade_executed(opp["pair"])

                        # Add position to portfolio tracker
                        pos = self.portfolio_tracker.add_position(
                            position_id=str(uuid.uuid4()),
                            pair=opp["pair"],
                            side="LONG" if opp["direction"] == "BUY" else "SHORT",
                            entry_price=exec_result["execution_price"],
                            quantity=exec_result["amount_out"] if opp["direction"] == "BUY" else exec_result["amount_in"],
                            cost_usd=opp["trade_size_usd"],
                            stop_loss=opp.get("proposed_stop_loss"),
                            take_profit=opp.get("proposed_take_profit"),
                            is_simulated=exec_result.get("is_simulated", True),
                        )

                        self.log_decision(
                            "EXECUTED",
                            cid,
                            opp_id,
                            f"Trade EXECUTED on {exec_result['execution_mode'].upper()} mode. Tx: {exec_result['tx_hash'][:16]}...",
                            metadata=exec_result,
                        )
                        opp["status"] = "EXECUTED"
                        opp["execution_result"] = exec_result
                        await self.broadcast_event("TRADE_EXECUTED", {"opportunity": opp, "execution": exec_result, "position": pos.to_dict()})

                    else:
                        self.log_decision("FAILED", cid, opp_id, f"Execution reverted: {exec_result.get('status')}", metadata=exec_result)
                        opp["status"] = "FAILED"

                except Exception as ex:
                    logger.error(f"Execution failed for {opp_id}: {ex}", exc_info=True)
                    self.log_decision("FAILED", cid, opp_id, f"Execution failed: {str(ex)}")
                    opp["status"] = "FAILED"

            processed_candidates.append(opp)

        # Notify portfolio update
        summary = self.portfolio_tracker.get_portfolio_summary()
        await self.broadcast_event("PORTFOLIO_UPDATE", summary)

        return {
            "correlation_id": cid,
            "signals": signals,
            "opportunities_evaluated": len(opportunities),
            "processed_candidates": processed_candidates,
            "portfolio": summary,
            "recent_decisions": self.decision_logs[-10:],
        }
