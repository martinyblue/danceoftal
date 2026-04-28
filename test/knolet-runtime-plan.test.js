const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { importDotWorkspace } = require("../lib/knolet/dot-importer");
const { compileKnoletRuntimePlan } = require("../lib/knolet/runtime-plan");

const fixtureRoot = path.join(__dirname, "fixtures", "dot-workspace");

test("compiles a bound KnoletSpec into a ready runtime plan", async () => {
  const result = await importDotWorkspace(fixtureRoot, {
    knowledgeSources: [
      {
        id: "contract_repository",
        type: "workspace_document",
        label: "Contract repository",
      },
    ],
    skillBindings: {
      "skill.contract-risk": ["contract_repository"],
    },
  });
  const plan = compileKnoletRuntimePlan(result.spec, { createdAt: "2026-04-28T00:00:00.000Z" });

  assert.equal(plan.runtime_plan_version, "0.1");
  assert.equal(plan.status, "ready");
  assert.equal(plan.summary.participantsCount, 2);
  assert.equal(plan.summary.edgesCount, 1);
  assert.equal(plan.participants[0].skills[0].knowledge_sources[0].id, "contract_repository");
  assert.equal(plan.run_log.status, "planned");
});

test("blocks runtime plans with unbound agent skills", async () => {
  const result = await importDotWorkspace(fixtureRoot);
  const plan = compileKnoletRuntimePlan(result.spec);

  assert.equal(plan.status, "blocked");
  assert.ok(plan.diagnostics.some((item) => item.code === "runtime-skill-unbound"));
});

test("blocks runtime plans with invalid workflow edge endpoints", async () => {
  const result = await importDotWorkspace(fixtureRoot, {
    skillBindings: {
      "skill.contract-risk": ["workspace_documents"],
    },
  });
  const spec = structuredClone(result.spec);
  spec.workflow.edges[0].to = "agent.missing";
  const plan = compileKnoletRuntimePlan(spec);

  assert.equal(plan.status, "blocked");
  assert.ok(plan.diagnostics.some((item) => item.code === "runtime-invalid-edge-endpoint"));
});
