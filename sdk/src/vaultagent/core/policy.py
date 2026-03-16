"""Policy engine — parse YAML policies and match rules against tool calls."""

from __future__ import annotations

import fnmatch
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

import yaml


class Action(Enum):
    """Permission decision for a tool call."""

    ALLOW = "allow"
    DENY = "deny"
    REQUIRE_APPROVAL = "require_approval"


@dataclass
class RateLimit:
    """Rate limiting configuration for an agent."""

    max_calls_per_minute: int | None = None
    max_calls_per_hour: int | None = None
    max_calls_per_day: int | None = None


@dataclass
class PolicyRule:
    """A single permission rule for a tool."""

    tool: str  # tool name or glob pattern (e.g., "database.*", "*")
    action: Action
    constraints: dict[str, Any] = field(default_factory=dict)

    def matches(self, tool_name: str) -> bool:
        """Check if this rule matches the given tool name."""
        return fnmatch.fnmatch(tool_name, self.tool)


@dataclass
class AgentPolicy:
    """Policy for a specific agent."""

    agent_id: str
    description: str = ""
    rules: list[PolicyRule] = field(default_factory=list)
    rate_limits: RateLimit = field(default_factory=RateLimit)

    def find_matching_rule(self, tool_name: str) -> PolicyRule | None:
        """Find the first matching rule for a tool (order matters)."""
        for rule in self.rules:
            if rule.matches(tool_name):
                return rule
        return None


