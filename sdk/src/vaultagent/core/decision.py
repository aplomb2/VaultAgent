"""Decision engine — evaluate tool calls and enforce constraints."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from vaultagent.core.policy import Action, Policy, PolicyRule


@dataclass
class DecisionResult:
    """Result of a permission decision."""

    action: Action
    tool: str
    agent_id: str
    rule: PolicyRule | None = None
    constraints_applied: list[str] = field(default_factory=list)
    denial_reason: str | None = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def allowed(self) -> bool:
        return self.action == Action.ALLOW

    @property
    def denied(self) -> bool:
        return self.action == Action.DENY

    @property
    def needs_approval(self) -> bool:
        return self.action == Action.REQUIRE_APPROVAL


class ConstraintChecker:
    """Check tool call arguments against policy constraints."""

    @staticmethod
    def check(
        constraints: dict[str, Any],
        tool_name: str,
        tool_args: dict[str, Any],
    ) -> tuple[bool, list[str], str | None]:
        """
        Check if tool arguments satisfy constraints.

        Returns: (passed, constraints_applied, denial_reason)
        """
        applied: list[str] = []
        
        # Table whitelist
        if "tables" in constraints:
            allowed_tables = constraints["tables"]
            if allowed_tables != ["*"]:
                sql = tool_args.get("sql", tool_args.get("query", ""))
                if isinstance(sql, str):
                    # Simple SQL table extraction
                    tables_in_query = _extract_tables_from_sql(sql)
                    for table in tables_in_query:
                        if table.lower() not in [t.lower() for t in allowed_tables]:
                            return (
                                False,
                                [f"table_whitelist: {allowed_tables}"],
                                f"Table '{table}' is not in the allowed list: {allowed_tables}",
                            )
                applied.append(f"table_whitelist: {allowed_tables}")

        # Operation whitelist (SQL)
        if "operations" in constraints:
            allowed_ops = [op.upper() for op in constraints["operations"]]
            sql = tool_args.get("sql", tool_args.get("query", ""))
            if isinstance(sql, str) and sql.strip():
                first_word = sql.strip().split()[0].upper()
                if first_word not in allowed_ops:
                    return (
                        False,
                        [f"operation_whitelist: {allowed_ops}"],
                        f"Operation '{first_word}' is not allowed. Allowed: {allowed_ops}",
                    )
                applied.append(f"operation_whitelist: {allowed_ops}")

        # Path whitelist
        if "paths" in constraints:
            import fnmatch

            allowed_paths = constraints["paths"]
            path = tool_args.get("path", tool_args.get("file_path", ""))
            if isinstance(path, str) and path:
                if not any(fnmatch.fnmatch(path, pattern) for pattern in allowed_paths):
                    return (
                        False,
                        [f"path_whitelist: {allowed_paths}"],
                        f"Path '{path}' is not in allowed paths: {allowed_paths}",
                    )
                applied.append(f"path_whitelist: {allowed_paths}")

        # Domain whitelist
        if "domains" in constraints:
            import fnmatch

            allowed_domains = constraints["domains"]
            # Check 'to', 'url', 'domain' fields
            for field_name in ("to", "url", "domain", "email"):
                value = tool_args.get(field_name, "")
                if isinstance(value, str) and value:
                    domain = _extract_domain(value)
                    if domain and not any(
                        fnmatch.fnmatch(domain, pattern) for pattern in allowed_domains
                    ):
                        return (
                            False,
                            [f"domain_whitelist: {allowed_domains}"],
                            f"Domain '{domain}' is not allowed. Allowed: {allowed_domains}",
                        )
            applied.append(f"domain_whitelist: {allowed_domains}")

        # Max rows
        if "max_rows" in constraints:
            limit = tool_args.get("limit", tool_args.get("max_rows"))
            if limit is not None and int(limit) > constraints["max_rows"]:
                return (
                    False,
                    [f"max_rows: {constraints['max_rows']}"],
                    f"Row limit {limit} exceeds maximum of {constraints['max_rows']}",
                )
            applied.append(f"max_rows: {constraints['max_rows']}")

        return True, applied, None


class Decision:
    """Main decision engine."""

    def __init__(self, policy: Policy) -> None:
        self.policy = policy

    def evaluate(
        self,
        agent_id: str,
        tool_name: str,
        tool_args: dict[str, Any] | None = None,
    ) -> DecisionResult:
        """
        Evaluate whether a tool call should be allowed.

        Args:
            agent_id: The agent making the call
            tool_name: Name of the tool being called
            tool_args: Arguments passed to the tool

        Returns:
            DecisionResult with the action to take
        """
        tool_args = tool_args or {}

        # Get the policy decision
        action, rule = self.policy.evaluate(agent_id, tool_name)

        # If denied or needs approval, return immediately
        if action in (Action.DENY, Action.REQUIRE_APPROVAL):
            return DecisionResult(
                action=action,
                tool=tool_name,
                agent_id=agent_id,
                rule=rule,
                denial_reason=f"Policy: tool '{tool_name}' is {action.value} for agent '{agent_id}'",
            )

        # If allowed, check constraints
        if rule and rule.constraints:
            passed, applied, reason = ConstraintChecker.check(
                rule.constraints, tool_name, tool_args
            )
            if not passed:
                return DecisionResult(
                    action=Action.DENY,
                    tool=tool_name,
                    agent_id=agent_id,
                    rule=rule,
                    constraints_applied=applied,
                    denial_reason=reason,
                )
            return DecisionResult(
                action=Action.ALLOW,
                tool=tool_name,
                agent_id=agent_id,
                rule=rule,
                constraints_applied=applied,
            )

        return DecisionResult(
            action=action,
            tool=tool_name,
            agent_id=agent_id,
            rule=rule,
        )


def _extract_tables_from_sql(sql: str) -> list[str]:
    """Simple extraction of table names from SQL (FROM/JOIN/INTO/UPDATE clauses)."""
    tables: list[str] = []
    patterns = [
        r'\bFROM\s+(\w+)',
        r'\bJOIN\s+(\w+)',
        r'\bINTO\s+(\w+)',
        r'\bUPDATE\s+(\w+)',
    ]
    for pattern in patterns:
        tables.extend(re.findall(pattern, sql, re.IGNORECASE))
    return list(set(tables))


def _extract_domain(value: str) -> str | None:
    """Extract domain from an email or URL."""
    if "@" in value:
        return value.split("@")[-1].lower()
    # URL
    match = re.match(r'https?://([^/]+)', value)
    if match:
        return match.group(1).lower()
    return None
