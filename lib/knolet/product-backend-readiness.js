const fs = require("node:fs/promises");
const path = require("node:path");
const { diagnostic } = require("./schema");

const PRODUCT_BACKEND_READINESS_VERSION = "0.1";
const UPSTREAM_DOT_SUPABASE_URL = "https://qbildcrfjencoqkngyfw.supabase.co";
const MODES = new Set(["development", "commercial", "production"]);

const SURFACES = [
  {
    key: "workspace-storage",
    title: "Workspace storage",
    storageEnv: "DANCEOFTAL_WORKSPACE_STORAGE_MODE",
    fallbackStorageEnv: "DANCEOFTAL_STORAGE_MODE",
    localKinds: ["knolet_spec", "runtime_plan", "graph_model"],
    requirement: "KnoletSpec, RuntimePlan, and graph snapshots must be saved through the product data API.",
  },
  {
    key: "source-binding-storage",
    title: "Source binding storage",
    storageEnv: "DANCEOFTAL_SOURCE_BINDING_STORAGE_MODE",
    fallbackStorageEnv: "DANCEOFTAL_STORAGE_MODE",
    localKinds: ["knolet_spec", "library_source_binding"],
    requirement: "KnowledgeSource pointers and binding confirmations must be stored by the product backend.",
  },
  {
    key: "run-log-storage",
    title: "Run log storage",
    storageEnv: "DANCEOFTAL_RUN_LOG_STORAGE_MODE",
    fallbackStorageEnv: "DANCEOFTAL_STORAGE_MODE",
    localKinds: ["runtime_plan", "workflow_run"],
    requirement: "Workflow execution logs and session state must be written to product-owned storage.",
  },
  {
    key: "library-install-storage",
    title: "Library install storage",
    storageEnv: "DANCEOFTAL_LIBRARY_STORAGE_MODE",
    fallbackStorageEnv: "DANCEOFTAL_STORAGE_MODE",
    localKinds: ["library_install"],
    requirement: "Installed templates, rebinding records, and manifests need a server-backed workspace owner.",
  },
  {
    key: "publish-governance",
    title: "Publish governance",
    storageEnv: "DANCEOFTAL_PUBLISH_STORAGE_MODE",
    fallbackStorageEnv: "DANCEOFTAL_STORAGE_MODE",
    localKinds: ["library_package", "share_export"],
    requirement: "Share/export actions must record target, owner, and copied-data policy before publishing.",
  },
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeMode(value) {
  const mode = String(value || "development").trim().toLowerCase();
  return MODES.has(mode) ? mode : "development";
}

function normalizeStorageMode(value) {
  return String(value || "local").trim().toLowerCase() || "local";
}

function isPrivateUrl(value) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[?::1\]?)(:\d+)?(\/|$)/.test(value || "");
}

function usablePublicUrl(value) {
  return Boolean(value && /^https?:\/\//.test(value) && !isPrivateUrl(value));
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath, diagnostics, root, kind) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (await exists(filePath)) {
      diagnostics.push(
        diagnostic(
          "warning",
          "product-backend-invalid-local-json",
          `Could not inspect ${kind} at ${path.relative(root, filePath)}: ${error.message}`,
          path.relative(root, filePath),
        ),
      );
    }
    return null;
  }
}

async function artifact(root, relativePath, kind, label) {
  const filePath = path.join(root, relativePath);
  try {
    const stats = await fs.stat(filePath);
    return {
      kind,
      label,
      path: relativePath,
      size: stats.size,
      updatedAt: stats.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

async function listFiles(dir) {
  if (!(await exists(dir))) {
    return [];
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await listFiles(entryPath)));
    } else if (entry.isFile()) {
      results.push(entryPath);
    }
  }
  return results.sort();
}

async function fileArtifacts(root, relativeDir, kind, label, predicate = () => true) {
  const dir = path.join(root, relativeDir);
  const files = await listFiles(dir);
  const records = [];
  for (const filePath of files.filter(predicate)) {
    const relativePath = path.relative(root, filePath);
    const item = await artifact(root, relativePath, kind, label);
    if (item) {
      records.push(item);
    }
  }
  return records;
}

function storageModeFor(env, surface) {
  return normalizeStorageMode(env[surface.storageEnv] || env[surface.fallbackStorageEnv]);
}

