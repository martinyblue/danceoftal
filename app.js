const state = {
  assets: [],
  currentRun: null,
  lastImportPreview: null,
  bindingDraft: null,
  lastRuntimePlan: null,
  lastGraphPreview: null,
  lastLibraryPackage: null,
  lastLibraryInstallPlan: null,
  lastLibraryInstallExecution: null,
  lastLibraryInventory: null,
  lastProductBackendReadiness: null,
  librarySourceBindings: {},
  selectedGraphNodeId: "",
  graphLayout: null,
  graphLayoutDirty: false,
  graphLayoutDrag: null,
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
  readinessChecklist: document.querySelector("#readinessChecklist"),
  studioGuide: document.querySelector("#studioGuide"),
  opencodeRecovery: document.querySelector("#opencodeRecovery"),
  recheckOpenCode: document.querySelector("#recheckOpenCode"),
  toggleOpenCodeGuide: document.querySelector("#toggleOpenCodeGuide"),
  openCodeGuide: document.querySelector("#openCodeGuide"),
  refreshLauncherHandoff: document.querySelector("#refreshLauncherHandoff"),
  launcherHandoff: document.querySelector("#launcherHandoff"),
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
  refreshWorkflowPlan: document.querySelector("#refreshWorkflowPlan"),
  workflowBlueprint: document.querySelector("#workflowBlueprint"),
  workflowPrompt: document.querySelector("#workflowPrompt"),
  refreshImportPreview: document.querySelector("#refreshImportPreview"),
  saveKnoletSpec: document.querySelector("#saveKnoletSpec"),
  knoletSaveTarget: document.querySelector("#knoletSaveTarget"),
  importPreview: document.querySelector("#importPreview"),
  refreshRuntimePlan: document.querySelector("#refreshRuntimePlan"),
  saveRuntimePlan: document.querySelector("#saveRuntimePlan"),
  runtimePlanPreview: document.querySelector("#runtimePlanPreview"),
  refreshGraphPreview: document.querySelector("#refreshGraphPreview"),
  saveGraphModel: document.querySelector("#saveGraphModel"),
  saveGraphLayout: document.querySelector("#saveGraphLayout"),
  resetGraphLayout: document.querySelector("#resetGraphLayout"),
  graphPreview: document.querySelector("#graphPreview"),
  refreshLibraryPackage: document.querySelector("#refreshLibraryPackage"),
  saveLibraryPackage: document.querySelector("#saveLibraryPackage"),
  libraryPackagePreview: document.querySelector("#libraryPackagePreview"),
  refreshLibraryInstallPlan: document.querySelector("#refreshLibraryInstallPlan"),
  saveLibraryInstallPlan: document.querySelector("#saveLibraryInstallPlan"),
  libraryInstallPlanPreview: document.querySelector("#libraryInstallPlanPreview"),
  refreshLibraryInstallExecution: document.querySelector("#refreshLibraryInstallExecution"),
  executeLibraryInstall: document.querySelector("#executeLibraryInstall"),
  libraryInstallExecutionPreview: document.querySelector("#libraryInstallExecutionPreview"),
  refreshLibraryInventory: document.querySelector("#refreshLibraryInventory"),
  libraryInventory: document.querySelector("#libraryInventory"),
  refreshProductBackendReadiness: document.querySelector("#refreshProductBackendReadiness"),
  productBackendReadiness: document.querySelector("#productBackendReadiness"),
  refreshRuns: document.querySelector("#refreshRuns"),
  runForm: document.querySelector("#runForm"),
  runTitle: document.querySelector("#runTitle"),
  runTargetUser: document.querySelector("#runTargetUser"),
  runSourceDocument: document.querySelector("#runSourceDocument"),
  runRuntimeConstraints: document.querySelector("#runRuntimeConstraints"),
  runList: document.querySelector("#runList"),
  runOutputTitle: document.querySelector("#runOutputTitle"),
  saveRunOutputs: document.querySelector("#saveRunOutputs"),
  reviewRunOutputs: document.querySelector("#reviewRunOutputs"),
  exportRunPackage: document.querySelector("#exportRunPackage"),
  runReview: document.querySelector("#runReview"),
  exportPreview: document.querySelector("#exportPreview"),
  outputKnowledge: document.querySelector("#outputKnowledge"),
  outputSpec: document.querySelector("#outputSpec"),
  outputRuntime: document.querySelector("#outputRuntime"),
  outputVersioning: document.querySelector("#outputVersioning"),
  outputChecklist: document.querySelector("#outputChecklist"),
  studioState: document.querySelector("#studioState"),
  registryKind: document.querySelector("#registryKind"),
  registryQuery: document.querySelector("#registryQuery"),
  searchRegistry: document.querySelector("#searchRegistry"),
  registryResults: document.querySelector("#registryResults"),
  installUrn: document.querySelector("#installUrn"),
  checkInstall: document.querySelector("#checkInstall"),
  installAsset: document.querySelector("#installAsset"),
  installResult: document.querySelector("#installResult"),
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
    const error = new Error(payload.error || "Request failed");
    error.payload = payload;
    throw error;
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) {
    return "";
  }
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }
  return `${minutes}분`;
}

function slugInput(value, fallback = "source") {
  return String(value || fallback)
    .trim()
    .replace(/^@/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || fallback;
}

function renderReadiness(checks) {
  elements.readinessChecklist.innerHTML = "";
  for (const check of checks || []) {
    const item = document.createElement("li");
    item.dataset.ready = check.ok ? "true" : "false";
    item.innerHTML = `<strong>${check.label}</strong><span>${check.detail}</span>`;
    elements.readinessChecklist.append(item);
  }
}

function renderStudioGuide(guide) {
  elements.studioGuide.innerHTML = "";
  if (!guide?.available) {
    elements.studioGuide.innerHTML = `
      <p class="empty">DOT Studio canvas를 아직 읽지 못했습니다. Studio를 켠 뒤 상태를 다시 확인하세요.</p>
    `;
    return;
  }

  const performerItems = guide.performers.length
    ? guide.performers
        .map(
          (performer) => `
            <li>
              <strong>${performer.name}</strong>
              <span>${performer.talCount}개 Tal + ${performer.danceCount}개 Dance가 연결된 실행 에이전트입니다.</span>
            </li>
          `,
        )
        .join("")
    : `<li><strong>Performer 없음</strong><span>Manager의 Studio 캔버스 배치를 먼저 누르세요.</span></li>`;

  const actItems = guide.acts.length
    ? guide.acts
        .map(
          (act) => `
            <li>
              <strong>${act.name}</strong>
              <span>${act.participantNames.join(", ") || "Performer"}를 사용하는 workflow입니다.</span>
            </li>
          `,
        )
        .join("")
    : `<li><strong>Act 없음</strong><span>workflow canvas 항목이 아직 없습니다.</span></li>`;

  const stepItems = guide.steps.map((step) => `<li>${step}</li>`).join("");
  elements.studioGuide.innerHTML = `
    <div class="guide-columns">
      <div>
        <h3>canvas에서 보이는 것</h3>
        <ul class="guide-list">${performerItems}${actItems}</ul>
      </div>
      <div>
        <h3>DOT Studio에서 누를 순서</h3>
        <ol class="numbered-guide">${stepItems}</ol>
      </div>
    </div>
  `;
}

function renderOpenCodeRecovery(data) {
  const opencodeOk = data.services.opencode.ok && data.services.opencodeChunk.ok;
  elements.opencodeRecovery.dataset.state = opencodeOk ? "ok" : "warning";
  elements.opencodeRecovery.querySelector("strong").textContent = opencodeOk
    ? "OpenCode 연결됨"
    : "OpenCode 확인 필요";
  elements.opencodeRecovery.querySelector("p").textContent = opencodeOk
    ? "기본 URL과 화면 파일이 정상으로 열립니다."
    : "기본 URL을 다시 열고, 상태 재확인 후에도 실패하면 session URL 안내를 확인하세요.";
}

function renderLauncherHandoff(handoff) {
  const lifecycle = handoff.lifecycle || {};
  const lifecycleDetail =
    lifecycle.mode === "automatic-shutdown"
      ? `${lifecycle.label} / 약 ${formatDuration(lifecycle.remainingMs)} 남음`
      : lifecycle.label || "수동 실행 중";
  const boundary = handoff.commercialBoundary || {};
  const boundaryDetail = boundary.modeLabel
    ? `${boundary.modeLabel} / ${boundary.status}`
    : "";
  const serviceCards = (handoff.services || [])
    .map(
      (service) => {
        const port = service.portDetail;
        const processes = port?.processes?.length
          ? port.processes
              .map((process) => `${process.command} pid ${process.pid} (${process.user})`)
              .join(", ")
          : service.port
            ? "LISTEN 없음"
            : "포트 없음";
        const urlIsPage = service.url && !service.url.startsWith("#");
        const bridge = service.bridge
          ? `<p class="launcher-bridge" data-state="${service.bridge.ok ? "ok" : "warning"}">Studio bridge: ${escapeHtml(service.bridge.ok ? "연결됨" : service.bridge.message)}</p>`
          : "";
        return `
        <article class="launcher-service" data-state="${service.state}">
          <div class="launcher-service__head">
            <span>${escapeHtml(service.title)}</span>
            <strong>${escapeHtml(service.status)}</strong>
          </div>
          <p>${escapeHtml(service.detail)}</p>
          ${bridge}
          <dl>
            <div><dt>URL</dt><dd>${escapeHtml(service.url || "없음")}</dd></div>
            <div><dt>Port</dt><dd>${service.port ? `${service.port} / ${escapeHtml(processes)}` : "해당 없음"}</dd></div>
            <div><dt>Restart</dt><dd>${service.canRestart ? "가능" : escapeHtml(service.restartReason)}</dd></div>
          </dl>
          <div class="launcher-actions">
            ${
              service.url
                ? `<a class="link-button" href="${escapeHtml(service.url)}" ${
                    urlIsPage ? 'target="_blank" rel="noreferrer"' : ""
                  }>${service.key === "opencode" ? "OpenCode 기본 URL 열기" : service.key === "studio" ? "DOT Studio 열기" : "열기"}</a>`
                : ""
            }
            <button class="secondary" type="button" data-launcher-action="recheck">상태 재확인</button>
            <button class="secondary" type="button" data-copy-command="${escapeHtml(service.command)}">수동 실행 명령 복사</button>
          </div>
          <details>
            <summary>로그/명령 보기</summary>
            <code>${escapeHtml(service.logCommand)}</code>
            <code>${escapeHtml(service.command)}</code>
          </details>
        </article>
      `;
      },
    )
    .join("");
  const ports = (handoff.ports || [])
    .map((port) => {
      const processes = port.processes?.length
        ? port.processes.map((process) => `${process.command} pid ${process.pid}`).join(", ")
        : port.error || "대기 중";
      return `
        <li data-ready="${port.listening ? "true" : "false"}">
          <strong>${port.port} / ${escapeHtml(port.service)}</strong>
          <span>${port.listening ? escapeHtml(processes) : "LISTEN 없음"}</span>
        </li>
      `;
    })
    .join("");
  const recoveries = (handoff.recoveryFlows || [])
    .map(
      (flow) => `
        <article class="recovery-card" data-state="${flow.state}">
          <strong>${escapeHtml(flow.title)}</strong>
          <p>${escapeHtml(flow.detail)}</p>
          <a class="link-button" href="${escapeHtml(flow.url)}" ${
            flow.url?.startsWith("#") ? "" : 'target="_blank" rel="noreferrer"'
          }>${escapeHtml(flow.action)}</a>
        </article>
      `,
    )
    .join("");
  const issues = handoff.issues?.length
    ? handoff.issues.map((issue) => `<li>${escapeHtml(issue.title)}: ${escapeHtml(issue.detail)}</li>`).join("")
    : "<li>통합 런처 기준으로 바로 진행 가능합니다.</li>";
  elements.launcherHandoff.dataset.ready = handoff.services?.every((service) => service.ok) ? "true" : "false";
  elements.launcherHandoff.innerHTML = `
    <div class="launcher-summary">
      <strong>${escapeHtml(handoff.title)}</strong>
      <p>${escapeHtml(handoff.objective)}</p>
      <span>${escapeHtml(lifecycleDetail)}</span>
      ${boundaryDetail ? `<span>${escapeHtml(boundaryDetail)}</span>` : ""}
    </div>
    <div class="launcher-services">${serviceCards}</div>
    <div class="launcher-grid launcher-grid--ops">
      <div>
        <h3>포트 점검</h3>
        <ul class="launcher-port-list">${ports}</ul>
      </div>
      <div>
        <h3>확인할 일</h3>
        <ul>${issues}</ul>
      </div>
    </div>
    <div class="launcher-recovery">${recoveries}</div>
  `;

  for (const button of elements.launcherHandoff.querySelectorAll("[data-copy-command]")) {
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copyCommand || "");
        logAction(`명령을 복사했습니다: ${button.dataset.copyCommand || ""}`);
      } catch (error) {
        elements.previewTitle.textContent = "Command copy";
        elements.previewBody.textContent = button.dataset.copyCommand || "";
        logAction(`클립보드 복사 대신 미리보기에 명령을 표시했습니다: ${error.message}`);
      }
    });
  }
  for (const button of elements.launcherHandoff.querySelectorAll("[data-launcher-action='recheck']")) {
    button.addEventListener("click", () => runAction(button, loadLauncherHandoff));
  }
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

  renderReadiness(data.readinessChecks);
  renderStudioGuide(data.studioGuide);
  renderOpenCodeRecovery(data);
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

