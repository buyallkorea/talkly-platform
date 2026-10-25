import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
let enabled = false,
  available = false,
  window = true,
  calls = [],
  dbCreated = 0;
const row = {
  id: "server-job",
  user_id: "owner",
  channel: "email",
  kind: "trial_followup",
  activity_anchor: "2026-10-20T00:00:00Z",
  consent_revision: 2,
  claim_token: "server-token",
};
const db = {
  from(table) {
    assert.equal(table, "ai_outreach_outbox");
    const q = {
      select: () => q,
      eq: (key, value) => {
        assert.deepEqual([key, value], ["state", "pending"]);
        return q;
      },
      in: () => q,
      or: () => q,
      order: () => q,
      limit: (n) => {
        assert.equal(n, 3);
        return q;
      },
      abortSignal: async () => ({ data: [{ id: row.id }], error: null }),
    };
    return q;
  },
  rpc(name, args) {
    calls.push([name, args]);
    return {
      abortSignal: async () => ({
        data: name === "ai_claim_outreach" ? row : true,
        error: null,
      }),
    };
  },
};
globalThis.workerHarness = {
  createAdminClient: () => {
    dbCreated++;
    return db;
  },
  outreachSendConfiguration: () => ({
    enabled,
    origin: "https://test.example",
    operatorContact: "help",
    available: { email: available, kakao: false },
  }),
  outreachWindow: () => window,
  resolveOutreachRecipient: async () => {
    throw Error("not called by mock workflow");
  },
  issueUnsubscribeLink: async () => {
    throw Error("not called by mock workflow");
  },
  deliverOutreach: async () => {
    throw Error("no real provider");
  },
  processClaimedOutreach: async (value, settings, deps) => {
    assert.equal(value.claim_token, "server-token");
    assert.equal(settings.origin, "https://test.example");
    assert.equal(await deps.eligible(value), true);
    assert.equal(
      await deps.finish(value, {
        state: "accepted",
        providerId: "server-provider-id",
      }),
      true,
    );
    return { state: "accepted", recorded: true };
  },
};
const src = await readFile(
  new URL("../../lib/talkly-ai/outreach-worker.ts", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile("worker.ts", src, ts.ScriptTarget.Latest, true);
const code =
  "const {createAdminClient,outreachSendConfiguration,outreachWindow,resolveOutreachRecipient,issueUnsubscribeLink,deliverOutreach,processClaimedOutreach}=globalThis.workerHarness;" +
  ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getText(ast))
    .join("\n");
const { runOutreachBatch } = await import(
  "data:text/javascript;base64," +
    Buffer.from(
      ts.transpileModule(code, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
    ).toString("base64")
);
assert.equal((await runOutreachBatch()).status, "off");
assert.equal(dbCreated, 0);
enabled = true;
assert.equal((await runOutreachBatch()).status, "unconfigured");
assert.equal(dbCreated, 0);
available = true;
window = false;
assert.equal((await runOutreachBatch()).status, "outside_hours");
assert.equal(dbCreated, 0);
window = true;
const result = await runOutreachBatch();
assert.equal(result.accepted, 1);
assert.deepEqual(
  calls.map((c) => c[0]),
  ["ai_claim_outreach", "ai_outreach_eligible", "ai_finish_outreach"],
);
assert.deepEqual(calls.at(-1)[1], {
  p_id: row.id,
  p_token: "server-token",
  p_state: "accepted",
  p_provider: "server-provider-id",
});
console.log(
  "PASS: delivery OFF/missing config/outside window do not access queue, batch capped at three, server-owned claim/recipient/revision and result token retained; no real sends",
);
