# OmniVault AI - Technical Architecture & Engineering Decisions

**Target Hackathon:** HSK Chain India Hackathon (AI Agent Trading Track)  
**System:** OmniVault AI  

---

## 1. Context & Problem Statement

Designing an autonomous multi-agent decentralized exchange (DEX) trading system requires solving several non-trivial engineering challenges:
1. **Financial Determinism vs. AI Probabilism:** Generative AI models are stochastic. Allowing an LLM to generate or submit arbitrary transaction calldata or directly control wallet funds introduces critical risk of hallucination, loss of capital, and failure.
2. **Real DEX Constraints:** In automated trading, price impact, gas volatility, and front-running require precise slippage calculations, constant liquidity verification, and on-chain reconciliation.
3. **Hackathon Demonstrability:** The application must run cleanly both in a live connected state against HashKey Testnet and in an interactive replay/paper-trading mode if testnet faucet funds or network latency impede live demonstration.

---

## 2. Key Architecture Decisions

### ADR 01: Backend Framework Selection - FastAPI (Python)
- **Decision:** Use **FastAPI** with `asyncio`, `Pydantic v2`, and `uvicorn`.
- **Alternatives Considered:** NestJS (Node.js/TypeScript).
- **Rationale:**
  1. **Algorithmic Math & Technical Analysis:** Quantitative indicator calculations (RSI, MACD, Bollinger Bands, EMA crosses) are vastly superior, cleaner, and faster to implement and test in Python using standard vectorized operations.
  2. **Type Safety & Schema Validation:** Pydantic v2 provides ultra-fast C-extension validation for incoming agent telemetry and risk engine parameters.
  3. **Native Async Concurrency:** `asyncio` allows non-blocking execution of 7 independent trading agents running concurrent market scans and RPC calls.
  4. **AI & LLM Tooling:** Native compatibility with OpenRouter, OpenAI, and Anthropic standard formats.

### ADR 02: Persistence Strategy - Dual-Mode SQLAlchemy 2.0 (PostgreSQL + SQLite)
- **Decision:** Implement **SQLAlchemy 2.0 Async** supporting both **PostgreSQL** (`postgresql+asyncpg://`) and **SQLite** (`sqlite+aiosqlite:///./omnivault.db`).
- **Rationale:**
  - Production deployments use managed PostgreSQL for ACID transactions and concurrency.
  - Hackathon judges, contributors, or evaluators can boot the entire backend in 5 seconds with zero prerequisite docker/database setup using SQLite.
  - Zero code changes required between SQLite and PostgreSQL due to SQLAlchemy abstraction.

### ADR 03: Separation of AI Reasoning from Deterministic Risk Controls
- **Decision:** The **Risk Management Engine is strictly deterministic and hardcoded in pure code**.
- **Rule:** AI agents can propose trades, and the natural language interface can propose parameter adjustments. However, **no trade can be dispatched without passing all 10 mathematical risk rules**, and **no policy modification can take effect without explicit user confirmation**.
- **Rationale:** Financial safety. A hallucinated LLM prompt will never result in unauthorized trade sizes, extreme slippage, or trading non-allowlisted tokens.

### ADR 04: Blockchain Connectivity - Viem & Wagmi (Frontend) + Web3.py & JSON-RPC (Backend)
- **Decision:**
  - **Frontend:** Use `viem` and `wagmi` for MetaMask connection, HashKey Testnet switching, balance retrieval, and user transaction signing.
  - **Backend:** Use direct JSON-RPC and `web3.py` for pool state discovery, QuoterV2 price queries, and automated execution.
- **Network Defaults:**
  - HashKey Testnet: Chain ID `133`, RPC `https://testnet.hsk.xyz`, Native gas `HSK`.
  - Mainnet (Chain ID `177`) remains strictly disabled by default (`ENABLE_MAINNET=false`).

### ADR 05: HSKSwap Protocol Integration
- **Decision:** Interact directly with verified HSKSwap V3 contracts deployed on HashKey Testnet:
  - **Factory:** `0x2dC2c21D1049F786C535bF9d45F999dB5474f3A0`
  - **SwapRouter02:** `0xa6914E66690c6794244B5f66a09eAEbf66254237`
  - **QuoterV2:** `0x73820d9eE5Bf1BfcD429580320FC7A374E8fa1cC`
  - **Tokens:** WHSK (`0xCA8aAceEC5Db1e91B9Ed3a344bA026c4a2B3ebF6`), USDT (`0x98B6173A8B7DFc52ce8bc88f1184a918A1CCaa4F`), USDC.e (`0x18Ec8e93627c893ae61ae0491c1C98769FD4Dfa2`).
- **Rationale:** Avoids mock addresses or unverified interfaces. Uses the exact contracts deployed by the HashKey Chain core engineering team.

### ADR 06: Dual Execution Modes (Paper Trading & Testnet Execution)
- **Decision:** Provide an explicit `EXECUTION_MODE` toggle (`paper` vs `testnet`):
  - **Paper Trading:** Uses live or historical market prices to simulate order fills, deducting realistic 0.3% DEX fees and estimated gas, recording separate simulated positions without risking testnet funds.
  - **Testnet Execution:** Submits actual signed transactions to HashKey Testnet and verifies mined transaction hashes on the HashKey block explorer.
- **Safety:** Paper trading records are strictly separated in the database schema (`is_simulated = true`) and can never contaminate live wallet accounting.

### ADR 07: Professional Trading Terminal Aesthetics
- **Decision:** High-density dark theme inspired by institutional trading platforms (Bloomberg, Binance Pro).
- **Design Rules:**
  - Charcoal/slate dark background (`#0b0e14`, `#121824`).
  - Restrained semantic accents: Emerald `#10b981` (Profit/Buy/Approved), Crimson `#ef4444` (Loss/Sell/Rejected), Amber `#f59e0b` (Pending/Warning), Cyan `#06b6d4` (AI Agent telemetry).
  - Clear typography (Inter/Geist Mono for numerical precision).
  - High information density without decorative fluff.
