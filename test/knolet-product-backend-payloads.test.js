const test = require("node:test");
const assert = require("node:assert/strict");
const {
  libraryInstallReceiptPayload,
  publishIntentPayload,
  workspaceId,
  workspaceSnapshotPayload,
} = require("../lib/knolet/product-backend-payloads");

test("builds workspace snapshot payloads for save endpoints", () => {
  const payload = workspaceSnapshotPayload({
    workspace: { owner: "Martin Y Blue", stage: "Local Dev" },
    snapshotId: "snapshot_1",
    spec: { metadata: { name: "Knolet App" } },
  });

  assert.equal(payload.workspace_id, "martin-y-blue-local-dev");
  assert.equal(payload.snapshot_id, "snapshot_1");
  assert.equal(payload.owner, "Martin Y Blue");
  assert.deepEqual(payload.runtime_plan, { status: "pending" });
  assert.deepEqual(payload.graph_model, { status: "pending" });
});

test("builds library install receipt payloads from execution writes", () => {
  const payload = libraryInstallReceiptPayload({
    installationId: "install_1",
    execution: {
      source_package: { id: "knolet-library://acme/mvp/review" },
      writes: [
        { kind: "template_record", path: ".dance-of-tal/library/template.json" },
        { kind: "source_binding_record", path: ".dance-of-tal/library/source.json" },
      ],
      summary: { writeCount: 2 },
    },
  });

  assert.equal(payload.workspace_id, "martinyblue-local");
  assert.equal(payload.source_package_id, "knolet-library://acme/mvp/review");
  assert.equal(payload.template_records.length, 1);
  assert.equal(payload.source_bindings.length, 1);
});

test("builds publish intent payloads without allowing source document copies by default", () => {
  const payload = publishIntentPayload({
    workspace: { owner: "martinyblue", stage: "mvp" },
    publishIntentId: "publish_1",
    artifactRefs: [{ kind: "library_package", id: "package_1" }],
  });

  assert.equal(workspaceId("martinyblue", "mvp"), "martinyblue-mvp");
  assert.equal(payload.workspace_id, "martinyblue-mvp");
  assert.equal(payload.publish_intent_id, "publish_1");
  assert.equal(payload.share_policy.copies_source_documents, false);
});
