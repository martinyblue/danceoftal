const { diagnostic, validateKnoletSpec } = require("./schema");

const LIBRARY_PACKAGE_VERSION = "0.1";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function slug(value, fallback = "template") {
  return String(value || fallback)
    .trim()
    .replace(/^@/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || fallback;
}

function libraryPackageId(spec, options = {}) {
  if (options.id) {
    return options.id;
  }
  const owner = slug(spec?.metadata?.owner, "local");
  const stage = slug(spec?.metadata?.stage, "local");
  const name = slug(spec?.metadata?.name || spec?.workflow?.id, "knolet-app");
  return `knolet-library://${owner}/${stage}/${name}`;
}

function sourceBinding(source, diagnostics) {
  if (source?.content) {
    diagnostics.push(
      diagnostic(
        "warning",
        "library-source-content-stripped",
        `KnowledgeSource ${source.id} content was stripped from the library package.`,
        `knowledge.sources.${source.id}`,
      ),
    );
  }

  return {
    id: source.id,
    type: source.type,
    label: source.label || source.id,
    required: source.required === true,
    pointer: {
      kind: source.urn ? "urn" : source.path ? "path" : "binding",
      ...(source.urn ? { urn: source.urn } : {}),
      ...(source.path ? { path: source.path } : {}),
    },
    ...(source.description ? { description: source.description } : {}),
  };
}

function personaTemplate(persona) {
  return {
    id: persona.id,
    type: "persona_template",
    name: persona.name || persona.id,
    role: persona.role || "",
    domain: persona.domain || "",
    authority_level: persona.authority_level || "advisory",
    tone: persona.tone || "",
    must_follow: asArray(persona.must_follow),
    source: {
      kind: "knolet_spec",
      entity_id: persona.id,
      ...(persona.from_dot_tal ? { from_dot_tal: persona.from_dot_tal } : {}),
    },
  };
}

function skillBlockTemplate(skill) {
  return {
    id: skill.id,
    type: "skill_block",
    name: skill.name || skill.id,
    trigger: asArray(skill.trigger),
    description: skill.description || "",
    required_source_ids: asArray(skill.binds_to),
    output_schema: skill.output_schema || "untyped_output",
    source: {
      kind: "knolet_spec",
      entity_id: skill.id,
      ...(skill.from_dot_dance ? { from_dot_dance: skill.from_dot_dance } : {}),
    },
  };
}

function agentProfileTemplate(agent) {
  return {
    id: agent.id,
    type: "agent_profile",
    persona_template: agent.persona || "",
    skill_blocks: asArray(agent.skills),
    model: agent.model || {},
    tools: asArray(agent.tools),
    permissions: agent.permissions || {},
    memory: agent.memory || {},
    source: {
      kind: "knolet_spec",
      entity_id: agent.id,
      ...(agent.from_dot_performer ? { from_dot_performer: agent.from_dot_performer } : {}),
    },
  };
}

function workflowTemplate(spec, runtimePlan) {
  const workflow = spec?.workflow || {};
  return {
    id: workflow.id || "workflow.imported",
    type: "workflow_template",
    nodes: asArray(workflow.nodes),
    edges: asArray(workflow.edges),
    execution_steps: asArray(runtimePlan?.workflow?.steps),
    output_ui: spec?.app?.output_ui || {},
    source: {
      kind: "knolet_spec",
      entity_id: workflow.id || "workflow.imported",
      ...(workflow.from_dot_act ? { from_dot_act: workflow.from_dot_act } : {}),
    },
  };
}

function knowledgeAppTemplate(spec) {
  return {
    id: `${slug(spec?.metadata?.name, "knolet-app")}.app`,
    type: "knowledge_app_template",
    domain: spec?.domain || {},
    input_ui: spec?.app?.input_ui || {},
    output_ui: spec?.app?.output_ui || {},
    grounding_policy: spec?.knowledge?.grounding_policy || {},
    workflow: spec?.workflow?.id || "",
  };
}

function evaluationPackTemplate(spec) {
  return {
    id: "evaluation.runtime_checks",
    type: "evaluation_pack",
    checks: asArray(spec?.evaluation?.checks),
    grounding_policy: spec?.knowledge?.grounding_policy || {},
  };
}

function uiOutputTemplate(spec) {
  return {
    id: "ui.output.structured_report",
    type: "ui_output_template",
    output_ui: spec?.app?.output_ui || {},
    sections: asArray(spec?.app?.output_ui?.sections),
  };
}

function templateSummary(templates) {
  return {
    personaTemplates: templates.persona_templates.length,
    skillBlocks: templates.skill_blocks.length,
    agentProfiles: templates.agent_profiles.length,
    workflowTemplates: templates.workflow_templates.length,
    knowledgeAppTemplates: templates.knowledge_app_templates.length,
    evaluationPacks: templates.evaluation_packs.length,
    uiOutputTemplates: templates.ui_output_templates.length,
  };
}

function dependencySummary(spec) {
  return {
    source_kind: spec?.metadata?.source?.kind || "knolet",
    dot_assets: asArray(spec?.metadata?.source?.dot_assets),
    personas: asArray(spec?.personas).map((item) => item.id).filter(Boolean),
    skills: asArray(spec?.skills).map((item) => item.id).filter(Boolean),
    agents: asArray(spec?.agents).map((item) => item.id).filter(Boolean),
    workflow: spec?.workflow?.id || "",
  };
}

function compileKnoletLibraryPackage(spec, runtimePlan, graph, options = {}) {
  const diagnostics = [];
  const validation = validateKnoletSpec(spec);
  diagnostics.push(...validation.errors, ...validation.warnings);

  for (const item of asArray(runtimePlan?.diagnostics)) {
    diagnostics.push(item);
  }
  for (const item of asArray(graph?.diagnostics)) {
    diagnostics.push(item);
  }

  if (!runtimePlan) {
    diagnostics.push(
      diagnostic("warning", "library-runtime-plan-missing", "RuntimePlan was not provided for the library package."),
    );
  }
  if (!graph) {
    diagnostics.push(diagnostic("warning", "library-graph-missing", "Knolet graph model was not provided for the library package."));
  }
  if (!asArray(spec?.skills).length) {
    diagnostics.push(diagnostic("warning", "library-empty-skill-blocks", "Library package has no SkillBlock templates."));
  }
  if (!asArray(spec?.workflow?.nodes).length) {
    diagnostics.push(diagnostic("warning", "library-empty-workflow", "Library package has no workflow nodes."));
  }

  const source_bindings = asArray(spec?.knowledge?.sources).map((source) => sourceBinding(source, diagnostics));
  const templates = {
    persona_templates: asArray(spec?.personas).map(personaTemplate),
    skill_blocks: asArray(spec?.skills).map(skillBlockTemplate),
    agent_profiles: asArray(spec?.agents).map(agentProfileTemplate),
    workflow_templates: [workflowTemplate(spec, runtimePlan)],
    knowledge_app_templates: [knowledgeAppTemplate(spec)],
    evaluation_packs: [evaluationPackTemplate(spec)],
    ui_output_templates: [uiOutputTemplate(spec)],
  };

  const errors = diagnostics.filter((item) => item.level === "error");
  const warnings = diagnostics.filter((item) => item.level === "warning");
  const createdAt = options.createdAt || new Date().toISOString();

  return {
    library_package_version: LIBRARY_PACKAGE_VERSION,
    id: libraryPackageId(spec, options),
    createdAt,
    status: errors.length ? "blocked" : "shareable",
    metadata: {
      name: spec?.metadata?.name || "Knolet app template",
      description: spec?.metadata?.description || "Reusable Knolet knowledge app template.",
      owner: spec?.metadata?.owner || "local",
      stage: spec?.metadata?.stage || "local",
      source_spec: {
        id: spec?.metadata?.id || "",
        version: spec?.knolet_spec_version || "",
      },
      source_runtime_plan: {
        id: runtimePlan?.id || "",
        status: runtimePlan?.status || "",
      },
      source_graph: {
        id: graph?.id || "",
        status: graph?.status || "",
      },
    },
    summary: {
      shareReady: errors.length === 0,
      templateCount: Object.values(templateSummary(templates)).reduce((total, count) => total + count, 0),
      sourceBindingCount: source_bindings.length,
      dependencyCount: dependencySummary(spec).dot_assets.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      templates: templateSummary(templates),
    },
    source_bindings,
    templates,
    dependencies: dependencySummary(spec),
    share_policy: {
      forkable: true,
      publishable: errors.length === 0,
      source_documents: "bindings_only",
      copies_source_documents: false,
      notes: [
        "Library packages carry source pointers and binding requirements, not customer document content.",
        "Installers must rebind KnowledgeSource entries in the target workspace before execution.",
      ],
    },
    diagnostics,
    next: {
      milestone: "0.4.0 Knolet Library and Sharing",
      detail: "Add install/fork flows that rebind sources in the target workspace.",
    },
  };
}

module.exports = {
  LIBRARY_PACKAGE_VERSION,
  compileKnoletLibraryPackage,
};
