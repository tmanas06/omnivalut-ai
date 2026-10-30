import time
import abc
import uuid
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field

class AgentTelemetry(BaseModel):
    agent_id: str
    name: str
    status: str # "IDLE", "RUNNING", "COMPLETED", "ERROR"
    last_run_timestamp: float
    duration_ms: int
    signals_produced: int
    opportunities_found: int
    data: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None

class BaseAgent(abc.ABC):
    """
    Abstract base class for all autonomous trading agents in OmniVault AI.
    """

    def __init__(
        self,
        agent_id: str,
        name: str,
        description: str,
        execution_interval_seconds: int = 15,
        supported_assets: Optional[List[str]] = None,
        supported_strategies: Optional[List[str]] = None,
    ):
        self.agent_id = agent_id
        self.name = name
        self.description = description
        self.execution_interval_seconds = execution_interval_seconds
        self.supported_assets = supported_assets or ["WHSK", "USDT", "USDC.e"]
        self.supported_strategies = supported_strategies or ["MOMENTUM", "ARBITRAGE", "MEAN_REVERSION"]
        
        # State tracking
        self.is_enabled: bool = True
        self.status: str = "IDLE" # IDLE, RUNNING, ERROR
        self.last_run_at: Optional[float] = None
        self.total_runs: int = 0
        self.opportunities_found: int = 0
        self.error_state: Optional[str] = None
        self.logger = logging.getLogger(f"omnivault.agent.{agent_id}")

    @abc.abstractmethod
    async def execute_cycle(self, correlation_id: str) -> Dict[str, Any]:
        """
        Subclasses implement their specific logic here.
        Must return a structured dictionary containing signals, opportunities, or telemetry.
        """
        pass

    async def run(self, correlation_id: Optional[str] = None) -> AgentTelemetry:
        """
        Template method wrapping agent execution with telemetry, timing, and error isolation.
        """
        if not self.is_enabled:
            return AgentTelemetry(
                agent_id=self.agent_id,
                name=self.name,
                status="PAUSED",
                last_run_timestamp=self.last_run_at or 0,
                duration_ms=0,
                signals_produced=0,
                opportunities_found=0,
                data={"message": "Agent is currently disabled by user policy."},
            )

        cid = correlation_id or str(uuid.uuid4())
        start_t = time.time()
        self.status = "RUNNING"
        self.error_state = None

        try:
            result = await self.execute_cycle(cid)
            duration_ms = int((time.time() - start_t) * 1000)
            self.total_runs += 1
            self.last_run_at = time.time()
            self.status = "IDLE"

            opps = result.get("opportunities", [])
            signals = result.get("signals", [])
            self.opportunities_found += len(opps)

            return AgentTelemetry(
                agent_id=self.agent_id,
                name=self.name,
                status="COMPLETED",
                last_run_timestamp=self.last_run_at,
                duration_ms=duration_ms,
                signals_produced=len(signals),
                opportunities_found=len(opps),
                data=result,
            )

        except Exception as e:
            duration_ms = int((time.time() - start_t) * 1000)
            self.status = "ERROR"
            self.error_state = str(e)
            self.logger.error(f"Agent {self.agent_id} failed in cycle {cid}: {e}", exc_info=True)

            return AgentTelemetry(
                agent_id=self.agent_id,
                name=self.name,
                status="ERROR",
                last_run_timestamp=time.time(),
                duration_ms=duration_ms,
                signals_produced=0,
                opportunities_found=0,
                error=str(e),
            )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "name": self.name,
            "description": self.description,
            "status": self.status,
            "is_enabled": self.is_enabled,
            "execution_interval_seconds": self.execution_interval_seconds,
            "last_run_at": datetime.fromtimestamp(self.last_run_at, timezone.utc).isoformat() if self.last_run_at else None,
            "total_runs": self.total_runs,
            "opportunities_found": self.opportunities_found,
            "error_state": self.error_state,
            "supported_assets": self.supported_assets,
            "supported_strategies": self.supported_strategies,
        }
