import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    # App
    PROJECT_NAME: str = "OmniVault AI"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # HashKey Chain
    HSK_RPC_URL: str = "https://testnet.hsk.xyz"
    HSK_CHAIN_ID: int = 133
    ENABLE_MAINNET: bool = False
    HSK_MAINNET_RPC_URL: str = "https://mainnet.hsk.xyz"
    HSK_MAINNET_CHAIN_ID: int = 177

    # HSKSwap Testnet Contracts
    HSKSWAP_FACTORY_ADDRESS: str = "0x2dC2c21D1049F786C535bF9d45F999dB5474f3A0"
    HSKSWAP_ROUTER_ADDRESS: str = "0xa6914E66690c6794244B5f66a09eAEbf66254237"
    HSKSWAP_QUOTER_ADDRESS: str = "0x73820d9eE5Bf1BfcD429580320FC7A374E8fa1cC"
    HSKSWAP_MULTICALL_ADDRESS: str = "0x47F625Ec29637445AA1570d7008Cf78692CdA096"

    # Core Tokens
    TOKEN_WHSK_ADDRESS: str = "0xCA8aAceEC5Db1e91B9Ed3a344bA026c4a2B3ebF6"
    TOKEN_USDT_ADDRESS: str = "0x98B6173A8B7DFc52ce8bc88f1184a918A1CCaa4F"
    TOKEN_USDC_ADDRESS: str = "0x18Ec8e93627c893ae61ae0491c1C98769FD4Dfa2"

    # Execution Mode ('paper' or 'testnet')
    EXECUTION_MODE: str = "paper"
    TESTNET_SIGNER_PRIVATE_KEY: str = ""

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./omnivault.db"

    # AI
    LLM_PROVIDER: str = "openrouter"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "anthropic/claude-3.5-sonnet"
    LLM_BASE_URL: str = "https://openrouter.ai/api/v1"

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
