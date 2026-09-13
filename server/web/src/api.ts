import type { ProviderConfig, RecordDetail, SessionSummary } from "@snap-solver/shared";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

export interface ServerSettings {
  maxConcurrency: number;
  /** Effective analysis prompt (custom or built-in default full text). */
  analysisPrompt: string;
  codeLanguage: string;
}

export const api = {
  records: () => req<SessionSummary[]>("/api/records"),
  recordDetail: (id: string) => req<RecordDetail>(`/api/records/${id}`),
  batchDeleteRecords: (ids: string[]) =>
    req<{ deleted: number }>("/api/records/batch-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }),
  providers: () => req<ProviderConfig[]>("/api/providers"),
  saveProvider: (p: { id?: string } & Omit<ProviderConfig, "id" | "isActive">) =>
    req<ProviderConfig>("/api/providers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    }),
  deleteProvider: (id: string) => req<{ ok: true }>(`/api/providers/${id}`, { method: "DELETE" }),
  activateProvider: (id: string) => req<{ ok: true }>(`/api/providers/${id}/activate`, { method: "POST" }),
  settings: () => req<ServerSettings>("/api/settings"),
  saveSettings: (patch: Partial<ServerSettings>) =>
    req<ServerSettings>("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  listModels: (p: { protocol: string; baseUrl: string; apiKey: string }) =>
    req<{ models: string[] }>("/api/providers/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    }),
  testProvider: (p: { protocol: string; baseUrl: string; apiKey: string; model: string }) =>
    req<{ ok: true; latencyMs: number }>("/api/providers/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    }),
};
