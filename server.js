const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const { execFile } = require("node:child_process");
const {
  buildChecks: buildCommercialChecks,
  summarize: summarizeCommercialChecks,
} = require("./scripts/check-commercial-boundary");
const { importDotWorkspace } = require("./lib/knolet/dot-importer");
const { compileKnoletRuntimePlan } = require("./lib/knolet/runtime-plan");
const { compileKnoletGraphModel } = require("./lib/knolet/graph-model");
const { compileKnoletLibraryPackage } = require("./lib/knolet/library-package");
const { compileKnoletLibraryInstallPlan } = require("./lib/knolet/library-install-plan");
const { compileKnoletLibraryInstallExecution } = require("./lib/knolet/library-install-executor");
const { readKnoletLibraryInventory } = require("./lib/knolet/library-inventory");
const { readProductBackendReadiness } = require("./lib/knolet/product-backend-readiness");
const { compileProductBackendContract } = require("./lib/knolet/product-backend-contract");
const { previewProductBackendAdapter } = require("./lib/knolet/product-backend-adapter");

const root = process.cwd();
const workspaceRoot = path.join(root, ".dance-of-tal");
const workflowRunsRoot = path.join(workspaceRoot, "runs");
const workflowExportsRoot = path.join(workspaceRoot, "exports");
const knoletWorkspaceSpecPath = path.join(workspaceRoot, "knolet.json");
const knoletRootSpecPath = path.join(root, "knolet.json");
const runtimePlanPath = path.join(workspaceRoot, "runtime-plan.json");
const knoletGraphPath = path.join(workspaceRoot, "knolet-graph.json");
const knoletGraphLayoutPath = path.join(workspaceRoot, "knolet-graph-layout.json");
const knoletLibraryPackagePath = path.join(workspaceRoot, "knolet-library-package.json");
const knoletLibraryInstallPlanPath = path.join(workspaceRoot, "knolet-library-install-plan.json");
const knoletLibraryInstallExecutionPath = path.join(workspaceRoot, "knolet-library-install-execution.json");
const knoletLibraryRoot = path.join(workspaceRoot, "library");
const port = Number(process.env.PORT || 8080);
const studioUrl = process.env.DOT_STUDIO_URL || "http://127.0.0.1:43110";
const opencodeUrl = process.env.OPENCODE_URL || "http://127.0.0.1:43120";
const shutdownAfterMs = Number(process.env.SHUTDOWN_AFTER_MS || 0);
const managerStartedAt = Date.now();
const managerShutdownAt =
  Number.isFinite(shutdownAfterMs) && shutdownAfterMs > 0
    ? managerStartedAt + shutdownAfterMs
    : null;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const assetKinds = new Set(["tal", "dance", "performer", "act"]);
const GRAPH_LAYOUT_VERSION = "0.1";

