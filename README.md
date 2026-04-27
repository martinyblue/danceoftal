# dance-of-tal Local Manager

Version: `0.2.3`

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
npm run commercial:check
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
- show commercial data-boundary status in the Manager launcher
- provide OpenCode recovery actions for opening the base URL, rechecking status,
  and understanding stale `/session` URLs
- translate common registry and GitHub install failures into non-technical Korean
  guidance
- list generated assets
- preview generated JSON and `SKILL.md` files
- inspect official `dot install` assets under `.dance-of-tal/assets/`

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

- Auth: set `DOT_SUPABASE_URL` and `DOT_SUPABASE_ANON_KEY` to a backend you own.
  The guarded `npm run studio:commercial` command refuses to start if those are
  missing, because DOT would otherwise fall back to the upstream Supabase
  project.
- Studio workspace data: development still stores snapshots locally under
  `STUDIO_DIR` or `~/.dot-studio/workspaces`. The next product step is replacing
  that local workspace persistence with a server API owned by this product.
- OpenCode/session data: set `OPENCODE_CONFIG_DIR` to a product-owned path for
  development, then move production execution logs/session state to the product
  backend.
- Registry/GitHub/publish flows: keep them explicit user actions. Do not publish
  or sync customer workspace data unless the product UI says exactly where it
  will go.

The Manager launcher includes a `Commercial data boundary` card so a developer
can see whether the current run is still using unsafe defaults.

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
