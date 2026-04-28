const KNOLET_SPEC_VERSION = "0.1";
const RELATION_DIRECTIONS = new Set(["one-way", "both"]);
const KNOWLEDGE_SOURCE_TYPES = new Set(["workspace_document", "uploaded_file", "registry_asset", "manual_note"]);

function diagnostic(level, code, message, path = "") {
  return {
    level,
    code,
    message,
    ...(path ? { path } : {}),
  };
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function pushRequiredObject(errors, spec, key) {
  if (!isRecord(spec?.[key])) {
    errors.push(diagnostic("error", "missing-section", `${key} must be an object.`, key));
  }
}

function pushRequiredArray(errors, spec, key) {
  if (!Array.isArray(spec?.[key])) {
    errors.push(diagnostic("error", "missing-section", `${key} must be an array.`, key));
  }
}

function entityIdSet(items) {
  return new Set(asArray(items).map((item) => item?.id).filter(Boolean));
}

function validateKnoletSpec(spec) {
  const errors = [];
  const warnings = [];

  if (!isRecord(spec)) {
    return {
      ok: false,
      errors: [diagnostic("error", "invalid-spec", "KnoletSpec must be an object.")],
      warnings,
    };
  }

  if (String(spec.knolet_spec_version || "") !== KNOLET_SPEC_VERSION) {
    errors.push(
      diagnostic(
        "error",
        "invalid-version",
        `knolet_spec_version must be ${KNOLET_SPEC_VERSION}.`,
        "knolet_spec_version",
      ),
    );
  }

  for (const key of ["metadata", "domain", "knowledge", "workflow", "app", "evaluation"]) {
    pushRequiredObject(errors, spec, key);
  }
  for (const key of ["personas", "skills", "agents"]) {
    pushRequiredArray(errors, spec, key);
  }

  const source = spec.metadata?.source;
  if (source?.kind === "dance-of-tal" && !Array.isArray(source.dot_assets)) {
    errors.push(
      diagnostic(
        "error",
        "invalid-dot-assets",
        "metadata.source.dot_assets must be an array when source.kind is dance-of-tal.",
        "metadata.source.dot_assets",
      ),
    );
  }

  const personaIds = entityIdSet(spec.personas);
  const skillIds = entityIdSet(spec.skills);
  const agentIds = entityIdSet(spec.agents);
  const workflowNodes = new Set(asArray(spec.workflow?.nodes));
  const knowledgeSources = asArray(spec.knowledge?.sources);
  const knowledgeSourceIds = entityIdSet(knowledgeSources);
  const seenKnowledgeSourceIds = new Set();

  knowledgeSources.forEach((source, index) => {
    if (!source?.id) {
      errors.push(diagnostic("error", "missing-id", "KnowledgeSource must include an id.", `knowledge.sources.${index}.id`));
      return;
    }
    if (seenKnowledgeSourceIds.has(source.id)) {
      errors.push(
        diagnostic("error", "duplicate-knowledge-source", `KnowledgeSource id ${source.id} is duplicated.`, `knowledge.sources.${index}.id`),
      );
    }
    seenKnowledgeSourceIds.add(source.id);
    if (!KNOWLEDGE_SOURCE_TYPES.has(source.type)) {
      errors.push(
        diagnostic(
          "error",
          "invalid-knowledge-source-type",
          `KnowledgeSource ${source.id} must use a supported type.`,
          `knowledge.sources.${index}.type`,
        ),
      );
    }
    if (source.required && !(source.path || source.urn || source.content || source.description || source.label)) {
      warnings.push(
        diagnostic(
          "warning",
          "required-knowledge-source-empty",
          `Required KnowledgeSource ${source.id} needs a path, urn, content, label, or description.`,
          `knowledge.sources.${index}`,
        ),
      );
    }
  });

  asArray(spec.personas).forEach((persona, index) => {
    if (!persona?.id) {
      errors.push(diagnostic("error", "missing-id", "Persona must include an id.", `personas.${index}.id`));
    }
    if (!persona?.role) {
      warnings.push(
        diagnostic("warning", "missing-role", "Persona should include a domain role.", `personas.${index}.role`),
      );
    }
  });

  asArray(spec.skills).forEach((skill, index) => {
    if (!skill?.id) {
      errors.push(diagnostic("error", "missing-id", "SkillBlock must include an id.", `skills.${index}.id`));
    }
    if (!Array.isArray(skill?.binds_to) || skill.binds_to.length === 0) {
      warnings.push(
        diagnostic(
          "warning",
          "missing-knowledge-binding",
          "SkillBlock should bind to at least one KnowledgeSource.",
          `skills.${index}.binds_to`,
        ),
      );
    }
    asArray(skill?.binds_to).forEach((sourceId, sourceIndex) => {
      if (!knowledgeSourceIds.has(sourceId)) {
        errors.push(
          diagnostic(
            "error",
            "unknown-knowledge-source",
            `SkillBlock references unknown KnowledgeSource ${sourceId}.`,
            `skills.${index}.binds_to.${sourceIndex}`,
          ),
        );
      }
    });
  });

  asArray(spec.agents).forEach((agent, index) => {
    if (!agent?.id) {
      errors.push(diagnostic("error", "missing-id", "RuntimeAgent must include an id.", `agents.${index}.id`));
    }
    if (agent?.persona && !personaIds.has(agent.persona)) {
      errors.push(
        diagnostic(
          "error",
          "unknown-persona",
          `RuntimeAgent references unknown Persona ${agent.persona}.`,
          `agents.${index}.persona`,
        ),
      );
    }
    asArray(agent?.skills).forEach((skillId, skillIndex) => {
      if (!skillIds.has(skillId)) {
        errors.push(
          diagnostic(
            "error",
            "unknown-skill",
            `RuntimeAgent references unknown SkillBlock ${skillId}.`,
            `agents.${index}.skills.${skillIndex}`,
          ),
        );
      }
    });
  });

  asArray(spec.workflow?.nodes).forEach((nodeId, index) => {
    if (!agentIds.has(nodeId)) {
      errors.push(
        diagnostic(
          "error",
          "unknown-workflow-node",
          `Workflow node references unknown RuntimeAgent ${nodeId}.`,
          `workflow.nodes.${index}`,
        ),
      );
    }
  });

  asArray(spec.workflow?.edges).forEach((edge, index) => {
    if (!RELATION_DIRECTIONS.has(edge?.direction)) {
      errors.push(
        diagnostic(
          "error",
          "invalid-relation-direction",
          'Workflow relation direction must be "one-way" or "both".',
          `workflow.edges.${index}.direction`,
        ),
      );
    }
    for (const key of ["from", "to"]) {
      if (!edge?.[key]) {
        errors.push(
          diagnostic("error", "missing-relation-endpoint", `Workflow edge must include ${key}.`, `workflow.edges.${index}.${key}`),
        );
      } else if (!workflowNodes.has(edge[key])) {
        errors.push(
          diagnostic(
            "error",
            "unknown-relation-endpoint",
            `Workflow edge ${key} references unknown node ${edge[key]}.`,
            `workflow.edges.${index}.${key}`,
          ),
        );
      }
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

module.exports = {
  KNOLET_SPEC_VERSION,
  KNOWLEDGE_SOURCE_TYPES,
  RELATION_DIRECTIONS,
  diagnostic,
  validateKnoletSpec,
};
