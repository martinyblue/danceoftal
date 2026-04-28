# dance-of-tal Local Manager

Version: `0.3.1`

This repository contains a local-first manager for `dance-of-tal` style assets.
It is built for the project owner, not first-time visitors. The local UI creates
and previews real files under `.dance-of-tal/`.

- `Tal`: agent identity and instruction layer
- `Dance`: reusable skill package
- `Performer`: runnable agent composed from Tal, Dances, model, and tools/MCP
- `Act`: workflow/choreography for multiple performers

## Local Development

Run the local manager from the repository root:

```bash
/tmp/node-v22.11.0-darwin-arm64/bin/node server.js
```

Then open <http://127.0.0.1:8080>.

The official CLIs are installed in the repo-local `.tools/` prefix instead of a
system global location. Use this PATH when running them manually:

```bash
PATH="$PWD/.tools/bin:/tmp/node-v22.11.0-darwin-arm64/bin:$PATH"
```

Useful local URLs:

- Manager: <http://127.0.0.1:8080>
- DOT Studio: <http://127.0.0.1:43110>
- OpenCode: <http://127.0.0.1:43120>

To start the full local stack with the repository's 1-hour shutdown policy:

```bash
PATH=/tmp/node-v22.11.0-darwin-arm64/bin:$PATH npm run local:stack
```

Use this after each completed development unit. It starts Manager, DOT Studio,
and OpenCode together, then stops all three after one hour.

If DOT Studio is reinstalled under `.tools/`, reapply the local canvas patch
before starting Studio:

```bash
PATH="$PWD/.tools/bin:/tmp/node-v22.11.0-darwin-arm64/bin:$PATH" npm run studio:patch-resize
```

For commercial product work, do not use the default DOT auth backend. Configure
your own auth/data backend and start Studio through the guarded command:

```bash
set -a
source .env.commercial.example
set +a
npm run commercial:check
npm run studio:commercial
```

Or export the same values manually:

```bash
DOT_SUPABASE_URL=https://auth.your-domain.example \
DOT_SUPABASE_ANON_KEY=<your-public-anon-key> \
DANCEOFTAL_DATA_API_URL=https://api.your-domain.example \
npm run studio:commercial
```

Check the boundary before running a commercial session:

```bash
npm run mode:check
npm run commercial:check
npm run production:check
```

Start OpenCode and DOT Studio in separate terminals when restarting manually:

```bash
PATH="$PWD/.tools/bin:/tmp/node-v22.11.0-darwin-arm64/bin:$PATH" npm run opencode
PATH="$PWD/.tools/bin:/tmp/node-v22.11.0-darwin-arm64/bin:$PATH" npm run studio
```

## Official CLI Setup

The official tools were installed with:

```bash
PATH=/tmp/node-v22.11.0-darwin-arm64/bin:$PATH \
  npm install --prefix ./.tools -g dance-of-tal dot-studio \
  --ignore-scripts --cache /tmp/npm-cache --fetch-timeout=30000
```

Security posture:

- no sudo or system-global install
- `.tools/` is ignored by Git
- npm lifecycle scripts were disabled during install
- local servers are bound to loopback URLs only
- DOT Studio is connected to the explicitly started OpenCode URL

Verified commands:

```bash
dot --help
dot list
dot install tal/@monarchjuno/lawyer/k-lawyer
dot-studio doctor . --verbose
```

## Current Capabilities

- initialize `.dance-of-tal/`
- create Tal, Dance, Performer, and Act assets
- create a sample Knolet-oriented flow
- write canonical DOT Studio assets under `.dance-of-tal/assets/`
- seed the DOT Studio canvas with a visible Performer and Act example
- search the DOT registry through the running DOT Studio API
- install working registry assets into the current stage workspace
- run registry install preflight checks for URN shape, kind match, registry
  visibility, and duplicate local installs
- show install result cards with retry, registry search, GitHub source, and
  local fallback actions
- add Dance packages from GitHub sources when the source repository is reachable
- diagnose Manager, DOT Studio, OpenCode, registry, GitHub, and version state
- explain the current DOT Studio canvas in Korean and show what to click next
- show an execution readiness checklist for workspace, assets, Studio, OpenCode,
  and GitHub sync
- show a richer Knolet workflow blueprint from Source Document to Knowledge
  Structure, KnoletSpec, Runtime App, and Version/Fork/Share
- generate an OpenCode handoff prompt for the Document to Knolet App flow
- create workflow run records under `.dance-of-tal/runs/`
- capture OpenCode outputs into Knowledge Structure, KnoletSpec, Runtime App
  Plan, Version/Fork/Share, and Next Action Checklist fields
- review saved workflow outputs for minimum completeness before the next
  development step
