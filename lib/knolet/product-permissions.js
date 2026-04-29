const PRODUCT_PERMISSION_VERSION = "0.1";

const ROLE_RANK = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

const ACTIONS = [
  {
    key: "workspace.write",
    label: "Workspace write",
    requiredRole: "editor",
    detail: "Save KnoletSpec, RuntimePlan, and Graph snapshots.",
  },
  {
    key: "source.bind",
    label: "Source binding",
    requiredRole: "editor",
    detail: "Confirm KnowledgeSource target bindings for a workspace.",
  },
  {
    key: "run.append",
    label: "Run log append",
    requiredRole: "editor",
    detail: "Append workflow run log events and validation state.",
  },
  {
    key: "library.install",
    label: "Library install",
    requiredRole: "admin",
    detail: "Install shared templates and source rebinding manifests.",
  },
  {
    key: "publish.request",
    label: "Publish request",
    requiredRole: "admin",
    detail: "Request a share/publish action for templates or app packages.",
  },
];

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return ROLE_RANK[role] ? role : "";
}

function normalizeMode(value) {
  const mode = String(value || "development").trim().toLowerCase();
  return ["development", "commercial", "production"].includes(mode) ? mode : "development";
}

function actorFromEnv(env = process.env) {
  const role = normalizeRole(env.DANCEOFTAL_ACTOR_ROLE || env.DANCEOFTAL_DATA_ROLE);
  return {
    id: String(env.DANCEOFTAL_ACTOR_ID || env.DANCEOFTAL_DATA_OWNER || "").trim(),
    role,
    owner: String(env.DANCEOFTAL_DATA_OWNER || "").trim(),
  };
}

function actionAllowed(actor, action, mode) {
  const actorRank = ROLE_RANK[actor.role] || 0;
  const requiredRank = ROLE_RANK[action.requiredRole] || ROLE_RANK.owner;
  if (mode === "development" && !actor.role) {
    return {
      allowed: true,
      state: "warning",
      reason: "development-implicit-owner",
      detail: "Development mode allows local writes without product auth, but production requires an actor role.",
    };
  }
  if (!actor.id || !actor.role) {
    return {
      allowed: false,
      state: mode === "production" ? "error" : "warning",
      reason: "missing-actor",
      detail: "Set DANCEOFTAL_ACTOR_ID and DANCEOFTAL_ACTOR_ROLE before product writes.",
    };
  }
  if (actorRank >= requiredRank) {
    return {
      allowed: true,
      state: "ok",
      reason: "role-allowed",
      detail: `${actor.role} can perform ${action.key}.`,
    };
  }
  return {
    allowed: false,
    state: mode === "production" ? "error" : "warning",
    reason: "role-insufficient",
    detail: `${action.key} requires ${action.requiredRole}; actor role is ${actor.role}.`,
  };
}

function readProductPermissions(options = {}) {
  const env = options.env || process.env;
  const mode = normalizeMode(env.DANCEOFTAL_MODE || env.NODE_ENV);
  const actor = options.actor || actorFromEnv(env);
  const checks = ACTIONS.map((action) => ({
    ...action,
    ...actionAllowed(actor, action, mode),
  }));
  const errors = checks.filter((check) => check.state === "error");
  const warnings = checks.filter((check) => check.state === "warning");
  return {
    product_permission_version: PRODUCT_PERMISSION_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    mode,
    actor,
    summary: {
      ready: errors.length === 0,
      status: errors.length ? "blocked" : warnings.length ? "needs_review" : "ready",
      actionCount: checks.length,
      allowedCount: checks.filter((check) => check.allowed).length,
      blockedCount: checks.filter((check) => !check.allowed).length,
      errorCount: errors.length,
      warningCount: warnings.length,
    },
    checks,
    diagnosticsByLevel: {
      error: errors.map((check) => ({
        level: "error",
        code: `permission-${check.reason}`,
        message: check.detail,
        path: check.key,
      })),
      warning: warnings.map((check) => ({
        level: "warning",
        code: `permission-${check.reason}`,
        message: check.detail,
        path: check.key,
      })),
    },
  };
}

module.exports = {
  ACTIONS,
  PRODUCT_PERMISSION_VERSION,
  readProductPermissions,
};
