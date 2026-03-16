-- VaultAgent Database Schema
-- Run this in the Supabase SQL Editor to set up all required tables.

-- ============================================================
-- 1. users
-- ============================================================
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  name        text not null default '',
  avatar_url  text not null default '',
  provider    text not null default 'oauth',
  plan        text not null default 'free',
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 2. agents
-- ============================================================
create table if not exists agents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  name          text not null,
  api_key       text not null unique,
  status        text not null default 'active'
                  check (status in ('active', 'inactive', 'suspended')),
  total_calls   integer not null default 0,
  denied_calls  integer not null default 0,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz
);

create index if not exists idx_agents_user_id on agents(user_id);
create index if not exists idx_agents_api_key on agents(api_key);

-- ============================================================
-- 3. audit_logs
-- ============================================================
create table if not exists audit_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  agent_id        uuid not null references agents(id) on delete cascade,
  tool            text not null,
  action          text not null
                    check (action in ('allow', 'deny', 'require_approval')),
  denial_reason   text,
  input_args      jsonb,
  input_hash      text,
  session_id      text,
  latency_ms      integer,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_audit_logs_user_id on audit_logs(user_id);
create index if not exists idx_audit_logs_agent_id on audit_logs(agent_id);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at desc);

-- ============================================================
-- 4. approvals
-- ============================================================
create table if not exists approvals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  agent_id      uuid not null references agents(id) on delete cascade,
  tool          text not null,
  input_args    jsonb not null default '{}'::jsonb,
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   text
);

create index if not exists idx_approvals_user_id on approvals(user_id);
create index if not exists idx_approvals_status on approvals(status);

-- ============================================================
-- 5. policies
-- ============================================================
create table if not exists policies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  name        text not null default 'default',
  version     text not null default '1.0.0',
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_policies_user_id on policies(user_id);

-- ============================================================
-- RPC: Atomically increment agent call counters
-- ============================================================
create or replace function increment_agent_counters(
  p_agent_id uuid,
  p_total    integer,
  p_denied   integer
)
returns void
language sql
as $$
  update agents
  set
    total_calls  = total_calls  + p_total,
    denied_calls = denied_calls + p_denied,
    last_seen_at = now()
  where id = p_agent_id;
$$;

-- ============================================================
-- Row Level Security (RLS)
-- Enable RLS on all tables. The dashboard uses the service_role
-- key (bypasses RLS) for server-side operations, but RLS is
-- enabled as defense-in-depth for any browser/anon key access.
-- ============================================================
alter table users       enable row level security;
alter table agents      enable row level security;
alter table audit_logs  enable row level security;
alter table approvals   enable row level security;
alter table policies    enable row level security;
