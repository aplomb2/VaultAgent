"""VaultAgent — Permission control for AI Agents."""

from vaultagent.core.vault import VaultAgent
from vaultagent.core.policy import Policy, PolicyRule, Action
from vaultagent.core.decision import Decision, DecisionResult
from vaultagent.core.audit import AuditEvent, AuditLogger

__version__ = "0.1.0"
__all__ = [
    "VaultAgent",
    "Policy",
    "PolicyRule",
    "Action",
    "Decision",
    "DecisionResult",
    "AuditEvent",
    "AuditLogger",
]
