const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require(process.cwd() + '/node_modules/typescript');
const source = fs.readFileSync('app/classroom/[sessionId]/page.tsx', 'utf8');
const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}}).outputText;
async function check(status, endedAt, mode, expected) {
  const session = {id: 1, enrollment_id: 2, is_test: true, status, ended_at: endedAt, started_at: null};
  const db = {auth: {getUser: async () => ({data: {user: {id: 'admin'}}})}, from(table) {
    const value = table === 'profiles' ? {role: 'admin', name: 'Admin'} : table === 'class_sessions' ? session : table === 'enrollments' ? {id: 2, is_test: true, course_id: 1} : table === 'enrollment_textbooks' ? [] : {name: 'English'};
    const result = {data: value, error: null};
    const chain = new Proxy({}, {get(_, key) { if (key === 'then') return (resolve) => resolve(result); return () => chain; }});
    return chain;
  }};
  function Chooser() {}
  const exports = {};
  const context = {exports, process: {env: {TALKLY_ENABLE_TEST_CLASSROOM: 'true'}}, require(name) {
    if (name === 'react/jsx-runtime') return require(process.cwd() + '/node_modules/react/jsx-runtime');
    if (name === '@/lib/server-user') return {getCurrentUser: () => db.auth.getUser()};
    if (name === '@/lib/supabase-server') return {createClient: async () => db};
    if (name === '@/lib/test-classroom-mode') return {verifyTestStudentMode: async () => false};
    if (name === './TestClassroomModeChooser') return {default: Chooser};
    if (name === 'next/navigation') return {redirect() {throw Error('redirect');}, notFound() {throw Error('notFound');}};
    return {default() {}};
  }};
  vm.runInNewContext(code, context);
  const result = await exports.default({params: Promise.resolve({sessionId: '1'}), searchParams: Promise.resolve({testMode: mode})});
  assert.equal(result.type === Chooser ? 'chooser' : result.type, expected, `${status}/${mode}`);
}
(async () => {
  for (const mode of [undefined, 'student', 'observer']) {
    for (const status of ['completed','cancelled','held','not_held','no_show']) await check(status, null, mode, 'main');
    await check('in_progress', '2026-10-21T00:00:00Z', mode, 'main');
  }
  for (const status of ['scheduled','in_progress']) for (const mode of [undefined,'student']) await check(status,null,mode,'chooser');
  console.log('PASS: 22 classroom routing cases (terminal states and active test-mode gating)');
})().catch(e => {console.error(e);process.exit(1);});
