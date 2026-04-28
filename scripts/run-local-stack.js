const { spawn } = require("node:child_process");
const path = require("node:path");

const root = process.cwd();
const nodeBinDir = "/tmp/node-v22.11.0-darwin-arm64/bin";
const toolsBinDir = path.join(root, ".tools", "bin");
const shutdownAfterMs = Number(process.env.LOCAL_STACK_SHUTDOWN_AFTER_MS || 3_600_000);
const env = {
  ...process.env,
  PATH: `${toolsBinDir}:${nodeBinDir}:${process.env.PATH || ""}`,
};

const services = [
  {
    name: "Manager",
    command: path.join(nodeBinDir, "node"),
    args: ["server.js"],
    env: {
      ...env,
      SHUTDOWN_AFTER_MS: String(shutdownAfterMs),
    },
  },
  {
    name: "OpenCode",
    command: path.join(
      root,
      ".tools",
      "lib",
      "node_modules",
      "dot-studio",
      "node_modules",
      "opencode-ai",
      "bin",
      "opencode",
    ),
    args: ["serve", "--port", "43120", "--hostname", "127.0.0.1", "--log-level", "INFO"],
    env: {
      ...env,
      OPENCODE_CONFIG_DIR: process.env.OPENCODE_CONFIG_DIR || path.join(process.env.HOME || root, ".dot-studio", "opencode"),
    },
  },
  {
    name: "DOT Studio",
    command: path.join(toolsBinDir, "dot-studio"),
    args: ["open", ".", "--port", "43110", "--opencode-url", "http://127.0.0.1:43120", "--no-open", "--verbose"],
    env,
  },
];

const children = new Map();
let stopping = false;

function stopAll(reason) {
  if (stopping) {
    return;
  }
  stopping = true;
  console.log(`Stopping local stack: ${reason}`);
  for (const [name, child] of children) {
    if (!child.killed && child.exitCode === null) {
      console.log(`Stopping ${name} (${child.pid})`);
      child.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(0), 1_000).unref();
}

for (const service of services) {
  const child = spawn(service.command, service.args, {
    cwd: root,
    env: service.env,
    stdio: ["ignore", "inherit", "inherit"],
  });
  children.set(service.name, child);
  child.on("exit", (code, signal) => {
    children.delete(service.name);
    if (!stopping && code !== 0) {
      stopAll(`${service.name} exited with ${signal || code}`);
    }
  });
}

console.log("Local stack starting:");
console.log("- Manager: http://127.0.0.1:8080");
console.log("- DOT Studio: http://127.0.0.1:43110");
console.log("- OpenCode: http://127.0.0.1:43120");
console.log(`All services will stop after ${shutdownAfterMs}ms.`);

setTimeout(() => stopAll("1 hour policy reached"), shutdownAfterMs).unref();
process.on("SIGINT", () => stopAll("SIGINT"));
process.on("SIGTERM", () => stopAll("SIGTERM"));
