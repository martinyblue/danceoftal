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

## Current Capabilities

- initialize `.dance-of-tal/`
- create Tal, Dance, Performer, and Act assets
- create a sample Knolet-oriented flow
- list generated assets
- preview generated JSON and `SKILL.md` files

## Deployment

The current working target is local host. Vercel deployment is intentionally not
part of this setup.

## Repository

GitHub owner: `martinyblue`
