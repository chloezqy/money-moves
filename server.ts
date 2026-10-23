import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { runGoalAgent, openAITransport } from "./agent";
import { runLifeAgent } from "./life-agent";
if (existsSync(".env")) process.loadEnvFile(".env");
export function makeServer() {
  const production = process.argv.includes("--production");
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const transport = key ? openAITransport(key, model) : undefined;
  return createServer(async (req, res) => {
    const path = new URL(req.url || "/", "http://localhost").pathname;
    const json = (code: number, body: unknown) => {
      res.writeHead(code, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(body));
    };
    if (req.method === "GET" && path === "/api/config") {
      json(200, { mode: key ? "live" : "example" });
      return;
    }
    if (req.method === "POST" && ["/api/plan", "/api/life"].includes(path)) {
      const origin = req.headers.origin;
      if (
        origin &&
        !/^https?:\/\/(localhost|127\.0\.0\.1|terminal\.local)(:\d+)?$/.test(
          origin,
        )
      ) {
        json(403, { error: "Origin not allowed" });
        return;
      }
      const controller = new AbortController();
      res.on("close", () => {
        if (!res.writableEnded) controller.abort();
      });
      try {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 16384) {
            json(413, { error: "Request too large" });
            return;
          }
        }
        const result = await (
          path === "/api/life" ? runLifeAgent : runGoalAgent
        )(JSON.parse(body), transport, controller.signal);
        json(200, result);
      } catch {
        if (!res.destroyed)
          json(400, {
            error:
              "We couldn’t read this request. Your current plan is unchanged.",
          });
      }
      return;
    }
    if (production && req.method === "GET") {
      const root = resolve("dist");
      const safe =
        path === "/"
          ? "/index.html"
          : path === "/preview"
            ? "/preview.html"
            : path;
      const target = resolve(root, `.${safe}`);
      if (!target.startsWith(root + "/") || safe.includes("..")) {
        res.writeHead(404).end();
        return;
      }
      try {
        const file = await readFile(target);
        const types: Record<string, string> = {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
        };
        res.writeHead(200, {
          "Content-Type": types[extname(target)] || "application/octet-stream",
        });
        res.end(file);
      } catch {
        res.writeHead(404).end("Not found");
      }
      return;
    }
    json(404, { error: "Not found" });
  });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(
    process.env.API_PORT ||
      (process.argv.includes("--production") ? 5173 : 5174),
  );
  makeServer().listen(port, "127.0.0.1", () =>
    console.log(
      `Money Moves server on port ${port} (${process.env.OPENAI_API_KEY ? "live" : "example"} mode)`,
    ),
  );
}
