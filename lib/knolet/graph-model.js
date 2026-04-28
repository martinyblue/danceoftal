const { diagnostic } = require("./schema");

const GRAPH_MODEL_VERSION = "0.1";
const NODE_TYPES = ["source", "persona", "skill", "agent", "workflow_step", "evaluation", "output"];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function graphNode(type, id, label, data = {}) {
  return {
    id,
    type,
    label: label || id,
    data,
  };
}

function graphEdge(type, from, to, data = {}) {
  return {
    id: `${type}:${from}->${to}`,
    type,
    from,
    to,
    data,
  };
}

function nodeId(type, id) {
  return `${type}:${id}`;
}

function edgeExists(edges, type, from, to) {
  return edges.some((edge) => edge.type === type && edge.from === from && edge.to === to);
}

function typeBreakdown(nodes) {
  return Object.fromEntries(NODE_TYPES.map((type) => [type, nodes.filter((node) => node.type === type).length]));
}

function validateGraph(nodes, edges) {
  const diagnostics = [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const nodesByType = Object.fromEntries(NODE_TYPES.map((type) => [type, nodes.filter((node) => node.type === type)]));

  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      diagnostics.push(
        diagnostic("error", "graph-edge-missing-node", `Graph edge ${edge.id} references a missing node.`, edge.id),
      );
    }
  }

  for (const agent of nodesByType.agent) {
    if (!edges.some((edge) => edge.type === "uses_persona" && edge.from === agent.id)) {
      diagnostics.push(
        diagnostic("error", "graph-agent-missing-persona", `Agent node ${agent.id} has no Persona edge.`, agent.id),
      );
    }
    if (!edges.some((edge) => edge.type === "has_skill" && edge.from === agent.id)) {
      diagnostics.push(
        diagnostic("warning", "graph-agent-missing-skill", `Agent node ${agent.id} has no Skill edge.`, agent.id),
      );
    }
  }

  for (const skill of nodesByType.skill) {
    if (!edges.some((edge) => edge.type === "binds_to" && edge.from === skill.id)) {
      diagnostics.push(
        diagnostic("warning", "graph-skill-missing-source", `Skill node ${skill.id} has no Source binding edge.`, skill.id),
      );
    }
  }

  for (const step of nodesByType.workflow_step) {
    if (!edges.some((edge) => edge.type === "runs_step" && edge.to === step.id)) {
      diagnostics.push(
        diagnostic("error", "graph-step-missing-agent", `Workflow Step node ${step.id} is not connected to an Agent.`, step.id),
      );
    }
  }

  for (const output of nodesByType.output) {
    if (!edges.some((edge) => edge.to === output.id || edge.from === output.id)) {
      diagnostics.push(
        diagnostic("warning", "graph-output-isolated", `Output node ${output.id} is isolated.`, output.id),
      );
    }
  }

  for (const evaluation of nodesByType.evaluation) {
    if (!edges.some((edge) => edge.to === evaluation.id || edge.from === evaluation.id)) {
      diagnostics.push(
        diagnostic("warning", "graph-evaluation-isolated", `Evaluation node ${evaluation.id} is isolated.`, evaluation.id),
      );
    }
  }

  return diagnostics;
}

