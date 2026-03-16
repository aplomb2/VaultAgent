"""VaultAgent CLI — validate policies, run tests, view audit logs, and scaffold projects."""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING, Any, NoReturn

if TYPE_CHECKING:
    from vaultagent.core.decision import Decision
    from vaultagent.core.policy import Action


# ANSI color codes
class _Colors:
    """ANSI escape codes for terminal output."""

    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"

    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    CYAN = "\033[36m"
    WHITE = "\033[37m"

    BG_RED = "\033[41m"
    BG_GREEN = "\033[42m"


def _green(text: str) -> str:
    return f"{_Colors.GREEN}{text}{_Colors.RESET}"


def _red(text: str) -> str:
    return f"{_Colors.RED}{text}{_Colors.RESET}"


def _yellow(text: str) -> str:
    return f"{_Colors.YELLOW}{text}{_Colors.RESET}"


def _bold(text: str) -> str:
    return f"{_Colors.BOLD}{text}{_Colors.RESET}"


def _dim(text: str) -> str:
    return f"{_Colors.DIM}{text}{_Colors.RESET}"


def _cyan(text: str) -> str:
    return f"{_Colors.CYAN}{text}{_Colors.RESET}"


# ---------------------------------------------------------------------------
# validate command
# ---------------------------------------------------------------------------

def cmd_validate(args: argparse.Namespace) -> int:
    """Validate a policy YAML file and print a summary."""
    from vaultagent.core.policy import Policy

    policy_path: str = args.policy_file
    path = Path(policy_path)

    if not path.exists():
        print(f"  {_red('✗')} File not found: {policy_path}")
        return 1

    try:
        policy = Policy.from_file(path)
    except FileNotFoundError:
        print(f"  {_red('✗')} File not found: {policy_path}")
        return 1
    except Exception as exc:
        print(f"  {_red('✗')} Failed to parse policy: {exc}")
        return 1

    # Validate structure
    errors: list[str] = []

    if not policy.agents:
        errors.append("No agents defined in policy")

    for agent_id, agent_policy in policy.agents.items():
        if not agent_policy.rules:
            errors.append(f"Agent '{agent_id}' has no rules defined")
        for i, rule in enumerate(agent_policy.rules):
            if not rule.tool:
                errors.append(f"Agent '{agent_id}', rule {i}: missing 'tool' field")

    if errors:
        print(f"\n  {_red('✗')} Policy validation failed:\n")
        for error in errors:
            print(f"    {_red('•')} {error}")
        print()
        return 1

    # Success — show summary
    total_rules = sum(len(ap.rules) for ap in policy.agents.values())

    print(f"\n  {_green('✓')} Policy is valid: {_bold(str(path))}\n")
    print(f"    Version:        {policy.version}")
    print(f"    Agents:         {len(policy.agents)}")
    print(f"    Total rules:    {total_rules}")
    print(f"    Default action: {_color_action(policy.default_action.value)}")
    print()

    for agent_id, agent_policy in policy.agents.items():
        desc = f" — {agent_policy.description}" if agent_policy.description else ""
        print(f"    {_bold(agent_id)}{_dim(desc)}")
        for rule in agent_policy.rules:
            action_str = _color_action(rule.action.value)
            constraint_info = ""
            if rule.constraints:
                keys = ", ".join(rule.constraints.keys())
                constraint_info = f" {_dim(f'[constraints: {keys}]')}"
            print(f"      {action_str:>30s}  {rule.tool}{constraint_info}")
        print()

    return 0


# ---------------------------------------------------------------------------
# test command
# ---------------------------------------------------------------------------

