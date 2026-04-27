const state = {
  assets: [],
};

const templates = {
  tal: {
    kind: "tal",
    owner: "martinyblue",
    stage: "local",
    name: "knolet-architect",
    body: {
      name: "Knolet Architect",
      summary: "Turns domain knowledge into executable workflow app structure.",
      instructions: [
        "Separate persona, knowledge, skills, UI, runtime, and versioning.",
        "Prefer reusable workflow blocks over a single master prompt.",
        "Keep generated specs explicit and reviewable.",
      ],
    },
  },
  dance: {
    kind: "dance",
    owner: "martinyblue",
    stage: "local",
    name: "source-document-parser",
    body: `---
name: source-document-parser
description: Extract domain concepts, decisions, actors, data objects, and workflow candidates from source documents.
---

# Source Document Parser

Use this Dance when a Knolet workspace needs to turn source material into a structured knowledge model.

## Output

- domain concepts
- user roles
- workflow candidates
- required UI states
- runtime constraints
`,
  },
  performer: {
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
        mcp: [],
        local: ["filesystem"],
      },
    },
  },
  act: {
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
        "Keep source document interpretation separate from runtime app generation.",
        "Every generated app must expose version, fork, and share boundaries.",
      ],
      subscriptions: ["source-document-added", "spec-review-requested"],
    },
  },
};

const elements = {
  workspaceState: document.querySelector("#workspaceState"),
  assetCount: document.querySelector("#assetCount"),
  initWorkspace: document.querySelector("#initWorkspace"),
  seedWorkspace: document.querySelector("#seedWorkspace"),
  refreshWorkspace: document.querySelector("#refreshWorkspace"),
  assetForm: document.querySelector("#assetForm"),
  assetKind: document.querySelector("#assetKind"),
  assetOwner: document.querySelector("#assetOwner"),
  assetStage: document.querySelector("#assetStage"),
  assetName: document.querySelector("#assetName"),
  assetBody: document.querySelector("#assetBody"),
  urnPreview: document.querySelector("#urnPreview"),
  loadTemplate: document.querySelector("#loadTemplate"),
  assetImport: document.querySelector("#assetImport"),
  importAsset: document.querySelector("#importAsset"),
  assetList: document.querySelector("#assetList"),
  previewTitle: document.querySelector("#previewTitle"),
  previewBody: document.querySelector("#previewBody"),
  actionLog: document.querySelector("#actionLog"),
  workflowCanvas: document.querySelector("#workflowCanvas"),
};

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

function currentUrn() {
  const kind = elements.assetKind.value;
  const owner = elements.assetOwner.value || "owner";
  const stage = elements.assetStage.value || "stage";
  const name = elements.assetName.value || "name";
  return `${kind}/@${owner}/${stage}/${name}`;
}

function updateUrnPreview() {
  elements.urnPreview.textContent = currentUrn();
}

function loadTemplate() {
  const template = templates[elements.assetKind.value];
  elements.assetOwner.value = template.owner;
  elements.assetStage.value = template.stage;
  elements.assetName.value = template.name;
  elements.assetBody.value =
    typeof template.body === "string" ? template.body : JSON.stringify(template.body, null, 2);
  updateUrnPreview();
}

function logAction(message) {
  const item = document.createElement("li");
  item.textContent = `${new Date().toLocaleTimeString()} ${message}`;
  elements.actionLog.prepend(item);
  while (elements.actionLog.children.length > 8) {
    elements.actionLog.lastElementChild.remove();
  }
}

function renderStatus(status) {
  elements.workspaceState.textContent = status.workspaceExists
    ? ".dance-of-tal ready"
    : ".dance-of-tal missing";
  elements.assetCount.textContent = `${status.assetCount} assets`;
  if (status.officialAssets) {
    elements.assetCount.textContent = `${status.assetCount} assets (${status.officialAssets} official)`;
  }
}

