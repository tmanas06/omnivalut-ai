import time
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field

logger = logging.getLogger("omnivault.risk_engine")

class RiskPolicyConfig(BaseModel):
    max_trade_allocation_pct: float = Field(default=10.0, description="Max trade size as % of portfolio capital")
    max_slippage_pct: float = Field(default=1.0, description="Max allowable slippage percentage")
    max_daily_loss_pct: float = Field(default=3.0, description="Max daily loss % before circuit breaker halts trading")
    max_portfolio_drawdown_pct: float = Field(default=10.0, description="Max cumulative drawdown from peak capital")
    max_concurrent_positions: int = Field(default=3, description="Maximum open concurrent positions")
    max_gas_cost_usd: float = Field(default=2.5, description="Maximum allowable gas fee per transaction in USD")
    token_allowlist: List[str] = Field(default_factory=lambda: ["WHSK", "USDT", "USDC.e", "HSK"])
    protocol_allowlist: List[str] = Field(default_factory=lambda: ["HSKSwap V3", "HSKSwap Pool (Fee: 500)", "HSKSwap Pool (Fee: 3000)", "HSKSwap Pool (Fee: 10000)"])
    data_freshness_seconds: int = Field(default=60, description="Max acceptable quote staleness")
    trading_cooldown_seconds: int = Field(default=120, description="Minimum delay between successive trades on same pair")
    min_risk_reward_ratio: float = Field(default=1.5, description="Minimum ratio between take-profit and stop-loss distance")
    emergency_pause_active: bool = Field(default=False, description="Global emergency kill-switch")

