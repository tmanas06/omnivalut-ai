# OmniVault AI - Implementation Plan

**Target Hackathon:** HSK Chain India Hackathon (Track: AI Agent Trading)  
**System:** OmniVault AI - Autonomous Multi-Agent DEX Trading System on HashKey Chain  
**Version:** 1.0.0-rc  

---

## Phase Overview

```
PHASE 0: Audit & Discovery [COMPLETE]
   └── System inspection, HashKey testnet verification, HSKSwap contract extraction.

PHASE 1: Core Foundation & Infrastructure
   ├── Backend: FastAPI project structure, async database (PostgreSQL / SQLite fallback), schemas.
   ├── Frontend: Next.js 14+ App Router, Tailwind CSS, Lucide icons, Dark Terminal UI.
   └── Blockchain: Viem & Wagmi configuration for HashKey Testnet (Chain ID 133).

PHASE 2: HSKSwap & Market Intelligence Service
   ├── HSKSwap V3 On-Chain Adapter (Factory, SwapRouter02, QuoterV2, Multicall).
   ├── Token & Pool Discovery (WHSK, USDT, USDC.e).
   └── Normalized Market Data Service (Price feeds, Liquidity tracking, Volatility metrics).

PHASE 3: Autonomous Multi-Agent Architecture
   ├── Agent 1: Market Intelligence Agent (Pool monitoring, spread detection).
   ├── Agent 2: Arbitrage Agent (Cross-pool & route price dislocation, net fee calculation).
   ├── Agent 3: Technical Analysis Agent (RSI, MACD, Bollinger Bands, EMA/SMA signals).
   ├── Agent 4: Liquidity Agent (Slippage impact, depth validation, pool fee tiering).
   └── Agent Supervisor (Cycle coordinator, worker orchestration, heartbeat).

PHASE 4: Orchestration & Deterministic Risk Engine
   ├── Central Orchestrator: State machine (ANALYZING -> OPPORTUNITY -> RISK_CHECK -> APPROVED -> EXECUTING).
   ├── Deterministic Risk Engine (10 Hard Risk Rules: max allocation, max slippage, daily loss, drawdown, cooldown).
   └── Capital Allocator (Dynamic sizing, position quota management).

PHASE 5: Execution Engine & Portfolio Accounting
   ├── Execution Service: Call data generation, simulation, gas estimation, nonce tracking.
   ├── Client-Side MetaMask Execution & Backend Testnet Execution options.
   └── Portfolio Tracker: Realized & unrealized P&L, balance reconciliation, trade history.

PHASE 6: Trading Terminal Dashboard & Natural Language Interface
   ├── Overview Dashboard (AUM, P&L charts, Win rate, Activity feed).
   ├── Agent Control Center (Individual agent status, metrics, toggle switches, decision logs).
   ├── Trading Terminal (Pair selector, candlestick chart, depth, signal breakdown).
   ├── Risk Center (Live parameter sliders, violation audit log, emergency kill switch).
   ├── Conversational AI Interface (Intent translation, strategy re-tuning, confirmation modal).
   └── Real-time WebSocket Gateway (Live agent heartbeats, order status, price ticks).

PHASE 7: Comprehensive Testing Suite
   ├── Unit tests for all 7 agents and risk rules.
   ├── Integration tests for HSKSwap router and quotes.
   ├── Simulation tests (slippage violation, stop-loss trigger, emergency pause).
   └── Frontend build validation and TypeScript verification.

PHASE 8: Hackathon Packaging & Demo Mode
   ├── Demo replay mode with interactive scenario launcher.
   ├── Complete documentation, architecture blueprints, and HSKSwap integration guide.
   └── Live demo walkthrough script.
```

---

## Detailed Phase Milestones

### Phase 1: Core Foundation & Infrastructure
- [x] Audit complete; verified HashKey Testnet RPC and HSKSwap contracts.
- [x] Initialize Python backend with `FastAPI`, `Pydantic v2`, `SQLAlchemy 2.0`, `aiosqlite`/`asyncpg`, `web3.py`.
- [x] Initialize Next.js frontend with Tailwind CSS, TypeScript strict mode, and high-density dark terminal theme.
- [x] Establish environment configuration `.env.example` with strict validation.
- [x] Implement database models: `User`, `Wallet`, `Agent`, `AgentRun`, `TradingStrategy`, `Opportunity`, `RiskPolicy`, `RiskDecision`, `Trade`, `Position`, `AuditLog`.

