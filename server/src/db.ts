import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  ProviderConfig,
  QuizType,
  RecordDetail,
  SessionStatus,
  SessionSummary,
} from "@snap-solver/shared";

export class Store {
  private db: DatabaseSync;
  readonly dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.db = new DatabaseSync(path.join(dataDir, "app.db"));
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        image_path TEXT NOT NULL,
        client_ts TEXT,
        created_at TEXT NOT NULL,
        finished_at TEXT,
        error TEXT,
        raw_response TEXT
      );
      CREATE TABLE IF NOT EXISTS records (
        session_id TEXT PRIMARY KEY REFERENCES sessions(id),
        quiz_type TEXT NOT NULL,
        title TEXT,
        answer TEXT NOT NULL,
        reasoning TEXT NOT NULL,
        code TEXT,
        code_language TEXT
      );
      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        protocol TEXT NOT NULL,
        base_url TEXT NOT NULL,
        api_key TEXT NOT NULL,
        model TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    // Migration: older databases lack records.title — add it, ignoring "duplicate column".
    try {
      this.db.exec("ALTER TABLE records ADD COLUMN title TEXT");
    } catch {
      /* column already exists */
    }
  }

  // ---- sessions ----

  createSession(imagePath: string, clientTs: string | null): SessionSummary {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO sessions (id, status, image_path, client_ts, created_at) VALUES (?, 'pending', ?, ?, ?)",
      )
      .run(id, imagePath, clientTs, createdAt);
    return { id, status: "pending", clientTs, createdAt, finishedAt: null, quizType: null, title: null, error: null };
  }

  setSessionStatus(id: string, status: SessionStatus, extra?: { error?: string; rawResponse?: string }): void {
    const finishedAt = status === "done" || status === "failed" ? new Date().toISOString() : null;
    this.db
      .prepare(
        `UPDATE sessions SET status = ?,
           finished_at = COALESCE(?, finished_at),
           error = COALESCE(?, error),
           raw_response = COALESCE(?, raw_response)
         WHERE id = ?`,
      )
      .run(status, finishedAt, extra?.error ?? null, extra?.rawResponse ?? null, id);
  }

  /** Crash recovery: sessions left mid-flight by a previous process become pending again. */
  resetOrphanSessions(): number {
    const res = this.db
      .prepare("UPDATE sessions SET status = 'pending' WHERE status = 'analyzing'")
      .run();
    return Number(res.changes);
  }

  listPendingSessionIds(): string[] {
    const rows = this.db
      .prepare("SELECT id FROM sessions WHERE status = 'pending' ORDER BY created_at ASC")
      .all() as Array<{ id: string }>;
    return rows.map((r) => r.id);
  }

  getSession(id: string): SessionSummary | null {
    const row = this.db
      .prepare(
        `SELECT s.id, s.status, s.client_ts, s.created_at, s.finished_at, s.error, r.quiz_type, r.title
         FROM sessions s LEFT JOIN records r ON r.session_id = s.id WHERE s.id = ?`,
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? toSummary(row) : null;
  }

  imagePathOf(id: string): string | null {
    const row = this.db.prepare("SELECT image_path FROM sessions WHERE id = ?").get(id) as
      | { image_path: string }
      | undefined;
    return row ? path.join(this.dataDir, row.image_path) : null;
  }

  // ---- records ----

  insertRecord(rec: {
    sessionId: string;
    quizType: QuizType;
    title: string | null;
    answer: string;
    reasoning: string;
    code: string | null;
    codeLanguage: string | null;
  }): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO records (session_id, quiz_type, title, answer, reasoning, code, code_language) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(rec.sessionId, rec.quizType, rec.title, rec.answer, rec.reasoning, rec.code, rec.codeLanguage);
  }

  listRecords(): SessionSummary[] {
    const rows = this.db
      .prepare(
        `SELECT s.id, s.status, s.client_ts, s.created_at, s.finished_at, s.error, r.quiz_type, r.title
         FROM sessions s LEFT JOIN records r ON r.session_id = s.id
         ORDER BY s.created_at DESC`,
      )
      .all() as Array<Record<string, unknown>>;
    return rows.map(toSummary);
  }

  getRecordDetail(id: string): RecordDetail | null {
    const row = this.db
      .prepare(
        `SELECT s.id, s.status, s.client_ts, s.created_at, s.finished_at, s.error, s.raw_response,
                r.quiz_type, r.title, r.answer, r.reasoning, r.code, r.code_language
         FROM sessions s LEFT JOIN records r ON r.session_id = s.id WHERE s.id = ?`,
      )
      .get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      ...toSummary(row),
      answer: (row.answer as string) ?? null,
      reasoning: (row.reasoning as string) ?? null,
      code: (row.code as string) ?? null,
      codeLanguage: (row.code_language as string) ?? null,
      imageUrl: `/api/images/${row.id}`,
      rawResponse: (row.raw_response as string) ?? null,
    };
  }

  // ---- providers ----

  listProviders(): ProviderConfig[] {
    const rows = this.db.prepare("SELECT * FROM providers ORDER BY name ASC").all() as Array<
      Record<string, unknown>
    >;
    return rows.map(toProvider);
  }

  upsertProvider(p: Omit<ProviderConfig, "id" | "isActive"> & { id?: string }): ProviderConfig {
    const id = p.id ?? randomUUID();
    this.db
      .prepare(
        `INSERT INTO providers (id, name, protocol, base_url, api_key, model, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, protocol=excluded.protocol,
           base_url=excluded.base_url, api_key=excluded.api_key, model=excluded.model`,
      )
      .run(id, p.name, p.protocol, p.baseUrl, p.apiKey, p.model);
    const active = this.db.prepare("SELECT is_active FROM providers WHERE id = ?").get(id) as {
      is_active: number;
    };
    return { ...p, id, isActive: active.is_active === 1 };
  }

  deleteProvider(id: string): void {
    this.db.prepare("DELETE FROM providers WHERE id = ?").run(id);
  }

  setActiveProvider(id: string): void {
    this.db.exec("UPDATE providers SET is_active = 0");
    this.db.prepare("UPDATE providers SET is_active = 1 WHERE id = ?").run(id);
  }

  getActiveProvider(): ProviderConfig | null {
    const row = this.db.prepare("SELECT * FROM providers WHERE is_active = 1").get() as
      | Record<string, unknown>
      | undefined;
    return row ? toProvider(row) : null;
  }

  // ---- settings ----

  getSetting(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  setSetting(key: string, value: string): void {
    this.db
      .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(key, value);
  }
}

function toSummary(row: Record<string, unknown>): SessionSummary {
  return {
    id: row.id as string,
    status: row.status as SessionStatus,
    clientTs: (row.client_ts as string) ?? null,
    createdAt: row.created_at as string,
    finishedAt: (row.finished_at as string) ?? null,
    quizType: (row.quiz_type as QuizType) ?? null,
    title: (row.title as string) ?? null,
    error: (row.error as string) ?? null,
  };
}

function toProvider(row: Record<string, unknown>): ProviderConfig {
  return {
    id: row.id as string,
    name: row.name as string,
    protocol: row.protocol as ProviderConfig["protocol"],
    baseUrl: row.base_url as string,
    apiKey: row.api_key as string,
    model: row.model as string,
    isActive: (row.is_active as number) === 1,
  };
}
