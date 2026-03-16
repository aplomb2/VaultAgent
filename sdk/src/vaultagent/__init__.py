"""VaultAgent — Permission control for AI Agents."""

from vaultagent.core.audit import AuditEvent, AuditLogger
from vaultagent.core.decision import Decision, DecisionResult
from vaultagent.core.policy import Action, Policy, PolicyRule
from vaultagent.core.vault import VaultAgent

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
