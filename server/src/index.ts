import fs from "node:fs";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { loadConfig } from "./config.ts";
import { Store } from "./db.ts";
import { AnalysisScheduler } from "./scheduler.ts";
import { registerRoutes } from "./routes.ts";

const VERSION = "0.1.0";

async function main(): Promise<void> {
  const config = loadConfig();
  const store = new Store(config.dataDir);
  const scheduler = new AnalysisScheduler(store);

  // Crash recovery: sessions interrupted mid-analysis go back to the queue.
  const recovered = store.resetOrphanSessions();
  if (recovered > 0) console.log(`Recovered ${recovered} interrupted session(s)`);

  const app = Fastify({ logger: false, bodyLimit: 64 * 1024 * 1024 });
  await app.register(multipart, { limits: { fileSize: 64 * 1024 * 1024, files: 1 } });

  registerRoutes(app, { store, scheduler, version: VERSION });

  if (fs.existsSync(config.webDistDir)) {
    await app.register(fastifyStatic, { root: config.webDistDir });
    // SPA fallback: unknown non-API paths serve the app shell.
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url?.startsWith("/api/")) {
        void reply.code(404).send({ error: "Not found" });
      } else {
        void reply.sendFile("index.html");
      }
    });
  }

  await app.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`snap-solver server listening on http://0.0.0.0:${config.port} (data: ${config.dataDir})`);

  // Re-dispatch any sessions recovered above or queued before boot.
  scheduler.tick();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
