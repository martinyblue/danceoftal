const { diagnostic } = require("./schema");

const LIBRARY_INSTALL_PLAN_VERSION = "0.1";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function slug(value, fallback = "item") {
  return String(value || fallback)
    .trim()
    .replace(/^@/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || fallback;
}

function templateGroups(libraryPackage) {
  const templates = libraryPackage?.templates || {};
  return [
    ["persona_template", asArray(templates.persona_templates)],
    ["skill_block", asArray(templates.skill_blocks)],
    ["agent_profile", asArray(templates.agent_profiles)],
    ["workflow_template", asArray(templates.workflow_templates)],
    ["knowledge_app_template", asArray(templates.knowledge_app_templates)],
    ["evaluation_pack", asArray(templates.evaluation_packs)],
    ["ui_output_template", asArray(templates.ui_output_templates)],
  ];
}

function templateInstallActions(libraryPackage, target) {
  const actions = [];
  for (const [templateType, items] of templateGroups(libraryPackage)) {
    for (const template of items) {
      const templateId = template?.id || `${templateType}.${actions.length + 1}`;
      actions.push({
        id: `install:${templateType}:${templateId}`,
        type: "install_template",
        template_type: templateType,
        template_id: templateId,
        target_id: `${target.owner}/${target.stage}/${slug(templateId)}`,
        mode: "create_or_update",
      });
    }
  }
  return actions;
}

function sourceRebindingSteps(libraryPackage) {
  return asArray(libraryPackage?.source_bindings).map((source) => {
    const pointerKind = source?.pointer?.kind || "binding";
    return {
      id: `rebind:${source.id}`,
      source_id: source.id,
      type: source.type,
      label: source.label || source.id,
      required: source.required === true,
      pointer_kind: pointerKind,
      status: pointerKind === "binding" ? "needs_binding" : "needs_review",
    };
  });
}

function packageDiagnostics(libraryPackage) {
  const diagnostics = [];

  if (!isRecord(libraryPackage)) {
    diagnostics.push(diagnostic("error", "install-package-missing", "Library package must be an object."));
    return diagnostics;
  }

  if (!libraryPackage.library_package_version) {
    diagnostics.push(
      diagnostic("error", "install-package-version-missing", "Library package version is required.", "library_package_version"),
    );
  }
  if (!libraryPackage.id) {
    diagnostics.push(diagnostic("error", "install-package-id-missing", "Library package id is required.", "id"));
  }
  if (libraryPackage.status && libraryPackage.status !== "shareable") {
    diagnostics.push(
      diagnostic("warning", "install-package-not-shareable", `Library package status is ${libraryPackage.status}.`, "status"),
    );
  }
  if (libraryPackage.share_policy?.copies_source_documents !== false) {
    diagnostics.push(
      diagnostic(
        "error",
        "install-package-copies-sources",
        "Library packages must not copy source documents into installs.",
        "share_policy.copies_source_documents",
      ),
    );
  }
  if (!asArray(libraryPackage.source_bindings).length) {
    diagnostics.push(
      diagnostic("warning", "install-source-bindings-missing", "Install plan has no KnowledgeSource bindings to review."),
    );
  }

  const seenTemplates = new Set();
  for (const [templateType, items] of templateGroups(libraryPackage)) {
    for (const template of items) {
      const key = `${templateType}:${template?.id || ""}`;
      if (!template?.id) {
        diagnostics.push(diagnostic("error", "install-template-id-missing", `${templateType} template is missing an id.`));
        continue;
      }
      if (seenTemplates.has(key)) {
        diagnostics.push(
          diagnostic("error", "install-template-id-duplicated", `${templateType} template ${template.id} is duplicated.`, template.id),
        );
      }
      seenTemplates.add(key);
    }
  }

  return diagnostics;
}

function compileKnoletLibraryInstallPlan(libraryPackage, options = {}) {
  const target = {
    owner: slug(options.targetOwner || "martinyblue", "martinyblue"),
    stage: slug(options.targetStage || "local", "local"),
  };
  const diagnostics = [...packageDiagnostics(libraryPackage), ...asArray(libraryPackage?.diagnostics)];
  const template_actions = templateInstallActions(libraryPackage, target);
  const source_rebindings = sourceRebindingSteps(libraryPackage);
  const errors = diagnostics.filter((item) => item.level === "error");
  const warnings = diagnostics.filter((item) => item.level === "warning");
  const createdAt = options.createdAt || new Date().toISOString();
  const sourcePackageId = libraryPackage?.id || "unknown-package";

  return {
    library_install_plan_version: LIBRARY_INSTALL_PLAN_VERSION,
    id: options.id || `install-plan-${createdAt.replace(/[:.]/g, "-")}`,
    createdAt,
    status: errors.length ? "blocked" : "ready",
    source_package: {
      id: sourcePackageId,
      version: libraryPackage?.library_package_version || "",
      status: libraryPackage?.status || "",
    },
    target_workspace: target,
    fork: {
      forkable: libraryPackage?.share_policy?.forkable === true,
      source_package_id: sourcePackageId,
      fork_id: `knolet-library-fork://${target.owner}/${target.stage}/${slug(sourcePackageId, "package")}`,
    },
    summary: {
      ready: errors.length === 0,
      templateActionCount: template_actions.length,
      sourceRebindingCount: source_rebindings.length,
      requiredRebindingCount: source_rebindings.filter((item) => item.required).length,
      errorCount: errors.length,
      warningCount: warnings.length,
    },
    template_actions,
    source_rebindings,
    diagnostics,
    next: {
      milestone: "0.4.1 Library Install Execution",
      detail: "Use this plan to write local template records only after source rebindings are confirmed.",
    },
  };
}

module.exports = {
  LIBRARY_INSTALL_PLAN_VERSION,
  compileKnoletLibraryInstallPlan,
};
