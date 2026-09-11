import { useEffect, useRef } from "react";
import hljs from "highlight.js";
import type { RecordDetail, SessionSummary } from "@snap-solver/shared";
import { typeLabel, StatusMarker } from "./HistoryList.tsx";

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
  return (
    <main className="session-view">
      <div className="column">
        <header>
          <h1>{session.quizType ? typeLabel(session.quizType) : "题目分析"}</h1>
          <StatusMarker status={session.status} />
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
    </main>
  );
}
