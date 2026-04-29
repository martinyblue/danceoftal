const { diagnostic } = require("./schema");

const LIBRARY_INSTALL_EXECUTION_VERSION = "0.1";
const INSTALLED_TEMPLATE_VERSION = "0.1";

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

function templateCollections(libraryPackage) {
  const templates = libraryPackage?.templates || {};
  return [
    ...asArray(templates.persona_templates),
    ...asArray(templates.skill_blocks),
    ...asArray(templates.agent_profiles),
    ...asArray(templates.workflow_templates),
    ...asArray(templates.knowledge_app_templates),
    ...asArray(templates.evaluation_packs),
    ...asArray(templates.ui_output_templates),
  ];
}

function templateById(libraryPackage) {
  return new Map(templateCollections(libraryPackage).map((template) => [template?.id, template]).filter(([id]) => Boolean(id)));
}

function targetRoot(installPlan) {
  const owner = slug(installPlan?.target_workspace?.owner, "martinyblue");
  const stage = slug(installPlan?.target_workspace?.stage, "local");
  return {
    owner,
    stage,
    root: `library/${owner}/${stage}`,
  };
}

function installDiagnostics(installPlan, libraryPackage, options = {}) {
  const diagnostics = [];
  diagnostics.push(...asArray(installPlan?.diagnostics), ...asArray(libraryPackage?.diagnostics));

  if (!isRecord(installPlan)) {
    diagnostics.push(diagnostic("error", "execution-install-plan-missing", "Library install plan must be an object."));
    return diagnostics;
  }
  if (installPlan.status !== "ready") {
    diagnostics.push(
      diagnostic("error", "execution-install-plan-not-ready", `Install plan status is ${installPlan.status || "unknown"}.`, "status"),
    );
  }
  if (!isRecord(libraryPackage)) {
    diagnostics.push(diagnostic("error", "execution-package-missing", "Library package must be an object."));
  }
  if (libraryPackage?.share_policy?.copies_source_documents !== false) {
    diagnostics.push(
      diagnostic(
        "error",
        "execution-package-copies-sources",
        "Library install execution refuses packages that copy source documents.",
        "share_policy.copies_source_documents",
      ),
    );
  }

  const sourceBindings = isRecord(options.sourceBindings) ? options.sourceBindings : {};
  for (const source of asArray(installPlan.source_rebindings)) {
    const binding = sourceBindings[source.source_id];
    const confirmed = binding?.status === "bound" || Boolean(binding?.target_source_id);
    if (source.required && source.status === "needs_binding" && !confirmed) {
      diagnostics.push(
        diagnostic(
          "error",
          "execution-required-source-unbound",
          `Required KnowledgeSource ${source.source_id} must be rebound before installation.`,
          `source_rebindings.${source.source_id}`,
        ),
      );
    }
  }

  return diagnostics;
}

function templateWrite(action, template, installPlan, libraryPackage, installedAt) {
  const target = targetRoot(installPlan);
  const templateType = slug(action.template_type, "template");
  const templateId = action.template_id || template?.id || "template";
  return {
    kind: "template",
    action_id: action.id,
    path: `.dance-of-tal/${target.root}/templates/${templateType}/${slug(templateId)}.json`,
    record: {
      installed_template_version: INSTALLED_TEMPLATE_VERSION,
      installedAt,
      target_id: action.target_id,
      template_type: action.template_type,
      template_id: templateId,
      source_package: installPlan.source_package,
      fork: installPlan.fork,
      template,
      install_mode: action.mode || "create_or_update",
    },
  };
}

function sourceBindingWrite(source, installPlan, options, installedAt) {
  const target = targetRoot(installPlan);
  const sourceBindings = isRecord(options.sourceBindings) ? options.sourceBindings : {};
  const binding = sourceBindings[source.source_id] || {};
  return {
    kind: "source_binding",
    action_id: source.id,
    path: `.dance-of-tal/${target.root}/source-bindings/${slug(source.source_id)}.json`,
    record: {
      installed_source_binding_version: INSTALLED_TEMPLATE_VERSION,
      installedAt,
      source_id: source.source_id,
      label: source.label || source.source_id,
      type: source.type,
      required: source.required === true,
      pointer_kind: source.pointer_kind,
      status: binding.status || source.status,
      target_source_id: binding.target_source_id || "",
      notes: binding.notes || "",
      source_package: installPlan.source_package,
    },
  };
}

