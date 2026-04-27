const state = {
  assets: [],
};

const templates = {
  tal: {
    kind: "tal",
    owner: "martinyblue",
    stage: "danceoftal",
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
    stage: "danceoftal",
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
    stage: "danceoftal",
    name: "knolet-builder",
    body: {
      tal: "tal/@martinyblue/danceoftal/knolet-architect",
      dances: ["dance/@martinyblue/danceoftal/source-document-parser"],
      model: {
        provider: "opencode",
        modelId: "hy3-preview-free",
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
    stage: "danceoftal",
    name: "document-to-knolet-app",
    body: {
      participants: [
        {
          key: "builder",
          performer: "performer/@martinyblue/danceoftal/knolet-builder",
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
  versionState: document.querySelector("#versionState"),
  githubState: document.querySelector("#githubState"),
  runDiagnostics: document.querySelector("#runDiagnostics"),
  diagnosticsGrid: document.querySelector("#diagnosticsGrid"),
  issueList: document.querySelector("#issueList"),
  diagnosticSummary: document.querySelector("#diagnosticSummary"),
  initWorkspace: document.querySelector("#initWorkspace"),
  seedWorkspace: document.querySelector("#seedWorkspace"),
  refreshWorkspace: document.querySelector("#refreshWorkspace"),
  seedStudio: document.querySelector("#seedStudio"),
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
  studioState: document.querySelector("#studioState"),
  registryKind: document.querySelector("#registryKind"),
  registryQuery: document.querySelector("#registryQuery"),
  searchRegistry: document.querySelector("#searchRegistry"),
  registryResults: document.querySelector("#registryResults"),
  installUrn: document.querySelector("#installUrn"),
  installAsset: document.querySelector("#installAsset"),
  githubSource: document.querySelector("#githubSource"),
  addGithubDance: document.querySelector("#addGithubDance"),
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
    ? "작업공간 준비됨"
    : "작업공간 없음";
  elements.assetCount.textContent = `${status.assetCount}개 부품`;
  if (status.officialAssets) {
    elements.assetCount.textContent = `${status.assetCount}개 부품 / 공식형 ${status.officialAssets}개`;
  }
}

function serviceCard({ title, ok, state = ok ? "ok" : "error", detail }) {
  return `
    <article class="status-card" data-state="${state}">
      <span>${title}</span>
      <strong>${ok ? "정상" : "확인 필요"}</strong>
      <p>${detail}</p>
    </article>
  `;
}

function renderDiagnostics(data) {
  elements.versionState.textContent = `v${data.version}`;
  elements.githubState.textContent = data.git.syncedWithOrigin
    ? `GitHub 반영됨 ${data.git.shortHead || ""}`
    : "GitHub 확인 필요";

  const studioWorkspace = data.workspace.studioWorkspace;
  const canvasText = studioWorkspace
    ? `canvas: Performer ${studioWorkspace.performerCount}개, Act ${studioWorkspace.actCount}개`
    : "canvas 정보 없음";
  const opencodeDetail = data.services.opencode.ok
    ? "기본 URL과 화면 파일이 열립니다."
    : "서버가 꺼졌거나 오래된 session URL을 보고 있습니다.";
  const gitDetail = data.git.clean && data.git.syncedWithOrigin
    ? `${data.git.branch} / ${data.git.shortHead} / GitHub 반영 완료`
    : `${data.git.changedFiles.length}개 변경, push 상태 확인 필요`;

  elements.diagnosticsGrid.innerHTML = [
    serviceCard({
      title: "Manager",
      ok: data.services.manager.ok,
      detail: `부품 ${data.workspace.assetCount}개 / 공식형 ${data.workspace.officialAssets}개`,
    }),
    serviceCard({
      title: "DOT Studio",
      ok: data.services.studio.ok,
      detail: data.services.studio.ok ? canvasText : data.services.studio.error || data.services.studio.message,
    }),
    serviceCard({
      title: "OpenCode",
      ok: data.services.opencode.ok && data.services.opencodeChunk.ok,
      detail: opencodeDetail,
    }),
    serviceCard({
      title: "GitHub",
      ok: data.git.clean && data.git.syncedWithOrigin,
      state: data.git.clean && data.git.syncedWithOrigin ? "ok" : "warning",
      detail: gitDetail,
    }),
  ].join("");

  elements.issueList.innerHTML = "";
  if (!data.issues.length) {
    const item = document.createElement("li");
    item.textContent = "지금은 바로 사용 가능한 상태입니다.";
    elements.issueList.append(item);
  } else {
    for (const issue of data.issues) {
      const item = document.createElement("li");
      item.dataset.level = issue.level;
      item.innerHTML = `<strong>${issue.title}</strong><span>${issue.detail}</span>`;
      elements.issueList.append(item);
    }
  }

  elements.diagnosticSummary.textContent = data.ready
    ? "전체 상태가 정상입니다. DOT Studio에서 canvas를 보고 OpenCode 실행 테스트를 진행해도 됩니다."
    : "확인할 일이 있습니다. 위 목록의 항목부터 처리하면 됩니다.";
}

function renderCanvas(assets) {
  const assetSet = new Set(assets.map((asset) => asset.urn));
  const checks = {
    tal:
      assetSet.has("tal/@martinyblue/local/knolet-architect") ||
      assetSet.has("tal/@martinyblue/knolet/knolet-architect") ||
      assetSet.has("tal/@martinyblue/danceoftal/knolet-architect"),
    dance:
      assetSet.has("dance/@martinyblue/local/source-document-parser") ||
      assetSet.has("dance/@martinyblue/knolet/source-document-parser") ||
      assetSet.has("dance/@martinyblue/danceoftal/source-document-parser"),
    performer:
      assetSet.has("performer/@martinyblue/local/knolet-builder") ||
      assetSet.has("performer/@martinyblue/knolet/knolet-builder") ||
      assetSet.has("performer/@martinyblue/danceoftal/knolet-builder"),
    act:
      assetSet.has("act/@martinyblue/local/document-to-knolet-app") ||
      assetSet.has("act/@martinyblue/knolet/document-to-knolet-app") ||
      assetSet.has("act/@martinyblue/danceoftal/document-to-knolet-app"),
  };

  for (const node of elements.workflowCanvas.querySelectorAll(".canvas-node")) {
    const helper = node.querySelector("small");
    helper.dataset.baseText ||= helper.textContent;
    const kind = [...node.classList]
      .find((className) => className.startsWith("canvas-node--"))
      ?.replace("canvas-node--", "");
    node.dataset.ready = checks[kind] ? "true" : "false";
    helper.textContent = checks[kind] ? helper.dataset.baseText : `아직 없음: ${helper.dataset.baseText}`;
  }
}

function renderRegistryResults(results) {
  elements.registryResults.innerHTML = "";
  const items = Array.isArray(results) ? results : results.items || results.results || [];
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "검색 결과가 없습니다. 다른 단어나 kind로 다시 검색하세요.";
    elements.registryResults.append(empty);
    return;
  }

  for (const item of items) {
    const urn = item.urn || item.id || item.name;
    const row = document.createElement("button");
    row.className = "asset-row";
    row.type = "button";
    row.innerHTML = `<strong>${urn}</strong><span>${item.description || item.summary || "설명 없음"}</span>`;
    row.addEventListener("click", () => {
      elements.installUrn.value = urn;
      logAction(`설치할 URN을 선택했습니다: ${urn}`);
    });
    elements.registryResults.append(row);
  }
}

function renderAssets(assets) {
  state.assets = assets;
  elements.assetList.innerHTML = "";

  if (!assets.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "아직 만든 부품이 없습니다. 왼쪽의 1번, 2번 버튼을 눌러 시작하세요.";
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
  logAction(`화면을 새로 불러왔습니다. 부품 ${status.assetCount}개, 공식형 ${status.officialAssets || 0}개.`);
}

async function runDiagnostics() {
  const data = await request("/api/diagnostics");
  renderDiagnostics(data);
  logAction(`상태 진단 완료: v${data.version}, 이슈 ${data.issues.length}개.`);
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
  logAction(`저장 완료: ${result.urn}`);
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
  logAction(`파일 가져오기 완료: ${file.name}`);
}

async function seedStudioCanvas() {
  const result = await request("/api/studio/seed", { method: "POST", body: "{}" });
  await refresh();
  elements.studioState.textContent = "DOT Studio 캔버스에 Knolet 예시가 배치됨";
  logAction(`DOT Studio 캔버스를 준비했습니다. workspace id: ${result.workspace.id || "updated"}`);
}

async function checkStudioStatus() {
  const result = await request("/api/studio/status");
  const count = Array.isArray(result.workspaces) ? result.workspaces.length : 0;
  elements.studioState.textContent = `연결됨: ${result.health.project || "DOT Studio"} / workspace ${count}개`;
  logAction("DOT Studio 연결 상태를 확인했습니다.");
}

async function searchRegistry() {
  const query = elements.registryQuery.value.trim();
  if (!query) {
    throw new Error("검색할 단어를 입력하세요.");
  }
  const kind = elements.registryKind.value;
  const result = await request(`/api/dot/search?q=${encodeURIComponent(query)}&kind=${encodeURIComponent(kind)}`);
  renderRegistryResults(result);
  logAction(`Registry 검색 완료: ${query}`);
}

async function installAsset() {
  const urn = elements.installUrn.value.trim();
  if (!urn) {
    throw new Error("설치할 URN을 입력하거나 검색 결과를 선택하세요.");
  }
  await request("/api/dot/install", {
    method: "POST",
    body: JSON.stringify({ urn, scope: "stage" }),
  });
  await refresh();
  logAction(`Registry asset 설치 요청 완료: ${urn}`);
}

async function addGithubDance() {
  const source = elements.githubSource.value.trim();
  if (!source) {
    throw new Error("GitHub 주소 또는 owner/repo/path를 입력하세요.");
  }
  await request("/api/dot/add", {
    method: "POST",
    body: JSON.stringify({ source, scope: "stage" }),
  });
  await refresh();
  logAction(`GitHub Dance 추가 요청 완료: ${source}`);
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
    logAction(`${result.workspace} 작업공간을 준비했습니다.`);
  }),
);
elements.seedWorkspace.addEventListener("click", () =>
  runAction(elements.seedWorkspace, async () => {
    const result = await request("/api/seed", { method: "POST", body: "{}" });
    await refresh();
    logAction(`Knolet 예시를 만들었습니다. ${result.written.length}개 파일 저장.`);
  }),
);
elements.refreshWorkspace.addEventListener("click", () =>
  runAction(elements.refreshWorkspace, refresh),
);
elements.runDiagnostics.addEventListener("click", () =>
  runAction(elements.runDiagnostics, runDiagnostics),
);
elements.seedStudio.addEventListener("click", () =>
  runAction(elements.seedStudio, seedStudioCanvas),
);
elements.searchRegistry.addEventListener("click", () =>
  runAction(elements.searchRegistry, searchRegistry),
);
elements.installAsset.addEventListener("click", () =>
  runAction(elements.installAsset, installAsset),
);
elements.addGithubDance.addEventListener("click", () =>
  runAction(elements.addGithubDance, addGithubDance),
);

loadTemplate();
refresh().catch((error) => {
  elements.previewTitle.textContent = "Startup error";
  elements.previewBody.textContent = error.message;
});
checkStudioStatus().catch(() => {
  elements.studioState.textContent = "DOT Studio 연결 대기 중";
});
runDiagnostics().catch((error) => {
  elements.diagnosticSummary.textContent = error.message;
});
