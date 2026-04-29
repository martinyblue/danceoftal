const PUBLISH_GOVERNANCE_VERSION = "0.1";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function receiptId(intent) {
  return `publish_receipt_${String(intent?.publish_intent_id || Date.now()).replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
}

function publishPermission(permissions) {
  return asArray(permissions?.checks).find((check) => check.key === "publish.request") || null;
}

function governanceChecks(intent, permissions, readiness) {
  const checks = [];
  const permission = publishPermission(permissions);
  checks.push({
    key: "publish.permission",
    state: permission?.allowed ? "ok" : permissions?.mode === "production" ? "error" : "warning",
    detail: permission?.allowed
      ? "Actor can request publish actions."
      : permission?.detail || "Publish permission is not confirmed.",
  });
  checks.push({
    key: "publish.target",
    state: intent?.target?.kind ? "ok" : "error",
    detail: intent?.target?.kind ? `Target kind is ${intent.target.kind}.` : "Publish target is required.",
  });
  checks.push({
    key: "publish.artifacts",
    state: asArray(intent?.artifact_refs).length ? "ok" : "warning",
    detail: asArray(intent?.artifact_refs).length
      ? `${intent.artifact_refs.length} artifact reference(s) will be governed.`
      : "No artifact references are attached to this publish intent yet.",
  });
  checks.push({
    key: "publish.no-source-copy",
    state: intent?.share_policy?.copies_source_documents === false ? "ok" : "error",
    detail:
      intent?.share_policy?.copies_source_documents === false
        ? "Share policy refuses source document copies."
        : "Publish governance requires share_policy.copies_source_documents=false.",
  });
  checks.push({
    key: "publish.backend-readiness",
    state: readiness?.summary?.ready ? "ok" : readiness?.mode === "production" ? "error" : "warning",
    detail: readiness?.summary?.ready
      ? "Product backend readiness has no blocking errors."
      : "Product backend readiness still needs review before product publish.",
  });
  return checks;
}

function compilePublishGovernanceReceipt({ intent, permissions, readiness, generatedAt } = {}) {
  const checks = governanceChecks(intent || {}, permissions || {}, readiness || {});
  const errors = checks.filter((check) => check.state === "error");
  const warnings = checks.filter((check) => check.state === "warning");
  const status = errors.length ? "blocked" : warnings.length ? "needs_review" : "approved";
  return {
    publish_governance_version: PUBLISH_GOVERNANCE_VERSION,
    generatedAt: generatedAt || new Date().toISOString(),
    status,
    summary: {
      ready: errors.length === 0,
      checkCount: checks.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      artifactCount: asArray(intent?.artifact_refs).length,
    },
    receipt: {
      id: receiptId(intent),
      status,
      actor_id: permissions?.actor?.id || "",
      actor_role: permissions?.actor?.role || "",
      workspace_id: intent?.workspace_id || "",
      publish_intent_id: intent?.publish_intent_id || "",
      target: intent?.target || {},
      artifact_refs: asArray(intent?.artifact_refs),
      share_policy: intent?.share_policy || {},
    },
    checks,
    diagnosticsByLevel: {
      error: errors.map((check) => ({
        level: "error",
        code: `publish-${check.key.replace(/^publish\./, "")}`,
        message: check.detail,
        path: check.key,
      })),
      warning: warnings.map((check) => ({
        level: "warning",
        code: `publish-${check.key.replace(/^publish\./, "")}`,
        message: check.detail,
        path: check.key,
      })),
    },
  };
}

function publishIntentFromLibraryPackage(libraryPackage, fallback = {}) {
  return {
    workspace_id: fallback.workspace_id || "martinyblue-local",
    publish_intent_id: fallback.publish_intent_id || `publish_${Date.now()}`,
    target: fallback.target || { kind: "knolet_library", owner: "martinyblue", stage: "local" },
    artifact_refs: libraryPackage?.id
      ? [
          {
            kind: "library_package",
            id: libraryPackage.id,
            status: libraryPackage.status || "",
          },
        ]
      : [],
    share_policy: libraryPackage?.share_policy || { copies_source_documents: false },
  };
}

module.exports = {
  PUBLISH_GOVERNANCE_VERSION,
  compilePublishGovernanceReceipt,
  publishIntentFromLibraryPackage,
};