function compileKnoletGraphModel(spec, runtimePlan, options = {}) {
  const nodes = [];
  const edges = [];
  const createdAt = options.createdAt || new Date().toISOString();
  const graphId = options.id || `knolet-graph-${createdAt.replace(/[:.]/g, "-")}`;

  for (const source of asArray(spec?.knowledge?.sources)) {
    nodes.push(
      graphNode("source", nodeId("source", source.id), source.label || source.id, {
        source_id: source.id,
        source_type: source.type,
        required: source.required === true,
      }),
    );
  }

  for (const persona of asArray(spec?.personas)) {
    nodes.push(
      graphNode("persona", nodeId("persona", persona.id), persona.name || persona.id, {
        persona_id: persona.id,
        role: persona.role || "",
      }),
    );
  }

  for (const skill of asArray(spec?.skills)) {
    const skillNodeId = nodeId("skill", skill.id);
    nodes.push(
      graphNode("skill", skillNodeId, skill.name || skill.id, {
        skill_id: skill.id,
        output_schema: skill.output_schema || "untyped_output",
      }),
    );
    for (const sourceId of asArray(skill.binds_to)) {
      edges.push(graphEdge("binds_to", skillNodeId, nodeId("source", sourceId)));
    }
  }

  for (const agent of asArray(spec?.agents)) {
    const agentNodeId = nodeId("agent", agent.id);
    nodes.push(
      graphNode("agent", agentNodeId, agent.id, {
        agent_id: agent.id,
        model: agent.model || {},
      }),
    );
    if (agent.persona) {
      edges.push(graphEdge("uses_persona", agentNodeId, nodeId("persona", agent.persona)));
    }
    for (const skillId of asArray(agent.skills)) {
      edges.push(graphEdge("has_skill", agentNodeId, nodeId("skill", skillId)));
    }
  }

  for (const step of asArray(runtimePlan?.workflow?.steps)) {
    const stepNodeId = nodeId("workflow_step", step.id);
    nodes.push(
      graphNode("workflow_step", stepNodeId, step.id, {
        step_id: step.id,
        step_type: step.type,
        agent: step.agent || "",
        from: step.from || "",
        to: step.to || "",
        direction: step.direction || "",
      }),
    );
    if (step.agent) {
      edges.push(graphEdge("runs_step", nodeId("agent", step.agent), stepNodeId));
    }
    if (step.from) {
      edges.push(graphEdge("runs_step", nodeId("agent", step.from), stepNodeId, { role: "from" }));
    }
    if (step.to) {
      edges.push(graphEdge("runs_step", nodeId("agent", step.to), stepNodeId, { role: "to" }));
    }
  }

  const outputNodeId = nodeId("output", "structured_report");
  nodes.push(
    graphNode("output", outputNodeId, "Structured report", {
      sections: asArray(spec?.app?.output_ui?.sections),
    }),
  );
  for (const step of asArray(runtimePlan?.workflow?.steps)) {
    edges.push(graphEdge("produces", nodeId("workflow_step", step.id), outputNodeId));
  }

  const evaluationNodeId = nodeId("evaluation", "runtime_checks");
  nodes.push(
    graphNode("evaluation", evaluationNodeId, "Runtime checks", {
      checks: asArray(spec?.evaluation?.checks),
    }),
  );
  if (nodes.some((node) => node.id === outputNodeId)) {
    edges.push(graphEdge("evaluates", evaluationNodeId, outputNodeId));
  }

  const uniqueEdges = [];
  for (const edge of edges) {
    if (!edgeExists(uniqueEdges, edge.type, edge.from, edge.to)) {
      uniqueEdges.push(edge);
    }
  }

  const diagnostics = [...asArray(runtimePlan?.diagnostics), ...validateGraph(nodes, uniqueEdges)];
  const errors = diagnostics.filter((item) => item.level === "error");
  const warnings = diagnostics.filter((item) => item.level === "warning");

  return {
    graph_model_version: GRAPH_MODEL_VERSION,
    id: graphId,
    createdAt,
    status: errors.length ? "blocked" : "ready",
    source_spec: runtimePlan?.source_spec || {
      id: spec?.metadata?.id || "",
      name: spec?.metadata?.name || "Knolet app",
      version: spec?.knolet_spec_version || "",
    },
    source_runtime_plan: {
      id: runtimePlan?.id || "",
      status: runtimePlan?.status || "",
    },
    summary: {
      ready: errors.length === 0,
      nodeCount: nodes.length,
      edgeCount: uniqueEdges.length,
      typeBreakdown: typeBreakdown(nodes),
      errorCount: errors.length,
      warningCount: warnings.length,
    },
    nodes,
    edges: uniqueEdges,
    diagnostics,
    next: {
      milestone: "0.3.6 DOT Studio Graph Rendering",
      detail: "Use this graph model as the intermediate canvas structure for visual editing.",
    },
  };
}

module.exports = {
  GRAPH_MODEL_VERSION,
  NODE_TYPES,
  compileKnoletGraphModel,
};
