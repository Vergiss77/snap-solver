import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import type { FastifyInstance } from "fastify";
import type { ProviderConfig, SessionEvent } from "@remote-screen/shared";
import type { Store } from "./db.ts";
import type { AnalysisScheduler } from "./scheduler.ts";
import { MAX_CONCURRENCY_KEY } from "./scheduler.ts";
import { listModels, testProvider } from "./llm/index.ts";


export interface RouteDeps {
  store: Store;
  scheduler: AnalysisScheduler;
  version: string;
}

export function registerRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { store, scheduler } = deps;

  app.get("/api/health", () => ({ name: "remote-screen-server", version: deps.version }));

  // ---- screenshot ingest ----

  app.post("/api/screenshots", async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "Missing image file field" });
    const image = await file.toBuffer();
    try {
      PNG.sync.read(image);
    } catch {
      return reply.code(400).send({ error: "Image is not a decodable PNG" });
    }
    const clientTs = typeof file.fields.clientTs === "object" && file.fields.clientTs && "value" in file.fields.clientTs
      ? String((file.fields.clientTs as { value: unknown }).value)
      : null;
    // Persist image + session row BEFORE acknowledging (crash-recovery invariant).
    const relPath = path.join("images", `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.png`);
    fs.writeFileSync(path.join(store.dataDir, relPath), image);
    const session = store.createSession(relPath, clientTs);
    scheduler.tick();
    scheduler.emit("session.created", session);
    return reply.code(202).send({ sessionId: session.id });
  });

  app.get("/api/images/:sessionId", async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const abs = store.imagePathOf(sessionId);
    if (!abs || !fs.existsSync(abs)) return reply.code(404).send({ error: "Image not found" });
    reply.header("Content-Type", "image/png");
    return reply.send(fs.createReadStream(abs));
  });

  // ---- records ----

  app.get("/api/records", () => store.listRecords());

  app.get("/api/records/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const detail = store.getRecordDetail(id);
    if (!detail) return reply.code(404).send({ error: "Record not found" });
    return detail;
  });

  // ---- SSE event stream ----

  app.get("/api/events", (req, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    reply.raw.write(": connected\n\n");
    const listener = (event: SessionEvent) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    scheduler.onEvent(listener);
    // Heartbeat keeps proxies/browsers from closing idle connections.
    const heartbeat = setInterval(() => reply.raw.write(": ping\n\n"), 25_000);
    req.raw.on("close", () => {
      clearInterval(heartbeat);
    });
  });

  // ---- providers & settings ----

  app.get("/api/providers", () => store.listProviders());

  app.put("/api/providers", async (req, reply) => {
    const body = req.body as Partial<ProviderConfig> & { id?: string };
    if (!body.name || !body.baseUrl || !body.apiKey || !body.model || (body.protocol !== "openai" && body.protocol !== "anthropic")) {
      return reply.code(400).send({ error: "name, protocol (openai|anthropic), baseUrl, apiKey, model are required" });
    }
    return store.upsertProvider({
      id: body.id,
      name: body.name,
      protocol: body.protocol,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      model: body.model,
    });
  });

  app.delete("/api/providers/:id", async (req) => {
    store.deleteProvider((req.params as { id: string }).id);
    return { ok: true };
  });

  app.post("/api/providers/:id/activate", async (req) => {
    store.setActiveProvider((req.params as { id: string }).id);
    return { ok: true };
  });

  // Probe endpoints: take connection params in the body (apiKey never in URL).
  app.post("/api/providers/models", async (req, reply) => {
    const body = req.body as Partial<{ protocol: string; baseUrl: string; apiKey: string }>;
    if (!body.baseUrl || !body.apiKey || (body.protocol !== "openai" && body.protocol !== "anthropic")) {
      return reply.code(400).send({ error: "protocol (openai|anthropic), baseUrl, apiKey are required" });
    }
    try {
      const models = await listModels({ protocol: body.protocol, baseUrl: body.baseUrl, apiKey: body.apiKey });
      return { models };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(502).send({ error: msg });
    }
  });

  app.post("/api/providers/test", async (req, reply) => {
    const body = req.body as Partial<{ protocol: string; baseUrl: string; apiKey: string; model: string }>;
    if (!body.baseUrl || !body.apiKey || !body.model || (body.protocol !== "openai" && body.protocol !== "anthropic")) {
      return reply.code(400).send({ error: "protocol (openai|anthropic), baseUrl, apiKey, model are required" });
    }
    try {
      const { latencyMs } = await testProvider({ protocol: body.protocol, baseUrl: body.baseUrl, apiKey: body.apiKey, model: body.model });
      return { ok: true, latencyMs };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(502).send({ error: msg });
    }
  });

  app.get("/api/settings", () => ({ maxConcurrency: scheduler.maxConcurrency }));

  app.put("/api/settings", async (req, reply) => {
    const body = req.body as { maxConcurrency?: unknown };
    const n = Number(body.maxConcurrency);
    if (!Number.isInteger(n) || n < 1 || n > 32) {
      return reply.code(400).send({ error: "maxConcurrency must be an integer in [1, 32]" });
    }
    store.setSetting(MAX_CONCURRENCY_KEY, String(n));
    scheduler.tick(); // raised cap takes effect immediately
    return { maxConcurrency: n };
  });
}

