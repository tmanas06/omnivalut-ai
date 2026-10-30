# OmniVault AI - Hackathon Demonstration Script

**Target Hackathon:** HSK Chain India Hackathon  
**Primary Track:** AI Agent Trading  
**Network:** HashKey Chain Testnet (Chain ID: 133)  
**Primary DEX:** HSKSwap ([https://app.hskswap.com/?lng=en-US](https://app.hskswap.com/?lng=en-US))  

---

## 1. Quick Start Guide for Judges

### Option A: Local Dev Execution (Recommended - Fastest)
```bash
# 1. Start the Backend API (FastAPI + SQLite + WebSockets)
source .venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000

# 2. In a second terminal, start the Frontend Dashboard (Next.js)
cd frontend
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Option B: Automated Headless CLI Demo
To run the automated verification script demonstrating all 5 core hackathon evaluation scenarios:
```bash
.venv/bin/python scripts/demo_scenario.py
```

---

## 2. Walkthrough Script for Live Judging

### Step 1: Wallet Connection to HashKey Testnet
1. Open the OmniVault AI dashboard at `http://localhost:3000`.
2. Click **Connect MetaMask** in the top right navigation bar.
3. If MetaMask is on another network, the app automatically prompts to switch to **HashKey Chain Testnet** (`Chain ID: 133`, `RPC: https://testnet.hsk.xyz`, `Currency: HSK`).
4. Upon connection, notice:
   - Your wallet address is formatted in the header.
   - Your native **HSK gas balance** is read directly on-chain and displayed.
   - The status badge pulses green: `HashKey 133 [ONLINE]`.

### Step 2: Continuous Multi-Agent Market Surveillance
1. Navigate to the **Agent Control** tab.
2. Review the 4 analytical agents running in parallel:
   - **Market Intelligence Agent:** Continuously queries HSKSwap on-chain pool reserves (`0xc076fb478b77633736738579c7f48d2539604a50`) and monitors rolling price volatility.
   - **Arbitrage Agent:** Compares executable quotes across fee tiers (0.05% vs 0.30%) and calculates net profit after deducting pool swap fees, estimated gas, and slippage.
   - **Technical Analysis Agent:** Computes 14-period RSI, MACD histogram, EMA 9/21 cross, and Bollinger Bands over live candles.
   - **Liquidity & Depth Agent:** Audits pool reserves and constructs slippage impact curves.
3. Toggle any agent OFF and ON using the toggle switch to show dynamic supervisor lifecycle management.

### Step 3: Trading Terminal & Institutional Order Book
1. Navigate to the **Trading Terminal** tab.
2. Select **WHSK / USDT (0.3% Pool)** or **WHSK / USDC.e (0.05% Pool)**.
3. Observe:
   - Live interactive price area chart powered by Recharts.
   - Real-time technical indicator scorecard (RSI, MACD, Bollinger Bandwidth, Volume Surge).
   - Order panel with trade size slider and real-time quote preview (`SwapRouter02`).

### Step 4: Deterministic Risk Management (Core Architecture Feature)
1. **The Core Philosophy:** In OmniVault AI, **AI models may propose trades, but they can NEVER bypass deterministic code.**
2. Navigate to the **Risk Center** tab.
3. Review the 10 hardcoded rules:
   - Max Trade Allocation (Default: 10% of equity)
   - Max Slippage (Default: 1.0%)
   - Max Daily Loss (Default: 3.0%)
   - Max Drawdown (Default: 10.0%)
   - Max Concurrent Positions (Default: 3)
   - Token & Venue Allowlists
   - Trading Cooldown
   - Emergency Circuit Breaker
4. **Demonstrating a Rejection:**
   - On the Trading Terminal, attempt to place an order that exceeds your allocation or configure slippage to 0.1%.
   - Notice the trade is **instantly rejected** with an explicit violation code (`SLIPPAGE_EXCEEDED` or `ALLOCATION_EXCEEDED`).
   - The rejection is permanently preserved in the **Rejected Proposals Audit Log** with a correlation ID.

### Step 5: Trade Execution & Portfolio Reconciliation
1. Submit an approved compliant trade (e.g. Buy $50 WHSK).
2. The trade executes cleanly via `SwapRouter02`:
   - In **Paper Trading Mode**, the exact pool quote, 0.3% fee, and gas are accounted for with `is_simulated = true`.
   - In **Testnet Execution Mode**, the transaction is signed and broadcasted to HashKey Testnet.
3. Navigate to the **Portfolio** tab:
   - The open position appears immediately with entry price, mark price, stop-loss target (-1.5%), and take-profit target (+3.5%).
   - Unrealized P&L updates dynamically as market ticks occur.

### Step 6: Natural Language Conversational Trading Interface
1. Navigate to the **AI Assistant** tab.
2. Click on the suggestion pills or type:
   - *"What's my current profit and loss?"* -> Assistant summarizes total portfolio value and P&L.
   - *"Show my open positions"* -> Assistant lists current positions with entry prices.
   - *"Reduce my maximum trade allocation to 5%"* -> Assistant detects a financial policy change, parses the intent, and displays an **Explicit Confirmation Modal** before modifying risk parameters.
   - *"Pause all new trades"* -> Assistant proposes activating the emergency circuit breaker with confirmation.

---

## 3. Verified HashKey Testnet Contract References

| Entity | Address |
|---|---|
| **V3 Core Factory** | `0x2dC2c21D1049F786C535bF9d45F999dB5474f3A0` |
| **SwapRouter02** | `0xa6914E66690c6794244B5f66a09eAEbf66254237` |
| **QuoterV2** | `0x73820d9eE5Bf1BfcD429580320FC7A374E8fa1cC` |
| **Wrapped HSK (WHSK)** | `0xCA8aAceEC5Db1e91B9Ed3a344bA026c4a2B3ebF6` |
| **Tether USD (USDT)** | `0x98B6173A8B7DFc52ce8bc88f1184a918A1CCaa4F` |
| **Bridged USDC (USDC.e)** | `0x18Ec8e93627c893ae61ae0491c1C98769FD4Dfa2` |
| **WHSK/USDT 0.3% Pool** | `0xc076fb478b77633736738579c7f48d2539604a50` |
| **Block Explorer** | [https://hashkey.blockscout.com](https://hashkey.blockscout.com) |
