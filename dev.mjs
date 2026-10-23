import { spawn } from "node:child_process";
const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const managed = process.env.SITES_MANAGED_LINUX_CONTAINER === "1";
const port = process.env.PORT || arg("--port", managed ? "4173" : "5173");
const host =
  process.env.HOST || arg("--host", managed ? "0.0.0.0" : "127.0.0.1");
const api = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
  stdio: "inherit",
  env: { ...process.env, API_PORT: "5174" },
});
const web = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    host,
    "--port",
    String(port),
    "--strictPort",
  ],
  { stdio: "inherit" },
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  api.kill("SIGTERM");
  web.kill("SIGTERM");
  setTimeout(() => process.exit(code), 100).unref();
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
api.on("error", () => stop(1));
web.on("error", () => stop(1));
api.on("exit", (code) => {
  if (!stopping) stop(code || 0);
});
web.on("exit", (code) => {
  if (!stopping) stop(code || 0);
});
