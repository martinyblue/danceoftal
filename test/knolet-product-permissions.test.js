const test = require("node:test");
const assert = require("node:assert/strict");
const { readProductPermissions } = require("../lib/knolet/product-permissions");

test("development mode allows implicit local owner with warnings", () => {
  const permissions = readProductPermissions({
    env: { DANCEOFTAL_MODE: "development" },
    generatedAt: "2026-04-30T00:00:00.000Z",
  });

  assert.equal(permissions.product_permission_version, "0.1");
  assert.equal(permissions.summary.ready, true);
  assert.equal(permissions.summary.status, "needs_review");
  assert.equal(permissions.summary.allowedCount, 5);
  assert.ok(permissions.diagnosticsByLevel.warning.length > 0);
});

test("production mode blocks missing actor role", () => {
  const permissions = readProductPermissions({
    env: { DANCEOFTAL_MODE: "production" },
  });

  assert.equal(permissions.summary.ready, false);
  assert.equal(permissions.summary.blockedCount, 5);
  assert.ok(permissions.diagnosticsByLevel.error.some((item) => item.code === "permission-missing-actor"));
});

test("editor can write workspace data but cannot install or publish", () => {
  const permissions = readProductPermissions({
    env: {
      DANCEOFTAL_MODE: "production",
      DANCEOFTAL_ACTOR_ID: "user_1",
      DANCEOFTAL_ACTOR_ROLE: "editor",
    },
  });

  assert.equal(permissions.summary.allowedCount, 3);
  assert.equal(permissions.summary.blockedCount, 2);
  assert.ok(permissions.checks.find((check) => check.key === "workspace.write").allowed);
  assert.equal(permissions.checks.find((check) => check.key === "publish.request").allowed, false);
});

test("admin can perform all current product write actions", () => {
  const permissions = readProductPermissions({
    env: {
      DANCEOFTAL_MODE: "production",
      DANCEOFTAL_ACTOR_ID: "user_1",
      DANCEOFTAL_ACTOR_ROLE: "admin",
    },
  });

  assert.equal(permissions.summary.ready, true);
  assert.equal(permissions.summary.allowedCount, 5);
  assert.equal(permissions.summary.blockedCount, 0);
});
