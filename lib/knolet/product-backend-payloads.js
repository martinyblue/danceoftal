function slug(value, fallback = "item") {
  return String(value || fallback)
    .trim()
    .replace(/^@/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function workspaceId(owner = "martinyblue", stage = "local") {
  return `${slug(owner, "martinyblue")}-${slug(stage, "local")}`;
}

function workspaceSnapshotPayload({ workspace, snapshotId, spec, runtimePlan, graphModel, diagnostics, localArtifacts }) {
  const owner = workspace?.owner || spec?.metadata?.owner || "martinyblue";
  const stage = workspace?.stage || spec?.metadata?.stage || "local";
  return {
    workspace_id: workspace?.id || workspaceId(owner, stage),
    snapshot_id: snapshotId || `snapshot_${Date.now()}`,
    owner,
    knolet_spec: spec || { status: "pending" },
    runtime_plan: runtimePlan || { status: "pending" },
    graph_model: graphModel || { status: "pending" },
    ...(diagnostics ? { diagnostics } : {}),
    ...(localArtifacts ? { local_artifacts: localArtifacts } : {}),
  };
}

function libraryInstallReceiptPayload({ workspace, installationId, execution }) {
  const owner = workspace?.owner || execution?.target_workspace?.owner || "martinyblue";
  const stage = workspace?.stage || execution?.target_workspace?.stage || "local";
  return {
    workspace_id: workspace?.id || workspaceId(owner, stage),
    installation_id: installationId || execution?.id || `installation_${Date.now()}`,
    source_package_id: execution?.source_package?.id || "",
    template_records: (execution?.writes || []).filter((write) => write.kind === "template_record"),
    source_bindings: (execution?.writes || []).filter((write) => write.kind === "source_binding_record"),
    ...(execution?.summary ? { diagnostics: execution.diagnostics || [], writes: execution.writes || [] } : {}),
  };
}

function publishIntentPayload({ workspace, publishIntentId, target, artifactRefs, sharePolicy }) {
  const owner = workspace?.owner || "martinyblue";
  const stage = workspace?.stage || "local";
  return {
    workspace_id: workspace?.id || workspaceId(owner, stage),
    publish_intent_id: publishIntentId || `publish_${Date.now()}`,
    target: target || { kind: "local_library_package", owner, stage },
    artifact_refs: artifactRefs || [],
    share_policy: sharePolicy || { copies_source_documents: false },
  };
}

module.exports = {
  libraryInstallReceiptPayload,
  publishIntentPayload,
  workspaceId,
  workspaceSnapshotPayload,
};
