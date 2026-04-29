# Knolet Roadmap

This roadmap upgrades the project direction from a local `dance-of-tal` manager
into a Knolet-oriented knowledge workflow app builder.

Core framing:

```text
dance-of-tal = lower-level agent package and choreography structure
Knolet       = product grammar for domain knowledge workflow apps
```

Knolet should wrap DOT assets instead of exposing them as the primary product
model. Users should work with personas, skills, runtime workers, knowledge
sources, workflows, evaluation, and app outputs.

## Concept Mapping

- `Tal` -> `Persona`
  A domain role with authority, tone, constraints, evidence rules, and
  uncertainty behavior.
- `Dance` -> `SkillBlock`
  A reusable skill with triggers, knowledge bindings, and an explicit output
  contract.
- `Performer` -> `RuntimeAgent` / `Worker`
  A runnable work unit with persona, skills, model, tools, source permissions,
  memory scope, validation, and run logs.
- `Act` -> `Workflow` / `Knowledge Choreography`
  A graph that defines participants, relations, source flow, approval,
  evaluation, and final app output.
- `DOT Studio` -> `Knolet Studio`
  A knowledge app builder with source, skill, agent, evaluation, approval, and
  output nodes.
- `dot` CLI -> Knolet importer/exporter/registry/runtime compiler.

## KnoletSpec v0.1

`KnoletSpec` is the normalized boundary between imported DOT assets and a
Knolet app.

Required top-level sections:

```text
metadata
domain
knowledge
personas
skills
agents
workflow
app
evaluation
```

Minimal shape:

```yaml
knolet_spec_version: 0.1
metadata:
  id: knolet://workspace/domain/stage/name
  name: Contract Risk Review App
  owner: team-legal-ops
  stage: mvp
  source:
    kind: dance-of-tal
    dot_assets:
      - tal/@legal/mvp/compliance-reviewer
      - dance/@legal/mvp/contract-risk
      - performer/@legal/mvp/risk-reviewer
      - act/@legal/mvp/contract-review-flow
domain:
  name: legal_ops
  object_types:
    - contract
    - clause
    - policy
knowledge:
  sources:
    - id: uploaded_contract
      type: user_uploaded_document
      required: true
  grounding_policy:
    require_citations: true
    allow_uncited_recommendations: false
    uncertainty_required: true
personas:
  - id: persona.compliance_reviewer
    from_dot_tal: tal/@legal/mvp/compliance-reviewer
    role: Evidence-based legal operations reviewer
skills:
  - id: skill.contract_risk_review
    from_dot_dance: dance/@legal/mvp/contract-risk
    binds_to:
      - uploaded_contract
    output_schema: risk_finding_list
agents:
  - id: agent.risk_reviewer
    from_dot_performer: performer/@legal/mvp/risk-reviewer
    persona: persona.compliance_reviewer
    skills:
      - skill.contract_risk_review
workflow:
  id: workflow.contract_review
  from_dot_act: act/@legal/mvp/contract-review-flow
  nodes:
    - agent.risk_reviewer
  edges:
    - from: agent.risk_reviewer
      to: agent.report_writer
      direction: one-way
app:
  input_ui:
    type: upload_plus_form
  output_ui:
    type: structured_report
evaluation:
  checks:
    - citations_exist
    - output_schema_valid
```

## Phase 1: Compatibility MVP

Goal: import a `.dance-of-tal/` workspace and generate a valid `KnoletSpec`.

Scope:

- workspace scanner for `.dance-of-tal/`
- Tal/Dance/Performer/Act parser
- DOT raw asset diagnostics
- `KnoletSpec v0.1` schema
- DOT-to-Knolet mapper
- warnings for missing knowledge bindings
- fixtures and validation tests

Done when:

- a sample workspace imports into `KnoletSpec`
- at least one Tal, Dance, Performer, and Act maps successfully
- invalid relation directions fail validation
- missing knowledge bindings are warnings, not fatal errors
- generated JSON/YAML can be saved for review

Implemented in `0.3.0`:

- `lib/knolet/schema.js`
- `lib/knolet/dot-importer.js`
- `scripts/import-dot-workspace.js`
- `GET/POST /api/knolet/import/dot`
- `test/knolet-importer.test.js`

The importer returns `{ spec, diagnostics, assets, validation }`. Missing
knowledge bindings are warnings so the user can import first, then bind sources
in the next milestone.

## Phase 2: Import Preview and Editing

Goal: make the importer usable from the Manager.

Scope:

- `Import from dance-of-tal` action
- mapped asset preview
- diagnostics panel
- editable knowledge binding placeholders
- save `knolet.json` or `knolet.yaml`