function renderCanvas(assets) {
  const assetSet = new Set(assets.map((asset) => asset.urn));
  const checks = {
    tal: assetSet.has("tal/@martinyblue/local/knolet-architect"),
    dance: assetSet.has("dance/@martinyblue/local/source-document-parser"),
    performer: assetSet.has("performer/@martinyblue/local/knolet-builder"),
    act: assetSet.has("act/@martinyblue/local/document-to-knolet-app"),
  };

  for (const node of elements.workflowCanvas.querySelectorAll(".canvas-node")) {
    const helper = node.querySelector("small");
    helper.dataset.baseText ||= helper.textContent;
    const kind = [...node.classList]
      .find((className) => className.startsWith("canvas-node--"))
      ?.replace("canvas-node--", "");
    node.dataset.ready = checks[kind] ? "true" : "false";
    helper.textContent = checks[kind] ? helper.dataset.baseText : `missing: ${helper.dataset.baseText}`;
  }
}

function renderAssets(assets) {
  state.assets = assets;
  elements.assetList.innerHTML = "";

  if (!assets.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No Tal, Dance, Performer, or Act assets yet.";
    elements.assetList.append(empty);
    return;
  }

  for (const asset of assets) {
    const row = document.createElement("button");
    row.className = "asset-row";
    row.type = "button";
    row.innerHTML = `<strong>${asset.urn}</strong><span>${asset.path}</span>`;
    row.addEventListener("click", () => previewAsset(asset.path));
    elements.assetList.append(row);
  }
}

async function refresh() {
  const status = await request("/api/status");
  renderStatus(status);
  renderAssets(status.assets);
  renderCanvas(status.assets);
  logAction(`Refreshed workspace: ${status.assetCount} assets, ${status.officialAssets || 0} official.`);
}

async function previewAsset(filePath) {
  const data = await request(`/api/file?path=${encodeURIComponent(filePath)}`);
  elements.previewTitle.textContent = data.path;
  elements.previewBody.textContent = data.content;
}

async function createAsset(event) {
  event.preventDefault();
  const payload = {
    kind: elements.assetKind.value,
    owner: elements.assetOwner.value,
    stage: elements.assetStage.value,
    name: elements.assetName.value,
    body: elements.assetBody.value,
  };
  const result = await request("/api/assets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  await refresh();
  await previewAsset(result.path);
  logAction(`Wrote ${result.urn} to ${result.path}.`);
}

async function importSelectedAsset() {
  const file = elements.assetImport.files?.[0];
  if (!file) {
    throw new Error("Choose a .json or .md file first.");
  }

  const content = await file.text();
  const result = await request("/api/import", {
    method: "POST",
    body: JSON.stringify({
      filename: file.name,
      content,
    }),
  });
  await refresh();
  await previewAsset(result.path);
  logAction(`Imported ${file.name} as ${result.urn}.`);
}

async function runAction(button, action) {
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Working...";
  try {
    await action();
  } catch (error) {
    elements.previewTitle.textContent = "Error";
    elements.previewBody.textContent = error.message;
    logAction(`Error: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

for (const input of [
  elements.assetKind,
  elements.assetOwner,
  elements.assetStage,
  elements.assetName,
]) {
  input.addEventListener("input", updateUrnPreview);
}

elements.assetKind.addEventListener("change", loadTemplate);
elements.loadTemplate.addEventListener("click", loadTemplate);
elements.assetForm.addEventListener("submit", createAsset);
elements.importAsset.addEventListener("click", () =>
  runAction(elements.importAsset, importSelectedAsset),
);
elements.initWorkspace.addEventListener("click", () =>
  runAction(elements.initWorkspace, async () => {
    const result = await request("/api/init", { method: "POST", body: "{}" });
    await refresh();
    logAction(`Initialized ${result.workspace}.`);
  }),
);
elements.seedWorkspace.addEventListener("click", () =>
  runAction(elements.seedWorkspace, async () => {
    const result = await request("/api/seed", { method: "POST", body: "{}" });
    await refresh();
    logAction(`Created sample flow: ${result.written.length} files written.`);
  }),
);
elements.refreshWorkspace.addEventListener("click", () =>
  runAction(elements.refreshWorkspace, refresh),
);

loadTemplate();
refresh().catch((error) => {
  elements.previewTitle.textContent = "Startup error";
  elements.previewBody.textContent = error.message;
});
