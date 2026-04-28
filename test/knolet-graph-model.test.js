const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { importDotWorkspace } = require("../lib/knolet/dot-importer");
const { compileKnoletRuntimePlan } = require("../lib/knolet/runtime-plan");
const { compileKnoletGraphModel } = require("../lib/knolet/graph-model");

const fixtureRoot = path.join(__dirname, "fixtures", "dot-workspace");

async function boundFixtureGraph() {
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
  const runtimePlan = compileKnoletRuntimePlan(result.spec, { createdAt: "2026-04-28T00:00:00.000Z" });
  return compileKnoletGraphModel(result.spec, runtimePlan, { createdAt: "2026-04-28T00:00:00.000Z" });
}

test("compiles KnoletSpec and RuntimePlan into a graph model", async () => {
  const graph = await boundFixtureGraph();

  assert.equal(graph.graph_model_version, "0.1");
  assert.equal(graph.status, "ready");
  assert.equal(graph.summary.typeBreakdown.source, 2);
  assert.equal(graph.summary.typeBreakdown.agent, 2);
  assert.ok(graph.edges.some((edge) => edge.type === "uses_persona"));
  assert.ok(graph.edges.some((edge) => edge.type === "has_skill"));
  assert.ok(graph.edges.some((edge) => edge.type === "binds_to"));
  assert.ok(graph.edges.some((edge) => edge.type === "runs_step"));
  assert.ok(graph.edges.some((edge) => edge.type === "produces"));
  assert.ok(graph.edges.some((edge) => edge.type === "evaluates"));
});

test("graph diagnostics catch missing agent persona edges", async () => {
  const result = await importDotWorkspace(fixtureRoot, {
    skillBindings: {
      "skill.contract-risk": ["workspace_documents"],
    },
  });
  const spec = structuredClone(result.spec);
  spec.agents[0].persona = null;
  const runtimePlan = compileKnoletRuntimePlan(spec);
  const graph = compileKnoletGraphModel(spec, runtimePlan);

  assert.equal(graph.status, "blocked");
  assert.ok(graph.diagnostics.some((item) => item.code === "graph-agent-missing-persona"));
});

test("graph diagnostics flag unbound skills", async () => {
  const result = await importDotWorkspace(fixtureRoot);
  const runtimePlan = compileKnoletRuntimePlan(result.spec);
  const graph = compileKnoletGraphModel(result.spec, runtimePlan);

  assert.equal(graph.status, "blocked");
  assert.ok(graph.diagnostics.some((item) => item.code === "graph-skill-missing-source"));
});
