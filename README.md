# OmniVault AI

**Autonomous Multi-Agent DEX Trading System on HashKey Chain**  
**Target Hackathon:** HSK Chain India Hackathon  
**Primary Track:** AI Agent Trading  

---
faucet : https://faucet.hskchain.net/faucet
---

## 1. Product Vision & Architecture

OmniVault AI is an institutional-grade, autonomous multi-agent decentralized exchange (DEX) trading system designed natively for **HashKey Chain** and integrated directly with **HSKSwap** contracts.

Rather than relying on a single, opaque AI trading bot, OmniVault AI deploys a swarm of **specialized, autonomous agents** that collaborate across market intelligence, technical analysis, statistical arbitrage, and liquidity depth estimation.

### The Core Architectural Tenet
> **"AI agents may propose trades, but they must NEVER independently bypass deterministic risk controls."**

Every trade candidate traverses a strict finite state machine (FSM). Before execution, proposals are mathematically evaluated by an independent, non-overridable **Deterministic Risk Engine** enforcing 10 hard parameters.

---

## 2. Multi-Agent Ecosystem

```
USER DASHBOARD & NATURAL LANGUAGE INTERFACE
                   |
       CENTRAL AGENT SUPERVISOR
                   |
+------------------+------------------+
|                  |                  |
MARKET        ARBITRAGE       TECHNICAL
INTELLIGENCE  AGENT           ANALYSIS AGENT
AGENT         |               |
|             +-------+-------+
+-------------------->|
               LIQUIDITY AGENT
                      |
           CENTRAL ORCHESTRATOR
                      |
          DETERMINISTIC RISK ENGINE
          (10 Non-Negotiable Rules)
                      |
              CAPITAL ALLOCATOR
                      |
              EXECUTION ENGINE
                      |
             HSKSWAP SwapRouter02
                      |
           HASHKEY CHAIN (TESTNET 133)
                      |
              PORTFOLIO TRACKER
```

### Specialized Agents:
1. **Market Intelligence Agent (`agent_market_intelligence`):** Continuously monitors HSKSwap pools across fee tiers (0.05%, 0.30%, 1.00%), tracking volume, price velocity, and staleness (<30s).
2. **Arbitrage Agent (`agent_arbitrage`):** Evaluates multi-fee-tier pools, calculating true net profit strictly after deducting pool swap fees, estimated gas, and slippage using the 4-tier taxonomy.
3. **Technical Analysis Agent (`agent_technical_analysis`):** Calculates RSI (14), MACD (12/26/9), EMA 9/21 crosses, SMA 20/50, and Bollinger Bands (20, 2) to produce directional signals (`BUY`, `SELL`, `HOLD`).
4. **Liquidity Depth Agent (`agent_liquidity`):** Evaluates pool depth, calculates price impact curves, and enforces maximum allowable slippage limits.
5. **Strategy Synthesis Agent (`agent_strategy`):** Synthesizes composite scores (0–100) across 4 market regimes (Momentum, Mean Reversion, Cross-Tier Arb, Volatility Breakout).
6. **Deterministic Risk Agent (`agent_risk`):** Mathematically validates every trade candidate against 13 hardcoded rules (AI models cannot bypass these checks).
7. **Portfolio Agent (`agent_portfolio`):** Tracks balances, open positions, calculates realized & unrealized P&L, enforces exposure limits, and manages SL (-3%), TP (+5%), and max holding limits with disk persistence.

---

## 3. Verified HashKey Chain & HSKSwap Integration

All contract addresses below were verified directly against on-chain bytecode using the HashKey Testnet RPC:

