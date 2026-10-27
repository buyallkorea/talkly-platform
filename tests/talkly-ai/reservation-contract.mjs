import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const session = await readFile(new URL("../../app/api/talkly-ai/session/route.ts", import.meta.url), "utf8");
const closing = await readFile(new URL("../../lib/talkly-ai/session.ts", import.meta.url), "utf8");
const stop = await readFile(new URL("../../app/api/talkly-ai/session/stop/route.ts", import.meta.url), "utf8");

const order = (...tokens) => {
 let previous = -1;
 for (const token of tokens) {
  const at = session.indexOf(token);
  assert.ok(at > previous, "reservation flow must preserve stage ordering: " + token);
  previous = at;
 }
};
order('.rpc("ai_claim_connection_attempt"', '.rpc("ai_reserve"', 'sessionId = lease.id;', 'fetch("https://api.openai.com/v1/realtime/calls"');
assert.ok(session.indexOf('typeof data.writerId !== "string"') < session.indexOf('.rpc("ai_claim_connection_attempt"'), "invalid checkpoint writer must be rejected before connection attempts");
assert.ok(session.indexOf('typeof data.writerId !== "string"') < session.indexOf('.rpc("ai_reserve"'), "invalid checkpoint writer must not reserve minutes");
assert.match(session, /\.neq\("state", "closed"\)/);
assert.match(session, /for \(const row of stale \?\? \[\]\) await closeSession\(user\.id, row\.id\)/);
assert.match(session, /if \(!process\.env\.OPENAI_API_KEY\)/);
assert.match(session, /p_user: user\.id/);
assert.match(closing, /\.rpc\("ai_begin_close"/);
assert.match(closing, /s\.state !== "closed" && s\.call_id/);
assert.match(closing, /await hangup\(s\.call_id\)/);
assert.match(closing, /\.rpc\("ai_finish"/);
assert.ok(closing.indexOf("await hangup(s.call_id)") < closing.indexOf('.rpc("ai_finish"'),
 "registered call must be hung up before settlement");
assert.match(stop, /await closeSession\(user\.id, data\.sessionId\)/);
assert.doesNotMatch(stop, /ai_finish|ai_members|ai_daily_usage/,
 "stop endpoint must not bypass the atomic settlement helper");
assert.ok(session.includes("after(async () => {"));
assert.ok(session.includes("attempt < 3"));
assert.ok(session.includes("await closeSession(capturedUser, capturedSession)"));
console.log("PASS: reservation before provider connection, expired lease closure, provider hangup before settlement.");
