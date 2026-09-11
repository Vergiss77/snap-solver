import { useCallback, useEffect, useState } from "react";
import type { RecordDetail, SessionEvent, SessionSummary } from "@snap-solver/shared";
import { api } from "./api.ts";
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

  const refresh = useCallback((): void => {
    void api.records().then(setSessions);
  }, []);

  const onEvent = useCallback(
    (e: SessionEvent): void => {
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
    [],
  );

  const connected = useSessionEvents(onEvent, refresh);
  useEffect(refresh, [refresh]);

  const viewing = selectedId ?? sessions[0]?.id ?? null;
  const viewingSummary = sessions.find((s) => s.id === viewing) ?? null;

  useEffect(() => {
    if (viewing === null) return;
    if (viewingSummary?.status !== "done" && viewingSummary?.status !== "failed") return;
    void api.recordDetail(viewing).then(setDetail);
  }, [viewing, viewingSummary?.status]);

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
