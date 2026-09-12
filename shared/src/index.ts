/** Session lifecycle states — keep in sync with specs/analysis-orchestration. */
export const SessionStatus = {
  Pending: "pending",
  Analyzing: "analyzing",
  Done: "done",
  Failed: "failed",
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

/** Quiz classification produced by the LLM analysis. */
export const QuizType = {
  Choice: "choice",
  FillBlank: "fill_blank",
  ShortAnswer: "short_answer",
  Programming: "programming",
  NotQuiz: "not_quiz",
} as const;
export type QuizType = (typeof QuizType)[keyof typeof QuizType];

/** Structured result expected from a single LLM vision call. */
export interface QuizResult {
  isQuiz: boolean;
  type: QuizType;
  /** Short gist title (<=15 chars) summarizing the question, e.g. "求二叉树最大深度". */
  title?: string;
  /** The answer itself (selected option, filled blanks, short answer, or summary for programming). */
  answer: string;
  /** Step-by-step reasoning / solution walkthrough. */
  reasoning: string;
  /** Full code implementation — present for programming questions. */
  code?: string;
  /** Programming language of `code`, when present. */
  codeLanguage?: string;
}

export type ProviderProtocol = "openai" | "anthropic";

export interface ProviderConfig {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  isActive: boolean;
}

export interface SessionSummary {
  id: string;
  status: SessionStatus;
  clientTs: string | null;
  createdAt: string;
  finishedAt: string | null;
  quizType: QuizType | null;
  /** Gist title from the LLM analysis; null for old records or unparseable responses. */
  title: string | null;
  error: string | null;
}

export interface RecordDetail extends SessionSummary {
  answer: string | null;
  reasoning: string | null;
  code: string | null;
  codeLanguage: string | null;
  imageUrl: string;
  rawResponse: string | null;
}

/** SSE event payloads pushed over GET /api/events. */
export interface SessionEvent {
  kind: "session.created" | "session.started" | "session.done" | "session.failed";
  session: SessionSummary;
}
