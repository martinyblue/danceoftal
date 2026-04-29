const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { importDotWorkspace } = require("../lib/knolet/dot-importer");
const { compileKnoletRuntimePlan } = require("../lib/knolet/runtime-plan");
const { compileKnoletGraphModel } = require("../lib/knolet/graph-model");
const { compileKnoletLibraryPackage } = require("../lib/knolet/library-package");
const { compileKnoletLibraryInstallPlan } = require("../lib/knolet/library-install-plan");
const { compileKnoletLibraryInstallExecution } = require("../lib/knolet/library-install-executor");

const fixtureRoot = path.join(__dirname, "fixtures", "dot-workspace");

async function fixtureInstallPlan({ requiredSource = false } = {}) {
  const result = await importDotWorkspace(fixtureRoot, {
    knowledgeSources: [
      {
        id: "contract_repository",
        type: "workspace_document",
        label: "Contract repository",
        required: requiredSource,
      },
    ],
    skillBindings: {
      "skill.contract-risk": ["contract_repository"],
    },
  });
  const runtimePlan = compileKnoletRuntimePlan(result.spec, { createdAt: "2026-04-29T00:00:00.000Z" });
  const graph = compileKnoletGraphModel(result.spec, runtimePlan, { createdAt: "2026-04-29T00:00:00.000Z" });
  const libraryPackage = compileKnoletLibraryPackage(result.spec, runtimePlan, graph, {
    createdAt: "2026-04-29T00:00:00.000Z",
  });
  const installPlan = compileKnoletLibraryInstallPlan(libraryPackage, {
    createdAt: "2026-04-29T00:00:00.000Z",
    targetOwner: "martinyblue",
    targetStage: "local",
  });
  return { libraryPackage, installPlan };
}

test("builds writable records from a ready install plan", async () => {
  const { libraryPackage, installPlan } = await fixtureInstallPlan();
  const execution = compileKnoletLibraryInstallExecution(installPlan, libraryPackage, {
    installedAt: "2026-04-29T00:00:00.000Z",
  });

  assert.equal(execution.library_install_execution_version, "0.1");
  assert.equal(execution.status, "ready_to_write");
  assert.equal(execution.summary.templateWriteCount, libraryPackage.summary.templateCount);
  assert.equal(execution.summary.sourceBindingWriteCount, installPlan.summary.sourceRebindingCount);
  assert.ok(execution.writes.some((write) => write.kind === "manifest"));
  assert.ok(execution.writes.every((write) => write.path.startsWith(".dance-of-tal/library/martinyblue/local/")));
});

test("blocks execution when a required source has not been rebound", async () => {
  const { libraryPackage, installPlan } = await fixtureInstallPlan({ requiredSource: true });
  const execution = compileKnoletLibraryInstallExecution(installPlan, libraryPackage);

  assert.equal(execution.status, "blocked");
  assert.equal(execution.summary.writeCount, 0);
  assert.ok(execution.diagnostics.some((item) => item.code === "execution-required-source-unbound"));
});

test("allows execution when a required source rebinding is confirmed", async () => {
  const { libraryPackage, installPlan } = await fixtureInstallPlan({ requiredSource: true });
  const execution = compileKnoletLibraryInstallExecution(installPlan, libraryPackage, {
    sourceBindings: {
      contract_repository: {
        status: "bound",
        target_source_id: "workspace_contracts",
      },
    },
  });

  assert.equal(execution.status, "ready_to_write");
  const bindingWrite = execution.writes.find((write) => write.kind === "source_binding");
  assert.equal(bindingWrite.record.target_source_id, "workspace_contracts");
  assert.equal(bindingWrite.record.status, "bound");
});
