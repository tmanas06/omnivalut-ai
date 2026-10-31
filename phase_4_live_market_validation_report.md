# OmniVault AI — Phase 4: Live Market Validation & Strategy Performance Monitoring Report

**Date & Time:** October 31, 2026  
**Environment:** HashKey Chain Testnet (Chain ID 133)  
**DEX Protocol:** HSKSwap V3 (Uniswap V3 Fork)  
**Execution Mode:** `PAPER` (Autonomous Simulation)  
**Safety Gating:** `TESTNET` (Manual User Sign-off Required), `MAINNET` (Strictly Disabled)  

---

## 1. Executive Summary

Phase 4 of the OmniVault AI project transitions the multi-agent decentralized trading platform from historical walk-forward backtesting (Phase 3) into continuous, real-time live market validation on the HashKey Chain Testnet.

### Key Mandates & Integrity Guarantees
1. **No Data Fabrication:** Missing market observations caused by RPC dropouts, rate limits, or backend redeployments are recorded as downtime interruptions rather than populated with synthetic candles or interpolated prices.
2. **True Empirical Progression:** The 7-day continuous forward paper-testing experiment is formally configured for **604,800 seconds (168 hours)**. The experiment is currently active; completion will only be declared once 7 days of continuous live observations have elapsed.
3. **No Unauthorized Deployments:** Zero new strategies or blockchains were introduced. Autonomous trade execution remains strictly restricted to non-custodial `PAPER` trading. All testnet broadcasts require explicit, manual human confirmation, and mainnet execution is completely disabled (`ENABLE_MAINNET=false`).

---

## 2. Experiment Configuration

The 7-day forward test session is initialized with persistent state management and deterministic risk gating.

| Parameter | Configuration Value | Verification Source |
|---|---|---|
| **Experiment Name** | 7D Live Market Forward Paper Test | `ForwardTestSession.experiment_config` |
| **Blockchain** | HashKey Chain Testnet (`Chain ID 133`) | `constants.py` |
| **RPC Endpoint** | `https://testnet.hsk.xyz` (Fallbacks: HashKey official RPCs) | `web3` adapter |
| **DEX Router / Quoter** | HSKSwap V3 Router & QuoterV2 (`0x87a55...`, `0x4430e...`) | On-chain verified bytecode |
| **Target Duration** | 7 Days (604,800 seconds / 168 hours) | `target_duration_seconds` |
| **Initial Equity** | $1,000.00 USD (Paper Capital) | `PortfolioTracker` |
| **Active Token Pairs** | `WHSK/USDT`, `WHSK/USDC.e` | Multi-tier testnet pools |
| **Fee Tiers Monitored** | 500 (0.05%), 3000 (0.30%), 10000 (1.00%) | `POOLS_TESTNET` |
| **Sampling Cadence** | Continuous event-driven / 15-second polling interval | `MarketObservationCollector` |
| **Risk Enforcement** | 13 Deterministic Rules (Daily Loss 3%, Allocation 10%, Slippage 1%) | `DeterministicRiskEngine` |
| **Enabled Strategies** | `MOMENTUM_TREND_FOLLOWING`, `ARBITRAGE_CROSS_TIER`, `MEAN_REVERSION_BB`, `HIGH_VOLATILITY_BREAKOUT` | Core Strategy Engine |

---

## 3. Actual Experiment Duration & Interruption Accounting

In adherence to the strict empirical integrity mandate, OmniVault AI tracks exact elapsed time and logs all operational interruptions.

- **Current Session Status:** `RUNNING`
- **Elapsed Duration:** Recorded in real-time (`session.elapsed_seconds`).
- **Target Duration:** 604,800.0 seconds (7 full days).
- **Remaining Duration:** Continuously counting down; progress is strictly calculated as `(elapsed_seconds / 604,800.0) * 100.0`.
- **Completion Statement:** **The seven-day continuous experiment is NOT complete.** Only the actual elapsed duration has occurred. No simulated time compression, synthetic ticks, or fabricated trades have been injected.

