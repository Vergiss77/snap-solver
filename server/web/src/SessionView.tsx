import { useEffect, useRef } from "react";
import hljs from "highlight.js";
import type { RecordDetail, SessionSummary } from "@snap-solver/shared";
import { typeLabel } from "./HistoryList.tsx";

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
      <header>
        <h1>{session.quizType ? typeLabel(session.quizType) : "题目分析"}</h1>
        <span className={`badge badge-${session.status}`}>{session.status}</span>
      </header>
      <img className="screenshot" src={`/api/images/${session.id}`} alt="题目截图" />
      {session.status === "pending" && <p className="muted">排队等待分析…</p>}
      {session.status === "analyzing" && <p className="muted">分析中，请稍候…</p>}
      {session.status === "failed" && <p className="error">分析失败：{session.error}</p>}
      {detail && session.status === "done" && (
        <section className="result">
          {session.quizType === "not_quiz" ? (
            <p className="muted">截图内容不是题目。</p>
          ) : (
            <>
              <h2>答案</h2>
              <p className="answer">{detail.answer}</p>
              <h2>解题思路</h2>
              <p className="reasoning">{detail.reasoning}</p>
              {detail.code && (
                <>
                  <h2>代码实现{detail.codeLanguage ? `（${detail.codeLanguage}）` : ""}</h2>
                  <CodeBlock code={detail.code} language={detail.codeLanguage} />
                </>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
