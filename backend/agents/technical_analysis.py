import uuid
import math
from typing import Dict, Any, List, Optional
from backend.agents.base import BaseAgent
from backend.adapters.hskswap.market_data import market_data_service

def calculate_sma(values: List[float], period: int) -> float:
    if len(values) < period:
        return values[-1] if values else 0.0
    return sum(values[-period:]) / period

def calculate_ema(values: List[float], period: int) -> float:
    if not values:
        return 0.0
    k = 2.0 / (period + 1.0)
    ema = values[0]
    for val in values[1:]:
        ema = (val * k) + (ema * (1.0 - k))
    return ema

def calculate_rsi(closes: List[float], period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50.0
    gains = []
    losses = []
    for i in range(1, len(closes)):
        diff = closes[i] - closes[i - 1]
        if diff >= 0:
            gains.append(diff)
            losses.append(0.0)
        else:
            gains.append(0.0)
            losses.append(abs(diff))

    avg_gain = sum(gains[-period:]) / period
    avg_loss = sum(losses[-period:]) / period

    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))

def calculate_macd(closes: List[float]) -> Dict[str, float]:
    if len(closes) < 26:
        return {"macd": 0.0, "signal": 0.0, "histogram": 0.0}
    ema12 = calculate_ema(closes, 12)
    ema26 = calculate_ema(closes, 26)
    macd_line = ema12 - ema26
    # Fast proxy signal line:
    signal_line = calculate_ema(closes[-9:], 9) - ema26
    hist = macd_line - signal_line
    return {
        "macd": round(macd_line, 6),
        "signal": round(signal_line, 6),
        "histogram": round(hist, 6),
    }

def calculate_bollinger_bands(closes: List[float], period: int = 20, num_std: float = 2.0) -> Dict[str, float]:
    if len(closes) < period:
        p = closes[-1] if closes else 0.0
        return {"upper": p * 1.02, "middle": p, "lower": p * 0.98, "bandwidth": 0.04}
    slice_c = closes[-period:]
    mean = sum(slice_c) / period
    variance = sum((x - mean) ** 2 for x in slice_c) / period
    std_dev = math.sqrt(variance)
    upper = mean + (num_std * std_dev)
    lower = mean - (num_std * std_dev)
    bw = (upper - lower) / mean if mean > 0 else 0.0
    return {
        "upper": round(upper, 4),
        "middle": round(mean, 4),
        "lower": round(lower, 4),
        "bandwidth": round(bw, 4),
    }

