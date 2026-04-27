const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");

const root = process.cwd();
const workspaceRoot = path.join(root, ".dance-of-tal");
const port = Number(process.env.PORT || 8080);

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

async function writeAsset(payload) {
  await ensureWorkspace();
  const kind = slug(payload.kind, "tal");
  const { urn, filePath } = assetPath({ ...payload, kind });
  const content = normalizeBody(kind, urn, payload.body);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
  return { urn, path: path.relative(root, filePath) };
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
  response.end(method === "HEAD" ? undefined : content);
}

async function route(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/api/status" && request.method === "GET") {
    send(response, 200, await status());
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

  if (url.pathname === "/api/assets" && request.method === "POST") {
    const payload = await parseBody(request);
    send(response, 200, await writeAsset(payload));
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
