import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("src/core/domain-core.cjs");
const extensionCoreDir = path.resolve("extension/core");
const targetPath = path.join(extensionCoreDir, "domain-core.js");
const legacyTargetPath = path.join(extensionCoreDir, "domain-core.cjs");

const source = await fs.readFile(sourcePath, "utf8");

await fs.mkdir(extensionCoreDir, { recursive: true });
await fs.writeFile(
  targetPath,
  `// Generated from src/core/domain-core.cjs.\n// Run \`npm run sync:core\` after editing the canonical source.\n\n${source}`,
  "utf8"
);

await fs.rm(legacyTargetPath, { force: true });

console.log(`Synced shared core to ${targetPath}`);