function renderWorkflowBlueprint(workflow) {
  const phaseItems = workflow.phases
    .map(
      (phase) => `
        <article class="workflow-phase" data-ready="${phase.ready ? "true" : "false"}">
          <span>${phase.ready ? "준비됨" : "확인 필요"}</span>
          <strong>${phase.title}</strong>
          <p>${phase.operatorAction}</p>
          <dl>
            <div>
              <dt>입력</dt>
              <dd>${phase.input.join(", ")}</dd>
            </div>
            <div>
              <dt>산출물</dt>
              <dd>${phase.output.join(", ")}</dd>
            </div>
            <div>
              <dt>검수 기준</dt>
              <dd>${phase.acceptance}</dd>
            </div>
          </dl>
        </article>
      `,
    )
    .join("");

  elements.workflowBlueprint.innerHTML = `
    <div class="workflow-blueprint__summary">
      <strong>${workflow.title}</strong>
      <p>${workflow.summary}</p>
    </div>
    <div class="workflow-phases">${phaseItems}</div>
  `;
  elements.workflowPrompt.textContent = workflow.handoffPrompt;
}

function diagnosticItems(items) {
  if (!items?.length) {
    return `<li data-level="ok"><strong>없음</strong><span>이 수준의 diagnostics가 없습니다.</span></li>`;
  }
  return items
    .map(
      (item) => `
        <li data-level="${escapeHtml(item.level || "warning")}">
          <strong>${escapeHtml(item.code || "diagnostic")}</strong>
          <span>${escapeHtml(item.humanMessage || item.message || "")}</span>
          <small>${escapeHtml(item.nextAction || "")}</small>
          ${item.path ? `<code>${escapeHtml(item.path)}</code>` : ""}
        </li>
      `,
    )
    .join("");
}

function assetGroup(title, assets) {
  const rows = (assets || [])
    .map(
      (asset) => `
        <li>
          <strong>${escapeHtml(asset.urn)}</strong>
          <span>${escapeHtml(asset.path)}</span>
        </li>
      `,
    )
    .join("");
  return `
    <article class="import-asset-group">
      <strong>${escapeHtml(title)}</strong>
      <ul>${rows || "<li><span>가져온 asset 없음</span></li>"}</ul>
    </article>
  `;
}

function bindingDraftFromSpec(spec) {
  const skillBindings = {};
  for (const skill of spec?.skills || []) {
    skillBindings[skill.id] = Array.isArray(skill.binds_to) ? skill.binds_to : [];
  }
  return {
    knowledgeSources: spec?.knowledge?.sources || [],
    skillBindings,
  };
}

function bindingPayload() {
  return state.bindingDraft
    ? {
        knowledgeSources: state.bindingDraft.knowledgeSources,
        skillBindings: state.bindingDraft.skillBindings,
      }
    : {};
}

function libraryInstallPayload() {
  return {
    ...bindingPayload(),
    sourceBindings: state.librarySourceBindings,
  };
}

function sourceOption(source, selectedIds) {
  const selected = selectedIds.includes(source.id) ? "selected" : "";
  return `<option value="${escapeHtml(source.id)}" ${selected}>${escapeHtml(source.label || source.id)}</option>`;
}

function renderBindingEditor(preview) {
  const spec = preview.spec || {};
  const sources = spec.knowledge?.sources || [];
  const skills = spec.skills || [];
  const sourceCards = sources
    .map(
      (source) => `
        <article class="knowledge-source-card">
          <strong>${escapeHtml(source.label || source.id)}</strong>
          <span>${escapeHtml(source.type || "manual_note")} / ${escapeHtml(source.id)}</span>
          ${source.description ? `<p>${escapeHtml(source.description)}</p>` : ""}
        </article>
      `,
    )
    .join("");
  const skillRows = skills
    .map((skill) => {
      const selectedIds = Array.isArray(skill.binds_to) ? skill.binds_to : [];
      const selectedText = selectedIds.length ? selectedIds.join(", ") : "연결 없음";
      return `
        <article class="skill-binding-row">
          <div>
            <strong>${escapeHtml(skill.name || skill.id)}</strong>
            <span>${escapeHtml(skill.id)} / ${escapeHtml(selectedText)}</span>
          </div>
          <select data-binding-select="${escapeHtml(skill.id)}" aria-label="${escapeHtml(skill.id)} KnowledgeSource 선택">
            ${sources.map((source) => sourceOption(source, selectedIds)).join("")}
          </select>
          <button class="secondary" type="button" data-bind-source="${escapeHtml(skill.id)}">선택 source 연결</button>
          <button class="secondary" type="button" data-bind-workspace="${escapeHtml(skill.id)}">workspace_documents 연결</button>
          <button class="secondary" type="button" data-unbind-source="${escapeHtml(skill.id)}">연결 해제</button>
        </article>
      `;
    })
    .join("");

  return `
    <div class="binding-status" data-complete="${preview.summary?.bindingComplete ? "true" : "false"}">
      <strong>${preview.summary?.bindingComplete ? "Knowledge Binding 완료" : "Knowledge Binding 필요"}</strong>
      <span>${preview.summary?.boundSkillCount || 0}/${preview.summary?.skillsCount || 0} SkillBlock 연결됨</span>
    </div>
    <div class="knowledge-source-grid">${sourceCards}</div>
    <div class="knowledge-source-form">
      <label>
        Source ID
        <input id="newKnowledgeSourceId" placeholder="manual_policy_note" autocomplete="off" />
      </label>
      <label>
        Type
        <select id="newKnowledgeSourceType">
          <option value="manual_note">manual_note</option>
          <option value="workspace_document">workspace_document</option>
          <option value="uploaded_file">uploaded_file</option>
          <option value="registry_asset">registry_asset</option>
        </select>
      </label>
      <label>
        Label
        <input id="newKnowledgeSourceLabel" placeholder="Manual policy note" autocomplete="off" />
      </label>
      <button id="addKnowledgeSource" class="secondary" type="button">KnowledgeSource 추가</button>
    </div>
    <div class="skill-binding-list">${skillRows || `<p class="empty">연결할 SkillBlock이 없습니다.</p>`}</div>
  `;
}

function renderImportPreview(preview) {
  state.lastImportPreview = preview;
  state.bindingDraft = bindingDraftFromSpec(preview.spec || {});
  const summary = preview.summary || {};
  const validationState = summary.validationOk ? "ok" : "error";
  const cards = [
    ["Personas", summary.personasCount || 0],
    ["Skills", summary.skillsCount || 0],
    ["Agents", summary.agentsCount || 0],
    ["Workflow", `${summary.workflowNodesCount || 0} nodes / ${summary.workflowEdgesCount || 0} edges`],
    ["Validation", summary.validationOk ? "OK" : "Error"],
  ]
    .map(
      ([label, value]) => `
        <article class="import-summary-card" data-state="${label === "Validation" ? validationState : "ok"}">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `,
    )
    .join("");

  const assetsByKind = preview.assetsByKind || {};
  const assetGroups = ["tal", "dance", "performer", "act"]
    .map((kind) => assetGroup(kind, assetsByKind[kind]))
    .join("");
  const errors = preview.diagnosticsByLevel?.error || [];
  const warnings = preview.diagnosticsByLevel?.warning || [];
  const nextSteps = (preview.nextSteps || [])
    .map(
      (step) => `
        <li data-required="${step.required ? "true" : "false"}">
          <strong>${escapeHtml(step.label)}</strong>
          <span>${escapeHtml(step.detail)}</span>
        </li>
      `,
    )
    .join("");
  const specJson = JSON.stringify(preview.spec || {}, null, 2);

  elements.importPreview.innerHTML = `
    <div class="import-preview__summary">
      <div>
        <strong>${escapeHtml(summary.name || "Imported DOT workspace")}</strong>
        <p>
          ${escapeHtml(summary.workspace || ".dance-of-tal")}에서 KnoletSpec v${escapeHtml(summary.specVersion || "unknown")}로 변환했습니다.
          Diagnostics: error ${summary.errorCount || 0}, warning ${summary.warningCount || 0}.
        </p>
      </div>
      <span class="asset-pill" data-state="${validationState}">${
        summary.validationOk ? "validation ok" : "validation error"
      }</span>
    </div>
    <div class="import-summary-grid">${cards}</div>
    <div class="import-preview__section">
      <h3>Imported assets</h3>
      <div class="import-assets">${assetGroups}</div>
    </div>
    <div class="import-preview__section">
      <h3>Knowledge Binding</h3>
      ${renderBindingEditor(preview)}
    </div>
    <div class="import-preview__section">
      <h3>Diagnostics</h3>
      <div class="diagnostic-columns">
        <div>
          <h4>Error</h4>
          <ul class="import-diagnostics">${diagnosticItems(errors)}</ul>
        </div>
        <div>
          <h4>Warning</h4>
          <ul class="import-diagnostics">${diagnosticItems(warnings)}</ul>
        </div>
      </div>
    </div>
    <div class="import-preview__section">
      <h3>0.3.3 Knowledge Binding에서 채울 항목</h3>
      <ul class="next-step-list">${nextSteps}</ul>
    </div>
    <details class="spec-preview">
      <summary>KnoletSpec JSON 전체 보기</summary>
      <pre><code>${escapeHtml(specJson)}</code></pre>
    </details>
  `;
  attachImportPreviewEvents();
}

async function previewWithBindingDraft() {
  const preview = await request("/api/knolet/import/dot", {
    method: "POST",
    body: JSON.stringify(bindingPayload()),
  });
  renderImportPreview(preview);
  logAction(
    `Knowledge Binding preview 갱신: ${preview.summary?.boundSkillCount || 0}/${preview.summary?.skillsCount || 0} SkillBlock 연결.`,
  );
}

