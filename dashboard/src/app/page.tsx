"use client";

import {
  Shield,
  Activity,
  FileText,
  Layers,
  Server,
  Users,
  Check,
  ArrowRight,
  Github,
  Lock,
  AlertTriangle,
  Eye,
  Zap,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import clsx from "clsx";

/* ------------------------------------------------------------------ */
/*  Navigation                                                         */
/* ------------------------------------------------------------------ */

function Navbar() {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <a href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <Shield className="h-4.5 w-4.5 text-emerald-400" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            VaultAgent
          </span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="text-sm text-slate-400 transition hover:text-white"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="text-sm text-slate-400 transition hover:text-white"
          >
            Pricing
          </a>
          <a
            href="https://github.com/vaultagent/vaultagent"
            className="text-sm text-slate-400 transition hover:text-white"
          >
            Docs
          </a>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-400"
          >
            Dashboard
          </a>
        </div>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20">
      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-[400px] w-[400px] rounded-full bg-emerald-600/5 blur-3xl" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 text-center">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-sm text-emerald-400">
          <Zap className="h-3.5 w-3.5" />
          <span>Open Source AI Security Framework</span>
        </div>

        {/* Headline */}
        <h1 className="mx-auto max-w-4xl text-5xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl">
          Permission Control
          <br />
          <span className="gradient-text">for AI Agents</span>
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
          Secure, monitor, and control every tool call your AI agents make.
          Policy-driven permissions with real-time audit logging and
          human-in-the-loop approval workflows.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="/dashboard"
            className="group flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 hover:shadow-emerald-400/25"
          >
            Get Started
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </a>
          <a
            href="https://github.com/vaultagent/vaultagent"
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-6 py-3.5 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
          >
            <Github className="h-4 w-4" />
            View on GitHub
          </a>
        </div>

        {/* Stats */}
        <div className="mx-auto mt-16 flex max-w-lg flex-wrap justify-center gap-8 border-t border-slate-800 pt-8 sm:gap-12">
          {[
            ["10K+", "GitHub Stars"],
            ["500+", "Companies"],
            ["99.9%", "Uptime SLA"],
          ].map(([value, label]) => (
            <div key={label} className="text-center">
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="mt-1 text-sm text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Problem / Solution                                                 */
/* ------------------------------------------------------------------ */

const problems = [
  {
    icon: AlertTriangle,
    title: "Unchecked AI Agents",
    desc: "Agents execute arbitrary tools with no permission boundaries or safety rails.",
  },
  {
    icon: Eye,
    title: "No Audit Trail",
    desc: "Zero visibility into what tools agents call, when, and with what parameters.",
  },
  {
    icon: Lock,
    title: "Compliance Gaps",
    desc: "No way to enforce organizational policies or meet regulatory requirements.",
  },
];

const solutions = [
  {
    icon: Shield,
    title: "Policy-Driven Control",
    desc: "YAML-based rules that define exactly which tools each agent can access.",
  },
  {
    icon: Activity,
    title: "Full Observability",
    desc: "Every tool call logged with parameters, results, latency, and decision context.",
  },
  {
    icon: FileText,
    title: "Compliance Ready",
    desc: "Built-in audit logging and approval workflows for regulatory compliance.",
  },
];

function ProblemSolution() {
  return (
    <section className="border-t border-slate-800/60 bg-slate-950 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            The Problem with AI Agent Security
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Current AI frameworks give agents unlimited tool access. VaultAgent
            fixes that.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Problems */}
          <div className="rounded-2xl border border-red-500/10 bg-red-500/[0.02] p-8">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-red-400">
              <AlertTriangle className="h-3 w-3" />
              Without VaultAgent
            </div>
            <div className="space-y-6">
              {problems.map((p) => (
                <div key={p.title} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                    <p.icon className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{p.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-400">
                      {p.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Solutions */}
          <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.02] p-8">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-emerald-400">
              <Shield className="h-3 w-3" />
              With VaultAgent
            </div>
            <div className="space-y-6">
              {solutions.map((s) => (
                <div key={s.title} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                    <s.icon className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{s.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-400">
                      {s.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Code Example                                                       */
/* ------------------------------------------------------------------ */

function CodeExample() {
  return (
    <section className="border-t border-slate-800/60 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Text */}
          <div>
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Secure in{" "}
              <span className="gradient-text">minutes, not months</span>
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-400">
              Wrap your existing AI framework with VaultAgent in just a few
              lines of code. No architectural changes required.
            </p>

            <ul className="mt-8 space-y-3">
              {[
                "Drop-in wrapper for OpenAI, Anthropic, LangChain",
                "YAML policy files for human-readable rules",
                "Async-first with zero-latency overhead",
                "Full type safety with Python 3.10+",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  <span className="text-slate-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Code block */}
          <div className="glow rounded-2xl border border-slate-800 bg-slate-900">
            {/* Title bar */}
            <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-500/60" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
              <div className="h-3 w-3 rounded-full bg-green-500/60" />
              <span className="ml-3 text-xs text-slate-500">main.py</span>
            </div>

            {/* Code content */}
            <pre className="overflow-x-auto p-6 text-sm leading-relaxed">
              <code>
                <span className="text-violet-400">from</span>
                <span className="text-slate-300"> openai </span>
                <span className="text-violet-400">import</span>
                <span className="text-slate-300"> OpenAI</span>
                {"\n"}
                <span className="text-violet-400">from</span>
                <span className="text-slate-300"> vaultagent </span>
                <span className="text-violet-400">import</span>
                <span className="text-slate-300">
                  {" "}
                  VaultAgent, wrap_openai
                </span>
                {"\n\n"}
                <span className="text-slate-500">
                  # Initialize VaultAgent with policy file
                </span>
                {"\n"}
                <span className="text-slate-300">vault </span>
                <span className="text-violet-400">= </span>
                <span className="text-emerald-400">VaultAgent</span>
                <span className="text-slate-300">(</span>
                {"\n"}
                <span className="text-slate-300">{"    "}policy</span>
                <span className="text-violet-400">=</span>
                <span className="text-amber-300">"policies/agent.yaml"</span>
                <span className="text-slate-300">,</span>
                {"\n"}
                <span className="text-slate-300">{"    "}audit_log</span>
                <span className="text-violet-400">=</span>
                <span className="text-amber-300">"logs/audit.jsonl"</span>
                <span className="text-slate-300">,</span>
                {"\n"}
                <span className="text-slate-300">)</span>
                {"\n\n"}
                <span className="text-slate-500">
                  # Wrap your OpenAI client — that&apos;s it
                </span>
                {"\n"}
                <span className="text-slate-300">client </span>
                <span className="text-violet-400">= </span>
                <span className="text-emerald-400">wrap_openai</span>
                <span className="text-slate-300">(</span>
                {"\n"}
                <span className="text-slate-300">{"    "}</span>
                <span className="text-emerald-400">OpenAI</span>
                <span className="text-slate-300">(),</span>
                {"\n"}
                <span className="text-slate-300">{"    "}vault</span>
                <span className="text-violet-400">=</span>
                <span className="text-slate-300">vault,</span>
                {"\n"}
                <span className="text-slate-300">)</span>
                {"\n\n"}
                <span className="text-slate-500">
                  # All tool calls are now policy-controlled
                </span>
                {"\n"}
                <span className="text-slate-300">response </span>
                <span className="text-violet-400">= </span>
                <span className="text-slate-300">client.chat.completions.</span>
                <span className="text-emerald-400">create</span>
                <span className="text-slate-300">(</span>
                {"\n"}
                <span className="text-slate-300">{"    "}model</span>
                <span className="text-violet-400">=</span>
                <span className="text-amber-300">"gpt-4o"</span>
                <span className="text-slate-300">,</span>
                {"\n"}
                <span className="text-slate-300">{"    "}messages</span>
                <span className="text-violet-400">=</span>
                <span className="text-slate-300">[</span>
                <span className="text-slate-300">{"{"}</span>
                <span className="text-amber-300">"role"</span>
                <span className="text-slate-300">: </span>
                <span className="text-amber-300">"user"</span>
                <span className="text-slate-300">, </span>
                <span className="text-amber-300">"content"</span>
                <span className="text-slate-300">: </span>
                <span className="text-amber-300">"..."</span>
                <span className="text-slate-300">{"}"}</span>
                <span className="text-slate-300">],</span>
                {"\n"}
                <span className="text-slate-300">{"    "}tools</span>
                <span className="text-violet-400">=</span>
                <span className="text-slate-300">tools,</span>
                {"\n"}
                <span className="text-slate-300">)</span>
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Features Grid                                                      */
/* ------------------------------------------------------------------ */

const features = [
  {
    icon: Shield,
    title: "Policy Engine",
    desc: "Define granular, YAML-based permission rules that control exactly which tools each agent can access and under what conditions.",
    color: "emerald" as const,
  },
  {
    icon: Activity,
    title: "Real-time Monitoring",
    desc: "Live dashboard showing agent activity, tool call patterns, policy violations, and approval queue status in real time.",
    color: "emerald" as const,
  },
  {
    icon: FileText,
    title: "Audit Logging",
    desc: "Complete, tamper-evident audit trail of every decision for compliance, debugging, and forensic analysis.",
    color: "emerald" as const,
  },
  {
    icon: Layers,
    title: "Multi-Framework",
    desc: "First-class support for OpenAI, Anthropic, LangChain, and any custom framework with our universal adapter.",
    color: "emerald" as const,
  },
  {
    icon: Server,
    title: "MCP Proxy",
    desc: "Secure Model Context Protocol tool access with policy enforcement at the proxy layer. Full MCP spec compliance.",
    color: "emerald" as const,
  },
  {
    icon: Users,
    title: "Approval Workflows",
    desc: "Human-in-the-loop approval for sensitive operations. Slack, email, and webhook notifications with configurable timeouts.",
    color: "emerald" as const,
  },
];

function Features() {
  return (
    <section
      id="features"
      className="border-t border-slate-800/60 bg-slate-950 py-24"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Everything you need to{" "}
            <span className="gradient-text">secure AI agents</span>
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Enterprise-grade security controls built for the AI agent era.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-emerald-500/20 hover:bg-slate-900"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 transition group-hover:bg-emerald-500/15">
                <f.icon className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Pricing                                                            */
/* ------------------------------------------------------------------ */

interface PricingTier {
  name: string;
  price: string;
  period: string;
  desc: string;
  features: string[];
  cta: string;
  highlighted: boolean;
}

const tiers: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "For individual developers exploring AI agent security.",
    features: [
      "1 agent",
      "1,000 calls/month",
      "Basic policy engine",
      "Community support",
      "7-day log retention",
    ],
    cta: "Get Started Free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    desc: "For developers building production AI applications.",
    features: [
      "10 agents",
      "100,000 calls/month",
      "Advanced policies",
      "Email support",
      "30-day log retention",
      "Approval workflows",
    ],
    cta: "Start Pro Trial",
    highlighted: false,
  },
  {
    name: "Team",
    price: "$99",
    period: "/month",
    desc: "For teams that need collaboration and advanced security.",
    features: [
      "Unlimited agents",
      "1,000,000 calls/month",
      "Priority support",
      "SSO / SAML",
      "90-day log retention",
      "Custom integrations",
      "Team management",
    ],
    cta: "Start Team Trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For organizations with advanced security and compliance needs.",
    features: [
      "Everything in Team",
      "Unlimited calls",
      "99.9% SLA",
      "Dedicated support",
      "On-premise deployment",
      "Custom log retention",
      "Audit certifications",
      "Professional services",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="border-t border-slate-800/60 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Start free. Scale as your AI fleet grows.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={clsx(
                "relative flex flex-col rounded-2xl border p-6",
                tier.highlighted
                  ? "border-emerald-500/30 bg-emerald-500/[0.03] glow-sm"
                  : "border-slate-800 bg-slate-900/50"
              )}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-semibold text-white">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white">
                  {tier.name}
                </h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className="text-sm text-slate-400">
                      {tier.period}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm text-slate-400">{tier.desc}</p>
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {tier.features.map((feat) => (
                  <li
                    key={feat}
                    className="flex items-start gap-2.5 text-sm text-slate-300"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {feat}
                  </li>
                ))}
              </ul>

              <a
                href="#"
                className={clsx(
                  "block rounded-lg py-2.5 text-center text-sm font-semibold transition",
                  tier.highlighted
                    ? "bg-emerald-500 text-white hover:bg-emerald-400"
                    : "border border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white"
                )}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Footer CTA                                                         */
/* ------------------------------------------------------------------ */

function FooterCTA() {
  return (
    <section className="border-t border-slate-800/60 bg-slate-950 py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">
          Ready to secure your AI agents?
        </h2>
        <p className="mt-4 text-lg text-slate-400">
          Get started in minutes with our open-source SDK. No credit card
          required.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="/dashboard"
            className="group flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </a>
          <a
            href="https://github.com/vaultagent/vaultagent"
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-6 py-3.5 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            <Github className="h-4 w-4" />
            Star on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Footer                                                             */
/* ------------------------------------------------------------------ */

function Footer() {
  return (
    <footer className="border-t border-slate-800/60 py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">VaultAgent</span>
        </div>
        <p className="text-sm text-slate-500">
          &copy; {new Date().getFullYear()} VaultAgent. Open source under MIT
          License.
        </p>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/vaultagent/vaultagent"
            className="text-slate-500 transition hover:text-slate-300"
          >
            <Github className="h-5 w-5" />
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950">
      <Navbar />
      <Hero />
      <ProblemSolution />
      <CodeExample />
      <Features />
      <Pricing />
      <FooterCTA />
      <Footer />
    </main>
  );
}
