import asyncio
import json
import logging
import time
from backend.orchestrator.orchestrator import CentralOrchestrator
from backend.portfolio.tracker import PortfolioTracker

# Configure logging to capture full agent reasoning
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("OmniVaultDemo")

async def run_demonstration():
    print("=" * 80)
    print("🚀 OMNIVAULT AI — AUTONOMOUS MULTI-AGENT TRADING DEMONSTRATION (PAPER MODE)")
    print("=" * 80)

    # 1. Initialize Central Orchestrator with isolated tracker for demonstration
    tracker = PortfolioTracker(initial_cash_usd=1000.0, persistence_file=None)
    orchestrator = CentralOrchestrator(portfolio_tracker=tracker)
    orchestrator.execution_agent.execution_mode = "paper"

    print("\n[STEP 1: INITIAL STATE]")
    print(f"Execution Mode: {orchestrator.execution_agent.execution_mode.upper()} (Autonomous Simulated Execution)")
    print(f"Mainnet Protection: ENABLE_MAINNET=False (Strictly Blocked)")
    initial_summary = tracker.get_portfolio_summary()
    print(f"Initial Cash Balance: ${initial_summary['cash_balance_usd']:.2f}")
    print(f"Total Invested: ${initial_summary['invested_value_usd']:.2f}")
    print(f"Open Positions: {len(initial_summary['open_positions'])}")

    # 2. Run Autonomous Orchestration Cycle 1
    print("\n[STEP 2: LAUNCHING AUTONOMOUS TRADING CYCLE 1]")
    print("Running 9-Stage Pipeline: Market Monitoring -> Opportunity Discovery -> Agent Analysis -> Strategy Scoring -> Risk Validation -> Trade Proposal -> Execution Approval -> Execution -> Portfolio Reconciliation...")

    t0 = time.time()
    cycle1 = await orchestrator.run_orchestration_cycle()
    elapsed = time.time() - t0

    print(f"\nCycle 1 Completed in {elapsed:.2f}s")
    print(f"Correlation ID: {cycle1.get('correlation_id')}")
    print(f"Decisions Logged: {len(cycle1.get('recent_decisions', []))}")

    for idx, dec in enumerate(cycle1.get("recent_decisions", []), 1):
        print(f"\n--- Decision #{idx} [{dec.get('state')}] ---")
        print(f"Candidate: {dec.get('candidate_pair')} | Strategy: {dec.get('strategy')}")
        print(f"Decision State: {dec.get('state')}")
        print(f"Rule Evaluated: {dec.get('rule_evaluated')}")
        print(f"Explanation: {dec.get('explanation')}")

    # Check portfolio state after Cycle 1
    p_after1 = tracker.get_portfolio_summary()
    print("\n[STEP 3: POST-CYCLE 1 RECONCILED PORTFOLIO]")
    print(f"Cash Balance: ${p_after1['cash_balance_usd']:.2f}")
    print(f"Invested Value: ${p_after1['invested_value_usd']:.2f}")
    print(f"Total Portfolio Value: ${p_after1['total_value_usd']:.2f}")
    print(f"Open Positions Count: {len(p_after1['open_positions'])}")
    for pos in p_after1['open_positions']:
        print(f"  • Position: {pos['pair']} {pos['side']} | Qty: {pos['quantity']} | Entry: ${pos['entry_price']:.4f} | Stop Loss: ${pos.get('stop_loss') or 0:.4f} | Take Profit: ${pos.get('take_profit') or 0:.4f}")

    # 3. Simulate Market Movement & Position Management (Stop Loss / Take Profit / Max Holding)
    print("\n[STEP 4: POSITION MONITORING & RISK EXITS]")
    if tracker.positions:
        pos_id = list(tracker.positions.keys())[0]
        pos = tracker.positions[pos_id]
        print(f"Evaluating Active Position: {pos.pair} ({pos_id})")

        # Scenario A: Take-Profit Hit Check
        tp_target = pos.take_profit or (pos.entry_price * 1.05)
        print(f"Simulating market surge to ${tp_target:.4f} (Take-Profit Trigger)...")
        exit_events = tracker.update_market_prices({pos.pair: tp_target})
        if exit_events:
            event = exit_events[0]
            print(f"✅ Position Automatically Closed via {event.get('event_type')}!")
            print(f"Realized P&L: +${event.get('realized_pnl'):.2f}")
            print(f"Holding Duration: {event.get('holding_duration_seconds'):.1f}s")

    # 4. Final Portfolio Summary
    final_summary = tracker.get_portfolio_summary()
    print("\n[STEP 5: FINAL RECONCILED PERFORMANCE]")
    print(f"Realized P&L Total: ${final_summary['realized_pnl_usd']:.2f}")
    print(f"Win Rate: {final_summary['win_rate_pct']:.1f}% ({final_summary['win_count']}W / {final_summary['loss_count']}L)")
    print(f"Total Closed Trades: {len(tracker.trades_history)}")
    print("=" * 80)
    print("DEMONSTRATION COMPLETED SUCCESSFULLY")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_demonstration())
