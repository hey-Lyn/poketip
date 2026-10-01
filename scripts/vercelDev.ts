import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const extraArguments = process.argv.slice(2);
const child = process.platform === "win32"
  ? spawn(
      ["npx.cmd", "vercel", "dev", ...extraArguments].join(" "),
      { env: process.env, shell: true, stdio: "inherit" },
    )
  : spawn("npx", ["vercel", "dev", ...extraArguments], {
      env: process.env,
      stdio: "inherit",
    });

let stopping = false;

function stopChild(signal) {
  if (stopping || child.exitCode !== null) return;
  stopping = true;

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } else {
    child.kill(signal);
  }
}

process.once("SIGINT", () => stopChild("SIGINT"));
process.once("SIGTERM", () => stopChild("SIGTERM"));

child.on("exit", (code) => {
  process.exitCode = code ?? (stopping ? 0 : 1);
});
