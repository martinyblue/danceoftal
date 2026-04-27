const os = require("node:os");
const path = require("node:path");

const UPSTREAM_DOT_SUPABASE_URL = "https://qbildcrfjencoqkngyfw.supabase.co";
const MODES = new Set(["development", "commercial", "production"]);

function isPrivateUrl(value) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(value || "");
}

function normalizeMode(value) {
  const mode = String(value || "development").trim().toLowerCase();
  return MODES.has(mode) ? mode : "development";
}

function modePolicy(mode) {
  return {
    mode,
    localFirst: mode === "development",
    authRequired: mode === "commercial" || mode === "production",
    serverDataRequired: mode === "production",
  };
}

function buildChecks(env = process.env) {
  const mode = normalizeMode(env.DANCEOFTAL_MODE || env.NODE_ENV);
  const policy = modePolicy(mode);
  const authUrl = (env.DOT_SUPABASE_URL || "").trim();
  const anonKey = (env.DOT_SUPABASE_ANON_KEY || "").trim();
  const studioDir = (env.STUDIO_DIR || "").trim();
  const opencodeConfigDir = (env.OPENCODE_CONFIG_DIR || "").trim();
  const dataApiUrl = (env.DANCEOFTAL_DATA_API_URL || "").trim();
  const storageMode = String(env.DANCEOFTAL_STORAGE_MODE || "local").trim().toLowerCase();
  const dataOwner = (env.DANCEOFTAL_DATA_OWNER || "").trim();

  return [
    {
      key: "runtime-mode",
      ok: true,
      label: "Runtime mode",
      detail:
        mode === "development"
          ? "Development mode keeps the current local-first feature set enabled."
          : `${mode} mode enables product data-boundary checks.`,
      mode,
    },
    {
      key: "dot-auth-backend",
      ok: Boolean(authUrl && authUrl !== UPSTREAM_DOT_SUPABASE_URL),
      label: "DOT auth backend",
      detail: authUrl
        ? authUrl === UPSTREAM_DOT_SUPABASE_URL
          ? "Using upstream DOT Supabase. Set DOT_SUPABASE_URL to your backend."
          : `Using configured auth backend: ${authUrl}`
        : "DOT_SUPABASE_URL is not set. DOT will fall back to the upstream Supabase backend.",
      warningOnly: !policy.authRequired,
    },
    {
      key: "dot-auth-key",
      ok: Boolean(anonKey),
      label: "DOT auth anon key",
      detail: anonKey ? "DOT_SUPABASE_ANON_KEY is set." : "DOT_SUPABASE_ANON_KEY is required for your auth backend.",
      warningOnly: !policy.authRequired,
    },
    {
      key: "product-data-owner",
      ok: Boolean(dataOwner),
      label: "Product data owner",
      detail: dataOwner
        ? `Product data owner is set: ${dataOwner}`
        : "DANCEOFTAL_DATA_OWNER is not set. Add the owning product/account before production.",
      warningOnly: !policy.serverDataRequired,
    },
    {
      key: "storage-mode",
      ok: policy.serverDataRequired ? storageMode === "server" : true,
      label: "Storage mode",
      detail:
        storageMode === "server"
          ? "Server storage mode is selected for product data."
          : `Storage mode is ${storageMode}; development keeps local workspace behavior enabled.`,
      warningOnly: !policy.serverDataRequired,
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
      warningOnly: !policy.serverDataRequired,
    },
  ];
}

function summarize(checks) {
  const blockers = checks.filter((check) => !check.ok && !check.warningOnly);
  const warnings = checks.filter((check) => !check.ok && check.warningOnly);
  const mode = checks.find((check) => check.key === "runtime-mode")?.mode || "development";
  return {
    mode,
    ok: blockers.length === 0,
    blockers,
    warnings,
  };
}

function main() {
  const checks = buildChecks();
  const summary = summarize(checks);
  const payload = {
    mode: summary.mode,
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
  modePolicy,
  normalizeMode,
  summarize,
};
