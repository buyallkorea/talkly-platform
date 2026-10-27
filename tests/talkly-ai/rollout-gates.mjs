import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (path) => readFile(new URL("../../" + path, import.meta.url), "utf8");
const [server, checkpoint, recovery, account, unsubscribe] = await Promise.all([
  read("lib/talkly-ai/server.ts"),
  read("app/api/talkly-ai/session/checkpoint/route.ts"),
  read("app/api/talkly-ai/internal/recover-calls/route.ts"),
  read("app/api/talkly-ai/account/route.ts"),
  read("app/api/talkly-ai/unsubscribe/route.ts")
]);
assert.match(server, /process\.env\.VERCEL_ENV === "preview"/);
assert.match(server, /process\.env\.TALKLY_AI_TEST_MODE === "true"/);
assert.match(server, /process\.env\.TALKLY_AI_PAYMENTS_ENABLED !== "true"/);
assert.match(checkpoint, /process\.env\.TALKLY_AI_ORDERED_CHECKPOINTS_ENABLED === "true"/);
assert.match(recovery, /process\.env\.TALKLY_AI_REGISTERED_CALL_RECOVERY_ENABLED !== "true"/);
assert.match(recovery, /request\.headers\.get\("authorization"\) !== `Bearer \$\{secret\}`/);
assert.match(account, /process\.env\.TALKLY_AI_PAYMENTS_ENABLED === "true"/);
assert.match(unsubscribe, /requireIsolatedPreviewWrite\(request\)/);
assert.ok(unsubscribe.indexOf("requireIsolatedPreviewWrite(request)") < unsubscribe.indexOf("createAdminClient()"),"preview isolation must precede unauthenticated unsubscribe database access");
console.log("PASS: sensitive AI features remain explicitly gated and recovery requires bearer authorization.");
