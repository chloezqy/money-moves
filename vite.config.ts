import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  plugins: [
    {
      name: "preview-route",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === "/preview") req.url = "/preview.html";
          next();
        });
      },
    },
  ],
  server: {
    proxy: { "/api": `http://127.0.0.1:${process.env.API_PORT || "5174"}` },
    allowedHosts: ["terminal.local"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: { app: resolve("index.html"), preview: resolve("preview.html") },
    },
  },
});
