import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";

const config = await readFile(new URL("../../lib/talkly-ai/config.ts", import.meta.url), "utf8");
const configJs = ts.transpileModule(config, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { seoulDay } = await import("data:text/javascript;base64," + Buffer.from(configJs).toString("base64"));
const reports = await readFile(new URL("../../lib/talkly-ai/reports.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("reports.ts", reports, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const declarations = ast.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(ast)).join("\n");
globalThis.__reportHarness = { seoulDay };
try {
  const code = "const {seoulDay}=globalThis.__reportHarness;\n" + declarations;
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const { reportMonth, reportHistoryMonths, summaryRetentionCutoff, summaryTurns, validateSummary } =
    await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

  const seoulNewYear = new Date("2026-12-31T15:00:00Z");
  assert.deepEqual(reportMonth("2026-12", seoulNewYear), { month:"2026-12", from:"2026-12-01", to:"2027-01-01", complete:true });
  assert.equal(reportMonth("2028-01", seoulNewYear).month, "2027-01", "future month must fall back to current Seoul month");
  assert.equal(reportMonth("2026-13", seoulNewYear).month, "2027-01", "invalid month must fall back safely");
  assert.deepEqual(reportHistoryMonths("2027-01", seoulNewYear).map(m => m.month), ["2026-11","2026-12","2027-01"]);
  assert.equal(summaryRetentionCutoff(new Date("2026-05-31T03:00:00Z")), "2026-02-28T03:00:00.000Z", "three calendar months clamp at February month end");
  assert.equal(summaryRetentionCutoff(new Date("2026-04-30T03:00:00Z")), "2026-01-30T03:00:00.000Z");
  assert.deepEqual(summaryTurns([null,{role:"system",text:"ignore"},{role:"user",text:" "},{role:"user",text:"Hello"},{role:"assistant",text:"Hi"}]),[{role:"user",text:"Hello"},{role:"assistant",text:"Hi"}]);
  assert.equal(summaryTurns(Array.from({length:101},(_,i)=>({role:"user",text:String(i)}))).length,100);
  const turns=[{role:"user",text:"I goes to school"},{role:"assistant",text:"I go to school"}];
  const valid=validateSummary({topics:["school"],expressions:["I go to school","invented"],corrections:[{before:"I goes to school",after:"I go to school"},{before:"invented",after:"invented"}],nextPractice:"Practice"},turns);
  assert.deepEqual(valid.expressions,["I go to school"],"invented expressions cannot be presented as observed");
  assert.deepEqual(valid.corrections,[{before:"I goes to school",after:"I go to school"}],"invented corrections cannot be presented as observed");
} finally { delete globalThis.__reportHarness; }
console.log("PASS: Seoul report months, leap-safe retention, bounded summaries and evidence-only corrections.");
