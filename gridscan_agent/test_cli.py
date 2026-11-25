#!/usr/bin/env python3
"""
Interactive CLI for testing the Gridscan Agent locally.

Usage:
    python -m gridscan_agent.test_cli --anthropic-key sk-... --gridscan-key YOUR_KEY

Or set environment variables:
    export ANTHROPIC_API_KEY=sk-...
    export GRIDSCAN_API_KEY=YOUR_KEY
    python -m gridscan_agent.test_cli
"""
import os
import sys
import json
import asyncio
import argparse

from gridscan_agent import GridscanAgent, AgentConfig


def print_colored(text: str, color: str = ""):
    colors = {
        "blue": "\033[94m",
        "green": "\033[92m",
        "yellow": "\033[93m",
        "red": "\033[91m",
        "cyan": "\033[96m",
        "dim": "\033[90m",
        "bold": "\033[1m",
        "reset": "\033[0m",
    }
    c = colors.get(color, "")
    r = colors["reset"]
    print(f"{c}{text}{r}")


async def main():
    parser = argparse.ArgumentParser(description="Gridscan Agent CLI Tester")
    parser.add_argument("--anthropic-key", default=os.environ.get("ANTHROPIC_API_KEY", ""))
    parser.add_argument("--gridscan-key", default=os.environ.get("GRIDSCAN_API_KEY", ""))
    parser.add_argument("--model", default="claude-sonnet-4-20250514")
    parser.add_argument("--session", default="cli-test")
    parser.add_argument("--base-url", default="https://ada.api.gridscan.io")
    args = parser.parse_args()

    if not args.anthropic_key:
        print_colored("ERROR: Set ANTHROPIC_API_KEY or pass --anthropic-key", "red")
        sys.exit(1)

    config = AgentConfig(
        anthropic_api_key=args.anthropic_key,
        gridscan_api_key=args.gridscan_key,
        model=args.model,
        gridscan_base_url=args.base_url,
    )

    agent = GridscanAgent(config=config)

    print_colored("\n  Gridscan Agent — Interactive Test CLI", "bold")
    print_colored("  Loading API endpoints...", "dim")

    await agent.initialize()
    print_colored(f"  {agent.tool_count} endpoints loaded as tools", "green")
    print_colored("  Type your question. 'quit' to exit, 'memory' to see context, 'log' for API calls.\n", "dim")

    session_id = args.session

    while True:
        try:
            user_input = input(f"\033[94m  You > \033[0m").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not user_input:
            continue
        if user_input.lower() in ("quit", "exit", "q"):
            break
        if user_input.lower() == "memory":
            mem = agent.get_session_memory(session_id)
            print_colored(json.dumps(mem, indent=2), "cyan")
            continue
        if user_input.lower() == "log":
            log = agent.api_call_log
            if not log:
                print_colored("  No API calls yet.", "dim")
            else:
                for entry in log[-10:]:
                    status_color = "green" if entry["success"] else "red"
                    print_colored(
                        f"  {entry['endpoint']:50} {entry['status_code']} ({entry['duration_ms']}ms)",
                        status_color
                    )
            continue
        if user_input.lower() == "clear":
            agent.clear_session(session_id)
            print_colored("  Session cleared.", "dim")
            continue
        if user_input.lower() == "tools":
            for name in agent.tool_names:
                print_colored(f"  {name}", "dim")
            print_colored(f"\n  Total: {agent.tool_count}", "green")
            continue

        # Send to agent
        print_colored("  Thinking...", "dim")
        try:
            result = await agent.chat(session_id, user_input)

            # Show tool calls
            if result["tool_calls"]:
                print_colored(f"\n  API calls ({len(result['tool_calls'])}):", "yellow")
                for tc in result["tool_calls"]:
                    status_color = "green" if tc["success"] else "red"
                    print_colored(f"    {tc['endpoint']} → {tc['status_code']} ({tc['duration_ms']}ms)", status_color)

            # Show reply
            print_colored(f"\n  Agent > ", "green")
            print(f"  {result['reply']}\n")

            # Show token usage
            tokens = result["tokens_used"]
            print_colored(f"  Tokens: {tokens['input']} in / {tokens['output']} out", "dim")

        except Exception as e:
            print_colored(f"  Error: {e}", "red")

    await agent.close()
    print_colored("\n  Goodbye!", "dim")


if __name__ == "__main__":
    asyncio.run(main())
