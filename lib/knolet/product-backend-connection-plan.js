const { diagnostic } = require("./schema");

const PRODUCT_BACKEND_CONNECTION_PLAN_VERSION = "0.1";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function surfaceByKey(readiness, key) {
  return asArray(readiness?.surfaces).find((surface) => surface.key === key) || null;
}

function stepStateFromSummary(summary = {}) {
  if (summary.errorCount || summary.blockedCount || summary.blockedEndpointCount) {
    return "error";
  }
  if (summary.warningCount || summary.localPassthroughCount || summary.status === "draft_needs_review") {
    return "warning";
  }
  return "ok";
}

function step(key, title, state, detail, extra = {}) {
  return {
    key,
    title,
    state,
    ready: state === "ok",
    detail,
    required: state !== "ok",
    ...extra,
  };
}

function surfaceStep(key, title, surface, detail, env = []) {
  const state = surface?.state === "error" ? "error" : surface?.state === "ok" ? "ok" : "warning";
  return step(key, title, state, detail, {
    env,
    status: surface?.status || "unknown",
    current: surface?.detail || "",
  });
}

function storageStep(readiness) {
  const storageSurfaces = asArray(readiness?.surfaces).filter((surface) => surface.storageMode);
  const errorCount = storageSurfaces.filter((surface) => surface.state === "error").length;
  const warningCount = storageSurfaces.filter((surface) => surface.state === "warning").length;
  const localFirst = storageSurfaces.filter((surface) => surface.storageMode !== "server");
  const state = errorCount ? "error" : warningCount ? "warning" : "ok";
  return step(
    "server-back-storage-surfaces",
    "Server-back storage surfaces",
    state,
    state === "ok"
      ? "Workspace, source binding, run log, library install, and publish storage are set to server-backed mode."
      : "Switch all product storage surfaces to server mode before production writes.",
    {
      env: [
        "DANCEOFTAL_STORAGE_MODE",
        "DANCEOFTAL_WORKSPACE_STORAGE_MODE",
        "DANCEOFTAL_SOURCE_BINDING_STORAGE_MODE",
        "DANCEOFTAL_RUN_LOG_STORAGE_MODE",
        "DANCEOFTAL_LIBRARY_STORAGE_MODE",
        "DANCEOFTAL_PUBLISH_STORAGE_MODE",
      ],
      status: `${storageSurfaces.length - localFirst.length}/${storageSurfaces.length} server-backed`,
      current: localFirst.length
        ? `Local-first surfaces: ${localFirst.map((surface) => surface.key).join(", ")}`
        : "All backend surfaces are server-backed.",
    },
  );
}

function contractStep(contract) {
  const summary = contract?.summary || {};
  const state = stepStateFromSummary(summary);
  return step(
    "confirm-data-api-contract",
    "Confirm Product Data API contract",
    state,
    state === "ok"
      ? "Endpoint contracts are ready for the guarded adapter."
      : "Review blocked or draft endpoint contracts before enabling server writes.",
    {
      status: summary.status || contract?.status || "unknown",
      current: `${summary.readyEndpointCount || 0}/${summary.endpointCount || 0} endpoints ready`,
      endpointKeys: asArray(contract?.endpoints).map((endpoint) => endpoint.key),
    },
  );
}

function adapterStep(adapter) {
  const summary = adapter?.summary || {};
  const state = stepStateFromSummary(summary);
  return step(
    "dry-run-guarded-adapter",
    "Dry-run guarded server writes",
    state,
    state === "ok"
      ? "The adapter can build ready or dry-run write plans for all endpoint kinds."
      : "The adapter is still blocked or falling back to local passthrough.",
    {
      env: ["DANCEOFTAL_DATA_API_URL", "DANCEOFTAL_DATA_API_TOKEN"],
      status: adapter?.status || "unknown",
      current: `${summary.readyCount || 0}/${summary.planCount || 0} plans ready, ${summary.localPassthroughCount || 0} local passthrough`,
    },
  );
}

function permissionStep(permissions) {
  const summary = permissions?.summary || {};
  const state = stepStateFromSummary(summary);
  return step(
    "confirm-team-actor",
    "Confirm team actor permissions",
    state,
    state === "ok"
      ? "The configured actor role can perform product backend writes and publish requests."
      : "Set an actor id and role with enough permission for workspace, source, run, library, and publish actions.",
    {
      env: ["DANCEOFTAL_ACTOR_ID", "DANCEOFTAL_ACTOR_ROLE"],
      status: summary.status || "unknown",
      current: `${summary.allowedCount || 0}/${summary.actionCount || 0} actions allowed`,
    },
  );
}

function governanceStep(governance) {
  const summary = governance?.summary || {};
  const state = stepStateFromSummary(summary);
  return step(
    "approve-publish-governance",
    "Approve publish governance",
    state,
    state === "ok"
      ? "Publish governance has an approved receipt shape."
      : "Resolve publish permission, artifact, source-copy, or backend readiness warnings before sharing.",
    {
      status: governance?.status || "unknown",
      current: `${summary.artifactCount || 0} artifact refs, ${summary.warningCount || 0} warnings`,
    },
  );
}