- export saved workflow runs as Markdown share packages under
  `.dance-of-tal/exports/`
- use Manager as a `0.2.0` integrated localhost launcher for Manager, DOT
  Studio, OpenCode, Registry, and GitHub sync status
- show service controls for opening URLs, rechecking status, viewing
  log/diagnostic commands, and copying manual run commands
- inspect local ports `8080`, `43110`, and `43120`, including listener process
  summaries when available
- show whether the Manager is running with the 1-hour `SHUTDOWN_AFTER_MS`
  automatic shutdown policy or as a manual/existing server
- guide integrated recovery flows for stale OpenCode sessions, empty DOT Studio
  canvas, Registry install failures, and pending GitHub push work
- patch the repo-local DOT Studio build so selected canvas boxes show resize
  handles immediately, expose a larger corner grip, and allow wider zoom-out
- block commercial Studio startup when DOT auth would fall back to the upstream
  open-source backend instead of a product-owned auth server
- keep development mode local-first so existing Manager, DOT Studio, OpenCode,
  Registry, and GitHub flows continue to work during feature development
- show the current development/commercial/production data-boundary mode in the
  Manager launcher
- provide OpenCode recovery actions for opening the base URL, rechecking status,
  and understanding stale `/session` URLs
- translate common registry and GitHub install failures into non-technical Korean
  guidance
- list generated assets
- preview generated JSON and `SKILL.md` files
- inspect official `dot install` assets under `.dance-of-tal/assets/`
- import `.dance-of-tal/` Tal, Dance, Performer, and Act assets into a
  validated `KnoletSpec v0.1` through the library, CLI script, or Manager API
- surface importer diagnostics for missing DOT directories, malformed JSON,
  unresolved DOT references, invalid workflow relation directions, and missing
  KnowledgeSource bindings

## Knolet Product Direction

Knolet should not clone `dance-of-tal`. This repository treats `dance-of-tal`
as the lower-level agent packaging and choreography layer, then adds a Knolet
product grammar for domain knowledge, source grounding, workflow validation,
UI generation, and reusable business apps.

Product message:

```text
Knolet turns reusable agent packages into grounded, executable knowledge apps.
```

Mapping:

- `Tal` -> Knolet `Persona`: a domain role, not just style or voice
- `Dance` -> Knolet `SkillBlock`: a skill plus knowledge bindings and an
  output contract
- `Performer` -> Knolet `RuntimeAgent` / `Worker`: a runnable work unit with
  model, tools, source permissions, validation, and logs
- `Act` -> Knolet `Workflow` / `Knowledge Choreography`: a graph of agents,
  source flow, approvals, evaluation, and final app output
- `DOT Studio` -> Knolet Studio / Knowledge App Builder
- `dot` CLI -> Knolet importer, exporter, registry, and runtime compiler

Implementation principles:

- Keep `dance-of-tal` terminology at the adapter/importer boundary. Internal
  product models should use `Persona`, `SkillBlock`, `RuntimeAgent`,
  `Workflow`, `KnowledgeSource`, `Evaluation`, and `App`.
- Every `SkillBlock` should say what knowledge it uses and what structured
  output it must produce.
- Every `RuntimeAgent` should define input shape, output shape, allowed sources,
  denied sources, domain constraints, validation rules, and run logs.
- Workflow edges are product behavior: they define which output becomes which
  input, whether an exchange is one-way or bidirectional, and where citation,
  evaluation, or human approval is required.
- A Knolet app is not complete until it defines input UI, output UI, grounding
  policy, evaluation checks, and version/fork/share boundaries.

The target normalized format is `KnoletSpec v0.1`:

```text
metadata -> domain -> knowledge -> personas -> skills -> agents -> workflow
         -> app -> evaluation
```

See [docs/knolet-roadmap.md](docs/knolet-roadmap.md) for the full development
plan and milestone map.

Import the current DOT workspace into a KnoletSpec result:

```bash
PATH=/tmp/node-v22.11.0-darwin-arm64/bin:$PATH npm run knolet:import
```

Or inspect it through the running Manager:

```bash
curl -s http://127.0.0.1:8080/api/knolet/import/dot
```

## Operator Flow

Use the Manager at <http://127.0.0.1:8080> in this order:

1. `작업공간 준비`: creates the local `.dance-of-tal/` workspace.
2. `Knolet 예시 만들기`: creates Tal, Dance, Performer, and Act files.
3. `Studio 캔버스에 배치`: saves a visible sample canvas into DOT Studio.
4. Open DOT Studio at <http://127.0.0.1:43110> and refresh the page if it was
   already open.
5. Review `Knolet workflow` to see the required inputs, outputs, and acceptance
   criteria for each app-generation phase.