### Phase 2: HSKSwap & Market Intelligence Service
- [x] Build `backend/adapters/hskswap`:
  - `HSKSwapAdapter` with methods: `get_supported_tokens()`, `get_pools()`, `get_pool_state()`, `get_quote()`, `estimate_gas()`.
  - ABI definitions for Uniswap V3 Factory, Pool, SwapRouter02, QuoterV2, and ERC20 tokens.
- [x] Query live HashKey Testnet contracts for active pool reserves and token prices.
- [x] Cache normalized pricing and liquidity metrics with staleness checking (<30s).

### Phase 3: Autonomous Multi-Agent Architecture
- [x] Implement base `TradingAgent` abstract class with standardized telemetry:
  - Agent ID, Name, Description, Status (`IDLE`, `ANALYZING`, `SIGNAL_GENERATED`, `ERROR`), Performance metrics.
- [x] Implement Agent 1: `MarketIntelligenceAgent` (Pool depth, volume, spread anomaly detection).
- [x] Implement Agent 2: `ArbitrageAgent` (Multi-fee-pool price discrepancies, net profit after 0.3%/0.05% fee & gas, 4-tier taxonomy).
- [x] Implement Agent 3: `TechnicalAnalysisAgent` (RSI, MACD, EMA fast/slow cross, Bollinger Band breakouts, confidence score).
- [x] Implement Agent 4: `LiquidityAgent` (Market impact estimation, liquidity-depth threshold validation).
- [x] Implement Agent 5: `StrategyAgent` (Composite 0-100 scoring across 4 trading regimes).
- [x] Implement Agent 6: `RiskAgent` (13-rule Deterministic Risk Engine wrapper).
- [x] Implement Agent 7: `PortfolioAgent` (Position manager, exposure limits, SL/TP/Max hold, disk persistence).
- [x] Implement `AgentSupervisor` to schedule and execute coordinated agent cycles in topological order.

### Phase 4: Orchestration & Deterministic Risk Engine
- [x] Central Orchestrator:
  - Aggregate signals from intelligence and strategy agents.
  - Formulate structured `TradeOpportunity` candidates.
  - Pass candidates to `RiskEngine`.
- [x] Deterministic Risk Engine (13 Hard Risk Rules - NON-OVERRIDABLE by AI):
  - Rule 1: Max Trade Allocation (Default: 10% of portfolio capital).
  - Rule 2: Max Slippage (Default: 1.0%).
  - Rule 3: Max Daily Loss (Default: 3.0%).
  - Rule 4: Max Portfolio Drawdown (Default: 10.0%).
  - Rule 5: Max Concurrent Positions (Default: 3).
  - Rule 6: Allowed Token & Pair List (WHSK, USDT, USDC.e only).
  - Rule 7: Data Freshness Check (Price quotes < 30s old).
  - Rule 8: Trading Cooldown (Prevent high-frequency oscillation).
  - Rule 9: Stop-loss & Take-profit boundaries.
  - Rule 10: Global Emergency Pause Switch.
  - Rule 11: Market Data Staleness & Incomplete Liquidity Filter.
  - Rule 12: Net Arbitrage Profitability Guarantee (Min $0.50 net).
  - Rule 13: Max Portfolio & Single-Asset Exposure Limits (30% / 15%).
- [x] Implement `CapitalAllocator` to compute optimal position sizing.

### Phase 5: Execution Engine & Portfolio Accounting
- [x] Execution Engine:
  - Prepare `exactInputSingle` parameters for SwapRouter02.
  - Client-side transaction preparation for MetaMask signing via Wagmi/Viem.
  - Server-side testnet execution handler with Web3.py `TestnetSigner` (zero secret leakage, thread-safe nonce lock).
  - Transaction submission, mining confirmation, and receipt verification on HashKey Chain.
  - Partial failure unwinding for multi-step arbitrage routes.
- [x] Portfolio Tracker:
  - Reconcile on-chain token balances against internal ledger.
  - Track open positions, mark-to-market valuations, unrealized and realized P&L.
  - Automated exit triggers: SL (-3%), TP (+5%), Max Holding (3600s).
  - Testnet gating: Never close live positions without explicit user approval and confirmed tx receipt.
  - Disk persistence (`data/portfolio_state.json`) and backend reboot recovery.