Done when:

- imported assets are previewed before saving
- diagnostics explain missing or invalid assets
- users can add knowledge source placeholders
- the saved spec passes validation

Suggested version: `0.3.2`.

## Phase 3: Knowledge Binding and Citation Validation

Goal: make Knolet knowledge-grounded rather than just agent-driven.

Scope:

- `KnowledgeSource`
- `KnowledgeBinding`
- source access permissions
- `citation_required`
- simple citation shape: `{source_id, locator, quote?}`
- output citation validation

Done when:

- SkillBlocks can declare required sources
- RuntimeAgents can allow or deny sources
- a workflow run fails validation when required citations are missing
- a workflow run passes when required citations are present

Suggested version: `0.3.3`.

## Phase 4: Workflow Runtime Interface

Goal: compile workflow participants and relations into an executable plan.

Scope:

- workflow participant validation
- relation direction enforcement: `one-way` and `both`
- node/edge diagnostics
- run log interface
- output schema validation hook

Done when:

- invalid participant references fail validation
- one-way relations do not allow reverse message passing
- both relations allow bidirectional exchange
- each step records input, output, and diagnostics

Suggested version: `0.3.4`.

## Phase 5: Knolet Studio Graph Model

Goal: prepare the domain graph before visual UI work.

Node types:

- source
- skill
- persona
- agent
- workflow_step
- evaluation
- human_approval
- output

Edge types:

- uses_knowledge
- invokes_skill
- delegates_to
- verifies
- produces_output
- requires_approval

Done when:

- `KnoletSpec -> Graph` conversion exists
- `Graph -> KnoletSpec` conversion exists
- imported DOT Act can be represented as a Knolet workflow graph
- graph nodes reference the underlying KnoletSpec entities

Suggested version: `0.3.5`.

## Phase 5.5: Manager Graph Visualization

Goal: make the graph model readable as a visual node-link graph before deeper
Studio editing work.

Scope:

- SVG-based graph canvas in Manager
- layered layout from Source to Persona/Skill to Agent to Workflow Step to
  Output/Evaluation
- typed node shapes and colors
- typed edge labels
- selected-node syncing between the graph, node list, and detail panel
- diagnostics styling for blocked/error nodes, unbound skills, and missing edge
  endpoints

Done when:

- Manager shows the graph as an actual node-link image
- nodes and edges are rendered from the API/saved `knolet-graph.json` model
- clicking a node updates the existing detail panel
- type breakdown, list UI, diagnostics, and graph visualization work together
- the full local stack is verified on localhost

Suggested version: `0.3.6`.

## Phase 5.6: Graph Editing Foundation

Goal: turn the visible graph into a safe editing surface without changing the
underlying KnoletSpec yet.

Scope:

- draggable SVG graph nodes
- persisted node position overrides in `.dance-of-tal/knolet-graph-layout.json`
- automatic layout fallback for nodes without saved positions
- layout reset control
- selected-node incoming/outgoing edge detail
- graph diagnostics kept visually connected to nodes and edges while layout
  changes

Done when:

- Manager graph nodes can be dragged
- dragged positions can be saved and restored
- automatic layout and saved layout overrides work together
- selected node detail shows incoming and outgoing edges
- graph diagnostics remain visible on the graph
- the full local stack is verified on localhost

Suggested version: `0.3.7`.

## Phase 6: Library and Sharing

Goal: convert DOT registry ideas into a Knolet Library.

Asset types:

- Persona Template
- Skill Block
- Agent Profile
- Workflow Template
- Knowledge App Template
- Evaluation Pack
- UI Output Template

Done when:

- templates can be published and installed
- dependency and version views exist
- fork/share boundaries are explicit
- source documents are managed by pointer/binding, not copied into templates

Suggested version: `0.4.0`.

Implemented in `0.4.0`:

- `lib/knolet/library-package.js`
- `GET/POST /api/knolet/library/package`
- `POST /api/knolet/library/package/save`
- Manager `Knolet Library Package` preview/save panel
- `test/knolet-library-package.test.js`

The package compiler turns a ready KnoletSpec, RuntimePlan, and Graph into
Persona Template, Skill Block, Agent Profile, Workflow Template, Knowledge App
Template, Evaluation Pack, and UI Output Template records. KnowledgeSource
content is stripped; packages keep only binding pointers so templates can be
shared without copying customer documents.

Implemented in `0.4.1`:

- `lib/knolet/library-install-plan.js`
- `GET/POST /api/knolet/library/install-plan`
- `POST /api/knolet/library/install-plan/save`
- Manager `Knolet Library Install Plan` preview/save panel
- `test/knolet-library-install-plan.test.js`

