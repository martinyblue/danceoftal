const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { readProductBackendReadiness } = require("../lib/knolet/product-backend-readiness");
const { compileProductBackendContract } = require("../lib/knolet/product-backend-contract");
const {
  executeProductBackendWrite,
  planProductBackendWrite,
  previewProductBackendAdapter,
} = require("../lib/knolet/product-backend-adapter");

async function readinessAndContract(env) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "knolet-product-adapter-"));
  await fs.mkdir(path.join(root, ".dance-of-tal"), { recursive: true });
  await fs.writeFile(
    path.join(root, ".dance-of-tal", "knolet.json"),
    JSON.stringify(
      {
        knolet_spec_version: "0.1",
        metadata: { id: "knolet://acme/mvp/app", name: "Contract Review" },
        knowledge: {
          sources: [{ id: "contract_repository", type: "workspace_document", label: "Contract repository" }],
        },
      },
      null,
      2,
    ),
  );
  const readiness = await readProductBackendReadiness({ root, env });
  const contract = compileProductBackendContract(readiness);
  return { readiness, contract };
}

const serverEnv = {
  DANCEOFTAL_MODE: "production",
  DANCEOFTAL_STORAGE_MODE: "server",
  DANCEOFTAL_DATA_OWNER: "martinyblue",
  DANCEOFTAL_DATA_API_URL: "https://api.example.com",
  DOT_SUPABASE_URL: "https://auth.example.com",
  DOT_SUPABASE_ANON_KEY: "public-anon-key",
};

const workspacePayload = {
  workspace_id: "workspace_1",
  snapshot_id: "snapshot_1",
  owner: "martinyblue",
  knolet_spec: { ref: "spec" },
  runtime_plan: { ref: "runtime" },
  graph_model: { ref: "graph" },
};

test("development adapter preview uses local passthrough", async () => {
  const { readiness, contract } = await readinessAndContract({ DANCEOFTAL_MODE: "development" });
  const preview = previewProductBackendAdapter(readiness, contract);

  assert.equal(preview.product_backend_adapter_version, "0.1");
  assert.equal(preview.status, "local_passthrough");
  assert.equal(preview.summary.blockedCount, 0);
  assert.ok(preview.plans.every((plan) => plan.status === "local_passthrough"));
});

test("production adapter blocks when readiness is blocked", async () => {
  const { readiness, contract } = await readinessAndContract({ DANCEOFTAL_MODE: "production" });
  const plan = planProductBackendWrite("workspace_snapshot", workspacePayload, { readiness, contract });

  assert.equal(plan.status, "blocked");
  assert.equal(plan.reason, "readiness_blocked");
});

test("server-backed adapter supports dry-run planning", async () => {
  const { readiness, contract } = await readinessAndContract(serverEnv);
  const plan = planProductBackendWrite("workspace_snapshot", workspacePayload, {
    readiness,
    contract,
    dryRun: true,
  });

  assert.equal(plan.status, "dry_run");
  assert.equal(plan.endpoint.url, "https://api.example.com/v1/workspaces/workspace_1/snapshots");
});

test("server-backed adapter sends through fetch when ready", async () => {
  const { readiness, contract } = await readinessAndContract(serverEnv);
  const calls = [];
  const result = await executeProductBackendWrite("workspace_snapshot", workspacePayload, {
    readiness,
    contract,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ snapshot_id: "snapshot_1", stored_at: "2026-04-30T00:00:00.000Z" }),
      };
    },
  });

  assert.equal(result.status, "sent");
  assert.equal(calls[0].url, "https://api.example.com/v1/workspaces/workspace_1/snapshots");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["content-type"], "application/json");
});

test("adapter blocks incomplete payloads before network writes", async () => {
  const { readiness, contract } = await readinessAndContract(serverEnv);
  const result = await executeProductBackendWrite("workspace_snapshot", { workspace_id: "workspace_1" }, {
    readiness,
    contract,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.plan.reason, "missing_required_fields");
  assert.ok(result.plan.missing.includes("snapshot_id"));
});
