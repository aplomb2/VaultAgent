# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VaultAgent is an open-source permission control layer for AI agents (IAM for AI Agents). It has three independent components in a monorepo:

- **`dashboard/`** — Next.js 14 web app (SaaS dashboard for monitoring, policy management, approvals)
- **`sdk/`** — Python SDK published to PyPI as `vaultagent` (permission enforcement middleware)
- **`mcp-server/`** — TypeScript MCP proxy server (wraps any MCP server with policy enforcement)

## Common Commands

### Dashboard (Next.js)
```bash
cd dashboard
npm install
npm run dev          # Dev server on port 3000
npm run build        # Production build
npm run lint         # ESLint
```

### SDK (Python)
```bash
cd sdk
pip install -e ".[dev]"          # Install with dev deps (pytest, ruff, mypy)
pip install -e ".[all]"          # Install with all middleware extras
pytest                           # Run all tests
pytest tests/test_policy.py      # Run a single test file
ruff check src/                  # Lint
mypy src/                        # Type check (strict mode)
```

### MCP Proxy Server
```bash
cd mcp-server
npm install
npm run build        # Compile TypeScript
npm run dev          # Development mode (tsx)
```

### Docker (Self-Hosting)
```bash
docker compose up -d   # Starts dashboard on port 3000
```

## Architecture

### Dashboard (`dashboard/`)

Next.js 14 App Router with Supabase backend and NextAuth v5 (beta) for authentication.

**Routing:**
- `/` — Landing page (public)
- `/login` — OAuth sign-in (Google + GitHub)
- `/dashboard/*` — Protected pages (agents, policies, logs, approvals)

**Auth flow:** NextAuth v5 with JWT strategy. Middleware at `dashboard/middleware.ts` protects `/dashboard/*` routes, redirecting unauthenticated users to `/login`. OAuth callbacks upsert users into Supabase `users` table.

**API routes** (`dashboard/src/app/api/`):
- `/api/auth/[...nextauth]` — NextAuth handlers
- `/api/v1/ingest` — SDK posts audit events here (Bearer token auth)
- `/api/v1/approvals` — Approval CRUD (GET/POST/PATCH)
- `/api/v1/policy` — Policy fetch for SDK (Bearer token auth)

Public API routes (`/api/v1/*`) authenticate via Bearer token matched against agent API keys in Supabase. Dashboard routes use NextAuth sessions.

**Supabase:** Two client factories in `dashboard/src/lib/supabase.ts`:
- `createClient()` — Browser/anon key (respects RLS)
- `createServiceClient()` — Service role key (bypasses RLS, server-side only)

**Database tables:** `users`, `agents`, `audit_logs`, `approvals`, `policies`

**Key libraries:** React 18, Tailwind CSS 3.4, Recharts (charts), Lucide (icons), clsx

**Next.js config:** Uses `output: "standalone"` for Docker deployment.

### SDK (`sdk/`)

Python package (hatchling build system). Source code in `sdk/src/vaultagent/`.

**Core flow:** Policy loaded (YAML file or cloud) → tool call intercepted → decision engine checks policy → allow/deny/require_approval → audit logged.

**Module layout:**
- `core/vault.py` — Main `VaultAgent` class
- `core/policy.py` — YAML policy parsing
- `core/decision.py` — Decision engine (allow/deny/require_approval)
- `core/audit.py` — Event logging (local file or cloud)
- `core/rate_limit.py` — Rate limiting
- `middleware/` — Wrappers for OpenAI, Anthropic, LangChain clients
- `cloud/client.py` — Cloud API communication (httpx)
- `cli.py` — CLI entry point (`vaultagent init|validate|test|logs`)

**Python version:** 3.10+. Ruff configured for line-length 100. mypy strict mode enabled.

### MCP Proxy (`mcp-server/`)

TypeScript CLI tool that wraps any MCP server, enforcing VaultAgent policies before forwarding tool calls. Entry point: `mcp-server/src/index.ts`. Uses `@modelcontextprotocol/sdk`, `js-yaml`, and `zod` for validation.

## Environment Variables

Dashboard requires these in `dashboard/.env` (see `dashboard/.env.example`):

```
AUTH_SECRET                      # NextAuth secret (generate with: npx auth secret)
AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET    # Google OAuth
AUTH_GITHUB_ID / AUTH_GITHUB_SECRET    # GitHub OAuth
NEXT_PUBLIC_SUPABASE_URL               # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY          # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY              # Supabase service role key (server-side)
VAULTAGENT_API_SECRET                  # Optional: SDK bearer token auth
```

## Policy Format

Policies are YAML files with this structure:
```yaml
version: "1.0"
defaults:
  action: deny
agents:
  agent-name:
    tools:
      - tool: "tool.name"
        action: allow|deny|require_approval
        constraints: { ... }
    rate_limits:
      max_calls_per_minute: 30
```

Three actions: `allow` (execute), `deny` (block), `require_approval` (pause for human review).

## Data Flow: SDK → Dashboard

1. SDK calls `POST /api/v1/ingest` with Bearer token and audit events
2. API route validates token by looking up agent in Supabase
3. Events stored in `audit_logs` table, counters updated on `agents` table
4. Dashboard pages query Supabase via server-side calls
