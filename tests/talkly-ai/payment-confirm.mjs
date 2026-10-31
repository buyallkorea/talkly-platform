import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
class AiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
let order,
  lookupStatus = "DONE",
  providerOverride = {},
  rawLookup,
  rawConfirm,
  activationError = false,
  claimAllowed = true,
  terminalAllowed = true,
  events = [];
const orderId = "TALKLYAI-test-order",
  paymentKey = "test-payment-key";
function reset() {
  order = {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "owner",
    order_id: orderId,
    payment_key: paymentKey,
    amount: 13900,
    status: "confirming",
    activated_until: null,
  };
  lookupStatus = "DONE";
  providerOverride = {};
  rawLookup = undefined;
  rawConfirm = undefined;
  activationError = false;
  claimAllowed = true;
  terminalAllowed = true;
  events = [];
}
const db = {
  from(table) {
    assert.equal(table, "ai_payments");
    let updateValue;
    const q = {
      select() {
        return q;
      },
      eq(k, v) {
        if (k === "user_id") assert.equal(v, "owner");
        else if (k === "order_id") assert.equal(v, orderId);
        else if (k === "id") assert.equal(v, order.id);
        return q;
      },
      single: async () => ({ data: order, error: null }),
      update(value) {
        updateValue = value;
        events.push([value.status === "failed" ? "terminal" : "claim", value]);
        return q;
      },
      in(k, v) {
        assert.deepEqual([k, v], ["status", ["ready", "confirming", "failed"]]);
        return q;
      },
      is(k, v) {
        assert.equal(v, null);
        assert.ok(
          ["payment_key", "approved_at", "activated_until"].includes(k),
        );
        return q;
      },
      maybeSingle: async () => ({
        data: (
          updateValue?.status === "failed" ? terminalAllowed : claimAllowed
        )
          ? { id: order.id }
          : null,
        error: null,
      }),
    };
    return q;
  },
  async rpc(name, args) {
    assert.equal(name, "ai_activate");
    assert.equal(args.p_user, "owner");
    assert.equal(args.p_order, orderId);
    assert.equal(args.p_key, paymentKey);
    events.push(["activate"]);
    if (activationError)
      return { data: null, error: { message: "db unavailable" } };
    order.status = "paid";
    order.activated_until = "2026-11-24T00:00:00Z";
    return { data: order.activated_until, error: null };
  },
};
globalThis.paymentHarness = {
  PLAN: { amount: 13900 },
  AiError,
  context: async () => ({ user: { id: "owner" }, db }),
  requireMember: async () => ({}),
  body: (r) => r.json(),
  failure: (e) =>
    Response.json({ error: e.message }, { status: e.status ?? 500 }),
};
const source = await readFile(
  new URL("../../app/api/talkly-ai/payment/confirm/route.ts", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile(
  "confirm.ts",
  source,
  ts.ScriptTarget.Latest,
  true,
);
const code =
  "const {PLAN,AiError,context,requireMember,body,failure}=globalThis.paymentHarness;\n" +
  ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getText(ast))
    .join("\n");
const js = ts.transpileModule(code, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const { POST } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const request = (override = {}) =>
  POST(
    new Request("https://test.example/api/talkly-ai/payment/confirm", {
      method: "POST",
      body: JSON.stringify({ orderId, paymentKey, amount: 13900, ...override }),
    }),
  );
const originalFetch = globalThis.fetch,
  originalEnabled = process.env.TALKLY_AI_PAYMENTS_ENABLED,
  originalSecret = process.env.TOSS_SECRET_KEY;
process.env.TOSS_SECRET_KEY = "test-placeholder";
globalThis.fetch = async (url, options) => {
  assert.equal(options.cache, "no-store");
  assert.equal(options.headers["Idempotency-Key"], order.id);
  const confirm = url.endsWith("/confirm");
  events.push([confirm ? "confirm" : "lookup"]);
  assert.ok(url.startsWith("https://api.tosspayments.com/v1/payments/"));
  if (confirm) {
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), {
      paymentKey,
      orderId,
      amount: 13900,
    });
  }
  if (!confirm && typeof lookupStatus === "number")
    return new Response("{}", { status: lookupStatus });
  const raw = confirm ? rawConfirm : rawLookup;
  if (raw !== undefined) return Response.json(raw);
  return new Response(
    JSON.stringify({
      status: confirm ? "DONE" : lookupStatus,
      orderId,
      paymentKey,
      totalAmount: 13900,
      currency: "KRW",
      approvedAt: "2026-10-25T00:00:00Z",
      ...providerOverride,
    }),
    { status: 200 },
  );
};
try {
  reset();
  process.env.TALKLY_AI_PAYMENTS_ENABLED = "false";
  assert.equal((await request()).status, 503);
  assert.equal(events.length, 0);
  process.env.TALKLY_AI_PAYMENTS_ENABLED = "true";
  assert.equal((await request({ paymentKey: "" })).status, 400);
  assert.equal((await request({ orderId: "bad id" })).status, 400);
  assert.equal((await request({ amount: 1 })).status, 400);
  reset();
  let response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(events, [["lookup"], ["activate"]]);
  events = [];
  assert.equal((await request()).status, 200);
  assert.equal(events.length, 0);
  assert.equal((await request({ paymentKey: "different" })).status, 409);
  assert.equal(events.length, 0);
  reset();
  lookupStatus = "READY";
  assert.equal((await request()).status, 200);
  assert.deepEqual(events, [["lookup"], ["confirm"], ["activate"]]);
  reset();
  lookupStatus = 404;
  assert.equal((await request()).status, 200);
  assert.equal(events.filter((e) => e[0] === "confirm").length, 1);
  for (const status of [401, 429, 503]) {
    reset();
    lookupStatus = status;
    assert.equal((await request()).status, 502);
    assert.deepEqual(events, [["lookup"]]);
  }
  for (const override of [
    { status: "CANCELED" },
    { currency: "USD" },
    { totalAmount: 1 },
    { orderId: "another-order" },
    { paymentKey: "another-key" },
    { approvedAt: "invalid" },
  ]) {
    reset();
    providerOverride = override;
    assert.equal((await request()).status, 409);
    assert.equal(
      events.some((e) => e[0] === "activate"),
      false,
    );
  }
  for (const terminal of ["ABORTED", "EXPIRED"]) {
    reset();
    lookupStatus = terminal;
    providerOverride = { approvedAt: null };
    const response = await request();
    assert.equal(response.status, 409);
    assert.equal((await response.json()).terminal, true);
    assert.deepEqual(events, [["lookup"], ["terminal", { status: "failed" }]]);
    for (const override of [
      { totalAmount: 1 },
      { currency: "USD" },
      { orderId: "other-order" },
      { paymentKey: "other-key" },
      { approvedAt: "2026-10-25T00:00:00Z" },
    ]) {
      reset();
      lookupStatus = terminal;
      providerOverride = { approvedAt: null, ...override };
      assert.equal((await request()).status, 409);
      assert.deepEqual(events, [["lookup"]]);
    }
    reset();
    lookupStatus = terminal;
    providerOverride = { approvedAt: null };
    terminalAllowed = false;
    assert.equal((await request()).status, 409);
  }
  // A provider lookup must match the local order before a money-changing call.
  for (const status of ["READY", "IN_PROGRESS"]) {
    for (const mismatch of [
      { orderId: "another-order" }, { paymentKey: "another-key" },
      { totalAmount: 1 }, { currency: "USD" },
    ]) {
      reset(); lookupStatus = status; providerOverride = mismatch;
      assert.equal((await request()).status, 409);
      assert.deepEqual(events, [["lookup"]], "mismatched pending payment must never be approved");
    }
  }
  for (const malformed of [null, [], "invalid", {}, 42]) {
    reset(); rawLookup = malformed;
    assert.equal((await request()).status, 409);
    assert.deepEqual(events, [["lookup"]]);
    reset(); lookupStatus = 404; rawConfirm = malformed;
    assert.equal((await request()).status, 409);
    assert.deepEqual(events, [["lookup"], ["confirm"]], "malformed approval must not activate a pass");
  }
  reset();
  order.payment_key = null;
  claimAllowed = false;
  assert.equal((await request()).status, 409);
  assert.equal(
    events.some((e) => e[0] === "lookup"),
    false,
  );
  reset();
  activationError = true;
  assert.equal((await request()).status, 503);
  assert.equal(
    events.some((e) => e[0] === "confirm"),
    false,
  );
  activationError = false;
  events = [];
  assert.equal((await request()).status, 200);
  assert.deepEqual(events, [["lookup"], ["activate"]]);
  reset();
  process.env.TALKLY_AI_PAYMENTS_ENABLED = "false";
  let recovered = await request({ lookupOnly: true, paymentKey: undefined });
  assert.equal(recovered.status, 200);
  assert.deepEqual(events, [["lookup"], ["activate"]]);
  for (const lookup of ["READY", 404]) {
    reset();
    lookupStatus = lookup;
    assert.equal(
      (await request({ lookupOnly: true, paymentKey: undefined })).status,
      409,
    );
    assert.deepEqual(events, [["lookup"]]);
  }
  reset();
  order.payment_key = null;
  assert.equal(
    (await request({ lookupOnly: true, paymentKey: undefined })).status,
    409,
  );
  assert.equal(events.length, 0);
  reset();
  assert.equal((await request({ lookupOnly: "true" })).status, 400);
  process.env.TALKLY_AI_PAYMENTS_ENABLED = "true";
} finally {
  globalThis.fetch = originalFetch;
  if (originalEnabled === undefined)
    delete process.env.TALKLY_AI_PAYMENTS_ENABLED;
  else process.env.TALKLY_AI_PAYMENTS_ENABLED = originalEnabled;
  if (originalSecret === undefined) delete process.env.TOSS_SECRET_KEY;
  else process.env.TOSS_SECRET_KEY = originalSecret;
}
console.log(
  "PASS: checkout OFF, owner-bound orders, key/amount/approval validation, paid replay, retrieve-before-confirm, lookup failure isolation, stable idempotency and activation recovery without new approval",
);
