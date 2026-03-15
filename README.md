# 🔐 VaultAgent

**Permission control for AI Agents — control what your agents can and cannot do.**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.10+-blue.svg)](https://python.org)
[![PyPI](https://img.shields.io/pypi/v/vaultagent.svg)](https://pypi.org/project/vaultagent/)

---

> VaultAgent is an open-source SDK + cloud dashboard that gives you **fine-grained permission control** over AI agent tool calls. Think of it as **IAM for AI Agents**.

## The Problem

AI Agents can call tools — read files, send emails, query databases, call APIs. But today:

- ❌ Agents have **unlimited access** to all tools by default
- ❌ **No one knows** what the agent actually did
- ❌ No difference between **read and write** operations
- ❌ Multiple agents share the **same permission space**
- ❌ Enterprise compliance teams **can't audit** agent behavior

## The Solution

```python
from vaultagent import VaultAgent

vault = VaultAgent(api_key="va_sk_xxx")  # or use local policy file

@vault.protect()
def send_email(to: str, subject: str, body: str):
    """This tool requires human approval before execution."""
    return email_client.send(to, subject, body)

@vault.protect()
def query_database(sql: str):
    """This tool is allowed but constrained to SELECT only."""
    return db.execute(sql)
```

That's it. 3 lines to add permission control. Every tool call is now:

- ✅ **Checked** against your policy (allow / deny / require approval)
- ✅ **Logged** with full audit trail
- ✅ **Visible** in your real-time dashboard
- ✅ **Controllable** by your team, not just your developers

## How It Works

```
Your AI Agent
    │
    │ tool call: send_email(to="john@...", subject="Refund")
    ▼
┌─────────────────────────────┐
│      VaultAgent SDK         │
│                             │
│  1. Check policy            │  → Is this agent allowed to send email?
│  2. Validate constraints    │  → Is the recipient in the whitelist?
│  3. Apply rate limits       │  → Has the agent exceeded its quota?
│  4. Decision:               │
│     ✅ allow → execute      │
│     ❌ deny → block         │
│     ⏳ require_approval →   │  → Send to Dashboard for human review
│  5. Log everything          │  → Audit trail to Dashboard
└─────────────────────────────┘
    │
    ▼
Actual tool execution (or rejection)
```

## Quick Start

### Installation

```bash
pip install vaultagent
```

### Option 1: Local Policy (no cloud needed)

```python
from vaultagent import VaultAgent

vault = VaultAgent(policy="vaultagent.policy.yaml")
```

```yaml
# vaultagent.policy.yaml
version: "1.0"
agents:
  my-agent:
    tools:
      - tool: "database.query"
        action: allow
        constraints:
          operations: ["SELECT"]
      - tool: "email.send"
        action: require_approval
      - tool: "*"
        action: deny
defaults:
  action: deny
```

### Option 2: Cloud Dashboard

```python
from vaultagent import VaultAgent

# Policy managed in Dashboard, audit logs sent to cloud
vault = VaultAgent(api_key="va_sk_xxx", agent_id="my-agent")
```

Sign up at [vaultagent.dev](https://vaultagent.dev) to get your API key.

## Framework Integrations

### OpenAI

```python
from vaultagent.middleware import wrap_openai
from openai import OpenAI

client = wrap_openai(OpenAI(), vault)
# All tool calls are now protected by VaultAgent
```

### Anthropic Claude

```python
from vaultagent.middleware import wrap_anthropic
from anthropic import Anthropic

client = wrap_anthropic(Anthropic(), vault)
```

### LangChain

```python
from vaultagent.middleware import wrap_langchain_tools

tools = wrap_langchain_tools([search_tool, email_tool], vault)
agent = create_agent(llm, tools)
```

### MCP (Model Context Protocol)

VaultAgent can run as an MCP proxy server, adding permission control to any MCP server:

```bash
vaultagent mcp-proxy \
  --upstream "npx -y @modelcontextprotocol/server-github" \
  --policy vaultagent.policy.yaml \
  --api-key va_sk_xxx
```

Works with OpenClaw, Claude Desktop, Cursor, and any MCP-compatible client.

## Dashboard

The VaultAgent Dashboard gives your team real-time visibility into agent behavior:

- 📊 **Live Monitor** — Real-time feed of every tool call
- 🔒 **Policy Manager** — Visual editor for permission rules
- ⏳ **Approval Queue** — Review and approve sensitive operations
- 📋 **Compliance Reports** — One-click SOC2/HIPAA/GDPR exports
- 🔔 **Smart Alerts** — Slack/email notifications for anomalies
- 👥 **Team Management** — SSO + role-based access control

## Policy Reference

### Actions

| Action | Behavior |
|--------|----------|
| `allow` | Tool call executes immediately |
| `deny` | Tool call is blocked, error returned to agent |
| `require_approval` | Tool call paused, sent to Dashboard for human review |

### Constraints

```yaml
constraints:
  tables: ["users", "orders"]        # Database table whitelist
  operations: ["SELECT"]             # SQL operation whitelist
  paths: ["/tmp/reports/*"]          # File path whitelist
  domains: ["*.company.com"]         # Email/URL domain whitelist
  max_rows: 10000                    # Result size limit
```

### Rate Limits

```yaml
rate_limits:
  max_calls_per_minute: 30
  max_calls_per_hour: 500
  max_calls_per_day: 5000
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│            VaultAgent Cloud Dashboard            │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │Monitor│ │Policy│ │Approve│ │Report│ │Alert │  │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘  │
└────────────────────┬────────────────────────────┘
                     │ API
    ┌────────────────┼────────────────┐
    ▼                ▼                ▼
┌────────┐    ┌────────┐    ┌────────┐
│ App A  │    │ App B  │    │ App C  │
│  SDK   │    │  SDK   │    │MCP Proxy│
└────────┘    └────────┘    └────────┘
```

## Pricing

| Plan | Price | Agents | Events/day | Log Retention |
|------|-------|--------|------------|---------------|
| Free | $0 | 1 | 1,000 | 7 days |
| Pro | $99/mo | 10 | 100K | 90 days |
| Team | $499/mo | 50 | 1M | 1 year |
| Enterprise | Custom | Unlimited | Unlimited | Custom |

Self-hosted SDK and Dashboard are always free and open-source.

## Self-Hosting

You can run the entire VaultAgent stack on your own infrastructure — no cloud account needed.

### Option 1: Docker (Recommended)

```bash
git clone https://github.com/aplomb2/VaultAgent.git
cd VaultAgent

# Start the dashboard
docker compose up -d

# Dashboard is now at http://localhost:3000
```

### Option 2: Manual

```bash
# Dashboard
cd dashboard
npm install
npm run build
npm start
# → http://localhost:3000

# SDK (Python)
pip install vaultagent

# Point SDK to your self-hosted dashboard
vault = VaultAgent(
    policy="policy.yaml",
    api_key="your-local-key",          # Configure in dashboard
    cloud_endpoint="http://localhost:3000/api/v1"
)
```

### Option 3: SDK Only (No Dashboard)

```bash
pip install vaultagent
```

```python
# Pure local mode — logs to file, no cloud dependency
vault = VaultAgent(policy="policy.yaml", audit_file="audit.jsonl")
```

All audit logs stay on your machine. Zero data leaves your network.

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.

---

**VaultAgent** — Because AI agents shouldn't have root access.

[Website](https://vaultagent.dev) · [Docs](https://docs.vaultagent.dev) · [Dashboard](https://app.vaultagent.dev) · [Discord](https://discord.gg/vaultagent)