function serverWriteStep(adapter, options = {}) {
  const writeEnabled =
    options.writeEnabled !== undefined
      ? options.writeEnabled === true
      : process.env.DANCEOFTAL_BACKEND_WRITE_ENABLED === "true";
  const tokenPresent =
    options.tokenPresent !== undefined
      ? options.tokenPresent === true
      : Boolean(process.env.DANCEOFTAL_DATA_API_TOKEN);
  const adapterReady = Boolean(adapter?.summary?.ready && !adapter?.summary?.localPassthroughCount);
  const production = asArray(adapter?.plans).some((plan) => plan.mode === "production");
  const state = adapterReady && writeEnabled && tokenPresent ? "ok" : adapterReady || !production ? "warning" : "error";
  return step(
    "enable-server-write-switch",
    "Enable server write switch",
    state,
    state === "ok"
      ? "Network writes can be sent through the guarded product backend adapter."
      : "Keep writes disabled until the backend token and explicit write switch are present.",
    {
      env: ["DANCEOFTAL_BACKEND_WRITE_ENABLED", "DANCEOFTAL_DATA_API_TOKEN"],
      status: writeEnabled ? "write_enabled" : "write_disabled",
      current: `token ${tokenPresent ? "set" : "unset"}, adapter ${adapterReady ? "ready" : "not ready"}`,
    },
  );
}

function smokeTestStep(readiness, contract) {
  const dataApi = surfaceByKey(readiness, "product-data-api");
  const baseUrl = contract?.baseUrl || readiness?.env?.DANCEOFTAL_DATA_API_URL || "";
  const state = dataApi?.state === "ok" && baseUrl ? "ok" : readiness?.mode === "production" ? "error" : "warning";
  const healthPath = process.env.DANCEOFTAL_DATA_API_HEALTH_PATH || "/health";
  return step(
    "run-product-backend-smoke-test",
    "Run product backend smoke test",
    state,
    state === "ok"
      ? "A product data API URL is configured; run a non-mutating health check before sending writes."
      : "Configure the product data API before running non-mutating health checks.",
    {
      env: ["DANCEOFTAL_DATA_API_URL", "DANCEOFTAL_DATA_API_HEALTH_PATH"],
      status: baseUrl ? "health_check_ready" : "data_api_missing",
      command: baseUrl ? `curl -fsS ${baseUrl.replace(/\/+$/, "")}${healthPath}` : "Set DANCEOFTAL_DATA_API_URL first.",
    },
  );
}

function planStatus(steps) {
  const errors = steps.filter((item) => item.state === "error");
  const warnings = steps.filter((item) => item.state === "warning");
  if (errors.length) {
    return "blocked";
  }
  if (
    warnings.some(
      (item) =>
        item.key.includes("backend") ||
        item.key.includes("storage") ||
        item.key.includes("auth") ||
        item.key.includes("data-api") ||
        item.key.includes("write-switch"),
    )
  ) {
    return "needs_backend";
  }
  if (warnings.length) {
    return "needs_review";
  }
  return "ready_to_connect";
}

function diagnosticsForSteps(steps) {
  return steps
    .filter((item) => item.state === "error" || item.state === "warning")
    .map((item) =>
      diagnostic(
        item.state === "error" ? "error" : "warning",
        `backend-connection-${item.key}`,
        item.detail,
        item.key,
      ),
    );
}

function compileProductBackendConnectionPlan({
  readiness,
  contract,
  adapter,
  permissions,
  governance,
  generatedAt,
  writeEnabled,
  tokenPresent,
} = {}) {
  const auth = surfaceByKey(readiness, "product-auth");
  const dataApi = surfaceByKey(readiness, "product-data-api");
  const steps = [
    surfaceStep(
      "configure-product-auth",
      "Configure product-owned auth",
      auth,
      "Point DOT auth at the product-owned backend before commercial or production use.",
      ["DOT_SUPABASE_URL", "DOT_SUPABASE_ANON_KEY"],
    ),
    surfaceStep(
      "configure-product-data-api",
      "Configure product data API",
      dataApi,
      "Set the data owner and a non-local product API URL for server-backed writes.",
      ["DANCEOFTAL_DATA_OWNER", "DANCEOFTAL_DATA_API_URL"],
    ),
    storageStep(readiness || {}),
    contractStep(contract || {}),
    adapterStep(adapter || {}),
    permissionStep(permissions || {}),
    governanceStep(governance || {}),
    serverWriteStep(adapter || {}, { writeEnabled, tokenPresent }),
    smokeTestStep(readiness || {}, contract || {}),
  ];
  const status = planStatus(steps);
  const diagnostics = diagnosticsForSteps(steps);
  const nextRecommendedStep = steps.find((item) => item.state !== "ok") || {
    key: "no-local-only-recommendation",
    title: "No local-only recommendation remains",
    state: "ok",
    detail: "The next step is to run the configured real backend smoke test and send guarded writes.",
  };

  return {
    product_backend_connection_plan_version: PRODUCT_BACKEND_CONNECTION_PLAN_VERSION,
    generatedAt: generatedAt || new Date().toISOString(),
    status,
    mode: readiness?.mode || readiness?.summary?.mode || "development",
    summary: {
      ready: status === "ready_to_connect",
      status,
      stepCount: steps.length,
      readyStepCount: steps.filter((item) => item.state === "ok").length,
      blockedStepCount: steps.filter((item) => item.state === "error").length,
      warningStepCount: steps.filter((item) => item.state === "warning").length,
      nextRecommendedStepKey: nextRecommendedStep.key,
      localOnlyRecommendationExhausted: nextRecommendedStep.key === "no-local-only-recommendation",
    },
    nextRecommendedStep,
    steps,
    diagnostics,
    diagnosticsByLevel: {
      error: diagnostics.filter((item) => item.level === "error"),
      warning: diagnostics.filter((item) => item.level === "warning"),
    },
  };
}

module.exports = {
  PRODUCT_BACKEND_CONNECTION_PLAN_VERSION,
  compileProductBackendConnectionPlan,
};
