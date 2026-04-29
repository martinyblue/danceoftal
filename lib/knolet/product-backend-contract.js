const PRODUCT_BACKEND_CONTRACT_VERSION = "0.1";

const ENDPOINTS = [
  {
    key: "workspace-snapshot",
    surface: "workspace-storage",
    method: "POST",
    path: "/v1/workspaces/{workspace_id}/snapshots",
    purpose: "Persist KnoletSpec, RuntimePlan, GraphModel, and local artifact pointers as a workspace snapshot.",
    idempotencyScope: "workspace_id + snapshot_id",
    request: {
      required: ["workspace_id", "snapshot_id", "owner", "knolet_spec", "runtime_plan", "graph_model"],
      optional: ["source_import", "diagnostics", "local_artifacts"],
    },
    response: {
      required: ["snapshot_id", "workspace_id", "version", "stored_at", "storage_owner"],
      optional: ["warnings"],
    },
  },
  {
    key: "source-binding-confirmation",
    surface: "source-binding-storage",
    method: "POST",
    path: "/v1/workspaces/{workspace_id}/source-bindings",
    purpose: "Store KnowledgeSource pointer confirmations without copying customer source content into templates.",
    idempotencyScope: "workspace_id + source_id + target_source_id",
    request: {
      required: ["workspace_id", "source_id", "target_source_id", "pointer_kind", "required"],
      optional: ["label", "source_package_id", "policy", "metadata"],
    },
    response: {
      required: ["binding_id", "source_id", "target_source_id", "status", "confirmed_at"],
      optional: ["warnings"],
    },
  },
  {
    key: "run-log-event",
    surface: "run-log-storage",
    method: "POST",
    path: "/v1/workspaces/{workspace_id}/runs/{run_id}/events",
    purpose: "Append workflow execution events, validation results, and OpenCode handoff state to product-owned run logs.",
    idempotencyScope: "workspace_id + run_id + event_id",
    request: {
      required: ["workspace_id", "run_id", "event_id", "event_type", "occurred_at"],
      optional: ["agent_id", "step_id", "input_ref", "output_ref", "diagnostics", "metadata"],
    },
    response: {
      required: ["run_id", "event_id", "sequence", "stored_at"],
      optional: ["warnings"],
    },
  },
  {
    key: "library-install-receipt",
    surface: "library-install-storage",
    method: "POST",
    path: "/v1/workspaces/{workspace_id}/library/installations",
    purpose: "Persist template install records, source rebinding receipts, and installation manifests.",
    idempotencyScope: "workspace_id + installation_id",
    request: {
      required: ["workspace_id", "installation_id", "source_package_id", "template_records", "source_bindings"],
      optional: ["fork_id", "diagnostics", "writes"],
    },
    response: {
      required: ["installation_id", "workspace_id", "write_count", "stored_at"],
      optional: ["warnings"],
    },
  },
  {
    key: "publish-intent",
    surface: "publish-governance",
    method: "POST",
    path: "/v1/workspaces/{workspace_id}/publish/intents",
    purpose: "Record who is publishing what, where it will go, and whether source documents can be copied.",
    idempotencyScope: "workspace_id + publish_intent_id",
    request: {
      required: ["workspace_id", "publish_intent_id", "target", "artifact_refs", "share_policy"],
      optional: ["reviewer_id", "approval_id", "notes"],
    },
    response: {
      required: ["publish_intent_id", "status", "receipt_id", "recorded_at"],
      optional: ["warnings"],
    },
  },
];

function surfaceByKey(readiness) {
  return new Map((readiness?.surfaces || []).map((surface) => [surface.key, surface]));
}

function endpointStatus(surface, readiness) {
  if (!surface) {
    return "contract_only";
  }
  if (surface.state === "ok") {
    return "ready_for_adapter";
  }
  if (readiness?.mode === "production" || surface.state === "error") {
    return "blocked_by_readiness";
  }
  return "draft_needs_backend";
}

function endpointContract(endpoint, surfaces, readiness) {
  const surface = surfaces.get(endpoint.surface);
  const status = endpointStatus(surface, readiness);
  return {
    ...endpoint,
    status,
    readiness: {
      surface: endpoint.surface,
      surfaceState: surface?.state || "unknown",
      storageMode: surface?.storageMode || "",
      storageEnv: surface?.storageEnv || "",
      localArtifactCount: surface?.localArtifactCount || 0,
    },
    headers: {
      authorization: "Bearer <product-session-token>",
      "idempotency-key": endpoint.idempotencyScope,
      "content-type": "application/json",
    },
    safeguards: [
      "Reject requests without a product-owned workspace owner.",
      "Reject inline source document content in template/share records.",
      "Return diagnostics without writing partial records when validation fails.",
    ],
  };
}

function contractSummary(endpoints, readiness) {
  const blocked = endpoints.filter((endpoint) => endpoint.status === "blocked_by_readiness");
  const ready = endpoints.filter((endpoint) => endpoint.status === "ready_for_adapter");
  return {
    ready: blocked.length === 0,
    status:
      blocked.length
        ? "blocked_by_readiness"
        : readiness?.summary?.status === "ready"
          ? "draft_ready"
          : "draft_needs_review",
    endpointCount: endpoints.length,
    readyEndpointCount: ready.length,
    blockedEndpointCount: blocked.length,
    readinessStatus: readiness?.summary?.status || "unknown",
    mode: readiness?.mode || readiness?.summary?.mode || "development",
  };
}

function compileProductBackendContract(readiness, options = {}) {
  const surfaces = surfaceByKey(readiness);
  const endpoints = ENDPOINTS.map((endpoint) => endpointContract(endpoint, surfaces, readiness));
  const baseUrl = options.baseUrl || readiness?.env?.DANCEOFTAL_DATA_API_URL || process.env.DANCEOFTAL_DATA_API_URL || "";
  const summary = contractSummary(endpoints, readiness);
  const environmentGates = [
    {
      key: "product-auth",
      required: true,
      env: ["DOT_SUPABASE_URL", "DOT_SUPABASE_ANON_KEY"],
      detail: "Requests must be authenticated against the product-owned auth backend.",
    },
    {
      key: "product-data-api",
      required: true,
      env: ["DANCEOFTAL_DATA_OWNER", "DANCEOFTAL_DATA_API_URL"],
      detail: "Server-backed writes require a product data owner and non-local API URL.",
    },
    {
      key: "server-storage-mode",
      required: true,
      env: [
        "DANCEOFTAL_STORAGE_MODE",
        "DANCEOFTAL_WORKSPACE_STORAGE_MODE",
        "DANCEOFTAL_SOURCE_BINDING_STORAGE_MODE",
        "DANCEOFTAL_RUN_LOG_STORAGE_MODE",
        "DANCEOFTAL_LIBRARY_STORAGE_MODE",
        "DANCEOFTAL_PUBLISH_STORAGE_MODE",
      ],
      detail: "Use DANCEOFTAL_STORAGE_MODE=server for all surfaces, or configure each surface explicitly.",
    },
  ];

  return {
    product_backend_contract_version: PRODUCT_BACKEND_CONTRACT_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    status: summary.status,
    baseUrl,
    summary,
    environmentGates,
    endpoints,
    migrationOrder: [
      "workspace-snapshot",
      "source-binding-confirmation",
      "run-log-event",
      "library-install-receipt",
      "publish-intent",
    ],
  };
}

module.exports = {
  PRODUCT_BACKEND_CONTRACT_VERSION,
  compileProductBackendContract,
};