function manifestWrite(installPlan, libraryPackage, writes, diagnostics, installedAt) {
  const target = targetRoot(installPlan);
  return {
    kind: "manifest",
    action_id: "manifest",
    path: `.dance-of-tal/${target.root}/installations/${slug(installPlan.id, "install-plan")}.json`,
    record: {
      library_install_execution_version: LIBRARY_INSTALL_EXECUTION_VERSION,
      installedAt,
      source_package: installPlan.source_package,
      target_workspace: installPlan.target_workspace,
      fork: installPlan.fork,
      source_package_metadata: libraryPackage?.metadata || {},
      summary: {
        writeCount: writes.length + 1,
        templateWriteCount: writes.filter((write) => write.kind === "template").length,
        sourceBindingWriteCount: writes.filter((write) => write.kind === "source_binding").length,
        errorCount: diagnostics.filter((item) => item.level === "error").length,
        warningCount: diagnostics.filter((item) => item.level === "warning").length,
      },
      writes: writes.map((write) => ({
        kind: write.kind,
        path: write.path,
        action_id: write.action_id,
      })),
      diagnostics,
    },
  };
}

function compileKnoletLibraryInstallExecution(installPlan, libraryPackage, options = {}) {
  const diagnostics = installDiagnostics(installPlan, libraryPackage, options);
  const errors = diagnostics.filter((item) => item.level === "error");
  const warnings = diagnostics.filter((item) => item.level === "warning");
  const installedAt = options.installedAt || new Date().toISOString();
  const templates = templateById(libraryPackage);
  const writes = [];

  if (!errors.length) {
    for (const action of asArray(installPlan?.template_actions)) {
      const template = templates.get(action.template_id);
      if (!template) {
        diagnostics.push(
          diagnostic(
            "error",
            "execution-template-missing",
            `Install action ${action.id} references missing template ${action.template_id}.`,
            action.id,
          ),
        );
        continue;
      }
      writes.push(templateWrite(action, template, installPlan, libraryPackage, installedAt));
    }

    if (!diagnostics.some((item) => item.level === "error")) {
      for (const source of asArray(installPlan?.source_rebindings)) {
        writes.push(sourceBindingWrite(source, installPlan, options, installedAt));
      }
      writes.push(manifestWrite(installPlan, libraryPackage, writes, diagnostics, installedAt));
    }
  }

  const finalErrors = diagnostics.filter((item) => item.level === "error");
  const finalWarnings = diagnostics.filter((item) => item.level === "warning");

  return {
    library_install_execution_version: LIBRARY_INSTALL_EXECUTION_VERSION,
    id: options.id || `install-execution-${installedAt.replace(/[:.]/g, "-")}`,
    installedAt,
    status: finalErrors.length ? "blocked" : "ready_to_write",
    source_package: installPlan?.source_package || {},
    target_workspace: installPlan?.target_workspace || {},
    summary: {
      ready: finalErrors.length === 0,
      writeCount: finalErrors.length ? 0 : writes.length,
      templateWriteCount: finalErrors.length ? 0 : writes.filter((write) => write.kind === "template").length,
      sourceBindingWriteCount: finalErrors.length ? 0 : writes.filter((write) => write.kind === "source_binding").length,
      errorCount: finalErrors.length,
      warningCount: finalWarnings.length,
    },
    writes: finalErrors.length ? [] : writes,
    diagnostics,
  };
}

module.exports = {
  LIBRARY_INSTALL_EXECUTION_VERSION,
  INSTALLED_TEMPLATE_VERSION,
  compileKnoletLibraryInstallExecution,
};