function attachImportPreviewEvents() {
  for (const button of elements.importPreview.querySelectorAll("[data-bind-workspace]")) {
    button.addEventListener("click", () =>
      runAction(button, async () => {
        const skillId = button.dataset.bindWorkspace;
        state.bindingDraft ||= bindingDraftFromSpec(state.lastImportPreview?.spec || {});
        state.bindingDraft.skillBindings[skillId] = ["workspace_documents"];
        await previewWithBindingDraft();
      }),
    );
  }
  for (const button of elements.importPreview.querySelectorAll("[data-bind-source]")) {
    button.addEventListener("click", () =>
      runAction(button, async () => {
        const skillId = button.dataset.bindSource;
        const select = elements.importPreview.querySelector(`[data-binding-select="${CSS.escape(skillId)}"]`);
        const sourceId = select?.value;
        if (!sourceId) {
          throw new Error("연결할 KnowledgeSource를 먼저 선택하세요.");
        }
        state.bindingDraft ||= bindingDraftFromSpec(state.lastImportPreview?.spec || {});
        state.bindingDraft.skillBindings[skillId] = [sourceId];
        await previewWithBindingDraft();
      }),
    );
  }
  for (const button of elements.importPreview.querySelectorAll("[data-unbind-source]")) {
    button.addEventListener("click", () =>
      runAction(button, async () => {
        const skillId = button.dataset.unbindSource;
        state.bindingDraft ||= bindingDraftFromSpec(state.lastImportPreview?.spec || {});
        state.bindingDraft.skillBindings[skillId] = [];
        await previewWithBindingDraft();
      }),
    );
  }
  const addButton = elements.importPreview.querySelector("#addKnowledgeSource");
  if (addButton) {
    addButton.addEventListener("click", () =>
      runAction(addButton, async () => {
        const idInput = elements.importPreview.querySelector("#newKnowledgeSourceId");
        const typeInput = elements.importPreview.querySelector("#newKnowledgeSourceType");
        const labelInput = elements.importPreview.querySelector("#newKnowledgeSourceLabel");
        const id = slugInput(idInput?.value, "manual_note");
        state.bindingDraft ||= bindingDraftFromSpec(state.lastImportPreview?.spec || {});
        state.bindingDraft.knowledgeSources = [
          ...(state.bindingDraft.knowledgeSources || []).filter((source) => source.id !== id),
          {
            id,
            type: typeInput?.value || "manual_note",
            label: labelInput?.value || id,
            required: false,
          },
        ];
        await previewWithBindingDraft();
      }),
    );
  }
}

function renderRuntimeParticipant(participant) {
  const skills = (participant.skills || [])
    .map((skill) => {
      const sources = (skill.knowledge_sources || []).map((source) => source.label || source.id).join(", ") || "KnowledgeSource 없음";
      return `<li><strong>${escapeHtml(skill.name || skill.id)}</strong><span>${escapeHtml(sources)}</span></li>`;
    })
    .join("");
  return `
    <article class="runtime-participant">
      <div>
        <strong>${escapeHtml(participant.id)}</strong>
        <span>${escapeHtml(participant.persona?.name || "Persona 없음")} / ${escapeHtml(participant.persona?.role || "")}</span>
      </div>
      <ul>${skills || "<li><span>실행할 SkillBlock 없음</span></li>"}</ul>
    </article>
  `;
}

function renderRuntimePlanPreview(payload) {
  state.lastRuntimePlan = payload;
  const plan = payload.plan || {};
  const summary = plan.summary || {};
  const statusState = summary.ready ? "ok" : "error";
  const cards = [
    ["Participants", summary.participantsCount || 0],
    ["Steps", summary.stepsCount || 0],
    ["Edges", summary.edgesCount || 0],
    ["Diagnostics", `${summary.errorCount || 0} error / ${summary.warningCount || 0} warning`],
    ["Status", plan.status || "unknown"],
  ]
    .map(
      ([label, value]) => `
        <article class="import-summary-card" data-state="${label === "Status" ? statusState : "ok"}">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `,
    )
    .join("");
  const participants = (plan.participants || []).map(renderRuntimeParticipant).join("");
  const edges = (plan.workflow?.edges || [])
    .map(
      (edge) => `
        <li>
          <strong>${escapeHtml(edge.from)} -> ${escapeHtml(edge.to)}</strong>
          <span>${escapeHtml(edge.direction || "one-way")}</span>
        </li>
      `,
    )
    .join("");
  const steps = (plan.workflow?.steps || [])
    .map(
      (step) => `
        <li>
          <strong>${escapeHtml(step.id)}</strong>
          <span>${escapeHtml(step.type)} ${escapeHtml(step.agent || `${step.from || ""} -> ${step.to || ""}`)}</span>
        </li>
      `,
    )
    .join("");
  const errors = payload.diagnosticsByLevel?.error || [];
  const warnings = payload.diagnosticsByLevel?.warning || [];
  const planJson = JSON.stringify(plan, null, 2);

  elements.runtimePlanPreview.innerHTML = `
    <div class="import-preview__summary">
      <div>
        <strong>${escapeHtml(plan.source_spec?.name || "Runtime Plan")}</strong>
        <p>KnoletSpec을 실행 직전 workflow plan으로 변환했습니다.</p>
      </div>
      <span class="asset-pill" data-state="${statusState}">${summary.ready ? "ready" : "blocked"}</span>
    </div>
    <div class="import-summary-grid">${cards}</div>
    <div class="runtime-plan-section">
      <h3>Runtime participants</h3>
      <div class="runtime-participants">${participants || `<p class="empty">실행 participant가 없습니다.</p>`}</div>
    </div>
    <div class="runtime-plan-grid">
      <div>
        <h3>Workflow edges</h3>
        <ul class="next-step-list">${edges || `<li data-required="false"><strong>edge 없음</strong><span>단일 agent task로 실행합니다.</span></li>`}</ul>
      </div>
      <div>
        <h3>Execution steps</h3>
        <ul class="next-step-list">${steps || `<li data-required="true"><strong>step 없음</strong><span>실행 계획을 만들 수 없습니다.</span></li>`}</ul>
      </div>
    </div>
    <div class="runtime-plan-section">
      <h3>Runtime diagnostics</h3>
      <div class="diagnostic-columns">
        <div>
          <h4>Error</h4>
          <ul class="import-diagnostics">${diagnosticItems(errors)}</ul>
        </div>
        <div>
          <h4>Warning</h4>
          <ul class="import-diagnostics">${diagnosticItems(warnings)}</ul>
        </div>
      </div>
    </div>
    <details class="spec-preview">
      <summary>Runtime plan JSON 전체 보기</summary>
      <pre><code>${escapeHtml(planJson)}</code></pre>
    </details>
  `;
}

const graphLayers = [
  { key: "source", label: "Source", types: ["source"] },
  { key: "persona-skill", label: "Persona / Skill", types: ["persona", "skill"] },
  { key: "agent", label: "Agent", types: ["agent"] },
  { key: "workflow-step", label: "Workflow Step", types: ["workflow_step"] },
  { key: "output-evaluation", label: "Output / Evaluation", types: ["output", "evaluation"] },
];
const graphTypeOrder = ["source", "persona", "skill", "agent", "workflow_step", "output", "evaluation"];
const graphFlowReversedEdgeTypes = new Set(["binds_to", "uses_persona", "has_skill", "evaluates"]);
const graphLevelRank = { ok: 0, warning: 1, error: 2 };
const graphNodeWidth = 166;
const graphNodeHeight = 74;
const graphLayerGap = 188;
const graphRowGap = 100;
const graphCanvasLeft = 34;
const graphCanvasTop = 62;

