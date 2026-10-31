import uuid
import logging
from typing import Dict, Any, List, Optional
from backend.agents.base import BaseAgent
from backend.adapters.hskswap.market_data import market_data_service

logger = logging.getLogger("omnivault.agent.strategy")

class StrategyAgent(BaseAgent):
    """
    Agent 5: Strategy Agent.
    Multi-signal fusion engine. Combines technical indicators, market intelligence,
    liquidity depth, and arbitrage signals to formulate high-conviction trade proposals.
    Assigns a multi-factor strategy score (0-100), computes risk-adjusted stop-loss/take-profit,
    and proposes structured trade opportunities to the orchestrator.
    """

    def __init__(self, min_confidence_threshold: float = 60.0):
        super().__init__(
            agent_id="agent_strategy",
            name="Strategy Synthesis Agent",
            description="Fuses multi-agent intelligence (TA, Arbitrage, Liquidity, Regime) into composite scored trade proposals.",
            execution_interval_seconds=12,
            supported_assets=["WHSK", "USDT"],
            supported_strategies=[
                "MOMENTUM_TREND_FOLLOWING",
                "MEAN_REVERSION_BB",
                "MULTI_TIER_ARBITRAGE",
                "VOLATILITY_BREAKOUT",
            ],
        )
        self.min_confidence_threshold = min_confidence_threshold

    def score_strategy_setup(
        self,
        ta_signal: Dict[str, Any],
        market_state: Dict[str, Any],
        liquidity_state: Dict[str, Any],
        arbitrage_evals: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Synthesizes technical indicators, market regime, and liquidity depth into a multi-factor score.
        """
        score = 50.0 # Neutral baseline
        factors = []

        # 1. Technical Analysis Factor (up to +/- 30 points)
        ta_type = ta_signal.get("signal_type", "HOLD")
        ta_conf = ta_signal.get("confidence", 50.0)
        indicators = ta_signal.get("indicator_values", {})
        rsi = indicators.get("rsi_14", 50.0)

        if ta_type == "BUY":
            boost = (ta_conf - 50.0) * 0.6
            score += boost
            factors.append(f"TA Bullish bias ({ta_conf:.1f}% conf, +{boost:.1f} pts)")
            if rsi < 35:
                score += 8.0
                factors.append(f"RSI oversold bonus ({rsi:.1f}, +8 pts)")
        elif ta_type == "SELL":
            boost = (ta_conf - 50.0) * 0.6
            score -= boost
            factors.append(f"TA Bearish bias ({ta_conf:.1f}% conf, -{boost:.1f} pts)")
            if rsi > 65:
                score -= 8.0
                factors.append(f"RSI overbought penalty ({rsi:.1f}, -8 pts)")

        # 2. Liquidity & Feasibility Factor (up to +/- 10 points)
        raw_liq = liquidity_state.get("raw_liquidity", 0)
        health = liquidity_state.get("health_status", "LOW_LIQUIDITY_WARNING")
        if health == "OPTIMAL_LIQUIDITY" and raw_liq > 0:
            score += 5.0
            factors.append("Optimal liquidity depth (+5 pts)")
        else:
            score -= 15.0
            factors.append("Depleted pool depth (-15 pts)")

        # 3. Market Regime Factor (up to +/- 10 points)
        vol = market_state.get("volatility", 0.02)
        if vol > 0.06:
            # High volatility penalty
            score -= 10.0
            factors.append(f"High volatility regime penalty ({vol*100:.1f}%, -10 pts)")
        else:
            score += 5.0
            factors.append("Stable market volatility (+5 pts)")

        # 4. Intra-DEX Arbitrage Support (bonus if spreads exist)
        if arbitrage_evals:
            profitable_arbs = [a for a in arbitrage_evals if a.get("is_profitable")]
            if profitable_arbs:
                score += 10.0
                factors.append(f"Cross-tier price dislocation supports entry (+10 pts)")

        # Clamp composite score between 0 and 100
        composite_score = max(0.0, min(100.0, score))

        # Direction and Strategy selection
        if composite_score >= self.min_confidence_threshold:
            direction = "BUY"
            strategy_name = "MOMENTUM_TREND_FOLLOWING" if rsi >= 40 else "MEAN_REVERSION_BB"
        elif composite_score <= (100.0 - self.min_confidence_threshold):
            direction = "SELL"
            strategy_name = "VOLATILITY_BREAKOUT"
        else:
            direction = "NEUTRAL"
            strategy_name = "NEUTRAL_WAIT"

        return {
            "score": round(composite_score, 1),
            "direction": direction,
            "strategy": strategy_name,
            "factors": factors,
            "is_actionable": direction in ["BUY", "SELL"],
        }

    async def execute_cycle(self, correlation_id: str) -> Dict[str, Any]:
        """
        Execute strategy aggregation cycle.
        Collects market data, candles, indicators, and produces scored trade proposals.
        """
        pair = "WHSK/USDT"
        state = await market_data_service.get_current_market_state(pair)
        current_price = state["current_price"]

        # Compute TA indicator snapshot
        from backend.agents.technical_analysis import (
            calculate_rsi,
            calculate_macd,
            calculate_ema,
            calculate_bollinger_bands,
        )
        candles = market_data_service.get_candles(pair, limit=120)
        closes = [c["close"] for c in candles]
        rsi = calculate_rsi(closes)
        macd = calculate_macd(closes)
        ema9 = calculate_ema(closes, 9)
        ema21 = calculate_ema(closes, 21)
        bb = calculate_bollinger_bands(closes)

        # Baseline TA Signal
        ta_score = 0
        if rsi < 35:
            ta_score += 30
        elif rsi > 65:
            ta_score -= 30
        if ema9 > ema21:
            ta_score += 20
        else:
            ta_score -= 20

        ta_signal = {
            "signal_type": "BUY" if ta_score >= 20 else ("SELL" if ta_score <= -20 else "HOLD"),
            "confidence": min(95.0, 50.0 + abs(ta_score)),
            "indicator_values": {"rsi_14": rsi, "macd": macd, "bb": bb},
        }

        # Liquidity snapshot
        liquidity_state = {
            "raw_liquidity": state["pool_liquidity"],
            "health_status": "OPTIMAL_LIQUIDITY" if state["pool_liquidity"] > 0 else "LOW_LIQUIDITY_WARNING",
        }

        # Multi-factor score
        s_eval = self.score_strategy_setup(
            ta_signal=ta_signal,
            market_state=state,
            liquidity_state=liquidity_state,
        )

        opportunities: List[Dict[str, Any]] = []
        if s_eval["is_actionable"]:
            direction = s_eval["direction"]
            stop_loss = round(current_price * 0.985, 4) if direction == "BUY" else round(current_price * 1.015, 4)
            take_profit = round(current_price * 1.035, 4) if direction == "BUY" else round(current_price * 0.965, 4)

            opp_id = str(uuid.uuid4())
            opportunities.append({
                "id": opp_id,
                "correlation_id": correlation_id,
                "agent_id": self.agent_id,
                "strategy": s_eval["strategy"],
                "pair": pair,
                "direction": direction,
                "source_venue": "HSKSwap V3 (0.3% Pool)",
                "quoted_price": current_price,
                "strategy_score": s_eval["score"],
                "signal_confidence": s_eval["score"],
                "estimated_price_impact_pct": 0.12,
                "estimated_gas_cost_usd": 0.0001,
                "expected_net_profit_usd": round(abs(take_profit - current_price) * 50.0, 2),
                "proposed_stop_loss": stop_loss,
                "proposed_take_profit": take_profit,
                "suggested_allocation_pct": 5.0 if s_eval["score"] < 75 else 8.0,
                "rationale": "; ".join(s_eval["factors"]),
                "status": "OPPORTUNITY_DETECTED",
            })

        return {
            "correlation_id": correlation_id,
            "pair": pair,
            "strategy_evaluation": s_eval,
            "opportunities": opportunities,
            "signals": [ta_signal],
            "current_price": current_price,
        }
