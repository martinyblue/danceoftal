# danceoftal Codex Instructions

- Follow the global `martinyblue` GitHub identity and commit/push alignment for repository changes.
- Do not deploy this repository to Vercel unless the user explicitly asks for Vercel again.
- For each completed development unit, run or verify the full local stack on localhost and give the user the localhost URLs to inspect.
- Prefer `http://127.0.0.1:8080` for the Manager. If that port is already in use, use another localhost port and report the exact URL.
- The full local stack is Manager `http://127.0.0.1:8080`, DOT Studio `http://127.0.0.1:43110`, and OpenCode `http://127.0.0.1:43120`.
- Prefer `PATH=/tmp/node-v22.11.0-darwin-arm64/bin:$PATH npm run local:stack` to start all three servers together.
- Before reporting completion, verify the localhost URL responds.
- When Codex starts localhost servers for this repo, track all three servers for the current work session and stop them if they have been running for more than 1 hour. The preferred `npm run local:stack` command applies this 1-hour shutdown policy to Manager, DOT Studio, and OpenCode together.
- If Codex finds a localhost server that is already running but did not start it, do not kill it blindly. Report that it is already running and only stop it if the user asks or if its ownership/start time is clear.
- README and final reports should describe local verification status instead of Vercel deployment status.
