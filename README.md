# dance-of-tal Local Brief

This repository contains a local-first static explainer for `dance-of-tal`, an
AI agent package manager and visual choreography tool. The page summarizes the
core model:

- `Tal`: agent identity and instruction layer
- `Dance`: reusable skill package
- `Performer`: runnable agent composed from Tal, Dances, model, and tools/MCP
- `Act`: workflow/choreography for multiple performers

## Local Development

Run a local static server from the repository root:

```bash
python3 -m http.server 8080
```

Then open <http://127.0.0.1:8080>.

## Deployment

The current working target is local host. Vercel deployment is intentionally not
part of this setup.

## Repository

GitHub owner: `martinyblue`
