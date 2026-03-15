"""Tests for the main VaultAgent class."""

import pytest
import tempfile
from pathlib import Path

from vaultagent import VaultAgent
from vaultagent.core.vault import PermissionDeniedError, ApprovalRequiredError


POLICY_YAML = """
version: "1.0"
agents:
  my-agent:
    tools:
      - tool: "search"
        action: allow
      - tool: "email.send"
        action: require_approval
      - tool: "database.delete"
        action: deny
      - tool: "*"
        action: deny
    rate_limits:
      max_calls_per_minute: 5
defaults:
  action: deny
"""


@pytest.fixture
def policy_file(tmp_path):
    p = tmp_path / "policy.yaml"
    p.write_text(POLICY_YAML)
    return p


@pytest.fixture
def vault(policy_file):
    return VaultAgent(policy=policy_file, agent_id="my-agent", audit_file=None)


class TestVaultAgentBasic:
    def test_allow(self, vault):
        result = vault.check("search")
        assert result.allowed

    def test_deny(self, vault):
        with pytest.raises(PermissionDeniedError):
            vault.enforce("database.delete")

    def test_require_approval(self, vault):
        with pytest.raises(ApprovalRequiredError):
            vault.enforce("email.send")

    def test_unknown_tool_denied(self, vault):
        with pytest.raises(PermissionDeniedError):
            vault.enforce("unknown.tool")


class TestProtectDecorator:
    def test_allowed_function_executes(self, vault):
        @vault.protect()
        def search(query: str) -> str:
            return f"results for {query}"

        result = search(query="test")
        assert result == "results for test"

    def test_denied_function_raises(self, vault):
        @vault.protect(tool_name="database.delete")
        def delete_all():
            return "deleted"

        with pytest.raises(PermissionDeniedError):
            delete_all()

    def test_custom_tool_name(self, vault):
        @vault.protect(tool_name="search")
        def my_custom_search(**kwargs):
            return "found"

        result = my_custom_search(query="test")
        assert result == "found"


class TestAuditLogging:
    def test_audit_file_created(self, policy_file, tmp_path):
        audit_file = tmp_path / "audit.jsonl"
        v = VaultAgent(
            policy=policy_file,
            agent_id="my-agent",
            audit_file=audit_file,
        )
        v.check("search")
        assert audit_file.exists()
        content = audit_file.read_text()
        assert "search" in content
        assert '"allow"' in content
