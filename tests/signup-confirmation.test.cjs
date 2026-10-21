const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('app/api/auth/signup/route.ts', 'utf8');
const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;

async function signup({confirmed = false, mailError = false, mailThrows = false, createError = false} = {}) {
  const calls = {resend: 0, reserved: 0};
  const admin = {
    from() {
      const result = {data: {id: 'verification-id'}, error: null};
      const chain = new Proxy({}, {get(_, key) {
        if (key === 'then') return resolve => resolve(result);
        return () => {if (key === 'update') calls.reserved++; return chain;};
      }});
      return chain;
    },
    auth: {
      admin: {createUser: async () => createError
        ? {data: {}, error: {message: 'already registered'}}
        : {data: {user: {id: 'new-user', email: 'learner@example.invalid', email_confirmed_at: confirmed ? '2026-10-21' : null}}, error: null}},
      resend: async (body) => {
        calls.resend++;
        assert.equal(body.type, 'signup');
        assert.equal(body.email, 'learner@example.invalid');
        if (mailThrows) throw Error('simulated transport error');
        return {error: mailError ? {message: 'simulated SMTP error'} : null};
      },
    },
  };
  const exports = {};
  vm.runInNewContext(code, {exports, Date, console: {error() {}}, require(name) {
    if (name === 'next/server') return {NextResponse: {json: (body, init) => Response.json(body, init)}};
    if (name === '@/lib/supabase-admin') return {createAdminClient: () => admin};
    if (name === '@/lib/solapi') return {hashPhoneVerificationValue: () => 'hash', isValidKoreanMobilePhone: () => true, normalizeKoreanPhone: x => x};
    throw Error(name);
  }});
  const response = await exports.POST(new Request('https://www.talkly.co.kr/api/auth/signup', {method: 'POST', body: JSON.stringify({name: 'Learner', email: 'learner@example.invalid', password: 'test-only-password', role: 'student', phone: '01000000000', verificationToken: 'test-only-token'})}));
  return {status: response.status, body: await response.json(), calls};
}

test('new unconfirmed account receives confirmation email', async () => {
  const r = await signup(); assert.equal(r.status, 200); assert.equal(r.body.requiresEmailConfirmation, true); assert.equal(r.body.confirmationEmailSent, true); assert.equal(r.calls.resend, 1);
});
for (const failure of [{mailError: true}, {mailThrows: true}]) {
  test(`email failure preserves created account and consumed phone token ${JSON.stringify(failure)}`, async () => {
    const r = await signup(failure); assert.equal(r.status, 200); assert.equal(r.body.ok, true); assert.equal(r.body.confirmationEmailSent, false); assert.equal(r.calls.reserved, 1);
  });
}
test('confirmed accounts do not receive an unnecessary email', async () => {
  const r = await signup({confirmed: true}); assert.equal(r.body.requiresEmailConfirmation, false); assert.equal(r.calls.resend, 0);
});
test('failed account creation sends no email and releases verification', async () => {
  const r = await signup({createError: true}); assert.equal(r.status, 409); assert.equal(r.calls.resend, 0); assert.equal(r.calls.reserved, 2);
});
