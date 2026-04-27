# dance-of-tal Local Manager

Version: `0.1.3`

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
- add Dance packages from GitHub sources when the source repository is reachable
- diagnose Manager, DOT Studio, OpenCode, registry, GitHub, and version state
- explain the current DOT Studio canvas in Korean and show what to click next
- show an execution readiness checklist for workspace, assets, Studio, OpenCode,
  and GitHub sync
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

The Manager is a custom local operator UI for this repository. The official
dance-of-tal surfaces are `dot` CLI and DOT Studio; the Manager exists only to
make local verification and repeated setup easier.

## Troubleshooting

The Manager now includes an OpenCode recovery panel. Use `OpenCode 기본 URL 열기`
first, then `OpenCode 상태 재확인`. OpenCode restart remains a manual terminal
step until the planned `0.2.0` integrated launcher.

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
