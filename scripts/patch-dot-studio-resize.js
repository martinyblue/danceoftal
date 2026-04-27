const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const assetsDir = path.join(root, ".tools", "lib", "node_modules", "dot-studio", "client", "assets");

function findAsset(predicate) {
  if (!fs.existsSync(assetsDir)) {
    throw new Error(`DOT Studio assets directory not found: ${assetsDir}`);
  }

  return fs
    .readdirSync(assetsDir)
    .filter((name) => name.endsWith(".js") || name.endsWith(".css"))
    .map((name) => path.join(assetsDir, name))
    .find((filePath) => predicate(filePath, fs.readFileSync(filePath, "utf8")));
}

function patchFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, "utf8");
  let changed = false;

  for (const { from, to } of replacements) {
    if (!content.includes(from)) {
      continue;
    }
    content = content.replace(from, to);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
  }

  return changed;
}

const frameJs = findAsset((_filePath, content) =>
  content.includes("Toggle resize handles") &&
  content.includes("react-flow__resize-control") &&
  (content.includes("isVisible:m") || content.includes("isVisible:x")),
);

const frameCss = findAsset((_filePath, content) =>
  content.includes(".canvas-frame .react-flow__resize-control.handle") &&
  content.includes(".canvas-drag-handle--active"),
);

const jsChanged = patchFile(frameJs, [
  {
    from: 'isVisible:m,minWidth:i,minHeight:l,handleStyle:{width:8,height:8,background:"#3b82f6",border:"1.5px solid #2563eb",borderRadius:2}',
    to: 'isVisible:x,minWidth:i,minHeight:l,handleStyle:{width:12,height:12,background:"#3b82f6",border:"2px solid #ffffff",borderRadius:3,boxShadow:"0 0 0 1px #2563eb"}',
  },
]);

const cssChanged = patchFile(frameCss, [
  {
    from: ".canvas-frame .react-flow__resize-control.handle{width:8px!important;height:8px!important;border-radius:2px!important}",
    to: ".canvas-frame .react-flow__resize-control.handle{width:12px!important;height:12px!important;border-radius:3px!important;box-shadow:0 0 0 1px #2563eb;opacity:.95}.canvas-frame .react-flow__resize-control.handle.bottom.right:after{content:\"\";position:absolute;right:2px;bottom:2px;width:6px;height:6px;border-right:2px solid #fff;border-bottom:2px solid #fff;pointer-events:none}",
  },
]);

console.log(
  JSON.stringify(
    {
      ok: true,
      frameJs: path.relative(root, frameJs),
      frameCss: path.relative(root, frameCss),
      jsChanged,
      cssChanged,
    },
    null,
    2,
  ),
);
