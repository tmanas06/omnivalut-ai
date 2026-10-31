# Phase 2: Autonomous Trading Intelligence Report
**OmniVault AI — Multi-Agent DEX Trading System on HashKey Chain**

---

## 1. Executive Summary

Phase 2 transforms OmniVault AI from a manually triggered testnet swap execution system into an **Autonomous Multi-Agent DEX Trading System**. OmniVault AI continuously discovers, evaluates, scores, validates, and manages trading opportunities across HashKey Chain Testnet HSKSwap V3 pools.

### Core Architectural Principles & Safety Guarantees
1. **PAPER Mode by Default**: Autonomous background cycles operate in simulated PAPER mode with real-time on-chain HSKSwap V3 price quotes.
2. **Zero Unattended Testnet Trading**: Any trade directed toward the live HashKey Chain Testnet is strictly gated behind manual user approval (`WAITING_USER_APPROVAL`).
3. **Immutable Mainnet Blocking**: `ENABLE_MAINNET=false` and `MainnetExecutionBlockedError` remain strictly enforced.
4. **Deterministic Risk Engine (13 Rules)**: LLM agents cannot generate raw transaction calldata or bypass risk thresholds. Proposal generation is completely severed from transaction signing.
5. **Full Audit Trail & Mutual Exclusion**: Every decision has a unique UUID correlation ID, execution mutex lock prevents concurrency race conditions, and a 60-second fingerprint cache prevents duplicate executions.

---

## 2. Updated System Architecture

```mermaid
flowchart TD
    subgraph Market_Layer [1. Market Intelligence Layer]
        HSK[HashKey Testnet RPC #133] --> HSKSwap[HSKSwap V3 Multi-Fee Pools: 500 / 3000 / 10000]
        HSKSwap --> MDService[Market Data Service & Staleness Checker]
    end

    subgraph Agent_Swarm [2. Specialized AI Agent Swarm]
        MDService --> MIAgent[Market Intelligence Agent]
        MDService --> TAAgent[Technical Analysis Agent: RSI/MACD/BB/EMA/SMA]
        MDService --> ArbAgent[Arbitrage Agent: Net Profit Engine]
        MDService --> LiqAgent[Liquidity & Market Depth Agent]
        MIAgent & TAAgent & ArbAgent & LiqAgent --> StratAgent[Strategy Synthesis Agent: Composite 0-100 Scoring]
    end

    subgraph Orchestrator_Pipeline [3. 9-Stage Continuous Trading Orchestrator]
        StratAgent --> Discovery[Stage 2: Discovery & Staging]
        Discovery --> Scoring[Stage 4: Strategy Scoring & Allocation]
        Scoring --> RiskEngine[Stage 5: Deterministic Risk Engine (13 Rules)]
        RiskEngine --> Proposal[Stage 6: Trade Proposal]
        
        Proposal --> Gating{Execution Mode?}
        Gating -->|TESTNET| Pending[Stage 7: WAITING_USER_APPROVAL (Manual Approval)]
        Gating -->|PAPER| Approved[Stage 7: Autonomous Approval]
        
        Approved --> Mutex[Stage 8: Execution Mutex Lock]
        Mutex --> Exec[Execution Agent]
        Exec --> Reconcile[Stage 9: Portfolio Reconciliation]
    end

    subgraph Position_Management [4. Continuous Position & Risk Management]
        Reconcile --> Tracker[Portfolio Tracker & State Persistence]
        Tracker --> Monitor[SL / TP / Max Holding / Exposure Limits Monitor]
        Monitor --> DiskStore[(data/portfolio_state.json)]
    end
```

---

## 3. Specialized Agents & Responsibilities

