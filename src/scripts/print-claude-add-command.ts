import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveIndexTsAbsolutePath(): string {
  const repoRootIndex = path.resolve(__dirname, "../../index.ts");
  if (fs.existsSync(repoRootIndex)) return repoRootIndex;
  const cwdIndex = path.resolve(process.cwd(), "index.ts");
  return cwdIndex;
}

const indexPath = resolveIndexTsAbsolutePath();
const quotedPath = `"${indexPath}"`;

console.log(`claude mcp add --transport stdio crucible ${quotedPath}`);
