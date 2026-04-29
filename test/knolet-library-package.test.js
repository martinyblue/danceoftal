const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { importDotWorkspace } = require("../lib/knolet/dot-importer");
const { compileKnoletRuntimePlan } = require("../lib/knolet/runtime-plan");
const { compileKnoletGraphModel } = require("../lib/knolet/graph-model");
const { compileKnoletLibraryPackage } = require("../lib/knolet/library-package");

const fixtureRoot = path.join(__dirname, "fixtures", "dot-workspace");

async function boundFixturePackage(extraOptions = {}) {
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
  const spec = structuredClone(result.spec);
  if (extraOptions.sourceContent) {
    spec.knowledge.sources.push({
      id: "inline_policy",
      type: "manual_note",
      label: "Inline policy note",
      content: "Customer content that must not be copied into a library package.",
    });
  }
  const runtimePlan = compileKnoletRuntimePlan(spec, { createdAt: "2026-04-29T00:00:00.000Z" });
  const graph = compileKnoletGraphModel(spec, runtimePlan, { createdAt: "2026-04-29T00:00:00.000Z" });
  return compileKnoletLibraryPackage(spec, runtimePlan, graph, { createdAt: "2026-04-29T00:00:00.000Z" });
}

test("compiles a bound KnoletSpec into a shareable library package", async () => {
  const libraryPackage = await boundFixturePackage();

  assert.equal(libraryPackage.library_package_version, "0.1");
  assert.equal(libraryPackage.status, "shareable");
  assert.equal(libraryPackage.summary.shareReady, true);
  assert.equal(libraryPackage.summary.templates.personaTemplates, 1);
  assert.equal(libraryPackage.summary.templates.skillBlocks, 1);
  assert.equal(libraryPackage.summary.templates.agentProfiles, 2);
  assert.equal(libraryPackage.templates.workflow_templates.length, 1);
  assert.equal(libraryPackage.share_policy.copies_source_documents, false);
  assert.ok(libraryPackage.dependencies.dot_assets.includes("dance/@acme/mvp/contract-risk"));
});

test("strips inline KnowledgeSource content from library packages", async () => {
  const libraryPackage = await boundFixturePackage({ sourceContent: true });
  const inlineSource = libraryPackage.source_bindings.find((source) => source.id === "inline_policy");

  assert.equal(inlineSource.content, undefined);
  assert.equal(inlineSource.pointer.kind, "binding");
  assert.ok(libraryPackage.diagnostics.some((item) => item.code === "library-source-content-stripped"));
});

test("blocks library packages when runtime diagnostics have errors", async () => {
  const result = await importDotWorkspace(fixtureRoot);
  const runtimePlan = compileKnoletRuntimePlan(result.spec);
  const graph = compileKnoletGraphModel(result.spec, runtimePlan);
  const libraryPackage = compileKnoletLibraryPackage(result.spec, runtimePlan, graph);

  assert.equal(libraryPackage.status, "blocked");
  assert.equal(libraryPackage.summary.shareReady, false);
  assert.ok(libraryPackage.diagnostics.some((item) => item.code === "runtime-skill-unbound"));
});