def cmd_test(args: argparse.Namespace) -> int:
    """Load a policy and run built-in test scenarios against it."""
    from vaultagent.core.decision import Decision
    from vaultagent.core.policy import Action, Policy

    policy_path: str = args.policy_file
    path = Path(policy_path)

    try:
        policy = Policy.from_file(path)
    except Exception as exc:
        print(f"  {_red('✗')} Failed to load policy: {exc}")
        return 1

    engine = Decision(policy)

    # Table header
    print()
    header = (
        f"  {'Agent':<20s} {'Tool':<25s} {'Expected':<18s} "
        f"{'Actual':<18s} {'Result':<8s}"
    )
    print(_bold(header))
    print(f"  {'─' * 91}")

    passed = 0
    failed = 0

    for agent_id, agent_policy in policy.agents.items():
        # Test each explicit rule
        for rule in agent_policy.rules:
            tool_name = rule.tool
            # Skip glob-only patterns for direct testing — use a concrete name
            if "*" in tool_name or "?" in tool_name:
                # Test that the pattern matches a concrete example
                concrete = tool_name.replace("*", "anything").replace("?", "x")
                result = engine.evaluate(agent_id, concrete)
                ok = result.action == rule.action
            else:
                result = engine.evaluate(agent_id, tool_name)
                ok = result.action == rule.action

            status = _green("PASS") if ok else _red("FAIL")
            expected_str = _color_action(rule.action.value)
            actual_str = _color_action(result.action.value)

            print(
                f"  {agent_id:<20s} {tool_name:<25s} {expected_str:<27s} "
                f"{actual_str:<27s} {status}"
            )

            if ok:
                passed += 1
            else:
                failed += 1

            # If the rule has constraints and action is ALLOW, test constraint enforcement
            if rule.action == Action.ALLOW and rule.constraints:
                passed_ref: list[int] = [passed]
                failed_ref: list[int] = [failed]
                _test_constraints(
                    engine, agent_id, tool_name, rule.constraints,
                    passed_ref=passed_ref, failed_ref=failed_ref,
                )
                passed = passed_ref[0]
                failed = failed_ref[0]

        # Test that an unknown tool falls back to default
        unknown_tool = "__unknown_tool_for_testing__"
        result = engine.evaluate(agent_id, unknown_tool)
        ok = result.action == policy.default_action
        status = _green("PASS") if ok else _red("FAIL")
        expected_str = _color_action(policy.default_action.value)
        actual_str = _color_action(result.action.value)

        print(
            f"  {agent_id:<20s} {'(unknown tool)':<25s} {expected_str:<27s} "
            f"{actual_str:<27s} {status}"
        )
        if ok:
            passed += 1
        else:
            failed += 1

    # Test unknown agent falls back to default
    unknown_agent = "__unknown_agent__"
    unknown_tool = "some_tool"
    result = engine.evaluate(unknown_agent, unknown_tool)
    ok = result.action == policy.default_action
    status = _green("PASS") if ok else _red("FAIL")
    expected_str = _color_action(policy.default_action.value)
    actual_str = _color_action(result.action.value)

    print(
        f"  {'(unknown agent)':<20s} {unknown_tool:<25s} {expected_str:<27s} "
        f"{actual_str:<27s} {status}"
    )
    if ok:
        passed += 1
    else:
        failed += 1

    # Summary
    print(f"\n  {_bold('Results:')} {_green(str(passed) + ' passed')}", end="")
    if failed:
        print(f", {_red(str(failed) + ' failed')}", end="")
    print(f" ({passed + failed} total)\n")

    return 1 if failed else 0