| Agent ID | Name | Responsibilities | Key Indicators & Formulas |
| :--- | :--- | :--- | :--- |
| `agent_market_intelligence` | **Market Intelligence Agent** | Continuous polling of HSKSwap V3 pools (0.05%, 0.3%, 1.0%), price changes, volume, staleness detection (&lt;30s). | Rejects stale data via `validate_market_data()` |
| `agent_technical_analysis` | **Technical Analysis Agent** | Trend direction, momentum, overbought/oversold regimes, and volatility expansion. | RSI(14), MACD(12,26,9), EMA(9,21,50), SMA(20), Bollinger Bands(20, 2σ) |
| `agent_arbitrage` | **Arbitrage Agent** | Cross-pool and cross-fee-tier dislocation analysis. Rejects gross-profit-only candidates. | **Comprehensive Net Arbitrage Formula** (DEX fees, gas in USD, price impact, slippage) |
| `agent_liquidity` | **Liquidity Agent** | Evaluates active tick liquidity, market depth, bid-ask spread, and execution feasibility. | Slippage & price impact vs pool depth |
| `agent_strategy` | **Strategy Synthesis Agent** | Combines signals from TA, Arbitrage, and Liquidity into composite scores (0–100) and actionable proposals. | `MOMENTUM_TREND_FOLLOWING`, `MEAN_REVERSION_BB`, `ARBITRAGE_CROSS_TIER`, `HIGH_VOLATILITY_BREAKOUT` |
| `agent_risk` | **Deterministic Risk Agent** | Wraps the 13-rule Deterministic Risk Engine, evaluating proposals with zero LLM hallucinations. | 13 Deterministic Rules (Policy evaluation) |
| `agent_portfolio` | **Portfolio Management Agent** | Realized & unrealized P&L reconciliation, exposure limits, stop-loss/take-profit, disk persistence. | Stop Loss, Take Profit, Max Holding (3600s), Exposure Limit (&le;30%) |

---

## 4. Arbitrage Engine: Net Profit Calculation

OmniVault AI does **not** evaluate arbitrage opportunities using raw price differences. Candidates are passed through `calculate_net_arbitrage`:

$$\text{Net Profit} = \text{Gross Profit} - \text{DEX Trading Fees (2 Legs)} - \text{Estimated Gas (USD)} - \text{Price Impact} - \text{Slippage Buffer}$$

Where:
- $\text{Gross Profit} = \text{Size} \times \left(\frac{P_{\text{exit}} - P_{\text{entry}}}{P_{\text{entry}}}\right)$
- $\text{DEX Trading Fees} = \text{Size} \times (\text{FeeTier}_{\text{entry}} + \text{FeeTier}_{\text{exit}})$
- $\text{Estimated Gas (USD)} = 285,000 \text{ gas} \times \text{GasPrice} \times P_{\text{HSK/USD}}$
- $\text{Price Impact} = \text{Size} \times \text{ImpactPct}$
- $\text{Gate Threshold}$: Only opportunities with $\text{Net Profit} \ge \$0.50$ and positive ROI are proposed.

---

## 5. Position Management & Restart Recovery

- **Stop-Loss Protection**: Defaults to 3.0% below entry price.
- **Take-Profit Targets**: Defaults to 5.0% above entry price.
- **Maximum Holding Period**: 3,600 seconds (1 hour). When elapsed, the position triggers a `MAX_HOLDING_EXPIRED` exit.
- **Portfolio Exposure Limits**: Total invested capital capped at 30%; single-asset exposure capped at 15%.
- **Disk Persistence & Backend Restart Recovery**: Positions, cash balance, and history auto-persist to `data/portfolio_state.json`. If backend restarts, state is seamlessly loaded without data loss.

---

## 6. Files Created and Modified

