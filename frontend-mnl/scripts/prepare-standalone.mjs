import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const standaloneRoot = path.resolve(root, ".next", "standalone");

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function assertInsideStandalone(targetPath) {
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(`${standaloneRoot}${path.sep}`)) {
    throw new Error(`Refusing to write outside standalone output: ${resolved}`);
  }
}

async function copyIntoStandalone(sourcePath, targetPath) {
  if (!(await exists(sourcePath))) {
    return;
  }

  assertInsideStandalone(targetPath);
  await rm(targetPath, { recursive: true, force: true });
  await cp(sourcePath, targetPath, { recursive: true, force: true });
}

if (!(await exists(standaloneRoot))) {
  throw new Error("Next standalone output was not found. Run `next build` first.");
}

await mkdir(path.join(standaloneRoot, ".next"), { recursive: true });
await copyIntoStandalone(path.join(root, ".next", "static"), path.join(standaloneRoot, ".next", "static"));
await copyIntoStandalone(path.join(root, "public"), path.join(standaloneRoot, "public"));

console.log("Standalone output prepared with static assets.");
