import { useEffect, useRef, useState } from "react";
import hljs from "highlight.js";
import type { RecordDetail, SessionSummary } from "@snap-solver/shared";
import { typeLabel, StatusMarker } from "./HistoryList.tsx";
import { exportDetail } from "./export.ts";

const COLUMN_MIN = 600;
const COLUMN_MAX = 1280;
const COLUMN_DEFAULT = 760;
const COLUMN_LS_KEY = "snap-solver.columnWidth";

function clampWidth(w: number): number {
  return Math.min(COLUMN_MAX, Math.max(COLUMN_MIN, Math.round(w)));
}

/** Column width with edge drag handles: one-side drag resizes both edges symmetrically. */
function useColumnWidth(): [number, (side: "left" | "right") => (e: React.PointerEvent<HTMLDivElement>) => void] {
  const [width, setWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem(COLUMN_LS_KEY));
    return Number.isFinite(saved) && saved > 0 ? clampWidth(saved) : COLUMN_DEFAULT;
  });

  const startDrag = (side: "left" | "right") => (e: React.PointerEvent<HTMLDivElement>): void => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    let latest = startW;
    const onMove = (ev: PointerEvent): void => {
      const dx = ev.clientX - startX;
      latest = clampWidth(startW + (side === "right" ? 2 * dx : -2 * dx));
      setWidth(latest);
    };
    const onUp = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      localStorage.setItem(COLUMN_LS_KEY, String(latest));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return [width, startDrag];
}

function sessionTitle(s: SessionSummary): string {
  if (!s.quizType) return "题目分析";
  return s.title ? `${typeLabel(s.quizType)}——${s.title}` : typeLabel(s.quizType);
}

/** Elapsed analysis time from server-side arrival to completion. */
export function elapsedLabel(createdAt: string, finishedAt: string): string | null {
  const ms = new Date(finishedAt).getTime() - new Date(createdAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const s = ms / 1000;
  if (s < 60) return `耗时 ${s.toFixed(1)}s`;
  return `耗时 ${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, "0")}s`;
}

function CodeBlock(props: { code: string; language?: string | null }): React.JSX.Element {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ref.current) {
      delete ref.current.dataset.highlighted;
      hljs.highlightElement(ref.current);
    }
  }, [props.code, props.language]);
  return (
    <pre>
      <code ref={ref} className={props.language ? `language-${props.language}` : undefined}>
        {props.code}
      </code>
    </pre>
  );
}

export function SessionView(props: {
  session: SessionSummary;
  detail: RecordDetail | null;
}): React.JSX.Element {
  const { session, detail } = props;
  const [columnWidth, startDrag] = useColumnWidth();
  const elapsed =
    session.status === "done" && session.finishedAt ? elapsedLabel(session.createdAt, session.finishedAt) : null;
  return (
    <main className="session-view">
      <div className="column-wrap">
        <div className="col-handle" onPointerDown={startDrag("left")} />
        <div className="column" style={{ maxWidth: columnWidth }}>
          <header>
            <h1>{sessionTitle(session)}</h1>
            <StatusMarker status={session.status} />
            {elapsed && <span className="elapsed">{elapsed}</span>}
            {detail && session.status === "done" && (
              <button className="btn-export" onClick={() => exportDetail(detail)}>
                导出 Markdown
              </button>
            )}
          </header>
          <img className="screenshot reveal" src={`/api/images/${session.id}`} alt="题目截图" />
          {session.status === "pending" && <p className="muted">排队等待分析…</p>}
          {session.status === "analyzing" && <p className="muted">分析中，请稍候…</p>}
          {session.status === "failed" && <p className="error">分析失败：{session.error}</p>}
          {detail && session.status === "done" && (
            <section className="result">
              {session.quizType === "not_quiz" ? (
                <p className="muted">截图内容不是题目。</p>
              ) : (
                <div className="paper">
                  {detail.question && (
                    <>
                      <h2 className="section-title reveal">题目</h2>
                      <p className="question reveal">{detail.question}</p>
                    </>
                  )}
                  <h2 className="section-title reveal">答案</h2>
                  <p className="answer reveal d1">{detail.answer}</p>
                  <h2 className="section-title reveal d1">解题思路</h2>
                  <p className="reasoning reveal d2">{detail.reasoning}</p>
                  {detail.code && (
                    <>
                      <h2 className="section-title reveal d2">
                        代码实现{detail.codeLanguage ? `（${detail.codeLanguage}）` : ""}
                      </h2>
                      <div className="reveal d3">
                        <CodeBlock code={detail.code} language={detail.codeLanguage} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
        <div className="col-handle" onPointerDown={startDrag("right")} />
      </div>
    </main>
  );
}
