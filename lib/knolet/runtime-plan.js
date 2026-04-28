const { diagnostic, validateKnoletSpec } = require("./schema");

const RUNTIME_PLAN_VERSION = "0.1";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function byId(items) {
  return new Map(asArray(items).map((item) => [item?.id, item]).filter(([id]) => Boolean(id)));
}

function runtimeDiagnostic(level, code, message, path = "") {
  return diagnostic(level, code, message, path);
}

function compactSource(source) {
  return {
    id: source.id,
    type: source.type,
    label: source.label || source.id,
    required: source.required === true,
    ...(source.path ? { path: source.path } : {}),
    ...(source.urn ? { urn: source.urn } : {}),
  };
}

function skillRuntimeView(skill, sourcesById, diagnostics, path) {
  const sourceIds = asArray(skill?.binds_to);
  if (!sourceIds.length) {
    diagnostics.push(
      runtimeDiagnostic("error", "runtime-skill-unbound", `SkillBlock ${skill?.id || "unknown"} has no KnowledgeSource binding.`, path),
    );
  }
  const knowledgeSources = sourceIds
    .map((sourceId, index) => {
      const source = sourcesById.get(sourceId);
      if (!source) {
        diagnostics.push(
          runtimeDiagnostic(
            "error",
            "runtime-unknown-knowledge-source",
            `SkillBlock ${skill?.id || "unknown"} references missing KnowledgeSource ${sourceId}.`,
            `${path}.binds_to.${index}`,
          ),
        );
        return null;
      }
      if (source.required && !(source.path || source.urn || source.content || source.description || source.label)) {
        diagnostics.push(
          runtimeDiagnostic(
            "warning",
            "runtime-required-source-empty",
            `Required KnowledgeSource ${source.id} needs source details before execution.`,
            `knowledge.sources.${source.id}`,
          ),
        );
      }
      return compactSource(source);
    })
    .filter(Boolean);

  return {
    id: skill.id,
    name: skill.name || skill.id,
    output_schema: skill.output_schema || "untyped_output",
    knowledge_sources: knowledgeSources,
  };
}

function compileKnoletRuntimePlan(spec, options = {}) {
  const diagnostics = [];
  const validation = validateKnoletSpec(spec);
  diagnostics.push(...validation.errors, ...validation.warnings);

  const personasById = byId(spec?.personas);
  const skillsById = byId(spec?.skills);
  const agentsById = byId(spec?.agents);
  const sourcesById = byId(spec?.knowledge?.sources);
  const workflowNodes = asArray(spec?.workflow?.nodes);
  const workflowEdges = asArray(spec?.workflow?.edges);
  const runtimeNodeIds = workflowNodes.length ? workflowNodes : asArray(spec?.agents).map((agent) => agent.id).filter(Boolean);
  const nodeSet = new Set(runtimeNodeIds);

  const participants = runtimeNodeIds
    .map((agentId, index) => {
      const agent = agentsById.get(agentId);
      if (!agent) {
        diagnostics.push(
          runtimeDiagnostic("error", "runtime-missing-agent", `Workflow node ${agentId} does not match a RuntimeAgent.`, `workflow.nodes.${index}`),
        );
        return null;
      }
      const persona = personasById.get(agent.persona);
      if (!agent.persona || !persona) {
        diagnostics.push(
          runtimeDiagnostic("error", "runtime-missing-persona", `RuntimeAgent ${agent.id} needs a valid Persona before execution.`, `agents.${agent.id}.persona`),
        );
      }

      const skills = asArray(agent.skills)
        .map((skillId, skillIndex) => {
          const skill = skillsById.get(skillId);
          if (!skill) {
            diagnostics.push(
              runtimeDiagnostic("error", "runtime-missing-skill", `RuntimeAgent ${agent.id} references missing SkillBlock ${skillId}.`, `agents.${agent.id}.skills.${skillIndex}`),
            );
            return null;
          }
          return skillRuntimeView(skill, sourcesById, diagnostics, `skills.${skill.id}`);
        })
        .filter(Boolean);

      return {
        id: agent.id,
        persona: persona
          ? {
              id: persona.id,
              name: persona.name || persona.id,
              role: persona.role || "",
            }
          : null,
        skills,
        model: agent.model || {},
        tools: asArray(agent.tools),
        permissions: agent.permissions || {},
      };
    })
    .filter(Boolean);

  const edges = workflowEdges.map((edge, index) => {
    for (const key of ["from", "to"]) {
      if (!nodeSet.has(edge?.[key])) {
        diagnostics.push(
          runtimeDiagnostic(
            "error",
            "runtime-invalid-edge-endpoint",
            `Workflow edge ${key} references ${edge?.[key] || "empty"} outside runtime nodes.`,
            `workflow.edges.${index}.${key}`,
          ),
        );
      }
    }
    return {
      from: edge.from || "",
      to: edge.to || "",
      direction: edge.direction || "one-way",
      ...(edge.payload ? { payload: edge.payload } : {}),
    };
  });

  const steps = edges.length
    ? edges.map((edge, index) => ({
        id: `step_${index + 1}`,
        type: "agent_relation",
        from: edge.from,
        to: edge.to,
        direction: edge.direction,
      }))
    : participants.map((participant, index) => ({
        id: `step_${index + 1}`,
        type: "agent_task",
        agent: participant.id,
      }));

  const errors = diagnostics.filter((item) => item.level === "error");
  const warnings = diagnostics.filter((item) => item.level === "warning");
  const createdAt = options.createdAt || new Date().toISOString();
  const id = options.id || `runtime-plan-${createdAt.replace(/[:.]/g, "-")}`;

  return {
    runtime_plan_version: RUNTIME_PLAN_VERSION,
    id,
    createdAt,
    status: errors.length ? "blocked" : "ready",
    source_spec: {
      id: spec?.metadata?.id || "",
      name: spec?.metadata?.name || "Knolet app",
      version: spec?.knolet_spec_version || "",
    },
    summary: {
      ready: errors.length === 0,
      participantsCount: participants.length,
      stepsCount: steps.length,
      edgesCount: edges.length,
      errorCount: errors.length,
      warningCount: warnings.length,
    },
    participants,
    workflow: {
      id: spec?.workflow?.id || "workflow.imported",
      nodes: runtimeNodeIds,
      edges,
      steps,
    },
    diagnostics,
    run_log: {
      id: `run-${createdAt.replace(/[:.]/g, "-")}`,
      status: "planned",
      createdAt,
      events: [
        {
          at: createdAt,
          type: "runtime-plan-created",
          message: errors.length ? "Runtime plan created with blocking diagnostics." : "Runtime plan ready for execution handoff.",
        },
      ],
    },
  };
}

module.exports = {
  RUNTIME_PLAN_VERSION,
  compileKnoletRuntimePlan,
};