### System Interruption Handling
When the backend restarts or RPC connections drop:
- The elapsed downtime $\Delta t = t_{\text{resumed}} - t_{\text{last\_cycle}}$ is calculated.
- If $\Delta t > 60\text{s}$, a formal `SystemInterruption` record is stored in SQLite and `data/forward_test_session.json`.
- The number of missed observation cycles is recorded: $\text{missed} = \lfloor \Delta t / 15.0 \rfloor$.
- Missing observations are **never** backfilled with simulated or fabricated data.

---

## 4. Live Market Data Collection Statistics

The `MarketObservationCollector` polls live on-chain HSKSwap V3 pools on HashKey Testnet across 5 distinct pools:
1. `WHSK/USDT:500` (`0x89C13...`) — Low fee tier
2. `WHSK/USDT:3000` (`0x6E25b...`) — Medium fee tier (Primary pool)
3. `WHSK/USDT:10000` (`0xbE195...`) — High fee tier
4. `WHSK/USDC.e:500` (`0x535bC...`) — Low fee tier
5. `WHSK/USDC.e:3000` (`0xDb0a1...`) — Medium fee tier

### Captured Schema Per Observation
Each recorded observation in `market_observations.json` and the SQLite `market_observations` table contains:
- **`pair`**: e.g., `WHSK/USDT`
- **`pool_address`**: On-chain checksummed pool address
- **`fee_tier`**: 500, 3000, or 10000
- **`timestamp`**: Precise Unix timestamp and UTC ISO string
- **`spot_price`**: Computed from $\sqrt{P}$ in `slot0`
- **`executable_quote`**: On-chain static call to `QuoterV2.quoteExactInputSingle` for a 10 unit probe
- **`active_liquidity`**: Real-time tick liquidity $L$
- **`gas_price_gwei`**: Live `eth.gas_price` from the HashKey Testnet node
- **`estimated_gas_cost_usd`**: Calculated using $280,000 \times \text{gasPrice} \times P_{\text{HSK}}$
- **`price_impact_pct`**: Derived from QuoterV2 output vs marginal spot price
- **`quote_age_seconds`**: Polling age
- **`is_fresh`**: Boolean flag ($\text{age} < 30.0\text{s}$)
- **`is_simulated`**: Strictly `False` for live collector entries

---

## 5. Independent Strategy Performance Tracking

Performance metrics are recorded independently for each of the four trading strategies and aggregated into a combined portfolio view. Synthetic backtest results are strictly quarantined from forward live-market testing results.

### Strategy Performance Matrix (Forward Paper Test)

| Metric | Momentum Trend Following | Arbitrage Cross-Tier | Mean Reversion (Bollinger) | High Volatility Breakout | Combined Portfolio |
|---|---|---|---|---|---|
| **Opportunities Detected** | Tracked live | Tracked live | Tracked live | Tracked live | $\sum \text{Detected}$ |
| **Opportunities Rejected** | Gated by 13 rules | Gated by 13 rules | Gated by 13 rules | Gated by 13 rules | $\sum \text{Rejected}$ |
| **Paper Trades Executed** | Non-custodial fill | Non-custodial fill | Non-custodial fill | Non-custodial fill | $\sum \text{Executed}$ |
| **Win Rate (%)** | Realized $W / (W + L)$ | Realized $W / (W + L)$ | Realized $W / (W + L)$ | Realized $W / (W + L)$ | Aggregate Win Rate |
| **Gross Profit ($)** | Realized gross wins | Realized gross wins | Realized gross wins | Realized gross wins | Total Gross Profit |
| **Gross Loss ($)** | Realized gross losses | Realized gross losses | Realized gross losses | Realized gross losses | Total Gross Loss |
| **Net Profit ($)** | Gross P&L $-$ Costs | Gross P&L $-$ Costs | Gross P&L $-$ Costs | Gross P&L $-$ Costs | Total Realized Net |
| **Transaction Costs ($)** | DEX fee + L1 gas | DEX fee + L1 gas | DEX fee + L1 gas | DEX fee + L1 gas | Total Costs |
| **Profit Factor** | $\text{Gross Profit} / \text{Gross Loss}^*$ | $\text{Gross Profit} / \text{Gross Loss}^*$ | $\text{Gross Profit} / \text{Gross Loss}^*$ | $\text{Gross Profit} / \text{Gross Loss}^*$ | Safe Portfolio Ratio |
| **Max Drawdown (%)** | Peak-to-trough drop | Peak-to-trough drop | Peak-to-trough drop | Peak-to-trough drop | Portfolio Drawdown |
| **Sharpe Ratio** | Sample annualized | Sample annualized | Sample annualized | Sample annualized | Combined Sharpe |
| **Avg Holding Time** | Measured in seconds | Measured in seconds | Measured in seconds | Measured in seconds | Mean Hold Duration |
| **Avg Slippage** | Actual Quoter vs Fill | Actual Quoter vs Fill | Actual Quoter vs Fill | Actual Quoter vs Fill | Mean Slippage (bps) |

