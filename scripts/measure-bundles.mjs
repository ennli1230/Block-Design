import { readFile, readdir, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { relative, resolve } from "node:path";

const outputs = ["apps/demo/dist/assets", "dist/esm", "dist/vanilla"];
// Live lists/widgets, history/recovery, metadata and extension UI add ~15 KiB gzip
// over the previous CMS baseline. Optional entry modules keep the bootstrap at 3.2 KiB.
const budgets = [
  {
    label: "Demo JavaScript",
    directory: "apps/demo/dist/assets",
    // Database menu binding factory and live pinned-region resolution add 1.9 KiB gzip.
    // The HTML importer is now lazy; SDK entry and runtime budgets remain unchanged.
    gzipKiB: 476,
  },
  {
    label: "Largest demo chunk",
    directory: "apps/demo/dist/assets",
    perFileGzipKiB: 300,
  },
  {
    label: "Demo CSS",
    directory: "apps/demo/dist/assets",
    extension: ".css",
    // The lazy JSON form examples screen adds 0.55 KiB gzip of scoped CSS.
    gzipKiB: 25.6,
  },
  // Nested schema, multilingual source adapters, and publication flows add a small measured increment.
  { label: "ESM entry", file: "dist/esm/blockdesign-editor.js", rawKiB: 3.2 },
  { label: "ESM forms entry", file: "dist/esm/blockdesign-forms.js", rawKiB: 10 },
  { label: "ESM frontend runtime entry", file: "dist/esm/blockdesign-runtime.js", rawKiB: 1 },
  { label: "ESM JavaScript", directory: "dist/esm", gzipKiB: 496 },
  { label: "Largest ESM chunk", directory: "dist/esm", perFileGzipKiB: 335 },
  { label: "Vanilla JavaScript", directory: "dist/vanilla", gzipKiB: 449 },
  { label: "ESM CSS", file: "dist/esm/blockdesign-editor.css", gzipKiB: 22.5 },
  { label: "Vanilla CSS", file: "dist/vanilla/editor.css", gzipKiB: 22.5 },
];

async function filesUnder(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return (
      await Promise.all(
        entries.map((entry) => {
          const path = resolve(directory, entry.name);
          return entry.isDirectory() ? filesUnder(path) : [path];
        }),
      )
    ).flat();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

const measured = new Map();
let found = false;
for (const output of outputs) {
  for (const file of await filesUnder(resolve(output))) {
    if (!/\.(?:js|css)$/.test(file)) continue;
    const content = await readFile(file);
    const info = await stat(file);
    const relativePath = relative(process.cwd(), file).replaceAll("\\", "/");
    const entry = {
      rawKiB: info.size / 1024,
      gzipKiB: gzipSync(content).byteLength / 1024,
    };
    measured.set(relativePath, entry);
    found = true;
    console.log(
      `${relativePath}: ${entry.rawKiB.toFixed(1)} KiB, ${entry.gzipKiB.toFixed(1)} KiB gzip`,
    );
  }
}
if (!found) {
  console.error(
    "No built JavaScript or CSS assets found. Run npm run build:all first.",
  );
  process.exitCode = 1;
}

let exceeded = false;
for (const budget of budgets) {
  let value;
  let maximum;
  let unit;
  if (budget.file) {
    const metric = budget.rawKiB === undefined ? "gzipKiB" : "rawKiB";
    value = measured.get(budget.file)?.[metric];
    maximum = budget.rawKiB ?? budget.gzipKiB;
    unit = metric === "rawKiB" ? "KiB raw" : "KiB gzip";
  } else {
    const files =
      budget.files ??
      Array.from(measured.keys()).filter(
        (file) =>
          file.startsWith(`${budget.directory}/`) &&
          file.endsWith(budget.extension ?? ".js"),
      );
    const sizes = files
      .map((file) => measured.get(file)?.gzipKiB)
      .filter((size) => size !== undefined);
    value = sizes.length
      ? budget.perFileGzipKiB
        ? Math.max(...sizes)
        : sizes.reduce((sum, size) => sum + size, 0)
      : undefined;
    maximum = budget.perFileGzipKiB ?? budget.gzipKiB;
    unit = budget.perFileGzipKiB ? "KiB gzip per file" : "KiB gzip";
  }
  if (value === undefined) {
    console.error(`BUDGET MISSING ${budget.label}: expected a built artifact`);
    exceeded = true;
  } else {
    const status = value <= maximum ? "PASS" : "FAIL";
    console.log(
      `${status} budget ${budget.label}: ${value.toFixed(1)} / ${maximum.toFixed(1)} ${unit}`,
    );
    exceeded ||= value > maximum;
  }
}
if (exceeded) process.exitCode = 1;
