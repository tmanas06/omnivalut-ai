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
- [ ] Initialize Python backend with `FastAPI`, `Pydantic v2`, `SQLAlchemy 2.0`, `aiosqlite`/`asyncpg`, `web3.py`.
- [ ] Initialize Next.js frontend with Tailwind CSS, TypeScript strict mode, and high-density dark terminal theme.
- [ ] Establish environment configuration `.env.example` with strict validation.
- [ ] Implement database models: `User`, `Wallet`, `Agent`, `AgentRun`, `TradingStrategy`, `Opportunity`, `RiskPolicy`, `RiskDecision`, `Trade`, `Position`, `AuditLog`.

### Phase 2: HSKSwap & Market Intelligence Service
- [ ] Build `backend/adapters/hskswap`:
  - `HSKSwapAdapter` with methods: `get_supported_tokens()`, `get_pools()`, `get_pool_state()`, `get_quote()`, `estimate_gas()`.
  - ABI definitions for Uniswap V3 Factory, Pool, SwapRouter02, QuoterV2, and ERC20 tokens.
- [ ] Query live HashKey Testnet contracts for active pool reserves and token prices.
- [ ] Cache normalized pricing and liquidity metrics.

### Phase 3: Autonomous Multi-Agent Architecture
- [ ] Implement base `TradingAgent` abstract class with standardized telemetry:
  - Agent ID, Name, Description, Status (`IDLE`, `ANALYZING`, `SIGNAL_GENERATED`, `ERROR`), Performance metrics.
- [ ] Implement Agent 1: `MarketIntelligenceAgent` (Pool depth, volume, spread anomaly detection).
- [ ] Implement Agent 2: `ArbitrageAgent` (Multi-fee-pool price discrepancies, net profit after 0.3%/0.05% fee & gas).
- [ ] Implement Agent 3: `TechnicalAnalysisAgent` (RSI, MACD, EMA fast/slow cross, Bollinger Band breakouts, confidence score).
- [ ] Implement Agent 4: `LiquidityAgent` (Market impact estimation, liquidity-depth threshold validation).
- [ ] Implement `AgentSupervisor` to schedule and execute coordinated agent cycles.

### Phase 4: Orchestration & Deterministic Risk Engine
- [ ] Central Orchestrator:
  - Aggregate signals from intelligence and strategy agents.
  - Formulate structured `TradeOpportunity` candidates.
  - Pass candidates to `RiskEngine`.
- [ ] Deterministic Risk Engine (NON-OVERRIDABLE by AI):
  - Rule 1: Max Trade Allocation (Default: 10% of portfolio capital).
  - Rule 2: Max Slippage (Default: 1.0%).
  - Rule 3: Max Daily Loss (Default: 3.0%).
  - Rule 4: Max Portfolio Drawdown (Default: 10.0%).
  - Rule 5: Max Concurrent Positions (Default: 3).
  - Rule 6: Allowed Token & Pair List (WHSK, USDT, USDC.e only).
  - Rule 7: Data Freshness Check (Price quotes < 60s old).
  - Rule 8: Trading Cooldown (Prevent high-frequency oscillation).
  - Rule 9: Stop-loss & Take-profit boundaries.
  - Rule 10: Global Emergency Pause Switch.
- [ ] Implement `CapitalAllocator` to compute optimal position sizing.

### Phase 5: Execution Engine & Portfolio Accounting
- [ ] Execution Engine:
  - Prepare `exactInputSingle` parameters for SwapRouter02.
  - Client-side transaction preparation for MetaMask signing via Wagmi/Viem.
  - Server-side testnet execution handler for automated trading mode.
  - Transaction submission, mining confirmation, and receipt verification on HashKey Chain.
- [ ] Portfolio Tracker:
  - Reconcile on-chain token balances against internal ledger.
  - Track open positions, mark-to-market valuations, unrealized and realized P&L.
  - Win/loss ratio and Sharpe ratio estimators.

### Phase 6: User Experience & Trading Terminal UI
- [ ] Design and implement high-density, professional dark terminal:
  - **Overview Dashboard**: AUM ticker, 24h P&L sparkline, Active Positions summary, Network status badge.
  - **Agent Control Center**: Grid of 7 agents with live status LEDs, toggle switches, latest logs, and confidence meters.
  - **Trading Terminal**: Live token pair selector, interactive charting, depth chart, signal matrix, manual trade form with risk pre-validation.
  - **Portfolio Manager**: Table of active and past positions, entry/exit prices, stop-loss markers, realized P&L.
  - **Risk Center**: Live risk limit controls, emergency pause toggle, and rejected trade audit log with human-readable violation reasons.
  - **AI Assistant**: Natural language prompt box with suggested queries ("Buy $50 WHSK", "Show rejected trades", "Tighten stop loss to 2%"), intent breakdown card, and confirmation dialog.
- [ ] WebSocket streaming client for live real-time updates.

### Phase 7: Testing Suite
- [ ] Unit tests for technical indicators and agent logic.
- [ ] Deterministic risk engine test suite covering all 10 risk rules and edge cases.
- [ ] HSKSwap on-chain quote and swap encoding tests.
- [ ] End-to-end simulated trading workflow test.

### Phase 8: Hackathon Demo & Delivery
- [ ] Demo replay mode for judges (runs full live cycle or scripted testnet scenario).
- [ ] Comprehensive documentation: Architecture, Technical Decisions, HSKSwap integration, Demo walkthrough.
