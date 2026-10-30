# OmniVault AI - Repository Audit Report

**Date:** October 31, 2026  
**Auditor:** Senior Principal Architect & Web3 Systems Engineer  
**Target:** OmniVault AI Autonomous Multi-Agent DEX Trading System  
**Hackathon:** HSK Chain India Hackathon (Track: AI Agent Trading)  

---

## 1. Executive Summary

An exhaustive audit of the workspace `/home/manas/Desktop/omnivalut-ai` was conducted. The repository was found to be an empty directory with no pre-existing source files, build scripts, or legacy codebases. Consequently:
- There are no legacy bugs, broken dependencies, or outdated frameworks that need removal.
- A clean, cohesive, professional architecture can be created from scratch following strict engineering standards.
- Real on-chain connectivity to **HashKey Chain Testnet (Chain ID: 133)** and **HSKSwap V3 contracts** was verified prior to designing the system.

---

## 2. Environment & System Runtime Discovery

The host environment was thoroughly inspected for available toolchains, runtimes, and services:

| Component | Status | Version / Details | Assessment |
|---|---|---|---|
| **Node.js** | Available | v24.16.0 | Excellent modern LTS/Current node runtime |
| **npm** | Available | 11.13.0 | Modern package manager |
| **Python** | Available | 3.14.4 | Python runtime ready |
| **uv** | Available | 0.13.1 (x86_64) | Ultra-fast Python package & project manager |
| **Docker** | Available | 29.8.1 | Docker engine available for containerized services |
| **Git** | Initialized | Master/Main branch initialized | Version control active |

---

## 3. Blockchain & Ecosystem Investigation

### 3.1 HashKey Chain Verification
Direct JSON-RPC calls were executed against the official HashKey Testnet RPC:
- **RPC URL:** `https://testnet.hsk.xyz`
- **Chain ID:** `133` (Hex: `0x85`) - **CONFIRMED RESPONSIVE**
- **Current Block Number:** `35,098,455+`
- **Native Gas Token:** `HSK`
- **Testnet Explorer:** `https://hashkey.blockscout.com`

### 3.2 HSKSwap Protocol Contracts Investigation
Official package artifacts from `@hskswap/sdk-core@1.0.3` and `@hskswap/smart-order-router@1.0.4` (published by `l2ops-npm <l2ops@hashkey.cloud>`) were unpacked and analyzed. Contract bytecodes were verified directly against HashKey Testnet RPC.

**HashKey Testnet (Chain ID 133) Verified Contracts:**
- **Uniswap V3 Factory:** `0x2dC2c21D1049F786C535bF9d45F999dB5474f3A0`
- **SwapRouter02:** `0xa6914E66690c6794244B5f66a09eAEbf66254237` (48,996 bytes bytecode verified)
- **QuoterV2:** `0x73820d9eE5Bf1BfcD429580320FC7A374E8fa1cC` (16,548 bytes bytecode verified; `factory()` points to `0x2dC2c2...`)
- **Multicall2:** `0x47F625Ec29637445AA1570d7008Cf78692CdA096`
- **NonfungiblePositionManager:** `0x73dEc6bfa6751509b08480bd97f54b874E3b20e8`

**Verified Core Testnet Tokens:**
- **WHSK (Wrapped HSK):** `0xCA8aAceEC5Db1e91B9Ed3a344bA026c4a2B3ebF6` (18 decimals)
- **USDT (Tether USD):** `0x98B6173A8B7DFc52ce8bc88f1184a918A1CCaa4F` (18 decimals)
- **USDC.e (Bridged USDC):** `0x18Ec8e93627c893ae61ae0491c1C98769FD4Dfa2` (6 decimals)

**Verified Live On-Chain Pools:**
- **WHSK / USDT (Fee: 3000 = 0.3%):** `0xc076fb478b77633736738579c7f48d2539604a50` (Active liquidity: `0xaf2a0ce11f0d77ef7e`)
- **WHSK / USDT (Fee: 500 = 0.05%):** `0xff2b7e501c870980bf5641b4a70d0f9fb0f6f6ab` (Active liquidity: `0xec39c61a0cc9c4b2a6`)
- **WHSK / USDT (Fee: 10000 = 1.0%):** `0xecb84943b34b31a0ead637d073bf6ab891c277fc`

**HashKey Mainnet (Chain ID 177) Reference Contracts (Mainnet disabled by default):**
- **Factory:** `0x972cA9D1662F5e029cD18327D29026532E84c742`
- **SwapRouter02:** `0x2c16f75b95Cf1390c328aB70e2CEE7f4b80bD8F3`
- **QuoterV2:** `0x603f70466fDdbE3F238220B9a74FFF419a2BbFDD`
- **WHSK:** `0xB210D2120d57b758EE163cFfb43e73728c471Cf1`
- **USDT:** `0xF1B50eD67A9e2CC94Ad3c477779E2d4cBfFf9029`

---

## 4. Gap Analysis & Missing Components

To satisfy all hackathon and product vision criteria, the following sub-systems must be engineered:

1. **Backend Service (`backend/`):**
   - High-performance FastAPI server with async endpoints and WebSockets.
   - Database layer supporting PostgreSQL with SQLAlchemy 2.0 async and SQLite compatibility mode for quick evaluation.
   - Comprehensive multi-agent architecture with 7 distinct specialized agents:
     - Market Intelligence Agent
     - Arbitrage Agent
     - Technical Analysis Agent
     - Liquidity Agent
     - Deterministic Risk Engine
     - Execution Agent
     - Portfolio Agent
   - Central Orchestrator managing deterministic state transitions.
   - Natural language intent parser with OpenRouter LLM support and fallback parser.
   - Replay & paper-trading simulation engine with real-fee and slippage models.

2. **Frontend Service (`frontend/`):**
   - Next.js 14+ application with React, TypeScript, Tailwind CSS, Lucide icons, and Recharts.
   - Professional dark trading terminal theme (Bloomberg/Binance aesthetic, no generic AI styling).
   - Real-time portfolio tracking, P&L graphs, active positions, win/loss stats.
   - Agent Control Center with live status, toggles, run-history, and structured reasoning output.
   - Interactive Trading Terminal with live order book/pool depth, technical indicators, and signal badges.
   - Conversational AI Assistant supporting natural language strategy adjustments.
   - Risk Center displaying hard constraints, violation logs, and emergency kill switches.
   - Web3 Wallet connector configured for HashKey Testnet (Chain ID 133) with MetaMask.

3. **Smart Contracts & Testing Suite (`contracts/` & `tests/`):**
   - Mock test contracts for testing slippage, stop-loss, emergency pause, and trade reconciliation.
   - Complete unit and integration test suites for agents, risk rules, and execution workflows.

---

## 5. Risk Assessment

| Risk Category | Details | Mitigation |
|---|---|---|
| **DEX Liquidity Volatility** | Testnet pools may have intermittent liquidity | Implement liquidity checks, fallback simulation, and paper trading mode |
| **Unsigned Autonomous Execution** | Storing private keys on client or database | Separate execution into: (1) Client-signed MetaMask transactions, and (2) Optional isolated backend burner key with hard allowance bounds |
| **Hallucinated Calldata** | LLM generating arbitrary transaction payloads | The LLM never touches calldata. Pure deterministic builders encode calldata |
| **System Outage / RPC Failure** | Testnet RPC downtime or congestion | Exponential backoff, health probes, and automatic safety pause |
