import { useCallback, useEffect, useState } from "react";
import type { RecordDetail, SessionEvent, SessionSummary } from "@snap-solver/shared";
import { api } from "./api.ts";
import { exportMany } from "./export.ts";
import { useSessionEvents } from "./useEvents.ts";
import { HistoryList } from "./HistoryList.tsx";
import { SessionView } from "./SessionView.tsx";
import { ConfigPanel } from "./ConfigPanel.tsx";

export function App(): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  /** null = follow latest; otherwise a pinned history id. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RecordDetail | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [newArrival, setNewArrival] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  /** Checkbox selection for batch ops — browser-session only, never persisted. */
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(new Set());

  const refresh = useCallback((): void => {
    void api.records().then(setSessions);
  }, []);

  const onEvent = useCallback(
    (e: SessionEvent): void => {
      if (e.kind === "records-changed") {
        // Batch delete (from any dashboard): pull the authoritative list.
        refresh();
        return;
      }
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === e.session.id);
        const next = idx >= 0 ? prev.map((s) => (s.id === e.session.id ? e.session : s)) : [e.session, ...prev];
        return next;
      });
      if (e.kind === "session.created") {
        // Follow-latest: jump to the new session unless the user pinned a history entry.
        setSelectedId((cur) => {
          if (cur === null) return null;
          setNewArrival(e.session.id);
          return cur;
        });
        setDetail(null);
      } else {
        // Refresh detail if the updated session is on screen.
        setDetail((cur) => (cur && cur.id === e.session.id ? null : cur));
      }
    },
    [refresh],
  );

  const connected = useSessionEvents(onEvent, refresh);
  useEffect(refresh, [refresh]);

  const viewing = selectedId ?? sessions[0]?.id ?? null;
  const viewingSummary = sessions.find((s) => s.id === viewing) ?? null;

  // Prune checked ids that no longer exist (deleted here or elsewhere).
  useEffect(() => {
    setCheckedIds((prev) => {
      if (prev.size === 0) return prev;
      const alive = new Set(sessions.map((s) => s.id));
      const next = new Set([...prev].filter((id) => alive.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [sessions]);

  useEffect(() => {
    if (viewing === null) return;
    if (viewingSummary?.status !== "done" && viewingSummary?.status !== "failed") return;
    void api.recordDetail(viewing).then(setDetail);
  }, [viewing, viewingSummary?.status]);

  const deleteChecked = (): void => {
    const ids = [...checkedIds];
    if (ids.length === 0) return;
    if (!window.confirm(`将删除 ${ids.length} 条题目及其截图，不可恢复。确定删除？`)) return;
    void api.batchDeleteRecords(ids).then(() => {
      setCheckedIds(new Set());
      // If the pinned entry was deleted, fall back to follow-latest.
      setSelectedId((cur) => (cur !== null && ids.includes(cur) ? null : cur));
    });
  };

  const exportChecked = (): void => {
    // List order (newest first), capped-concurrency detail fetches.
    const ids = sessions.filter((s) => checkedIds.has(s.id)).map((s) => s.id);
    if (ids.length === 0) return;
    void (async () => {
      const details: RecordDetail[] = [];
      let skipped = 0;
      const POOL = 8;
      for (let i = 0; i < ids.length; i += POOL) {
        const results = await Promise.allSettled(ids.slice(i, i + POOL).map((id) => api.recordDetail(id)));
        for (const r of results) {
          if (r.status === "fulfilled") details.push(r.value);
          else skipped += 1;
        }
      }
      if (details.length > 0) exportMany(details, skipped);
    })();
  };

  return (
    <div className="app">
      <nav className="topbar">
        {!showConfig && (
          <button className="history-toggle" onClick={() => setDrawerOpen((v) => !v)}>
            历史
          </button>
        )}
        <span className="logo">
          <span className="mark" />
          <span className="wordmark">Snap Solver</span>
        </span>
        <span className={connected ? "conn ok" : "conn bad"}>
          <span className="dot" />
          {connected ? "已连接" : "连接断开，重连中…"}
        </span>
        <span className="spacer" />
        <button onClick={() => setShowConfig((v) => !v)}>{showConfig ? "返回题目" : "配置"}</button>
      </nav>
      {newArrival && (
        <div className="banner">
          新题已到达。
          <span className="spacer">
            <button
              className="btn-primary"
              onClick={() => {
                setSelectedId(null);
                setNewArrival(null);
              }}
            >
              查看新题
            </button>
            <button onClick={() => setNewArrival(null)}>继续浏览当前</button>
          </span>
        </div>
      )}
      {showConfig ? (
        <ConfigPanel port={location.port ? Number(location.port) : 80} />
      ) : (
        <div className="content">
          {drawerOpen && <div className="overlay" onClick={() => setDrawerOpen(false)} />}
          <HistoryList
            sessions={sessions}
            selectedId={viewing}
            open={drawerOpen}
            onSelect={(id) => {
              setSelectedId(id);
              setDrawerOpen(false);
            }}
            checkedIds={checkedIds}
            onToggleCheck={(id) =>
              setCheckedIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onCheckAll={(checked) =>
              setCheckedIds(checked ? new Set(sessions.map((s) => s.id)) : new Set())
            }
            onDeleteChecked={deleteChecked}
            onExportChecked={exportChecked}
          />
          {viewingSummary ? (
            <SessionView
              key={viewingSummary.id}
              session={viewingSummary}
              detail={detail?.id === viewingSummary.id ? detail : null}
            />
          ) : (
            <main className="session-view empty">
              <p className="muted">等待客户端截图…</p>
            </main>
          )}
        </div>
      )}
    </div>
  );
}
