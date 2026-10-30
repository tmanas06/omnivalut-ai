import asyncio
import time
import logging
from typing import Dict, List, Any, Optional
from backend.agents.base import BaseAgent, AgentTelemetry
from backend.agents.market_intelligence import MarketIntelligenceAgent
from backend.agents.arbitrage import ArbitrageAgent
from backend.agents.technical_analysis import TechnicalAnalysisAgent
from backend.agents.liquidity import LiquidityAgent

logger = logging.getLogger("omnivault.supervisor")

class AgentSupervisor:
    """
    Agent Supervisor.
    Coordinates the autonomous execution lifecycle of all registered trading agents.
    Provides health monitoring, telemetry aggregation, and dynamic control toggles.
    """

    def __init__(self):
        self.agents: Dict[str, BaseAgent] = {}
        self.is_running: bool = False
        self._background_task: Optional[asyncio.Task] = None
        self.latest_telemetry: Dict[str, AgentTelemetry] = {}
        self.listeners: List[Any] = []

        # Register default agents
        self.register_agent(MarketIntelligenceAgent())
        self.register_agent(ArbitrageAgent())
        self.register_agent(TechnicalAnalysisAgent())
        self.register_agent(LiquidityAgent())

    def register_agent(self, agent: BaseAgent):
        self.agents[agent.agent_id] = agent
        logger.info(f"Registered agent: {agent.name} [{agent.agent_id}]")

    def get_agent(self, agent_id: str) -> Optional[BaseAgent]:
        return self.agents.get(agent_id)

    def set_agent_enabled(self, agent_id: str, enabled: bool) -> bool:
        agent = self.get_agent(agent_id)
        if agent:
            agent.is_enabled = enabled
            logger.info(f"Agent {agent_id} enabled state set to {enabled}")
            return True
        return False

    def get_all_agents_summary(self) -> List[Dict[str, Any]]:
        return [agent.to_dict() for agent in self.agents.values()]

    async def run_single_cycle(self, correlation_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Executes a coordinated evaluation cycle across all active agents.
        """
        cycle_start = time.time()
        tasks = []
        agent_ids = list(self.agents.keys())

        for aid in agent_ids:
            agent = self.agents[aid]
            if agent.is_enabled:
                tasks.append(agent.run(correlation_id=correlation_id))

        results: List[AgentTelemetry] = await asyncio.gather(*tasks, return_exceptions=False)
        telemetry_map = {}
        aggregated_opportunities = []
        aggregated_signals = []

        for t in results:
            self.latest_telemetry[t.agent_id] = t
            telemetry_map[t.agent_id] = t.model_dump()
            if t.data:
                opps = t.data.get("opportunities", [])
                sigs = t.data.get("signals", [])
                aggregated_opportunities.extend(opps)
                aggregated_signals.extend(sigs)

        return {
            "cycle_duration_ms": int((time.time() - cycle_start) * 1000),
            "agents_evaluated": len(tasks),
            "telemetry": telemetry_map,
            "opportunities": aggregated_opportunities,
            "signals": aggregated_signals,
            "timestamp": time.time(),
        }

    async def start_background_loop(self, interval_seconds: int = 15, on_cycle_complete=None):
        """
        Runs continuous background agent loop.
        """
        self.is_running = True
        logger.info(f"Agent Supervisor background loop started (interval: {interval_seconds}s)")

        while self.is_running:
            try:
                cycle_data = await self.run_single_cycle()
                if on_cycle_complete:
                    await on_cycle_complete(cycle_data)
            except Exception as e:
                logger.error(f"Error in supervisor loop: {e}", exc_info=True)
            await asyncio.sleep(interval_seconds)

    def stop_background_loop(self):
        self.is_running = False
        logger.info("Agent Supervisor background loop stopped.")