function artifactCountForKinds(localArtifacts, kinds) {
  return localArtifacts.filter((item) => kinds.includes(item.kind)).length;
}

function surfaceState({ mode, storageMode, dataApiReady, dataOwnerReady, localCount }) {
  const production = mode === "production";
  const commercial = mode === "commercial";
  const serverSelected = storageMode === "server";
  const serverReady = serverSelected && dataApiReady && dataOwnerReady;

  if (serverReady) {
    return {
      state: "ok",
      status: localCount ? "server_ready_with_local_artifacts" : "server_ready",
      ready: true,
    };
  }

  if (production) {
    return {
      state: "error",
      status: serverSelected ? "server_backend_incomplete" : "local_only_blocked",
      ready: false,
    };
  }

  if (commercial || localCount) {
    return {
      state: "warning",
      status: serverSelected ? "server_backend_incomplete" : "local_first",
      ready: false,
    };
  }

  return {
    state: "ok",
    status: "not_started",
    ready: true,
  };
}

function buildSurfaceDiagnostics(surfaces) {
  const diagnostics = [];
  for (const surface of surfaces) {
    if (surface.state === "error") {
      diagnostics.push(
        diagnostic(
          "error",
          "product-backend-surface-not-server-backed",
          `${surface.title} is not ready for production server-backed storage.`,
          surface.key,
        ),
      );
    } else if (surface.state === "warning") {
      diagnostics.push(
        diagnostic(
          "warning",
          "product-backend-surface-local-first",
          `${surface.title} still uses local-first storage for this mode.`,
          surface.key,
        ),
      );
    }
  }
  return diagnostics;
}

function authSurface(env, mode) {
  const authUrl = String(env.DOT_SUPABASE_URL || "").trim();
  const anonKey = String(env.DOT_SUPABASE_ANON_KEY || "").trim();
  const ready = Boolean(authUrl && authUrl !== UPSTREAM_DOT_SUPABASE_URL && anonKey);
  const required = mode === "commercial" || mode === "production";
  const state = ready ? "ok" : required ? "error" : "warning";
  return {
    key: "product-auth",
    title: "Product auth",
    state,
    status: ready ? "product_auth_configured" : "auth_backend_missing",
    ready,
    requirement: "DOT auth must point to a product-owned backend, not the upstream open-source Supabase project.",
    detail: ready
      ? `DOT_SUPABASE_URL is configured for ${authUrl}.`
      : "Set DOT_SUPABASE_URL and DOT_SUPABASE_ANON_KEY before commercial or production use.",
    localArtifactCount: 0,
    localArtifacts: [],
    env: {
      DOT_SUPABASE_URL: authUrl ? authUrl : "unset",
      DOT_SUPABASE_ANON_KEY: anonKey ? "set" : "unset",
    },
  };
}

function dataApiSurface(env, mode) {
  const dataApiUrl = String(env.DANCEOFTAL_DATA_API_URL || "").trim();
  const dataOwner = String(env.DANCEOFTAL_DATA_OWNER || "").trim();
  const apiReady = usablePublicUrl(dataApiUrl);
  const ownerReady = Boolean(dataOwner);
  const ready = apiReady && ownerReady;
  const state = ready ? "ok" : mode === "production" ? "error" : "warning";
  return {
    key: "product-data-api",
    title: "Product data API",
    state,
    status: ready ? "product_data_api_configured" : "product_data_api_missing",
    ready,
    requirement: "All server-backed workspace, source binding, run log, and publish writes need a product-owned data API and owner.",
    detail: ready
      ? `DANCEOFTAL_DATA_API_URL is configured for ${dataApiUrl}.`
      : "Set DANCEOFTAL_DATA_OWNER and a non-local DANCEOFTAL_DATA_API_URL.",
    localArtifactCount: 0,
    localArtifacts: [],
    env: {
      DANCEOFTAL_DATA_OWNER: dataOwner || "unset",
      DANCEOFTAL_DATA_API_URL: dataApiUrl || "unset",
    },
  };
}

