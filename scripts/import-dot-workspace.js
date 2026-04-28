#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const { importDotWorkspace } = require("../lib/knolet/dot-importer");

function parseArgs(argv) {
  const args = [...argv];
  const workspace = args[0] && !args[0].startsWith("--") ? args.shift() : ".dance-of-tal";
  const outIndex = args.indexOf("--out");
  const out = outIndex >= 0 ? args[outIndex + 1] : "";
  return { workspace, out };
}

async function main() {
  const { workspace, out } = parseArgs(process.argv.slice(2));
  const result = await importDotWorkspace(path.resolve(process.cwd(), workspace));
  const json = JSON.stringify(result, null, 2);

  if (out) {
    await fs.writeFile(path.resolve(process.cwd(), out), `${json}\n`);
    console.log(`Wrote ${out}`);
    if (!result.validation.ok) {
      process.exitCode = 1;
    }
    return;
  }

  console.log(json);
  if (!result.validation.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