function send(response, status, payload, type = "application/json; charset=utf-8") {
  response.writeHead(status, { "content-type": type });
  response.end(typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
}

function slug(value, fallback) {
  return String(value || fallback)
    .trim()
    .replace(/^@/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body is too large"));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function runCommand(command, args = []) {
  return new Promise((resolve) => {
    execFile(command, args, { cwd: root, timeout: 5000 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: String(stdout || "").trim(),
        stderr: String(stderr || "").trim(),
        error: error ? error.message : null,
      });
    });
  });
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 2500);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { "content-type": "application/json", ...(options.headers || {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readPackageVersion() {
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

async function ensureWorkspace() {
  await fs.mkdir(workspaceRoot, { recursive: true });
  await fs.mkdir(workflowRunsRoot, { recursive: true });
  await fs.mkdir(workflowExportsRoot, { recursive: true });
  for (const kind of assetKinds) {
    await fs.mkdir(path.join(workspaceRoot, kind), { recursive: true });
  }
  await fs.writeFile(
    path.join(workspaceRoot, "workspace.json"),
    JSON.stringify(
      {
        name: "danceoftal-local",
        owner: "martinyblue",
        stage: "local",
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

function assetPath({ kind, owner, stage, name }) {
  const cleanKind = slug(kind, "tal");
  if (!assetKinds.has(cleanKind)) {
    throw new Error("Unsupported asset kind");
  }

  const cleanOwner = slug(owner, "martinyblue");
  const cleanStage = slug(stage, "local");
  const cleanName = slug(name, "asset");
  const ownerDir = `@${cleanOwner}`;

  if (cleanKind === "dance") {
    return {
      urn: `${cleanKind}/${ownerDir}/${cleanStage}/${cleanName}`,
      filePath: path.join(workspaceRoot, cleanKind, ownerDir, cleanStage, cleanName, "SKILL.md"),
    };
  }

  return {
    urn: `${cleanKind}/${ownerDir}/${cleanStage}/${cleanName}`,
    filePath: path.join(workspaceRoot, cleanKind, ownerDir, cleanStage, `${cleanName}.json`),
  };
}

function officialAssetPath({ kind, owner, stage, name }) {
  const cleanKind = slug(kind, "tal");
  if (!assetKinds.has(cleanKind)) {
    throw new Error("Unsupported asset kind");
  }

  const cleanOwner = slug(owner, "martinyblue");
  const cleanStage = slug(stage, "danceoftal");
  const cleanName = slug(name, "asset");
  const ownerDir = `@${cleanOwner}`;

  if (cleanKind === "dance") {
    return {
      urn: `${cleanKind}/${ownerDir}/${cleanStage}/${cleanName}`,
      filePath: path.join(workspaceRoot, "assets", cleanKind, ownerDir, cleanStage, cleanName, "SKILL.md"),
    };
  }

  return {
    urn: `${cleanKind}/${ownerDir}/${cleanStage}/${cleanName}`,
    filePath: path.join(workspaceRoot, "assets", cleanKind, ownerDir, cleanStage, `${cleanName}.json`),
  };
}

function assetFromUrn(urn) {
  const match = String(urn || "").match(/^(tal|dance|performer|act)\/@([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!match) {
    return null;
  }
  return {
    kind: match[1],
    owner: match[2],
    stage: match[3],
    name: match[4],
  };
}

function normalizeBody(kind, urn, body) {
  if (kind === "dance") {
    return String(body || "").trimEnd() + "\n";
  }

  let parsed;
  if (typeof body === "string") {
    parsed = body.trim() ? JSON.parse(body) : {};
  } else {
    parsed = body || {};
  }

  return JSON.stringify(
    {
      kind,
      urn,
      ...parsed,
      updatedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

function officialBody(kind, urn, body) {
  if (kind === "dance") {
    return normalizeBody(kind, urn, body);
  }

  const parsed = typeof body === "string" && body.trim() ? JSON.parse(body) : body || {};

  if (kind === "tal") {
    const content = [
      `# ${parsed.name || "Knolet Architect"}`,
      "",
      parsed.summary || "Domain knowledge to executable workflow app designer.",
      "",
      "## Operating rules",
      ...(parsed.instructions || []).map((item) => `- ${item}`),
    ].join("\n");
    return JSON.stringify(
      {
        kind,
        urn,
        description: parsed.summary || parsed.description || parsed.name || urn,
        tags: ["knolet", "workflow", "local"],
        payload: { content },
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    );
  }

  if (kind === "performer") {
    return JSON.stringify(
      {
        kind,
        urn,
        description: parsed.description || "Builds Knolet workflow apps from source documents.",
        tags: ["knolet", "builder", "local"],
        payload: {
          tal: "tal/@martinyblue/danceoftal/knolet-architect",
          dances: ["dance/@martinyblue/danceoftal/source-document-parser"],
          model: { provider: "opencode", modelId: "hy3-preview-free" },
          ...(parsed.tools?.mcp?.length ? { mcp_config: parsed.tools.mcp } : {}),
        },
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    );
  }

  if (kind === "act") {
    return JSON.stringify(
      {
        kind,
        urn,
        description: parsed.description || "Turns source documents into Knolet app specs.",
        tags: ["knolet", "workflow", "local"],
        payload: {
          actRules: parsed.actRules || [
            "Source interpretation and runtime app generation must remain separate.",
            "Output must include Source Document, Knowledge Structure, KnoletSpec, Runtime App, Version/Fork/Share.",
          ],
          participants: [
            {
              key: "builder",
              performer: "performer/@martinyblue/danceoftal/knolet-builder",
              subscriptions: {
                messagesFrom: [],
              },
            },
          ],
          relations: [],
        },
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    );
  }

  return normalizeBody(kind, urn, body);
}

async function writeAsset(payload) {
  await ensureWorkspace();
  const kind = slug(payload.kind, "tal");
  const { urn, filePath } = assetPath({ ...payload, kind });
  const content = normalizeBody(kind, urn, payload.body);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
  return { urn, path: path.relative(root, filePath) };
}

async function writeOfficialAsset(payload) {
  await ensureWorkspace();
  const kind = slug(payload.kind, "tal");
  const { urn, filePath } = officialAssetPath({ ...payload, kind });
  const content = officialBody(kind, urn, payload.body);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
  return { urn, path: path.relative(root, filePath) };
}

function studioWorkspacePayload() {
  return {
    schemaVersion: 1,
    workingDir: root,
    performers: [
      {
        id: "performer-knolet-builder",
        name: "Knolet Builder",
        description: "Builds a Knolet app workflow from source documents.",
        position: { x: 120, y: 120 },
        width: 400,
        height: 500,
        model: { provider: "opencode", modelId: "hy3-preview-free" },
        modelVariant: null,
        talRef: { kind: "registry", urn: "tal/@martinyblue/danceoftal/knolet-architect" },
        danceRefs: [{ kind: "registry", urn: "dance/@martinyblue/danceoftal/source-document-parser" }],
        mcpServerNames: [],
        agentId: null,
        planMode: false,
        meta: {
          derivedFrom: "performer/@martinyblue/danceoftal/knolet-builder",
          authoring: {
            slug: "knolet-builder",
            description: "Builds a Knolet app workflow from source documents.",
            tags: ["knolet", "builder", "local"],
          },
        },
      },
    ],
    acts: [
      {
        id: "act-document-to-knolet-app",
        name: "Document to Knolet App",
        description: "Source document to Knolet app workflow.",
        position: { x: 620, y: 120 },
        width: 520,
        height: 520,
        actRules: [
          "Keep source interpretation separate from app generation.",
          "Output Source Document, Knowledge Structure, KnoletSpec, Runtime App, Version/Fork/Share.",
        ],
        participants: {
          builder: {
            performerRef: {
              kind: "registry",
              urn: "performer/@martinyblue/danceoftal/knolet-builder",
            },
            displayName: "Knolet Builder",
          },
        },
        relations: [],
        meta: {
          derivedFrom: "act/@martinyblue/danceoftal/document-to-knolet-app",
          authoring: {
            slug: "document-to-knolet-app",
            description: "Source document to Knolet app workflow.",
            tags: ["knolet", "workflow", "local"],
          },
        },
      },
    ],
    chatBindings: {},
    assistantModel: { provider: "opencode", modelId: "hy3-preview-free" },
    appliedAssistantActionMessageIds: {},
    assistantActionResults: {},
    markdownEditors: [],
    canvasTerminals: [],
    hiddenFromList: false,
  };
}

async function studioRequest(pathname, options = {}) {
  const response = await fetchWithTimeout(`${studioUrl}${pathname}`, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await response.text();
  let payload = text;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { text };
  }
  if (!response.ok) {
    throw new Error(payload.error || payload.message || text || `DOT Studio ${response.status}`);
  }
  return payload;
}

function translateOperationalError(message) {
  const raw = String(message || "Request failed");
  const lower = raw.toLowerCase();

  if (lower.includes("repository not found")) {
    return "registry에는 보이지만 실제 GitHub 저장소가 비공개이거나 삭제된 상태입니다.";
  }
  if (
    lower.includes("authentication failed") ||
    lower.includes("unauthorized") ||
    lower.includes("permission denied") ||
    lower.includes("http 401") ||
    lower.includes("http 403")
  ) {
    return "내 GitHub 권한으로 이 저장소나 registry 항목에 접근할 수 없습니다.";
  }
  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("abort") ||
    lower.includes("fetch failed") ||
    lower.includes("econnreset") ||
    lower.includes("enotfound")
  ) {
    return "네트워크 응답이 늦거나 중간에 끊겼습니다. 잠시 뒤 다시 시도하세요.";
  }
  if (lower.includes("not found") && lower.includes("registry")) {
    return "registry에서 해당 항목을 찾지 못했습니다. URN 철자와 kind를 다시 확인하세요.";
  }

  return raw;
}

function registryItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  return payload?.items || payload?.results || [];
}

function githubUrlFromUrn(urn) {
  const descriptor = assetFromUrn(urn);
  if (!descriptor) {
    return null;
  }
  return `https://github.com/${descriptor.owner}/${descriptor.stage}`;
}

function actionSetForInstall(status, githubUrl) {
  const actions = [];
  if (status !== "installed" && status !== "already-installed") {
    actions.push({ kind: "retry", label: "다시 시도" });
    actions.push({ kind: "search", label: "Registry에서 다시 검색" });
  }
  if (githubUrl) {
    actions.push({ kind: "github", label: "GitHub 저장소 열기" });
  }
  if (status !== "installed" && status !== "already-installed") {
    actions.push({ kind: "fallback", label: "로컬 예시로 대체 설치" });
  }
  return actions;
}

function classifyInstallFailure(message, urn) {
  const raw = String(message || "Install failed");
  const lower = raw.toLowerCase();
  const githubUrl = githubUrlFromUrn(urn);
  let title = "설치 실패";
  let translated = translateOperationalError(raw);
  let category = "unknown";

  if (lower.includes("repository not found")) {
    category = "repository-not-found";
    title = "GitHub 저장소를 찾을 수 없습니다";
  } else if (
    lower.includes("authentication failed") ||
    lower.includes("unauthorized") ||
    lower.includes("permission denied") ||
    lower.includes("http 401") ||
    lower.includes("http 403")
  ) {
    category = "permission";
    title = "GitHub 권한이 부족합니다";
  } else if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("abort") ||
    lower.includes("fetch failed") ||
    lower.includes("econnreset") ||
    lower.includes("enotfound")
  ) {
    category = "network";
    title = "네트워크 응답이 늦습니다";
  } else if (lower.includes("invalid") || lower.includes("parse") || lower.includes("schema")) {
    category = "invalid-asset";
    title = "asset 구조를 확인해야 합니다";
    translated = "파일은 찾았지만 DOT asset 구조로 읽기 어렵습니다. 원본 저장소의 형식을 확인하세요.";
  }

  return {
    ok: false,
    status: "failed",
    category,
    title,
    message: translated,
    rawError: raw,
    githubUrl,
    actions: actionSetForInstall("failed", githubUrl),
  };
}

async function checkHttpJson(name, url) {
  try {
    const response = await fetchWithTimeout(url);
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { text: text.slice(0, 160) };
    }
    return {
      name,
      ok: response.ok,
      status: response.status,
      message: response.ok ? "정상 연결됨" : `HTTP ${response.status}`,
      payload,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      status: 0,
      message: "연결되지 않음",
      error: error.name === "AbortError" ? "요청 시간 초과" : error.message,
    };
  }
}

async function checkHttpAsset(name, url) {
  try {
    const response = await fetchWithTimeout(url);
    return {
      name,
      ok: response.ok,
      status: response.status,
      message: response.ok ? "정상 로딩됨" : `HTTP ${response.status}`,
      contentType: response.headers.get("content-type") || "",
    };
  } catch (error) {
    return {
      name,
      ok: false,
      status: 0,
      message: "로드 실패",
      error: error.name === "AbortError" ? "요청 시간 초과" : error.message,
    };
  }
}

function parseLsof(stdout, targetPort) {
  return String(stdout || "")
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      return {
        command: parts[0] || "unknown",
        pid: parts[1] || "unknown",
        user: parts[2] || "unknown",
        name: parts.slice(8).join(" ") || `*: ${targetPort}`,
      };
    });
}

async function checkPort(portNumber, expectedService) {
  const result = await runCommand("lsof", [
    "-nP",
    `-iTCP:${portNumber}`,
    "-sTCP:LISTEN",
  ]);
  const processes = result.ok ? parseLsof(result.stdout, portNumber) : [];
  return {
    port: portNumber,
    service: expectedService,
    listening: processes.length > 0,
    processes,
    checkedBy: "lsof -nP -iTCP:<port> -sTCP:LISTEN",
    error: result.ok ? null : result.error || result.stderr || "포트 점검 실패",
  };
}

async function gitDiagnostics() {
  const [head, shortHead, originMain, branch, statusLines, aheadBehind] = await Promise.all([
    runCommand("git", ["rev-parse", "HEAD"]),
    runCommand("git", ["rev-parse", "--short", "HEAD"]),
    runCommand("git", ["rev-parse", "origin/main"]),
    runCommand("git", ["branch", "--show-current"]),
    runCommand("git", ["status", "--short"]),
    runCommand("git", ["rev-list", "--left-right", "--count", "HEAD...origin/main"]),
  ]);
  const counts = aheadBehind.stdout.split(/\s+/).map((item) => Number(item));
  const ahead = Number.isFinite(counts[0]) ? counts[0] : null;
  const behind = Number.isFinite(counts[1]) ? counts[1] : null;
  return {
    ok: head.ok,
    branch: branch.stdout || "unknown",
    head: head.stdout || null,
    shortHead: shortHead.stdout || null,
    originMain: originMain.stdout || null,
    clean: statusLines.stdout.length === 0,
    changedFiles: statusLines.stdout ? statusLines.stdout.split("\n").filter(Boolean) : [],
    syncedWithOrigin: Boolean(head.stdout && originMain.stdout && head.stdout === originMain.stdout),
    ahead,
    behind,
  };
}

function assetKindSummary(assets) {
  const kinds = Object.fromEntries([...assetKinds].map((kind) => [kind, false]));
  for (const asset of assets) {
    const descriptor = assetFromUrn(asset.urn);
    if (descriptor?.kind && descriptor.kind in kinds) {
      kinds[descriptor.kind] = true;
    }
  }
  return kinds;
}

function compactStudioWorkspace(workspaceId, workspace) {
  const payload = workspace.payload || {};
  const performers = Array.isArray(payload.performers) ? payload.performers : [];
  const acts = Array.isArray(payload.acts) ? payload.acts : [];

  return {
    id: workspaceId,
    ok: workspace.ok,
    performerCount: performers.length,
    actCount: acts.length,
    performers: performers.map((performer) => ({
      id: performer.id,
      name: performer.name || performer.meta?.authoring?.slug || performer.id || "Unnamed Performer",
      description: performer.description || performer.meta?.authoring?.description || "",
      talCount: performer.talRef ? 1 : 0,
      danceCount: Array.isArray(performer.danceRefs) ? performer.danceRefs.length : 0,
      talUrn: performer.talRef?.urn || null,
      danceUrns: Array.isArray(performer.danceRefs)
        ? performer.danceRefs.map((ref) => ref.urn).filter(Boolean)
        : [],
    })),
    acts: acts.map((act) => {
      const participants = act.participants && typeof act.participants === "object" ? act.participants : {};
      return {
        id: act.id,
        name: act.name || act.meta?.authoring?.slug || act.id || "Unnamed Act",
        description: act.description || act.meta?.authoring?.description || "",
        participantNames: Object.values(participants).map(
          (participant) =>
            participant.displayName ||
            participant.performerRef?.urn ||
            participant.performer ||
            "Performer",
        ),
      };
    }),
  };
}

function buildStudioGuide(studioWorkspace) {
  if (!studioWorkspace?.ok) {
    return {
      available: false,
      performers: [],
      acts: [],
      steps: [
        "Manager에서 3번 Studio 캔버스에 배치를 누릅니다.",
        "DOT Studio를 열고 canvas에 Performer와 Act가 보이는지 확인합니다.",
      ],
    };
  }

  return {
    available: true,
    performers: studioWorkspace.performers || [],
    acts: studioWorkspace.acts || [],
    steps: [
      "DOT Studio 열기를 누르고 canvas 왼쪽의 Knolet Builder Performer를 선택합니다.",
      "Tal과 Dance 연결을 확인한 뒤, 필요한 경우 Performer 설정에서 모델과 도구를 조정합니다.",
      "Document to Knolet App Act를 선택해 workflow가 Knolet Builder를 participant로 쓰는지 확인합니다.",
      "OpenCode 기본 URL이 정상인 상태에서 Studio의 실행 흐름을 테스트합니다.",
    ],
  };
}

function buildReadinessChecks({ workspaceStatus, kindSummary, studioWorkspace, opencode, opencodeChunk, git }) {
  const hasCanvas = Boolean(studioWorkspace?.performerCount && studioWorkspace?.actCount);
  const opencodeReady = Boolean(opencode.ok && opencodeChunk.ok);
  return [
    {
      key: "workspace",
      label: "workspace 있음",
      ok: workspaceStatus.workspaceExists,
      detail: workspaceStatus.workspaceExists ? ".dance-of-tal 폴더가 준비됐습니다." : "1번 작업공간 준비를 누르세요.",
    },
    {
      key: "tal",
      label: "Tal 있음",
      ok: kindSummary.tal,
      detail: kindSummary.tal ? "에이전트 역할 부품이 있습니다." : "Knolet 예시 만들기를 누르세요.",
    },
    {
      key: "dance",
      label: "Dance 있음",
      ok: kindSummary.dance,
      detail: kindSummary.dance ? "문서 읽기 능력 부품이 있습니다." : "Knolet 예시 만들기를 누르세요.",
    },
    {
      key: "performer",
      label: "Performer 있음",
      ok: kindSummary.performer,
      detail: kindSummary.performer ? "실행 에이전트 부품이 있습니다." : "Knolet 예시 만들기를 누르세요.",
    },
    {
      key: "act",
      label: "Act 있음",
      ok: kindSummary.act,
      detail: kindSummary.act ? "workflow 부품이 있습니다." : "Knolet 예시 만들기를 누르세요.",
    },
    {
      key: "studio",
      label: "Studio canvas 배치됨",
      ok: hasCanvas,
      detail: hasCanvas ? "Performer와 Act가 canvas에 보입니다." : "3번 Studio 캔버스에 배치를 누르세요.",
    },
    {
      key: "opencode",
      label: "OpenCode 연결됨",
      ok: opencodeReady,
      detail: opencodeReady ? "기본 URL과 화면 파일이 열립니다." : "OpenCode 기본 URL을 열고 상태를 재확인하세요.",
    },
    {
      key: "github",
      label: "GitHub 반영됨",
      ok: git.clean && git.syncedWithOrigin,
      detail:
        git.clean && git.syncedWithOrigin
          ? `${git.branch} / ${git.shortHead}가 origin/main과 같습니다.`
          : "변경사항 커밋과 push 상태를 확인해야 합니다.",
    },
  ];
}

function buildIssues({ studio, opencode, opencodeChunk, git, workspaceStatus, studioWorkspace }) {
  const issues = [];
  if (!workspaceStatus.workspaceExists) {
    issues.push({
      level: "warning",
      title: "작업공간이 아직 없습니다",
      detail: "Manager에서 1번 작업공간 준비를 먼저 누르세요.",
    });
  }
  if (!studio.ok) {
    issues.push({
      level: "error",
      title: "DOT Studio가 연결되지 않습니다",
      detail: "DOT Studio 서버를 실행한 뒤 이 화면을 다시 진단하세요.",
    });
  }
  if (!opencode.ok) {
    issues.push({
      level: "error",
      title: "OpenCode가 연결되지 않습니다",
      detail: "OpenCode를 다시 시작하고 /session URL 대신 기본 URL을 여세요.",
    });
  }
  if (opencode.ok && !opencodeChunk.ok) {
    issues.push({
      level: "warning",
      title: "OpenCode 화면 파일 일부를 불러오지 못합니다",
      detail: "브라우저가 오래된 session URL을 보고 있을 수 있습니다. 기본 URL에서 강력 새로고침하세요.",
    });
  }
  if (!git.clean) {
    issues.push({
      level: "warning",
      title: "아직 커밋하지 않은 변경이 있습니다",
      detail: `${git.changedFiles.length}개 파일이 변경되었습니다. 개발 완료 후 버전 업데이트, 커밋, push가 필요합니다.`,
    });
  }
  if (git.ok && !git.syncedWithOrigin) {
    issues.push({
      level: "warning",
      title: "GitHub main과 로컬 main이 다릅니다",
      detail: "개발 완료 후 git push가 필요합니다.",
    });
  }
  if (studio.ok && studioWorkspace && studioWorkspace.performerCount === 0 && studioWorkspace.actCount === 0) {
    issues.push({
      level: "warning",
      title: "DOT Studio 캔버스가 비어 있습니다",
      detail: "Manager에서 3번 Studio 캔버스에 배치를 누르세요.",
    });
  }
  return issues;
}

async function diagnostics() {
  const workspaceStatus = await status();
  const [version, git, studio, opencode, opencodeChunk] = await Promise.all([
    readPackageVersion(),
    gitDiagnostics(),
    checkHttpJson("DOT Studio", `${studioUrl}/api/health`),
    checkHttpAsset("OpenCode", opencodeUrl),
    checkHttpAsset("OpenCode JS", `${opencodeUrl}/assets/status-popover-body-B_17Zv7j.js`),
  ]);

  let studioWorkspace = null;
  let opencodeBridge = null;
  let registry = null;
  if (studio.ok) {
    const workspaces = await checkHttpJson("DOT Studio workspaces", `${studioUrl}/api/workspaces?includeHidden=1`);
    const workspaceId = workspaces.payload?.[0]?.id;
    if (workspaceId) {
      const workspace = await checkHttpJson("DOT Studio workspace", `${studioUrl}/api/workspaces/${workspaceId}`);
      studioWorkspace = compactStudioWorkspace(workspaceId, workspace);
    }
    opencodeBridge = await checkHttpJson("DOT Studio OpenCode bridge", `${studioUrl}/api/opencode/health`);
    registry = await checkHttpJson("DOT Registry search", `${studioUrl}/api/dot/search?q=knolet&kind=dance&limit=1`);
  }

  const issues = buildIssues({
    studio,
    opencode,
    opencodeChunk,
    git,
    workspaceStatus,
    studioWorkspace,
  });
  const kindSummary = assetKindSummary(workspaceStatus.assets);
  const readinessChecks = buildReadinessChecks({
    workspaceStatus,
    kindSummary,
    studioWorkspace,
    opencode,
    opencodeChunk,
    git,
  });

  return {
    version,
    generatedAt: new Date().toISOString(),
    urls: {
      manager: `http://127.0.0.1:${port}`,
      studio: studioUrl,
      opencode: opencodeUrl,
    },
    git,
    services: {
      manager: { ok: true, message: "정상 실행 중" },
      studio,
      opencode,
      opencodeChunk,
      opencodeBridge,
      registry,
    },
    workspace: {
      exists: workspaceStatus.workspaceExists,
      assetCount: workspaceStatus.assetCount,
      officialAssets: workspaceStatus.officialAssets,
      studioWorkspace,
    },
    studioGuide: buildStudioGuide(studioWorkspace),
    readinessChecks,
    ready: readinessChecks.every((check) => check.ok),
    issues,
  };
}

function manualCommands() {
  const portPrefix = port === 8080 ? "" : `PORT=${port} `;
  const managerCommand = `${portPrefix}SHUTDOWN_AFTER_MS=3600000 ${process.execPath} server.js`;
  return {
    manager: managerCommand,
    opencode:
      'PATH="$PWD/.tools/bin:/tmp/node-v22.11.0-darwin-arm64/bin:$PATH" npm run opencode',
    studio:
      'PATH="$PWD/.tools/bin:/tmp/node-v22.11.0-darwin-arm64/bin:$PATH" npm run studio',
    commercialStudio:
      "DANCEOFTAL_MODE=commercial DOT_SUPABASE_URL=https://auth.your-domain.example DOT_SUPABASE_ANON_KEY=<your-public-anon-key> npm run studio:commercial",
    modeCheck: "npm run mode:check",
    commercialCheck: "npm run commercial:check",
    productionCheck: "npm run production:check",
    githubStatus: "git status --short --branch",
    githubPush: "git push origin main",
  };
}

function commercialBoundary() {
  const checks = buildCommercialChecks();
  const summary = summarizeCommercialChecks(checks);
  const mode = summary.mode;
  const productMode = mode === "commercial" || mode === "production";
  const gateReady = summary.blockers.length === 0;
  const productReady = productMode && gateReady;
  return {
    ok: productMode ? gateReady : true,
    productReady,
    mode,
    modeLabel:
      mode === "production"
        ? "프로덕션 모드"
        : mode === "commercial"
          ? "상업화 리허설 모드"
          : "개발 모드",
    state: gateReady ? (summary.warnings.length ? "warning" : "ok") : productMode ? "error" : "warning",
    status: productMode
      ? gateReady
        ? "제품 데이터 경계 준비 중"
        : "제품 데이터 경계 미준비"
      : "개발 모드: 기존 로컬 기능 유지",
    detail:
      productMode
        ? gateReady
          ? "로그인 backend는 자체 인프라로 설정됐습니다. 프로덕션 전 workspace 저장 API 전환을 완료하세요."
          : "업스트림 DOT auth로 로그인될 수 있습니다. 자체 auth/data backend 설정 후 product 모드로 전환하세요."
        : "현재는 개발 모드라 DOT Studio/OpenCode/Registry 기존 기능을 그대로 사용할 수 있습니다. 상업화 전환 시 commercial/production 체크를 통과해야 합니다.",
    checks,
    blockers: summary.blockers,
    warnings: summary.warnings,
  };
}

function managerLifecycle() {
  const now = Date.now();
  const automatic = Boolean(managerShutdownAt);
  return {
    mode: automatic ? "automatic-shutdown" : "manual",
    label: automatic ? "자동 종료 예정" : "수동 실행 중",
    startedAt: new Date(managerStartedAt).toISOString(),
    shutdownAfterMs: automatic ? shutdownAfterMs : null,
    shutdownAt: automatic ? new Date(managerShutdownAt).toISOString() : null,
    remainingMs: automatic ? Math.max(0, managerShutdownAt - now) : null,
    detail: automatic
      ? "Codex가 띄운 Manager로 보고 1시간 자동 종료 정책을 적용합니다."
      : "SHUTDOWN_AFTER_MS가 없어 기존 또는 수동 실행 서버로 취급합니다.",
  };
}

function buildRecoveryFlows(data) {
  const canvasReady = Boolean(
    data.workspace.studioWorkspace?.performerCount &&
      data.workspace.studioWorkspace?.actCount,
  );
  return [
    {
      key: "opencode-stale-session",
      title: "OpenCode stale session",
      state:
        data.services.opencode.ok && data.services.opencodeChunk.ok
          ? "ok"
          : "warning",
      detail:
        data.services.opencode.ok && data.services.opencodeChunk.ok
          ? "기본 URL과 화면 파일이 정상입니다."
          : "/session URL 대신 기본 URL을 열고 강력 새로고침하세요. 계속 실패하면 수동 실행 명령으로 OpenCode를 재시작하세요.",
      action: "OpenCode 기본 URL 열기",
      url: data.urls.opencode,
    },
    {
      key: "studio-empty-canvas",
      title: "DOT Studio canvas 비어 있음",
      state: canvasReady ? "ok" : "warning",
      detail: canvasReady
        ? "Performer와 Act가 canvas에 배치되어 있습니다."
        : "Manager의 3번 Studio 캔버스에 배치를 누른 뒤 DOT Studio를 새로고침하세요.",
      action: "DOT Studio 열기",
      url: data.urls.studio,
    },
    {
      key: "registry-install-failure",
      title: "Registry install 실패",
      state: data.services.registry?.ok ? "ok" : "warning",
      detail: data.services.registry?.ok
        ? "DOT Studio registry API가 응답합니다. 설치 전 확인을 먼저 쓰세요."
        : "DOT Studio를 켠 뒤 registry 검색을 다시 시도하고, 실패 카드의 retry/search/GitHub/local fallback을 따라가세요.",
      action: "Registry 섹션으로 이동",
      url: "#registry-tools",
    },
    {
      key: "github-push-needed",
      title: "GitHub push 필요",
      state: data.git.clean && data.git.syncedWithOrigin ? "ok" : "warning",
      detail:
        data.git.clean && data.git.syncedWithOrigin
          ? `${data.git.branch} / ${data.git.shortHead}가 origin/main과 같습니다.`
          : `${data.git.changedFiles.length}개 변경 또는 ahead/behind 상태가 있습니다. 완료 후 martinyblue 계정으로 commit/push가 필요합니다.`,
      action: "GitHub 상태 보기",
      url: "#launcher-tools",
    },
    {
      key: "commercial-data-boundary",
      title: "상업 데이터 경계",
      state: data.commercialBoundary?.state || "warning",
      detail: data.commercialBoundary?.productReady
        ? "DOT auth가 자체 backend로 향합니다. 다음 단계는 workspace 저장 API 전환입니다."
        : data.commercialBoundary?.mode === "development"
          ? "개발 중에는 기존 기능을 유지하고, 상업화 전환 시 product 체크를 통과하세요."
          : "상업 제품에서는 업스트림 DOT auth 대신 내 auth/data backend로 실행해야 합니다.",
      action: "상업 실행 명령 보기",
      url: "#launcher-tools",
    },
  ];
}

async function launcher() {
  const data = await diagnostics();
  const commands = manualCommands();
  const boundary = commercialBoundary();
  const portChecks =
    port === 8080
      ? [checkPort(8080, "Manager")]
      : [checkPort(8080, "Manager preferred"), checkPort(port, "Manager current")];
  const ports = await Promise.all([
    ...portChecks,
    checkPort(43110, "DOT Studio"),
    checkPort(43120, "OpenCode"),
  ]);
  const portByNumber = Object.fromEntries(ports.map((item) => [item.port, item]));
  const studioCanvas = data.workspace.studioWorkspace
    ? `canvas Performer ${data.workspace.studioWorkspace.performerCount}개, Act ${data.workspace.studioWorkspace.actCount}개`
    : "canvas 정보 없음";
  const opencodeReady = Boolean(data.services.opencode.ok && data.services.opencodeChunk.ok);
  const bridgeReady = Boolean(data.services.opencodeBridge?.ok);

  return {
    title: "0.2.0 통합 localhost 런처",
    objective:
      "Manager를 로컬 전체 서비스의 시작점으로 만들고, 사용자가 8080 하나에서 DOT Studio/OpenCode/Registry/GitHub 상태와 다음 행동을 관리하게 한다.",
    version: data.version,
    generatedAt: data.generatedAt,
    urls: data.urls,
    lifecycle: managerLifecycle(),
    commercialBoundary: boundary,
    ports,
    services: [
      {
        key: "manager",
        title: "Manager",
        ok: true,
        state: "ok",
        url: data.urls.manager,
        port,
        status: `${port} 런처 실행 중`,
        detail: `${data.workspace.assetCount}개 부품 / 공식형 ${data.workspace.officialAssets}개`,
        portDetail: portByNumber[port],
        command: commands.manager,
        logCommand: `lsof -nP -iTCP:${port} -sTCP:LISTEN`,
        canRestart: false,
        restartReason: "현재 요청을 처리 중인 Manager 프로세스라 UI 재시작은 아직 제공하지 않습니다.",
      },
      {
        key: "studio",
        title: "DOT Studio",
        ok: data.services.studio.ok,
        state: data.services.studio.ok ? "ok" : "error",
        url: data.urls.studio,
        port: 43110,
        status: data.services.studio.ok ? "Studio 연결됨" : "Studio 실행 필요",
        detail: data.services.studio.ok ? studioCanvas : data.services.studio.error || data.services.studio.message,
        portDetail: portByNumber[43110],
        command: commands.studio,
        logCommand: "lsof -nP -iTCP:43110 -sTCP:LISTEN",
        canRestart: false,
        restartReason: "프로세스 소유권 확인 전까지는 수동 실행 명령만 제공합니다.",
      },
      {
        key: "opencode",
        title: "OpenCode",
        ok: opencodeReady,
        state: opencodeReady ? "ok" : "error",
        url: data.urls.opencode,
        port: 43120,
        status: opencodeReady ? "OpenCode 연결됨" : "OpenCode 실행 또는 새로고침 필요",
        detail: opencodeReady
          ? `기본 URL 정상, Studio bridge ${bridgeReady ? "연결됨" : "확인 필요"}`
          : "기본 URL 또는 화면 파일을 불러오지 못했습니다.",
        bridge: {
          ok: bridgeReady,
          message: data.services.opencodeBridge?.message || "DOT Studio가 켜진 뒤 bridge를 확인합니다.",
        },
        portDetail: portByNumber[43120],
        command: commands.opencode,
        logCommand: "lsof -nP -iTCP:43120 -sTCP:LISTEN",
        canRestart: false,
        restartReason: "stale session 복구 후에도 실패할 때 터미널에서 수동 재시작하세요.",
      },
      {
        key: "registry",
        title: "Registry",
        ok: Boolean(data.services.registry?.ok),
        state: data.services.registry?.ok ? "ok" : "warning",
        url: `${data.urls.studio}/api/dot/search?q=knolet&kind=dance&limit=1`,
        port: 43110,
        status: data.services.registry?.ok ? "Registry API 응답" : "DOT Studio registry 확인 필요",
        detail: data.services.registry?.ok
          ? "검색과 설치 전 확인을 사용할 수 있습니다."
          : "DOT Studio를 켠 뒤 registry 검색을 다시 시도하세요.",
        portDetail: portByNumber[43110],
        command: "Manager의 Registry 섹션에서 검색 후 설치 전 확인을 먼저 실행",
        logCommand: "DOT Studio 실행 터미널 로그 확인",
        canRestart: false,
        restartReason: "Registry는 DOT Studio API를 통해 접근하므로 별도 재시작 대상이 아닙니다.",
      },
      {
        key: "commercial-boundary",
        title: "Commercial data boundary",
        ok: boundary.ok,
        state: boundary.state,
        url: "#launcher-tools",
        port: null,
        status: boundary.status,
        detail: `${boundary.modeLabel}: ${boundary.detail}`,
        portDetail: null,
        command: `${commands.modeCheck} && ${commands.commercialCheck} && ${commands.commercialStudio}`,
        logCommand:
          "printenv DANCEOFTAL_MODE DANCEOFTAL_STORAGE_MODE DANCEOFTAL_DATA_OWNER DOT_SUPABASE_URL DOT_SUPABASE_ANON_KEY STUDIO_DIR OPENCODE_CONFIG_DIR DANCEOFTAL_DATA_API_URL",
        canRestart: false,
        restartReason:
          "개발 모드는 기존 실행을 유지하고, 상업 실행은 upstream auth 차단을 위해 npm run studio:commercial로 별도 시작합니다.",
      },
      {
        key: "github",
        title: "GitHub sync",
        ok: Boolean(data.git.clean && data.git.syncedWithOrigin),
        state: data.git.clean && data.git.syncedWithOrigin ? "ok" : "warning",
        url: "https://github.com/martinyblue/danceoftal",
        port: null,
        status:
          data.git.clean && data.git.syncedWithOrigin
            ? "origin/main 반영됨"
            : "commit 또는 push 필요",
        detail:
          data.git.clean && data.git.syncedWithOrigin
            ? `${data.git.branch} / ${data.git.shortHead}`
            : `${data.git.changedFiles.length}개 변경, ahead ${data.git.ahead ?? "?"}, behind ${data.git.behind ?? "?"}`,
        portDetail: null,
        command: `${commands.githubStatus} && ${commands.githubPush}`,
        logCommand: "git log --oneline -5 --decorate",
        canRestart: false,
        restartReason: "GitHub sync는 로컬 프로세스가 아니라 commit/push 흐름입니다.",
      },
    ],
    recoveryFlows: buildRecoveryFlows({ ...data, commercialBoundary: boundary }),
    issues: data.issues,
  };
}

async function launcherHandoff() {
  const data = await diagnostics();
  const commandsByKey = manualCommands();
  const commands = [
    {
      label: "Manager",
      command: commandsByKey.manager,
      url: data.urls.manager,
    },
    {
      label: "OpenCode",
      command: commandsByKey.opencode,
      url: data.urls.opencode,
    },
    {
      label: "DOT Studio",
      command: commandsByKey.studio,
      url: data.urls.studio,
    },
  ];
  const blockers = [];
  if (!data.services.studio.ok) {
    blockers.push("DOT Studio health check가 실패합니다.");
  }
  if (!data.services.opencode.ok || !data.services.opencodeChunk.ok) {
    blockers.push("OpenCode 기본 URL 또는 화면 파일을 불러오지 못합니다.");
  }
  if (!data.git.clean || !data.git.syncedWithOrigin) {
    blockers.push("GitHub에 반영되지 않은 변경이 있습니다.");
  }
  if (!data.workspace.studioWorkspace?.performerCount || !data.workspace.studioWorkspace?.actCount) {
    blockers.push("Studio canvas에 Performer와 Act가 모두 배치되어야 합니다.");
  }
  return {
    title: "0.2.0 통합 런처 handoff",
    summary: "다음 0.2.0에서 하나의 localhost 런처로 묶기 전 필요한 서비스와 확인 항목입니다.",
    readyFor020: blockers.length === 0,
    blockers,
    commands,
    ports: [
      { port: 8080, service: "Manager", required: true },
      { port: 43110, service: "DOT Studio", required: true },
      { port: 43120, service: "OpenCode", required: true },
    ],
    next020Scope: [
      "Manager, DOT Studio, OpenCode를 하나의 8080 런처 화면에서 상태 관리",
      "OpenCode 재시작 버튼은 명령 실행 권한과 프로세스 소유권을 확인한 뒤 제공",
      "1시간 이상 떠 있는 Codex-started 서버 자동 종료 정책 유지",
      "서비스별 로그/상태/복구 버튼을 통합",
    ],
  };
}

function resolveWorkspaceInput(inputPath) {
  const requested = inputPath || ".dance-of-tal";
  const resolved = path.resolve(root, requested);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("Only workspaces inside this repository can be imported.");
  }
  return resolved;
}

function diagnosticHelp(item) {
  const code = item?.code || "diagnostic";
  if (code === "missing-knowledge-binding") {
    return {
      category: "knowledge-binding",
      humanMessage: "KnowledgeSource 연결이 아직 없습니다.",
      nextAction: "다음 단계 0.3.3 Knowledge Binding에서 이 SkillBlock에 KnowledgeSource를 연결해야 합니다.",
    };
  }
  if (code === "invalid-dot-json") {
    return {
      category: "dot-asset",
      humanMessage: "DOT JSON asset을 파싱할 수 없습니다.",
      nextAction: "표시된 파일의 JSON 문법과 payload 구조를 확인하세요.",
    };
  }
  if (code === "missing-dot-directory" || code === "empty-dot-directory") {
    return {
      category: "workspace",
      humanMessage: "가져올 DOT asset 폴더가 비어 있거나 없습니다.",
      nextAction: "필요한 Tal, Dance, Performer, Act asset을 만들거나 Registry에서 설치하세요.",
    };
  }
  if (code.startsWith("unknown-dot-") || code === "unmapped-workflow-relation") {
    return {
      category: "dot-reference",
      humanMessage: "DOT asset 사이의 참조를 Knolet 엔티티로 연결하지 못했습니다.",
      nextAction: "참조 URN이 실제 workspace asset과 일치하는지 확인하세요.",
    };
  }
  return {
    category: item?.level === "error" ? "validation" : "review",
    humanMessage: item?.message || code,
    nextAction: item?.level === "error" ? "저장 전에 validation error를 먼저 해결하세요." : "필요하면 다음 개발 단계에서 보강하세요.",
  };
}

async function readPersistedKnoletBindings() {
  try {
    const spec = JSON.parse(await fs.readFile(knoletWorkspaceSpecPath, "utf8"));
    const skillBindings = {};
    for (const skill of Array.isArray(spec.skills) ? spec.skills : []) {
      if (skill?.id && Array.isArray(skill.binds_to)) {
        skillBindings[skill.id] = skill.binds_to;
      }
    }
    return {
      knowledgeSources: spec.knowledge?.sources || [],
      skillBindings,
    };
  } catch {
    return {
      knowledgeSources: [],
      skillBindings: {},
    };
  }
}

function mergeKnowledgeBindingOptions(base, patch = {}) {
  const sourcesById = new Map();
  for (const source of [...(base.knowledgeSources || []), ...(patch.knowledgeSources || [])]) {
    if (source?.id) {
      sourcesById.set(source.id, source);
    }
  }
  return {
    knowledgeSources: [...sourcesById.values()],
    skillBindings: {
      ...(base.skillBindings || {}),
      ...(patch.skillBindings || {}),
    },
  };
}

async function resolveKnowledgeBindingOptions(payload = {}) {
  const persisted = await readPersistedKnoletBindings();
  return mergeKnowledgeBindingOptions(persisted, {
    knowledgeSources: Array.isArray(payload.knowledgeSources) ? payload.knowledgeSources : [],
    skillBindings: payload.skillBindings && typeof payload.skillBindings === "object" ? payload.skillBindings : {},
  });
}

function summarizeImportResult(result, workspacePath) {
  const spec = result.spec || {};
  const workflow = spec.workflow || {};
  const diagnostics = (result.diagnostics || []).map((item) => ({
    ...item,
    ...diagnosticHelp(item),
  }));
  const errors = diagnostics.filter((item) => item.level === "error");
  const warnings = diagnostics.filter((item) => item.level === "warning");
  const missingBindings = warnings.filter((item) => item.code === "missing-knowledge-binding");
  const unboundSkills = Array.isArray(spec.skills)
    ? spec.skills.filter((skill) => !Array.isArray(skill.binds_to) || skill.binds_to.length === 0)
    : [];
  const boundSkillCount = Array.isArray(spec.skills) ? spec.skills.length - unboundSkills.length : 0;
  const assetsByKind = {};
  for (const asset of result.assets || []) {
    assetsByKind[asset.kind] ||= [];
    assetsByKind[asset.kind].push(asset);
  }

  return {
    ...result,
    diagnostics,
    diagnosticsByLevel: {
      error: errors,
      warning: warnings,
    },
    assetsByKind,
    summary: {
      workspace: path.relative(root, workspacePath),
      name: spec.metadata?.name || "Imported DOT workspace",
      specVersion: spec.knolet_spec_version || "unknown",
      personasCount: Array.isArray(spec.personas) ? spec.personas.length : 0,
      skillsCount: Array.isArray(spec.skills) ? spec.skills.length : 0,
      agentsCount: Array.isArray(spec.agents) ? spec.agents.length : 0,
      workflowNodesCount: Array.isArray(workflow.nodes) ? workflow.nodes.length : 0,
      workflowEdgesCount: Array.isArray(workflow.edges) ? workflow.edges.length : 0,
      validationOk: Boolean(result.validation?.ok),
      errorCount: errors.length,
      warningCount: warnings.length,
      missingKnowledgeBindingCount: unboundSkills.length || missingBindings.length,
      boundSkillCount,
      bindingComplete: unboundSkills.length === 0,
    },
    nextSteps: [
      {
        key: "knowledge-binding",
        label: "0.3.3 Knowledge Binding",
        required: unboundSkills.length > 0 || missingBindings.length > 0,
        detail:
          unboundSkills.length > 0 || missingBindings.length > 0
            ? `${unboundSkills.length || missingBindings.length}개 SkillBlock에 KnowledgeSource 연결이 필요합니다.`
            : "모든 SkillBlock이 KnowledgeSource에 연결되어 있습니다.",
      },
      {
        key: "knowledge-source",
        label: "KnowledgeSource 모델 확정",
        required: true,
        detail: "workspace document, uploaded file, registry source 같은 입력 출처를 KnoletSpec에 명시합니다.",
      },
      {
        key: "citation-policy",
        label: "Citation required output",
        required: true,
        detail: "grounding_policy와 output section이 citation을 어떻게 요구하는지 UI에서 확인 가능하게 만듭니다.",
      },
    ],
  };
}

async function importDotWorkspacePreview(workspacePath, payload = {}) {
  const bindingOptions = await resolveKnowledgeBindingOptions(payload);
  const result = await importDotWorkspace(workspacePath, bindingOptions);
  return summarizeImportResult(result, workspacePath);
}

function resolveKnoletSaveTarget(target) {
  if (target === "repo-root") {
    return knoletRootSpecPath;
  }
  if (!target || target === "workspace") {
    return knoletWorkspaceSpecPath;
  }
  throw new Error("knolet.json can only be saved to repo root or .dance-of-tal/knolet.json.");
}

async function saveKnoletImport(payload = {}) {
  const workspacePath = resolveWorkspaceInput(payload.path || ".dance-of-tal");
  const targetPath = resolveKnoletSaveTarget(payload.target || "workspace");
  const preview = await importDotWorkspacePreview(workspacePath, payload);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, `${JSON.stringify(preview.spec, null, 2)}\n`);
  return {
    ok: true,
    path: path.relative(root, targetPath),
    target: targetPath === knoletRootSpecPath ? "repo-root" : "workspace",
    summary: preview.summary,
    validation: preview.validation,
    diagnosticsByLevel: preview.diagnosticsByLevel,
    nextSteps: preview.nextSteps,
  };
}

async function runtimePlanPreview(payload = {}) {
  const workspacePath = resolveWorkspaceInput(payload.path || ".dance-of-tal");
  const preview = await importDotWorkspacePreview(workspacePath, payload);
  const plan = compileKnoletRuntimePlan(preview.spec);
  return {
    plan,
    specSummary: preview.summary,
    diagnosticsByLevel: {
      error: plan.diagnostics.filter((item) => item.level === "error"),
      warning: plan.diagnostics.filter((item) => item.level === "warning"),
    },
  };
}

async function saveRuntimePlan(payload = {}) {
  const preview = await runtimePlanPreview(payload);
  await fs.mkdir(path.dirname(runtimePlanPath), { recursive: true });
  await fs.writeFile(runtimePlanPath, `${JSON.stringify(preview.plan, null, 2)}\n`);
  return {
    ok: true,
    path: path.relative(root, runtimePlanPath),
    summary: preview.plan.summary,
    status: preview.plan.status,
    diagnosticsByLevel: preview.diagnosticsByLevel,
    runLog: preview.plan.run_log,
  };
}

async function graphModelPreview(payload = {}) {
  const workspacePath = resolveWorkspaceInput(payload.path || ".dance-of-tal");
  const specPreview = await importDotWorkspacePreview(workspacePath, payload);
  const runtimePlan = compileKnoletRuntimePlan(specPreview.spec);
  const graph = compileKnoletGraphModel(specPreview.spec, runtimePlan);
  const layout = await readGraphLayout();
  return {
    graph,
    layout,
    specSummary: specPreview.summary,
    runtimeSummary: runtimePlan.summary,
    diagnosticsByLevel: {
      error: graph.diagnostics.filter((item) => item.level === "error"),
      warning: graph.diagnostics.filter((item) => item.level === "warning"),
    },
  };
}

async function saveGraphModel(payload = {}) {
  const preview = await graphModelPreview(payload);
  await fs.mkdir(path.dirname(knoletGraphPath), { recursive: true });
  await fs.writeFile(knoletGraphPath, `${JSON.stringify(preview.graph, null, 2)}\n`);
  return {
    ok: true,
    path: path.relative(root, knoletGraphPath),
    summary: preview.graph.summary,
    status: preview.graph.status,
    diagnosticsByLevel: preview.diagnosticsByLevel,
  };
}

async function libraryPackagePreview(payload = {}) {
  const workspacePath = resolveWorkspaceInput(payload.path || ".dance-of-tal");
  const specPreview = await importDotWorkspacePreview(workspacePath, payload);
  const runtimePlan = compileKnoletRuntimePlan(specPreview.spec);
  const graph = compileKnoletGraphModel(specPreview.spec, runtimePlan);
  const libraryPackage = compileKnoletLibraryPackage(specPreview.spec, runtimePlan, graph);
  return {
    package: libraryPackage,
    specSummary: specPreview.summary,
    runtimeSummary: runtimePlan.summary,
    graphSummary: graph.summary,
    diagnosticsByLevel: {
      error: libraryPackage.diagnostics.filter((item) => item.level === "error"),
      warning: libraryPackage.diagnostics.filter((item) => item.level === "warning"),
    },
  };
}

async function saveLibraryPackage(payload = {}) {
  const preview = await libraryPackagePreview(payload);
  await fs.mkdir(path.dirname(knoletLibraryPackagePath), { recursive: true });
  await fs.writeFile(knoletLibraryPackagePath, `${JSON.stringify(preview.package, null, 2)}\n`);
  return {
    ok: true,
    path: path.relative(root, knoletLibraryPackagePath),
    summary: preview.package.summary,
    status: preview.package.status,
    diagnosticsByLevel: preview.diagnosticsByLevel,
  };
}

async function libraryInstallPlanPreview(payload = {}) {
  const packagePreview = await libraryPackagePreview(payload);
  const installPlan = compileKnoletLibraryInstallPlan(packagePreview.package, {
    targetOwner: payload.targetOwner || "martinyblue",
    targetStage: payload.targetStage || "local",
  });
  return {
    installPlan,
    packageSummary: packagePreview.package.summary,
    diagnosticsByLevel: {
      error: installPlan.diagnostics.filter((item) => item.level === "error"),
      warning: installPlan.diagnostics.filter((item) => item.level === "warning"),
    },
  };
}

async function saveLibraryInstallPlan(payload = {}) {
  const preview = await libraryInstallPlanPreview(payload);
  await fs.mkdir(path.dirname(knoletLibraryInstallPlanPath), { recursive: true });
  await fs.writeFile(knoletLibraryInstallPlanPath, `${JSON.stringify(preview.installPlan, null, 2)}\n`);
  return {
    ok: true,
    path: path.relative(root, knoletLibraryInstallPlanPath),
    summary: preview.installPlan.summary,
    status: preview.installPlan.status,
    diagnosticsByLevel: preview.diagnosticsByLevel,
  };
}

async function libraryInstallExecutionPreview(payload = {}) {
  const packagePreview = await libraryPackagePreview(payload);
  const installPlan = compileKnoletLibraryInstallPlan(packagePreview.package, {
    targetOwner: payload.targetOwner || "martinyblue",
    targetStage: payload.targetStage || "local",
  });
  const execution = compileKnoletLibraryInstallExecution(installPlan, packagePreview.package, {
    sourceBindings: payload.sourceBindings || {},
  });
  return {
    execution,
    installPlanSummary: installPlan.summary,
    packageSummary: packagePreview.package.summary,
    diagnosticsByLevel: {
      error: execution.diagnostics.filter((item) => item.level === "error"),
      warning: execution.diagnostics.filter((item) => item.level === "warning"),
    },
  };
}

function resolveWorkspaceWritePath(relativePath) {
  const targetPath = path.resolve(root, relativePath);
  const workspacePath = path.resolve(workspaceRoot);
  if (!targetPath.startsWith(`${workspacePath}${path.sep}`)) {
    throw new Error(`Refusing to write outside .dance-of-tal: ${relativePath}`);
  }
  return targetPath;
}

async function executeLibraryInstall(payload = {}) {
  const preview = await libraryInstallExecutionPreview(payload);
  if (preview.execution.status !== "ready_to_write") {
    return {
      ok: false,
      status: preview.execution.status,
      summary: preview.execution.summary,
      diagnosticsByLevel: preview.diagnosticsByLevel,
      writes: [],
      execution: preview.execution,
    };
  }

  const written = [];
  for (const write of preview.execution.writes) {
    const targetPath = resolveWorkspaceWritePath(write.path);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, `${JSON.stringify(write.record, null, 2)}\n`);
    written.push({
      kind: write.kind,
      path: path.relative(root, targetPath),
      action_id: write.action_id,
    });
  }

  await fs.writeFile(knoletLibraryInstallExecutionPath, `${JSON.stringify(preview.execution, null, 2)}\n`);
  return {
    ok: true,
    status: "installed",
    path: path.relative(root, knoletLibraryInstallExecutionPath),
    summary: preview.execution.summary,
    diagnosticsByLevel: preview.diagnosticsByLevel,
    writes: written,
    execution: {
      ...preview.execution,
      status: "installed",
    },
  };
}

async function libraryInventory() {
  const inventory = await readKnoletLibraryInventory(knoletLibraryRoot, { root });
  return {
    inventory,
    diagnosticsByLevel: {
      error: inventory.diagnostics.filter((item) => item.level === "error"),
      warning: inventory.diagnostics.filter((item) => item.level === "warning"),
    },
  };
}

async function productBackendReadiness() {
  return readProductBackendReadiness({ root });
}

async function productBackendContract() {
  const readiness = await productBackendReadiness();
  return compileProductBackendContract(readiness);
}

async function productBackendAdapter() {
  const readiness = await productBackendReadiness();
  const contract = compileProductBackendContract(readiness);
  return previewProductBackendAdapter(readiness, contract);
}

function normalizeGraphLayoutPositions(value = {}) {
  const positions = {};
  for (const [nodeId, position] of Object.entries(value || {})) {
    const x = Number(position?.x);
    const y = Number(position?.y);
    if (!nodeId || !Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }
    positions[nodeId] = {
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
    };
  }
  return positions;
}

function emptyGraphLayout(extra = {}) {
  return {
    graph_layout_version: GRAPH_LAYOUT_VERSION,
    exists: false,
    path: path.relative(root, knoletGraphLayoutPath),
    updatedAt: "",
    positions: {},
    ...extra,
  };
}

async function readGraphLayout() {
  try {
    const parsed = JSON.parse(await fs.readFile(knoletGraphLayoutPath, "utf8"));
    return {
      graph_layout_version: parsed.graph_layout_version || GRAPH_LAYOUT_VERSION,
      exists: true,
      path: path.relative(root, knoletGraphLayoutPath),
      updatedAt: parsed.updatedAt || "",
      positions: normalizeGraphLayoutPositions(parsed.positions),
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return emptyGraphLayout();
    }
    return emptyGraphLayout({
      error: `Invalid graph layout file: ${error.message}`,
    });
  }
}

async function saveGraphLayout(payload = {}) {
  const layout = {
    graph_layout_version: GRAPH_LAYOUT_VERSION,
    source: "manager",
    updatedAt: new Date().toISOString(),
    positions: normalizeGraphLayoutPositions(payload.positions),
  };
  await fs.mkdir(path.dirname(knoletGraphLayoutPath), { recursive: true });
  await fs.writeFile(knoletGraphLayoutPath, `${JSON.stringify(layout, null, 2)}\n`);
  return {
    ok: true,
    layout: {
      ...layout,
      exists: true,
      path: path.relative(root, knoletGraphLayoutPath),
    },
    path: path.relative(root, knoletGraphLayoutPath),
    positionCount: Object.keys(layout.positions).length,
  };
}

async function resetGraphLayout() {
  await fs.rm(knoletGraphLayoutPath, { force: true });
  return {
    ok: true,
    layout: emptyGraphLayout(),
  };
}

async function seedStudioCanvas() {
  await seedWorkspace();
  return studioRequest("/api/workspaces", {
    method: "PUT",
    body: JSON.stringify(studioWorkspacePayload()),
  });
}

async function importAsset(payload) {
  const filename = slug(String(payload.filename || "imported").replace(/\.[^.]+$/, ""), "imported");
  const content = String(payload.content || "");
  let body = content;
  let descriptor = null;

  try {
    const parsed = JSON.parse(content);
    descriptor = assetFromUrn(parsed.urn) || {
      kind: parsed.kind,
      owner: "martinyblue",
      stage: "imported",
      name: parsed.name || filename,
    };
    body = parsed;
  } catch {
    descriptor = {
      kind: "dance",
      owner: "martinyblue",
      stage: "imported",
      name: filename === "skill" ? "imported-skill" : filename,
    };
  }

  if (!descriptor || !assetKinds.has(slug(descriptor.kind, ""))) {
    throw new Error("Imported file must be a DOT JSON asset or a Dance markdown file.");
  }

  return writeAsset({
    ...descriptor,
    body,
  });
}

async function walk(dir, files = []) {
  if (!(await exists(dir))) {
    return files;
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function urnFromPath(filePath) {
  const relative = path.relative(workspaceRoot, filePath);
  const parts = relative.split(path.sep);
  const hasAssetsPrefix = parts[0] === "assets";
  const kind = hasAssetsPrefix ? parts[1] : parts[0];
  if (!assetKinds.has(kind)) {
    return null;
  }
  if (hasAssetsPrefix) {
    if (kind === "dance" && parts.at(-1) === "SKILL.md") {
      return `${parts[1]}/${parts[2]}/${parts[3]}/${parts[4]}`;
    }
    return `${parts[1]}/${parts[2]}/${parts[3]}/${path.basename(parts[4], ".json")}`;
  }
  if (kind === "dance") {
    return `${parts[0]}/${parts[1]}/${parts[2]}/${parts[3]}`;
  }
  return `${parts[0]}/${parts[1]}/${parts[2]}/${path.basename(parts[3], ".json")}`;
}

async function listAssets() {
  const files = await walk(workspaceRoot);
  return files
    .filter((filePath) => filePath.endsWith(".json") || filePath.endsWith("SKILL.md"))
    .filter((filePath) => path.basename(filePath) !== "workspace.json")
    .map((filePath) => ({
      urn: urnFromPath(filePath),
      path: path.relative(root, filePath),
    }))
    .filter((asset) => asset.urn)
    .sort((a, b) => a.urn.localeCompare(b.urn));
}

async function status() {
  const workspaceExists = await exists(workspaceRoot);
  const assets = await listAssets();
  return {
    root,
    workspace: path.relative(root, workspaceRoot),
    workspaceExists,
    assetCount: assets.length,
    officialAssets: assets.filter((asset) => asset.path.startsWith(".dance-of-tal/assets/")).length,
    assets,
  };
}

function workflowRunPath(id) {
  const cleanId = slug(id, "");
  if (!cleanId) {
    throw new Error("Workflow run id is required");
  }
  return path.join(workflowRunsRoot, `${cleanId}.json`);
}

function defaultRunOutputs(payload = {}) {
  return {
    knowledgeStructure: String(payload.knowledgeStructure || ""),
    knoletSpec: String(payload.knoletSpec || ""),
    runtimeAppPlan: String(payload.runtimeAppPlan || ""),
    versionForkShare: String(payload.versionForkShare || ""),
    nextChecklist: String(payload.nextChecklist || ""),
  };
}

async function readWorkflowRun(id) {
  const filePath = workflowRunPath(id);
  const run = JSON.parse(await fs.readFile(filePath, "utf8"));
  return { ...run, path: path.relative(root, filePath) };
}

async function listWorkflowRuns() {
  await ensureWorkspace();
  const entries = await fs.readdir(workflowRunsRoot, { withFileTypes: true });
  const runs = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    try {
      const run = JSON.parse(await fs.readFile(path.join(workflowRunsRoot, entry.name), "utf8"));
      runs.push({
        id: run.id,
        title: run.title,
        status: run.status,
        updatedAt: run.updatedAt,
        sourceTitle: run.sourceTitle,
        path: path.relative(root, path.join(workflowRunsRoot, entry.name)),
      });
    } catch {
      // Ignore malformed local run files so one bad draft does not break the Manager.
    }
  }
  return runs.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

async function createWorkflowRun(payload) {
  await ensureWorkspace();
  const createdAt = new Date().toISOString();
  const title = String(payload.title || payload.sourceTitle || "Document to Knolet App Run").trim();
  const id = `${createdAt.slice(0, 10)}-${slug(title, "knolet-run")}-${Date.now().toString(36)}`;
  const run = {
    id,
    title,
    status: "draft",
    sourceTitle: String(payload.sourceTitle || title).trim(),
    sourceDocument: String(payload.sourceDocument || "").trim(),
    targetUser: String(payload.targetUser || "").trim(),
    runtimeConstraints: String(payload.runtimeConstraints || "").trim(),
    outputs: defaultRunOutputs(payload.outputs || {}),
    review: {
      score: null,
      passed: false,
      checklist: [],
    },
    createdAt,
    updatedAt: createdAt,
  };
  await fs.writeFile(workflowRunPath(id), JSON.stringify(run, null, 2));
  return readWorkflowRun(id);
}

async function updateWorkflowRun(id, payload) {
  const current = await readWorkflowRun(id);
  const next = {
    ...current,
    title: payload.title === undefined ? current.title : String(payload.title || current.title).trim(),
    sourceTitle:
      payload.sourceTitle === undefined ? current.sourceTitle : String(payload.sourceTitle || current.sourceTitle).trim(),
    sourceDocument:
      payload.sourceDocument === undefined ? current.sourceDocument : String(payload.sourceDocument || "").trim(),
    targetUser: payload.targetUser === undefined ? current.targetUser : String(payload.targetUser || "").trim(),
    runtimeConstraints:
      payload.runtimeConstraints === undefined
        ? current.runtimeConstraints
        : String(payload.runtimeConstraints || "").trim(),
    outputs: {
      ...defaultRunOutputs(current.outputs || {}),
      ...defaultRunOutputs(payload.outputs || current.outputs || {}),
    },
    status: payload.status || current.status,
    updatedAt: new Date().toISOString(),
  };
  delete next.path;
  const hasAllOutputs = Object.values(next.outputs).every((value) => String(value || "").trim().length > 0);
  if (hasAllOutputs && next.status === "draft") {
    next.status = "captured";
  }
  await fs.writeFile(workflowRunPath(id), JSON.stringify(next, null, 2));
  return readWorkflowRun(id);
}

function reviewWorkflowRunShape(run) {
  const outputs = defaultRunOutputs(run.outputs || {});
  const checks = [
    {
      key: "knowledgeStructure",
      label: "Knowledge Structure",
      ok: outputs.knowledgeStructure.trim().length >= 80,
      detail: "도메인 개념, 역할, 결정, 데이터 객체가 충분히 적혔는지 확인합니다.",
    },
    {
      key: "knoletSpec",
      label: "KnoletSpec",
      ok: outputs.knoletSpec.trim().length >= 120,
      detail: "화면, 상태, 데이터, 권한, workflow 규칙이 구현 가능한 수준인지 확인합니다.",
    },
    {
      key: "runtimeAppPlan",
      label: "Runtime App Plan",
      ok: outputs.runtimeAppPlan.trim().length >= 100,
      detail: "로컬 실행 화면, API, 저장 구조, 검증 방법이 있는지 확인합니다.",
    },
    {
      key: "versionForkShare",
      label: "Version / Fork / Share",
      ok: outputs.versionForkShare.trim().length >= 60,
      detail: "버전 기록, 포크 경계, 공유 가능/불가 산출물이 분리되어야 합니다.",
    },
    {
      key: "nextChecklist",
      label: "Next Action Checklist",
      ok: outputs.nextChecklist.trim().length >= 40,
      detail: "다음 개발자가 바로 움직일 수 있는 체크리스트가 필요합니다.",
    },
  ];
  const passedCount = checks.filter((check) => check.ok).length;
  const score = Math.round((passedCount / checks.length) * 100);
  return {
    score,
    passed: score === 100,
    checklist: checks,
    summary:
      score === 100
        ? "모든 산출물이 다음 개발 단계로 넘길 만큼 채워졌습니다."
        : "아직 보강할 산출물이 있습니다. 실패 항목부터 OpenCode 결과를 보완하세요.",
    reviewedAt: new Date().toISOString(),
  };
}

async function reviewWorkflowRun(id) {
  const current = await readWorkflowRun(id);
  const review = reviewWorkflowRunShape(current);
  const nextStatus = review.passed ? "reviewed" : "needs-review";
  const updated = {
    ...current,
    review,
    status: nextStatus,
    updatedAt: review.reviewedAt,
  };
  delete updated.path;
  await fs.writeFile(workflowRunPath(id), JSON.stringify(updated, null, 2));
  return readWorkflowRun(id);
}

function markdownSection(title, body) {
  return [`## ${title}`, "", String(body || "_Not captured yet._").trim() || "_Not captured yet._", ""].join("\n");
}

async function exportWorkflowRun(id) {
  await ensureWorkspace();
  const run = await readWorkflowRun(id);
  const review = run.review?.checklist?.length ? run.review : reviewWorkflowRunShape(run);
  const outputs = defaultRunOutputs(run.outputs || {});
  const markdown = [
    `# ${run.title}`,
    "",
    `- Run ID: \`${run.id}\``,
    `- Status: \`${run.status}\``,
    `- Target User: ${run.targetUser || "Not specified"}`,
    `- Updated: ${run.updatedAt}`,
    `- Review Score: ${review.score}`,
    "",
    markdownSection("Source Document", run.sourceDocument),
    markdownSection("Runtime Constraints", run.runtimeConstraints),
    markdownSection("Knowledge Structure", outputs.knowledgeStructure),
    markdownSection("KnoletSpec", outputs.knoletSpec),
    markdownSection("Runtime App Plan", outputs.runtimeAppPlan),
    markdownSection("Version / Fork / Share", outputs.versionForkShare),
    markdownSection("Next Action Checklist", outputs.nextChecklist),
    "## Review Checklist",
    "",
    ...review.checklist.map((check) => `- [${check.ok ? "x" : " "}] ${check.label}: ${check.detail}`),
    "",
  ].join("\n");
  const filePath = path.join(workflowExportsRoot, `${slug(run.title, run.id)}-${run.id}.md`);
  await fs.writeFile(filePath, markdown);
  return {
    id: run.id,
    title: run.title,
    path: path.relative(root, filePath),
    markdown,
    review,
  };
}

async function knoletWorkflowBlueprint() {
  const workspaceStatus = await status();
  const kindSummary = assetKindSummary(workspaceStatus.assets);
  const assetSet = new Set(workspaceStatus.assets.map((asset) => asset.urn));
  const hasKnoletBuilder =
    assetSet.has("performer/@martinyblue/local/knolet-builder") ||
    assetSet.has("performer/@martinyblue/knolet/knolet-builder") ||
    assetSet.has("performer/@martinyblue/danceoftal/knolet-builder");
  const hasWorkflowAct =
    assetSet.has("act/@martinyblue/local/document-to-knolet-app") ||
    assetSet.has("act/@martinyblue/knolet/document-to-knolet-app") ||
    assetSet.has("act/@martinyblue/danceoftal/document-to-knolet-app");

  const phases = [
    {
      key: "source-document",
      title: "1. Source Document",
      operatorAction: "문서 원문, 링크, 메모, 기존 업무 규칙을 한 곳에 모읍니다.",
      input: ["원문 문서", "업무 배경", "사용자/역할 메모"],
      output: ["sourceDocument", "sourceMetadata"],
      acceptance: "무엇을 만들지 판단할 근거가 문서 단위로 분리되어 있어야 합니다.",
      ready: workspaceStatus.workspaceExists,
    },
    {
      key: "knowledge-structure",
      title: "2. Knowledge Structure",
      operatorAction: "Source Document Parser Dance로 개념, 역할, 결정, 데이터 객체를 추출합니다.",
      input: ["sourceDocument"],
      output: ["domainConcepts", "actors", "decisions", "dataObjects", "workflowCandidates"],
      acceptance: "원문 해석과 앱 생성 판단이 섞이지 않고 구조화되어야 합니다.",
      ready: kindSummary.dance,
    },
    {
      key: "knolet-spec",
      title: "3. KnoletSpec",
      operatorAction: "Knolet Builder Performer가 화면, 상태, 데이터, 권한, 실행 흐름을 명세합니다.",
      input: ["knowledgeStructure", "targetUser", "runtimeConstraints"],
      output: ["knoletSpec", "uiStates", "workflowRules", "toolBoundaries"],
      acceptance: "개발자가 그대로 구현할 수 있을 만큼 화면과 데이터 경계가 명확해야 합니다.",
      ready: hasKnoletBuilder,
    },
    {
      key: "runtime-app",
      title: "4. Runtime App",
      operatorAction: "KnoletSpec을 실제 앱 화면, API, 저장 구조, 실행 상태로 변환합니다.",
      input: ["knoletSpec"],
      output: ["appScreens", "apiRoutes", "storageShape", "runChecks"],
      acceptance: "로컬에서 실행하고 Manager 진단으로 상태를 확인할 수 있어야 합니다.",
      ready: hasWorkflowAct,
    },
    {
      key: "version-fork-share",
      title: "5. Version / Fork / Share",
      operatorAction: "변경 버전, 포크 가능 지점, 공유 가능한 산출물을 분리해 기록합니다.",
      input: ["runtimeApp", "reviewNotes"],
      output: ["versionNote", "forkBoundary", "sharePackage", "nextIteration"],
      acceptance: "다음 개발 단위가 무엇인지, 공유하면 안 되는 것이 무엇인지 분명해야 합니다.",
      ready: workspaceStatus.workspaceExists && kindSummary.act,
    },
  ];

  const handoffPrompt = [
    "Knolet Builder로 다음 문서를 앱 명세로 바꿔주세요.",
    "",
    "목표:",
    "- 원문 해석과 앱 생성 판단을 분리합니다.",
    "- Knowledge Structure, KnoletSpec, Runtime App, Version/Fork/Share를 각각 산출합니다.",
    "- 각 산출물에는 검수 기준과 다음 행동을 포함합니다.",
    "",
    "입력:",
    "- Source Document: <여기에 문서 원문 또는 요약>",
    "- Target User: <주 사용자>",
    "- Runtime Constraints: <로컬/웹/권한/데이터 제약>",
    "",
    "출력 형식:",
    "1. Knowledge Structure",
    "2. KnoletSpec",
    "3. Runtime App Plan",
    "4. Version/Fork/Share Notes",
    "5. Next Action Checklist",
  ].join("\n");

  return {
    title: "Document to Knolet App Workflow",
    summary: "문서를 실행 가능한 Knolet 앱으로 바꾸기 위한 5단계 산출물 흐름입니다.",
    ready: phases.every((phase) => phase.ready),
    phases,
    handoffPrompt,
    assets: {
      workspace: workspaceStatus.workspaceExists,
      tal: kindSummary.tal,
      dance: kindSummary.dance,
      performer: kindSummary.performer,
      act: kindSummary.act,
    },
  };
}

async function preflightInstall({ urn, expectedKind }) {
  const descriptor = assetFromUrn(urn);
  const workspaceStatus = await status();
  const installedAsset = workspaceStatus.assets.find((asset) => asset.urn === urn) || null;
  const checks = [];

  checks.push({
    key: "urn",
    label: "URN 형식",
    ok: Boolean(descriptor),
    detail: descriptor ? `${descriptor.kind}/@${descriptor.owner}/${descriptor.stage}/${descriptor.name}` : "tal, dance, performer, act 형식의 URN이 아닙니다.",
  });

  const kindMatches = Boolean(!expectedKind || !descriptor || descriptor.kind === expectedKind);
  checks.push({
    key: "kind",
    label: "kind 일치",
    ok: kindMatches,
    detail:
      !descriptor || kindMatches
        ? "선택한 종류와 URN 종류가 맞습니다."
        : `선택한 종류는 ${expectedKind}, URN 종류는 ${descriptor.kind}입니다.`,
  });

  checks.push({
    key: "installed",
    label: "이미 설치됨",
    ok: !installedAsset,
    detail: installedAsset ? `이미 ${installedAsset.path}에 있습니다.` : "현재 workspace에는 아직 없습니다.",
  });

  let registryMatch = null;
  let registryError = null;
  if (descriptor) {
    try {
      const query = encodeURIComponent(descriptor.name);
      const kind = encodeURIComponent(descriptor.kind);
      const payload = await studioRequest(`/api/dot/search?q=${query}&kind=${kind}&limit=12`);
      registryMatch =
        registryItems(payload).find((item) => (item.urn || item.id || item.name) === urn) || null;
    } catch (error) {
      registryError = translateOperationalError(error.message);
    }
  }

  checks.push({
    key: "registry",
    label: "registry 검색",
    ok: Boolean(registryMatch),
    detail: registryError || (registryMatch ? "registry 검색 결과에서 같은 URN을 찾았습니다." : "registry 검색 결과에서 같은 URN을 찾지 못했습니다."),
  });

  const invalidChecks = checks.filter((check) => !check.ok && check.key !== "installed");
  const githubUrl = githubUrlFromUrn(urn);
  if (installedAsset) {
    return {
      ok: true,
      status: "already-installed",
      title: "이미 설치된 asset입니다",
      message: "같은 URN이 현재 workspace에 있습니다. 다시 설치하지 않아도 됩니다.",
      urn,
      descriptor,
      checks,
      installedAsset,
      registryMatch,
      githubUrl,
      actions: actionSetForInstall("already-installed", githubUrl),
    };
  }
  if (invalidChecks.length) {
    return {
      ok: false,
      status: "blocked",
      title: "설치 전 확인 필요",
      message: invalidChecks[0].detail,
      urn,
      descriptor,
      checks,
      registryMatch,
      githubUrl,
      actions: actionSetForInstall("blocked", githubUrl),
    };
  }

  return {
    ok: true,
    status: "ready",
    title: "설치 준비 완료",
    message: "URN 형식, kind, registry 검색, 중복 설치 여부를 확인했습니다.",
    urn,
    descriptor,
    checks,
    registryMatch,
    githubUrl,
    actions: actionSetForInstall("ready", githubUrl),
  };
}

async function readSafeFile(relativePath) {
  const fullPath = path.resolve(root, relativePath);
  if (!fullPath.startsWith(workspaceRoot + path.sep)) {
    throw new Error("Only .dance-of-tal files can be previewed");
  }
  return fs.readFile(fullPath, "utf8");
}

async function seedWorkspace() {
  const assets = [
    {
      kind: "tal",
      owner: "martinyblue",
      stage: "local",
      name: "knolet-architect",
      body: {
        name: "Knolet Architect",
        summary: "Domain knowledge to executable workflow app designer.",
        instructions: [
          "Separate identity, knowledge, skills, UI, runtime, and versions.",
          "Convert source documents into explicit KnoletSpec candidates.",
          "Preserve fork/share/version boundaries in every workflow.",
        ],
      },
    },
    {
      kind: "dance",
      owner: "martinyblue",
      stage: "local",
      name: "source-document-parser",
      body: `---
name: source-document-parser
description: Extract domain concepts and workflow candidates from source documents.
---

# Source Document Parser

Use this Dance to convert source material into structured knowledge, decision
points, workflow candidates, UI states, and runtime constraints.
`,
    },
    {
      kind: "performer",
      owner: "martinyblue",
      stage: "local",
      name: "knolet-builder",
      body: {
        tal: "tal/@martinyblue/local/knolet-architect",
        dances: ["dance/@martinyblue/local/source-document-parser"],
        model: {
          provider: "openai",
          name: "gpt-5.4",
        },
        tools: {
          local: ["filesystem"],
          mcp: [],
        },
      },
    },
    {
      kind: "act",
      owner: "martinyblue",
      stage: "local",
      name: "document-to-knolet-app",
      body: {
        participants: [
          {
            id: "builder",
            performer: "performer/@martinyblue/local/knolet-builder",
          },
        ],
        relations: [],
        actRules: [
          "Source interpretation and runtime app generation must remain separate.",
          "Output must include Source Document, Knowledge Structure, KnoletSpec, Runtime App, Version/Fork/Share.",
        ],
        subscriptions: ["source-document-added", "spec-review-requested"],
      },
    },
  ];

  const written = [];
  for (const asset of assets) {
    written.push(await writeAsset(asset));
  }
  for (const asset of assets) {
    written.push(
      await writeOfficialAsset({
        ...asset,
        stage: "danceoftal",
      }),
    );
  }
  return written;
}

async function serveStatic(url, response, method = "GET") {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const fullPath = path.resolve(root, `.${pathname}`);
  if (!fullPath.startsWith(root + path.sep)) {
    send(response, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }
  const content = await fs.readFile(fullPath);
  const type = contentTypes[path.extname(fullPath)] || "text/plain; charset=utf-8";
  response.writeHead(200, {
    "content-type": type,
    "content-length": content.length,
  });
  if (method === "HEAD") {
    response.end();
    return;
  }
  response.end(content);
}

async function route(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/api/status" && request.method === "GET") {
    send(response, 200, await status());
    return;
  }

  if (url.pathname === "/api/diagnostics" && request.method === "GET") {
    send(response, 200, await diagnostics());
    return;
  }

  if (url.pathname === "/api/launcher" && request.method === "GET") {
    send(response, 200, await launcher());
    return;
  }

  if (url.pathname === "/api/launcher/handoff" && request.method === "GET") {
    send(response, 200, await launcherHandoff());
    return;
  }

  if (url.pathname === "/api/knolet/workflow" && request.method === "GET") {
    send(response, 200, await knoletWorkflowBlueprint());
    return;
  }

  if (url.pathname === "/api/knolet/import/dot" && request.method === "GET") {
    const workspacePath = resolveWorkspaceInput(url.searchParams.get("path") || ".dance-of-tal");
    send(response, 200, await importDotWorkspacePreview(workspacePath));
    return;
  }

  if (url.pathname === "/api/knolet/import/dot" && request.method === "POST") {
    const payload = await parseBody(request);
    const workspacePath = resolveWorkspaceInput(payload.path || ".dance-of-tal");
    send(response, 200, await importDotWorkspacePreview(workspacePath, payload));
    return;
  }

  if (url.pathname === "/api/knolet/import/dot/save" && request.method === "POST") {
    const payload = await parseBody(request);
    send(response, 200, await saveKnoletImport(payload));
    return;
  }

  if (url.pathname === "/api/knolet/runtime/plan" && request.method === "GET") {
    send(response, 200, await runtimePlanPreview());
    return;
  }

  if (url.pathname === "/api/knolet/runtime/plan" && request.method === "POST") {
    const payload = await parseBody(request);
    send(response, 200, await runtimePlanPreview(payload));
    return;
  }

  if (url.pathname === "/api/knolet/runtime/plan/save" && request.method === "POST") {
    const payload = await parseBody(request);
    send(response, 200, await saveRuntimePlan(payload));
    return;
  }

  if (url.pathname === "/api/knolet/graph" && request.method === "GET") {
    send(response, 200, await graphModelPreview());
    return;
  }

  if (url.pathname === "/api/knolet/graph" && request.method === "POST") {
    const payload = await parseBody(request);
    send(response, 200, await graphModelPreview(payload));
    return;
  }

  if (url.pathname === "/api/knolet/graph/save" && request.method === "POST") {
    const payload = await parseBody(request);
    send(response, 200, await saveGraphModel(payload));
    return;
  }

  if (url.pathname === "/api/knolet/library/package" && request.method === "GET") {
    send(response, 200, await libraryPackagePreview());
    return;
  }

  if (url.pathname === "/api/knolet/library/package" && request.method === "POST") {
    const payload = await parseBody(request);
    send(response, 200, await libraryPackagePreview(payload));
    return;
  }

  if (url.pathname === "/api/knolet/library/package/save" && request.method === "POST") {
    const payload = await parseBody(request);
    send(response, 200, await saveLibraryPackage(payload));
    return;
  }

  if (url.pathname === "/api/knolet/library/install-plan" && request.method === "GET") {
    send(response, 200, await libraryInstallPlanPreview());
    return;
  }

  if (url.pathname === "/api/knolet/library/install-plan" && request.method === "POST") {
    const payload = await parseBody(request);
    send(response, 200, await libraryInstallPlanPreview(payload));
    return;
  }

  if (url.pathname === "/api/knolet/library/install-plan/save" && request.method === "POST") {
    const payload = await parseBody(request);
    send(response, 200, await saveLibraryInstallPlan(payload));
    return;
  }

  if (url.pathname === "/api/knolet/library/install/execution" && request.method === "GET") {
    send(response, 200, await libraryInstallExecutionPreview());
    return;
  }

  if (url.pathname === "/api/knolet/library/install/execution" && request.method === "POST") {
    const payload = await parseBody(request);
    send(response, 200, await libraryInstallExecutionPreview(payload));
    return;
  }

  if (url.pathname === "/api/knolet/library/install/execute" && request.method === "POST") {
    const payload = await parseBody(request);
    send(response, 200, await executeLibraryInstall(payload));
    return;
  }

  if (url.pathname === "/api/knolet/library/inventory" && request.method === "GET") {
    send(response, 200, await libraryInventory());
    return;
  }

  if (url.pathname === "/api/knolet/product-backend/readiness" && request.method === "GET") {
    send(response, 200, await productBackendReadiness());
    return;
  }

  if (url.pathname === "/api/knolet/product-backend/contract" && request.method === "GET") {
    send(response, 200, await productBackendContract());
    return;
  }

  if (url.pathname === "/api/knolet/product-backend/adapter" && request.method === "GET") {
    send(response, 200, await productBackendAdapter());
    return;
  }

  if (url.pathname === "/api/knolet/graph/layout" && request.method === "GET") {
    send(response, 200, await readGraphLayout());
    return;
  }

  if (url.pathname === "/api/knolet/graph/layout" && request.method === "POST") {
    const payload = await parseBody(request);
    send(response, 200, await saveGraphLayout(payload));
    return;
  }

  if (url.pathname === "/api/knolet/graph/layout" && request.method === "DELETE") {
    send(response, 200, await resetGraphLayout());
    return;
  }

  if (url.pathname === "/api/knolet/runs" && request.method === "GET") {
    send(response, 200, { runs: await listWorkflowRuns() });
    return;
  }

  if (url.pathname === "/api/knolet/runs" && request.method === "POST") {
    const payload = await parseBody(request);
    send(response, 200, await createWorkflowRun(payload));
    return;
  }

  const runMatch = url.pathname.match(/^\/api\/knolet\/runs\/([^/]+)$/);
  if (runMatch && request.method === "GET") {
    send(response, 200, await readWorkflowRun(runMatch[1]));
    return;
  }

  if (runMatch && request.method === "PUT") {
    const payload = await parseBody(request);
    send(response, 200, await updateWorkflowRun(runMatch[1], payload));
    return;
  }

  const runReviewMatch = url.pathname.match(/^\/api\/knolet\/runs\/([^/]+)\/review$/);
  if (runReviewMatch && request.method === "POST") {
    send(response, 200, await reviewWorkflowRun(runReviewMatch[1]));
    return;
  }

  const runExportMatch = url.pathname.match(/^\/api\/knolet\/runs\/([^/]+)\/export$/);
  if (runExportMatch && request.method === "POST") {
    send(response, 200, await exportWorkflowRun(runExportMatch[1]));
    return;
  }

  if (url.pathname === "/api/init" && request.method === "POST") {
    await ensureWorkspace();
    send(response, 200, await status());
    return;
  }

  if (url.pathname === "/api/seed" && request.method === "POST") {
    const written = await seedWorkspace();
    send(response, 200, { written, status: await status() });
    return;
  }

  if (url.pathname === "/api/studio/seed" && request.method === "POST") {
    const workspace = await seedStudioCanvas();
    send(response, 200, { workspace, status: await status() });
    return;
  }

  if (url.pathname === "/api/studio/status" && request.method === "GET") {
    const [health, workspaces] = await Promise.all([
      studioRequest("/api/health"),
      studioRequest("/api/workspaces?includeHidden=1"),
    ]);
    send(response, 200, { health, workspaces });
    return;
  }

  if (url.pathname === "/api/dot/search" && request.method === "GET") {
    const query = encodeURIComponent(url.searchParams.get("q") || "");
    const kind = encodeURIComponent(url.searchParams.get("kind") || "");
    const suffix = kind ? `&kind=${kind}` : "";
    send(response, 200, await studioRequest(`/api/dot/search?q=${query}${suffix}&limit=8`));
    return;
  }

  if (url.pathname === "/api/dot/preflight" && request.method === "POST") {
    const payload = await parseBody(request);
    send(response, 200, await preflightInstall(payload));
    return;
  }

  if (url.pathname === "/api/dot/install" && request.method === "POST") {
    const payload = await parseBody(request);
    const preflight = await preflightInstall(payload);
    if (!preflight.ok || preflight.status === "already-installed") {
      send(response, 200, preflight);
      return;
    }

    try {
      const installPayload = await studioRequest("/api/dot/install", {
        method: "POST",
        body: JSON.stringify({
          urn: payload.urn,
          localName: payload.localName || undefined,
          force: payload.force === true,
          scope: payload.scope || "stage",
        }),
      });
      const nextStatus = await status();
      const installedAsset = nextStatus.assets.find((asset) => asset.urn === payload.urn) || null;
      send(response, 200, {
        ok: Boolean(installedAsset),
        status: installedAsset ? "installed" : "partial",
        title: installedAsset ? "설치 완료" : "부분 성공: 파일 확인 필요",
        message: installedAsset
          ? "Registry asset이 현재 workspace에 설치됐습니다."
          : "설치 요청은 끝났지만 Manager 파일 목록에서 같은 URN을 찾지 못했습니다. DOT Studio나 파일 구조를 확인하세요.",
        urn: payload.urn,
        descriptor: preflight.descriptor,
        checks: preflight.checks,
        installedAsset,
        installPayload,
        registryMatch: preflight.registryMatch,
        githubUrl: preflight.githubUrl,
        actions: actionSetForInstall(installedAsset ? "installed" : "partial", preflight.githubUrl),
      });
    } catch (error) {
      const failure = classifyInstallFailure(error.message, payload.urn);
      send(response, 200, {
        ...failure,
        urn: payload.urn,
        descriptor: preflight.descriptor,
        checks: preflight.checks,
        registryMatch: preflight.registryMatch,
      });
    }
    return;
  }

  if (url.pathname === "/api/dot/add" && request.method === "POST") {
    const payload = await parseBody(request);
    send(
      response,
      200,
      await studioRequest("/api/dot/add", {
        method: "POST",
        body: JSON.stringify({
          source: payload.source,
          scope: payload.scope || "stage",
        }),
      }),
    );
    return;
  }

  if (url.pathname === "/api/assets" && request.method === "POST") {
    const payload = await parseBody(request);
    send(response, 200, await writeAsset(payload));
    return;
  }

  if (url.pathname === "/api/import" && request.method === "POST") {
    const payload = await parseBody(request);
    send(response, 200, await importAsset(payload));
    return;
  }

  if (url.pathname === "/api/file" && request.method === "GET") {
    const relativePath = url.searchParams.get("path") || "";
    send(response, 200, {
      path: relativePath,
      content: await readSafeFile(relativePath),
    });
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    await serveStatic(url, response, request.method);
    return;
  }

  send(response, 404, { error: "Not found" });
}

const server = http.createServer((request, response) => {
  route(request, response).catch((error) => {
    const translated = translateOperationalError(error.message);
    send(response, 500, {
      error: translated,
      rawError: translated === error.message ? undefined : error.message,
    });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`dance-of-tal manager listening on http://127.0.0.1:${port}`);
  if (Number.isFinite(shutdownAfterMs) && shutdownAfterMs > 0) {
    setTimeout(() => {
      console.log(`dance-of-tal manager shutting down after ${shutdownAfterMs}ms`);
      server.close(() => process.exit(0));
    }, shutdownAfterMs).unref();
  }
});
