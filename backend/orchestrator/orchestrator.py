import time
import uuid
import asyncio
import logging
from typing import Dict, Any, List, Optional, Callable, Awaitable, Set
from backend.agents.supervisor import AgentSupervisor
from backend.risk.engine import DeterministicRiskEngine, RiskEvaluationResult
from backend.orchestrator.allocator import CapitalAllocator
from backend.execution.executor import ExecutionAgent
from backend.portfolio.tracker import PortfolioTracker
from backend.adapters.hskswap.market_data import market_data_service

logger = logging.getLogger("omnivault.orchestrator")

class CentralOrchestrator:
    """
    Central Multi-Agent Trading Orchestrator of OmniVault AI.
    Coordinates continuous autonomous trading cycles across 9 formal stages:
    Market Monitoring -> Opportunity Discovery -> Agent Analysis -> Strategy Scoring
    -> Risk Validation -> Trade Proposal -> Execution Approval -> Execution -> Portfolio Reconciliation.

    ENFORCES CRITICAL SAFETY BOUNDARIES:
    - PAPER mode is default; simulated trades execute autonomously.
    - TESTNET mode blocks unattended execution; trades stop at WAITING_USER_APPROVAL.
    - Mutex lock prevents concurrent execution.
    - Fingerprint cache prevents duplicate trades.
    - Every cycle is tracked with a unique UUID correlation ID.
    """

    def __init__(
        self,
        supervisor: Optional[AgentSupervisor] = None,
        risk_engine: Optional[DeterministicRiskEngine] = None,
        allocator: Optional[CapitalAllocator] = None,
        execution_agent: Optional[ExecutionAgent] = None,
        portfolio_tracker: Optional[PortfolioTracker] = None,
    ):
        self.risk_engine = risk_engine or DeterministicRiskEngine()
        self.allocator = allocator or CapitalAllocator()
        self.execution_agent = execution_agent or ExecutionAgent()
        self.portfolio_tracker = portfolio_tracker or PortfolioTracker(
            initial_cash_usd=1000.0,
            persistence_file="data/portfolio_state.json",
        )

        self.supervisor = supervisor or AgentSupervisor(
            risk_engine=self.risk_engine,
            portfolio_tracker=self.portfolio_tracker,
        )
        
        # State, audit trail & pending proposals
        self.decision_logs: List[Dict[str, Any]] = []
        self.active_candidates: Dict[str, Dict[str, Any]] = {}
        self.pending_proposals: Dict[str, Dict[str, Any]] = {}
        self.event_subscribers: List[Callable[[Dict[str, Any]], Awaitable[None]]] = []
        self.is_auto_trading_enabled: bool = True
        
        # Concurrency & Duplicate execution guards
        self._execution_lock: Optional[asyncio.Lock] = None
        self._executed_fingerprints: Dict[str, float] = {}
        
        # Autonomous background loop controls
        self.is_loop_running: bool = False
        self._background_loop_task: Optional[asyncio.Task] = None

    @property
    def execution_lock(self) -> asyncio.Lock:
        if self._execution_lock is None:
            self._execution_lock = asyncio.Lock()
        return self._execution_lock

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

    def log_decision(
        self,
        state: str,
        correlation_id: str,
        opportunity_id: str,
        explanation: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        record = {
            "id": str(uuid.uuid4()),
            "correlation_id": correlation_id,
            "opportunity_id": opportunity_id,
            "state": state,
            "explanation": explanation,
            "timestamp": time.time(),
            "metadata": metadata or {},
        }
        self.decision_logs.append(record)
        if len(self.decision_logs) > 500:
            self.decision_logs.pop(0)
        logger.info(f"[{state}] Correlation: {correlation_id[:8]}... | {explanation}")
        return record

    def check_duplicate_trade(self, pair: str, direction: str, strategy: str, window_seconds: float = 60.0) -> bool:
        """Check if an identical trade was recently executed to prevent oscillation/duplicates."""
        now = time.time()
        fingerprint = f"{pair}:{direction}:{strategy}"
        last_t = self._executed_fingerprints.get(fingerprint, 0.0)
        if now - last_t < window_seconds:
            return True
        return False

    def record_trade_fingerprint(self, pair: str, direction: str, strategy: str):
        now = time.time()
        fingerprint = f"{pair}:{direction}:{strategy}"
        self._executed_fingerprints[fingerprint] = now

    async def run_orchestration_cycle(self) -> Dict[str, Any]:
        """
        Executes a complete 9-stage lifecycle cycle across all intelligence layers:
        1. Market Monitoring
        2. Opportunity Discovery
        3. Agent Analysis
        4. Strategy Scoring
        5. Risk Validation
        6. Trade Proposal
        7. Execution Approval
        8. Execution
        9. Portfolio Reconciliation
        """
        cid = str(uuid.uuid4())
        
        # -------------------------------------------------------------
        # Stage 1: Market Monitoring
        # -------------------------------------------------------------
        self.log_decision(
            "MARKET_MONITORING",
            cid,
            "",
            "Stage 1/9: Monitoring HSKSwap pools and validating market data freshness.",
        )
        try:
            market_state = await market_data_service.get_current_market_state(
                "WHSK/USDT",
                enforce_freshness=False,
                max_staleness_seconds=self.risk_engine.policy.data_freshness_seconds,
            )
            # Reconcile existing portfolio positions with latest market price
            exit_events = self.portfolio_tracker.update_market_prices({"WHSK/USDT": market_state["current_price"]})
            for ex in exit_events:
                if ex.get("action") == "EXIT_PROPOSAL_GENERATED":
                    self.log_decision(
                        "WAITING_USER_APPROVAL_EXIT",
                        cid,
                        ex["position_id"],
                        f"TESTNET position reached {ex['event_type']} @ {ex['trigger_price']:.4f}. Live broadcast blocked. Awaiting explicit user approval to exit.",
                        metadata=ex,
                    )
                    await self.broadcast_event("POSITION_EXIT_AWAITING_APPROVAL", ex)
                else:
                    self.log_decision(
                        "CLOSED",
                        cid,
                        ex["position_id"],
                        f"Position exited via {ex['event_type']} @ {ex['trigger_price']:.4f}. Realized P&L: ${ex.get('realized_pnl', 0.0):.2f}",
                        metadata=ex,
                    )
                    await self.broadcast_event("POSITION_CLOSED", ex)
        except Exception as e:
            logger.error(f"Market monitoring stage encountered error: {e}")
            self.log_decision("MARKET_MONITORING_DEGRADED", cid, "", f"Market monitoring warning: {e}")

        # -------------------------------------------------------------
        # Stage 2 & 3: Opportunity Discovery & Agent Analysis
        # -------------------------------------------------------------
        self.log_decision(
            "AGENT_ANALYSIS",
            cid,
            "",
            "Stage 2-3/9: Running multi-agent analytical cycles (TA, Arbitrage, Liquidity, Regime).",
        )
        cycle_result = await self.supervisor.run_single_cycle(correlation_id=cid)
        discovered_opps = cycle_result.get("opportunities", [])
        signals = cycle_result.get("signals", [])

        self.log_decision(
            "OPPORTUNITY_DISCOVERY",
            cid,
            "",
            f"Stage 2/9: Discovered {len(discovered_opps)} raw candidates across active agents.",
            metadata={"candidate_count": len(discovered_opps)},
        )

        # -------------------------------------------------------------
        # Stages 4 - 8: Strategy Scoring, Risk Validation, Proposal, Approval & Execution
        # -------------------------------------------------------------
        processed_candidates = []
        for opp in discovered_opps:
            opp_id = opp["id"]
            pair = opp.get("pair", "WHSK/USDT")
            direction = opp.get("direction", "BUY")
            strategy = opp.get("strategy", "UNKNOWN")

            # Duplicate trade prevention check
            if self.check_duplicate_trade(pair, direction, strategy):
                self.log_decision(
                    "REJECTED",
                    cid,
                    opp_id,
                    f"REJECTED: Duplicate trade suppressed for {direction} {pair} ({strategy}) within active window.",
                )
                opp["status"] = "DUPLICATE_SUPPRESSED"
                processed_candidates.append(opp)
                continue

            # Stage 4: Strategy Scoring & Capital Allocation
            p_state = self.portfolio_tracker.get_portfolio_summary()
            allocation = self.allocator.compute_allocation(opp, p_state)
            opp["trade_size_usd"] = allocation["allocated_usd"]
            opp["token_quantity"] = allocation["token_quantity"]

            self.log_decision(
                "STRATEGY_SCORING",
                cid,
                opp_id,
                f"Stage 4/9: Scored candidate by {opp.get('agent_id')}: {direction} {pair} @ {opp.get('quoted_price', 0.0):.4f}. Target allocation: ${opp['trade_size_usd']:.2f}",
                metadata={"strategy": strategy, "score": opp.get("strategy_score", opp.get("signal_confidence", 50.0))},
            )

            # Stage 5: Risk Validation (Deterministic Rules)
            self.log_decision(
                "RISK_VALIDATION",
                cid,
                opp_id,
                f"Stage 5/9: Validating candidate against deterministic risk policy (13 rules).",
            )
            risk_result: RiskEvaluationResult = self.risk_engine.evaluate_opportunity(opp, p_state)

            if not risk_result.is_approved:
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

            # Stage 6: Trade Proposal Formulated
            opp["status"] = "PROPOSAL_READY"
            self.log_decision(
                "TRADE_PROPOSAL",
                cid,
                opp_id,
                f"Stage 6/9: Trade proposal formulated. Risk check approved: {risk_result.explanation}",
                metadata={"risk_result": risk_result.model_dump(), "allocation": allocation},
            )

            # Stage 7: Execution Approval Gating
            exec_mode = self.execution_agent.execution_mode.lower()

            if exec_mode == "testnet":
                # STRICT REQUIREMENT: No unattended testnet trading!
                # Store proposal and wait for explicit manual approval
                opp["status"] = "WAITING_USER_APPROVAL"
                self.pending_proposals[opp_id] = {
                    "opportunity": opp,
                    "correlation_id": cid,
                    "timestamp": time.time(),
                }
                self.log_decision(
                    "WAITING_USER_APPROVAL",
                    cid,
                    opp_id,
                    "Stage 7/9: TESTNET trade formulated. Unattended broadcast is BLOCKED. Awaiting explicit user approval.",
                    metadata={"proposal_id": opp_id, "mode": "TESTNET"},
                )
                await self.broadcast_event("PROPOSAL_AWAITING_APPROVAL", opp)
                processed_candidates.append(opp)
                continue

            # In PAPER mode: Auto-approved if auto-trading is enabled
            if not self.is_auto_trading_enabled:
                opp["status"] = "AUTOTRADE_PAUSED"
                self.log_decision(
                    "PAUSED",
                    cid,
                    opp_id,
                    "Auto-trading is currently paused by operator policy.",
                )
                processed_candidates.append(opp)
                continue

            opp["status"] = "APPROVED"
            self.log_decision(
                "EXECUTION_APPROVAL",
                cid,
                opp_id,
                "Stage 7/9: Execution approved for PAPER mode autonomous simulation.",
            )

            # Stage 8: Execution with Concurrency Lock
            async with self.execution_lock:
                self.log_decision(
                    "EXECUTION_PENDING",
                    cid,
                    opp_id,
                    "Stage 8/9: Acquired execution mutex lock. Dispatching order...",
                )
                try:
                    plan = await self.execution_agent.prepare_execution_plan(
                        opportunity=opp,
                        user_address=self.execution_agent.signer.address or "0x000000000000000000000000000000000000dEaD",
                        slippage_tolerance_pct=self.risk_engine.policy.max_slippage_pct,
                    )

                    exec_result = await self.execution_agent.execute_trade(plan)
                    if exec_result.get("status") == "CONFIRMED":
                        # Record cooldown and duplicate suppression fingerprint
                        self.risk_engine.record_trade_executed(opp["pair"])
                        self.record_trade_fingerprint(pair, direction, strategy)

                        # Stage 9: Portfolio Reconciliation
                        actual_cost = float(exec_result.get("amount_in", opp["trade_size_usd"])) if opp["direction"] == "BUY" else float(opp["trade_size_usd"])
                        pos = self.portfolio_tracker.add_position(
                            position_id=str(uuid.uuid4()),
                            pair=opp["pair"],
                            side="LONG" if opp["direction"] == "BUY" else "SHORT",
                            entry_price=exec_result["execution_price"],
                            quantity=exec_result["amount_out"] if opp["direction"] == "BUY" else exec_result["amount_in"],
                            cost_usd=actual_cost,
                            stop_loss=opp.get("proposed_stop_loss"),
                            take_profit=opp.get("proposed_take_profit"),
                            is_simulated=exec_result.get("is_simulated", True),
                        )

                        self.log_decision(
                            "PORTFOLIO_RECONCILIATION",
                            cid,
                            opp_id,
                            f"Stage 9/9: Reconciled portfolio position {pos.position_id[:8]}... Mode: {exec_result['execution_mode'].upper()}.",
                            metadata={"position": pos.to_dict(), "execution": exec_result},
                        )
                        opp["status"] = "EXECUTED"
                        opp["execution_result"] = exec_result
                        await self.broadcast_event("TRADE_EXECUTED", {
                            "opportunity": opp,
                            "execution": exec_result,
                            "position": pos.to_dict(),
                        })
                    else:
                        self.log_decision("FAILED", cid, opp_id, f"Execution failed: {exec_result.get('status')}")
                        opp["status"] = "FAILED"

                except Exception as ex:
                    logger.error(f"Execution failed for {opp_id}: {ex}", exc_info=True)
                    self.log_decision("FAILED", cid, opp_id, f"Execution exception: {str(ex)}")
                    opp["status"] = "FAILED"

            processed_candidates.append(opp)

        # Broadcast updated portfolio summary
        summary = self.portfolio_tracker.get_portfolio_summary()
        await self.broadcast_event("PORTFOLIO_UPDATE", summary)

        return {
            "correlation_id": cid,
            "signals": signals,
            "opportunities_evaluated": len(discovered_opps),
            "processed_candidates": processed_candidates,
            "pending_proposals_count": len(self.pending_proposals),
            "portfolio": summary,
            "recent_decisions": self.decision_logs[-15:],
        }

    async def approve_testnet_proposal(self, proposal_id: str) -> Dict[str, Any]:
        """
        Explicit user approval handler for testnet trades.
        Signs and submits transaction to HashKey Testnet via EVM Signer.
        """
        proposal = self.pending_proposals.get(proposal_id)
        if not proposal:
            raise ValueError(f"Proposal '{proposal_id}' not found or already executed.")

        opp = proposal["opportunity"]
        cid = proposal.get("correlation_id", str(uuid.uuid4()))

        self.log_decision("MANUAL_APPROVAL", cid, proposal_id, f"User explicitly approved testnet trade proposal: {opp['direction']} {opp['pair']}.")

        async with self.execution_lock:
            plan = await self.execution_agent.prepare_execution_plan(
                opportunity=opp,
                user_address=self.execution_agent.signer.address or "0x000000000000000000000000000000000000dEaD",
                slippage_tolerance_pct=self.risk_engine.policy.max_slippage_pct,
            )
            exec_result = await self.execution_agent.execute_trade(plan)

            if exec_result.get("status") == "CONFIRMED":
                self.risk_engine.record_trade_executed(opp["pair"])
                self.record_trade_fingerprint(opp["pair"], opp["direction"], opp.get("strategy", ""))

                pos = self.portfolio_tracker.add_position(
                    position_id=str(uuid.uuid4()),
                    pair=opp["pair"],
                    side="LONG" if opp["direction"] == "BUY" else "SHORT",
                    entry_price=exec_result["execution_price"],
                    quantity=exec_result["amount_out"] if opp["direction"] == "BUY" else exec_result["amount_in"],
                    cost_usd=opp["trade_size_usd"],
                    stop_loss=opp.get("proposed_stop_loss"),
                    take_profit=opp.get("proposed_take_profit"),
                    is_simulated=exec_result.get("is_simulated", False),
                )
                self.pending_proposals.pop(proposal_id, None)

                self.log_decision(
                    "EXECUTED",
                    cid,
                    proposal_id,
                    f"Testnet trade confirmed! Tx: {exec_result.get('tx_hash', '')[:16]}...",
                    metadata=exec_result,
                )
                return {
                    "status": "CONFIRMED",
                    "execution": exec_result,
                    "position": pos.to_dict(),
                }
            else:
                self.log_decision("FAILED", cid, proposal_id, f"Execution failed: {exec_result.get('status')}")
                return {"status": "FAILED", "error": exec_result.get("status")}

    def reject_testnet_proposal(self, proposal_id: str, reason: str = "User rejected trade") -> Dict[str, Any]:
        proposal = self.pending_proposals.pop(proposal_id, None)
        if not proposal:
            raise ValueError(f"Proposal '{proposal_id}' not found.")
        
        cid = proposal.get("correlation_id", str(uuid.uuid4()))
        self.log_decision("MANUAL_REJECTION", cid, proposal_id, f"User rejected proposal: {reason}")
        return {"status": "REJECTED", "proposal_id": proposal_id, "reason": reason}

    async def approve_testnet_exit_proposal(self, position_id: str) -> Dict[str, Any]:
        """
        Explicit user approval handler for closing live TESTNET positions.
        Submits exit transaction to HashKey Testnet, verifies receipt, reconciles balances,
        and only then marks position closed in the portfolio tracker.
        """
        pos = self.portfolio_tracker.positions.get(position_id)
        if not pos or not pos.is_open:
            raise ValueError(f"Open position '{position_id}' not found.")

        exit_prop = self.portfolio_tracker.pending_exit_proposals.get(position_id)
        cid = str(uuid.uuid4())

        self.log_decision(
            "MANUAL_APPROVAL",
            cid,
            position_id,
            f"User explicitly approved exit for live TESTNET position: {pos.side} {pos.pair} ({pos.quantity} tokens)."
        )

        async with self.execution_lock:
            # Prepare exit execution plan: SELL base token back to quote
            exit_opp = {
                "id": str(uuid.uuid4()),
                "pair": pos.pair,
                "direction": "SELL" if pos.side == "LONG" else "BUY",
                "trade_size_usd": pos.market_value_usd,
                "amount_in": pos.quantity,
                "quoted_price": pos.current_price,
            }
            plan = await self.execution_agent.prepare_execution_plan(
                opportunity=exit_opp,
                user_address=self.execution_agent.signer.address or "0x000000000000000000000000000000000000dEaD",
                slippage_tolerance_pct=self.risk_engine.policy.max_slippage_pct,
            )
            exec_result = await self.execution_agent.execute_trade(plan)

            if exec_result.get("status") == "CONFIRMED":
                actual_exit_price = exec_result.get("execution_price", pos.current_price)
                tx_hash = exec_result.get("tx_hash", "0xsim")
                gas_used = exec_result.get("gas_used", 150000)

                closed_trade = self.portfolio_tracker.approve_testnet_exit(
                    position_id=position_id,
                    actual_exit_price=actual_exit_price,
                    tx_hash=tx_hash,
                    gas_used=gas_used,
                    reason=exit_prop.get("trigger_reason", "MANUAL_APPROVED_EXIT") if exit_prop else "MANUAL_APPROVED_EXIT",
                )

                self.log_decision(
                    "POSITION_CLOSED",
                    cid,
                    position_id,
                    f"TESTNET position {position_id[:8]} closed on-chain! Tx: {tx_hash[:16]}... Realized P&L: ${closed_trade['realized_pnl_usd']:.2f}",
                    metadata={"execution": exec_result, "trade": closed_trade},
                )
                await self.broadcast_event("POSITION_CLOSED", closed_trade)
                return {
                    "status": "CONFIRMED",
                    "execution": exec_result,
                    "trade": closed_trade,
                }
            else:
                self.log_decision(
                    "FAILED",
                    cid,
                    position_id,
                    f"On-chain exit transaction failed: {exec_result.get('status')}. Position REMAINS OPEN."
                )
                return {"status": "FAILED", "error": exec_result.get("status")}

    def reject_testnet_exit_proposal(self, position_id: str, reason: str = "User dismissed exit proposal") -> Dict[str, Any]:
        """Dismisses an exit proposal, keeping the position open."""
        pos = self.portfolio_tracker.positions.get(position_id)
        if pos:
            pos.pending_exit_proposal = None
        self.portfolio_tracker.pending_exit_proposals.pop(position_id, None)
        self.portfolio_tracker.save_to_disk()
        cid = str(uuid.uuid4())
        self.log_decision("MANUAL_REJECTION", cid, position_id, f"User dismissed exit proposal for {position_id[:8]}: {reason}")
        return {"status": "DISMISSED", "position_id": position_id, "reason": reason}

    @property
    def is_autonomous_loop_running(self) -> bool:
        return self.is_loop_running

    def start_autonomous_loop(self, interval_seconds: int = 15):
        """Start the continuous autonomous trading intelligence loop."""
        if self.is_loop_running:
            return

        self.is_loop_running = True

        async def _loop():
            logger.info(f"Autonomous Trading Intelligence loop started (interval: {interval_seconds}s)")
            while self.is_loop_running:
                try:
                    await self.run_orchestration_cycle()
                except Exception as e:
                    logger.error(f"Error in autonomous loop cycle: {e}", exc_info=True)
                await asyncio.sleep(interval_seconds)

        self._background_loop_task = asyncio.create_task(_loop())

    def stop_autonomous_loop(self):
        """Stop the continuous autonomous loop."""
        self.is_loop_running = False
        if self._background_loop_task:
            self._background_loop_task.cancel()
            self._background_loop_task = None
        logger.info("Autonomous Trading Intelligence loop stopped.")