def _test_constraints(
    engine: Decision,
    agent_id: str,
    tool_name: str,
    constraints: dict[str, Any],
    passed_ref: list[int],
    failed_ref: list[int],
) -> None:
    """Test constraint enforcement by sending violating arguments."""
    from vaultagent.core.policy import Action

    # Test path constraints
    if "paths" in constraints:
        bad_result = engine.evaluate(agent_id, tool_name, {"path": "/etc/shadow"})
        ok = bad_result.denied
        status = _green("PASS") if ok else _red("FAIL")
        actual_str = _color_action(bad_result.action.value)
        print(
            f"  {agent_id:<20s} {tool_name + ' (bad path)':<25s} "
            f"{_color_action(Action.DENY.value):<27s} {actual_str:<27s} {status}"
        )
        if ok:
            passed_ref[0] += 1
        else:
            failed_ref[0] += 1

    # Test table constraints
    if "tables" in constraints and constraints["tables"] != ["*"]:
        bad_result = engine.evaluate(
            agent_id, tool_name, {"sql": "SELECT * FROM secret_table"}
        )
        ok = bad_result.denied
        status = _green("PASS") if ok else _red("FAIL")
        actual_str = _color_action(bad_result.action.value)
        print(
            f"  {agent_id:<20s} {tool_name + ' (bad table)':<25s} "
            f"{_color_action(Action.DENY.value):<27s} {actual_str:<27s} {status}"
        )
        if ok:
            passed_ref[0] += 1
        else:
            failed_ref[0] += 1

    # Test operation constraints
    if "operations" in constraints:
        bad_result = engine.evaluate(
            agent_id, tool_name, {"sql": "DROP TABLE users"}
        )
        allowed_ops = [op.upper() for op in constraints["operations"]]
        if "DROP" not in allowed_ops:
            ok = bad_result.denied
            status = _green("PASS") if ok else _red("FAIL")
            actual_str = _color_action(bad_result.action.value)
            print(
                f"  {agent_id:<20s} {tool_name + ' (bad op)':<25s} "
                f"{_color_action(Action.DENY.value):<27s} {actual_str:<27s} {status}"
            )
            if ok:
                passed_ref[0] += 1
            else:
                failed_ref[0] += 1

    # Test domain constraints
    if "domains" in constraints:
        bad_result = engine.evaluate(
            agent_id, tool_name, {"to": "hacker@evil.com"}
        )
        ok = bad_result.denied
        status = _green("PASS") if ok else _red("FAIL")
        actual_str = _color_action(bad_result.action.value)
        print(
            f"  {agent_id:<20s} {tool_name + ' (bad domain)':<25s} "
            f"{_color_action(Action.DENY.value):<27s} {actual_str:<27s} {status}"
        )
        if ok:
            passed_ref[0] += 1
        else:
            failed_ref[0] += 1


def _run_test_case(
    engine: Decision,
    agent_id: str,
    tool_name: str,
    expected_action: Action,
) -> bool:
    """Run a single test case and return whether it passed."""
    result = engine.evaluate(agent_id, tool_name)
    return result.action == expected_action


# ---------------------------------------------------------------------------
# logs command
# ---------------------------------------------------------------------------

def cmd_logs(args: argparse.Namespace) -> int:
    """Read and pretty-print a JSONL audit log file."""
    log_path: str = args.log_file
    limit: int | None = args.limit
    path = Path(log_path)

    if not path.exists():
        print(f"  {_red('✗')} Log file not found: {log_path}")
        return 1

    print()
    count = 0
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue

                try:
                    entry: dict[str, Any] = json.loads(line)
                except json.JSONDecodeError as exc:
                    print(f"  {_red('✗')} Malformed JSON line: {exc}")
                    continue

                _print_log_entry(entry)
                count += 1

                if limit is not None and count >= limit:
                    break
    except OSError as exc:
        print(f"  {_red('✗')} Failed to read log file: {exc}")
        return 1

    if count == 0:
        print(f"  {_dim('(no entries)')}")
    else:
        print(f"  {_dim(f'({count} entries shown)')}")
    print()
    return 0


def _print_log_entry(entry: dict[str, Any]) -> None:
    """Pretty-print a single audit log entry with colors."""
    timestamp = entry.get("timestamp", "?")
    agent_id = entry.get("agent_id", "?")
    tool = entry.get("tool", "?")
    action = entry.get("action", "?")
    denial_reason = entry.get("denial_reason")
    constraints = entry.get("constraints_applied", [])

    action_display = _color_action(action)

    print(f"  {_dim(timestamp)}  {action_display:<27s}  {_bold(agent_id)} -> {tool}")

    if denial_reason:
        print(f"    {_red('reason:')} {denial_reason}")

    if constraints:
        print(f"    {_dim('constraints:')} {', '.join(constraints)}")


# ---------------------------------------------------------------------------
# init command
# ---------------------------------------------------------------------------