class TechnicalAnalysisAgent(BaseAgent):
    """
    Agent 3: Technical Analysis Agent.
    Evaluates multi-timeframe indicators: RSI, MACD, EMA crosses, Bollinger Bands, and volume anomalies.
    Produces BUY, SELL, or HOLD signals with entry, invalidation, stop-loss, and take-profit targets.
    """

    def __init__(self):
        super().__init__(
            agent_id="agent_technical_analysis",
            name="Technical Analysis Agent",
            description="Computes algorithmic momentum, trend, and mean-reversion signals (RSI, MACD, EMA, Bollinger Bands).",
            execution_interval_seconds=12,
            supported_assets=["WHSK", "USDT"],
            supported_strategies=["RSI_OVERSOLD", "MACD_CROSSOVER", "BOLLINGER_BREAKOUT", "EMA_TREND"],
        )

    async def execute_cycle(self, correlation_id: str) -> Dict[str, Any]:
        pair = "WHSK/USDT"
        candles = market_data_service.get_candles(pair, limit=120)
        closes = [c["close"] for c in candles]
        volumes = [c["volume"] for c in candles]
        current_price = closes[-1] if closes else 0.8542

        # 1. Compute Indicators
        rsi = calculate_rsi(closes, period=14)
        macd = calculate_macd(closes)
        ema9 = calculate_ema(closes, 9)
        ema21 = calculate_ema(closes, 21)
        sma20 = calculate_sma(closes, 20)
        sma50 = calculate_sma(closes, 50)
        bb = calculate_bollinger_bands(closes, 20, 2.0)
        
        # Momentum (10 period)
        mom = ((current_price - closes[-10]) / closes[-10]) * 100 if len(closes) >= 10 else 0.0
        # Volume Ratio (current volume vs 20 period avg)
        avg_vol = calculate_sma(volumes, 20)
        vol_ratio = (volumes[-1] / avg_vol) if avg_vol > 0 else 1.0

        # 2. Algorithmic Signal Logic
        score = 0
        reasons = []

        # RSI conditions
        if rsi < 35:
            score += 30
            reasons.append(f"RSI oversold ({rsi:.1f} < 35)")
        elif rsi > 65:
            score -= 30
            reasons.append(f"RSI overbought ({rsi:.1f} > 65)")

        # EMA Golden / Death cross
        if ema9 > ema21:
            score += 25
            reasons.append("EMA 9 bullish cross above EMA 21")
        else:
            score -= 25
            reasons.append("EMA 9 bearish cross below EMA 21")

        # MACD histogram momentum
        if macd["histogram"] > 0:
            score += 20
            reasons.append("MACD histogram is positive")
        else:
            score -= 20
            reasons.append("MACD histogram is negative")

        # Bollinger Band squeeze / breakout
        if current_price <= bb["lower"]:
            score += 25
            reasons.append("Price pierced lower Bollinger Band (Mean-reversion bounce expected)")
        elif current_price >= bb["upper"]:
            score -= 25
            reasons.append("Price reached upper Bollinger Band resistance")

        # Volume confirmation
        if vol_ratio > 1.3:
            reasons.append(f"Volume surge ({vol_ratio:.2f}x of 20-period average)")

        # 3. Determine Signal Type & Confidence
        if score >= 35:
            signal_type = "BUY"
            confidence = min(95.0, 50.0 + (score * 0.5))
            stop_loss = round(current_price * 0.985, 4) # 1.5% stop loss
            take_profit = round(current_price * 1.035, 4) # 3.5% take profit (2.33 R:R)
            entry_condition = f"Market buy near {current_price:.4f} while RSI remains < 60."
            invalidation = f"Drop below {stop_loss:.4f} or EMA 9 falling below EMA 21."
        elif score <= -35:
            signal_type = "SELL"
            confidence = min(95.0, 50.0 + (abs(score) * 0.5))
            stop_loss = round(current_price * 1.015, 4)
            take_profit = round(current_price * 0.965, 4)
            entry_condition = f"Take profit or exit near {current_price:.4f}."
            invalidation = f"Break above {stop_loss:.4f}."
        else:
            signal_type = "HOLD"
            confidence = 50.0
            stop_loss = None
            take_profit = None
            entry_condition = "Market in neutral consolidation range."
            invalidation = "Break of Bollinger Band boundaries."

        signal = {
            "id": str(uuid.uuid4()),
            "correlation_id": correlation_id,
            "pair": pair,
            "signal_type": signal_type,
            "timeframe": "1m",
            "confidence": round(confidence, 1),
            "entry_price": current_price,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "entry_conditions": entry_condition,
            "invalidation_conditions": invalidation,
            "rationale": "; ".join(reasons) if reasons else "Indicators neutral.",
            "indicator_values": {
                "rsi_14": round(rsi, 2),
                "macd": macd,
                "ema_9": round(ema9, 4),
                "ema_21": round(ema21, 4),
                "sma_20": round(sma20, 4),
                "sma_50": round(sma50, 4),
                "bollinger_bands": bb,
                "momentum_10": round(mom, 2),
                "volume_ratio": round(vol_ratio, 2),
            },
            "disclaimer": "Technical indicators do not guarantee future performance. Past prices reflect historical market dynamics only.",
        }

        # Formulate Trade Opportunity if signal is actionable
        opportunities = []
        if signal_type in ["BUY", "SELL"] and confidence >= 60.0:
            opportunities.append({
                "id": str(uuid.uuid4()),
                "correlation_id": correlation_id,
                "agent_id": self.agent_id,
                "strategy": "MOMENTUM_TREND_FOLLOWING",
                "pair": pair,
                "direction": signal_type,
                "source_venue": "HSKSwap V3 (0.3% Pool)",
                "quoted_price": current_price,
                "estimated_price_impact_pct": 0.12,
                "estimated_gas_cost_usd": 0.0001,
                "expected_net_profit_usd": round(abs(take_profit - current_price) * 50.0, 2) if take_profit else 1.0,
                "proposed_stop_loss": stop_loss,
                "proposed_take_profit": take_profit,
                "signal_confidence": confidence,
                "status": "OPPORTUNITY_DETECTED",
            })

        return {
            "correlation_id": correlation_id,
            "signals": [signal],
            "opportunities": opportunities,
            "pair": pair,
            "score": score,
        }
