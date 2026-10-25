import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
async function compile(path, prelude = "") {
  const src = await readFile(new URL("../../" + path, import.meta.url), "utf8");
  const ast = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true);
  return import(
    "data:text/javascript;base64," +
      Buffer.from(
        ts.transpileModule(
          prelude +
            ast.statements
              .filter((n) => !ts.isImportDeclaration(n))
              .map((n) => n.getText(ast))
              .join("\n"),
          {
            compilerOptions: {
              module: ts.ModuleKind.ESNext,
              target: ts.ScriptTarget.ES2022,
            },
          },
        ).outputText,
      ).toString("base64")
  );
}
const drafts = {
  trial_followup: {
    title: "(광고) Test",
    text: "(광고) TALKLY AI\n#{서비스링크}\n#{운영연락처}\n#{수신거부방법}",
  },
  pass_expired: {
    title: "(광고) Expired",
    text: "(광고) TALKLY AI\n#{서비스링크}\n#{운영연락처}\n#{수신거부방법}",
  },
};
globalThis.deliveryHarness = {
  OUTREACH_DRAFTS: drafts,
  validUnsubscribeToken: (t) =>
    typeof t === "string" && /^[A-Za-z0-9_-]{43}$/.test(t),
};
const { composeOutreachMessage } = await compile(
  "lib/talkly-ai/outreach-message.ts",
  "const {OUTREACH_DRAFTS,validUnsubscribeToken}=globalThis.deliveryHarness;",
);
globalThis.deliveryHarness.composeOutreachMessage = composeOutreachMessage;
const link =
  "https://test.example/talkly-ai/unsubscribe#token=" + "x".repeat(43);
const message = composeOutreachMessage(
  "trial_followup",
  "https://test.example/talkly-ai",
  link,
  "Support <contact>",
);
assert.ok(message.text.includes(link));
assert.equal(message.html.includes("<contact>"), false);
assert.ok(message.html.includes("&lt;contact&gt;"));
for (const [service, unsubscribe, contact] of [
  ["http://test.example/talkly-ai", link, "help"],
  [
    "https://test.example/talkly-ai",
    link.replace("test.example", "other.example"),
    "help",
  ],
  ["https://test.example/talkly-ai", link, "help\nBcc:evil"],
])
  assert.throws(() =>
    composeOutreachMessage("trial_followup", service, unsubscribe, contact),
  );
const { processClaimedOutreach, outreachWindow } = await compile(
  "lib/talkly-ai/outreach-workflow.ts",
  "const {composeOutreachMessage}=globalThis.deliveryHarness;",
);
assert.equal(outreachWindow(new Date("2026-10-26T00:00:00Z")), true);
assert.equal(outreachWindow(new Date("2026-10-26T09:00:00Z")), false);
const row = {
  id: "job",
  user_id: "owner",
  channel: "email",
  kind: "trial_followup",
  activity_anchor: "2026-10-20T00:00:00Z",
  consent_revision: 2,
  claim_token: "server-claim",
};
let events = [],
  contact = { ok: true, channel: "email", address: "learner@example.com" },
  eligible = true,
  late = false,
  sendError = false,
  sendState = "accepted",
  recorded = true;
const deps = {
  now: () => new Date(late ? "2026-10-26T09:00:00Z" : "2026-10-26T00:00:00Z"),
  contact: async () => {
    events.push("contact");
    return contact;
  },
  link: async () => {
    events.push("link");
    return link;
  },
  eligible: async () => {
    events.push("eligible");
    return eligible;
  },
  send: async () => {
    events.push("send");
    if (sendError) throw new Error("provider result lost");
    return { state: sendState };
  },
  finish: async (r, result) => {
    assert.equal(r.claim_token, "server-claim");
    events.push("finish:" + result.state);
    return recorded;
  },
  release: async () => {
    events.push("release");
    return "pending";
  },
};
let result = await processClaimedOutreach(
  row,
  { origin: "https://test.example", operatorContact: "help" },
  deps,
);
assert.equal(result.state, "accepted");
assert.deepEqual(events, [
  "contact",
  "link",
  "eligible",
  "send",
  "finish:accepted",
]);
events = [];
eligible = false;
result = await processClaimedOutreach(
  row,
  { origin: "https://test.example", operatorContact: "help" },
  deps,
);
assert.equal(result.state, "skipped");
assert.equal(events.includes("send"), false);
eligible = true;
events = [];
sendError = true;
result = await processClaimedOutreach(
  row,
  { origin: "https://test.example", operatorContact: "help" },
  deps,
);
assert.equal(result.state, "unknown");
assert.equal(events.filter((e) => e === "send").length, 1);
assert.equal(events.includes("release"), false);
sendError = false;
events = [];
contact = { ok: false, reason: "lookup_unavailable" };
result = await processClaimedOutreach(
  row,
  { origin: "https://test.example", operatorContact: "help" },
  deps,
);
assert.equal(result.state, "deferred");
assert.equal(events.includes("send"), false);
assert.equal(events.at(-1), "release");
events = [];
contact = { ok: false, reason: "phone_unverified" };
result = await processClaimedOutreach(
  row,
  { origin: "https://test.example", operatorContact: "help" },
  deps,
);
assert.equal(result.state, "skipped");
assert.equal(events.includes("send"), false);
events = [];
late = true;
result = await processClaimedOutreach(
  row,
  { origin: "https://test.example", operatorContact: "help" },
  deps,
);
assert.equal(result.state, "deferred");
assert.deepEqual(events, ["release"]);
late = false;
contact = { ok: true, channel: "email", address: "learner@example.com" };
events = [];
recorded = false;
result = await processClaimedOutreach(
  row,
  { origin: "https://test.example", operatorContact: "help" },
  deps,
);
assert.equal(result.state, "accepted");
assert.equal(result.recorded, false);
assert.equal(events.filter((e) => e === "send").length, 1);
assert.equal(events.includes("release"), false);
console.log(
  "PASS: safe same-origin unsubscribe message, HTML escaping, Seoul send window, recipient/consent checks, pre-send-only deferral, unknown never retried/fallback and accepted-but-unrecorded isolation",
);
