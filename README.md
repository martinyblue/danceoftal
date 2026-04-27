# dance-of-tal Local Manager

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
- list generated assets
- preview generated JSON and `SKILL.md` files
- inspect official `dot install` assets under `.dance-of-tal/assets/`

## Deployment

The current working target is local host. Vercel deployment is intentionally not
part of this setup.

## Repository

GitHub owner: `martinyblue`