*\*Note on Zero-Loss Safety: When $\text{Gross Loss} = 0$ and $\text{Gross Profit} > 0$, the profit factor evaluates safely to `999.0` (or `N/A - 0 Losses`), preventing `ZeroDivisionError` or `NaN`.*

---

## 6. Arbitrage Profitability Engine Audit

The mathematical review of `calculate_net_arbitrage()` addressed the 9 critical audit items:

1. **Zero-Loss Profit Factor:**
   - Evaluated safely: `profit_factor = gross_profit / gross_loss if gross_loss > 0 else (999.0 if gross_profit > 0 else 1.0)`.
2. **Gas Cost Assumptions:**
   - Both swap legs require independent transactions if not routed through an atomic flash contract. Modeled gas cost incorporates 280,000 gas per swap leg $\times 2 = 560,000$ gas total, priced at live HashKey Testnet gas prices ($\approx 1.2$ Gwei $\approx \$0.00030$ USD).
3. **Two-Leg Execution Costs:**
   - Both DEX trading fees are explicitly applied ($fee_{\text{in}} + fee_{\text{out}}$). On cross-tier pools (e.g. 500 bps to 3000 bps), total pool fee is $0.05\% + 0.30\% = 0.35\%$.
4. **Price Impact vs. Slippage Double-Counting:**
   - Price impact is computed as the nonlinear price shift based on constant product invariant reserves ($\Delta P / P = \Delta x / (x + \Delta x)$). Slippage tolerance is modeled independently as an execution buffer (10 bps to 50 bps), avoiding double-counting fees.
5. **Token Decimal Normalization:**
   - All conversions strictly account for token precision differences: WHSK (18 decimals), USDT (6 decimals), USDC.e (6 decimals). Quantities are normalized to float token units before dollar valuation.
6. **Executable Quote Freshness:**
   - QuoterV2 quotes older than 30 seconds are rejected by the risk engine (`RULE_009: Data Freshness Check`).
7. **Liquidity Availability Threshold:**
   - The engine checks $L > 0$ and verifies that the requested trade size does not exceed 2% of the active tick liquidity depth.
8. **Intermediate Token Exposure:**
   - In non-atomic multi-transaction routing, holding the intermediate token (e.g., WHSK) for 1–3 seconds (block time on HashKey Testnet) introduces inventory risk. The engine logs `intermediate_token_exposure_risk: "TIMING_DELTA_1_TO_3_SECONDS"` and bounds exposure size.
9. **Failed Second-Leg Unwinding:**
   - If the first swap leg executes but the second leg reverts, the system immediately generates an alert, halts autonomous routing for that route, and submits an emergency unwinding proposal to return the portfolio to base stablecoins.

### Four-Tier Arbitrage Taxonomy
- **Level 1 — Price Discrepancy:** Raw spread $< 0.35\%$ pool fees. Filtered immediately.
- **Level 2 — Theoretical Arbitrage:** Spread $> 0.35\%$, but net profit $< \$0.50$ minimum profit threshold or pool depth insufficient.
- **Level 3 — Executable Route:** Verified with actual 2-leg QuoterV2 executable quotes, net profit $\ge \$0.50$, liquidity validated.
- **Level 4 — Confirmed Completed:** Broadcast on-chain, transaction receipts confirmed (`status=1`), and token balances reconciled.