6. Use the generated OpenCode handoff prompt as the starting point for a real
   `Document to Knolet App` run.
7. Save the run inputs and captured outputs in `Workflow 산출물 저장`.
8. Run `품질 검토` to catch missing or underdeveloped workflow outputs.
9. Use `공유 패키지 만들기` to produce a Markdown handoff package.
10. Use `0.2.0 통합 런처` as the starting point for DOT Studio, OpenCode,
    Registry, and GitHub status checks.

The Manager is a custom local operator UI for this repository. The official
dance-of-tal surfaces are `dot` CLI and DOT Studio; the Manager exists only to
make local verification and repeated setup easier.

## Commercial Data Boundary

Commercial development should move every user/customer data path under
product-owned infrastructure:

- Mode: default development mode preserves all current local functionality.
  `DANCEOFTAL_MODE=commercial` is a guarded local rehearsal, and
  `DANCEOFTAL_MODE=production` is the strict deployment readiness check.
- Auth: set `DOT_SUPABASE_URL` and `DOT_SUPABASE_ANON_KEY` to a backend you own.
  The guarded `npm run studio:commercial` command refuses to start if those are
  missing, because DOT would otherwise fall back to the upstream Supabase
  project.
- Data owner: set `DANCEOFTAL_DATA_OWNER` to the owning account/product and keep
  production credentials in a secret manager, not in Git.
- Storage: development still stores snapshots locally under `STUDIO_DIR` or
  `~/.dot-studio/workspaces`. Production mode expects
  `DANCEOFTAL_STORAGE_MODE=server` plus a product-owned
  `DANCEOFTAL_DATA_API_URL`; the next implementation step is replacing local
  workspace persistence with that server API.
- OpenCode/session data: set `OPENCODE_CONFIG_DIR` to a product-owned path for
  development, then move production execution logs/session state to the product
  backend.
- Registry/GitHub/publish flows: keep them explicit user actions. Do not publish
  or sync customer workspace data unless the product UI says exactly where it
  will go.

The Manager launcher includes a `Commercial data boundary` card so a developer
can see whether the current run is still using unsafe defaults. In development
mode that card is advisory only and does not block the local launcher; in
commercial/production modes it becomes the gate before product use.

Recommended switch-over sequence:

1. Keep building in default development mode and verify every existing local
   feature still works.
2. Add a product-owned auth backend and run `npm run commercial:check`.
3. Add the product data API contract and set `DANCEOFTAL_STORAGE_MODE=server`.
4. Run `npm run production:check` before any real web deployment or customer
   workspace use.
5. Only then route customer login, workspace data, execution logs, and publish
   flows to the product-owned backend.

## Development Roadmap

The next development line is `0.3.x`: add the Knolet compatibility layer on top
of the current local Manager, DOT Studio, OpenCode, and Registry foundation.

- `0.2.7`: document the Knolet product direction, DOT-to-Knolet mapping, and
  full roadmap before implementation begins.
- `0.3.0` Compatibility MVP: added `KnoletSpec v0.1`, `.dance-of-tal/` scanning,
  Tal/Dance/Performer/Act parsing, Persona/SkillBlock/RuntimeAgent/Workflow
  mapping, importer diagnostics, fixtures, tests, CLI export, and Manager API
  inspection.
- `0.3.1` Local Stack Lifecycle: add a full-stack runner and repo instruction
  policy so Manager, DOT Studio, and OpenCode start together after each
  development unit and stop together after one hour.
- `0.3.2` Import Preview: add a Manager UI/API flow for `Import from
  dance-of-tal`, preview mapped assets, and save `knolet.json` or `knolet.yaml`.
- `0.3.3` Knowledge Binding: model KnowledgeSource, KnowledgeBinding,
  citation-required outputs, allowed/denied source access, and validation
  warnings.
- `0.3.4` Workflow Runtime Interface: compile workflow participants and
  one-way/both relations into an executable plan with run logs and validation
  diagnostics.
- `0.3.5` Knolet Studio Graph Model: prepare Source, Skill, Persona, Agent,
  Workflow Step, Evaluation, Human Approval, and Output nodes for a future
  visual builder.
- `0.4.0` Library and Sharing: turn DOT registry concepts into Knolet Library
  templates for SkillBlocks, AgentProfiles, WorkflowTemplates, EvaluationPacks,
  and Knowledge App Templates.
- `0.5.0` Product Backend: move customer auth, workspace data, source bindings,
  run logs, and publish flows from local-first storage to product-owned
  infrastructure.

Immediate implementation order for `0.3.0`:

1. Add schema and validation helpers for `KnoletSpec v0.1`.
2. Add DOT raw workspace scanner and parser with non-fatal diagnostics.
3. Add mapping functions from DOT assets to Knolet normalized entities.
4. Add valid and invalid fixtures.
5. Add tests for schema validation, missing directories, invalid relation
   direction, and missing knowledge binding warnings.
