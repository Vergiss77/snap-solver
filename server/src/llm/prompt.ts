import { QuizType, type QuizResult } from "@snap-solver/shared";

export const ANALYSIS_PROMPT = `你是一名全能解题助手。用户会给你一张电脑屏幕截图。

第一步：判断截图内容是否是一道题目（考试题、练习题、面试题、编程题等均算题目）。桌面、聊天窗口、普通网页等不算题目。

第二步：如果是题目，将其分类为以下四类之一：
- choice（选择题，含单选/多选/判断题）
- fill_blank（填空题）
- short_answer（简答题）
- programming（编程题/算法题，要求编写代码）

第三步：生成解答。
- 选择题：给出正确选项，并逐项解析为什么对/错。
- 填空题：给出每个空的标准答案，并解释。
- 简答题：给出完整、条理清晰的参考答案。
- 编程题：给出解题思路（算法选择、复杂度分析）和完整可运行的代码实现。

你必须只输出一个 JSON 对象，不要输出任何其他文字、解释或 Markdown 代码围栏。JSON 结构如下：
{
  "isQuiz": true 或 false,
  "type": "choice" | "fill_blank" | "short_answer" | "programming" | "not_quiz",
  "answer": "答案正文（非题目时为空字符串）",
  "reasoning": "解题思路与解析（非题目时为空字符串）",
  "code": "完整代码（仅编程题，其他题型省略此字段或为空字符串）",
  "codeLanguage": "代码语言如 python/java/cpp（仅编程题）"
}`;

const VALID_TYPES: Record<string, true> = { choice: true, fill_blank: true, short_answer: true, programming: true, not_quiz: true };

/** Models sometimes answer with Chinese labels despite the enum instruction — map them back. */
const TYPE_ALIASES: Record<string, string> = {
  "选择": "choice", "选择题": "choice", "单选": "choice", "多选": "choice", "判断": "choice", "判断题": "choice",
  "填空": "fill_blank", "填空题": "fill_blank",
  "简答": "short_answer", "简答题": "short_answer",
  "编程": "programming", "编程题": "programming", "算法": "programming", "算法题": "programming",
  "非题目": "not_quiz",
};

/**
 * Lenient parse: extract the first {...} block and validate required fields.
 * Throws on unrecoverable shape — caller records the raw response for debugging.
 */
export function parseQuizResult(raw: string): QuizResult {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("LLM response contains no JSON object");
  }
  const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("LLM response JSON is not an object");
  }
  const obj = parsed as Record<string, unknown>;
  const isQuiz = obj.isQuiz === true;
  const rawType = typeof obj.type === "string" ? (TYPE_ALIASES[obj.type] ?? obj.type) : null;
  const type = rawType !== null && VALID_TYPES[rawType] ? (rawType as QuizResult["type"]) : null;
  if (!type) throw new Error(`LLM response has invalid type: ${String(obj.type)}`);
  if (isQuiz && type === QuizType.NotQuiz) throw new Error("LLM response inconsistent: isQuiz=true but type=not_quiz");
  return {
    isQuiz,
    type,
    answer: typeof obj.answer === "string" ? obj.answer : "",
    reasoning: typeof obj.reasoning === "string" ? obj.reasoning : "",
    code: typeof obj.code === "string" && obj.code.length > 0 ? obj.code : undefined,
    codeLanguage: typeof obj.codeLanguage === "string" ? obj.codeLanguage : undefined,
  };
}
