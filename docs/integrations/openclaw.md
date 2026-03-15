# OpenClaw Integration

> **Status: Planned** -- This integration is on the VaultAgent roadmap and is not yet available.

## What is OpenClaw?

OpenClaw is an emerging open standard for AI agent permissions. It aims to provide a vendor-neutral, interoperable format for defining and enforcing what AI agents are allowed to do across different platforms, frameworks, and runtimes.

The goal of OpenClaw is to make agent permission policies portable -- write once, enforce everywhere -- regardless of whether the agent is built with OpenAI, Anthropic, LangChain, or any other framework.

## Planned Integration

VaultAgent plans to support OpenClaw as a policy format alongside the existing YAML format. The planned integration includes:

### Policy Import/Export

- **Import:** Load OpenClaw-formatted policies directly into VaultAgent, converting them to the internal `Policy` representation.
- **Export:** Convert VaultAgent YAML policies to OpenClaw format for use with other OpenClaw-compatible tools.

### Runtime Compatibility

- VaultAgent's decision engine would evaluate OpenClaw policies using the same enforcement pipeline (constraint checking, rate limiting, audit logging).
- Existing middleware wrappers (OpenAI, Anthropic, LangChain, MCP) would work without modification.

### Dashboard Support

- The VaultAgent Dashboard would support viewing and editing OpenClaw-formatted policies.
- Audit logs would reference OpenClaw policy identifiers when applicable.

## How This Relates to VaultAgent

VaultAgent's YAML policy format and OpenClaw share similar goals:

| Concept | VaultAgent | OpenClaw |
|---------|-----------|----------|
| Define allowed tools | `tools:` rules with glob matching | Standard permission declarations |
| Constraint enforcement | `constraints:` on rules | Standardized constraint schema |
| Action types | `allow`, `deny`, `require_approval` | To be defined by the standard |
| Audit logging | Built-in JSONL + cloud | Standard audit event format |

When OpenClaw reaches a stable specification, VaultAgent will adopt it as a supported input format while maintaining backward compatibility with the existing YAML policy format.

## Timeline

The OpenClaw standard is currently in development. VaultAgent will track the standard and publish integration support as the specification stabilizes. Watch the [VaultAgent repository](https://github.com/aplomb2/VaultAgent) and [documentation site](https://docs.vaultagent.dev) for updates.

## See Also

- [Policy Reference](../policy-reference.md) -- VaultAgent's current YAML policy format.
- [SDK Reference](../sdk-reference.md) -- Full API documentation.
