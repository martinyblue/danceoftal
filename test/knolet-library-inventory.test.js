const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { readKnoletLibraryInventory } = require("../lib/knolet/library-inventory");

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

test("reads installed library templates, bindings, and installation manifests", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "knolet-library-inventory-"));
  const libraryRoot = path.join(root, ".dance-of-tal", "library");
  const stageRoot = path.join(libraryRoot, "martinyblue", "local");

  await writeJson(path.join(stageRoot, "templates", "skill_block", "skill.contract-risk.json"), {
    template_type: "skill_block",
    template_id: "skill.contract-risk",
    target_id: "martinyblue/local/skill.contract-risk",
    installedAt: "2026-04-29T00:00:00.000Z",
    source_package: {
      id: "knolet-library://acme/mvp/contract-review",
    },
    template: {
      id: "skill.contract-risk",
    },
  });
  await writeJson(path.join(stageRoot, "source-bindings", "contract_repository.json"), {
    source_id: "contract_repository",
    label: "Contract repository",
    type: "workspace_document",
    required: true,
    status: "bound",
    target_source_id: "workspace_contracts",
    source_package: {
      id: "knolet-library://acme/mvp/contract-review",
    },
  });
  await writeJson(path.join(stageRoot, "installations", "install-plan.json"), {
    installedAt: "2026-04-29T00:00:00.000Z",
    source_package: {
      id: "knolet-library://acme/mvp/contract-review",
    },
    summary: {
      writeCount: 3,
      templateWriteCount: 1,
      sourceBindingWriteCount: 1,
    },
  });

  const inventory = await readKnoletLibraryInventory(libraryRoot, { root });

  assert.equal(inventory.library_inventory_version, "0.1");
  assert.equal(inventory.summary.stageCount, 1);
  assert.equal(inventory.summary.templateCount, 1);
  assert.equal(inventory.summary.sourceBindingCount, 1);
  assert.equal(inventory.summary.installationCount, 1);
  assert.equal(inventory.records.templates[0].template_id, "skill.contract-risk");
  assert.equal(inventory.records.source_bindings[0].target_source_id, "workspace_contracts");
});

test("returns an empty inventory when the library directory is missing", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "knolet-empty-library-"));
  const inventory = await readKnoletLibraryInventory(path.join(root, ".dance-of-tal", "library"), { root });

  assert.equal(inventory.summary.ready, true);
  assert.equal(inventory.summary.templateCount, 0);
  assert.deepEqual(inventory.records.stages, []);
});

test("reports invalid library JSON as a warning", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "knolet-bad-library-"));
  const badPath = path.join(root, ".dance-of-tal", "library", "martinyblue", "local", "source-bindings", "bad.json");
  await fs.mkdir(path.dirname(badPath), { recursive: true });
  await fs.writeFile(badPath, "{not json");

  const inventory = await readKnoletLibraryInventory(path.join(root, ".dance-of-tal", "library"), { root });

  assert.equal(inventory.summary.warningCount, 1);
  assert.ok(inventory.diagnostics.some((item) => item.code === "library-inventory-invalid-json"));
});