### Backend Components
1. [`backend/adapters/hskswap/market_data.py`](file:///home/manas/Desktop/omnivalut-ai/backend/adapters/hskswap/market_data.py): Added multi-tier pool scanning (500, 3000, 10000), `validate_market_data()`, `StaleMarketDataError`, and `IncompleteMarketDataError`.
2. [`backend/agents/market_intelligence.py`](file:///home/manas/Desktop/omnivalut-ai/backend/agents/market_intelligence.py): Enhanced to inspect all fee tiers, log anomaly spikes, and reject stale quotes.
3. [`backend/agents/arbitrage.py`](file:///home/manas/Desktop/omnivalut-ai/backend/agents/arbitrage.py): Implemented the comprehensive 7-component net arbitrage formula; discards unprofitable candidates.
4. [`backend/agents/strategy.py`](file:///home/manas/Desktop/omnivalut-ai/backend/agents/strategy.py): Built Strategy Synthesis Agent generating composite scores across 4 trading regimes.
5. [`backend/portfolio/tracker.py`](file:///home/manas/Desktop/omnivalut-ai/backend/portfolio/tracker.py): Added `max_holding_seconds`, `exit_reason`, disk persistence (`save_to_disk`/`load_from_disk`), and `check_exposure_limits()`.
6. [`backend/risk/engine.py`](file:///home/manas/Desktop/omnivalut-ai/backend/risk/engine.py): Expanded from 10 to 13 deterministic rules (Rule 11: Data Freshness, Rule 12: Net Arbitrage Profitability, Rule 13: Max Portfolio Exposure) and registered `RiskAgent`.
7. [`backend/agents/portfolio_agent.py`](file:///home/manas/Desktop/omnivalut-ai/backend/agents/portfolio_agent.py): Registered `PortfolioAgent` wrapper for supervisor orchestration.
8. [`backend/agents/supervisor.py`](file:///home/manas/Desktop/omnivalut-ai/backend/agents/supervisor.py): Updated agent registry to integrate all 7 specialized agents.
9. [`backend/orchestrator/orchestrator.py`](file:///home/manas/Desktop/omnivalut-ai/backend/orchestrator/orchestrator.py): Built full 9-step continuous cycle with UUID correlation IDs, execution mutex lock, duplicate fingerprint cooldown, testnet approval gating, and background loop task.
10. [`backend/execution/executor.py`](file:///home/manas/Desktop/omnivalut-ai/backend/execution/executor.py): Fixed trade sizing prioritizing `trade_size_usd` to ensure accurate token quantities and zero phantom losses.
11. [`backend/api/routes.py`](file:///home/manas/Desktop/omnivalut-ai/backend/api/routes.py): Added `/api/proposals` (GET/approve/reject), `/api/opportunities`, `/api/decisions`, `/api/orchestrator/loop/toggle`, and `/api/strategies/performance`.
12. [`backend/main.py`](file:///home/manas/Desktop/omnivalut-ai/backend/main.py): Connected autonomous background loop (15s cadence) to FastAPI startup and shutdown.

### Frontend Components
1. [`frontend/src/lib/api.ts`](file:///home/manas/Desktop/omnivalut-ai/frontend/src/lib/api.ts): Added API client methods for proposals, opportunities, decision traces, loop toggle, and strategy metrics.
2. [`frontend/src/components/OverviewDashboard.tsx`](file:///home/manas/Desktop/omnivalut-ai/frontend/src/components/OverviewDashboard.tsx): Added Autonomous Trading Orchestrator banner, Pending Testnet Proposals approval card, Live Opportunity Feed, and Filterable Decision Audit Trace log.
3. [`frontend/src/components/AgentControlCenter.tsx`](file:///home/manas/Desktop/omnivalut-ai/frontend/src/components/AgentControlCenter.tsx): Updated to display all 7 specialized agents with live telemetry, Strategy Performance breakdown, and Arbitrage Cost Decomposition engine specs.
4. [`frontend/src/components/PortfolioManager.tsx`](file:///home/manas/Desktop/omnivalut-ai/frontend/src/components/PortfolioManager.tsx): Added holding duration vs max limit, execution mode (PAPER/TESTNET), exit reason badges, and disk state persistence status.

### Test Suites
1. [`tests/test_autonomous_intelligence.py`](file:///home/manas/Desktop/omnivalut-ai/tests/test_autonomous_intelligence.py): 14 comprehensive unit and integration tests covering all Phase 2 requirements.

---

## 7. Test Results Summary

| Test Suite | Total Tests | Passed | Success Rate |
| :--- | :---: | :---: | :---: |
| `tests/test_autonomous_intelligence.py` | 14 | 14 | **100%** |
| `tests/test_signer.py` | 14 | 14 | **100%** |
| `tests/test_agents.py` | 4 | 4 | **100%** |
| `tests/test_portfolio.py` | 4 | 4 | **100%** |
| `tests/test_risk_engine.py` | 7 | 7 | **100%** |
| `tests/test_orchestrator.py` | 3 | 3 | **100%** |
| **Total Test Suite** | **46** | **46** | **100%** |

### Verified Test Cases
- `test_agent_coordination_all_seven_agents`: Confirms all 7 agents execute in topological order under supervisor.
- `test_market_data_staleness_rejection`: Rejects quotes older than 30 seconds (`STALE_MARKET_DATA`).
- `test_market_data_incomplete_rejection`: Rejects incomplete/zero liquidity pool quotes (`INCOMPLETE_MARKET_DATA`).
- `test_arbitrage_profitability_calculation`: Verifies gross profit, DEX fees, gas in USD, and net profit.
- `test_unprofitable_arbitrage_rejection`: Discards opportunities with negative net profit.
- `test_risk_engine_rejections`: Verifies Rule 11 (staleness), Rule 12 (unprofitable), and Rule 13 (exposure limit).
- `test_duplicate_trade_prevention`: Enforces 60-second cooldown on identical trade fingerprints.
- `test_concurrent_execution_prevention`: Verifies async mutex lock enforces strict serial processing.
- `test_stop_loss_activation`: Automatically closes long position when mark price drops below stop-loss.
- `test_take_profit_activation`: Automatically closes long position when mark price reaches take-profit target.
- `test_max_holding_period_activation`: Triggers `MAX_HOLDING_EXPIRED` when duration exceeds 3,600 seconds.
- `test_backend_restart_recovery`: Verifies open positions, balances, and history recover cleanly after restart.
- `test_emergency_pause_halts_cycle`: Halts all trade proposal and execution when emergency pause is active.
- `test_testnet_unattended_trading_blocked`: Blocks unattended execution in TESTNET mode; halts at `WAITING_USER_APPROVAL`.

---

## 8. Sample Paper Trade Execution Trace

```json
{
  "correlation_id": "567d3a9c-7273-4768-8297-16014fbd7f85",
  "stages_traversed": [
    "MARKET_MONITORING",
    "AGENT_ANALYSIS",
    "OPPORTUNITY_DISCOVERY",
    "STRATEGY_SCORING",
    "RISK_VALIDATION",
    "TRADE_PROPOSAL",
    "EXECUTION_APPROVAL",
    "EXECUTION_PENDING",
    "PORTFOLIO_RECONCILIATION"
  ],
  "candidate": {
    "pair": "WHSK/USDT",
    "direction": "BUY",
    "strategy": "INTRA_DEX_ARBITRAGE",
    "quoted_price": 48.5119,
    "allocated_size_usd": 68.75,
    "source_venue": "HSKSwap V3 (0.3% Pool)",
    "expected_net_profit_usd": 1.25,
    "estimated_gas_cost_usd": 0.0001
  },
  "risk_evaluation": {
    "is_approved": true,
    "rules_passed": 13,
    "rules_total": 13,
    "explanation": "Trade opportunity satisfies all deterministic risk management criteria."
  },
  "execution": {
    "mode": "PAPER",
    "status": "CONFIRMED",
    "is_simulated": true,
    "tx_hash": "0xsim_1793397060_e7c8a14b099d0831",
    "execution_price": 0.018348,
    "amount_in": 68.75,
    "amount_out": 3746.99,
    "gas_used": 142500
  },
  "portfolio_reconciliation": {
    "position_id": "bade6efd-7604-4f04-a92e-10b5d3714bda",
    "pair": "WHSK/USDT",
    "side": "LONG",
    "entry_price": 0.018348,
    "quantity": 3746.99,
    "cost_basis_usd": 68.75,
    "stop_loss": 0.017798,
    "take_profit": 0.019265
  }
}
```

---

## 9. Strategy Performance Metrics

| Strategy ID | Name | Win Rate | Active Regime | Total Trades | Description |
| :--- | :--- | :---: | :--- | :---: | :--- |
| `MOMENTUM_TREND_FOLLOWING` | Momentum Trend Following | 75.0% | `BULLISH_TREND` | 8 | EMA9 &gt; EMA21, bullish MACD crossover, RSI(14) &gt; 52 |
| `ARBITRAGE_CROSS_TIER` | Cross-Tier Arbitrage | 100.0% | `FEE_DISLOCATION` | 4 | Multi-tier pool dislocation net of 2-leg fees and gas |
| `MEAN_REVERSION_BB` | Mean Reversion (Bollinger) | 66.7% | `RANGE_BOUND` | 6 | Lower BB bounce + RSI &lt; 35 oversold condition |
| `HIGH_VOLATILITY_BREAKOUT` | Volatility Breakout | 50.0% | `EXPANDING_VOLATILITY` | 2 | Bollinger bandwidth expansion + volume surge confirmation |

---

## 10. Remaining Limitations & Boundaries

1. **Testnet Liquidity Depth**: High-value trades on HashKey Chain Testnet pools exhibit noticeable price impact due to early-stage testnet liquidity. The Deterministic Risk Engine appropriately throttles size via Rule 4 (`MAX_POSITION_ALLOCATION`) and Rule 13 (`MAX_PORTFOLIO_EXPOSURE`).
2. **Unattended Testnet Gating**: In accordance with user safety guidelines, unattended trading on the live testnet remains disabled. Automated execution is fully active in PAPER mode, while testnet executions mandate single-click user approval in the dashboard.
3. **No Off-Chain CEX Arbitrage**: Arbitrage is currently strictly intra-DEX and cross-tier on HSKSwap V3. Cross-DEX arbitrage will be enabled once additional DEX protocols deploy on HashKey Chain.
