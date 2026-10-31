import { seoulDay, type Turn } from "./config";
export type LearningSummary = {
  topics: string[];
  expressions: string[];
  corrections: { before: string; after: string }[];
  nextPractice: string;
};
export function reportMonth(value: unknown, now = new Date()) {
  const current = seoulDay(now).slice(0, 7);
  const month =
    typeof value === "string" &&
    /^20\d{2}-(0[1-9]|1[0-2])$/.test(value) &&
    value <= current
      ? value
      : current;
  const [year, m] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, m, 1)).toISOString().slice(0, 10);
  return { month, from: `${month}-01`, to: next, complete: month < current };
}
export function reportHistoryMonths(value: unknown, now = new Date()) {
  const selected = reportMonth(value, now);
  const [year, month] = selected.month.split("-").map(Number);
  return [2, 1, 0].flatMap((offset) => {
    const key = new Date(Date.UTC(year, month - 1 - offset, 1))
      .toISOString()
      .slice(0, 7);
    return key >= "2000-01" ? [reportMonth(key, now)] : [];
  });
}
// Match PostgreSQL calendar-month subtraction in Asia/Seoul, including month-end clamping.
export function summaryRetentionCutoff(now = new Date()) {
  const offset = 9 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offset);
  const target = new Date(
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth() - 3,
      1,
      local.getUTCHours(),
      local.getUTCMinutes(),
      local.getUTCSeconds(),
      local.getUTCMilliseconds(),
    ),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(local.getUTCDate(), lastDay));
  return new Date(target.getTime() - offset).toISOString();
}
// The browser transcript is a learning aid, not a verified assessment record.
export function summaryTurns(value: unknown): Turn[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-100)
    .flatMap((t) =>
      t &&
      (t.role === "user" || t.role === "assistant") &&
      typeof t.text === "string" &&
      t.text.trim()
        ? [{ role: t.role as Turn["role"], text: t.text.slice(0, 500) }]
        : [],
    );
}
export function validateSummary(
  value: unknown,
  turns: Turn[],
): LearningSummary {
  if (!value || typeof value !== "object") throw new Error("Invalid summary");
  const v = value as Record<string, unknown>;
  const list = (x: unknown) =>
    Array.isArray(x)
      ? x
          .filter(
            (s): s is string =>
              typeof s === "string" && s.length > 0 && s.length <= 160,
          )
          .slice(0, 3)
      : [];
  const users = turns
    .filter((t) => t.role === "user")
    .map((t) => t.text)
    .join("\n")
    .toLowerCase();
  const assistants = turns
    .filter((t) => t.role === "assistant")
    .map((t) => t.text)
    .join("\n")
    .toLowerCase();
  const corrections = Array.isArray(v.corrections)
    ? v.corrections
        .flatMap((c) =>
          c &&
          typeof c.before === "string" &&
          typeof c.after === "string" &&
          c.before.length > 0 &&
          c.after.length > 0 &&
          c.before.length <= 160 &&
          c.after.length <= 160 &&
          users.includes(c.before.toLowerCase()) &&
          assistants.includes(c.after.toLowerCase())
            ? [{ before: c.before, after: c.after }]
            : [],
        )
        .slice(0, 3)
    : [];
  return {
    topics: list(v.topics),
    expressions: list(v.expressions).filter(
      (s) =>
        users.includes(s.toLowerCase()) || assistants.includes(s.toLowerCase()),
    ),
    corrections,
    nextPractice:
      typeof v.nextPractice === "string" ? v.nextPractice.slice(0, 240) : "",
  };
}

// Persisted JSON may predate the current writer or contain malformed values.
// Validate its shape without inventing content or re-assessing transcript evidence.
export function storedLearningSummary(value: unknown): LearningSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const text = (item: unknown, max: number): item is string =>
    typeof item === "string" && item.length <= max;
  const list = (items: unknown): items is string[] =>
    Array.isArray(items) && items.length <= 3 &&
    items.every((item) => text(item, 160) && item.length > 0);
  if (!list(v.topics) || !list(v.expressions) ||
      !Array.isArray(v.corrections) || v.corrections.length > 3 ||
      !v.corrections.every((item) => item && typeof item === "object" &&
        !Array.isArray(item) && text(item.before, 160) && item.before.length > 0 &&
        text(item.after, 160) && item.after.length > 0) ||
      !text(v.nextPractice, 240)) return null;
  return {
    topics: [...v.topics], expressions: [...v.expressions],
    corrections: v.corrections.map((item) => ({ before: item.before, after: item.after })),
    nextPractice: v.nextPractice,
  };
}
