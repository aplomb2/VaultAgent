/**
 * Next.js instrumentation — runs once when the server starts.
 * Validates that all required environment variables are set.
 */

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    validateEnv();
  }
}

function validateEnv() {
  const required: { key: string; hint: string }[] = [
    {
      key: "AUTH_SECRET",
      hint: "Generate with: npx auth secret",
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      hint: "From Supabase project settings → API",
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      hint: "From Supabase project settings → API",
    },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      hint: "From Supabase project settings → API (service_role key)",
    },
  ];

  const missing = required.filter(({ key }) => !process.env[key]);

  if (missing.length > 0) {
    console.error("\n╔══════════════════════════════════════════════════════════╗");
    console.error("║  VaultAgent Dashboard — Missing Environment Variables   ║");
    console.error("╚══════════════════════════════════════════════════════════╝\n");

    for (const { key, hint } of missing) {
      console.error(`  ✗ ${key}`);
      console.error(`    → ${hint}\n`);
    }

    console.error("  Copy dashboard/.env.example to dashboard/.env and fill in the values.");
    console.error("  Docs: https://github.com/aplomb2/VaultAgent#self-hosting\n");
  }

  // Warn about OAuth (not fatal — dashboard still works for API routes)
  const oauthVars = [
    "AUTH_GOOGLE_ID",
    "AUTH_GOOGLE_SECRET",
    "AUTH_GITHUB_ID",
    "AUTH_GITHUB_SECRET",
  ];
  const missingOAuth = oauthVars.filter((key) => !process.env[key]);
  if (missingOAuth.length > 0 && missing.length === 0) {
    console.warn(
      `\n  ⚠ OAuth not fully configured (missing: ${missingOAuth.join(", ")}).` +
        "\n    Dashboard login will not work until OAuth credentials are set." +
        "\n    Self-hosted API routes (/api/v1/setup, /api/v1/ingest) still work.\n",
    );
  }

  // Warn about Stripe (not fatal — billing features disabled without it)
  if (!process.env.STRIPE_SECRET_KEY && missing.length === 0) {
    console.warn(
      "\n  ⚠ STRIPE_SECRET_KEY not set. Billing and subscription features are disabled." +
        "\n    Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_PRO," +
        "\n    and STRIPE_PRICE_ID_TEAM to enable paid plans.\n",
    );
  }
}
