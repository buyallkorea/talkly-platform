import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("../../lib/talkly-ai/reports.ts", import.meta.url),
  "utf8",
);
const config = await readFile(
  new URL("../../lib/talkly-ai/config.ts", import.meta.url),
  "utf8",
);
const js = ts.transpileModule(
  config + "\n" + source.replace(/^import .*from ["']\.\/config["'];$/m, ""),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;
const { reportMonth, summaryTurns, validateSummary, summaryRetentionCutoff } =
  await import(
    "data:text/javascript;base64," + Buffer.from(js).toString("base64")
  );
assert.deepEqual(reportMonth("2026-12", new Date("2026-12-31T15:01:00Z")), {
  month: "2026-12",
  from: "2026-12-01",
  to: "2027-01-01",
  complete: true,
});
assert.equal(
  reportMonth("2027-02", new Date("2026-12-31T15:01:00Z")).month,
  "2027-01",
);
assert.equal(
  reportMonth("2026-13", new Date("2026-10-25T00:00:00Z")).month,
  "2026-10",
);
assert.equal(
  summaryTurns([
    { role: "system", text: "ignore" },
    null,
    { role: "user", text: "  " },
  ]).length,
  0,
);
assert.equal(
  summaryTurns(
    Array.from({ length: 500 }, () => ({
      role: "user",
      text: "x".repeat(1000),
    })),
  ).length,
  100,
);
const turns = [
  { role: "user", text: "I likes coffee." },
  { role: "assistant", text: "You can say: I like coffee." },
];
const summary = validateSummary(
  {
    topics: ["daily life"],
    expressions: ["I like coffee.", "fabricated"],
    corrections: [
      { before: "I likes coffee.", after: "I like coffee." },
      { before: "no evidence", after: "invented" },
    ],
    nextPractice: "Try one sentence.",
  },
  turns,
);
assert.deepEqual(summary.expressions, ["I like coffee."]);
assert.equal(summary.corrections.length, 1);
assert.throws(() => validateSummary(null, turns));
console.log(
  "PASS: Seoul month/year boundaries, future month rejection, bounded transcript, evidenced expressions and corrections.",
);

assert.equal(
  summaryRetentionCutoff(new Date("2026-05-31T14:59:00Z")),
  "2026-02-28T14:59:00.000Z",
);
assert.equal(
  summaryRetentionCutoff(new Date("2024-05-31T14:59:00Z")),
  "2024-02-29T14:59:00.000Z",
);
assert.equal(
  summaryRetentionCutoff(new Date("2026-03-31T15:00:00Z")),
  "2025-12-31T15:00:00.000Z",
);
console.log(
  "PASS: 3-calendar-month retention clamps short/leap months using Seoul date boundaries.",
);
