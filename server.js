const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const { execFile } = require("node:child_process");

const root = process.cwd();
const workspaceRoot = path.join(root, ".dance-of-tal");
const port = Number(process.env.PORT || 8080);
const studioUrl = process.env.DOT_STUDIO_URL || "http://127.0.0.1:43110";
const opencodeUrl = process.env.OPENCODE_URL || "http://127.0.0.1:43120";

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
      studioWorkspace = {
        id: workspaceId,
        ok: workspace.ok,
        performerCount: workspace.payload?.performers?.length || 0,
        actCount: workspace.payload?.acts?.length || 0,
      };
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
    ready:
      workspaceStatus.workspaceExists &&
      studio.ok &&
      opencode.ok &&
      (!studioWorkspace || studioWorkspace.performerCount > 0 || studioWorkspace.actCount > 0) &&
      git.clean &&
      git.syncedWithOrigin,
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

  if (url.pathname === "/api/dot/install" && request.method === "POST") {
    const payload = await parseBody(request);
    send(
      response,
      200,
      await studioRequest("/api/dot/install", {
        method: "POST",
        body: JSON.stringify({
          urn: payload.urn,
          localName: payload.localName || undefined,
          force: payload.force === true,
          scope: payload.scope || "stage",
        }),
      }),
    );
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
    send(response, 500, { error: error.message });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`dance-of-tal manager listening on http://127.0.0.1:${port}`);
});
