import type { ProviderConfig, RecordDetail, SessionSummary } from "@remote-screen/shared";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  records: () => req<SessionSummary[]>("/api/records"),
  recordDetail: (id: string) => req<RecordDetail>(`/api/records/${id}`),
  providers: () => req<ProviderConfig[]>("/api/providers"),
  saveProvider: (p: { id?: string } & Omit<ProviderConfig, "id" | "isActive">) =>
    req<ProviderConfig>("/api/providers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    }),
  deleteProvider: (id: string) => req<{ ok: true }>(`/api/providers/${id}`, { method: "DELETE" }),
  activateProvider: (id: string) => req<{ ok: true }>(`/api/providers/${id}/activate`, { method: "POST" }),
  settings: () => req<{ maxConcurrency: number }>("/api/settings"),
  saveSettings: (maxConcurrency: number) =>
    req<{ maxConcurrency: number }>("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxConcurrency }),
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