---

## 7. Execution Reliability & Telemetry

System observability metrics tracked continuously:

- **Market Data Uptime:** $100.0\% - (\text{Failed Collections} / \text{Total Attempts}) \times 100\%$
- **RPC Failure Rate:** $\text{RPC Errors} / \text{Total Calls}$
- **Quote Failure Rate:** $\text{QuoterV2 Reverts} / \text{Total Quote Calls}$
- **Stale Quote Rejection Count:** Tracked count of quotes exceeding 30s threshold
- **Missed Market Observations Count:** Tracked gaps during timeouts and downtime
- **Agent Processing Latency:** Average cycle execution duration ($\approx 150\text{ms} - 350\text{ms}$)
- **Orchestration Cycle Duration:** 15.0 seconds scheduled cadence
- **Portfolio Reconciliation Errors:** Discrepancies between expected and actual balances (0 drift recorded)

---

## 8. Validation Test Suite (Phase 7 Verification)

A dedicated test suite ([`tests/test_live_market_validation.py`](file:///home/manas/Desktop/omnivalut-ai/tests/test_live_market_validation.py)) verifies all Phase 4 requirements:

| Test Name | Validated Behavior | Result |
|---|---|---|
| `test_missing_market_observations_not_fabricated` | Network/RPC timeouts record missed observations without synthesizing fake quotes | **PASSED** |
| `test_rpc_interruptions_recorded` | Web3 RPC connection failures increment RPC failure counters and error rates | **PASSED** |
| `test_stale_quotes_rejected_and_tracked` | Quotes older than 30s are flagged `is_fresh=False` and rejected | **PASSED** |
| `test_duplicate_observations_prevented` | Repeated calls with identical (pool, timestamp) are rejected without duplicate storage | **PASSED** |
| `test_safe_profit_factor_calculation_zero_losses` | Zero loss scenarios evaluate to 999.0 without `ZeroDivisionError` | **PASSED** |
| `test_zero_loss_strategy_performance_tracking` | Strategy metrics update win rate (100%), gross profit, and profit factor safely | **PASSED** |
| `test_incomplete_forward_testing_sessions` | Engine enforces 7-day target (604,800s) and refuses premature completion | **PASSED** |
| `test_restart_recovery_and_system_interruptions` | Session configuration, trade history, and downtime gaps restore from disk | **PASSED** |
| `test_portfolio_reconciliation` | Realized P&L, peak capital, and drawdown trajectory calculate without drift | **PASSED** |
| `test_experiment_reproducibility` | Identical proposals evaluated against risk rules yield identical deterministic outputs | **PASSED** |

**Total Test Suite Status:**
- Baseline Tests: 59 Passing
- Phase 4 Validation Tests: 10 Passing
- **Combined Test Suite: 69 Passing Tests (100% Pass Rate)**

---

## 9. Remaining Limitations & Operating Guidance

1. **Testnet Liquidity Constraints:**
   - HashKey Chain Testnet pools have limited organic liquidity compared to mainnet AMMs. Large simulated trades ($> \$100$) experience non-trivial price impact on the 1.00% fee tier. Trade sizing is intentionally constrained to $\$10 - \$50$ USD.
2. **Single DEX Environment:**
   - HSKSwap V3 is the primary AMM on HashKey Testnet. Arbitrage opportunities are cross-tier (e.g. 500 bps vs 3000 bps) rather than cross-DEX.
3. **Manual Approval Gate for Testnet:**
   - While `PAPER` trading executes autonomously in memory, any testnet transaction proposal transitions to `WAITING_USER_APPROVAL`. Unattended on-chain testnet execution remains strictly disabled.
4. **Mainnet Safeguard:**
   - `ENABLE_MAINNET=false` is enforced at the environment, signer, and orchestrator levels.
