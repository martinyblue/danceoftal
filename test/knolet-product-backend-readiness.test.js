const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { readProductBackendReadiness } = require("../lib/knolet/product-backend-readiness");

async function tempWorkspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "knolet-product-backend-"));
  await fs.mkdir(path.join(root, ".dance-of-tal"), { recursive: true });
  return root;
}

async function writeJson(root, relativePath, value) {
  const filePath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function spec({ inlineContent = false } = {}) {
  return {
    knolet_spec_version: "0.1",
    metadata: { id: "knolet://acme/mvp/app", name: "Contract Review" },
    knowledge: {
      sources: [
        {
          id: "contract_repository",
          type: "workspace_document",
          label: "Contract repository",
          ...(inlineContent ? { content: "Customer source text" } : {}),
        },
      ],
    },
  };
}

const productionServerEnv = {
  DANCEOFTAL_MODE: "production",
  DANCEOFTAL_STORAGE_MODE: "server",
  DANCEOFTAL_DATA_OWNER: "martinyblue",
  DANCEOFTAL_DATA_API_URL: "https://api.example.com",
  DOT_SUPABASE_URL: "https://auth.example.com",
  DOT_SUPABASE_ANON_KEY: "public-anon-key",
};

test("development readiness is advisory for local-first artifacts", async () => {
  const root = await tempWorkspace();
  await writeJson(root, ".dance-of-tal/knolet.json", spec());

  const readiness = await readProductBackendReadiness({
    root,
    env: { DANCEOFTAL_MODE: "development" },
  });

  assert.equal(readiness.product_backend_readiness_version, "0.1");
  assert.equal(readiness.summary.ready, true);
  assert.equal(readiness.summary.status, "needs_review");
  assert.ok(readiness.diagnosticsByLevel.warning.length > 0);
});

test("production blocks local-first backend surfaces", async () => {
  const root = await tempWorkspace();
  await writeJson(root, ".dance-of-tal/knolet.json", spec());
  await writeJson(root, ".dance-of-tal/runtime-plan.json", {
    runtime_plan_version: "0.1",
    run_log: { id: "run-1", events: [] },
  });

  const readiness = await readProductBackendReadiness({
    root,
    env: { DANCEOFTAL_MODE: "production" },
  });

  assert.equal(readiness.summary.ready, false);
  assert.ok(readiness.diagnosticsByLevel.error.some((item) => item.code === "product-backend-auth-missing"));
  assert.ok(
    readiness.diagnosticsByLevel.error.some((item) => item.code === "product-backend-surface-not-server-backed"),
  );
});

test("production passes when product auth and server storage are configured", async () => {
  const root = await tempWorkspace();
  await writeJson(root, ".dance-of-tal/knolet.json", spec());
  await writeJson(root, ".dance-of-tal/runtime-plan.json", {
    runtime_plan_version: "0.1",
    run_log: { id: "run-1", events: [] },
  });

  const readiness = await readProductBackendReadiness({
    root,
    env: productionServerEnv,
  });

  assert.equal(readiness.summary.ready, true);
  assert.equal(readiness.summary.status, "ready");
  assert.equal(readiness.summary.serverBackedSurfaceCount, 5);
  assert.ok(readiness.surfaces.every((surface) => surface.state === "ok"));
});

test("production rejects inline KnowledgeSource content", async () => {
  const root = await tempWorkspace();
  await writeJson(root, ".dance-of-tal/knolet.json", spec({ inlineContent: true }));

  const readiness = await readProductBackendReadiness({
    root,
    env: productionServerEnv,
  });

  assert.equal(readiness.summary.ready, false);
  assert.ok(
    readiness.diagnosticsByLevel.error.some((item) => item.code === "product-backend-inline-source-content"),
  );
});
