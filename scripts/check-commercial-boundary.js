const os = require("node:os");
const path = require("node:path");

const UPSTREAM_DOT_SUPABASE_URL = "https://qbildcrfjencoqkngyfw.supabase.co";

function isPrivateUrl(value) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(value || "");
}

function buildChecks(env = process.env) {
  const authUrl = (env.DOT_SUPABASE_URL || "").trim();
  const anonKey = (env.DOT_SUPABASE_ANON_KEY || "").trim();
  const studioDir = (env.STUDIO_DIR || "").trim();
  const opencodeConfigDir = (env.OPENCODE_CONFIG_DIR || "").trim();
  const dataApiUrl = (env.DANCEOFTAL_DATA_API_URL || "").trim();

  return [
    {
      key: "dot-auth-backend",
      ok: Boolean(authUrl && authUrl !== UPSTREAM_DOT_SUPABASE_URL),
      label: "DOT auth backend",
      detail: authUrl
        ? authUrl === UPSTREAM_DOT_SUPABASE_URL
          ? "Using upstream DOT Supabase. Set DOT_SUPABASE_URL to your backend."
          : `Using configured auth backend: ${authUrl}`
        : "DOT_SUPABASE_URL is not set. DOT will fall back to the upstream Supabase backend.",
    },
    {
      key: "dot-auth-key",
      ok: Boolean(anonKey),
      label: "DOT auth anon key",
      detail: anonKey ? "DOT_SUPABASE_ANON_KEY is set." : "DOT_SUPABASE_ANON_KEY is required for your auth backend.",
    },
    {
      key: "studio-data-root",
      ok: Boolean(studioDir),
      label: "Studio data root",
      detail: studioDir
        ? `STUDIO_DIR is set: ${studioDir}`
        : `STUDIO_DIR is not set. DOT Studio will store local workspace data under ${path.join(os.homedir(), ".dot-studio")}.`,
      warningOnly: true,
    },
    {
      key: "opencode-data-root",
      ok: Boolean(opencodeConfigDir),
      label: "OpenCode data root",
      detail: opencodeConfigDir
        ? `OPENCODE_CONFIG_DIR is set: ${opencodeConfigDir}`
        : "OPENCODE_CONFIG_DIR is not set for this process. Use a product-owned path in commercial runs.",
      warningOnly: true,
    },
    {
      key: "product-data-api",
      ok: Boolean(dataApiUrl && !isPrivateUrl(dataApiUrl)),
      label: "Product data API",
      detail: dataApiUrl
        ? isPrivateUrl(dataApiUrl)
          ? `DANCEOFTAL_DATA_API_URL points to local development: ${dataApiUrl}`
          : `Product data API configured: ${dataApiUrl}`
        : "DANCEOFTAL_DATA_API_URL is not set yet. Add this before replacing local-only workspace storage.",
      warningOnly: true,
    },
  ];
}

function summarize(checks) {
  const blockers = checks.filter((check) => !check.ok && !check.warningOnly);
  const warnings = checks.filter((check) => !check.ok && check.warningOnly);
  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
  };
}

function main() {
  const checks = buildChecks();
  const summary = summarize(checks);
  const payload = {
    ok: summary.ok,
    checks,
    blockers: summary.blockers.map((check) => check.detail),
    warnings: summary.warnings.map((check) => check.detail),
  };
  console.log(JSON.stringify(payload, null, 2));
  process.exit(summary.ok ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  UPSTREAM_DOT_SUPABASE_URL,
  buildChecks,
  summarize,
};