### Phase 6: User Experience & Trading Terminal UI
- [x] Design and implement high-density, professional dark terminal:
  - **Overview Dashboard**: AUM ticker, 24h P&L sparkline, Active Positions summary, Network status badge, Testnet Signer station, Decision Audit Trace.
  - **Agent Control Center**: Grid of 7 agents with live status LEDs, toggle switches, latest logs, and confidence meters.
  - **Trading Terminal**: Live token pair selector, interactive charting, depth chart, signal matrix, manual trade form with risk pre-validation.
  - **Portfolio Manager**: Table of active and past positions, entry/exit prices, stop-loss markers, realized P&L, holding duration, exit reason badges.
  - **Risk Center**: Live risk limit controls, emergency pause toggle, and rejected trade audit log with human-readable violation reasons.
  - **AI Assistant**: Natural language prompt box with suggested queries, intent breakdown card, and confirmation dialog for parameter changes.
  - **Quantitative Validation Dashboard**: Backtest runner with train/test split, CSV/JSON import, persistent forward testing, equity/drawdown curves, and observability cost decomposition.
- [x] WebSocket streaming client for live real-time updates.

### Phase 7: Quantitative Validation & Testing Suite
- [x] Unit tests for technical indicators, 7 agents, and 13 deterministic risk rules.
- [x] HSKSwap on-chain quote and swap encoding tests.
- [x] Arbitrage 4-tier taxonomy and net profitability formula tests.
- [x] Look-ahead bias and data leakage prevention verification.
- [x] Multi-step arbitrage partial failure recovery tests.
- [x] Testnet live position gating and exit proposal tests.
- [x] End-to-end simulated trading workflow and restart recovery tests.
- [x] 59/59 pytest test suite passed (100% pass rate).

### Phase 8: Hackathon Demo & Delivery
- [x] Demo replay mode for judges (runs full live cycle or scripted testnet scenario).
- [x] Comprehensive documentation: Architecture, Technical Decisions, HSKSwap integration, Demo walkthrough.
- [x] Phase 2 Autonomous Intelligence Report and Phase 3 Quantitative Validation Report.

### Phase 9: Live Market Validation & Strategy Performance Monitoring (Phase 4 Prompt)
- [x] Persistent Market Observation Collector (`MarketObservationCollector`):
  - On-chain sampling of 5 HSKSwap V3 pools (`WHSK/USDT` across 500, 3000, 10000; `WHSK/USDC.e` across 500, 3000).
  - Captures pair, pool address, fee tier, timestamp, spot price, QuoterV2 quote, active liquidity, gas price, estimated gas cost, price impact, quote freshness.
  - Enforced deduplication on `(pool_address, timestamp)` and telemetry tracking.
  - Zero fabrication of missing data during RPC dropouts or restarts.
- [x] Seven-Day Continuous Forward Paper-Testing Experiment:
  - Formally configured for 604,800 seconds (168 hours) with real HSKSwap Testnet quotes.
  - Persistent portfolio state and equity curve tracking with restart recovery.
  - System interruptions recorded with exact downtime duration and missed intervals.
- [x] Arbitrage Mathematical Audit Enhancement:
  - Safe zero-loss profit factor calculation (returns 999.0 without `ZeroDivisionError`).
  - Two-leg gas cost accounting ($560k$ gas across 2 swap legs).
  - Clean separation of price impact and slippage buffer (no double-counting).
  - Token decimal normalization (WHSK 18 vs USDT 6).
  - Intermediate token exposure risk monitored (`1-3s` block time delta).
  - Failed second-leg emergency unwinding safeguard.
- [x] Independent Per-Strategy Performance Tracking:
  - Tracked independently for each of the 4 strategies + combined portfolio.
  - Metrics: Detected, Rejected, Executed, Win Rate, Gross Profit, Net Profit, Costs, Profit Factor, Max Drawdown, Sharpe, Avg Hold Time, Avg Slippage.
  - Strict separation of synthetic backtest data from live-market forward test data.
- [x] Execution Reliability & Telemetry:
  - Market data uptime %, RPC failure rate %, quote failure rate %, stale quote rejections, missed observations count.
- [x] Live Market Validation Dashboard:
  - 10 required features integrated with prominent data provenance badges (`SYNTHETIC BACKTEST`, `LIVE-MARKET PAPER TEST`, `REAL TESTNET EXECUTION`).
- [x] Validation Test Suite:
  - 10 comprehensive tests in `tests/test_live_market_validation.py` covering all edge cases.
- [x] Final Validation Report:
  - Documented in `phase_4_live_market_validation_report.md`.
