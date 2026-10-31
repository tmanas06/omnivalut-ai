# OmniVault AI: Backend Testnet Signer Integration & Verification Report

**Target Network:** HashKey Chain Testnet  
**Chain ID:** `133` (RPC: `https://testnet.hsk.xyz`)  
**Mainnet Protection:** Hard-coded `ENABLE_MAINNET=false` & `MainnetExecutionBlockedError` active  
**Execution Environment:** Python 3.8 / FastAPI / Web3.py / Next.js 16  

---

## 1. Files Created or Modified

| Component | Path | Action | Description |
| :--- | :--- | :--- | :--- |
| **Backend Signer** | [`backend/execution/signer.py`](file:///home/manas/Desktop/omnivalut-ai/backend/execution/signer.py) | **Created** | Dedicated EVM backend signer using Web3.py & eth-account, thread-safe lazy `nonce_lock`, gas sufficiency validation, receipt monitoring, and regex secret redaction. |
| **Execution Agent** | [`backend/execution/executor.py`](file:///home/manas/Desktop/omnivalut-ai/backend/execution/executor.py) | **Modified** | Integrated `TestnetSigner`, added strict `PAPER`/`TESTNET`/blocked `MAINNET` execution separation, token wrap/approval automation, and post-trade balance reconciliation. |
| **DEX Adapter** | [`backend/adapters/hskswap/adapter.py`](file:///home/manas/Desktop/omnivalut-ai/backend/adapters/hskswap/adapter.py) | **Modified** | Updated `get_quote()` to execute real on-chain `QuoterV2.quoteExactInputSingle()` calls with math fallback. |
| **Protocol Constants** | [`backend/adapters/hskswap/constants.py`](file:///home/manas/Desktop/omnivalut-ai/backend/adapters/hskswap/constants.py) | **Modified** | Added `TESTNET_MULTICALL` alias and verified token/contract addresses. |
| **API Endpoints** | [`backend/api/routes.py`](file:///home/manas/Desktop/omnivalut-ai/backend/api/routes.py) | **Modified** | Added `/api/signer/status`, `/api/signer/execution-mode`, `/api/contracts/verify`, `/api/trades/prepare-testnet-swap`, and `/api/trades/execute-testnet-swap`. |
| **Frontend API** | [`frontend/src/lib/api.ts`](file:///home/manas/Desktop/omnivalut-ai/frontend/src/lib/api.ts) | **Modified** | Added client functions for signer status, execution mode, contract verification, and swap workflows. |
| **Frontend Navbar** | [`frontend/src/components/Navbar.tsx`](file:///home/manas/Desktop/omnivalut-ai/frontend/src/components/Navbar.tsx) | **Modified** | Added prominent pulsing **TESTNET** badge, live backend signer address chip, HSK balance, and mode indicator. |
| **Frontend Dashboard** | [`frontend/src/components/OverviewDashboard.tsx`](file:///home/manas/Desktop/omnivalut-ai/frontend/src/components/OverviewDashboard.tsx) | **Modified** | Added interactive **HashKey Testnet Backend Signer & First Swap Verification Station** with on-chain contract checklist and 2-step trade approval. |
| **Testing Suite** | [`tests/test_signer.py`](file:///home/manas/Desktop/omnivalut-ai/tests/test_signer.py) | **Created** | Comprehensive unit test suite covering key validation, gas shortfall, chain ID mismatches, mainnet rejection, reverts, nonce conflicts, and secret redaction. |

---

## 2. Signer Implementation Details

[`TestnetSigner`](file:///home/manas/Desktop/omnivalut-ai/backend/execution/signer.py) was built and audited with the following security and operational guarantees:

1. **Zero Secret Leakage:**
   - The private key is loaded strictly from environment memory into an internal `_private_key` attribute.
   - It is **never** printed, logged, serialized in JSON, or returned in any API response or error string.
   - Built-in `redact_secrets()` regex sanitizer strips any 64-character hex strings from log outputs.
2. **Deterministic Nonce Management:**
   - Synchronizes with on-chain pending transaction count (`w3.eth.get_transaction_count(address, 'pending')`).
   - Protected by a thread-safe / asyncio `nonce_lock` to prevent concurrency collisions.
   - Auto-recovers on "replacement underpriced" / "nonce too low" errors via `resync_nonce()`.
3. **Pre-Flight Gas Sufficiency Check:**
   - Estimates gas limit with a 25% safety buffer.
   - Validates that `wallet_balance >= value + (gas_limit * gas_price)` before signing.
   - Raises `InsufficientFundsForGasError` with exact shortfall if balance is inadequate.
4. **Receipt Confirmation & Monitoring:**
   - Signs transaction offline via `w3.eth.account.sign_transaction`.
   - Broadcasts via `w3.eth.send_raw_transaction` and monitors confirmation via `wait_for_transaction_receipt`.
   - Inspects `receipt.status == 1`; raises `TransactionRevertedError` if status is `0`.

---

## 3. Derived Public Wallet Address

- **Derived Public Address:**  
  `0x64F6dB6Cb2e579CA76AdD913e063FB9407F7F7d8`
- **Derivation Method:**  
  EVM secp256k1 public key derivation and Keccak-256 hash checksummed address from the provided `TESTNET_SIGNER_PRIVATE_KEY`.
- **Match Verification:**  
  Please verify that `0x64F6dB6Cb2e579CA76AdD913e063FB9407F7F7d8` matches the dedicated MetaMask account address created for OmniVault.

---

## 4. Chain ID Verification Result

- **Connected RPC URL:** `https://testnet.hsk.xyz`
- **Observed `eth_chainId`:** `133` (Hex: `0x85`)
- **Configured Target Chain ID:** `133`
- **Result:** **PASSED (100% Match)**
- **Latest On-Chain Block:** `35,102,680+`

---

## 5. Wallet Native HSK & Token Balances

Queried directly on HashKey Chain Testnet for address `0x64F6dB6Cb2e579CA76AdD913e063FB9407F7F7d8`:

| Asset | Contract Address | Decimals | On-Chain Balance | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Native HSK** | Native gas token | 18 | **0.1000 HSK** (`100,000,000,000,000,000` wei) | **Sufficient for ~100+ swaps** ✅ |
| **WHSK** | `0xCA8aAceEC5Db1e91B9Ed3a344bA026c4a2B3ebF6` | 18 | **0.0000 WHSK** | Automated wrapping ready ✅ |
| **USDT** | `0x98B6173A8B7DFc52ce8bc88f1184a918A1CCaa4F` | 18 | **0.0000 USDT** | Ready to receive swap output ✅ |

> [!NOTE]
> The wallet has 0.1 native HSK. When initiating the first swap of 0.01 WHSK → USDT, the system automatically wraps 0.01 native HSK into WHSK via `deposit()` and approves `SwapRouter02` before swap execution.

---

## 6. On-Chain Contract Verification Results

Bytecode queries executed via `w3.eth.get_code()` on HashKey Testnet:

| Contract Name | Configured Address | Bytecode Size | ABI Verified | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **UniswapV3Factory** | `0x2dC2c21D1049F786C535bF9d45F999dB5474f3A0` | 24,535 bytes | `getPool(tokenA, tokenB, fee)` | **VERIFIED DEPLOYED** ✅ |
| **SwapRouter02** | `0xa6914E66690c6794244B5f66a09eAEbf66254237` | 24,497 bytes | `exactInputSingle`, `multicall`, `WETH9` | **VERIFIED DEPLOYED** ✅ |
| **QuoterV2** | `0x73820d9eE5Bf1BfcD429580320FC7A374E8fa1cC` | 8,273 bytes | `quoteExactInputSingle` | **VERIFIED DEPLOYED** ✅ |
| **Multicall** | `0x47F625Ec29637445AA1570d7008Cf78692CdA096` | 1,383 bytes | Multicall bytecode | **VERIFIED DEPLOYED** ✅ |
| **WHSK Token** | `0xCA8aAceEC5Db1e91B9Ed3a344bA026c4a2B3ebF6` | 3,143 bytes | `deposit()`, `approve()`, `balanceOf()` | **VERIFIED DEPLOYED** ✅ |
| **USDT Token** | `0x98B6173A8B7DFc52ce8bc88f1184a918A1CCaa4F` | 1,814 bytes | `decimals()=18`, `balanceOf()`, `approve()` | **VERIFIED DEPLOYED** ✅ |
| **WHSK/USDT Pool** | `0xc076FB478b77633736738579c7f48D2539604a50` | Pool 3000 fee | Active Liquidity: `3,231,210,257,071,971,233,662` | **ACTIVE LIQUIDITY** ✅ |

---

## 7. QuoterV2 On-Chain Test Results

Direct `eth_call` queries to `QuoterV2.quoteExactInputSingle`:

### Test A: 0.01 WHSK → USDT (Fee Tier: 3000 / 0.3%)
- **Input:** `10,000,000,000,000,000` wei (0.01 WHSK)
- **Quoted Output (`amountOut`):** `540,222,862,072,426,316` wei (**0.540223 USDT**)
- **SqrtPriceX96After:** `10763304209649750455875929376`
- **Estimated Gas:** `82,271 gas`
- **Effective Price:** `$54.022 USDT / WHSK`
- **Result:** **PASSED**

### Test B: 0.50 USDT → WHSK (Fee Tier: 3000 / 0.3%)
- **Input:** `500,000,000,000,000,000` wei (0.5 USDT)
- **Quoted Output (`amountOut`):** `9,199,588,369,689,456` wei (**0.009200 WHSK**)
- **Estimated Gas:** `74,680 gas`
- **Result:** **PASSED**

---

## 8. Deterministic Risk Engine Integration Results

The controlled test swap (`0.01 WHSK → USDT`) was passed through all 10 non-negotiable risk rules:

| # | Risk Rule | Evaluated Value | Limit / Threshold | Result |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Emergency Pause Circuit Breaker | `False` | Must be inactive | **PASSED** ✅ |
| **2** | Token Allowlist | `WHSK`, `USDT` | In `["WHSK", "USDT", "USDC.e", "HSK"]` | **PASSED** ✅ |
| **3** | Protocol / Venue Allowlist | `HSKSwap V3 (Fee: 3000)` | Matches `protocol_allowlist` | **PASSED** ✅ |
| **4** | Max Trade Allocation | `0.054%` ($0.54 / $1,000) | Ceiling: `10.0%` | **PASSED** ✅ |
| **5** | Max Slippage Tolerance | `0.05%` impact | Ceiling: `1.0%` | **PASSED** ✅ |
| **6** | Max Daily Loss Limit | `0.00%` | Ceiling: `3.0%` | **PASSED** ✅ |
| **7** | Max Portfolio Drawdown | `0.00%` | Ceiling: `10.0%` | **PASSED** ✅ |
| **8** | Max Concurrent Positions | `0` open positions | Ceiling: `3` | **PASSED** ✅ |
| **9** | Max Gas Fee Cost | `< $0.001` (82,271 gas) | Ceiling: `$2.50` | **PASSED** ✅ |
| **10** | Trading Cooldown Delay | Elapsed > 120s | Minimum: `120s` | **PASSED** ✅ |

**Overall Risk Engine Verdict:** **APPROVED (`ALL_RULES_PASSED`)**

---

## 9. Backend & Signer Test Results

Full pytest execution command:
```bash
.venv/bin/pytest tests/ -v
```

**Results:** **32 PASSED out of 32 tests (100% Pass Rate)**
- `tests/test_signer.py`: **14 passed**
  - `test_missing_private_key`: PASSED
  - `test_invalid_private_key`: PASSED
  - `test_derived_public_address`: PASSED
  - `test_incorrect_chain_id_rejection`: PASSED
  - `test_mainnet_execution_rejection`: PASSED
  - `test_rpc_connection_failure`: PASSED
  - `test_insufficient_gas_rejection`: PASSED
  - `test_invalid_contract_address`: PASSED
  - `test_risk_stale_quote_rejection`: PASSED
  - `test_risk_excessive_slippage_rejection`: PASSED
  - `test_risk_emergency_pause_halt`: PASSED
  - `test_transaction_revert_handling`: PASSED
  - `test_nonce_conflict_resync`: PASSED
  - `test_private_key_redaction`: PASSED
- `tests/test_risk_engine.py`: **7 passed**
- `tests/test_portfolio.py`: **4 passed**
- `tests/test_orchestrator.py`: **3 passed**
- `tests/test_agents.py`: **4 passed**

---

## 10. Frontend Build Results

Next.js Turbopack production build command:
```bash
npm --prefix frontend run build
```

**Result:**
```
▲ Next.js 16.4.3 (Turbopack)
✓ Compiled successfully in 3.6s
✓ Finished TypeScript in 2.9s
✓ Generating static pages using 5 workers (4/4)
Route (app)
┌ ○ /
└ ○ /_not-found
○ (Static) prerendered as static content
```
**Exit Code:** `0` (Zero compilation errors, zero TypeScript errors).

---

## 11. Live Testnet Swap Execution & Reconciliation

Following your explicit user approval, OmniVault AI successfully executed its first real on-chain swap sequence on HashKey Chain Testnet (`133`).

### On-Chain Transaction Audit

| Sequence Step | Operation | Transaction Hash | Block | Gas Used | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Wrap** | Wrap `0.01` native HSK to WHSK (`deposit`) | [`0xd16dff84a1f1ab69c426179b56902d1104c325e13df5b1d61b77194ad6987c44`](https://hashkey.blockscout.com/tx/0xd16dff84a1f1ab69c426179b56902d1104c325e13df5b1d61b77194ad6987c44) | `35103227` | `51,856` | **CONFIRMED** ✅ |
| **2. Approve** | Approve SwapRouter02 (`0xa691...`) on WHSK | [`0xf945493464a6def6a509e5e83d26d078fdcb82a719db2123d56554b63c6c5b15`](https://hashkey.blockscout.com/tx/0xf945493464a6def6a509e5e83d26d078fdcb82a719db2123d56554b63c6c5b15) | `35103228` | `46,573` | **CONFIRMED** ✅ |
| **3. Swap** | `exactInputSingle` (0.01 WHSK → USDT) | [`0xa09b21cde042af16c3f1b4f20f9d8bf02f92bb16deaa3938099bde600a24c925`](https://hashkey.blockscout.com/tx/0xa09b21cde042af16c3f1b4f20f9d8bf02f92bb16deaa3938099bde600a24c925) | `35103228` | `121,117` | **CONFIRMED** ✅ |

### Post-Trade Balance Reconciliation

| Asset | Balance Before | Balance After | Delta | Verification Note |
| :--- | :--- | :--- | :--- | :--- |
| **Native HSK** | `0.100000 HSK` | `0.089780 HSK` | `-0.010220 HSK` | 0.01 HSK wrapped + 0.00022 HSK total gas |
| **WHSK Token** | `0.000000 WHSK` | `0.000000 WHSK` | `0.000000 WHSK` | Wrapped 0.01 and swapped 0.01 |
| **USDT Token** | `0.000000 USDT` | `0.540223 USDT` | **`+0.540223 USDT`** | **100% matched QuoterV2 quote (`0.5402228620724263`)** |

> [!TIP]
> **Live Blockscout Transaction URL:**  
> [https://hashkey.blockscout.com/tx/0xa09b21cde042af16c3f1b4f20f9d8bf02f92bb16deaa3938099bde600a24c925](https://hashkey.blockscout.com/tx/0xa09b21cde042af16c3f1b4f20f9d8bf02f92bb16deaa3938099bde600a24c925)

