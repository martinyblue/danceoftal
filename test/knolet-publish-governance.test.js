const test = require("node:test");
const assert = require("node:assert/strict");
const { readProductPermissions } = require("../lib/knolet/product-permissions");
const {
  compilePublishGovernanceReceipt,
  publishIntentFromLibraryPackage,
} = require("../lib/knolet/publish-governance");

const readyReadiness = {
  mode: "production",
  summary: { ready: true },
};

function permissions(role) {
  return readProductPermissions({
    env: {
      DANCEOFTAL_MODE: "production",
      DANCEOFTAL_ACTOR_ID: "user_1",
      DANCEOFTAL_ACTOR_ROLE: role,
    },
  });
}

test("approves publish governance when admin, artifact, and no-copy policy are present", () => {
  const receipt = compilePublishGovernanceReceipt({
    readiness: readyReadiness,
    permissions: permissions("admin"),
    intent: {
      workspace_id: "workspace_1",
      publish_intent_id: "publish_1",
      target: { kind: "knolet_library", owner: "martinyblue", stage: "local" },
      artifact_refs: [{ kind: "library_package", id: "package_1" }],
      share_policy: { copies_source_documents: false },
    },
    generatedAt: "2026-04-30T00:00:00.000Z",
  });

  assert.equal(receipt.publish_governance_version, "0.1");
  assert.equal(receipt.status, "approved");
  assert.equal(receipt.summary.ready, true);
  assert.equal(receipt.receipt.id, "publish_receipt_publish_1");
});

test("blocks publish governance when source documents would be copied", () => {
  const receipt = compilePublishGovernanceReceipt({
    readiness: readyReadiness,
    permissions: permissions("admin"),
    intent: {
      workspace_id: "workspace_1",
      publish_intent_id: "publish_1",
      target: { kind: "knolet_library" },
      artifact_refs: [{ kind: "library_package", id: "package_1" }],
      share_policy: { copies_source_documents: true },
    },
  });

  assert.equal(receipt.status, "blocked");
  assert.ok(receipt.diagnosticsByLevel.error.some((item) => item.code === "publish-no-source-copy"));
});

test("blocks publish governance when actor lacks publish permission", () => {
  const receipt = compilePublishGovernanceReceipt({
    readiness: readyReadiness,
    permissions: permissions("editor"),
    intent: {
      workspace_id: "workspace_1",
      publish_intent_id: "publish_1",
      target: { kind: "knolet_library" },
      artifact_refs: [{ kind: "library_package", id: "package_1" }],
      share_policy: { copies_source_documents: false },
    },
  });

  assert.equal(receipt.status, "blocked");
  assert.ok(receipt.diagnosticsByLevel.error.some((item) => item.code === "publish-permission"));
});

test("builds publish intent from library package metadata", () => {
  const intent = publishIntentFromLibraryPackage({
    id: "knolet-library://acme/mvp/review",
    status: "shareable",
    share_policy: { copies_source_documents: false, forkable: true },
  });

  assert.equal(intent.artifact_refs[0].id, "knolet-library://acme/mvp/review");
  assert.equal(intent.share_policy.forkable, true);
});