function backendSurface(surface, env, mode, localArtifacts, dataApiReady, dataOwnerReady) {
  const storageMode = storageModeFor(env, surface);
  const localSurfaceArtifacts = localArtifacts.filter((item) => surface.localKinds.includes(item.kind));
  const localCount = artifactCountForKinds(localArtifacts, surface.localKinds);
  const state = surfaceState({ mode, storageMode, dataApiReady, dataOwnerReady, localCount });
  return {
    key: surface.key,
    title: surface.title,
    state: state.state,
    status: state.status,
    ready: state.ready,
    requirement: surface.requirement,
    detail:
      storageMode === "server"
        ? "Server storage is selected; data API and owner must be configured."
        : "Local-first storage is selected.",
    storageMode,
    storageEnv: surface.storageEnv,
    fallbackStorageEnv: surface.fallbackStorageEnv,
    localArtifactCount: localCount,
    localArtifacts: localSurfaceArtifacts,
  };
}

function nextActions({ mode, surfaces, inlineSourceContentCount }) {
  const actions = [];
  if (surfaces.some((surface) => surface.key === "product-auth" && surface.state !== "ok")) {
    actions.push({
      key: "configure-product-auth",
      required: mode !== "development",
      detail: "Set DOT_SUPABASE_URL and DOT_SUPABASE_ANON_KEY to the product-owned auth backend.",
    });
  }
  if (surfaces.some((surface) => surface.key === "product-data-api" && surface.state !== "ok")) {
    actions.push({
      key: "configure-product-data-api",
      required: mode === "production",
      detail: "Set DANCEOFTAL_DATA_OWNER and a non-local DANCEOFTAL_DATA_API_URL.",
    });
  }
  for (const surface of surfaces.filter((item) => item.storageMode && item.state !== "ok")) {
    actions.push({
      key: `server-back-${surface.key}`,
      required: mode === "production",
      detail: `Set ${surface.storageEnv}=server, or DANCEOFTAL_STORAGE_MODE=server for all backend surfaces.`,
    });
  }
  if (inlineSourceContentCount) {
    actions.push({
      key: "remove-inline-source-content",
      required: mode === "production",
      detail: "Move KnowledgeSource.content into the product source store and keep only pointers in KnoletSpec/library records.",
    });
  }
  if (!actions.length) {
    actions.push({
      key: "ready-for-backend-contract",
      required: false,
      detail: "Define the product data API request/response contract for workspace, source binding, run log, and publish writes.",
    });
  }
  return actions;
}

function readinessSummary(mode, diagnostics, localArtifacts, surfaces) {
  const errors = diagnostics.filter((item) => item.level === "error");
  const warnings = diagnostics.filter((item) => item.level === "warning");
  return {
    ready: errors.length === 0,
    status: errors.length ? "blocked" : warnings.length ? "needs_review" : "ready",
    mode,
    surfaceCount: surfaces.length,
    readySurfaceCount: surfaces.filter((surface) => surface.state === "ok").length,
    localArtifactCount: localArtifacts.length,
    serverBackedSurfaceCount: surfaces.filter((surface) => surface.storageMode === "server").length,
    localFirstSurfaceCount: surfaces.filter((surface) => surface.storageMode && surface.storageMode !== "server").length,
    errorCount: errors.length,
    warningCount: warnings.length,
  };
}

async function inspectLocalArtifacts(root, diagnostics) {
  const localArtifacts = [];
  for (const item of [
    [".dance-of-tal/knolet.json", "knolet_spec", "KnoletSpec"],
    [".dance-of-tal/runtime-plan.json", "runtime_plan", "RuntimePlan"],
    [".dance-of-tal/knolet-graph.json", "graph_model", "GraphModel"],
    [".dance-of-tal/knolet-library-package.json", "library_package", "LibraryPackage"],
    [".dance-of-tal/knolet-library-install-plan.json", "library_install", "LibraryInstallPlan"],
    [".dance-of-tal/knolet-library-install-execution.json", "library_install", "LibraryInstallExecution"],
  ]) {
    const record = await artifact(root, item[0], item[1], item[2]);
    if (record) {
      localArtifacts.push(record);
    }
  }

  localArtifacts.push(
    ...(await fileArtifacts(root, ".dance-of-tal/runs", "workflow_run", "WorkflowRun", (filePath) =>
      filePath.endsWith(".json"),
    )),
  );
  localArtifacts.push(
    ...(await fileArtifacts(root, ".dance-of-tal/exports", "share_export", "ShareExport", (filePath) =>
      /\.(md|json)$/i.test(filePath),
    )),
  );
  localArtifacts.push(
    ...(await fileArtifacts(root, ".dance-of-tal/library", "library_install", "LibraryRecord", (filePath) =>
      filePath.endsWith(".json"),
    )),
  );

  const spec = await readJson(path.join(root, ".dance-of-tal/knolet.json"), diagnostics, root, "KnoletSpec");
  const runtimePlan = await readJson(path.join(root, ".dance-of-tal/runtime-plan.json"), diagnostics, root, "RuntimePlan");
  const knowledgeSources = asArray(spec?.knowledge?.sources);
  const inlineSourceContentCount = knowledgeSources.filter((source) => source?.content).length;

  return {
    localArtifacts,
    detail: {
      knowledgeSourceCount: knowledgeSources.length,
      inlineSourceContentCount,
      runtimeRunLogPresent: Boolean(runtimePlan?.run_log),
    },
  };
}

