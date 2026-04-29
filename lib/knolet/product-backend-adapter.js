const PRODUCT_BACKEND_ADAPTER_VERSION = "0.1";

const KIND_TO_ENDPOINT = {
  workspace_snapshot: "workspace-snapshot",
  source_binding_confirmation: "source-binding-confirmation",
  run_log_event: "run-log-event",
  library_install_receipt: "library-install-receipt",
  publish_intent: "publish-intent",
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readinessMode(readiness) {
  return readiness?.mode || readiness?.summary?.mode || "development";
}

function endpointByKey(contract) {
  return new Map(asArray(contract?.endpoints).map((endpoint) => [endpoint.key, endpoint]));
}

function endpointForKind(kind, contract) {
  const key = KIND_TO_ENDPOINT[kind] || kind;
  return endpointByKey(contract).get(key) || null;
}

function pathForEndpoint(endpoint, payload) {
  return String(endpoint?.path || "")
    .replaceAll("{workspace_id}", encodeURIComponent(payload.workspace_id || "workspace"))
    .replaceAll("{run_id}", encodeURIComponent(payload.run_id || "run"));
}

function requiredFields(endpoint) {
  return asArray(endpoint?.request?.required);
}

function missingFields(endpoint, payload) {
  return requiredFields(endpoint).filter((field) => payload?.[field] === undefined || payload?.[field] === "");
}

function endpointWriteKind(endpoint) {
  return Object.entries(KIND_TO_ENDPOINT).find(([, endpointKey]) => endpointKey === endpoint.key)?.[0] || endpoint.key;
}

function sampleValue(field) {
  if (field.endsWith("_id")) {
    return `sample_${field}`;
  }
  if (field.endsWith("_at")) {
    return "2026-04-30T00:00:00.000Z";
  }
  if (field === "required") {
    return true;
  }
  if (field === "template_records" || field === "source_bindings" || field === "artifact_refs") {
    return [];
  }
  if (field === "share_policy") {
    return { copies_source_documents: false };
  }
  if (field === "target") {
    return { kind: "library", owner: "martinyblue", stage: "local" };
  }
  if (field === "knolet_spec" || field === "runtime_plan" || field === "graph_model") {
    return { ref: `sample_${field}` };
  }
  return `sample_${field}`;
}

function samplePayload(endpoint) {
  const payload = {};
  for (const field of requiredFields(endpoint)) {
    payload[field] = sampleValue(field);
  }
  if (endpoint.key === "run-log-event") {
    payload.run_id = payload.run_id || "sample_run_id";
  }
  return payload;
}

function adapterStatus({ readiness, contract, endpoint, payload, dryRun }) {
  const mode = readinessMode(readiness);
  if (!endpoint) {
    return {
      status: "blocked",
      reason: "unknown_endpoint",
      detail: "No product backend contract endpoint matches this write kind.",
    };
  }

  const missing = missingFields(endpoint, payload);
  if (missing.length) {
    return {
      status: "blocked",
      reason: "missing_required_fields",
      detail: `Missing required fields: ${missing.join(", ")}`,
      missing,
    };
  }

  if (endpoint.status === "blocked_by_readiness" || readiness?.summary?.status === "blocked") {
    return {
      status: "blocked",
      reason: "readiness_blocked",
      detail: "Product backend readiness is blocked for this endpoint.",
    };
  }

  if (!contract?.baseUrl) {
    return {
      status: mode === "production" ? "blocked" : "local_passthrough",
      reason: "data_api_missing",
      detail: "DANCEOFTAL_DATA_API_URL is not configured.",
    };
  }

  if (endpoint.status !== "ready_for_adapter") {
    return {
      status: mode === "production" ? "blocked" : "local_passthrough",
      reason: "storage_not_server_backed",
      detail: "Storage is not server-backed for this endpoint yet.",
    };
  }

  if (dryRun) {
    return {
      status: "dry_run",
      reason: "dry_run",
      detail: "Server write is ready but dry-run mode is enabled.",
    };
  }

  return {
    status: "ready_to_send",
    reason: "server_write_ready",
    detail: "Server write can be sent through the product backend adapter.",
  };
}

function planProductBackendWrite(kind, payload, options = {}) {
  const contract = options.contract || {};
  const readiness = options.readiness || {};
  const endpoint = endpointForKind(kind, contract);
  const status = adapterStatus({
    readiness,
    contract,
    endpoint,
    payload,
    dryRun: options.dryRun === true,
  });
  const relativePath = endpoint ? pathForEndpoint(endpoint, payload || {}) : "";
  const url = contract.baseUrl && relativePath ? `${contract.baseUrl.replace(/\/+$/, "")}${relativePath}` : "";

  return {
    kind,
    product_backend_adapter_version: PRODUCT_BACKEND_ADAPTER_VERSION,
    endpoint: endpoint
      ? {
          key: endpoint.key,
          method: endpoint.method,
          path: endpoint.path,
          url,
        }
      : null,
    status: status.status,
    reason: status.reason,
    detail: status.detail,
    missing: status.missing || [],
    mode: readinessMode(readiness),
    dryRun: options.dryRun === true,
  };
}

async function executeProductBackendWrite(kind, payload, options = {}) {
  const plan = planProductBackendWrite(kind, payload, options);
  if (plan.status !== "ready_to_send") {
    return {
      ok: plan.status === "dry_run" || plan.status === "local_passthrough",
      status: plan.status,
      plan,
      response: null,
    };
  }

  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(plan.endpoint.url, {
    method: plan.endpoint.method,
    headers: {
      authorization: options.authorization || "Bearer <product-session-token>",
      "idempotency-key": options.idempotencyKey || `${kind}:${payload.workspace_id || "workspace"}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { text };
  }

  return {
    ok: response.ok,
    status: response.ok ? "sent" : "failed",
    plan,
    response: {
      status: response.status,
      body,
    },
  };
}

function previewProductBackendAdapter(readiness, contract, options = {}) {
  const dryRun = options.dryRun !== false;
  const plans = asArray(contract?.endpoints).map((endpoint) => {
    const kind = endpointWriteKind(endpoint);
    return planProductBackendWrite(kind, samplePayload(endpoint), {
      readiness,
      contract,
      dryRun,
    });
  });
  const blocked = plans.filter((plan) => plan.status === "blocked");
  const ready = plans.filter((plan) => plan.status === "ready_to_send" || plan.status === "dry_run");
  return {
    product_backend_adapter_version: PRODUCT_BACKEND_ADAPTER_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    status: blocked.length ? "blocked" : ready.length ? "ready" : "local_passthrough",
    dryRun,
    summary: {
      ready: blocked.length === 0,
      planCount: plans.length,
      readyCount: ready.length,
      blockedCount: blocked.length,
      localPassthroughCount: plans.filter((plan) => plan.status === "local_passthrough").length,
    },
    plans,
  };
}

module.exports = {
  PRODUCT_BACKEND_ADAPTER_VERSION,
  executeProductBackendWrite,
  planProductBackendWrite,
  previewProductBackendAdapter,
};
