const fs = require("node:fs/promises");
const path = require("node:path");
const { diagnostic } = require("./schema");

const LIBRARY_INVENTORY_VERSION = "0.1";

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

async function readJson(filePath, diagnostics, root) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    diagnostics.push(
      diagnostic(
        "warning",
        "library-inventory-invalid-json",
        `Could not read library record ${path.relative(root, filePath)}: ${error.message}`,
        path.relative(root, filePath),
      ),
    );
    return null;
  }
}

async function listDirs(dir) {
  if (!(await exists(dir))) {
    return [];
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

async function listJsonFiles(dir) {
  if (!(await exists(dir))) {
    return [];
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

async function readTemplateRecords(stageRoot, owner, stage, diagnostics, root) {
  const templatesRoot = path.join(stageRoot, "templates");
  const templateTypes = await listDirs(templatesRoot);
  const records = [];

  for (const templateType of templateTypes) {
    for (const filePath of await listJsonFiles(path.join(templatesRoot, templateType))) {
      const record = await readJson(filePath, diagnostics, root);
      if (!record) {
        continue;
      }
      records.push({
        owner,
        stage,
        template_type: record.template_type || templateType,
        template_id: record.template_id || record.template?.id || path.basename(filePath, ".json"),
        target_id: record.target_id || "",
        installedAt: record.installedAt || "",
        source_package_id: record.source_package?.id || "",
        path: path.relative(root, filePath),
      });
    }
  }

  return records;
}

async function readSourceBindingRecords(stageRoot, owner, stage, diagnostics, root) {
  const records = [];
  for (const filePath of await listJsonFiles(path.join(stageRoot, "source-bindings"))) {
    const record = await readJson(filePath, diagnostics, root);
    if (!record) {
      continue;
    }
    records.push({
      owner,
      stage,
      source_id: record.source_id || path.basename(filePath, ".json"),
      label: record.label || record.source_id || path.basename(filePath, ".json"),
      type: record.type || "",
      required: record.required === true,
      status: record.status || "",
      target_source_id: record.target_source_id || "",
      source_package_id: record.source_package?.id || "",
      path: path.relative(root, filePath),
    });
  }
  return records;
}

async function readInstallationRecords(stageRoot, owner, stage, diagnostics, root) {
  const records = [];
  for (const filePath of await listJsonFiles(path.join(stageRoot, "installations"))) {
    const record = await readJson(filePath, diagnostics, root);
    if (!record) {
      continue;
    }
    records.push({
      owner,
      stage,
      source_package_id: record.source_package?.id || "",
      installedAt: record.installedAt || "",
      writeCount: record.summary?.writeCount || asArray(record.writes).length,
      templateWriteCount: record.summary?.templateWriteCount || 0,
      sourceBindingWriteCount: record.summary?.sourceBindingWriteCount || 0,
      path: path.relative(root, filePath),
    });
  }
  return records;
}

function inventorySummary(records, diagnostics) {
  const errors = diagnostics.filter((item) => item.level === "error");
  const warnings = diagnostics.filter((item) => item.level === "warning");
  return {
    ready: errors.length === 0,
    stageCount: records.stages.length,
    templateCount: records.templates.length,
    sourceBindingCount: records.source_bindings.length,
    installationCount: records.installations.length,
    errorCount: errors.length,
    warningCount: warnings.length,
  };
}

async function readKnoletLibraryInventory(libraryRoot, options = {}) {
  const root = options.root || process.cwd();
  const diagnostics = [];
  const records = {
    stages: [],
    templates: [],
    source_bindings: [],
    installations: [],
  };

  if (!(await exists(libraryRoot))) {
    return {
      library_inventory_version: LIBRARY_INVENTORY_VERSION,
      root: path.relative(root, libraryRoot),
      summary: inventorySummary(records, diagnostics),
      records,
      diagnostics,
    };
  }

  for (const owner of await listDirs(libraryRoot)) {
    for (const stage of await listDirs(path.join(libraryRoot, owner))) {
      const stageRoot = path.join(libraryRoot, owner, stage);
      records.stages.push({
        owner,
        stage,
        path: path.relative(root, stageRoot),
      });
      records.templates.push(...(await readTemplateRecords(stageRoot, owner, stage, diagnostics, root)));
      records.source_bindings.push(...(await readSourceBindingRecords(stageRoot, owner, stage, diagnostics, root)));
      records.installations.push(...(await readInstallationRecords(stageRoot, owner, stage, diagnostics, root)));
    }
  }

  return {
    library_inventory_version: LIBRARY_INVENTORY_VERSION,
    root: path.relative(root, libraryRoot),
    summary: inventorySummary(records, diagnostics),
    records,
    diagnostics,
  };
}

module.exports = {
  LIBRARY_INVENTORY_VERSION,
  readKnoletLibraryInventory,
};
