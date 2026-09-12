import fs from "node:fs";
import type { QuizResult, SessionEvent, SessionSummary } from "@snap-solver/shared";
import type { Store } from "./db.ts";
import { analyzeAnthropic, analyzeOpenAI } from "./llm/index.ts";
import { ANALYSIS_PROMPT } from "./llm/prompt.ts";

export const DEFAULT_MAX_CONCURRENCY = 5;
export const MAX_CONCURRENCY_KEY = "maxConcurrency";
export const ANALYSIS_PROMPT_KEY = "analysisPrompt";
export const CODE_LANGUAGE_KEY = "codeLanguage";

type Listener = (event: SessionEvent) => void;

/**
 * In-process scheduler: each screenshot session gets one independent LLM call.
 * Sessions beyond the concurrency cap wait in FIFO order. No retries — a failed
 * call lands in `failed` with the provider error preserved.
 */
export class AnalysisScheduler {
  private running = 0;
  private listeners: Array<Listener> = [];

  private readonly store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  get maxConcurrency(): number {
    const v = this.store.getSetting(MAX_CONCURRENCY_KEY);
    const n = v === null ? NaN : Number(v);
    return Number.isInteger(n) && n >= 1 ? n : DEFAULT_MAX_CONCURRENCY;
  }

  /** Effective analysis prompt: custom setting, falling back to the built-in default. */
  get analysisPrompt(): string {
    const v = this.store.getSetting(ANALYSIS_PROMPT_KEY);
    return v !== null && v.trim().length > 0 ? v : ANALYSIS_PROMPT;
  }

  /** Configured programming language for coding questions; empty = unspecified. */
  get codeLanguage(): string {
    return this.store.getSetting(CODE_LANGUAGE_KEY)?.trim() ?? "";
  }

  /** Final prompt sent to the LLM: user prompt + appended language directive (never inlined as a placeholder). */
  buildPrompt(): string {
    const lang = this.codeLanguage;
    if (!lang) return this.analysisPrompt;
    return `${this.analysisPrompt}\n\n附加要求：若截图为编程题，代码实现必须使用 ${lang}。`;
  }

  onEvent(listener: Listener): void {
    this.listeners.push(listener);
  }

  emit(kind: SessionEvent["kind"], session: SessionSummary): void {
    for (const l of this.listeners) l({ kind, session });
  }

  /** Call after creating a session and on boot recovery. */
  tick(): void {
    while (this.running < this.maxConcurrency) {
      const [next] = this.store.listPendingSessionIds();
      if (!next) return;
      this.running += 1;
      void this.run(next).finally(() => {
        this.running -= 1;
        this.tick();
      });
    }
  }

  private async run(id: string): Promise<void> {
    this.store.setSessionStatus(id, "analyzing");
    this.emit("session.started", this.store.getSession(id)!);
    try {
      const provider = this.store.getActiveProvider();
      if (!provider) throw new Error("No active LLM provider configured");
      const imagePath = this.store.imagePathOf(id);
      if (!imagePath) throw new Error(`Image missing for session ${id}`);
      const image = fs.readFileSync(imagePath);
      const prompt = this.buildPrompt();
      const { result, raw } =
        provider.protocol === "anthropic"
          ? await analyzeAnthropic(image, provider, prompt)
          : await analyzeOpenAI(image, provider, prompt);
      this.store.setSessionStatus(id, "done", { rawResponse: raw });
      this.archive(id, result);
      this.emit("session.done", this.store.getSession(id)!);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.store.setSessionStatus(id, "failed", { error: message });
      this.emit("session.failed", this.store.getSession(id)!);
    }
  }

  private archive(id: string, result: QuizResult): void {
    this.store.insertRecord({
      sessionId: id,
      quizType: result.type,
      title: result.title ?? null,
      answer: result.answer,
      reasoning: result.reasoning,
      code: result.code ?? null,
      codeLanguage: result.codeLanguage ?? null,
    });
  }
}
