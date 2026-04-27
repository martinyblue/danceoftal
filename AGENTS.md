# danceoftal Codex Instructions

- Follow the global `martinyblue` GitHub identity and commit/push alignment for repository changes.
- Do not deploy this repository to Vercel unless the user explicitly asks for Vercel again.
- For each completed development unit, run or verify the local Manager on localhost and give the user the localhost URL to inspect.
- Prefer `http://127.0.0.1:8080` for the Manager. If that port is already in use, use another localhost port and report the exact URL.
- Before reporting completion, verify the localhost URL responds.
- When Codex starts a localhost server, track that server for the current work session and stop it if it has been running for more than 1 hour.
- If Codex finds a localhost server that is already running but did not start it, do not kill it blindly. Report that it is already running and only stop it if the user asks or if its ownership/start time is clear.
- README and final reports should describe local verification status instead of Vercel deployment status.
