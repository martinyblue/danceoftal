const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { readProductBackendReadiness } = require("../lib/knolet/product-backend-readiness");
const { compileProductBackendContract } = require("../lib/knolet/product-backend-contract");
const { previewProductBackendAdapter } = require("../lib/knolet/product-backend-adapter");
const { readProductPermissions } = require("../lib/knolet/product-permissions");
const { compilePublishGovernanceReceipt } = require("../lib/knolet/publish-governance");
const { compileProductBackendConnectionPlan } = require("../lib/knolet/product-backend-connection-plan");

async function tempWorkspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "knolet-backend-connection-"));
  await fs.mkdir(path.join(root, ".dance-of-tal"), { recursive: true });
  return root;
}

function publishIntent() {
  return {
    workspace_id: "martinyblue-local",
    publish_intent_id: "publish_1",
    target: { kind: "knolet_library", owner: "martinyblue", stage: "local" },
    artifact_refs: [{ kind: "library_package", id: "pkg_1", status: "shareable" }],
    share_policy: { copies_source_documents: false },
  };
}

async function compilePlan({ root, env, writeEnabled = false, tokenPresent = false }) {
  const readiness = await readProductBackendReadiness({ root, env });
  const contract = compileProductBackendContract(readiness);
  const adapter = previewProductBackendAdapter(readiness, contract);
  const permissions = readProductPermissions({ env });
  const governance = compilePublishGovernanceReceipt({
    readiness,
    permissions,
    intent: publishIntent(),
  });
  return compileProductBackendConnectionPlan({
    readiness,
    contract,
    adapter,
    permissions,
    governance,
    writeEnabled,
    tokenPresent,
  });
}

const productionServerEnv = {
  DANCEOFTAL_MODE: "production",
  DANCEOFTAL_STORAGE_MODE: "server",
  DANCEOFTAL_DATA_OWNER: "martinyblue",
  DANCEOFTAL_DATA_API_URL: "https://api.example.com",
  DOT_SUPABASE_URL: "https://auth.example.com",
  DOT_SUPABASE_ANON_KEY: "public-anon-key",
  DANCEOFTAL_ACTOR_ID: "actor-1",
  DANCEOFTAL_ACTOR_ROLE: "admin",
};

test("development connection plan recommends backend configuration without blocking local work", async () => {
  const root = await tempWorkspace();
  const plan = await compilePlan({
    root,
    env: { DANCEOFTAL_MODE: "development" },
  });

  assert.equal(plan.product_backend_connection_plan_version, "0.1");
  assert.equal(plan.status, "needs_backend");
  assert.equal(plan.summary.ready, false);
  assert.equal(plan.summary.blockedStepCount, 0);
  assert.ok(plan.summary.warningStepCount > 0);
  assert.equal(plan.nextRecommendedStep.key, "configure-product-auth");
});

test("production connection plan is blocked when product backend env is missing", async () => {
  const root = await tempWorkspace();
  const plan = await compilePlan({
    root,
    env: { DANCEOFTAL_MODE: "production" },
  });

  assert.equal(plan.status, "blocked");
  assert.ok(plan.summary.blockedStepCount >= 3);
  assert.ok(plan.diagnosticsByLevel.error.some((item) => item.code === "backend-connection-configure-product-auth"));
});

test("server-backed production connection plan becomes ready with write switch and token", async () => {
  const root = await tempWorkspace();
  const plan = await compilePlan({
    root,
    env: productionServerEnv,
    writeEnabled: true,
    tokenPresent: true,
  });

  assert.equal(plan.status, "ready_to_connect");
  assert.equal(plan.summary.ready, true);
  assert.equal(plan.summary.localOnlyRecommendationExhausted, true);
  assert.equal(plan.nextRecommendedStep.key, "no-local-only-recommendation");
});