_STARTER_POLICY = """\
# VaultAgent Policy File
# Docs: https://docs.vaultagent.dev/policies
#
# This file controls what your AI agents can and cannot do.
# Rules are evaluated top-to-bottom; the first matching rule wins.

version: "1.0"

# Default action when no rule matches.
# Options: allow, deny, require_approval
defaults:
  action: deny
  log_level: all

agents:
  # ---- Example: a coding assistant agent ----
  coding_assistant:
    description: "AI coding assistant with file and terminal access"
    tools:
      # Allow reading files, but only in the project directory
      - tool: read_file
        action: allow
        constraints:
          paths:
            - "./src/*"
            - "./tests/*"
            - "./docs/*"

      # Allow writing files in src and tests only
      - tool: write_file
        action: allow
        constraints:
          paths:
            - "./src/*"
            - "./tests/*"

      # Allow running tests
      - tool: run_command
        action: require_approval

      # Block dangerous operations
      - tool: delete_file
        action: deny

      # Catch-all: deny anything not explicitly listed
      - tool: "*"
        action: deny

    rate_limits:
      max_calls_per_minute: 30
      max_calls_per_hour: 500

  # ---- Example: a data analysis agent ----
  data_analyst:
    description: "Agent that queries databases for analytics"
    tools:
      - tool: database.query
        action: allow
        constraints:
          tables:
            - analytics
            - reports
            - public_metrics
          operations:
            - SELECT
          max_rows: 1000

      - tool: database.write
        action: deny

      - tool: send_email
        action: allow
        constraints:
          domains:
            - "company.com"

      - tool: "*"
        action: deny

    rate_limits:
      max_calls_per_minute: 10
"""


def cmd_init(args: argparse.Namespace) -> int:
    """Generate a starter policy YAML file."""
    output_path = Path("vaultagent.policy.yaml")

    if output_path.exists():
        print(f"\n  {_yellow('!')} File already exists: {output_path}")
        print("    Use a different name or remove the existing file.\n")
        return 1

    output_path.write_text(_STARTER_POLICY)
    print(f"\n  {_green('✓')} Created {_bold(str(output_path))}")
    print("    Edit this file to define your agent permissions.\n")
    return 0


# ---------------------------------------------------------------------------
# Color helper
# ---------------------------------------------------------------------------

def _color_action(action: str) -> str:
    """Colorize an action string based on its value."""
    match action:
        case "allow":
            return _green(action)
        case "deny":
            return _red(action)
        case "require_approval":
            return _yellow(action)
        case _:
            return action


# ---------------------------------------------------------------------------
# Argument parser and main entry point
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    """Build the top-level argument parser with subcommands."""
    parser = argparse.ArgumentParser(
        prog="vaultagent",
        description="VaultAgent CLI — permission control for AI agents",
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # validate
    validate_parser = subparsers.add_parser(
        "validate",
        help="Validate a policy YAML file",
    )
    validate_parser.add_argument(
        "policy_file",
        help="Path to the policy YAML file",
    )

    # test
    test_parser = subparsers.add_parser(
        "test",
        help="Run built-in test scenarios against a policy",
    )
    test_parser.add_argument(
        "policy_file",
        help="Path to the policy YAML file",
    )

    # logs
    logs_parser = subparsers.add_parser(
        "logs",
        help="Pretty-print a JSONL audit log file",
    )
    logs_parser.add_argument(
        "log_file",
        help="Path to the audit JSONL log file",
    )
    logs_parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of entries to display",
    )

    # init
    subparsers.add_parser(
        "init",
        help="Generate a starter policy YAML file",
    )

    return parser


def main(argv: list[str] | None = None) -> NoReturn:
    """CLI entry point."""
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command is None:
        parser.print_help()
        sys.exit(0)

    commands: dict[str, Callable[[argparse.Namespace], int]] = {
        "validate": cmd_validate,
        "test": cmd_test,
        "logs": cmd_logs,
        "init": cmd_init,
    }

    handler = commands.get(args.command)
    if handler is None:
        parser.print_help()
        sys.exit(1)

    sys.exit(handler(args))


if __name__ == "__main__":
    main()
