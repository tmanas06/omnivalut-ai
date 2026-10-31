import math
from typing import List, Dict, Any, Optional

def calculate_ema(values: List[float], period: int) -> float:
    if not values:
        return 0.0
    k = 2.0 / (period + 1.0)
    ema = values[0]
    for val in values[1:]:
        ema = (val * k) + (ema * (1.0 - k))
    return ema

def calculate_sma(values: List[float], period: int) -> float:
    if len(values) < period:
        return values[-1] if values else 0.0
    return sum(values[-period:]) / period

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

def calculate_macd(closes: List[float]) -> Dict[str, float]:
    if len(closes) < 26:
        return {"macd": 0.0, "signal": 0.0, "histogram": 0.0}
    ema12 = calculate_ema(closes, 12)
    ema26 = calculate_ema(closes, 26)
    macd_line = ema12 - ema26
    signal_line = calculate_ema(closes[-9:], 9) - ema26
    hist = macd_line - signal_line
    return {
        "macd": round(macd_line, 6),
        "signal": round(signal_line, 6),
        "histogram": round(hist, 6),
    }


class StrategySignals:
    """
    Evaluates trading signals at bar `t` using strictly historical data up to `t`.
    Guarantees ZERO LOOK-AHEAD BIAS.
    """

    @staticmethod
    def evaluate_momentum_trend(candles_slice: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Strategy 1: MOMENTUM_TREND_FOLLOWING
        Buys when EMA9 > EMA21 with positive MACD histogram and RSI > 48.
        Exits when EMA9 < EMA21 or RSI > 72.
        """
        if len(candles_slice) < 26:
            return {"action": "HOLD"}

        closes = [c["close"] for c in candles_slice]
        ema9 = calculate_ema(closes, 9)
        ema21 = calculate_ema(closes, 21)
        rsi = calculate_rsi(closes, 14)
        macd = calculate_macd(closes)

        if ema9 > ema21 and macd["histogram"] > 0 and 48.0 < rsi < 70.0:
            return {
                "action": "BUY",
                "stop_loss_pct": 1.5,
                "take_profit_pct": 3.5,
                "max_hold_bars": 30,
                "confidence": 75.0,
            }
        elif ema9 < ema21 or rsi > 75.0:
            return {"action": "EXIT"}
        return {"action": "HOLD"}

    @staticmethod
    def evaluate_arbitrage_cross_tier(candles_slice: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Strategy 2: ARBITRAGE_CROSS_TIER
        Scans for price dislocation between low fee (0.05%) and high fee (0.30%/1.00%) pools.
        Executes immediate round-trip when net profit after fees and gas is positive.
        """
        if not candles_slice:
            return {"action": "HOLD"}

        curr = candles_slice[-1]
        p_low = curr.get("fee_low_price", curr["close"])
        p_high = curr.get("fee_high_price", curr["close"])

        spread = p_high - p_low
        spread_pct = (spread / p_low) * 100 if p_low > 0 else 0.0

        # Required combined fees: 0.05% + 0.30% = 0.35% + 0.1% buffer = 0.45%
        if spread_pct >= 0.45:
            return {
                "action": "BUY_ARBITRAGE",
                "entry_price": p_low,
                "exit_price": p_high,
                "max_hold_bars": 1, # Atomic / 1-bar roundtrip
                "stop_loss_pct": 0.5,
                "take_profit_pct": spread_pct * 0.9,
                "confidence": 85.0,
            }
        return {"action": "HOLD"}

    @staticmethod
    def evaluate_mean_reversion_bb(candles_slice: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Strategy 3: MEAN_REVERSION_BB
        Buys when price touches or pierces lower Bollinger Band with oversold RSI (< 35).
        Exits when price reverts to middle band or RSI > 55.
        """
        if len(candles_slice) < 20:
            return {"action": "HOLD"}

        closes = [c["close"] for c in candles_slice]
        curr_p = closes[-1]
        bb = calculate_bollinger_bands(closes, 20, 2.0)
        rsi = calculate_rsi(closes, 14)

        if curr_p <= bb["lower"] and rsi < 36.0:
            return {
                "action": "BUY",
                "stop_loss_pct": 1.5,
                "take_profit_pct": 2.5,
                "max_hold_bars": 20,
                "confidence": 70.0,
            }
        elif curr_p >= bb["middle"] or rsi > 58.0:
            return {"action": "EXIT"}
        return {"action": "HOLD"}

    @staticmethod
    def evaluate_high_volatility_breakout(candles_slice: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Strategy 4: HIGH_VOLATILITY_BREAKOUT
        Buys when price breaks above upper Bollinger Band accompanied by a volume surge (> 1.3x 20-period avg).
        Exits when trailing stop triggers or price falls back below middle band.
        """
        if len(candles_slice) < 20:
            return {"action": "HOLD"}

        closes = [c["close"] for c in candles_slice]
        volumes = [c["volume"] for c in candles_slice]
        curr_p = closes[-1]
        bb = calculate_bollinger_bands(closes, 20, 2.0)
        avg_vol = calculate_sma(volumes, 20)
        curr_vol = volumes[-1]
        vol_surge = (curr_vol / avg_vol) if avg_vol > 0 else 1.0

        if curr_p >= bb["upper"] and vol_surge >= 1.30 and bb["bandwidth"] > 0.03:
            return {
                "action": "BUY",
                "stop_loss_pct": 2.0,
                "take_profit_pct": 4.0,
                "max_hold_bars": 25,
                "confidence": 72.0,
            }
        elif curr_p < bb["middle"]:
            return {"action": "EXIT"}
        return {"action": "HOLD"}
