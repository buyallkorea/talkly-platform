import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("../../app/api/talkly-ai/account/route.ts", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile(
  "route.ts",
  source,
  ts.ScriptTarget.Latest,
  true,
);
const code = ast.statements
  .filter((n) => !ts.isImportDeclaration(n))
  .map((n) => n.getText(ast))
  .join("\n");
let enabled = false,
  publicationReads = 0;
const db = {
  from(table) {
    if (table === "ai_monthly_publications") {
      publicationReads++;
      if (!enabled) throw Error("Missing table must not be queried");
    }
    const q = {
      select() {
        return q;
      },
      eq() {
        return q;
      },
      gt() {
        return q;
      },
      order() {
        return q;
      },
      limit() {
        return q;
      },
      maybeSingle() {
        return q;
      },
      then(resolve, reject) {
        let data = null;
        if (table === "ai_members")
          data = { status: "active", valid_until: null, trial_used_seconds: 0 };
        if (table === "profiles") data = { role: "student" };
        if (table === "ai_payments") data = [];
        if (table === "ai_monthly_publications")
          data = { month: "2026-09-01", published_at: "2026-10-01T00:00:00Z" };
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return q;
  },
};
globalThis.monthlyGate = {
  context: async () => ({ user: { id: "owner" }, db }),
  failure: () => Response.json({}, { status: 500 }),
  previewTestMode: () => false,
  monthlyReportsEnabled: () => enabled,
  summaryRetentionCutoff: () => "",
  seoulDay: () => "",
  PLAN: { dailySeconds: 600 },
  TRIAL_SECONDS: 180,
  CONSENT_VERSION: "2026-10-25-v2-adult19",
};
const js = ts.transpileModule(
  "const {context,failure,previewTestMode,monthlyReportsEnabled,summaryRetentionCutoff,seoulDay,PLAN,TRIAL_SECONDS,CONSENT_VERSION}=globalThis.monthlyGate;\n" +
    code,
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;
const { GET } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
let r = await GET();
assert.equal(r.status, 200);
let body = await r.json();
assert.equal(body.latestReport, null);
assert.equal(body.remaining, 180);
assert.equal(publicationReads, 0);
enabled = true;
r = await GET();
assert.equal(r.status, 200);
body = await r.json();
assert.equal(body.latestReport.month, "2026-09-01");
assert.equal(publicationReads, 1);
console.log(
  "PASS: monthly flag off skips unapplied table and preserves trial access; enabled account exposes owned publication.",
);
