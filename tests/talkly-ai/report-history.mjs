import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("../../lib/talkly-ai/report-history.ts", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile(
  "history.ts",
  source,
  ts.ScriptTarget.Latest,
  true,
);
const js = ts.transpileModule(
  ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getText(ast))
    .join("\n"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;
const { loadReportHistory } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const periods = [
  { month: "2026-08", from: "2026-08-01", to: "2026-09-01", complete: true },
  { month: "2026-09", from: "2026-09-01", to: "2026-10-01", complete: true },
  { month: "2026-10", from: "2026-10-01", to: "2026-11-01", complete: false },
];
let rpcCalls = 0,
  pubReads = 0,
  rpcError = false,
  pubError = false;
let live = [
  { month: "2026-08-01", seconds: 600, days: 1, segments: 3 },
  { month: "2026-09-01", seconds: 1200, days: 2, segments: 6 },
  { month: "2026-10-01", seconds: 0, days: 0, segments: 0 },
];
let publications = [
  {
    month: "2026-08-01",
    published_at: "2026-09-01T00:00:00Z",
    connected_seconds: 500,
    learning_days: 1,
    segments: 2,
  },
];
const db = {
  async rpc(name, args) {
    rpcCalls++;
    assert.equal(name, "ai_activity_history");
    assert.deepEqual(args, {
      p_user: "owner",
      p_from: "2026-08-01",
      p_to: "2026-11-01",
    });
    return { data: live, error: rpcError };
  },
  from(table) {
    pubReads++;
    assert.equal(table, "ai_monthly_publications");
    const q = {
      select() {
        return q;
      },
      eq(key, value) {
        assert.deepEqual([key, value], ["user_id", "owner"]);
        return q;
      },
      in(key, value) {
        assert.equal(key, "month");
        assert.deepEqual(
          value,
          periods.map((p) => p.from),
        );
        return q;
      },
      gt(key, value) {
        assert.equal(key, "published_at");
        assert.equal(value, "cutoff");
        return q;
      },
      then(resolve) {
        return Promise.resolve({ data: publications, error: pubError }).then(
          resolve,
        );
      },
    };
    return q;
  },
};
let result = await loadReportHistory(db, "owner", periods, true, "cutoff");
assert.equal(rpcCalls, 1);
assert.equal(pubReads, 1);
assert.equal(result.rows[0].activity.seconds, 500);
assert.equal(result.rows[0].publishedAt, "2026-09-01T00:00:00Z");
assert.equal(result.rows[1].activity.seconds, 1200);
assert.equal(result.rows[2].activity.seconds, 0);
pubError = true;
result = await loadReportHistory(db, "owner", periods, true, "cutoff");
assert.equal(result.publicationError, true);
assert.equal(result.rows[0].activity.seconds, 600);
assert.equal(result.rows[0].publishedAt, null);
rpcError = true;
result = await loadReportHistory(db, "owner", periods, true, "cutoff");
assert.equal(result.rows[0].activity, null);
assert.equal(result.rows[2].activity, null);
pubError = false;
result = await loadReportHistory(db, "owner", periods, true, "cutoff");
assert.equal(result.rows[0].activity.seconds, 500);
assert.equal(result.rows[1].activity, null);
rpcError = false;
live[1] = { month: "2026-09-01", seconds: -1, days: 2, segments: 1 };
pubReads = 0;
result = await loadReportHistory(db, "owner", periods, false, "cutoff");
assert.equal(pubReads, 0);
assert.equal(result.rows[1].activity, null);
assert.equal(result.rows[0].activity.seconds, 600);
await assert.rejects(loadReportHistory(db, "owner", [], false, "cutoff"));
console.log(
  "PASS: one bounded owner-scoped read, snapshot precedence, real zero vs unavailable, corrupt-row isolation, publication failure fallback and flag-off table isolation",
);
