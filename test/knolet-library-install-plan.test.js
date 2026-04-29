const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { importDotWorkspace } = require("../lib/knolet/dot-importer");
const { compileKnoletRuntimePlan } = require("../lib/knolet/runtime-plan");
const { compileKnoletGraphModel } = require("../lib/knolet/graph-model");
const { compileKnoletLibraryPackage } = require("../lib/knolet/library-package");
const { compileKnoletLibraryInstallPlan } = require("../lib/knolet/library-install-plan");

const fixtureRoot = path.join(__dirname, "fixtures", "dot-workspace");

async function boundFixtureLibraryPackage() {
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
  const runtimePlan = compileKnoletRuntimePlan(result.spec, { createdAt: "2026-04-29T00:00:00.000Z" });
  const graph = compileKnoletGraphModel(result.spec, runtimePlan, { createdAt: "2026-04-29T00:00:00.000Z" });
  return compileKnoletLibraryPackage(result.spec, runtimePlan, graph, { createdAt: "2026-04-29T00:00:00.000Z" });
}

test("compiles a shareable library package into a ready install plan", async () => {
  const libraryPackage = await boundFixtureLibraryPackage();
  const installPlan = compileKnoletLibraryInstallPlan(libraryPackage, {
    createdAt: "2026-04-29T00:00:00.000Z",
    targetOwner: "martinyblue",
    targetStage: "local",
  });

  assert.equal(installPlan.library_install_plan_version, "0.1");
  assert.equal(installPlan.status, "ready");
  assert.equal(installPlan.summary.templateActionCount, libraryPackage.summary.templateCount);
  assert.equal(installPlan.summary.sourceRebindingCount, 2);
  assert.equal(installPlan.summary.requiredRebindingCount, 1);
  assert.ok(installPlan.template_actions.some((action) => action.template_type === "skill_block"));
  assert.equal(installPlan.fork.forkable, true);
});

test("blocks install plans that would copy source documents", async () => {
  const libraryPackage = await boundFixtureLibraryPackage();
  libraryPackage.share_policy.copies_source_documents = true;

  const installPlan = compileKnoletLibraryInstallPlan(libraryPackage);

  assert.equal(installPlan.status, "blocked");
  assert.ok(installPlan.diagnostics.some((item) => item.code === "install-package-copies-sources"));
});

test("surfaces non-shareable packages as install warnings", async () => {
  const libraryPackage = await boundFixtureLibraryPackage();
  libraryPackage.status = "blocked";

  const installPlan = compileKnoletLibraryInstallPlan(libraryPackage);

  assert.equal(installPlan.status, "ready");
  assert.ok(installPlan.diagnostics.some((item) => item.code === "install-package-not-shareable"));
});
