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
  Terminal,
  Code2,
  BarChart3,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Navigation                                                         */
/* ------------------------------------------------------------------ */

function Navbar() {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-slate-800/50 bg-slate-950/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <Shield className="h-4 w-4 text-emerald-400" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            VaultAgent
          </span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-slate-400 transition hover:text-white">
            Features
          </a>
          <a href="#how-it-works" className="text-sm text-slate-400 transition hover:text-white">
            How It Works
          </a>
          <a href="#pricing" className="text-sm text-slate-400 transition hover:text-white">
            Pricing
          </a>
          <a
            href="https://github.com/aplomb2/VaultAgent"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-slate-400 transition hover:text-white"
          >
            Docs
          </a>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://github.com/aplomb2/VaultAgent"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 rounded-lg border border-slate-700 px-3.5 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white sm:flex"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
          <a
            href="/login"
            className="text-sm text-slate-400 transition hover:text-white"
          >
            Sign In
          </a>
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
    <section className="relative overflow-hidden pb-24 pt-40">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-20 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-emerald-500/[0.07] blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-sm text-emerald-400">
          <Zap className="h-3.5 w-3.5" />
          Open Source · Apache 2.0
        </div>

        {/* Headline */}
        <h1 className="text-4xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-6xl">
          Permission Control{" "}
          <br className="hidden sm:block" />
          <span className="gradient-text">for AI Agents</span>
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
          Control what your AI agents can and can&apos;t do. Policy-driven
          permissions, real-time audit logging, and human-in-the-loop approval
          — in 3 lines of code.
        </p>

        {/* Install command */}
        <div className="mx-auto mt-10 max-w-md">
          <div className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-900/80 px-5 py-3.5">
            <Terminal className="h-4 w-4 shrink-0 text-slate-500" />
            <code className="flex-1 text-left text-sm text-slate-300">
              pip install vaultagent
            </code>
            <button
              onClick={() => navigator.clipboard?.writeText("pip install vaultagent")}
              className="text-xs text-slate-500 transition hover:text-emerald-400"
            >
              Copy
            </button>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="https://github.com/aplomb2/VaultAgent#quick-start"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 hover:shadow-emerald-400/25"
          >
            Get Started
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </a>
          <a
            href="https://github.com/aplomb2/VaultAgent"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
          >
            <Github className="h-4 w-4" />
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Problem → Solution                                                  */
/* ------------------------------------------------------------------ */

function ProblemSolution() {
  return (
    <section className="border-t border-slate-800/40 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            AI agents have too much power
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
            Today&apos;s frameworks give agents unlimited tool access with no
            audit trail. VaultAgent changes that.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Without */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-8">
            <div className="mb-8 text-xs font-semibold uppercase tracking-widest text-red-400/80">
              Without VaultAgent
            </div>
            <div className="space-y-6">
              {[
                {
                  icon: AlertTriangle,
                  title: "Unchecked Tool Access",
                  desc: "Agents call any tool with any arguments — no boundaries.",
                },
                {
                  icon: Eye,
                  title: "Zero Visibility",
                  desc: "No record of what tools were called, when, or with what data.",
                },
                {
                  icon: Lock,
                  title: "Compliance Blind Spots",
                  desc: "No way to prove agents follow organizational policies.",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                    <item.icon className="h-4 w-4 text-red-400/80" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* With */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-8">
            <div className="mb-8 text-xs font-semibold uppercase tracking-widest text-emerald-400">
              With VaultAgent
            </div>
            <div className="space-y-6">
              {[
                {
                  icon: Shield,
                  title: "Policy-Driven Permissions",
                  desc: "YAML rules define exactly which tools each agent can use.",
                },
                {
                  icon: Activity,
                  title: "Full Observability",
                  desc: "Every tool call logged with parameters, latency, and decision context.",
                },
                {
                  icon: FileText,
                  title: "Compliance Ready",
                  desc: "Audit logs and approval workflows for SOC2, HIPAA, GDPR.",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                    <item.icon className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
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
/*  How It Works                                                        */
/* ------------------------------------------------------------------ */

function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-slate-800/40 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Secure in <span className="gradient-text">3 lines of code</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
            Wrap your existing AI client. No architecture changes.
          </p>
        </div>

        <div className="grid items-start gap-12 lg:grid-cols-2">
          {/* Steps */}
          <div className="space-y-8">
            {[
              {
                step: "01",
                title: "Define your policy",
                desc: "Write a simple YAML file that says which tools each agent can use, with constraints like table whitelists or domain restrictions.",
                icon: FileText,
              },
              {
                step: "02",
                title: "Wrap your AI client",
                desc: "One function call wraps OpenAI, Anthropic, or LangChain. Every tool call now goes through VaultAgent first.",
                icon: Code2,
              },
              {
                step: "03",
                title: "Monitor & control",
                desc: "Watch tool calls in real time. Review approvals. Export audit reports. All from the Dashboard.",
                icon: BarChart3,
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-sm font-bold text-emerald-400">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Code */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/20">
            <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-3">
              <div className="h-3 w-3 rounded-full bg-red-500/50" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/50" />
              <div className="h-3 w-3 rounded-full bg-green-500/50" />
              <span className="ml-3 text-xs text-slate-500">main.py</span>
            </div>
            <pre className="overflow-x-auto p-6 text-[13px] leading-relaxed">
              <code>{`\x1b[0m`}<span className="text-violet-400">from</span>{" "}
                <span className="text-slate-300">openai</span>{" "}
                <span className="text-violet-400">import</span>{" "}
                <span className="text-slate-300">OpenAI</span>{"\n"}
                <span className="text-violet-400">from</span>{" "}
                <span className="text-slate-300">vaultagent</span>{" "}
                <span className="text-violet-400">import</span>{" "}
                <span className="text-slate-300">VaultAgent</span>{"\n"}
                <span className="text-violet-400">from</span>{" "}
                <span className="text-slate-300">vaultagent.middleware</span>{" "}
                <span className="text-violet-400">import</span>{" "}
                <span className="text-slate-300">wrap_openai</span>
                {"\n\n"}
                <span className="text-slate-600"># 1. Load your permission policy</span>{"\n"}
                <span className="text-slate-300">vault = </span>
                <span className="text-emerald-400">VaultAgent</span>
                <span className="text-slate-300">(policy=</span>
                <span className="text-amber-300">&quot;policy.yaml&quot;</span>
                <span className="text-slate-300">)</span>
                {"\n\n"}
                <span className="text-slate-600"># 2. Wrap your client — one line</span>{"\n"}
                <span className="text-slate-300">client = </span>
                <span className="text-emerald-400">wrap_openai</span>
                <span className="text-slate-300">(OpenAI(), vault)</span>
                {"\n\n"}
                <span className="text-slate-600"># 3. Use as normal — all tool calls</span>{"\n"}
                <span className="text-slate-600">#    are now policy-controlled ✓</span>{"\n"}
                <span className="text-slate-300">response = client.chat.completions.</span>
                <span className="text-emerald-400">create</span>
                <span className="text-slate-300">(</span>{"\n"}
                <span className="text-slate-300">    model=</span>
                <span className="text-amber-300">&quot;gpt-4o&quot;</span>
                <span className="text-slate-300">,</span>{"\n"}
                <span className="text-slate-300">    messages=messages,</span>{"\n"}
                <span className="text-slate-300">    tools=tools,</span>{"\n"}
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
    desc: "YAML-based rules with glob patterns, constraints, and per-agent scoping. Human-readable, version-controllable.",
  },
  {
    icon: Activity,
    title: "Real-time Dashboard",
    desc: "Live monitoring of agent activity, tool calls, approval queues, and policy violations.",
  },
  {
    icon: FileText,
    title: "Audit Logging",
    desc: "JSONL audit trail with full context. Export for SOC2, HIPAA, or GDPR compliance.",
  },
  {
    icon: Layers,
    title: "Multi-Framework",
    desc: "Drop-in wrappers for OpenAI, Anthropic, LangChain. Custom adapters via Python decorator.",
  },
  {
    icon: Server,
    title: "MCP Proxy",
    desc: "Protect any MCP server with policy enforcement. Works with Claude Desktop, Cursor, OpenClaw.",
  },
  {
    icon: Users,
    title: "Approval Workflows",
    desc: "Sensitive operations require human approval. Slack, email, and dashboard notifications.",
  },
];

function Features() {
  return (
    <section id="features" className="border-t border-slate-800/40 bg-slate-950/50 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Everything you need to{" "}
            <span className="gradient-text">secure AI agents</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
            Enterprise-grade controls, open-source simplicity.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 transition hover:border-emerald-500/20 hover:bg-slate-900/60"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                <f.icon className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="text-base font-semibold text-white">{f.title}</h3>
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

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "For individual developers and open-source projects.",
    features: [
      "Unlimited SDK usage",
      "Local audit logging",
      "Community support",
      "Self-hosted dashboard",
    ],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$99",
    period: "/month",
    desc: "For teams building production AI applications.",
    features: [
      "10 agents",
      "100K events/day",
      "Cloud dashboard",
      "90-day log retention",
      "Approval workflows",
      "Email support",
    ],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Team",
    price: "$499",
    period: "/month",
    desc: "For organizations with advanced security needs.",
    features: [
      "50 agents",
      "1M events/day",
      "SSO / SAML",
      "1-year log retention",
      "Compliance reports",
      "Priority support",
      "Custom integrations",
    ],
    cta: "Start Free Trial",
    highlighted: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "On-premise deployment with dedicated support.",
    features: [
      "Unlimited agents",
      "Unlimited events",
      "On-premise option",
      "Custom retention",
      "99.9% SLA",
      "Dedicated CSM",
      "SOC2 certification",
      "Professional services",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="border-t border-slate-800/40 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
            Open-source SDK is always free. Pay only for the cloud dashboard.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-4">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                tier.highlighted
                  ? "border-emerald-500/30 bg-emerald-500/[0.04] shadow-lg shadow-emerald-500/5"
                  : "border-slate-800 bg-slate-900/40"
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-semibold text-white">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-base font-semibold text-white">{tier.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">{tier.price}</span>
                  {tier.period && (
                    <span className="text-sm text-slate-500">{tier.period}</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-500">{tier.desc}</p>
              </div>

              <ul className="mb-8 flex-1 space-y-2.5">
                {tier.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {feat}
                  </li>
                ))}
              </ul>

              <a
                href="#"
                className={`block rounded-lg py-2.5 text-center text-sm font-semibold transition ${
                  tier.highlighted
                    ? "bg-emerald-500 text-white hover:bg-emerald-400"
                    : "border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"
                }`}
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
/*  Bottom CTA                                                         */
/* ------------------------------------------------------------------ */

function BottomCTA() {
  return (
    <section className="border-t border-slate-800/40 py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">
          Ready to secure your AI agents?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
          Get started in under 5 minutes. Open source. No credit card required.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="https://github.com/aplomb2/VaultAgent#quick-start"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </a>
          <a
            href="https://github.com/aplomb2/VaultAgent"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
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
    <footer className="border-t border-slate-800/40 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">VaultAgent</span>
        </div>
        <p className="text-sm text-slate-500">
          &copy; {new Date().getFullYear()} VaultAgent. Apache 2.0 License.
        </p>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/aplomb2/VaultAgent"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 transition hover:text-slate-300"
          >
            <Github className="h-5 w-5" />
          </a>
          <a
            href="https://pypi.org/project/vaultagent/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-500 transition hover:text-slate-300"
          >
            PyPI
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
      <HowItWorks />
      <Features />
      <Pricing />
      <BottomCTA />
      <Footer />
    </main>
  );
}