async function readProductBackendReadiness(options = {}) {
  const root = options.root || process.cwd();
  const env = options.env || process.env;
  const mode = normalizeMode(env.DANCEOFTAL_MODE || env.NODE_ENV);
  const diagnostics = [];
  const { localArtifacts, detail } = await inspectLocalArtifacts(root, diagnostics);
  const dataApi = dataApiSurface(env, mode);
  const auth = authSurface(env, mode);
  const dataApiReady = dataApi.ready;
  const dataOwnerReady = Boolean(String(env.DANCEOFTAL_DATA_OWNER || "").trim());
  const backendSurfaces = SURFACES.map((surface) =>
    backendSurface(surface, env, mode, localArtifacts, dataApiReady, dataOwnerReady),
  );
  const surfaces = [auth, dataApi, ...backendSurfaces];

  if (auth.state === "error") {
    diagnostics.push(
      diagnostic("error", "product-backend-auth-missing", auth.detail, "DOT_SUPABASE_URL"),
    );
  } else if (auth.state === "warning") {
    diagnostics.push(
      diagnostic("warning", "product-backend-auth-advisory", auth.detail, "DOT_SUPABASE_URL"),
    );
  }
  if (dataApi.state === "error") {
    diagnostics.push(
      diagnostic("error", "product-backend-data-api-missing", dataApi.detail, "DANCEOFTAL_DATA_API_URL"),
    );
  } else if (dataApi.state === "warning") {
    diagnostics.push(
      diagnostic("warning", "product-backend-data-api-advisory", dataApi.detail, "DANCEOFTAL_DATA_API_URL"),
    );
  }

  diagnostics.push(...buildSurfaceDiagnostics(backendSurfaces));

  if (detail.inlineSourceContentCount) {
    diagnostics.push(
      diagnostic(
        mode === "production" ? "error" : "warning",
        "product-backend-inline-source-content",
        `${detail.inlineSourceContentCount} KnowledgeSource record(s) still contain inline source content.`,
        "knowledge.sources",
      ),
    );
  }

  return {
    product_backend_readiness_version: PRODUCT_BACKEND_READINESS_VERSION,
    generatedAt: new Date().toISOString(),
    mode,
    env: {
      DANCEOFTAL_MODE: mode,
      DANCEOFTAL_STORAGE_MODE: normalizeStorageMode(env.DANCEOFTAL_STORAGE_MODE),
      DANCEOFTAL_DATA_OWNER: env.DANCEOFTAL_DATA_OWNER || "",
      DANCEOFTAL_DATA_API_URL: env.DANCEOFTAL_DATA_API_URL || "",
    },
    summary: readinessSummary(mode, diagnostics, localArtifacts, surfaces),
    surfaces,
    localArtifacts,
    detail,
    diagnostics,
    diagnosticsByLevel: {
      error: diagnostics.filter((item) => item.level === "error"),
      warning: diagnostics.filter((item) => item.level === "warning"),
    },
    nextActions: nextActions({ mode, surfaces, inlineSourceContentCount: detail.inlineSourceContentCount }),
  };
}

module.exports = {
  PRODUCT_BACKEND_READINESS_VERSION,
  readProductBackendReadiness,
};
