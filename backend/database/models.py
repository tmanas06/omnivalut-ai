import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Float,
    Integer,
    DateTime,
    ForeignKey,
    Text,
    JSON,
    Enum as SQLEnum,
    Index,
)
from sqlalchemy.orm import relationship
from backend.database.session import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    address = Column(String(42), unique=True, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    wallets = relationship("Wallet", back_populates="user", cascade="all, delete-orphan")
    risk_policies = relationship("RiskPolicy", back_populates="user", cascade="all, delete-orphan")
    trades = relationship("Trade", back_populates="user")
    positions = relationship("Position", back_populates="user")
    conversations = relationship("Conversation", back_populates="user")

class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    address = Column(String(42), unique=True, index=True, nullable=False)
    chain_id = Column(Integer, default=133, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    user = relationship("User", back_populates="wallets")
    transactions = relationship("Transaction", back_populates="wallet")

class Agent(Base):
    __tablename__ = "agents"

    id = Column(String(64), primary_key=True) # e.g. "agent_market_intelligence"
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(32), default="IDLE") # IDLE, RUNNING, PAUSED, ERROR
    execution_interval_seconds = Column(Integer, default=15)
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    total_runs = Column(Integer, default=0)
    total_opportunities_found = Column(Integer, default=0)
    is_enabled = Column(Boolean, default=True)
    error_state = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    runs = relationship("AgentRun", back_populates="agent", cascade="all, delete-orphan")
    configurations = relationship("AgentConfiguration", back_populates="agent", cascade="all, delete-orphan")

class AgentConfiguration(Base):
    __tablename__ = "agent_configurations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    agent_id = Column(String(64), ForeignKey("agents.id"), nullable=False)
    config_key = Column(String(64), nullable=False)
    config_value = Column(JSON, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    agent = relationship("Agent", back_populates="configurations")

class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    agent_id = Column(String(64), ForeignKey("agents.id"), nullable=False)
    correlation_id = Column(String(36), index=True, default=generate_uuid)
    status = Column(String(32), default="SUCCESS") # SUCCESS, FAILED
    duration_ms = Column(Integer, default=0)
    structured_output = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    agent = relationship("Agent", back_populates="runs")

class TradingStrategy(Base):
    __tablename__ = "trading_strategies"

    id = Column(String(64), primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    parameters = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    signals = relationship("TradingSignal", back_populates="strategy")

class TradingSignal(Base):
    __tablename__ = "trading_signals"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    strategy_id = Column(String(64), ForeignKey("trading_strategies.id"), nullable=True)
    correlation_id = Column(String(36), index=True, default=generate_uuid)
    pair = Column(String(32), nullable=False) # e.g. "WHSK/USDT"
    signal_type = Column(String(16), nullable=False) # BUY, SELL, HOLD
    timeframe = Column(String(16), default="1m")
    confidence = Column(Float, default=0.0)
    entry_price = Column(Float, nullable=False)
    stop_loss = Column(Float, nullable=True)
    take_profit = Column(Float, nullable=True)
    indicator_values = Column(JSON, default=dict)
    rationale = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    strategy = relationship("TradingStrategy", back_populates="signals")
    opportunities = relationship("Opportunity", back_populates="signal")

class Opportunity(Base):
    __tablename__ = "opportunities"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    correlation_id = Column(String(36), index=True, nullable=False)
    signal_id = Column(String(36), ForeignKey("trading_signals.id"), nullable=True)
    agent_id = Column(String(64), nullable=False)
    pair = Column(String(32), nullable=False)
    direction = Column(String(16), nullable=False) # BUY, SELL
    source_venue = Column(String(64), default="HSKSwap V3")
    target_venue = Column(String(64), nullable=True)
    quoted_price = Column(Float, nullable=False)
    estimated_price_impact_pct = Column(Float, default=0.0)
    estimated_gas_cost_usd = Column(Float, default=0.0)
    expected_net_profit_usd = Column(Float, default=0.0)
    status = Column(String(32), default="ANALYZING") # ANALYZING, RISK_CHECK, APPROVED, REJECTED, EXECUTED, FAILED
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    signal = relationship("TradingSignal", back_populates="opportunities")
    risk_decisions = relationship("RiskDecision", back_populates="opportunity")
    trades = relationship("Trade", back_populates="opportunity")

class RiskPolicy(Base):
    __tablename__ = "risk_policies"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    max_trade_allocation_pct = Column(Float, default=10.0) # 10%
    max_slippage_pct = Column(Float, default=1.0) # 1%
    max_daily_loss_pct = Column(Float, default=3.0) # 3%
    max_portfolio_drawdown_pct = Column(Float, default=10.0) # 10%
    max_concurrent_positions = Column(Integer, default=3)
    max_gas_cost_usd = Column(Float, default=5.0)
    token_allowlist = Column(JSON, default=lambda: ["WHSK", "USDT", "USDC.e"])
    protocol_allowlist = Column(JSON, default=lambda: ["HSKSwap V3"])
    data_freshness_seconds = Column(Integer, default=60)
    trading_cooldown_seconds = Column(Integer, default=120)
    emergency_pause_active = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="risk_policies")
    decisions = relationship("RiskDecision", back_populates="policy")

class RiskDecision(Base):
    __tablename__ = "risk_decisions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    correlation_id = Column(String(36), index=True, nullable=False)
    opportunity_id = Column(String(36), ForeignKey("opportunities.id"), nullable=True)
    policy_id = Column(String(36), ForeignKey("risk_policies.id"), nullable=True)
    is_approved = Column(Boolean, nullable=False)
    rule_evaluated = Column(String(64), nullable=False)
    violation_code = Column(String(64), nullable=True) # e.g. SLIPPAGE_EXCEEDED, MAX_ALLOCATION_EXCEEDED
    explanation = Column(Text, nullable=False)
    evaluated_parameters = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    opportunity = relationship("Opportunity", back_populates="risk_decisions")
    policy = relationship("RiskPolicy", back_populates="decisions")

class Trade(Base):
    __tablename__ = "trades"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    correlation_id = Column(String(36), index=True, nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    opportunity_id = Column(String(36), ForeignKey("opportunities.id"), nullable=True)
    pair = Column(String(32), nullable=False)
    side = Column(String(16), nullable=False) # BUY, SELL
    token_in = Column(String(42), nullable=False)
    token_out = Column(String(42), nullable=False)
    amount_in = Column(Float, nullable=False)
    amount_out = Column(Float, nullable=False)
    execution_price = Column(Float, nullable=False)
    fee_usd = Column(Float, default=0.0)
    gas_used = Column(Float, default=0.0)
    status = Column(String(32), default="SUBMITTED") # SUBMITTED, CONFIRMED, REVERTED
    is_simulated = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    user = relationship("User", back_populates="trades")
    opportunity = relationship("Opportunity", back_populates="trades")
    transactions = relationship("Transaction", back_populates="trade")
    position = relationship("Position", back_populates="trade")

class Position(Base):
    __tablename__ = "positions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    trade_id = Column(String(36), ForeignKey("trades.id"), nullable=True)
    pair = Column(String(32), nullable=False)
    side = Column(String(16), default="LONG")
    entry_price = Column(Float, nullable=False)
    current_price = Column(Float, nullable=False)
    quantity = Column(Float, nullable=False)
    stop_loss = Column(Float, nullable=True)
    take_profit = Column(Float, nullable=True)
    unrealized_pnl_usd = Column(Float, default=0.0)
    realized_pnl_usd = Column(Float, default=0.0)
    is_open = Column(Boolean, default=True)
    is_simulated = Column(Boolean, default=False)
    opened_at = Column(DateTime(timezone=True), default=utc_now)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="positions")
    trade = relationship("Trade", back_populates="position")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    correlation_id = Column(String(36), index=True, nullable=False)
    trade_id = Column(String(36), ForeignKey("trades.id"), nullable=True)
    wallet_id = Column(String(36), ForeignKey("wallets.id"), nullable=True)
    tx_hash = Column(String(66), unique=True, index=True, nullable=False)
    chain_id = Column(Integer, default=133)
    block_number = Column(Integer, nullable=True)
    from_address = Column(String(42), nullable=False)
    to_address = Column(String(42), nullable=False)
    status = Column(String(16), default="PENDING") # PENDING, SUCCESS, REVERTED
    gas_limit = Column(Integer, default=300000)
    gas_used = Column(Integer, nullable=True)
    gas_price_gwei = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    wallet = relationship("Wallet", back_populates="transactions")
    trade = relationship("Trade", back_populates="transactions")

class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    total_value_usd = Column(Float, nullable=False)
    cash_balance_usd = Column(Float, nullable=False)
    invested_value_usd = Column(Float, nullable=False)
    realized_pnl_usd = Column(Float, default=0.0)
    unrealized_pnl_usd = Column(Float, default=0.0)
    win_count = Column(Integer, default=0)
    loss_count = Column(Integer, default=0)
    is_simulated = Column(Boolean, default=False)
    timestamp = Column(DateTime(timezone=True), default=utc_now)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    correlation_id = Column(String(36), index=True, nullable=True)
    action = Column(String(64), nullable=False)
    actor = Column(String(64), default="SYSTEM")
    details = Column(JSON, default=dict)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    title = Column(String(100), default="Strategy Consultation")
    created_at = Column(DateTime(timezone=True), default=utc_now)

    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False)
    role = Column(String(16), nullable=False) # "user", "assistant", "system"
    content = Column(Text, nullable=False)
    parsed_intent = Column(JSON, nullable=True)
    requires_confirmation = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    conversation = relationship("Conversation", back_populates="messages")


class MarketObservation(Base):
    """
    Persistent on-chain market observation record.
    Tracks spot prices, QuoterV2 executable quotes, active liquidity, gas costs,
    and quote freshness across HashKey Testnet pools.
    """
    __tablename__ = "market_observations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    pair = Column(String(32), nullable=False, index=True)
    pool_address = Column(String(42), nullable=False, index=True)
    fee_tier = Column(Integer, nullable=False)
    timestamp = Column(Float, nullable=False, index=True)
    spot_price = Column(Float, nullable=False)
    executable_quote = Column(Float, nullable=False)
    active_liquidity = Column(String(64), nullable=False)
    gas_price_gwei = Column(Float, nullable=False)
    estimated_gas_cost_usd = Column(Float, nullable=False)
    price_impact_pct = Column(Float, nullable=False)
    quote_age_seconds = Column(Float, default=0.0)
    is_fresh = Column(Boolean, default=True)
    is_simulated = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class SystemInterruption(Base):
    """
    Records downtime or interruption events during live market experiments
    to guarantee honesty without inventing missing market observations.
    """
    __tablename__ = "system_interruptions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    interruption_type = Column(String(64), nullable=False)  # BACKEND_DOWNTIME, RPC_TIMEOUT, SHUTDOWN
    started_at = Column(Float, nullable=False)
    resumed_at = Column(Float, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    reason = Column(Text, nullable=True)
    missed_observations_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class Experiment(Base):
    """
    Phase 5: Persistent Trading Experiment.
    Maintains an immutable configuration snapshot and evaluation metrics.
    """
    __tablename__ = "experiments"

    id = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(32), default="CREATED")  # CREATED, RUNNING, PAUSED, STOPPED, COMPLETED
    immutable_config_snapshot = Column(JSON, nullable=False)
    metrics_summary = Column(JSON, default=dict)
    market_regimes_summary = Column(JSON, default=dict)
    is_baseline = Column(Boolean, default=False)
    data_provenance = Column(String(64), default="LIVE_MARKET_PAPER_TEST")
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    resumed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    recommendations = relationship("RiskRecommendation", back_populates="experiment", cascade="all, delete-orphan")


class RiskRecommendation(Base):
    """
    Phase 5: Walk-Forward Risk Parameter Recommendation.
    Requires explicit manual approval before risk limits can be updated.
    """
    __tablename__ = "risk_recommendations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    experiment_id = Column(String(64), ForeignKey("experiments.id"), nullable=False)
    parameter_name = Column(String(64), nullable=False)
    current_value = Column(Float, nullable=False)
    proposed_value = Column(Float, nullable=False)
    expected_improvement = Column(Text, nullable=False)
    sharpe_delta = Column(Float, default=0.0)
    max_drawdown_delta = Column(Float, default=0.0)
    walk_forward_efficiency = Column(Float, default=1.0)
    status = Column(String(32), default="PENDING_APPROVAL")  # PENDING_APPROVAL, APPROVED, REJECTED
    reason = Column(Text, nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    experiment = relationship("Experiment", back_populates="recommendations")


class TestnetTransactionRecord(Base):
    """
    On-chain transaction and execution tracking for the in-app Testnet Explorer.
    Captures live HashKey Chain transactions, gas analysis, and receipts.
    """
    __tablename__ = "testnet_transactions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tx_hash = Column(String(66), unique=True, index=True, nullable=False)
    chain_id = Column(Integer, default=133)
    block_number = Column(Integer, nullable=True)
    transaction_type = Column(String(32), default="SWAP")  # SWAP, APPROVE, EXIT, MULTI_STEP_ARBITRAGE
    pair = Column(String(32), nullable=True)
    token_in = Column(String(42), nullable=True)
    token_out = Column(String(42), nullable=True)
    amount_in = Column(Float, nullable=True)
    amount_out = Column(Float, nullable=True)
    effective_price = Column(Float, nullable=True)
    slippage_bps = Column(Float, default=0.0)
    from_address = Column(String(42), nullable=False)
    to_address = Column(String(42), nullable=False)
    status = Column(String(16), default="PENDING")  # PENDING, CONFIRMED, REVERTED
    gas_limit = Column(Integer, default=300000)
    gas_used = Column(Integer, nullable=True)
    gas_price_gwei = Column(Float, nullable=True)
    gas_cost_usd = Column(Float, nullable=True)
    gas_estimation_error_pct = Column(Float, default=0.0)
    latency_ms = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    explorer_url = Column(String(255), nullable=True)
    is_simulated = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