6. Add docs showing before/after examples from DOT assets to a Knolet app.

## Troubleshooting

For registry installs, use `설치 전 확인` before `현재 workspace에 설치`.
The Manager checks whether the URN shape is valid, the selected kind matches,
the same URN appears in registry search, and the asset is not already installed.
If install still fails, the result card explains whether the likely cause is a
missing/private GitHub repository, permissions, network delay, or invalid asset
structure, then offers the next action buttons.

The Manager now includes an integrated launcher. Use `OpenCode 기본 URL 열기`
first, then `상태 재확인`. OpenCode restart remains a manual terminal step until
process ownership checks are safe enough for an in-UI restart button.

If OpenCode shows `Failed to fetch dynamically imported module`, the OpenCode
browser tab is usually pointing at a stale session while the local OpenCode
server is stopped or restarted. Restart OpenCode, then open the base URL again:

1. Start OpenCode with `npm run opencode`.
2. Confirm <http://127.0.0.1:43120> opens.
3. Open DOT Studio at <http://127.0.0.1:43110>.
4. If a `/session` URL is still open, use the base OpenCode URL or hard-refresh.

For this repository, every meaningful development update should be reflected by
a package version bump plus a Git commit pushed to `martinyblue/danceoftal`.

## Version Notes

- `0.3.1`: added the full local stack runner and repo instruction update so
  Manager, DOT Studio, and OpenCode are started together after each development
  unit and stopped together after one hour.
- `0.3.0`: added the KnoletSpec compatibility MVP with DOT workspace scanner,
  DOT-to-Knolet mapper, schema validation, diagnostics, fixtures, tests, CLI
  export, and Manager API import inspection.
- `0.2.7`: added the Knolet product direction and full milestone roadmap for
  wrapping DOT assets as grounded, executable knowledge apps.
- `0.2.6`: made the DOT Studio npm script non-interactive so npm update prompts
  cannot block local Studio startup.
- `0.2.5`: changed the OpenCode npm script from the old absolute Desktop path
  to a repo-relative path so the moved local folder stays connected.
- `0.2.4`: added explicit development/commercial/production mode checks so local
  development keeps all current features working while product mode can require
  owner-controlled auth and server storage.
- `0.2.3`: added commercial data-boundary checks and a guarded Studio launcher
  that requires product-owned DOT auth configuration.
- `0.2.2`: widened the local DOT Studio canvas zoom-out range so larger
  workflows can fit in one view.
- `0.2.1`: added a repeatable local DOT Studio patch that makes selected canvas
  boxes visibly resizable with larger resize handles.
- `0.2.0`: promoted Manager into the integrated localhost launcher with
  service panels, port/process checks, command copy actions, Manager lifecycle
  status, and unified recovery flows.
- `0.1.9`: added the pre-`0.2.0` launcher handoff panel and API with service
  commands, blockers, port map, and next launcher scope.
- `0.1.8`: added Markdown export/share packages for saved workflow runs,
  including source input, captured outputs, and review checklist.
- `0.1.7`: added saved workflow output quality review with score, pass/fail
  checks, and status updates for run records.
- `0.1.6`: added workflow run records and output capture for saved Knolet app
  generation runs under `.dance-of-tal/runs/`.
- `0.1.5`: expanded the Knolet workflow surface with a five-phase blueprint,
  per-phase inputs/outputs/acceptance criteria, and an OpenCode handoff prompt.
- `0.1.4`: added registry install preflight checks, structured install result
  cards, retry/search/GitHub/local fallback actions, and richer install failure
  classification.
- `0.1.3`: added DOT Studio usage guidance, OpenCode recovery actions, an
  execution readiness checklist, and Korean translations for common registry
  install failures.
- `0.1.2`: added the Manager diagnostics panel for service health, OpenCode stale
  session guidance, workspace readiness, package version, and GitHub sync state.
- `0.1.1`: documented the OpenCode restart flow and added an `npm run opencode`
  script.

## Registry Notes

The URL
`https://danceoftal.com/registry/dance/%40404kidwiz/claude-supercode-skills/quant-analyst`
currently renders as `Invalid Package | DOT Registry`, but registry search still
returns the URN `dance/@404kidwiz/claude-supercode-skills/quant-analyst`.
Installing that URN currently fails because the backing GitHub repository is not
reachable. A verified install example is:

```bash
dot install dance/@monarchjuno/vibe-investing/quant-research
```

## Deployment

The current working target is local host. Vercel deployment is intentionally not
part of this setup.

## Repository

GitHub owner: `martinyblue`