@dataclass
class Policy:
    """Top-level policy containing agent policies and defaults."""

    version: str = "1.0"
    agents: dict[str, AgentPolicy] = field(default_factory=dict)
    default_action: Action = Action.DENY
    default_log_level: str = "all"

    def get_agent_policy(self, agent_id: str) -> AgentPolicy | None:
        """Get policy for a specific agent."""
        return self.agents.get(agent_id)

    def evaluate(self, agent_id: str, tool_name: str) -> tuple[Action, PolicyRule | None]:
        """
        Evaluate a tool call against the policy.

        Returns (action, matching_rule). If no agent or rule found,
        returns the default action.
        """
        agent_policy = self.get_agent_policy(agent_id)
        if agent_policy is None:
            return self.default_action, None

        rule = agent_policy.find_matching_rule(tool_name)
        if rule is None:
            return self.default_action, None

        return rule.action, rule

    @classmethod
    def from_yaml(cls, yaml_content: str) -> Policy:
        """Parse a YAML string into a Policy object."""
        data = yaml.safe_load(yaml_content)
        return cls._from_dict(data)

    @classmethod
    def from_file(cls, path: str | Path) -> Policy:
        """Load a Policy from a YAML file."""
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"Policy file not found: {path}")
        return cls.from_yaml(path.read_text())

    @classmethod
    def _from_dict(cls, data: dict[str, Any]) -> Policy:
        """Parse a dict into a Policy object."""
        defaults = data.get("defaults", {})
        default_action = Action(defaults.get("action", "deny"))
        default_log_level = defaults.get("log_level", "all")

        agents: dict[str, AgentPolicy] = {}
        for agent_id, agent_data in data.get("agents", {}).items():
            rules: list[PolicyRule] = []
            for rule_data in agent_data.get("tools", []):
                rules.append(
                    PolicyRule(
                        tool=rule_data["tool"],
                        action=Action(rule_data["action"]),
                        constraints=rule_data.get("constraints", {}),
                    )
                )

            rate_data = agent_data.get("rate_limits", {})
            rate_limits = RateLimit(
                max_calls_per_minute=rate_data.get("max_calls_per_minute"),
                max_calls_per_hour=rate_data.get("max_calls_per_hour"),
                max_calls_per_day=rate_data.get("max_calls_per_day"),
            )

            agents[agent_id] = AgentPolicy(
                agent_id=agent_id,
                description=agent_data.get("description", ""),
                rules=rules,
                rate_limits=rate_limits,
            )

        return cls(
            version=data.get("version", "1.0"),
            agents=agents,
            default_action=default_action,
            default_log_level=default_log_level,
        )

    @classmethod
    def from_cloud_response(cls, data: dict[str, Any]) -> Policy:
        """Parse a cloud API response into a Policy object.

        The cloud API returns camelCase keys and agents as an array,
        unlike the YAML format which uses snake_case and agents as a dict.
        """
        default_action = Action(data.get("defaultAction", "deny"))

        agents: dict[str, AgentPolicy] = {}

        # Cloud returns agents as an array with agentId field
        agents_list = data.get("agents", [])
        if isinstance(agents_list, list):
            for agent_data in agents_list:
                agent_id = agent_data.get("agentId", "")
                if not agent_id:
                    continue
                rules: list[PolicyRule] = []
                for rule_data in agent_data.get("rules", []):
                    rules.append(
                        PolicyRule(
                            tool=rule_data["tool"],
                            action=Action(rule_data["action"]),
                            constraints=rule_data.get("constraints", {}),
                        )
                    )
                rate_data = agent_data.get("rateLimit", {}) or {}
                rate_limits = RateLimit(
                    max_calls_per_minute=rate_data.get("max_calls_per_minute"),
                    max_calls_per_hour=rate_data.get("max_calls_per_hour"),
                    max_calls_per_day=rate_data.get("max_calls_per_day"),
                )
                agents[agent_id] = AgentPolicy(
                    agent_id=agent_id,
                    description=agent_data.get("description", ""),
                    rules=rules,
                    rate_limits=rate_limits,
                )

        # Single agent response (when agentId filter is used)
        single_agent = data.get("agent")
        if single_agent and isinstance(single_agent, dict):
            agent_id = single_agent.get("agentId", "")
            if agent_id:
                rules = []
                for rule_data in single_agent.get("rules", []):
                    rules.append(
                        PolicyRule(
                            tool=rule_data["tool"],
                            action=Action(rule_data["action"]),
                            constraints=rule_data.get("constraints", {}),
                        )
                    )
                rate_data = single_agent.get("rateLimit", {}) or {}
                rate_limits = RateLimit(
                    max_calls_per_minute=rate_data.get("max_calls_per_minute"),
                    max_calls_per_hour=rate_data.get("max_calls_per_hour"),
                    max_calls_per_day=rate_data.get("max_calls_per_day"),
                )
                agents[agent_id] = AgentPolicy(
                    agent_id=agent_id,
                    description=single_agent.get("description", ""),
                    rules=rules,
                    rate_limits=rate_limits,
                )

        return cls(
            version=data.get("version", "1.0"),
            agents=agents,
            default_action=default_action,
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize policy to a dict (for API sync)."""
        agents_dict: dict[str, Any] = {}
        for agent_id, agent_policy in self.agents.items():
            tools_list = []
            for rule in agent_policy.rules:
                rule_dict: dict[str, Any] = {
                    "tool": rule.tool,
                    "action": rule.action.value,
                }
                if rule.constraints:
                    rule_dict["constraints"] = rule.constraints
                tools_list.append(rule_dict)

            agent_dict: dict[str, Any] = {"tools": tools_list}
            if agent_policy.description:
                agent_dict["description"] = agent_policy.description
            if agent_policy.rate_limits.max_calls_per_minute is not None:
                agent_dict.setdefault("rate_limits", {})[
                    "max_calls_per_minute"
                ] = agent_policy.rate_limits.max_calls_per_minute
            if agent_policy.rate_limits.max_calls_per_hour is not None:
                agent_dict.setdefault("rate_limits", {})[
                    "max_calls_per_hour"
                ] = agent_policy.rate_limits.max_calls_per_hour

            agents_dict[agent_id] = agent_dict

        return {
            "version": self.version,
            "agents": agents_dict,
            "defaults": {
                "action": self.default_action.value,
                "log_level": self.default_log_level,
            },
        }
