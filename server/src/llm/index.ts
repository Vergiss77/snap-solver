import type { ProviderConfig, QuizResult } from "@snap-solver/shared";
import { ANALYSIS_PROMPT, parseQuizResult } from "./prompt.ts";

export class ProviderError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

const TIMEOUT_MS = 120_000;

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new ProviderError(`Provider HTTP ${res.status}: ${text.slice(0, 500)}`, res.status);
  }
  return JSON.parse(text);
}

export interface ProbeConfig {
  protocol: ProviderConfig["protocol"];
  baseUrl: string;
  apiKey: string;
  model?: string;
}

function authHeaders(cfg: ProbeConfig): Record<string, string> {
  return cfg.protocol === "anthropic"
    ? { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01" }
    : { Authorization: `Bearer ${cfg.apiKey}` };
}

function base(cfg: ProbeConfig): string {
  return cfg.baseUrl.replace(/\/+$/, "");
}

/** GET {baseUrl}/models — both protocols expose the same list shape. */
export async function listModels(cfg: ProbeConfig): Promise<string[]> {
  const res = await fetch(`${base(cfg)}/models`, {
    headers: authHeaders(cfg),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) throw new ProviderError(`Provider HTTP ${res.status}: ${text.slice(0, 500)}`, res.status);
  const data = JSON.parse(text) as { data?: Array<{ id?: string }> };
  const ids = (data.data ?? []).flatMap((m) => (typeof m.id === "string" ? [m.id] : []));
  if (ids.length === 0) throw new ProviderError("Provider returned an empty model list");
  return ids;
}

/** Minimal real call against the configured model; measures round-trip latency. */
export async function testProvider(cfg: ProbeConfig & { model: string }): Promise<{ latencyMs: number }> {
  const started = Date.now();
  const body = { model: cfg.model, max_tokens: 1, messages: [{ role: "user", content: "ping" }] };
  const path = cfg.protocol === "anthropic" ? "/messages" : "/chat/completions";
  await postJson(`${base(cfg)}${path}`, authHeaders(cfg), body);
  return { latencyMs: Date.now() - started };
}

/** OpenAI-compatible path: POST {baseUrl}/chat/completions with base64 image_url. */
export async function analyzeOpenAI(imagePng: Buffer, cfg: ProviderConfig): Promise<{ result: QuizResult; raw: string }> {
  const data = (await postJson(
    `${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`,
    { Authorization: `Bearer ${cfg.apiKey}` },
    {
      model: cfg.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: ANALYSIS_PROMPT },
            { type: "image_url", image_url: { url: `data:image/png;base64,${imagePng.toString("base64")}` } },
          ],
        },
      ],
    },
  )) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content;
  if (typeof raw !== "string" || raw.length === 0) {
    throw new ProviderError("Provider returned empty content");
  }
  return { result: parseQuizResult(raw), raw };
}

/** Anthropic path: POST {baseUrl}/messages with base64 image block. */
export async function analyzeAnthropic(imagePng: Buffer, cfg: ProviderConfig): Promise<{ result: QuizResult; raw: string }> {
  const data = (await postJson(
    `${cfg.baseUrl.replace(/\/+$/, "")}/messages`,
    { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01" },
    {
      model: cfg.model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/png", data: imagePng.toString("base64") } },
            { type: "text", text: ANALYSIS_PROMPT },
          ],
        },
      ],
    },
  )) as { content?: Array<{ type: string; text?: string }> };
  const raw = data.content?.find((b) => b.type === "text")?.text;
  if (typeof raw !== "string" || raw.length === 0) {
    throw new ProviderError("Provider returned empty content");
  }
  return { result: parseQuizResult(raw), raw };
}
