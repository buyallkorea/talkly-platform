// Explicit opt-in real Auth/PostgREST check. Never run against production.
// Use pre-created synthetic QA users; this script sends no signup/SMS/email.
import assert from "node:assert/strict";
const ref = process.env.TALKLY_AI_QA_PROJECT_REF;
assert.match(ref ?? "", /^[a-z0-9]{20}$/);
assert.notEqual(ref, "nvotgdovtxfzvmrrhxge", "Production is forbidden");
assert.equal(process.env.TALKLY_AI_QA_CONFIRMED, "isolated-synthetic-only");
const key = process.env.TALKLY_AI_QA_PUBLISHABLE_KEY;
const email = process.env.TALKLY_AI_QA_EMAIL;
const password = process.env.TALKLY_AI_QA_PASSWORD;
const other = process.env.TALKLY_AI_QA_OTHER_USER_ID;
assert.ok(key && password);
assert.match(email ?? "", /^qa-[0-9a-f-]+@example\.invalid$/);
assert.match(other ?? "", /^[0-9a-f-]{36}$/);
const base = `https://${ref}.supabase.co`;
const request = (path, options = {}, token) => fetch(base + path, {
  ...options,
  redirect: "error",
  signal: AbortSignal.timeout(15000),
  headers: { apikey: key, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
});
let token;
try {
  const login = await request("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
  assert.equal(login.status, 200, `Synthetic Auth sign-in failed: HTTP ${login.status}`);
  const session = await login.json();
  token = session.access_token;
  assert.ok(token && session.user?.id);
  assert.notEqual(session.user.id, other);
  const user = await request("/auth/v1/user", {}, token);
  assert.equal(user.status, 200);
  assert.equal((await user.json()).id, session.user.id);
  const own = await request("/rest/v1/ai_members?select=user_id", {}, token);
  assert.equal(own.status, 200);
  assert.deepEqual(await own.json(), [{ user_id: session.user.id }]);
  const foreign = await request(`/rest/v1/ai_members?select=user_id&user_id=eq.${other}`, {}, token);
  assert.equal(foreign.status, 200);
  assert.deepEqual(await foreign.json(), []);
  const anonymous = await request("/rest/v1/ai_members?select=user_id");
  assert.ok([401, 403].includes(anonymous.status), "Anonymous member access must fail");
  const mutation = await request(`/rest/v1/ai_members?user_id=eq.${session.user.id}`, { method: "PATCH", body: JSON.stringify({ valid_until: "2099-01-01T00:00:00Z" }) }, token);
  assert.ok([401, 403].includes(mutation.status), "Browser cannot grant itself a pass");
  const payments = await request("/rest/v1/ai_payments?select=order_id", {}, token);
  assert.ok([401, 403].includes(payments.status), "Browser cannot read payment internals directly");
  const reserve = await request("/rest/v1/rpc/ai_reserve", { method: "POST", body: JSON.stringify({ p_user: session.user.id, p_tutor: "calm-female" }) }, token);
  assert.ok([401, 403, 404].includes(reserve.status), "Browser cannot invoke service-only reservation RPC");
} finally {
  if (token) {
    const logout = await request("/auth/v1/logout?scope=local", { method: "POST" }, token);
    assert.equal(logout.status, 204, "Synthetic session cleanup failed");
  }
}

console.log("PASS: isolated real Supabase Auth login/getUser, own-row PostgREST, foreign-row/anonymous denial, pass-write/payment/RPC denial and logout");
