import math
import logging
from typing import Dict, Any, List, Optional
from enum import Enum

logger = logging.getLogger("omnivault.regimes")


class MarketRegimeType(str, Enum):
    BULLISH_TREND = "BULLISH_TREND"
    BEARISH_TREND = "BEARISH_TREND"
    RANGE_BOUND = "RANGE_BOUND"
    HIGH_VOLATILITY = "HIGH_VOLATILITY"
    LOW_LIQUIDITY = "LOW_LIQUIDITY"
    FEE_TIER_DISLOCATION = "FEE_TIER_DISLOCATION"
    NEUTRAL = "NEUTRAL"


class MarketRegimeClassifier:
    """
    Phase 3: Real-Time & Historical Market Regime Classification Engine.
    Uses strictly causal indicators (no look-ahead bias) based on prices,
    volatility, active pool liquidity, and cross-tier spreads at the exact moment of evaluation.
    """

    def __init__(
        self,
        trend_threshold_pct: float = 0.5,
        volatility_bb_width_threshold: float = 0.04,
        low_liquidity_threshold: int = 1000000,
        dislocation_threshold_pct: float = 0.35,
    ):
        self.trend_threshold_pct = trend_threshold_pct
        self.volatility_bb_width_threshold = volatility_bb_width_threshold
        self.low_liquidity_threshold = low_liquidity_threshold
        self.dislocation_threshold_pct = dislocation_threshold_pct

    def classify_regime(
        self,
        candles_or_prices: List[float],
        active_liquidity: int = 5000000,
        cross_tier_spread_pct: float = 0.0,
        current_price: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Classifies the market regime using only data available up to the current timestamp.
        Avoids look-ahead bias by taking only past/current candles.
        """
        if not candles_or_prices or len(candles_or_prices) < 5:
            return {
                "primary_regime": MarketRegimeType.NEUTRAL.value,
                "confidence": 0.5,
                "metrics": {},
                "identified_risks": [],
            }

        prices = candles_or_prices[-50:]
        cp = current_price or prices[-1]

        # 1. Check for Fee-Tier Dislocation first (arbitrage regime)
        if cross_tier_spread_pct >= self.dislocation_threshold_pct:
            return {
                "primary_regime": MarketRegimeType.FEE_TIER_DISLOCATION.value,
                "confidence": min(1.0, cross_tier_spread_pct / 0.50),
                "metrics": {"cross_tier_spread_pct": round(cross_tier_spread_pct, 3)},
                "identified_risks": ["Slippage on thinner pool leg", "Fast spread convergence"],
            }

        # 2. Check for Low Liquidity
        if active_liquidity < self.low_liquidity_threshold:
            return {
                "primary_regime": MarketRegimeType.LOW_LIQUIDITY.value,
                "confidence": 0.9,
                "metrics": {"active_liquidity": active_liquidity},
                "identified_risks": ["High price impact", "Execution slippage exceeds 1%"],
            }

        # 3. Calculate Volatility on Returns (Return dispersion)
        returns = [(prices[i] - prices[i - 1]) / prices[i - 1] for i in range(1, len(prices))]
        mean_ret = sum(returns) / len(returns) if returns else 0.0
        var_ret = sum((r - mean_ret) ** 2 for r in returns) / len(returns) if returns else 0.0
        return_std_pct = math.sqrt(var_ret) * 100.0  # return volatility in %

        # 4. Calculate Trend (Fast vs Slow SMA slope)
        fast_sma = sum(prices[-10:]) / min(10, len(prices))
        slow_sma = sum(prices[-30:]) / min(30, len(prices))
        trend_diff_pct = ((fast_sma - slow_sma) / slow_sma) * 100.0 if slow_sma > 0 else 0.0

        # Bollinger Band width for range-bound detection
        mean_p = sum(prices) / len(prices)
        variance = sum((p - mean_p) ** 2 for p in prices) / len(prices)
        std_p = math.sqrt(variance)
        bb_width = (4 * std_p) / mean_p if mean_p > 0 else 0.0

        # Decision Logic
        if return_std_pct > 2.5:
            regime = MarketRegimeType.HIGH_VOLATILITY.value
            risks = ["Stop-loss hunting", "Wider bid-ask spreads", "High slippage"]
        elif trend_diff_pct > self.trend_threshold_pct:
            regime = MarketRegimeType.BULLISH_TREND.value
            risks = ["Short positions face adverse momentum", "Overextended pullbacks"]
        elif trend_diff_pct < -self.trend_threshold_pct:
            regime = MarketRegimeType.BEARISH_TREND.value
            risks = ["Long positions face cascading sell pressure", "Falling knife danger"]
        elif bb_width < (self.volatility_bb_width_threshold * 0.5) and abs(trend_diff_pct) < (self.trend_threshold_pct * 0.5):
            regime = MarketRegimeType.RANGE_BOUND.value
            risks = ["Trend following produces whipsaw losses", "Low gross profit per trade"]
        else:
            regime = MarketRegimeType.NEUTRAL.value
            risks = []

        return {
            "primary_regime": regime,
            "confidence": 0.85,
            "metrics": {
                "fast_sma": round(fast_sma, 4),
                "slow_sma": round(slow_sma, 4),
                "trend_diff_pct": round(trend_diff_pct, 2),
                "return_volatility_pct": round(return_std_pct, 2),
                "bb_width": round(bb_width, 4),
                "active_liquidity": active_liquidity,
            },
            "identified_risks": risks,
        }

    def evaluate_strategy_regime_performance(
        self,
        trades: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Attribution analysis: groups trades by (strategy, market_regime) and
        identifies strategies that consistently underperform under specific conditions.
        """
        trades = trades or []
        regimes = [
            MarketRegimeType.BULLISH_TREND.value,
            MarketRegimeType.BEARISH_TREND.value,
            MarketRegimeType.RANGE_BOUND.value,
            MarketRegimeType.HIGH_VOLATILITY.value,
            MarketRegimeType.LOW_LIQUIDITY.value,
            MarketRegimeType.FEE_TIER_DISLOCATION.value,
        ]

        # Nested matrix: matrix[regime][strategy] = {trades, pnl, wins, losses, win_rate}
        attribution_matrix: Dict[str, Dict[str, Any]] = {r: {} for r in regimes}
        underperformance_warnings: List[Dict[str, Any]] = []

        for r in regimes:
            for s in ["MOMENTUM_TREND_FOLLOWING", "ARBITRAGE_CROSS_TIER", "MEAN_REVERSION_BB", "HIGH_VOLATILITY_BREAKOUT"]:
                attribution_matrix[r][s] = {
                    "trades_count": 0,
                    "wins": 0,
                    "losses": 0,
                    "win_rate_pct": 0.0,
                    "net_pnl_usd": 0.0,
                    "avg_slippage_bps": 0.0,
                }

        for t in trades:
            reg = t.get("regime", MarketRegimeType.NEUTRAL.value)
            strat = t.get("strategy")
            net_pnl = float(t.get("net_pnl_usd", 0.0))

            if reg in attribution_matrix and strat in attribution_matrix[reg]:
                cell = attribution_matrix[reg][strat]
                cell["trades_count"] += 1
                cell["net_pnl_usd"] = round(cell["net_pnl_usd"] + net_pnl, 2)
                if net_pnl > 0:
                    cell["wins"] += 1
                else:
                    cell["losses"] += 1

                total = cell["wins"] + cell["losses"]
                cell["win_rate_pct"] = round((cell["wins"] / total) * 100.0, 1) if total > 0 else 0.0

        # Heuristic detection of chronic underperformance
        for r, strats in attribution_matrix.items():
            for s, metrics in strats.items():
                if metrics["trades_count"] >= 3:
                    if metrics["net_pnl_usd"] < -0.50 or metrics["win_rate_pct"] < 35.0:
                        underperformance_warnings.append({
                            "strategy": s,
                            "regime": r,
                            "trades_count": metrics["trades_count"],
                            "win_rate_pct": metrics["win_rate_pct"],
                            "net_pnl_usd": metrics["net_pnl_usd"],
                            "recommendation": f"Suppress or down-weight {s} when market is in {r}.",
                        })

        return {
            "attribution_matrix": attribution_matrix,
            "underperformance_warnings": underperformance_warnings,
            "total_attributed_trades": len(trades),
        }


# Global singleton
regime_classifier = MarketRegimeClassifier()