The install plan is a non-destructive review boundary before actual template
installation. It lists template install actions, source rebinding requirements,
fork metadata, package diagnostics, and blocks packages that would copy source
documents.

Implemented in `0.4.2`:

- `lib/knolet/library-install-executor.js`
- `GET/POST /api/knolet/library/install/execution`
- `POST /api/knolet/library/install/execute`
- Manager `Knolet Library Install Execution` preview/execute panel
- `test/knolet-library-install-executor.test.js`

The executor writes local installed template records, source binding records,
and an installation manifest under `.dance-of-tal/library/<owner>/<stage>/`.
Required source bindings must be confirmed before execution, and packages that
copy source documents are refused.

Implemented in `0.4.3`:

- `lib/knolet/library-inventory.js`
- `GET /api/knolet/library/inventory`
- Manager `Knolet Library Inventory` panel
- `test/knolet-library-inventory.test.js`

The inventory reader scans `.dance-of-tal/library/` and summarizes installed
templates, source binding records, and installation manifests. Invalid library
JSON is reported as a warning so one bad local record does not hide the rest of
the installed library.

Implemented in `0.4.4`:

- Manager source rebinding inputs on the `Knolet Library Install Plan` panel
- source rebinding payloads passed into install execution preview and execute
- README capability note for source rebinding before install

This lets required source bindings be confirmed from the Manager before a
package install writes local library records.

## Phase 7: Product Backend

Goal: prepare for real commercial use.

Scope:

- product-owned auth
- server-backed workspace storage
- source binding storage
- run log storage
- team workspace permissions
- publish flow governance

Done when:

- production mode blocks unsafe local defaults
- customer data does not depend on upstream DOT auth or local-only storage
- workflow execution logs and source bindings are controlled by product-owned
  infrastructure

Suggested version: `0.5.0`.

Implemented in `0.5.0`:

- `lib/knolet/product-backend-readiness.js`
- `GET /api/knolet/product-backend/readiness`
- Manager `Product Backend Readiness` panel
- `test/knolet-product-backend-readiness.test.js`

The readiness layer inspects product auth, product data API configuration, local
Knolet artifacts, workspace/source/run/library/publish storage surfaces, and
inline KnowledgeSource content. Development mode remains advisory, while
production mode blocks local-only storage and inline customer source content.

Implemented in `0.5.1`:

- `lib/knolet/product-backend-contract.js`
- `GET /api/knolet/product-backend/contract`
- Manager `Product Data API Contract` panel
- `test/knolet-product-backend-contract.test.js`

The contract preview defines the server API surface for workspace snapshots,
source binding confirmations, run log events, library install receipts, and
publish intents. It carries idempotency scopes, required request/response
fields, environment gates, migration order, and endpoint readiness derived from
the `0.5.0` readiness report.

Next `0.5.x` work:

- add a guarded server-backed write adapter
- route save/execute endpoints through the adapter without breaking local-first
  development mode
- add team workspace permission checks and publish governance receipts

## Codex Implementation Prompt Shape

Use this structure for implementation tasks:

```text
Goal:
Implement the next Knolet compatibility layer milestone.

Context:
Knolet wraps dance-of-tal assets:
- Tal -> Persona
- Dance -> SkillBlock
- Performer -> RuntimeAgent
- Act -> Workflow

Constraints:
- Inspect the repo first.
- Keep DOT terminology in adapter/importer code only.
- Use Knolet terms internally.
- Preserve backward compatibility.
- Add fixtures and validation tests for parser/mapper work.

Done when:
- A sample .dance-of-tal fixture imports into a valid KnoletSpec.
- Missing knowledge bindings are warnings.
- Invalid relation directions fail validation.
- Docs show DOT assets becoming a Knolet app.
```

## Product Message

```text
Knolet turns reusable agent packages into grounded, executable knowledge apps.
```

Korean:

```text
dance-of-tal이 agent를 조립하는 방식이라면,
Knolet은 그 agent 조립물을 지식 기반 업무 앱으로 실행 가능하게 만드는 방식이다.
```

## Reference Links

- dance-of-tal: https://github.com/dance-of-tal/dance-of-tal
- dot-studio: https://github.com/dance-of-tal/dot-studio
- DOT website: https://danceoftal.com/
- OpenAI Codex Skills: https://developers.openai.com/codex/skills
- OpenAI Codex CLI: https://developers.openai.com/codex/cli
- OpenAI Codex best practices: https://developers.openai.com/codex/learn/best-practices
