"""
HSKSwap Protocol Constants for HashKey Chain
"""

# Chain IDs
CHAIN_ID_HASHKEY_TESTNET = 133
CHAIN_ID_HASHKEY_MAINNET = 177

# HashKey Testnet (133) Contracts
TESTNET_FACTORY = "0x2dC2c21D1049F786C535bF9d45F999dB5474f3A0"
TESTNET_SWAP_ROUTER_02 = "0xa6914E66690c6794244B5f66a09eAEbf66254237"
TESTNET_QUOTER_V2 = "0x73820d9eE5Bf1BfcD429580320FC7A374E8fa1cC"
TESTNET_MULTICALL_2 = "0x47F625Ec29637445AA1570d7008Cf78692CdA096"
TESTNET_MULTICALL = TESTNET_MULTICALL_2
TESTNET_POSITION_MANAGER = "0x73dEc6bfa6751509b08480bd97f54b874E3b20e8"

# Testnet Tokens
TESTNET_WHSK = "0xCA8aAceEC5Db1e91B9Ed3a344bA026c4a2B3ebF6"
TESTNET_USDT = "0x98B6173A8B7DFc52ce8bc88f1184a918A1CCaa4F"
TESTNET_USDC = "0x18Ec8e93627c893ae61ae0491c1C98769FD4Dfa2"

# Fee Tiers (in hundredths of a bip, e.g. 3000 = 0.3%)
FEE_LOW = 500       # 0.05%
FEE_MEDIUM = 3000   # 0.30%
FEE_HIGH = 10000    # 1.00%

# Token Definitions
TOKENS = {
    133: {
        "HSK": {
            "symbol": "HSK",
            "name": "HashKey Platform Token",
            "address": "0x0000000000000000000000000000000000000000",
            "decimals": 18,
            "is_native": True,
        },
        "WHSK": {
            "symbol": "WHSK",
            "name": "Wrapped HSK",
            "address": TESTNET_WHSK,
            "decimals": 18,
            "is_native": False,
        },
        "USDT": {
            "symbol": "USDT",
            "name": "Tether USD",
            "address": TESTNET_USDT,
            "decimals": 18,
            "is_native": False,
        },
        "USDC.e": {
            "symbol": "USDC.e",
            "name": "Bridged USDC",
            "address": TESTNET_USDC,
            "decimals": 6,
            "is_native": False,
        },
    }
}

# Known Testnet Pools
POOLS_TESTNET = {
    "WHSK/USDT:3000": "0xc076fb478b77633736738579c7f48d2539604a50",
    "WHSK/USDT:500": "0xff2b7e501c870980bf5641b4a70d0f9fb0f6f6ab",
    "WHSK/USDT:10000": "0xecb84943b34b31a0ead637d073bf6ab891c277fc",
}
