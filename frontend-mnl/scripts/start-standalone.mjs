import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const serverPath = path.join(root, ".next", "standalone", "server.js");

try {
  await stat(serverPath);
} catch {
  throw new Error("Standalone server was not found. Run `npm run build` before `npm run start`.");
}

const env = {
  ...process.env,
  HOSTNAME: process.env.HOSTNAME || "0.0.0.0",
  NODE_ENV: process.env.NODE_ENV || "production",
  PORT: process.env.PORT || "3001",
};

const child = spawn(process.execPath, [serverPath], {
  cwd: root,
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
