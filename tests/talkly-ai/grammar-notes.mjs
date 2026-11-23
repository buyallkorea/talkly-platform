import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const src = await readFile(new URL("../../lib/talkly-ai/reports.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("reports.ts", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const note = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "validateGrammarNotes");
assert.ok(note, "grammar notes should be validated independently");
const js = ts.transpileModule(note.getText(ast), { compilerOptions: {
  module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
} }).outputText;
const { validateGrammarNotes } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

const userTurns = [{ role:"assistant", text:"How was your day?" },
  { role:"user", text:"I go to work yesterday." }, { role:"user", text:"I likes reading." }];
const tip = {
  before:"I go to work yesterday.", after:"I went to work yesterday.",
  rule:"yesterday에는 과거형을 사용해요.", example:"I went shopping last weekend.",
};
assert.deepEqual(validateGrammarNotes([tip], userTurns), [tip]);
assert.deepEqual(validateGrammarNotes([{...tip,before:"A fabricated sentence"}],userTurns),[],
  "cannot invent learner statements");
assert.deepEqual(validateGrammarNotes([{...tip,before:"How was your day?"}],userTurns),[],
  "tutor text must not be re-labelled as learner speech");
assert.equal(validateGrammarNotes(Array.from({length:9},()=>tip), userTurns).length,3,
  "grammar tips should be short and not overwhelm free conversation");
assert.deepEqual(validateGrammarNotes([{...tip,rule:"x".repeat(221)}], userTurns), [],
  "excessive annotations should not be retained");
assert.deepEqual(validateGrammarNotes(undefined, userTurns),[]);
console.log("PASS: contextual grammar annotations never invent learner speech or interrupt conversation");
