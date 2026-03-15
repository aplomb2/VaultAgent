"""Tests for the policy engine."""

import pytest
from vaultagent.core.policy import Action, Policy


SAMPLE_POLICY_YAML = """
version: "1.0"
agents:
  test-agent:
    description: "Test agent"
    tools:
      - tool: "database.query"
        action: allow
        constraints:
          tables: ["users", "orders"]
          operations: ["SELECT"]
      - tool: "email.send"
        action: require_approval
      - tool: "database.delete"
        action: deny
      - tool: "file.*"
        action: allow
      - tool: "*"
        action: deny
    rate_limits:
      max_calls_per_minute: 10
      max_calls_per_hour: 100

defaults:
  action: deny
  log_level: "all"
"""


class TestPolicyParsing:
    def test_parse_yaml(self):
        policy = Policy.from_yaml(SAMPLE_POLICY_YAML)
        assert policy.version == "1.0"
        assert "test-agent" in policy.agents
        assert len(policy.agents["test-agent"].rules) == 5

    def test_default_action(self):
        policy = Policy.from_yaml(SAMPLE_POLICY_YAML)
        assert policy.default_action == Action.DENY

    def test_agent_description(self):
        policy = Policy.from_yaml(SAMPLE_POLICY_YAML)
        assert policy.agents["test-agent"].description == "Test agent"

    def test_rate_limits(self):
        policy = Policy.from_yaml(SAMPLE_POLICY_YAML)
        rl = policy.agents["test-agent"].rate_limits
        assert rl.max_calls_per_minute == 10
        assert rl.max_calls_per_hour == 100
        assert rl.max_calls_per_day is None


class TestPolicyEvaluation:
    def setup_method(self):
        self.policy = Policy.from_yaml(SAMPLE_POLICY_YAML)

    def test_allow_matching_tool(self):
        action, rule = self.policy.evaluate("test-agent", "database.query")
        assert action == Action.ALLOW
        assert rule is not None
        assert rule.tool == "database.query"

    def test_deny_explicit(self):
        action, rule = self.policy.evaluate("test-agent", "database.delete")
        assert action == Action.DENY

    def test_require_approval(self):
        action, rule = self.policy.evaluate("test-agent", "email.send")
        assert action == Action.REQUIRE_APPROVAL

    def test_glob_matching(self):
        action, rule = self.policy.evaluate("test-agent", "file.read")
        assert action == Action.ALLOW

        action, rule = self.policy.evaluate("test-agent", "file.write")
        assert action == Action.ALLOW

    def test_wildcard_deny(self):
        """Unknown tools should be denied by the wildcard rule."""
        action, rule = self.policy.evaluate("test-agent", "unknown.tool")
        assert action == Action.DENY

    def test_unknown_agent_uses_default(self):
        action, rule = self.policy.evaluate("nonexistent-agent", "database.query")
        assert action == Action.DENY
        assert rule is None

    def test_constraints_preserved(self):
        action, rule = self.policy.evaluate("test-agent", "database.query")
        assert rule is not None
        assert "tables" in rule.constraints
        assert rule.constraints["tables"] == ["users", "orders"]


class TestPolicySerialization:
    def test_roundtrip(self):
        policy = Policy.from_yaml(SAMPLE_POLICY_YAML)
        d = policy.to_dict()
        assert d["version"] == "1.0"
        assert "test-agent" in d["agents"]
        assert d["defaults"]["action"] == "deny"