function compactGraphText(value, limit = 28) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, Math.max(0, limit - 3))}...`;
}

function strongerGraphLevel(current = "ok", next = "ok") {
  return graphLevelRank[next] > graphLevelRank[current] ? next : current;
}

function clampGraphCoordinate(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function graphLayoutPositions(layout = state.graphLayout) {
  return layout?.positions || {};
}

function graphLayoutPositionCount(layout = state.graphLayout) {
  return Object.keys(graphLayoutPositions(layout)).length;
}

function graphLayoutStatusText() {
  if (state.graphLayoutDirty) {
    return "layout 저장 필요";
  }
  if (state.graphLayout?.exists) {
    return `저장 layout ${graphLayoutPositionCount()}개`;
  }
  return "자동 layout";
}

function updateGraphLayoutStatus() {
  const status = elements.graphPreview.querySelector("#graphLayoutStatus");
  if (!status) {
    return;
  }
  status.dataset.state = state.graphLayoutDirty ? "error" : state.graphLayout?.exists ? "ok" : "idle";
  status.textContent = graphLayoutStatusText();
}

function graphDiagnosticIndex(graph) {
  const nodeIds = new Set((graph.nodes || []).map((node) => node.id));
  const edgeIds = new Set((graph.edges || []).map((edge) => edge.id));
  const nodeLevels = new Map();
  const edgeLevels = new Map();
  const nodeItems = new Map();
  const edgeItems = new Map();

  const addDiagnostic = (items, levels, id, item) => {
    const level = item.level === "error" ? "error" : item.level === "warning" ? "warning" : "ok";
    items.set(id, [...(items.get(id) || []), item]);
    levels.set(id, strongerGraphLevel(levels.get(id) || "ok", level));
  };

  for (const item of graph.diagnostics || []) {
    const diagnosticPath = String(item.path || "");
    if (nodeIds.has(diagnosticPath)) {
      addDiagnostic(nodeItems, nodeLevels, diagnosticPath, item);
    }
    if (edgeIds.has(diagnosticPath)) {
      addDiagnostic(edgeItems, edgeLevels, diagnosticPath, item);
    }
  }

  return { nodeLevels, edgeLevels, nodeItems, edgeItems };
}

function graphLayerIndex(node) {
  const layerIndex = graphLayers.findIndex((layer) => layer.types.includes(node.type));
  return layerIndex >= 0 ? layerIndex : 1;
}

function layoutGraph(graph, savedPositions = {}) {
  const layerNodes = graphLayers.map(() => []);
  for (const node of graph.nodes || []) {
    layerNodes[graphLayerIndex(node)].push(node);
  }
  for (const nodes of layerNodes) {
    nodes.sort((left, right) => {
      const typeDelta = graphTypeOrder.indexOf(left.type) - graphTypeOrder.indexOf(right.type);
      return typeDelta || String(left.label || left.id).localeCompare(String(right.label || right.id));
    });
  }

  const maxRows = Math.max(1, ...layerNodes.map((nodes) => nodes.length));
  const width = graphCanvasLeft * 2 + graphNodeWidth + graphLayerGap * (graphLayers.length - 1);
  const height = Math.max(350, graphCanvasTop + maxRows * graphRowGap + 46);
  const positions = new Map();

  layerNodes.forEach((nodes, layerIndex) => {
    const x = graphCanvasLeft + layerIndex * graphLayerGap;
    const startY = graphCanvasTop + Math.max(0, (maxRows - nodes.length) * graphRowGap) / 2;
    nodes.forEach((node, rowIndex) => {
      const saved = savedPositions[node.id] || {};
      const savedX = Number(saved.x);
      const savedY = Number(saved.y);
      const hasSavedPosition = Number.isFinite(savedX) && Number.isFinite(savedY);
      positions.set(node.id, {
        x: hasSavedPosition ? clampGraphCoordinate(savedX, 18, width - graphNodeWidth - 18) : x,
        y: hasSavedPosition
          ? clampGraphCoordinate(savedY, graphCanvasTop, height - graphNodeHeight - 18)
          : startY + rowIndex * graphRowGap,
        width: graphNodeWidth,
        height: graphNodeHeight,
        layerIndex,
        saved: hasSavedPosition,
      });
    });
  });

  return { width, height, positions, layerNodes };
}

function graphNodeShape(node, position) {
  const { x, y, width, height } = position;
  const cx = x + width / 2;
  const cy = y + height / 2;
  if (node.type === "persona") {
    return `<ellipse class="graph-node-shape" cx="${cx}" cy="${cy}" rx="${width / 2}" ry="${height / 2}" />`;
  }
  if (node.type === "skill") {
    const bevel = 22;
    return `<polygon class="graph-node-shape" points="${x + bevel},${y} ${x + width - bevel},${y} ${x + width},${cy} ${x + width - bevel},${y + height} ${x + bevel},${y + height} ${x},${cy}" />`;
  }
  if (node.type === "workflow_step") {
    return `<polygon class="graph-node-shape" points="${cx},${y} ${x + width},${cy} ${cx},${y + height} ${x},${cy}" />`;
  }
  if (node.type === "evaluation") {
    const cut = 18;
    return `<polygon class="graph-node-shape" points="${x + cut},${y} ${x + width - cut},${y} ${x + width},${y + cut} ${x + width},${y + height - cut} ${x + width - cut},${y + height} ${x + cut},${y + height} ${x},${y + height - cut} ${x},${y + cut}" />`;
  }
  if (node.type === "source") {
    const fold = 15;
    return `<polygon class="graph-node-shape" points="${x},${y} ${x + width - fold},${y} ${x + width},${y + fold} ${x + width},${y + height} ${x},${y + height}" />`;
  }
  return `<rect class="graph-node-shape" x="${x}" y="${y}" width="${width}" height="${height}" rx="8" />`;
}

function renderGraphNode(node, position, selectedNodeId, diagnosticsIndex) {
  const level = diagnosticsIndex.nodeLevels.get(node.id) || "ok";
  const selected = node.id === selectedNodeId ? "true" : "false";
  const centerX = position.x + position.width / 2;
  return `
    <g
      class="graph-svg-node"
      role="button"
      tabindex="0"
      focusable="true"
      aria-pressed="${selected}"
      data-graph-node="${escapeHtml(node.id)}"
      data-type="${escapeHtml(node.type)}"
      data-level="${level}"
      data-selected="${selected}"
      data-layout-x="${position.x}"
      data-layout-y="${position.y}"
      data-layout-saved="${position.saved ? "true" : "false"}"
    >
      <rect class="graph-node-ring" x="${position.x - 6}" y="${position.y - 6}" width="${position.width + 12}" height="${position.height + 12}" rx="12" />
      ${graphNodeShape(node, position)}
      <text class="graph-node-type" x="${centerX}" y="${position.y + 18}">${escapeHtml(node.type)}</text>
      <text class="graph-node-label" x="${centerX}" y="${position.y + 42}">${escapeHtml(compactGraphText(node.label || node.id, 23))}</text>
      <text class="graph-node-id" x="${centerX}" y="${position.y + 60}">${escapeHtml(compactGraphText(node.id, 28))}</text>
    </g>
  `;
}

function graphDisplayEndpoints(edge) {
  if (graphFlowReversedEdgeTypes.has(edge.type)) {
    return { from: edge.to, to: edge.from };
  }
  return { from: edge.from, to: edge.to };
}

function graphEdgeMarker(level) {
  if (level === "error") {
    return "graph-arrow-error";
  }
  if (level === "warning") {
    return "graph-arrow-warning";
  }
  return "graph-arrow";
}

function renderMissingGraphEdge(edge, layout, diagnosticsIndex, edgeIndex) {
  const endpoints = graphDisplayEndpoints(edge);
  const fromPosition = layout.positions.get(endpoints.from);
  const toPosition = layout.positions.get(endpoints.to);
  const anchor = fromPosition || toPosition;
  const fallbackY = layout.height - 34 - (edgeIndex % 3) * 14;
  const startX = anchor
    ? fromPosition
      ? anchor.x + anchor.width
      : Math.max(24, anchor.x - 78)
    : 44 + (edgeIndex % 4) * 164;
  const startY = anchor ? anchor.y + anchor.height / 2 : fallbackY;
  const endX = anchor
    ? fromPosition
      ? Math.min(layout.width - 28, startX + 78)
      : anchor.x
    : Math.min(layout.width - 44, startX + 112);
  const endY = anchor ? startY : fallbackY;
  const level = strongerGraphLevel(diagnosticsIndex.edgeLevels.get(edge.id) || "ok", "error");
  const labelX = (startX + endX) / 2;
  const labelY = startY - 8;
  const labelWidth = Math.min(164, Math.max(74, edge.type.length * 7 + 34));

  return `
    <g class="graph-edge graph-edge--missing" data-graph-edge="${escapeHtml(edge.id)}" data-level="${level}" data-related="false">
      <path class="graph-edge-path" marker-end="url(#${graphEdgeMarker(level)})" d="M ${startX} ${startY} L ${endX} ${endY}" />
      <circle class="graph-missing-endpoint" cx="${endX}" cy="${endY}" r="7" />
      <rect class="graph-edge-label-bg" x="${labelX - labelWidth / 2}" y="${labelY - 14}" width="${labelWidth}" height="20" rx="5" />
      <text class="graph-edge-label" x="${labelX}" y="${labelY}">${escapeHtml(compactGraphText(edge.type, 19))}</text>
    </g>
  `;
}

function renderGraphEdge(edge, layout, diagnosticsIndex, edgeIndex) {
  const endpoints = graphDisplayEndpoints(edge);
  const fromPosition = layout.positions.get(endpoints.from);
  const toPosition = layout.positions.get(endpoints.to);
  if (!fromPosition || !toPosition) {
    return renderMissingGraphEdge(edge, layout, diagnosticsIndex, edgeIndex);
  }

  const level = diagnosticsIndex.edgeLevels.get(edge.id) || "ok";
  const leftToRight = toPosition.x >= fromPosition.x;
  const startX = fromPosition.x + (leftToRight ? fromPosition.width : 0);
  const startY = fromPosition.y + fromPosition.height / 2;
  const endX = toPosition.x + (leftToRight ? 0 : toPosition.width);
  const endY = toPosition.y + toPosition.height / 2;
  const curve = Math.max(52, Math.abs(endX - startX) * 0.42);
  const direction = leftToRight ? 1 : -1;
  const path = `M ${startX} ${startY} C ${startX + curve * direction} ${startY}, ${endX - curve * direction} ${endY}, ${endX} ${endY}`;
  const labelX = (startX + endX) / 2;
  const labelY = (startY + endY) / 2 - 8;
  const labelWidth = Math.min(136, Math.max(64, edge.type.length * 7 + 18));

  return `
    <g class="graph-edge" data-graph-edge="${escapeHtml(edge.id)}" data-level="${level}" data-related="false">
      <path class="graph-edge-path" marker-end="url(#${graphEdgeMarker(level)})" d="${path}" />
      <rect class="graph-edge-label-bg" x="${labelX - labelWidth / 2}" y="${labelY - 14}" width="${labelWidth}" height="20" rx="5" />
      <text class="graph-edge-label" x="${labelX}" y="${labelY}">${escapeHtml(compactGraphText(edge.type, 17))}</text>
    </g>
  `;
}

function renderGraphCanvas(graph, selectedNodeId, diagnosticsIndex, savedPositions = {}) {
  const nodes = graph.nodes || [];
  if (!nodes.length) {
    return `<div class="graph-canvas-shell"><p class="empty">Graph node가 없습니다.</p></div>`;
  }

  const layout = layoutGraph(graph, savedPositions);
  const bands = graphLayers
    .map((layer, index) => {
      const x = graphCanvasLeft + index * graphLayerGap - 12;
      return `
        <g class="graph-layer" data-layer="${escapeHtml(layer.key)}">
          <rect class="graph-layer-band" x="${x}" y="18" width="${graphNodeWidth + 24}" height="${layout.height - 38}" rx="10" />
          <text class="graph-layer-label" x="${x + graphNodeWidth / 2 + 12}" y="39">${escapeHtml(layer.label)}</text>
        </g>
      `;
    })
    .join("");
  const edges = (graph.edges || [])
    .map((edge, index) => renderGraphEdge(edge, layout, diagnosticsIndex, index))
    .join("");
  const renderedNodes = nodes
    .map((node) => renderGraphNode(node, layout.positions.get(node.id), selectedNodeId, diagnosticsIndex))
    .join("");

  return `
    <div class="graph-canvas-shell" data-status="${escapeHtml(graph.status || "unknown")}" data-layout="${graphLayoutPositionCount() ? "saved" : "auto"}">
      <svg class="graph-canvas" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}" role="img" aria-label="${escapeHtml(graph.source_spec?.name || "Knolet graph visualization")}">
        <defs>
          <marker id="graph-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M 0 0 L 8 3 L 0 6 z" fill="#68736d" />
          </marker>
          <marker id="graph-arrow-warning" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M 0 0 L 8 3 L 0 6 z" fill="#a86b12" />
          </marker>
          <marker id="graph-arrow-error" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M 0 0 L 8 3 L 0 6 z" fill="#8e3f32" />
          </marker>
        </defs>
        <rect class="graph-canvas-bg" x="0" y="0" width="${layout.width}" height="${layout.height}" rx="10" />
        <g class="graph-layers">${bands}</g>
        <g class="graph-edges">${edges}</g>
        <g class="graph-nodes">${renderedNodes}</g>
      </svg>
    </div>
  `;
}

function graphNodeButton(node, selectedNodeId, diagnosticsIndex) {
  const selected = node.id === selectedNodeId ? "true" : "false";
  const level = diagnosticsIndex.nodeLevels.get(node.id) || "ok";
  return `
    <button class="graph-node-row" type="button" data-graph-node="${escapeHtml(node.id)}" data-level="${level}" data-selected="${selected}" aria-pressed="${selected}">
      <strong>${escapeHtml(node.label || node.id)}</strong>
      <span>${escapeHtml(node.type)} / ${escapeHtml(node.id)}</span>
    </button>
  `;
}

function graphEdgeDetailItems(edges, emptyText) {
  if (!edges.length) {
    return `<li data-empty="true"><span>${escapeHtml(emptyText)}</span></li>`;
  }
  return edges
    .map(
      (edge) => `
        <li>
          <strong>${escapeHtml(edge.type)}</strong>
          <span>${escapeHtml(edge.from)} -> ${escapeHtml(edge.to)}</span>
        </li>
      `,
    )
    .join("");
}

function renderGraphNodeDetail(
  node,
  diagnosticsIndex = graphDiagnosticIndex({ nodes: [], edges: [], diagnostics: [] }),
  graph = {},
) {
  if (!node) {
    return `<p class="empty">왼쪽에서 graph node를 선택하세요.</p>`;
  }
  const diagnostics = diagnosticsIndex.nodeItems.get(node.id) || [];
  const incomingEdges = (graph.edges || []).filter((edge) => edge.to === node.id);
  const outgoingEdges = (graph.edges || []).filter((edge) => edge.from === node.id);
  const diagnosticList = diagnostics.length
    ? `
      <ul class="graph-node-diagnostics">
        ${diagnostics
          .map(
            (item) => `
              <li data-level="${escapeHtml(item.level || "warning")}">
                <strong>${escapeHtml(item.code || "diagnostic")}</strong>
                <span>${escapeHtml(item.humanMessage || item.message || "")}</span>
              </li>
            `,
          )
          .join("")}
      </ul>
    `
    : `<p class="graph-node-diagnostic-note" data-level="ok">Diagnostics 없음</p>`;
  return `
    <div class="graph-detail-card" data-level="${diagnosticsIndex.nodeLevels.get(node.id) || "ok"}">
      <strong>${escapeHtml(node.label || node.id)}</strong>
      <span>${escapeHtml(node.type)} / ${escapeHtml(node.id)}</span>
      ${diagnosticList}
      <div class="graph-node-edge-grid">
        <div>
          <h4>Incoming edges</h4>
          <ul>${graphEdgeDetailItems(incomingEdges, "들어오는 edge 없음")}</ul>
        </div>
        <div>
          <h4>Outgoing edges</h4>
          <ul>${graphEdgeDetailItems(outgoingEdges, "나가는 edge 없음")}</ul>
        </div>
      </div>
      <pre><code>${escapeHtml(JSON.stringify(node.data || {}, null, 2))}</code></pre>
    </div>
  `;
}

function renderGraphPreview(payload, selectedNodeId = "") {
  state.lastGraphPreview = payload;
  state.graphLayout = payload.layout || state.graphLayout || { exists: false, positions: {} };
  const graph = payload.graph || {};
  const summary = graph.summary || {};
  const statusState = summary.ready ? "ok" : "error";
  const breakdown = summary.typeBreakdown || {};
  const diagnosticsIndex = graphDiagnosticIndex(graph);
  const cards = [
    ["Nodes", summary.nodeCount || 0],
    ["Edges", summary.edgeCount || 0],
    ["Diagnostics", `${summary.errorCount || 0} error / ${summary.warningCount || 0} warning`],
    ["Status", graph.status || "unknown"],
  ]
    .map(
      ([label, value]) => `
        <article class="import-summary-card" data-state="${label === "Status" ? statusState : "ok"}">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `,
    )
    .join("");
  const breakdownItems = Object.entries(breakdown)
    .map(
      ([type, count]) => `
        <li>
          <strong>${escapeHtml(type)}</strong>
          <span>${count}</span>
        </li>
      `,
    )
    .join("");
  const nodes = graph.nodes || [];
  const selectedNode =
    nodes.find((node) => node.id === (selectedNodeId || state.selectedGraphNodeId)) || nodes[0] || null;
  state.selectedGraphNodeId = selectedNode?.id || "";
  const graphCanvas = renderGraphCanvas(graph, state.selectedGraphNodeId, diagnosticsIndex, graphLayoutPositions());
  const edges = (graph.edges || [])
    .map(
      (edge) => `
        <li data-level="${escapeHtml(diagnosticsIndex.edgeLevels.get(edge.id) || "ok")}">
          <strong>${escapeHtml(edge.type)}</strong>
          <span>${escapeHtml(edge.from)} -> ${escapeHtml(edge.to)}</span>
        </li>
      `,
    )
    .join("");
  const errors = payload.diagnosticsByLevel?.error || [];
  const warnings = payload.diagnosticsByLevel?.warning || [];
  const graphJson = JSON.stringify(graph, null, 2);

  elements.graphPreview.innerHTML = `
    <div class="import-preview__summary">
      <div>
        <strong>${escapeHtml(graph.source_spec?.name || "Knolet Graph")}</strong>
        <p>KnoletSpec과 RuntimePlan을 graph model로 변환했습니다.</p>
      </div>
      <span class="asset-pill" data-state="${statusState}">${summary.ready ? "ready" : "blocked"}</span>
    </div>
    <div class="import-summary-grid graph-summary-grid">${cards}</div>
    <div class="graph-visual-section">
      <div class="graph-visual-header">
        <h3>Graph visualization</h3>
        <span id="graphLayoutStatus" class="asset-pill" data-state="${state.graphLayoutDirty ? "error" : state.graphLayout?.exists ? "ok" : "idle"}">${escapeHtml(graphLayoutStatusText())}</span>
      </div>
      ${graphCanvas}
    </div>
    <div class="graph-layout">
      <div>
        <h3>Type breakdown</h3>
        <ul class="graph-breakdown">${breakdownItems}</ul>
        <h3>Nodes</h3>
        <div class="graph-node-list">${nodes.map((node) => graphNodeButton(node, state.selectedGraphNodeId, diagnosticsIndex)).join("")}</div>
      </div>
      <div>
        <h3>Selected node detail</h3>
        <div id="graphNodeDetail">${renderGraphNodeDetail(selectedNode, diagnosticsIndex, graph)}</div>
      </div>
    </div>
    <div class="graph-layout">
      <div>
        <h3>Edges</h3>
        <ul class="next-step-list graph-edge-list">${edges || `<li data-required="true"><strong>edge 없음</strong><span>Graph 연결이 없습니다.</span></li>`}</ul>
      </div>
      <div>
        <h3>Graph diagnostics</h3>
        <div class="diagnostic-columns">
          <div>
            <h4>Error</h4>
            <ul class="import-diagnostics">${diagnosticItems(errors)}</ul>
          </div>
          <div>
            <h4>Warning</h4>
            <ul class="import-diagnostics">${diagnosticItems(warnings)}</ul>
          </div>
        </div>
      </div>
    </div>
    <details class="spec-preview">
      <summary>Knolet graph JSON 전체 보기</summary>
      <pre><code>${escapeHtml(graphJson)}</code></pre>
    </details>
  `;
  attachGraphPreviewEvents();
  if (selectedNode) {
    selectGraphNode(selectedNode.id);
  }
}

function renderLibraryTemplateGroup(title, items) {
  const rows = (items || [])
    .map(
      (item) => `
        <li>
          <strong>${escapeHtml(item.id)}</strong>
          <span>${escapeHtml(item.type || title)}</span>
        </li>
      `,
    )
    .join("");
  return `
    <div>
      <h3>${escapeHtml(title)}</h3>
      <ul class="next-step-list">${rows || `<li data-required="false"><strong>없음</strong><span>템플릿 없음</span></li>`}</ul>
    </div>
  `;
}

function renderLibraryPackagePreview(payload) {
  state.lastLibraryPackage = payload;
  const libraryPackage = payload.package || {};
  const summary = libraryPackage.summary || {};
  const templates = libraryPackage.templates || {};
  const statusState = summary.shareReady ? "ok" : "error";
  const cards = [
    ["Templates", summary.templateCount || 0],
    ["Sources", summary.sourceBindingCount || 0],
    ["Dependencies", summary.dependencyCount || 0],
    ["Diagnostics", `${summary.errorCount || 0} error / ${summary.warningCount || 0} warning`],
    ["Status", libraryPackage.status || "unknown"],
  ]
    .map(
      ([label, value]) => `
        <article class="import-summary-card" data-state="${label === "Status" ? statusState : "ok"}">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `,
    )
    .join("");
  const sourceBindings = (libraryPackage.source_bindings || [])
    .map(
      (source) => `
        <li>
          <strong>${escapeHtml(source.label || source.id)}</strong>
          <span>${escapeHtml(source.type)} / ${escapeHtml(source.pointer?.kind || "binding")}</span>
        </li>
      `,
    )
    .join("");
  const dependencies = libraryPackage.dependencies?.dot_assets || [];
  const dependencyItems = dependencies
    .map(
      (item) => `
        <li>
          <strong>${escapeHtml(item)}</strong>
          <span>DOT asset reference</span>
        </li>
      `,
    )
    .join("");
  const errors = payload.diagnosticsByLevel?.error || [];
  const warnings = payload.diagnosticsByLevel?.warning || [];
  const packageJson = JSON.stringify(libraryPackage, null, 2);

  elements.libraryPackagePreview.innerHTML = `
    <div class="import-preview__summary">
      <div>
        <strong>${escapeHtml(libraryPackage.metadata?.name || "Knolet Library Package")}</strong>
        <p>현재 Knolet 앱 구조를 재사용 가능한 library package로 변환했습니다.</p>
      </div>
      <span class="asset-pill" data-state="${statusState}">${summary.shareReady ? "shareable" : "blocked"}</span>
    </div>
    <div class="import-summary-grid graph-summary-grid">${cards}</div>
    <div class="graph-layout">
      ${renderLibraryTemplateGroup("Persona Templates", templates.persona_templates)}
      ${renderLibraryTemplateGroup("Skill Blocks", templates.skill_blocks)}
    </div>
    <div class="graph-layout">
      ${renderLibraryTemplateGroup("Agent Profiles", templates.agent_profiles)}
      ${renderLibraryTemplateGroup("Workflow Templates", templates.workflow_templates)}
    </div>
    <div class="graph-layout">
      <div>
        <h3>Source bindings</h3>
        <ul class="next-step-list">${sourceBindings || `<li data-required="true"><strong>Source 없음</strong><span>KnowledgeSource binding이 없습니다.</span></li>`}</ul>
      </div>
      <div>
        <h3>DOT dependencies</h3>
        <ul class="next-step-list">${dependencyItems || `<li data-required="false"><strong>Dependency 없음</strong><span>외부 DOT asset 참조가 없습니다.</span></li>`}</ul>
      </div>
    </div>
    <div class="runtime-plan-section">
      <h3>Library diagnostics</h3>
      <div class="diagnostic-columns">
        <div>
          <h4>Error</h4>
          <ul class="import-diagnostics">${diagnosticItems(errors)}</ul>
        </div>
        <div>
          <h4>Warning</h4>
          <ul class="import-diagnostics">${diagnosticItems(warnings)}</ul>
        </div>
      </div>
    </div>
    <details class="spec-preview">
      <summary>Knolet library package JSON 전체 보기</summary>
      <pre><code>${escapeHtml(packageJson)}</code></pre>
    </details>
  `;
}

function renderLibraryInstallPlanPreview(payload) {
  state.lastLibraryInstallPlan = payload;
  const installPlan = payload.installPlan || {};
  const summary = installPlan.summary || {};
  const statusState = summary.ready ? "ok" : "error";
  const cards = [
    ["Template actions", summary.templateActionCount || 0],
    ["Source rebindings", summary.sourceRebindingCount || 0],
    ["Required sources", summary.requiredRebindingCount || 0],
    ["Diagnostics", `${summary.errorCount || 0} error / ${summary.warningCount || 0} warning`],
    ["Status", installPlan.status || "unknown"],
  ]
    .map(
      ([label, value]) => `
        <article class="import-summary-card" data-state="${label === "Status" ? statusState : "ok"}">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `,
    )
    .join("");
  const actions = (installPlan.template_actions || [])
    .map(
      (action) => `
        <li>
          <strong>${escapeHtml(action.template_id)}</strong>
          <span>${escapeHtml(action.template_type)} -> ${escapeHtml(action.target_id)}</span>
        </li>
      `,
    )
    .join("");
  const rebindings = (installPlan.source_rebindings || [])
    .map(
      (source) => `
        <li class="library-rebinding-row" data-required="${source.required ? "true" : "false"}">
          <div>
            <strong>${escapeHtml(source.label || source.source_id)}</strong>
            <span>${escapeHtml(source.type)} / ${escapeHtml(source.status)} / ${escapeHtml(source.pointer_kind)}</span>
          </div>
          <input
            data-library-source-binding="${escapeHtml(source.source_id)}"
            placeholder="target_source_id"
            value="${escapeHtml(state.librarySourceBindings[source.source_id]?.target_source_id || "")}"
            autocomplete="off"
          />
        </li>
      `,
    )
    .join("");
  const errors = payload.diagnosticsByLevel?.error || [];
  const warnings = payload.diagnosticsByLevel?.warning || [];
  const planJson = JSON.stringify(installPlan, null, 2);

  elements.libraryInstallPlanPreview.innerHTML = `
    <div class="import-preview__summary">
      <div>
        <strong>${escapeHtml(installPlan.source_package?.id || "Library Install Plan")}</strong>
        <p>${escapeHtml(installPlan.target_workspace?.owner || "martinyblue")}/${escapeHtml(installPlan.target_workspace?.stage || "local")} workspace에 설치하기 전 검토 plan입니다.</p>
      </div>
      <span class="asset-pill" data-state="${statusState}">${summary.ready ? "ready" : "blocked"}</span>
    </div>
    <div class="import-summary-grid graph-summary-grid">${cards}</div>
    <div class="graph-layout">
      <div>
        <h3>Template actions</h3>
        <ul class="next-step-list">${actions || `<li data-required="true"><strong>Action 없음</strong><span>설치할 템플릿이 없습니다.</span></li>`}</ul>
      </div>
      <div>
        <h3>Source rebindings</h3>
        <ul class="next-step-list">${rebindings || `<li data-required="false"><strong>Rebinding 없음</strong><span>재연결할 KnowledgeSource가 없습니다.</span></li>`}</ul>
      </div>
    </div>
    <div class="runtime-plan-section">
      <h3>Install diagnostics</h3>
      <div class="diagnostic-columns">
        <div>
          <h4>Error</h4>
          <ul class="import-diagnostics">${diagnosticItems(errors)}</ul>
        </div>
        <div>
          <h4>Warning</h4>
          <ul class="import-diagnostics">${diagnosticItems(warnings)}</ul>
        </div>
      </div>
    </div>
    <details class="spec-preview">
      <summary>Knolet library install plan JSON 전체 보기</summary>
      <pre><code>${escapeHtml(planJson)}</code></pre>
    </details>
  `;
  attachLibraryInstallPlanEvents();
}

function attachLibraryInstallPlanEvents() {
  for (const input of elements.libraryInstallPlanPreview.querySelectorAll("[data-library-source-binding]")) {
    input.addEventListener("input", () => {
      const sourceId = input.dataset.librarySourceBinding;
      state.librarySourceBindings[sourceId] = {
        status: input.value.trim() ? "bound" : "needs_binding",
        target_source_id: input.value.trim(),
      };
    });
  }
}

function renderLibraryInstallExecutionPreview(payload) {
  state.lastLibraryInstallExecution = payload;
  const execution = payload.execution || {};
  const summary = execution.summary || {};
  const statusState = summary.ready || execution.status === "installed" ? "ok" : "error";
  const cards = [
    ["Writes", summary.writeCount || 0],
    ["Templates", summary.templateWriteCount || 0],
    ["Sources", summary.sourceBindingWriteCount || 0],
    ["Diagnostics", `${summary.errorCount || 0} error / ${summary.warningCount || 0} warning`],
    ["Status", execution.status || "unknown"],
  ]
    .map(
      ([label, value]) => `
        <article class="import-summary-card" data-state="${label === "Status" ? statusState : "ok"}">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `,
    )
    .join("");
  const writes = (execution.writes || payload.writes || [])
    .map(
      (write) => `
        <li>
          <strong>${escapeHtml(write.kind)}</strong>
          <span>${escapeHtml(write.path)}</span>
        </li>
      `,
    )
    .join("");
  const errors = payload.diagnosticsByLevel?.error || [];
  const warnings = payload.diagnosticsByLevel?.warning || [];
  const executionJson = JSON.stringify(execution, null, 2);

  elements.libraryInstallExecutionPreview.innerHTML = `
    <div class="import-preview__summary">
      <div>
        <strong>${escapeHtml(execution.source_package?.id || "Library Install Execution")}</strong>
        <p>Install plan을 실제 로컬 library record 파일로 쓰기 직전 상태입니다.</p>
      </div>
      <span class="asset-pill" data-state="${statusState}">${execution.status === "installed" ? "installed" : summary.ready ? "ready" : "blocked"}</span>
    </div>
    <div class="import-summary-grid graph-summary-grid">${cards}</div>
    <div class="runtime-plan-section">
      <h3>Write set</h3>
      <ul class="next-step-list">${writes || `<li data-required="true"><strong>Write 없음</strong><span>실행 가능한 설치 파일이 없습니다.</span></li>`}</ul>
    </div>
    <div class="runtime-plan-section">
      <h3>Execution diagnostics</h3>
      <div class="diagnostic-columns">
        <div>
          <h4>Error</h4>
          <ul class="import-diagnostics">${diagnosticItems(errors)}</ul>
        </div>
        <div>
          <h4>Warning</h4>
          <ul class="import-diagnostics">${diagnosticItems(warnings)}</ul>
        </div>
      </div>
    </div>
    <details class="spec-preview">
      <summary>Knolet library install execution JSON 전체 보기</summary>
      <pre><code>${escapeHtml(executionJson)}</code></pre>
    </details>
  `;
}

function renderLibraryInventory(payload) {
  state.lastLibraryInventory = payload;
  const inventory = payload.inventory || {};
  const summary = inventory.summary || {};
  const records = inventory.records || {};
  const statusState = summary.ready ? "ok" : "error";
  const cards = [
    ["Stages", summary.stageCount || 0],
    ["Templates", summary.templateCount || 0],
    ["Sources", summary.sourceBindingCount || 0],
    ["Installs", summary.installationCount || 0],
    ["Diagnostics", `${summary.errorCount || 0} error / ${summary.warningCount || 0} warning`],
  ]
    .map(
      ([label, value]) => `
        <article class="import-summary-card" data-state="${label === "Diagnostics" ? statusState : "ok"}">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `,
    )
    .join("");
  const templates = (records.templates || [])
    .map(
      (record) => `
        <li>
          <strong>${escapeHtml(record.template_id)}</strong>
          <span>${escapeHtml(record.template_type)} / ${escapeHtml(record.path)}</span>
        </li>
      `,
    )
    .join("");
  const sources = (records.source_bindings || [])
    .map(
      (record) => `
        <li data-required="${record.required ? "true" : "false"}">
          <strong>${escapeHtml(record.label || record.source_id)}</strong>
          <span>${escapeHtml(record.status || "unknown")} / ${escapeHtml(record.target_source_id || "unbound")}</span>
        </li>
      `,
    )
    .join("");
  const installations = (records.installations || [])
    .map(
      (record) => `
        <li>
          <strong>${escapeHtml(record.source_package_id || "source package")}</strong>
          <span>${escapeHtml(record.writeCount)} writes / ${escapeHtml(record.path)}</span>
        </li>
      `,
    )
    .join("");
  const errors = payload.diagnosticsByLevel?.error || [];
  const warnings = payload.diagnosticsByLevel?.warning || [];

  elements.libraryInventory.innerHTML = `
    <div class="import-preview__summary">
      <div>
        <strong>${escapeHtml(inventory.root || ".dance-of-tal/library")}</strong>
        <p>설치된 Knolet library record를 읽었습니다.</p>
      </div>
      <span class="asset-pill" data-state="${statusState}">${summary.ready ? "ready" : "check"}</span>
    </div>
    <div class="import-summary-grid graph-summary-grid">${cards}</div>
    <div class="graph-layout">
      <div>
        <h3>Installed templates</h3>
        <ul class="next-step-list">${templates || `<li data-required="false"><strong>Template 없음</strong><span>아직 설치된 library template이 없습니다.</span></li>`}</ul>
      </div>
      <div>
        <h3>Source bindings</h3>
        <ul class="next-step-list">${sources || `<li data-required="false"><strong>Source 없음</strong><span>설치된 source binding이 없습니다.</span></li>`}</ul>
      </div>
    </div>
    <div class="runtime-plan-section">
      <h3>Installations</h3>
      <ul class="next-step-list">${installations || `<li data-required="false"><strong>Installation 없음</strong><span>설치 manifest가 없습니다.</span></li>`}</ul>
    </div>
    <div class="runtime-plan-section">
      <h3>Inventory diagnostics</h3>
      <div class="diagnostic-columns">
        <div>
          <h4>Error</h4>
          <ul class="import-diagnostics">${diagnosticItems(errors)}</ul>
        </div>
        <div>
          <h4>Warning</h4>
          <ul class="import-diagnostics">${diagnosticItems(warnings)}</ul>
        </div>
      </div>
    </div>
  `;
}

function renderProductBackendReadiness(payload) {
  state.lastProductBackendReadiness = payload;
  const summary = payload.summary || {};
  const statusState = summary.ready ? (summary.warningCount ? "warning" : "ok") : "error";
  const cards = [
    ["Mode", summary.mode || "development"],
    ["Surfaces", `${summary.readySurfaceCount || 0}/${summary.surfaceCount || 0}`],
    ["Local artifacts", summary.localArtifactCount || 0],
    ["Server backed", summary.serverBackedSurfaceCount || 0],
    ["Diagnostics", `${summary.errorCount || 0} error / ${summary.warningCount || 0} warning`],
  ]
    .map(
      ([label, value]) => `
        <article class="import-summary-card" data-state="${label === "Diagnostics" ? statusState : "ok"}">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `,
    )
    .join("");
  const surfaces = (payload.surfaces || [])
    .map((surface) => {
      const artifacts = (surface.localArtifacts || [])
        .slice(0, 3)
        .map((artifact) => artifact.path)
        .join(", ");
      const hiddenCount = Math.max(0, (surface.localArtifacts || []).length - 3);
      const artifactDetail = surface.localArtifactCount
        ? `${surface.localArtifactCount} local / ${artifacts}${hiddenCount ? ` 외 ${hiddenCount}개` : ""}`
        : "local artifact 없음";
      return `
        <li data-required="${surface.state === "error" ? "true" : "false"}">
          <strong>${escapeHtml(surface.title)}</strong>
          <span>${escapeHtml(surface.status)} / ${escapeHtml(surface.storageMode || "env")}</span>
          <small>${escapeHtml(surface.requirement || surface.detail || "")}</small>
          <code>${escapeHtml(artifactDetail)}</code>
        </li>
      `;
    })
    .join("");
  const nextActions = (payload.nextActions || [])
    .map(
      (action) => `
        <li data-required="${action.required ? "true" : "false"}">
          <strong>${escapeHtml(action.key)}</strong>
          <span>${escapeHtml(action.detail)}</span>
        </li>
      `,
    )
    .join("");
  const localArtifacts = (payload.localArtifacts || [])
    .slice(0, 10)
    .map(
      (artifact) => `
        <li>
          <strong>${escapeHtml(artifact.label || artifact.kind)}</strong>
          <span>${escapeHtml(artifact.path)}</span>
        </li>
      `,
    )
    .join("");
  const hiddenArtifactCount = Math.max(0, (payload.localArtifacts || []).length - 10);
  const errors = payload.diagnosticsByLevel?.error || [];
  const warnings = payload.diagnosticsByLevel?.warning || [];
  const readinessJson = JSON.stringify(payload, null, 2);

  elements.productBackendReadiness.innerHTML = `
    <div class="import-preview__summary">
      <div>
        <strong>Product backend readiness: ${escapeHtml(summary.status || "unknown")}</strong>
        <p>customer auth, workspace data, source bindings, run logs, library installs, publish governance가 제품 소유 backend로 전환될 준비를 점검합니다.</p>
      </div>
      <span class="asset-pill" data-state="${statusState}">${summary.ready ? "ready" : "blocked"}</span>
    </div>
    <div class="import-summary-grid graph-summary-grid">${cards}</div>
    <div class="graph-layout">
      <div>
        <h3>Backend surfaces</h3>
        <ul class="next-step-list">${surfaces}</ul>
      </div>
      <div>
        <h3>Next actions</h3>
        <ul class="next-step-list">${nextActions}</ul>
      </div>
    </div>
    <div class="runtime-plan-section">
      <h3>Local artifacts</h3>
      <ul class="next-step-list">
        ${localArtifacts || `<li data-required="false"><strong>Local artifact 없음</strong><span>아직 점검할 로컬 product artifact가 없습니다.</span></li>`}
        ${hiddenArtifactCount ? `<li data-required="false"><strong>추가 artifact</strong><span>${hiddenArtifactCount}개가 더 있습니다.</span></li>` : ""}
      </ul>
    </div>
    <div class="runtime-plan-section">
      <h3>Product backend diagnostics</h3>
      <div class="diagnostic-columns">
        <div>
          <h4>Error</h4>
          <ul class="import-diagnostics">${diagnosticItems(errors)}</ul>
        </div>
        <div>
          <h4>Warning</h4>
          <ul class="import-diagnostics">${diagnosticItems(warnings)}</ul>
        </div>
      </div>
    </div>
    <details class="spec-preview">
      <summary>Product backend readiness JSON 전체 보기</summary>
      <pre><code>${escapeHtml(readinessJson)}</code></pre>
    </details>
  `;
}

function selectGraphNode(nodeId) {
  const graph = state.lastGraphPreview?.graph || {};
  const node = (graph.nodes || []).find((item) => item.id === nodeId);
  if (!node) {
    return;
  }

  state.selectedGraphNodeId = node.id;
  const diagnosticsIndex = graphDiagnosticIndex(graph);
  const detail = elements.graphPreview.querySelector("#graphNodeDetail");
  if (detail) {
    detail.innerHTML = renderGraphNodeDetail(node, diagnosticsIndex, graph);
  }

  for (const item of elements.graphPreview.querySelectorAll("[data-graph-node]")) {
    const selected = item.dataset.graphNode === node.id ? "true" : "false";
    item.dataset.selected = selected;
    item.setAttribute("aria-pressed", selected);
  }

  for (const item of elements.graphPreview.querySelectorAll("[data-graph-edge]")) {
    const edge = (graph.edges || []).find((candidate) => candidate.id === item.dataset.graphEdge);
    item.dataset.related = edge && (edge.from === node.id || edge.to === node.id) ? "true" : "false";
  }
}

function svgPoint(svg, clientX, clientY) {
  if (svg.createSVGPoint && svg.getScreenCTM()) {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  }
  const rect = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  return {
    x: ((clientX - rect.left) / rect.width) * viewBox.width,
    y: ((clientY - rect.top) / rect.height) * viewBox.height,
  };
}

function beginGraphDrag(event, item) {
  if (event.button !== undefined && event.button !== 0) {
    return;
  }
  event.preventDefault();
  const svg = item.closest("svg");
  if (!svg) {
    return;
  }
  selectGraphNode(item.dataset.graphNode);
  const point = svgPoint(svg, event.clientX, event.clientY);
  state.graphLayoutDrag = {
    nodeId: item.dataset.graphNode,
    element: item,
    svg,
    pointerId: event.pointerId,
    startX: point.x,
    startY: point.y,
    baseX: Number(item.dataset.layoutX) || 0,
    baseY: Number(item.dataset.layoutY) || 0,
    currentX: Number(item.dataset.layoutX) || 0,
    currentY: Number(item.dataset.layoutY) || 0,
    moved: false,
  };
  item.dataset.dragging = "true";
  item.setPointerCapture?.(event.pointerId);
}

function continueGraphDrag(event) {
  const drag = state.graphLayoutDrag;
  if (!drag || event.pointerId !== drag.pointerId) {
    return;
  }
  event.preventDefault();
  const point = svgPoint(drag.svg, event.clientX, event.clientY);
  const viewBox = drag.svg.viewBox.baseVal;
  const nextX = clampGraphCoordinate(drag.baseX + point.x - drag.startX, 18, viewBox.width - graphNodeWidth - 18);
  const nextY = clampGraphCoordinate(drag.baseY + point.y - drag.startY, graphCanvasTop, viewBox.height - graphNodeHeight - 18);
  const dx = nextX - drag.baseX;
  const dy = nextY - drag.baseY;
  drag.currentX = nextX;
  drag.currentY = nextY;
  drag.moved ||= Math.abs(dx) > 1 || Math.abs(dy) > 1;
  drag.element.setAttribute("transform", `translate(${dx} ${dy})`);
}

function finishGraphDrag(event) {
  const drag = state.graphLayoutDrag;
  if (!drag || event.pointerId !== drag.pointerId) {
    return;
  }
  drag.element.releasePointerCapture?.(event.pointerId);
  drag.element.dataset.dragging = "false";
  drag.element.removeAttribute("transform");
  state.graphLayoutDrag = null;

  if (!drag.moved) {
    return;
  }

  state.graphLayout ||= { exists: false, positions: {} };
  state.graphLayout.positions ||= {};
  state.graphLayout.positions[drag.nodeId] = {
    x: Math.round(drag.currentX * 100) / 100,
    y: Math.round(drag.currentY * 100) / 100,
  };
  state.graphLayoutDirty = true;
  if (state.lastGraphPreview) {
    state.lastGraphPreview.layout = state.graphLayout;
    renderGraphPreview(state.lastGraphPreview, drag.nodeId);
  } else {
    updateGraphLayoutStatus();
  }
}

function attachGraphPreviewEvents() {
  for (const item of elements.graphPreview.querySelectorAll("[data-graph-node]")) {
    item.addEventListener("click", () => selectGraphNode(item.dataset.graphNode));
    item.addEventListener("pointerdown", (event) => beginGraphDrag(event, item));
    item.addEventListener("pointermove", continueGraphDrag);
    item.addEventListener("pointerup", finishGraphDrag);
    item.addEventListener("pointercancel", finishGraphDrag);
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectGraphNode(item.dataset.graphNode);
      }
    });
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

function installActionButton(action, result) {
  if (action.kind === "retry") {
    return `<button class="secondary" type="button" data-install-action="retry">${action.label}</button>`;
  }
  if (action.kind === "search") {
    return `<button class="secondary" type="button" data-install-action="search">${action.label}</button>`;
  }
  if (action.kind === "fallback") {
    return `<button class="secondary" type="button" data-install-action="fallback">${action.label}</button>`;
  }
  if (action.kind === "github" && result.githubUrl) {
    return `<a class="link-button" href="${result.githubUrl}" target="_blank" rel="noreferrer">${action.label}</a>`;
  }
  return "";
}

function renderInstallResult(result) {
  const state =
    result.status === "installed" || result.status === "already-installed"
      ? "success"
      : result.ok
        ? "warning"
        : "error";
  elements.installResult.dataset.state = state;

  const checks = (result.checks || [])
    .map(
      (check) => `
        <li data-ok="${check.ok ? "true" : "false"}">
          <strong>${check.label}</strong>
          <span>${check.detail}</span>
        </li>
      `,
    )
    .join("");
  const actions = (result.actions || [])
    .map((action) => installActionButton(action, result))
    .filter(Boolean)
    .join("");
  const installedPath = result.installedAsset?.path
    ? `<p>설치 위치: <code>${result.installedAsset.path}</code></p>`
    : "";

  elements.installResult.innerHTML = `
    <strong>${result.title || "설치 상태"}</strong>
    <p>${result.message || "결과를 확인했습니다."}</p>
    ${installedPath}
    ${checks ? `<ul class="install-checks">${checks}</ul>` : ""}
    ${actions ? `<div class="install-actions">${actions}</div>` : ""}
  `;

  for (const button of elements.installResult.querySelectorAll("[data-install-action]")) {
    button.addEventListener("click", () => handleInstallAction(button.dataset.installAction));
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

async function loadWorkflowBlueprint() {
  const workflow = await request("/api/knolet/workflow");
  renderWorkflowBlueprint(workflow);
  logAction(`Knolet workflow blueprint 확인 완료: ${workflow.ready ? "준비됨" : "확인 필요"}`);
}

async function loadImportPreview() {
  const preview = state.bindingDraft
    ? await request("/api/knolet/import/dot", {
        method: "POST",
        body: JSON.stringify(bindingPayload()),
      })
    : await request("/api/knolet/import/dot");
  renderImportPreview(preview);
  logAction(
    `Import Preview 완료: Persona ${preview.summary?.personasCount || 0}, Skill ${preview.summary?.skillsCount || 0}, warning ${preview.summary?.warningCount || 0}개.`,
  );
}

async function saveKnoletSpec() {
  const result = await request("/api/knolet/import/dot/save", {
    method: "POST",
    body: JSON.stringify({
      target: elements.knoletSaveTarget.value,
      ...bindingPayload(),
    }),
  });
  logAction(`knolet.json 저장 완료: ${result.path}`);
  if (!state.lastImportPreview) {
    const preview = await request("/api/knolet/import/dot");
    renderImportPreview(preview);
  }
  elements.previewTitle.textContent = "knolet.json 저장 완료";
  elements.previewBody.textContent = `${result.path}\nvalidation: ${result.validation?.ok ? "ok" : "error"}`;
}

async function loadRuntimePlan() {
  const payload = await request("/api/knolet/runtime/plan", {
    method: "POST",
    body: JSON.stringify(bindingPayload()),
  });
  renderRuntimePlanPreview(payload);
  logAction(
    `Runtime plan preview 완료: ${payload.plan?.status || "unknown"}, steps ${payload.plan?.summary?.stepsCount || 0}개.`,
  );
}

async function saveRuntimePlan() {
  const result = await request("/api/knolet/runtime/plan/save", {
    method: "POST",
    body: JSON.stringify(bindingPayload()),
  });
  await loadRuntimePlan();
  elements.previewTitle.textContent = "runtime-plan.json 저장 완료";
  elements.previewBody.textContent = `${result.path}\nstatus: ${result.status}\nrun: ${result.runLog?.id || ""}`;
  logAction(`Runtime plan 저장 완료: ${result.path}`);
}

async function loadGraphPreview() {
  const payload = await request("/api/knolet/graph", {
    method: "POST",
    body: JSON.stringify(bindingPayload()),
  });
  state.graphLayoutDirty = false;
  renderGraphPreview(payload);
  logAction(
    `Graph preview 완료: node ${payload.graph?.summary?.nodeCount || 0}개, edge ${payload.graph?.summary?.edgeCount || 0}개.`,
  );
}

async function saveGraphModel() {
  const result = await request("/api/knolet/graph/save", {
    method: "POST",
    body: JSON.stringify(bindingPayload()),
  });
  await loadGraphPreview();
  elements.previewTitle.textContent = "knolet-graph.json 저장 완료";
  elements.previewBody.textContent = `${result.path}\nstatus: ${result.status}\nnodes: ${result.summary?.nodeCount || 0}\nedges: ${result.summary?.edgeCount || 0}`;
  logAction(`Knolet graph 저장 완료: ${result.path}`);
}

async function loadLibraryPackage() {
  const payload = await request("/api/knolet/library/package", {
    method: "POST",
    body: JSON.stringify(bindingPayload()),
  });
  renderLibraryPackagePreview(payload);
  logAction(
    `Library package preview 완료: ${payload.package?.status || "unknown"}, templates ${payload.package?.summary?.templateCount || 0}개.`,
  );
}

async function saveLibraryPackage() {
  const result = await request("/api/knolet/library/package/save", {
    method: "POST",
    body: JSON.stringify(bindingPayload()),
  });
  await loadLibraryPackage();
  elements.previewTitle.textContent = "knolet-library-package.json 저장 완료";
  elements.previewBody.textContent = `${result.path}\nstatus: ${result.status}\ntemplates: ${result.summary?.templateCount || 0}`;
  logAction(`Knolet library package 저장 완료: ${result.path}`);
}

async function loadLibraryInstallPlan() {
  const payload = await request("/api/knolet/library/install-plan", {
    method: "POST",
    body: JSON.stringify(bindingPayload()),
  });
  renderLibraryInstallPlanPreview(payload);
  logAction(
    `Library install plan preview 완료: ${payload.installPlan?.status || "unknown"}, actions ${payload.installPlan?.summary?.templateActionCount || 0}개.`,
  );
}

async function saveLibraryInstallPlan() {
  const result = await request("/api/knolet/library/install-plan/save", {
    method: "POST",
    body: JSON.stringify(bindingPayload()),
  });
  await loadLibraryInstallPlan();
  elements.previewTitle.textContent = "knolet-library-install-plan.json 저장 완료";
  elements.previewBody.textContent = `${result.path}\nstatus: ${result.status}\nactions: ${result.summary?.templateActionCount || 0}`;
  logAction(`Knolet library install plan 저장 완료: ${result.path}`);
}

async function loadLibraryInstallExecution() {
  const payload = await request("/api/knolet/library/install/execution", {
    method: "POST",
    body: JSON.stringify(libraryInstallPayload()),
  });
  renderLibraryInstallExecutionPreview(payload);
  logAction(
    `Library install execution preview 완료: ${payload.execution?.status || "unknown"}, writes ${payload.execution?.summary?.writeCount || 0}개.`,
  );
}

async function executeLibraryInstall() {
  const result = await request("/api/knolet/library/install/execute", {
    method: "POST",
    body: JSON.stringify(libraryInstallPayload()),
  });
  renderLibraryInstallExecutionPreview(result);
  await loadLibraryInventory();
  elements.previewTitle.textContent = result.ok ? "library install 완료" : "library install 차단됨";
  elements.previewBody.textContent = result.ok
    ? `${result.path}\nstatus: ${result.status}\nwrites: ${result.writes?.length || 0}`
    : `status: ${result.status}\nerrors: ${result.summary?.errorCount || 0}`;
  logAction(
    result.ok
      ? `Knolet library install 실행 완료: ${result.writes?.length || 0}개 파일 기록.`
      : `Knolet library install 차단: error ${result.summary?.errorCount || 0}개.`,
  );
}

async function loadLibraryInventory() {
  const payload = await request("/api/knolet/library/inventory");
  renderLibraryInventory(payload);
  logAction(
    `Library inventory 확인: templates ${payload.inventory?.summary?.templateCount || 0}개, installs ${payload.inventory?.summary?.installationCount || 0}개.`,
  );
}

async function loadProductBackendReadiness() {
  const payload = await request("/api/knolet/product-backend/readiness");
  renderProductBackendReadiness(payload);
  logAction(
    `Product backend readiness 확인: ${payload.summary?.status || "unknown"}, error ${payload.summary?.errorCount || 0}개.`,
  );
}

async function saveGraphLayout() {
  const result = await request("/api/knolet/graph/layout", {
    method: "POST",
    body: JSON.stringify({
      positions: graphLayoutPositions(),
    }),
  });
  state.graphLayout = result.layout;
  state.graphLayoutDirty = false;
  if (state.lastGraphPreview) {
    state.lastGraphPreview.layout = result.layout;
    renderGraphPreview(state.lastGraphPreview, state.selectedGraphNodeId);
  }
  elements.previewTitle.textContent = "knolet-graph-layout.json 저장 완료";
  elements.previewBody.textContent = `${result.path}\npositions: ${result.positionCount || 0}`;
  logAction(`Knolet graph layout 저장 완료: ${result.path}`);
}

async function resetGraphLayout() {
  const result = await request("/api/knolet/graph/layout", {
    method: "DELETE",
  });
  state.graphLayout = result.layout;
  state.graphLayoutDirty = false;
  if (state.lastGraphPreview) {
    state.lastGraphPreview.layout = result.layout;
    renderGraphPreview(state.lastGraphPreview, state.selectedGraphNodeId);
  }
  elements.previewTitle.textContent = "graph layout 초기화 완료";
  elements.previewBody.textContent = "저장된 위치를 지우고 자동 layout으로 돌아갔습니다.";
  logAction("Knolet graph layout을 자동 layout으로 초기화했습니다.");
}

async function loadLauncherHandoff() {
  const handoff = await request("/api/launcher");
  renderLauncherHandoff(handoff);
  logAction(`0.2.0 통합 런처 확인: 서비스 ${handoff.services?.length || 0}개.`);
}

function fillRunOutputs(run) {
  state.currentRun = run;
  elements.runOutputTitle.textContent = `${run.title} / ${run.status}`;
  elements.outputKnowledge.value = run.outputs?.knowledgeStructure || "";
  elements.outputSpec.value = run.outputs?.knoletSpec || "";
  elements.outputRuntime.value = run.outputs?.runtimeAppPlan || "";
  elements.outputVersioning.value = run.outputs?.versionForkShare || "";
  elements.outputChecklist.value = run.outputs?.nextChecklist || "";
  renderRunReview(run.review);
}

function renderRunReview(review) {
  if (!review?.checklist?.length) {
    elements.runReview.dataset.state = "idle";
    elements.runReview.innerHTML = `
      <strong>검토 대기 중</strong>
      <p>산출물을 저장한 뒤 품질 검토를 누르세요.</p>
    `;
    return;
  }
  elements.runReview.dataset.state = review.passed ? "success" : "warning";
  const items = review.checklist
    .map(
      (check) => `
        <li data-ok="${check.ok ? "true" : "false"}">
          <strong>${check.label}</strong>
          <span>${check.detail}</span>
        </li>
      `,
    )
    .join("");
  elements.runReview.innerHTML = `
    <strong>품질 점수 ${review.score}점</strong>
    <p>${review.summary}</p>
    <ul class="install-checks">${items}</ul>
  `;
}

function renderRunList(runs) {
  elements.runList.innerHTML = "";
  if (!runs.length) {
    elements.runList.innerHTML = `<p class="empty">아직 저장한 workflow 실행 기록이 없습니다.</p>`;
    return;
  }
  for (const run of runs) {
    const row = document.createElement("button");
    row.className = "asset-row";
    row.type = "button";
    row.innerHTML = `<strong>${run.title}</strong><span>${run.status} / ${run.updatedAt || ""}</span>`;
    row.addEventListener("click", () => loadRun(run.id));
    elements.runList.append(row);
  }
}

async function loadRuns() {
  const data = await request("/api/knolet/runs");
  renderRunList(data.runs || []);
  logAction(`Workflow 실행 기록 ${data.runs?.length || 0}개를 읽었습니다.`);
}

async function loadRun(id) {
  const run = await request(`/api/knolet/runs/${encodeURIComponent(id)}`);
  fillRunOutputs(run);
  logAction(`실행 기록 선택: ${run.title}`);
}

async function createRun(event) {
  event.preventDefault();
  const run = await request("/api/knolet/runs", {
    method: "POST",
    body: JSON.stringify({
      title: elements.runTitle.value,
      sourceTitle: elements.runTitle.value,
      sourceDocument: elements.runSourceDocument.value,
      targetUser: elements.runTargetUser.value,
      runtimeConstraints: elements.runRuntimeConstraints.value,
    }),
  });
  fillRunOutputs(run);
  await loadRuns();
  logAction(`새 workflow 실행 기록 생성: ${run.title}`);
}

async function saveRunOutputs() {
  if (!state.currentRun?.id) {
    throw new Error("먼저 workflow 실행 기록을 선택하세요.");
  }
  const run = await request(`/api/knolet/runs/${encodeURIComponent(state.currentRun.id)}`, {
    method: "PUT",
    body: JSON.stringify({
      outputs: {
        knowledgeStructure: elements.outputKnowledge.value,
        knoletSpec: elements.outputSpec.value,
        runtimeAppPlan: elements.outputRuntime.value,
        versionForkShare: elements.outputVersioning.value,
        nextChecklist: elements.outputChecklist.value,
      },
    }),
  });
  fillRunOutputs(run);
  await loadRuns();
  logAction(`Workflow 산출물 저장: ${run.title}`);
}

async function reviewRunOutputs() {
  if (!state.currentRun?.id) {
    throw new Error("먼저 workflow 실행 기록을 선택하세요.");
  }
  const run = await request(`/api/knolet/runs/${encodeURIComponent(state.currentRun.id)}/review`, {
    method: "POST",
    body: "{}",
  });
  fillRunOutputs(run);
  await loadRuns();
  logAction(`Workflow 산출물 품질 검토: ${run.review.score}점`);
}

async function exportRunPackage() {
  if (!state.currentRun?.id) {
    throw new Error("먼저 workflow 실행 기록을 선택하세요.");
  }
  const result = await request(`/api/knolet/runs/${encodeURIComponent(state.currentRun.id)}/export`, {
    method: "POST",
    body: "{}",
  });
  elements.exportPreview.textContent = result.markdown;
  logAction(`공유 패키지 생성: ${result.path}`);
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

async function checkInstallPreflight() {
  const urn = elements.installUrn.value.trim();
  if (!urn) {
    throw new Error("설치할 URN을 입력하거나 검색 결과를 선택하세요.");
  }
  const result = await request("/api/dot/preflight", {
    method: "POST",
    body: JSON.stringify({ urn, expectedKind: elements.registryKind.value }),
  });
  renderInstallResult(result);
  logAction(`설치 전 확인 완료: ${urn}`);
}

async function installAsset() {
  const urn = elements.installUrn.value.trim();
  if (!urn) {
    throw new Error("설치할 URN을 입력하거나 검색 결과를 선택하세요.");
  }
  const result = await request("/api/dot/install", {
    method: "POST",
    body: JSON.stringify({ urn, scope: "stage", expectedKind: elements.registryKind.value }),
  });
  renderInstallResult(result);
  await refresh();
  logAction(`${result.title || "Registry asset 설치 결과"}: ${urn}`);
}

async function handleInstallAction(action) {
  if (action === "retry") {
    await runAction(elements.installAsset, installAsset);
    return;
  }
  if (action === "search") {
    const descriptor = elements.installUrn.value.trim().match(/^(tal|dance|performer|act)\/@[^/]+\/[^/]+\/([^/]+)$/);
    if (descriptor) {
      elements.registryKind.value = descriptor[1];
      elements.registryQuery.value = descriptor[2];
    }
    await runAction(elements.searchRegistry, searchRegistry);
    return;
  }
  if (action === "fallback") {
    await runAction(elements.seedWorkspace, async () => {
      const result = await request("/api/seed", { method: "POST", body: "{}" });
      await refresh();
      renderInstallResult({
        ok: true,
        status: "fallback-installed",
        title: "로컬 예시로 대체 설치 완료",
        message: `Knolet 기본 예시 파일 ${result.written.length}개를 준비했습니다.`,
      });
      logAction("로컬 예시로 대체 설치했습니다.");
    });
  }
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
elements.recheckOpenCode.addEventListener("click", () =>
  runAction(elements.recheckOpenCode, runDiagnostics),
);
elements.refreshLauncherHandoff.addEventListener("click", () =>
  runAction(elements.refreshLauncherHandoff, loadLauncherHandoff),
);
elements.toggleOpenCodeGuide.addEventListener("click", () => {
  elements.openCodeGuide.hidden = !elements.openCodeGuide.hidden;
  elements.toggleOpenCodeGuide.textContent = elements.openCodeGuide.hidden
    ? "session URL 문제 해결 안내 보기"
    : "session URL 문제 해결 안내 닫기";
});
elements.seedStudio.addEventListener("click", () =>
  runAction(elements.seedStudio, seedStudioCanvas),
);
elements.refreshWorkflowPlan.addEventListener("click", () =>
  runAction(elements.refreshWorkflowPlan, loadWorkflowBlueprint),
);
elements.refreshImportPreview.addEventListener("click", () =>
  runAction(elements.refreshImportPreview, loadImportPreview),
);
elements.saveKnoletSpec.addEventListener("click", () =>
  runAction(elements.saveKnoletSpec, saveKnoletSpec),
);
elements.refreshRuntimePlan.addEventListener("click", () =>
  runAction(elements.refreshRuntimePlan, loadRuntimePlan),
);
elements.saveRuntimePlan.addEventListener("click", () =>
  runAction(elements.saveRuntimePlan, saveRuntimePlan),
);
elements.refreshGraphPreview.addEventListener("click", () =>
  runAction(elements.refreshGraphPreview, loadGraphPreview),
);
elements.saveGraphModel.addEventListener("click", () =>
  runAction(elements.saveGraphModel, saveGraphModel),
);
elements.saveGraphLayout.addEventListener("click", () =>
  runAction(elements.saveGraphLayout, saveGraphLayout),
);
elements.resetGraphLayout.addEventListener("click", () =>
  runAction(elements.resetGraphLayout, resetGraphLayout),
);
elements.refreshLibraryPackage.addEventListener("click", () =>
  runAction(elements.refreshLibraryPackage, loadLibraryPackage),
);
elements.saveLibraryPackage.addEventListener("click", () =>
  runAction(elements.saveLibraryPackage, saveLibraryPackage),
);
elements.refreshLibraryInstallPlan.addEventListener("click", () =>
  runAction(elements.refreshLibraryInstallPlan, loadLibraryInstallPlan),
);
elements.saveLibraryInstallPlan.addEventListener("click", () =>
  runAction(elements.saveLibraryInstallPlan, saveLibraryInstallPlan),
);
elements.refreshLibraryInstallExecution.addEventListener("click", () =>
  runAction(elements.refreshLibraryInstallExecution, loadLibraryInstallExecution),
);
elements.executeLibraryInstall.addEventListener("click", () =>
  runAction(elements.executeLibraryInstall, executeLibraryInstall),
);
elements.refreshLibraryInventory.addEventListener("click", () =>
  runAction(elements.refreshLibraryInventory, loadLibraryInventory),
);
elements.refreshProductBackendReadiness.addEventListener("click", () =>
  runAction(elements.refreshProductBackendReadiness, loadProductBackendReadiness),
);
elements.refreshRuns.addEventListener("click", () => runAction(elements.refreshRuns, loadRuns));
elements.runForm.addEventListener("submit", createRun);
elements.saveRunOutputs.addEventListener("click", () =>
  runAction(elements.saveRunOutputs, saveRunOutputs),
);
elements.reviewRunOutputs.addEventListener("click", () =>
  runAction(elements.reviewRunOutputs, reviewRunOutputs),
);
elements.exportRunPackage.addEventListener("click", () =>
  runAction(elements.exportRunPackage, exportRunPackage),
);
elements.searchRegistry.addEventListener("click", () =>
  runAction(elements.searchRegistry, searchRegistry),
);
elements.checkInstall.addEventListener("click", () =>
  runAction(elements.checkInstall, checkInstallPreflight),
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
loadWorkflowBlueprint().catch((error) => {
  elements.workflowBlueprint.innerHTML = `<p class="empty">${error.message}</p>`;
});
loadImportPreview().catch((error) => {
  elements.importPreview.innerHTML = `<p class="empty">${error.message}</p>`;
});
loadRuntimePlan().catch((error) => {
  elements.runtimePlanPreview.innerHTML = `<p class="empty">${error.message}</p>`;
});
loadGraphPreview().catch((error) => {
  elements.graphPreview.innerHTML = `<p class="empty">${error.message}</p>`;
});
loadLibraryPackage().catch((error) => {
  elements.libraryPackagePreview.innerHTML = `<p class="empty">${error.message}</p>`;
});
loadLibraryInstallPlan().catch((error) => {
  elements.libraryInstallPlanPreview.innerHTML = `<p class="empty">${error.message}</p>`;
});
loadLibraryInstallExecution().catch((error) => {
  elements.libraryInstallExecutionPreview.innerHTML = `<p class="empty">${error.message}</p>`;
});
loadLibraryInventory().catch((error) => {
  elements.libraryInventory.innerHTML = `<p class="empty">${error.message}</p>`;
});
loadProductBackendReadiness().catch((error) => {
  elements.productBackendReadiness.innerHTML = `<p class="empty">${error.message}</p>`;
});
loadLauncherHandoff().catch((error) => {
  elements.launcherHandoff.innerHTML = `<p class="empty">${error.message}</p>`;
});
loadRuns().catch((error) => {
  elements.runList.innerHTML = `<p class="empty">${error.message}</p>`;
});
