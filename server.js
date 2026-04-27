const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const { execFile } = require("node:child_process");

const root = process.cwd();
const workspaceRoot = path.join(root, ".dance-of-tal");
const workflowRunsRoot = path.join(workspaceRoot, "runs");
const port = Number(process.env.PORT || 8080);
const studioUrl = process.env.DOT_STUDIO_URL || "http://127.0.0.1:43110";
const opencodeUrl = process.env.OPENCODE_URL || "http://127.0.0.1:43120";
const shutdownAfterMs = Number(process.env.SHUTDOWN_AFTER_MS || 0);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const assetKinds = new Set(["tal", "dance", "performer", "act"]);

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

  if (url.pathname === "/api/knolet/workflow" && request.method === "GET") {
    send(response, 200, await knoletWorkflowBlueprint());
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
