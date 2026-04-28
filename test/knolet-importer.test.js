const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { importDotWorkspace } = require("../lib/knolet/dot-importer");
const { validateKnoletSpec } = require("../lib/knolet/schema");

const fixtureRoot = path.join(__dirname, "fixtures", "dot-workspace");

test("imports a DOT workspace into a KnoletSpec", async () => {
  const result = await importDotWorkspace(fixtureRoot);

  assert.equal(result.validation.ok, true);
  assert.equal(result.spec.knolet_spec_version, "0.1");
  assert.equal(result.spec.personas.length, 1);
  assert.equal(result.spec.skills.length, 1);
  assert.equal(result.spec.agents.length, 2);
  assert.equal(result.spec.workflow.nodes.length, 2);
  assert.equal(result.spec.workflow.edges[0].direction, "one-way");
  assert.ok(result.spec.metadata.source.dot_assets.includes("act/@acme/mvp/contract-review-flow"));
});

test("reports missing knowledge bindings as warnings", async () => {
  const result = await importDotWorkspace(fixtureRoot);
  const warnings = result.diagnostics.filter((item) => item.code === "missing-knowledge-binding");

  assert.ok(warnings.length >= 1);
  assert.equal(warnings[0].level, "warning");
});

test("applies knowledge bindings during import", async () => {
  const result = await importDotWorkspace(fixtureRoot, {
    knowledgeSources: [
      {
        id: "contract_repository",
        type: "workspace_document",
        label: "Contract repository",
        required: true,
      },
    ],
    skillBindings: {
      "skill.contract-risk": ["contract_repository"],
    },
  });
  const bindingWarnings = result.diagnostics.filter((item) => item.code === "missing-knowledge-binding");

  assert.equal(result.validation.ok, true);
  assert.equal(result.spec.skills[0].binds_to[0], "contract_repository");
  assert.equal(result.spec.knowledge.sources.some((source) => source.id === "contract_repository"), true);
  assert.equal(bindingWarnings.length, 0);
});

test("unknown knowledge source bindings fail validation", async () => {
  const result = await importDotWorkspace(fixtureRoot, {
    skillBindings: {
      "skill.contract-risk": ["missing_source"],
    },
  });

  assert.equal(result.validation.ok, false);
  assert.ok(result.validation.errors.some((error) => error.code === "unknown-knowledge-source"));
});

test("invalid workflow relation directions fail validation", async () => {
  const result = await importDotWorkspace(fixtureRoot);
  const spec = structuredClone(result.spec);
  spec.workflow.edges[0].direction = "sideways";

  const validation = validateKnoletSpec(spec);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.code === "invalid-relation-direction"));
});

test("missing DOT directories are warnings, not fatal errors", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "knolet-empty-dot-"));
  const result = await importDotWorkspace(tempRoot);

  assert.ok(result.diagnostics.some((item) => item.code === "missing-dot-directory"));
  assert.equal(Array.isArray(result.spec.personas), true);
  assert.equal(Array.isArray(result.spec.skills), true);
});

test("invalid JSON assets are collected as diagnostics", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "knolet-bad-dot-"));
  const performerDir = path.join(tempRoot, "performer", "@acme", "mvp");
  await fs.mkdir(performerDir, { recursive: true });
  await fs.writeFile(path.join(performerDir, "bad.json"), "{not json");

  const result = await importDotWorkspace(tempRoot);
  assert.ok(result.diagnostics.some((item) => item.code === "invalid-dot-json"));
});
