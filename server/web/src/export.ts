import type { RecordDetail } from "@snap-solver/shared";
import { typeLabel } from "./HistoryList.tsx";

/** One record as a Markdown section. Question section omitted when empty (old records). */
export function renderMarkdown(d: RecordDetail): string {
  const heading = d.title ? `${typeLabel(d.quizType)}——${d.title}` : typeLabel(d.quizType);
  const lines: string[] = [
    `# ${heading}`,
    "",
    `> 题型：${typeLabel(d.quizType)} ｜ 时间：${new Date(d.clientTs ?? d.createdAt).toLocaleString()}`,
    "",
  ];
  if (d.question) {
    lines.push("## 题目", "", d.question, "");
  }
  lines.push("## 答案", "", d.answer ?? "", "");
  lines.push("## 解题思路", "", d.reasoning ?? "", "");
  if (d.code) {
    lines.push("## 代码实现", "", "```" + (d.codeLanguage ?? ""), d.code, "```", "");
  }
  return lines.join("\n");
}

/** Strip characters that are illegal or awkward in file names. */
export function safeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, "_").trim();
  return cleaned.length > 0 ? cleaned : "题目";
}

export function download(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Single-record export: named after the gist title, falling back to a short id. */
export function exportDetail(d: RecordDetail): void {
  const base = d.title ?? `题目-${d.id.slice(0, 8)}`;
  download(`${safeFilename(base)}.md`, renderMarkdown(d));
}

/** Batch export: sections joined in list order into one file; failures noted at the tail. */
export function exportMany(details: RecordDetail[], skipped: number): void {
  const body = details.map(renderMarkdown).join("\n\n---\n\n");
  const note =
    skipped > 0 ? `\n\n---\n\n> 注：${skipped} 条选中题目导出失败（可能已被删除），已跳过。\n` : "";
  download(`snap-solver-导出-${new Date().toISOString().slice(0, 10)}.md`, body + note);
}