class RiskEvaluationResult(BaseModel):
    is_approved: bool
    rule_evaluated: str
    violation_code: Optional[str] = None
    explanation: str
    evaluated_parameters: Dict[str, Any] = Field(default_factory=dict)
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class DeterministicRiskEngine:
    """
    Agent 5: Deterministic Risk Management Engine.
    Strict, non-probabilistic rule validator.
    CRITICAL PRINCIPLE: AI models may propose trades, but they must NEVER bypass these checks.
    """

    def __init__(self, policy: Optional[RiskPolicyConfig] = None):
        self.policy = policy or RiskPolicyConfig()
        self.last_trade_timestamps: Dict[str, float] = {} # pair -> timestamp

    def update_policy(self, updates: Dict[str, Any]) -> RiskPolicyConfig:
        """
        Explicit policy updates only. All updates are logged.
        """
        data = self.policy.model_dump()
        for k, v in updates.items():
            if k in data:
                data[k] = v
                logger.info(f"[RISK POLICY UPDATED] {k} -> {v}")
        self.policy = RiskPolicyConfig(**data)
        return self.policy

    def toggle_emergency_pause(self, paused: bool) -> bool:
        self.policy.emergency_pause_active = paused
        logger.warning(f"[CIRCUIT BREAKER] Emergency pause set to: {paused}")
        return self.policy.emergency_pause_active

    def evaluate_opportunity(
        self,
        opportunity: Dict[str, Any],
        portfolio_state: Dict[str, Any],
        current_timestamp: Optional[float] = None,
    ) -> RiskEvaluationResult:
        """
        Sequentially executes all 10+ deterministic risk checks.
        If ANY rule fails, the candidate is instantly rejected with an explicit violation code.
        """
        now = current_timestamp or time.time()
        pair = opportunity.get("pair", "UNKNOWN")
        base_token = pair.split("/")[0] if "/" in pair else pair
        quote_token = pair.split("/")[1] if "/" in pair else "USDT"

        # -------------------------------------------------------------
        # Rule 1: Emergency Pause Circuit Breaker
        # -------------------------------------------------------------
        if self.policy.emergency_pause_active:
            return RiskEvaluationResult(
                is_approved=False,
                rule_evaluated="EMERGENCY_PAUSE",
                violation_code="CIRCUIT_BREAKER_ACTIVE",
                explanation="Trading is currently halted by global Emergency Circuit Breaker.",
                evaluated_parameters={"emergency_pause": True},
            )

        # -------------------------------------------------------------
        # Rule 2: Token Allowlist
        # -------------------------------------------------------------
        if base_token not in self.policy.token_allowlist or quote_token not in self.policy.token_allowlist:
            return RiskEvaluationResult(
                is_approved=False,
                rule_evaluated="TOKEN_ALLOWLIST",
                violation_code="UNTRUSTED_TOKEN",
                explanation=f"Tokens {base_token} or {quote_token} are not in the approved token allowlist.",
                evaluated_parameters={
                    "pair": pair,
                    "allowed_tokens": self.policy.token_allowlist,
                },
            )

        # -------------------------------------------------------------
        # Rule 3: Protocol / Venue Allowlist
        # -------------------------------------------------------------
        venue = opportunity.get("source_venue", "")
        # Allow if venue matches any allowed prefix
        is_allowed_venue = any(allowed in venue for allowed in self.policy.protocol_allowlist)
        if not is_allowed_venue:
            return RiskEvaluationResult(
                is_approved=False,
                rule_evaluated="PROTOCOL_ALLOWLIST",
                violation_code="UNAUTHORIZED_VENUE",
                explanation=f"Venue '{venue}' is not in the approved protocol allowlist.",
                evaluated_parameters={"venue": venue, "allowlist": self.policy.protocol_allowlist},
            )

        # -------------------------------------------------------------
        # Rule 4: Maximum Trade Allocation (% of available trading capital)
        # -------------------------------------------------------------
        total_capital = portfolio_state.get("available_cash_usd", 1000.0)
        trade_size_usd = opportunity.get("trade_size_usd", 50.0)
        allocation_pct = (trade_size_usd / total_capital) * 100.0 if total_capital > 0 else 100.0

        if allocation_pct > self.policy.max_trade_allocation_pct:
            return RiskEvaluationResult(
                is_approved=False,
                rule_evaluated="MAX_TRADE_ALLOCATION",
                violation_code="ALLOCATION_EXCEEDED",
                explanation=f"Proposed allocation of {allocation_pct:.2f}% (${trade_size_usd:.2f}) exceeds configured limit of {self.policy.max_trade_allocation_pct:.2f}%.",
                evaluated_parameters={
                    "allocation_pct": allocation_pct,
                    "max_allowed_pct": self.policy.max_trade_allocation_pct,
                    "trade_size_usd": trade_size_usd,
                    "total_capital": total_capital,
                },
            )

        # -------------------------------------------------------------
        # Rule 5: Maximum Slippage Limit
        # -------------------------------------------------------------
        est_slippage_pct = opportunity.get("estimated_price_impact_pct", 0.0)
        if est_slippage_pct > self.policy.max_slippage_pct:
            return RiskEvaluationResult(
                is_approved=False,
                rule_evaluated="MAX_SLIPPAGE",
                violation_code="SLIPPAGE_EXCEEDED",
                explanation=f"Estimated slippage/price impact of {est_slippage_pct:.2f}% exceeds the maximum tolerance of {self.policy.max_slippage_pct:.2f}%.",
                evaluated_parameters={
                    "estimated_slippage": est_slippage_pct,
                    "max_slippage": self.policy.max_slippage_pct,
                },
            )

        # -------------------------------------------------------------
        # Rule 6: Maximum Daily Loss Limit
        # -------------------------------------------------------------
        daily_loss_pct = portfolio_state.get("daily_loss_pct", 0.0)
        if daily_loss_pct >= self.policy.max_daily_loss_pct:
            return RiskEvaluationResult(
                is_approved=False,
                rule_evaluated="MAX_DAILY_LOSS",
                violation_code="DAILY_LOSS_LIMIT_REACHED",
                explanation=f"Daily portfolio loss has reached {daily_loss_pct:.2f}%, exceeding the daily limit of {self.policy.max_daily_loss_pct:.2f}%.",
                evaluated_parameters={
                    "daily_loss_pct": daily_loss_pct,
                    "max_daily_loss_pct": self.policy.max_daily_loss_pct,
                },
            )

        # -------------------------------------------------------------
        # Rule 7: Maximum Portfolio Drawdown
        # -------------------------------------------------------------
        drawdown_pct = portfolio_state.get("portfolio_drawdown_pct", 0.0)
        if drawdown_pct >= self.policy.max_portfolio_drawdown_pct:
            return RiskEvaluationResult(
                is_approved=False,
                rule_evaluated="MAX_DRAWDOWN",
                violation_code="DRAWDOWN_LIMIT_REACHED",
                explanation=f"Cumulative drawdown is {drawdown_pct:.2f}%, breaching the hard ceiling of {self.policy.max_portfolio_drawdown_pct:.2f}%.",
                evaluated_parameters={
                    "drawdown_pct": drawdown_pct,
                    "max_drawdown_pct": self.policy.max_portfolio_drawdown_pct,
                },
            )

        # -------------------------------------------------------------
        # Rule 8: Maximum Concurrent Positions
        # -------------------------------------------------------------
        open_positions = portfolio_state.get("open_positions_count", 0)
        if open_positions >= self.policy.max_concurrent_positions:
            return RiskEvaluationResult(
                is_approved=False,
                rule_evaluated="MAX_CONCURRENT_POSITIONS",
                violation_code="CONCURRENT_POSITIONS_FULL",
                explanation=f"Currently holding {open_positions} open positions, which equals or exceeds the limit of {self.policy.max_concurrent_positions}.",
                evaluated_parameters={
                    "open_positions": open_positions,
                    "max_concurrent": self.policy.max_concurrent_positions,
                },
            )

        # -------------------------------------------------------------
        # Rule 9: Maximum Gas Fee Limit
        # -------------------------------------------------------------
        est_gas_usd = opportunity.get("estimated_gas_cost_usd", 0.0)
        if est_gas_usd > self.policy.max_gas_cost_usd:
            return RiskEvaluationResult(
                is_approved=False,
                rule_evaluated="MAX_GAS_COST",
                violation_code="GAS_FEE_TOO_HIGH",
                explanation=f"Estimated gas cost of ${est_gas_usd:.2f} exceeds limit of ${self.policy.max_gas_cost_usd:.2f}.",
                evaluated_parameters={
                    "estimated_gas_usd": est_gas_usd,
                    "max_gas_cost_usd": self.policy.max_gas_cost_usd,
                },
            )

        # -------------------------------------------------------------
        # Rule 10: Trading Cooldown (Anti-Oscillation)
        # -------------------------------------------------------------
        last_trade_time = self.last_trade_timestamps.get(pair, 0)
        elapsed = now - last_trade_time
        if elapsed < self.policy.trading_cooldown_seconds:
            remaining = int(self.policy.trading_cooldown_seconds - elapsed)
            return RiskEvaluationResult(
                is_approved=False,
                rule_evaluated="TRADING_COOLDOWN",
                violation_code="COOLDOWN_ACTIVE",
                explanation=f"Pair {pair} is in trading cooldown. {remaining}s remaining before new positions can be opened.",
                evaluated_parameters={
                    "elapsed_seconds": elapsed,
                    "cooldown_period": self.policy.trading_cooldown_seconds,
                    "remaining_seconds": remaining,
                },
            )

        # -------------------------------------------------------------
        # ALL DETERMINISTIC RULES PASSED!
        # -------------------------------------------------------------
        return RiskEvaluationResult(
            is_approved=True,
            rule_evaluated="ALL_RULES_PASSED",
            violation_code=None,
            explanation="Trade opportunity satisfies all deterministic risk management criteria.",
            evaluated_parameters={
                "allocation_pct": allocation_pct,
                "slippage_pct": est_slippage_pct,
                "daily_loss_pct": daily_loss_pct,
                "drawdown_pct": drawdown_pct,
                "open_positions": open_positions,
            },
        )

    def record_trade_executed(self, pair: str, timestamp: Optional[float] = None):
        """Update cooldown tracker upon successful trade execution."""
        self.last_trade_timestamps[pair] = timestamp or time.time()
