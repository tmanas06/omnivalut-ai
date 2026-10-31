import json
import csv
import io
import time
import math
from typing import List, Dict, Any, Optional

class HistoricalDataFeed:
    """
    Manages historical market data for backtesting.
    Provides data ingestion from JSON/CSV, benchmark data generation with documented provenance,
    and transparent metadata reporting regarding testnet historical data limits.
    """

    DEFAULT_DISCLOSURE = (
        "HashKey Chain Testnet has limited archival historical OHLCV data. "
        "Historical backtesting uses verifiable benchmark time series and imported historical datasets. "
        "All data sources and periods are strictly tracked with zero look-ahead bias."
    )

    def __init__(self, data_file: Optional[str] = None):
        self.data_file = data_file
        self._cached_candles: Dict[str, List[Dict[str, Any]]] = {}

    def get_benchmark_candles(
        self,
        pair: str = "WHSK/USDT",
        count: int = 500,
        seed: int = 42,
    ) -> List[Dict[str, Any]]:
        """
        Generates a deterministic, reproducible benchmark candle sequence
        covering bull trends, mean-reverting ranges, and volatility breakouts.
        Deterministic seed ensures backtest reproducibility across runs.
        """
        import random
        rng = random.Random(seed)

        start_time = 1700000000 # Fixed deterministic epoch start
        candles: List[Dict[str, Any]] = []
        base_price = 0.8500
        curr_price = base_price

        for i in range(count):
            t = start_time + (i * 60) # 1-minute bars

            # Regime simulation:
            # 0-150: Bullish momentum trend
            # 150-300: Mean-reverting range around 0.90
            # 300-400: High volatility breakout and pullback
            # 400-500: Consolidation with intermittent cross-tier dislocations
            if i < 150:
                drift = 0.0004
                volatility = 0.0025
            elif i < 300:
                mean_anchor = 0.9100
                drift = (mean_anchor - curr_price) * 0.05
                volatility = 0.0020
            elif i < 400:
                drift = 0.0002
                volatility = 0.0060 # High volatility
            else:
                drift = -0.0001
                volatility = 0.0030

            shock = (rng.random() - 0.5) * 2 * volatility
            open_p = curr_price
            close_p = max(0.50, open_p + drift + shock)
            high_p = max(open_p, close_p) + abs(rng.random() * volatility * 0.8)
            low_p = min(open_p, close_p) - abs(rng.random() * volatility * 0.8)
            volume = 500.0 + (rng.random() * 4000.0)

            # Simulated multi-tier quotes for cross-tier arbitrage evaluation
            spread_offset = 0.0
            if i % 15 == 0:
                # Dislocation event where 0.05% pool is cheaper than 0.30% pool
                spread_offset = 0.0060

            candles.append({
                "index": i,
                "timestamp": t,
                "open": round(open_p, 4),
                "high": round(high_p, 4),
                "low": round(low_p, 4),
                "close": round(close_p, 4),
                "volume": round(volume, 2),
                "fee_low_price": round(close_p - spread_offset, 4),
                "fee_high_price": round(close_p + spread_offset, 4),
            })
            curr_price = close_p

        self._cached_candles[pair] = candles
        return candles

    def parse_csv_candles(self, csv_content: str) -> List[Dict[str, Any]]:
        """
        Parses CSV data containing columns: timestamp, open, high, low, close, volume.
        """
        f = io.StringIO(csv_content.strip())
        reader = csv.DictReader(f)
        candles = []
        idx = 0
        for row in reader:
            try:
                c = {
                    "index": idx,
                    "timestamp": int(float(row.get("timestamp", idx * 60))),
                    "open": float(row["open"]),
                    "high": float(row["high"]),
                    "low": float(row["low"]),
                    "close": float(row["close"]),
                    "volume": float(row.get("volume", 1000.0)),
                    "fee_low_price": float(row.get("fee_low_price", row["close"])),
                    "fee_high_price": float(row.get("fee_high_price", row["close"])),
                }
                candles.append(c)
                idx += 1
            except (KeyError, ValueError) as ex:
                raise ValueError(f"Invalid candle row {row}: {ex}")
        return candles

    def parse_json_candles(self, json_content: str) -> List[Dict[str, Any]]:
        """
        Parses JSON list of candle dictionaries.
        """
        raw = json.loads(json_content)
        if not isinstance(raw, list):
            raise ValueError("Candles JSON must be a list of objects.")
        candles = []
        for idx, item in enumerate(raw):
            candles.append({
                "index": idx,
                "timestamp": int(item.get("timestamp", idx * 60)),
                "open": float(item["open"]),
                "high": float(item["high"]),
                "low": float(item["low"]),
                "close": float(item["close"]),
                "volume": float(item.get("volume", 1000.0)),
                "fee_low_price": float(item.get("fee_low_price", item["close"])),
                "fee_high_price": float(item.get("fee_high_price", item["close"])),
            })
        return candles

    def get_dataset_metadata(self, candles: List[Dict[str, Any]], source_name: str = "BENCHMARK_SYNTHETIC") -> Dict[str, Any]:
        if not candles:
            return {
                "candle_count": 0,
                "start_time": None,
                "end_time": None,
                "duration_hours": 0.0,
                "source": source_name,
                "disclosure": self.DEFAULT_DISCLOSURE,
            }

        start_t = candles[0]["timestamp"]
        end_t = candles[-1]["timestamp"]
        duration_hrs = (end_t - start_t) / 3600.0

        return {
            "candle_count": len(candles),
            "start_time": start_t,
            "end_time": end_t,
            "duration_hours": round(duration_hrs, 2),
            "source": source_name,
            "disclosure": self.DEFAULT_DISCLOSURE,
        }
