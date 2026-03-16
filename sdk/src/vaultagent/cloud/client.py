"""Cloud reporter — sends audit events to VaultAgent Cloud."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from vaultagent.core.audit import AuditEvent

logger = logging.getLogger("vaultagent.cloud")

CLOUD_BASE_URL = "https://api.vaultagent.dev"


class CloudReporter:
    """Sends audit events and fetches policies from VaultAgent Cloud."""

    def __init__(
        self,
        api_key: str,
        base_url: str = CLOUD_BASE_URL,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._client: Any = None

    def _get_client(self) -> Any:
        """Lazy-init httpx client."""
        if self._client is None:
            import httpx

            self._client = httpx.Client(
                base_url=self.base_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "User-Agent": "vaultagent-sdk/0.1.0",
                },
                timeout=10.0,
            )
        return self._client

    def send_events(self, events: list[AuditEvent]) -> bool:
        """Send a batch of audit events to VaultAgent Cloud."""
        try:
            client = self._get_client()
            response = client.post(
                "/api/v1/ingest",
                json={"events": [e.to_dict() for e in events]},
            )
            if response.status_code == 200:
                return True
            logger.warning(
                f"Cloud ingest returned {response.status_code}: {response.text[:200]}"
            )
            return False
        except Exception as e:
            logger.error(f"Failed to send events to cloud: {e}")
            return False

    def fetch_policy(self, agent_id: str) -> dict[str, Any] | None:
        """Fetch policy for an agent from VaultAgent Cloud."""
        try:
            client = self._get_client()
            response = client.get(
                "/api/v1/policy",
                params={"agentId": agent_id},
            )
            if response.status_code == 200:
                return response.json()  # type: ignore[no-any-return]
            logger.warning(
                f"Cloud policy fetch returned {response.status_code}: {response.text[:200]}"
            )
            return None
        except Exception as e:
            logger.error(f"Failed to fetch policy from cloud: {e}")
            return None

    def submit_approval(
        self,
        agent_id: str,
        tool: str,
        input_args: dict[str, Any],
        timeout_seconds: int = 300,
    ) -> dict[str, Any] | None:
        """Submit an approval request to VaultAgent Cloud."""
        try:
            client = self._get_client()
            response = client.post(
                "/api/v1/approvals",
                json={
                    "agent_id": agent_id,
                    "tool": tool,
                    "input": input_args,
                    "timeout_seconds": timeout_seconds,
                },
            )
            if response.status_code in (200, 201):
                return response.json()  # type: ignore[no-any-return]
            return None
        except Exception as e:
            logger.error(f"Failed to submit approval: {e}")
            return None
