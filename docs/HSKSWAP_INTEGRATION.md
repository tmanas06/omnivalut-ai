# HSKSwap Protocol Integration Guide

**Target Network:** HashKey Chain Testnet (Chain ID: 133) & HashKey Mainnet (Chain ID: 177)  
**Protocol:** HSKSwap (Uniswap V3 Architecture on HashKey Chain)  
**Official App:** [https://app.hskswap.com/?lng=en-US](https://app.hskswap.com/?lng=en-US)  
**Official Packages:** `@hskswap/sdk-core`, `@hskswap/smart-order-router`, `@hskswap/routing-api`  

---

## 1. Verified Contract Addresses

All addresses below have been extracted from official HSKSwap packages published by `l2ops-npm <l2ops@hashkey.cloud>` and verified against on-chain bytecode using the HashKey Testnet RPC (`https://testnet.hsk.xyz`).

### HashKey Testnet (Chain ID: 133)
| Contract | Address | On-Chain Status |
|---|---|---|
| **V3 Core Factory** | `0x2dC2c21D1049F786C535bF9d45F999dB5474f3A0` | Verified Deployed |
| **SwapRouter02** | `0xa6914E66690c6794244B5f66a09eAEbf66254237` | Verified Deployed (48.9 kB) |
| **QuoterV2** | `0x73820d9eE5Bf1BfcD429580320FC7A374E8fa1cC` | Verified Deployed (16.5 kB) |
| **Multicall2** | `0x47F625Ec29637445AA1570d7008Cf78692CdA096` | Verified Deployed |
| **NonfungiblePositionManager**| `0x73dEc6bfa6751509b08480bd97f54b874E3b20e8` | Verified Deployed |
| **TickLens** | `0x73942976823088508a2C6c8055DF71107DB1d8db` | Verified Deployed |

### Core Supported Testnet Tokens
| Token Symbol | Name | Contract Address | Decimals |
|---|---|---|---|
| **HSK** | Native Gas Token | Native Currency (18 decimals) | 18 |
| **WHSK** | Wrapped HSK | `0xCA8aAceEC5Db1e91B9Ed3a344bA026c4a2B3ebF6` | 18 |
| **USDT** | Tether USD | `0x98B6173A8B7DFc52ce8bc88f1184a918A1CCaa4F` | 18 |
| **USDC.e** | Bridged USDC | `0x18Ec8e93627c893ae61ae0491c1C98769FD4Dfa2` | 6 |

### Verified Testnet Liquidity Pools
| Pair | Fee Tier | Contract Address | Verified On-Chain |
|---|---|---|---|
| **WHSK / USDT** | 3000 (0.30%) | `0xc076fb478b77633736738579c7f48d2539604a50` | Active Liquidity Found |
| **WHSK / USDT** | 500 (0.05%) | `0xff2b7e501c870980bf5641b4a70d0f9fb0f6f6ab` | Active Liquidity Found |
| **WHSK / USDT** | 10000 (1.00%) | `0xecb84943b34b31a0ead637d073bf6ab891c277fc` | Initialized |

---

## 2. Smart Contract Interfaces & ABI Signatures

### 2.1 Uniswap V3 Factory
- **`getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)`**
  - Selector: `0x1698ee82`

### 2.2 SwapRouter02
- **`exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut)`**
  - Params Struct:
    ```solidity
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    ```
- **`exactOutputSingle(ExactOutputSingleParams calldata params) external payable returns (uint256 amountIn)`**
- **`WETH9() external view returns (address)`**
  - Points to `0xCA8aAceEC5Db1e91B9Ed3a344bA026c4a2B3ebF6` (Wrapped HSK).

### 2.3 QuoterV2
- **`quoteExactInputSingle(QuoteExactInputSingleParams memory params) public returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)`**
  - Params Struct:
    ```solidity
    struct QuoteExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint24 fee;
        uint160 sqrtPriceLimitX96;
    }
    ```

---

## 3. Integration Architecture in OmniVault AI

The integration is encapsulated in `backend/adapters/hskswap/`:
- **`adapter.py`**: High-level async interface implementing:
  - `get_supported_tokens()`
  - `get_trading_pairs()`
  - `get_pool_liquidity(token_a, token_b, fee)`
  - `get_token_price(token_symbol)`
  - `get_quote(token_in, token_out, amount_in, fee)`
  - `estimate_swap(token_in, token_out, amount_in, slippage_tolerance)`
  - `build_swap_transaction(token_in, token_out, amount_in, min_out, recipient)`
- **`abis.py`**: Exact JSON ABIs for Factory, Pool, SwapRouter02, QuoterV2, and ERC20.
- **`constants.py`**: HashKey Testnet & Mainnet contract addresses and token metadata.
