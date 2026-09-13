import type { SessionSummary, QuizType } from "@snap-solver/shared";

const TYPE_LABELS: Record<QuizType, string> = {
  choice: "选择题",
  fill_blank: "填空题",
  short_answer: "简答题",
  programming: "编程题",
  not_quiz: "非题目",
};

export function typeLabel(t: QuizType | null): string {
  return t === null ? "—" : TYPE_LABELS[t];
}

const STATUS_LABELS: Record<SessionSummary["status"], string> = {
  pending: "排队中",
  analyzing: "分析中…",
  done: "已完成",
  failed: "失败",
};

/** 文字式状态徽记：分析中带呼吸圆点。 */
export function StatusMarker(props: { status: SessionSummary["status"] }): React.JSX.Element {
  return (
    <span className={`status-mark status-${props.status}`}>
      <span className="dot" />
      {STATUS_LABELS[props.status]}
    </span>
  );
}

export function HistoryList(props: {
  sessions: SessionSummary[];
  selectedId: string | null;
  open: boolean;
  onSelect: (id: string) => void;
  checkedIds: ReadonlySet<string>;
  onToggleCheck: (id: string) => void;
  onCheckAll: (checked: boolean) => void;
  onDeleteChecked: () => void;
  onExportChecked: () => void;
}): React.JSX.Element {
  const allChecked = props.sessions.length > 0 && props.checkedIds.size === props.sessions.length;
  return (
    <aside className={`history ${props.open ? "open" : ""}`}>
      <h2>历史题目</h2>
      <div className="history-actions">
        <button className="btn-mini" onClick={() => props.onCheckAll(!allChecked)}>
          {allChecked ? "全不选" : "全选"}
        </button>
        <span className="spacer" />
        <button
          className="btn-mini"
          disabled={props.checkedIds.size === 0}
          onClick={props.onExportChecked}
        >
          导出 ({props.checkedIds.size})
        </button>
        <button
          className="btn-mini btn-danger"
          disabled={props.checkedIds.size === 0}
          onClick={props.onDeleteChecked}
        >
          删除 ({props.checkedIds.size})
        </button>
      </div>
      {props.sessions.length === 0 && <p className="muted" style={{ padding: "0 20px" }}>暂无记录</p>}
      <ul>
        {props.sessions.map((s) => (
          <li
            key={s.id}
            className={`history-item status-${s.status} ${s.id === props.selectedId ? "selected" : ""}`}
            onClick={() => props.onSelect(s.id)}
          >
            <input
              type="checkbox"
              className="pick"
              checked={props.checkedIds.has(s.id)}
              onClick={(e) => e.stopPropagation()}
              onChange={() => props.onToggleCheck(s.id)}
            />
            <span className="text">
              <span className="type">
                {typeLabel(s.quizType)}
                {s.title ? `——${s.title}` : ""}
              </span>
              <span className="meta">
                <span className="time">{new Date(s.clientTs ?? s.createdAt).toLocaleString()}</span>
                <StatusMarker status={s.status} />
              </span>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
