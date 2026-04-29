const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { readProductBackendReadiness } = require("../lib/knolet/product-backend-readiness");
const { compileProductBackendContract } = require("../lib/knolet/product-backend-contract");

async function tempWorkspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "knolet-product-contract-"));
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
  return root;
}

const serverEnv = {
  DANCEOFTAL_MODE: "production",
  DANCEOFTAL_STORAGE_MODE: "server",
  DANCEOFTAL_DATA_OWNER: "martinyblue",
  DANCEOFTAL_DATA_API_URL: "https://api.example.com",
  DOT_SUPABASE_URL: "https://auth.example.com",
  DOT_SUPABASE_ANON_KEY: "public-anon-key",
};

test("compiles product backend endpoints from a ready production readiness report", async () => {
  const root = await tempWorkspace();
  const readiness = await readProductBackendReadiness({ root, env: serverEnv });
  const contract = compileProductBackendContract(readiness, {
    generatedAt: "2026-04-30T00:00:00.000Z",
  });

  assert.equal(contract.product_backend_contract_version, "0.1");
  assert.equal(contract.summary.status, "draft_ready");
  assert.equal(contract.summary.endpointCount, 5);
  assert.equal(contract.summary.blockedEndpointCount, 0);
  assert.equal(contract.baseUrl, "https://api.example.com");
  assert.deepEqual(
    contract.endpoints.map((endpoint) => endpoint.key),
    [
      "workspace-snapshot",
      "source-binding-confirmation",
      "run-log-event",
      "library-install-receipt",
      "publish-intent",
    ],
  );
  assert.ok(contract.endpoints.every((endpoint) => endpoint.headers["idempotency-key"]));
});

test("marks endpoint contracts blocked when production readiness is blocked", async () => {
  const root = await tempWorkspace();
  const readiness = await readProductBackendReadiness({ root, env: { DANCEOFTAL_MODE: "production" } });
  const contract = compileProductBackendContract(readiness);

  assert.equal(contract.summary.status, "blocked_by_readiness");
  assert.ok(contract.summary.blockedEndpointCount > 0);
  assert.ok(contract.endpoints.some((endpoint) => endpoint.status === "blocked_by_readiness"));
});

test("keeps contract preview available in development mode", async () => {
  const root = await tempWorkspace();
  const readiness = await readProductBackendReadiness({ root, env: { DANCEOFTAL_MODE: "development" } });
  const contract = compileProductBackendContract(readiness);

  assert.equal(contract.summary.status, "draft_needs_review");
  assert.equal(contract.summary.blockedEndpointCount, 0);
  assert.ok(contract.endpoints.some((endpoint) => endpoint.status === "draft_needs_backend"));
});
