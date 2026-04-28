const fs = require("node:fs/promises");
const path = require("node:path");
const {
  KNOLET_SPEC_VERSION,
  diagnostic,
  validateKnoletSpec,
} = require("./schema");

const DOT_KINDS = ["tal", "dance", "performer", "act"];

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function slug(value, fallback = "item") {
  return String(value || fallback)
    .trim()
    .replace(/^@/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || fallback;
}

function parseDotUrn(urn) {
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

function idFromUrn(prefix, urn, fallback) {
  const descriptor = parseDotUrn(urn);
  return `${prefix}.${slug(descriptor?.name || fallback || urn, prefix)}`;
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
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

function urnFromPath(workspacePath, kind, filePath) {
  const relative = path.relative(path.join(workspacePath, kind), filePath);
  const parts = relative.split(path.sep);
  if (kind === "dance") {
    if (parts.length < 4 || parts.at(-1) !== "SKILL.md") {
      return null;
    }
    return `${kind}/${parts[0]}/${parts[1]}/${parts[2]}`;
  }
  if (parts.length < 3 || !parts.at(-1).endsWith(".json")) {
    return null;
  }
  return `${kind}/${parts[0]}/${parts[1]}/${path.basename(parts[2], ".json")}`;
}

function parseFrontmatter(markdown) {
  const text = String(markdown || "");
  if (!text.startsWith("---\n")) {
    return {};
  }
  const end = text.indexOf("\n---", 4);
  if (end === -1) {
    return {};
  }
  const frontmatter = {};
  for (const line of text.slice(4, end).split(/\r?\n/)) {
    const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (match) {
      frontmatter[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
  return frontmatter;
}

function firstMarkdownParagraph(markdown) {
  return String(markdown || "")
    .replace(/^---[\s\S]*?\n---/, "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .find((block) => block && !block.startsWith("#")) || "";
}

async function parseDotAsset(workspacePath, kind, filePath) {
  const urn = urnFromPath(workspacePath, kind, filePath);
  const relativePath = path.relative(process.cwd(), filePath);
  const content = await fs.readFile(filePath, "utf8");

  if (!urn) {
    return {
      asset: null,
      diagnostics: [
        diagnostic("warning", "unrecognized-dot-path", `Could not derive a DOT URN from ${relativePath}.`, relativePath),
      ],
    };
  }

  if (kind === "dance") {
    const frontmatter = parseFrontmatter(content);
    return {
      asset: {
        kind,
        urn,
        path: relativePath,
        raw: content,
        payload: {
          name: frontmatter.name || parseDotUrn(urn)?.name,
          description: frontmatter.description || firstMarkdownParagraph(content),
          frontmatter,
        },
      },
      diagnostics: [],
    };
  }

  try {
    const parsed = JSON.parse(content);
    return {
      asset: {
        kind,
        urn: parsed.urn || urn,
        path: relativePath,
        raw: parsed,
        payload: parsed.payload && isRecord(parsed.payload) ? parsed.payload : parsed,
      },
      diagnostics: [],
    };
  } catch (error) {
    return {
      asset: null,
      diagnostics: [
        diagnostic("error", "invalid-dot-json", `Could not parse ${relativePath}: ${error.message}`, relativePath),
      ],
    };
  }
}

async function scanDotWorkspace(workspacePath) {
  const diagnostics = [];
  const assets = [];

  for (const kind of DOT_KINDS) {
    const kindDir = path.join(workspacePath, kind);
    if (!(await exists(kindDir))) {
      diagnostics.push(
        diagnostic("warning", "missing-dot-directory", `Missing DOT ${kind} directory.`, path.relative(process.cwd(), kindDir)),
      );
      continue;
    }

    const files = (await walk(kindDir)).filter((filePath) =>
      kind === "dance" ? path.basename(filePath) === "SKILL.md" : filePath.endsWith(".json"),
    );

    if (files.length === 0) {
      diagnostics.push(
        diagnostic("warning", "empty-dot-directory", `DOT ${kind} directory has no importable assets.`, path.relative(process.cwd(), kindDir)),
      );
    }

    for (const filePath of files) {
      const parsed = await parseDotAsset(workspacePath, kind, filePath);
      diagnostics.push(...parsed.diagnostics);
      if (parsed.asset) {
        assets.push(parsed.asset);
      }
    }
  }

  return { assets, diagnostics };
}

function normalizeTools(tools) {
  if (Array.isArray(tools)) {
    return tools;
  }
  if (!isRecord(tools)) {
    return [];
  }
  return Object.entries(tools)
    .flatMap(([group, values]) => asArray(values).map((value) => (group === "local" ? String(value) : `${group}:${value}`)))
    .filter(Boolean);
}

function normalizeKnowledgeSource(source) {
  if (!isRecord(source)) {
    return null;
  }
  const id = slug(source.id || source.name || source.type, "");
  if (!id) {
    return null;
  }
  return {
    id,
    type: source.type || "manual_note",
    label: source.label || source.name || id,
    ...(source.description ? { description: String(source.description) } : {}),
    ...(source.required !== undefined ? { required: source.required === true } : {}),
    ...(source.path ? { path: String(source.path) } : {}),
    ...(source.urn ? { urn: String(source.urn) } : {}),
    ...(source.content ? { content: String(source.content) } : {}),
  };
}

function normalizeKnowledgeSources(sources) {
  const byId = new Map();
  for (const source of asArray(sources).map(normalizeKnowledgeSource).filter(Boolean)) {
    byId.set(source.id, source);
  }
  if (!byId.has("workspace_documents")) {
    byId.set("workspace_documents", {
      id: "workspace_documents",
      type: "workspace_document",
      label: "Workspace documents",
      required: false,
    });
  }
  return [...byId.values()];
}

function normalizeSkillBindings(rawBindings) {
  if (!isRecord(rawBindings)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(rawBindings).map(([skillId, sourceIds]) => [
      skillId,
      [...new Set(asArray(sourceIds).map((sourceId) => slug(sourceId, "")).filter(Boolean))],
    ]),
  );
}

function mapRelationEndpoint(value, participantToAgent, agentIds) {
  if (!value) {
    return null;
  }
  if (participantToAgent.has(value)) {
    return participantToAgent.get(value);
  }
  if (agentIds.has(value)) {
    return value;
  }
  return null;
}

function normalizeParticipants(participants) {
  if (Array.isArray(participants)) {
    return participants.map((participant, index) => ({
      id: participant.id || participant.key || `participant_${index + 1}`,
      performer: participant.performer || participant.performerRef?.urn,
    }));
  }
  if (isRecord(participants)) {
    return Object.entries(participants).map(([id, participant]) => ({
      id,
      performer: participant.performer || participant.performerRef?.urn,
    }));
  }
  return [];
}

function normalizeRelations(relations, participantToAgent, agentIds, diagnostics, actUrn) {
  return asArray(relations)
    .map((relation, index) => {
      const fromRaw = relation.from || relation.source || relation.sourceParticipant || relation.left;
      const toRaw = relation.to || relation.target || relation.targetParticipant || relation.right;
      const from = mapRelationEndpoint(fromRaw, participantToAgent, agentIds);
      const to = mapRelationEndpoint(toRaw, participantToAgent, agentIds);

      if (!from || !to) {
        diagnostics.push(
          diagnostic(
            "warning",
            "unmapped-workflow-relation",
            `Could not map relation ${index + 1} in ${actUrn} to RuntimeAgent nodes.`,
            `workflow.edges.${index}`,
          ),
        );
      }

      return {
        from: from || String(fromRaw || ""),
        to: to || String(toRaw || ""),
        direction: relation.direction || (relation.bidirectional ? "both" : "one-way"),
        ...(relation.payload ? { payload: relation.payload } : {}),
      };
    })
    .filter((edge) => edge.from && edge.to);
}

function mapDotAssetsToKnoletSpec(assets, options = {}) {
  const diagnostics = [...(options.diagnostics || [])];
  const knowledgeSources = normalizeKnowledgeSources(options.knowledgeSources);
  const skillBindings = normalizeSkillBindings(options.skillBindings);
  const byKind = Object.fromEntries(DOT_KINDS.map((kind) => [kind, assets.filter((asset) => asset.kind === kind)]));
  const workspace = options.workspace || {};
  const primaryAct = byKind.act[0] || null;
  const primaryDescriptor = parseDotUrn(primaryAct?.urn) || parseDotUrn(assets[0]?.urn) || {};
  const workspaceName = workspace.name || primaryDescriptor.name || "imported-dot-workspace";
  const owner = workspace.owner || primaryDescriptor.owner || "local";
  const stage = workspace.stage || primaryDescriptor.stage || "local";

  const talToPersona = new Map();
  const danceToSkill = new Map();
  const performerToAgent = new Map();

  const personas = byKind.tal.map((asset) => {
    const payload = asset.payload || {};
    const id = idFromUrn("persona", asset.urn, payload.name);
    talToPersona.set(asset.urn, id);
    return {
      id,
      from_dot_tal: asset.urn,
      name: payload.name || parseDotUrn(asset.urn)?.name || id,
      domain: payload.domain || "imported_dot_workspace",
      role: payload.role || payload.summary || payload.description || payload.name || "Domain knowledge worker",
      authority_level: payload.authority_level || "advisory",
      tone: payload.tone || "concise, audit-friendly",
      must_follow: asArray(payload.must_follow || payload.instructions),
    };
  });

  const skills = byKind.dance.map((asset) => {
    const payload = asset.payload || {};
    const id = idFromUrn("skill", asset.urn, payload.name);
    danceToSkill.set(asset.urn, id);
    return {
      id,
      from_dot_dance: asset.urn,
      name: payload.name || parseDotUrn(asset.urn)?.name || id,
      trigger: [payload.name, payload.description].filter(Boolean),
      binds_to: skillBindings[id] || [],
      output_schema: "untyped_output",
      description: payload.description || "",
    };
  });

  for (const skill of skills) {
    if (!skill.binds_to.length) {
      diagnostics.push(
        diagnostic(
          "warning",
          "missing-knowledge-binding",
          `SkillBlock ${skill.id} has no KnowledgeSource binding yet.`,
          skill.id,
        ),
      );
    }
  }

  const agents = byKind.performer.map((asset) => {
    const payload = asset.payload || {};
    const id = idFromUrn("agent", asset.urn, payload.name);
    performerToAgent.set(asset.urn, id);
    const persona = talToPersona.get(payload.tal) || null;
    if (payload.tal && !persona) {
      diagnostics.push(
        diagnostic("warning", "unknown-dot-tal-reference", `Performer ${asset.urn} references missing Tal ${payload.tal}.`, asset.urn),
      );
    }

    const mappedSkills = asArray(payload.dances)
      .map((danceUrn) => {
        const skillId = danceToSkill.get(danceUrn);
        if (!skillId) {
          diagnostics.push(
            diagnostic(
              "warning",
              "unknown-dot-dance-reference",
              `Performer ${asset.urn} references missing Dance ${danceUrn}.`,
              asset.urn,
            ),
          );
        }
        return skillId;
      })
      .filter(Boolean);

    return {
      id,
      from_dot_performer: asset.urn,
      persona,
      skills: mappedSkills,
      model: payload.model || {},
      tools: normalizeTools(payload.tools || payload.mcp_config),
      memory: { scope: "workflow_run" },
      permissions: {
        can_read: ["current_workspace_documents"],
        cannot: ["send_external_email", "modify_source_documents"],
      },
    };
  });

  const agentIds = new Set(agents.map((agent) => agent.id));
  let workflowNodes = agents.map((agent) => agent.id);
  let workflowEdges = [];
  let fromDotAct = null;

  if (primaryAct) {
    const payload = primaryAct.payload || {};
    fromDotAct = primaryAct.urn;
    const participants = normalizeParticipants(payload.participants);
    const participantToAgent = new Map();
    workflowNodes = [];

    for (const participant of participants) {
      const agentId = performerToAgent.get(participant.performer);
      if (!agentId) {
        diagnostics.push(
          diagnostic(
            "warning",
            "unknown-dot-performer-reference",
            `Act ${primaryAct.urn} references missing Performer ${participant.performer}.`,
            primaryAct.urn,
          ),
        );
        continue;
      }
      participantToAgent.set(participant.id, agentId);
      workflowNodes.push(agentId);
    }

    if (workflowNodes.length === 0) {
      workflowNodes = agents.map((agent) => agent.id);
      diagnostics.push(
        diagnostic(
          "warning",
          "empty-workflow-participants",
          `Act ${primaryAct.urn} did not produce workflow nodes; falling back to all RuntimeAgents.`,
          primaryAct.urn,
        ),
      );
    }

    workflowEdges = normalizeRelations(payload.relations, participantToAgent, agentIds, diagnostics, primaryAct.urn);
  } else {
    diagnostics.push(diagnostic("warning", "missing-dot-act", "No DOT Act found; workflow uses all imported RuntimeAgents."));
  }

  const spec = {
    knolet_spec_version: KNOLET_SPEC_VERSION,
    metadata: {
      id: `knolet://workspace/${slug(owner)}/${slug(stage)}/${slug(workspaceName)}`,
      name: workspaceName,
      description: "Imported from a dance-of-tal workspace.",
      owner,
      stage,
      source: {
        kind: "dance-of-tal",
        dot_assets: assets.map((asset) => asset.urn).sort(),
      },
    },
    domain: {
      name: "imported_dot_workspace",
      object_types: ["document", "knowledge_source", "workflow_output"],
    },
    knowledge: {
      sources: knowledgeSources,
      grounding_policy: {
        require_citations: true,
        allow_uncited_recommendations: false,
        uncertainty_required: true,
      },
    },
    personas,
    skills,
    agents,
    workflow: {
      id: idFromUrn("workflow", fromDotAct, workspaceName),
      ...(fromDotAct ? { from_dot_act: fromDotAct } : {}),
      nodes: [...new Set(workflowNodes)],
      edges: workflowEdges,
    },
    app: {
      input_ui: {
        type: "upload_plus_form",
        fields: ["source_document", "target_user", "runtime_constraints"],
      },
      output_ui: {
        type: "structured_report",
        sections: ["knowledge_structure", "knolet_spec", "runtime_app_plan", "version_fork_share"],
      },
    },
    evaluation: {
      checks: ["citations_exist", "output_schema_valid", "knowledge_bindings_declared"],
    },
  };

  return { spec, diagnostics };
}

async function readWorkspaceMetadata(workspacePath) {
  const metadataPath = path.join(workspacePath, "workspace.json");
  try {
    return JSON.parse(await fs.readFile(metadataPath, "utf8"));
  } catch {
    return {};
  }
}

async function importDotWorkspace(inputPath, options = {}) {
  const workspacePath = path.resolve(inputPath);
  const workspace = await readWorkspaceMetadata(workspacePath);
  const scan = await scanDotWorkspace(workspacePath);
  const mapped = mapDotAssetsToKnoletSpec(scan.assets, {
    ...options,
    workspace,
    diagnostics: scan.diagnostics,
  });
  const validation = validateKnoletSpec(mapped.spec);
  return {
    spec: mapped.spec,
    diagnostics: [...mapped.diagnostics, ...validation.errors, ...validation.warnings],
    assets: scan.assets.map((asset) => ({
      kind: asset.kind,
      urn: asset.urn,
      path: asset.path,
    })),
    validation,
  };
}

module.exports = {
  DOT_KINDS,
  parseDotUrn,
  scanDotWorkspace,
  mapDotAssetsToKnoletSpec,
  importDotWorkspace,
};
