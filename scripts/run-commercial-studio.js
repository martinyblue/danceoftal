const { spawn } = require("node:child_process");
const path = require("node:path");
const {
  UPSTREAM_DOT_SUPABASE_URL,
  buildChecks,
  summarize,
} = require("./check-commercial-boundary");

const root = process.cwd();
const commercialEnv = {
  ...process.env,
  DANCEOFTAL_MODE: process.env.DANCEOFTAL_MODE || "commercial",
};
const checks = buildChecks(commercialEnv);
const summary = summarize(checks);

if (!summary.ok) {
  console.error("Commercial Studio run blocked. Configure your own auth backend first:");
  for (const blocker of summary.blockers) {
    console.error(`- ${blocker.detail}`);
  }
  console.error("");
  console.error("Minimum required environment:");
  console.error("DANCEOFTAL_MODE=commercial");
  console.error("DOT_SUPABASE_URL=https://auth.your-domain.example");
  console.error("DOT_SUPABASE_ANON_KEY=<your-public-anon-key>");
  console.error("");
  console.error(`Do not use the upstream DOT Supabase URL: ${UPSTREAM_DOT_SUPABASE_URL}`);
  process.exit(1);
}

const env = {
  ...commercialEnv,
  PATH: `${path.join(root, ".tools", "bin")}:/tmp/node-v22.11.0-darwin-arm64/bin:${process.env.PATH || ""}`,
  STUDIO_DIR:
    process.env.STUDIO_DIR ||
    path.join(root, ".dance-of-tal", "commercial", "studio-data"),
  OPENCODE_CONFIG_DIR:
    process.env.OPENCODE_CONFIG_DIR ||
    path.join(root, ".dance-of-tal", "commercial", "opencode"),
};

const child = spawn(
  "dot-studio",
  [
    "open",
    ".",
    "--port",
    process.env.DOT_STUDIO_PORT || "43110",
    "--opencode-url",
    process.env.OPENCODE_URL || "http://127.0.0.1:43120",
    "--no-open",
  ],
  {
    cwd: root,
    env,
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