- **HashKey Testnet RPC:** `https://testnet.hsk.xyz` (Chain ID: `133`)
- **Native Gas Token:** `HSK`
- **Block Explorer:** [https://hashkey.blockscout.com](https://hashkey.blockscout.com)
- **HSKSwap V3 Factory:** `0x2dC2c21D1049F786C535bF9d45F999dB5474f3A0`
- **HSKSwap SwapRouter02:** `0xa6914E66690c6794244B5f66a09eAEbf66254237` (48.9 kB bytecode verified)
- **HSKSwap QuoterV2:** `0x73820d9eE5Bf1BfcD429580320FC7A374E8fa1cC` (16.5 kB bytecode verified)
- **Wrapped HSK (WHSK):** `0xCA8aAceEC5Db1e91B9Ed3a344bA026c4a2B3ebF6` (18 decimals)
- **Tether USD (USDT):** `0x98B6173A8B7DFc52ce8bc88f1184a918A1CCaa4F` (18 decimals)
- **Bridged USDC (USDC.e):** `0x18Ec8e93627c893ae61ae0491c1C98769FD4Dfa2` (6 decimals)
- **Verified Active Pool (WHSK/USDT 0.3%):** `0xc076fb478b77633736738579c7f48d2539604a50`

---

## 4. Deterministic Risk Engine: 13 Non-Negotiable Rules

The Risk Engine operates outside the probabilistic LLM reasoning loop:

1. **Max Trade Allocation:** Default `10.0%` of portfolio equity.
2. **Max Slippage Ceiling:** Default `1.0%`.
3. **Max Daily Loss Limit:** Default `3.0%`.
4. **Max Portfolio Drawdown:** Default `10.0%`.
5. **Max Concurrent Positions:** Default `3`.
6. **Token Allowlist:** Restricts trading to verified contracts (`WHSK`, `USDT`, `USDC.e`, `HSK`).
7. **Protocol Allowlist:** Restricts interactions to verified HSKSwap V3 contracts.
8. **Data Freshness Check:** Rejects stale quotes older than 30 seconds.
9. **Trading Cooldown:** Enforces a 60-second cooldown between successive trades on the same pair.
10. **Emergency Circuit Breaker:** Global manual or automated killswitch that halts all execution.
11. **Market Data Freshness & Liquidity Check:** Rejects stale quotes and pools with zero active tick liquidity.
12. **Net Arbitrage Profitability Guarantee:** Rejects candidates unless expected net profit $\ge \$0.50$ after 2-leg DEX fees, gas, price impact, and slippage.
13. **Portfolio & Single-Asset Exposure Limits:** Max total invested capital capped at 30%; single-asset exposure capped at 15%.

---

## 5. Phase 3: Quantitative Validation & Reliability Suite

OmniVault AI features a full institutional quantitative reliability suite:
- **Arbitrage 4-Tier Taxonomy**: Differentiates `PRICE_DISCREPANCY` $\rightarrow$ `THEORETICAL_ARBITRAGE` $\rightarrow$ `EXECUTABLE_ARBITRAGE_ROUTE` $\rightarrow$ `CONFIRMED_COMPLETED_ARBITRAGE`.
- **Walk-Forward Backtesting Engine**: In-Sample (70%) vs Out-of-Sample (30%) chronological train/test split with zero look-ahead bias and realistic fees.
- **Data Import Interface**: Supports custom CSV and JSON OHLCV time-series imports.
- **Persistent Forward-Testing Engine**: Continuous paper trading over 24h, 7d, and 30d durations with live on-chain HSKSwap quotes, slippage tracking, and disk recovery.
- **Gated Testnet Live Position Exits**: Stop-loss and take-profit triggers on live TESTNET positions generate explicit user approval proposals; never marked closed without confirmed on-chain receipts.
- **100% Test Coverage**: 59 of 59 tests passing across unit, integration, and failure-mode suites.

---

## 5. Technology Stack

- **Frontend:** Next.js 14+ (App Router), React 18, TypeScript, Tailwind CSS, Lucide icons, Recharts.
- **Web3 / Blockchain:** Viem, Wagmi, MetaMask, Web3.py.
- **Backend:** FastAPI (Python 3.11+), Pydantic v2, SQLAlchemy 2.0 Async, aiosqlite / asyncpg, WebSockets.
- **AI / LLM:** OpenRouter-compatible JSON structured intent parser with deterministic rule-based fallback.

---

## 6. Quick Start & Execution

### Option 1: Local Development
```bash
# 1. Clone repository
git clone https://github.com/your-username/omnivalut-ai.git
cd omnivalut-ai

# 2. Setup Python Virtual Environment & Install Dependencies
uv venv .venv
source .venv/bin/activate
uv pip install -r backend/requirements.txt

# 3. Start the Backend API (FastAPI)
uvicorn backend.main:app --host 0.0.0.0 --port 8000

# 4. In a separate terminal, start the Frontend (Next.js)
cd frontend
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Option 2: Docker Compose
```bash
docker compose up --build
```

### Option 3: Automated CLI Hackathon Verification
To run the automated test suite demonstrating all 5 evaluation scenarios:
```bash
.venv/bin/python scripts/demo_scenario.py
```

---

## 7. Testing & Verification

Run the comprehensive unit and integration test suite:
```bash
.venv/bin/pytest tests/ -v
```

**Results:**
- `test_market_intelligence_agent` -> **PASSED**
- `test_arbitrage_agent` -> **PASSED**
- `test_technical_analysis_agent` -> **PASSED**
- `test_liquidity_agent` -> **PASSED**
- `test_risk_engine_default_policy` -> **PASSED**
- `test_risk_engine_rejects_emergency_pause` -> **PASSED**
- `test_risk_engine_rejects_untrusted_token` -> **PASSED**
- `test_risk_engine_rejects_excessive_allocation` -> **PASSED**
- `test_risk_engine_rejects_excessive_slippage` -> **PASSED**
- `test_risk_engine_rejects_max_concurrent_positions` -> **PASSED**
- `test_risk_engine_approves_compliant_trade` -> **PASSED**
- `test_portfolio_stop_loss_trigger` -> **PASSED**
- `test_portfolio_take_profit_trigger` -> **PASSED**
- `test_orchestrator_full_cycle` -> **PASSED**
- `test_orchestrator_rejects_excessive_slippage` -> **PASSED**
- `test_orchestrator_emergency_pause_halts_execution` -> **PASSED**
- `test_signer_missing_private_key` -> **PASSED**
- `test_signer_invalid_private_key` -> **PASSED**
- `test_signer_derived_public_address` -> **PASSED**
- `test_signer_incorrect_chain_id_rejection` -> **PASSED**
- `test_signer_mainnet_execution_rejection` -> **PASSED**
- `test_signer_insufficient_gas_rejection` -> **PASSED**
- `test_signer_transaction_revert_handling` -> **PASSED**
- `test_signer_nonce_conflict_resync` -> **PASSED**
- `test_signer_private_key_redaction` -> **PASSED**

**Total: 32 / 32 Unit & Integration Tests Passed (100%)**

---

## 8. Live HashKey Testnet Verification

- **Target Chain:** HashKey Chain Testnet (`133`)
- **Backend Signer Address:** `0x64F6dB6Cb2e579CA76AdD913e063FB9407F7F7d8`
- **First Verified Swap:** `0.01 WHSK` -> `0.540223 USDT` via SwapRouter02
- **Confirmed Transaction Hash:** [`0xa09b21cde042af16c3f1b4f20f9d8bf02f92bb16deaa3938099bde600a24c925`](https://hashkey.blockscout.com/tx/0xa09b21cde042af16c3f1b4f20f9d8bf02f92bb16deaa3938099bde600a24c925) (Block `35103228`)
- **Gas Used:** `121,117`
- **Actual Received:** `0.5402228620724263 USDT` (100% matched QuoterV2)

---

## 8. Documentation Index

- [docs/PROJECT_AUDIT.md](docs/PROJECT_AUDIT.md) — Comprehensive repository & system audit report.
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) — Detailed phase-by-phase implementation plan.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Complete system architecture, state machines, and sequence diagrams.
- [docs/TECHNICAL_DECISIONS.md](docs/TECHNICAL_DECISIONS.md) — Architecture Decision Records (ADRs).
- [docs/HSKSWAP_INTEGRATION.md](docs/HSKSWAP_INTEGRATION.md) — Contract addresses, ABIs, and swap mechanics.
- [docs/HACKATHON_DEMO_SCRIPT.md](docs/HACKATHON_DEMO_SCRIPT.md) — Step-by-step judge demonstration guide.
