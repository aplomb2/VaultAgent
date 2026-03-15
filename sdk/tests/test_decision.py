"""Tests for the decision engine."""

import pytest
from vaultagent.core.policy import Action, Policy
from vaultagent.core.decision import Decision


POLICY_YAML = """
version: "1.0"
agents:
  test-agent:
    tools:
      - tool: "database.query"
        action: allow
        constraints:
          tables: ["users", "orders"]
          operations: ["SELECT"]
      - tool: "file.write"
        action: allow
        constraints:
          paths: ["/tmp/reports/*"]
      - tool: "email.send"
        action: allow
        constraints:
          domains: ["*.company.com"]
      - tool: "*"
        action: deny
defaults:
  action: deny
"""


class TestDecisionEngine:
    def setup_method(self):
        policy = Policy.from_yaml(POLICY_YAML)
        self.engine = Decision(policy)

    def test_allow_valid_query(self):
        result = self.engine.evaluate(
            "test-agent",
            "database.query",
            {"sql": "SELECT name FROM users WHERE id = 1"},
        )
        assert result.allowed
        assert "table_whitelist" in str(result.constraints_applied)

    def test_deny_unauthorized_table(self):
        result = self.engine.evaluate(
            "test-agent",
            "database.query",
            {"sql": "SELECT * FROM secrets"},
        )
        assert result.denied
        assert "secrets" in (result.denial_reason or "")

    def test_deny_write_operation(self):
        result = self.engine.evaluate(
            "test-agent",
            "database.query",
            {"sql": "DELETE FROM users WHERE id = 1"},
        )
        assert result.denied
        assert "DELETE" in (result.denial_reason or "")

    def test_allow_valid_file_path(self):
        result = self.engine.evaluate(
            "test-agent",
            "file.write",
            {"path": "/tmp/reports/q1-analysis.csv"},
        )
        assert result.allowed

    def test_deny_invalid_file_path(self):
        result = self.engine.evaluate(
            "test-agent",
            "file.write",
            {"path": "/etc/passwd"},
        )
        assert result.denied
        assert "/etc/passwd" in (result.denial_reason or "")

    def test_allow_valid_email_domain(self):
        result = self.engine.evaluate(
            "test-agent",
            "email.send",
            {"to": "john@sales.company.com"},
        )
        assert result.allowed

    def test_deny_external_email(self):
        result = self.engine.evaluate(
            "test-agent",
            "email.send",
            {"to": "hacker@evil.com"},
        )
        assert result.denied

    def test_deny_unknown_tool(self):
        result = self.engine.evaluate("test-agent", "system.shutdown", {})
        assert result.denied

    def test_no_args_still_works(self):
        """Tools with no args should still be evaluated."""
        result = self.engine.evaluate("test-agent", "database.query")
        assert result.allowed  # No SQL to check = passes constraint
