import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const file = (relative) => readFile(new URL("../../" + relative, import.meta.url), "utf8");

const scenes = await file("lib/talkly-ai/scenes.ts");
const js = ts.transpileModule(scenes, { compilerOptions: {
  module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
} }).outputText;
const { inferAiScene, AI_SCENES, isAiSceneId } =
  await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
assert.equal(AI_SCENES.length,6);
assert.ok(isAiSceneId("airport"));
assert.equal(isAiSceneId("beach"),false);
assert.equal(inferAiScene([{role:"assistant",text:"Let's go to the airport!"}]),null,
  "assistant-suggested scene never changes the learner's room");
assert.equal(inferAiScene([{role:"user",text:"I go to a coffee shop often."}]),null,
  "ordinary topic mention must not trigger a disruptive transition");
assert.equal(inferAiScene([{role:"user",text:"Let's practice at a cafe."}]),"cafe");
assert.equal(inferAiScene([{role:"user",text:"공항에서 입국심사 역할극 하자"}]),"airport");
assert.equal(inferAiScene([{role:"user",text:"Let's pretend we are at a restaurant."}]),"restaurant");
assert.equal(inferAiScene([{role:"user",text:"Let's practice at a cafe."},
  {role:"user",text:"Let's pretend we are at an airport."}]),"airport",
  "last explicit learner instruction wins");

const portraits = await file("app/talkly-ai/TutorPortrait.tsx");
const tutorConfig = await file("lib/talkly-ai/config.ts");
const stage = await file("app/talkly-ai/AiTutorStage.tsx");
const studio = await file("app/talkly-ai/AiStudio.tsx");
const home = await file("app/talkly-ai/page.tsx");
const css = await file("app/talkly-ai/talkly-ai.css");
const faceStart = portraits.indexOf("function TutorFaceIdentity(");
const faceEnd = portraits.indexOf("export default function TutorPortrait(",faceStart);
assert.ok(faceStart>=0 && faceEnd>faceStart);
const face = portraits.slice(faceStart,faceEnd);
assert.doesNotMatch(face,/\bscene\b/, "fixed face must not be re-generated from scenario");
assert.match(face, /fixedTutorIdentity\(tutorId\)/);
assert.match(portraits,/function OutfitLayer\(\{ scene \}/);
const ids=[...tutorConfig.matchAll(/\{ id: "(lively|intellectual|calm)-(male|female)"/g)]
  .map(m=>m[1]+"-"+m[2]);
assert.equal(ids.length,6);
for(const id of ids)assert.ok(portraits.includes('"'+id+'": {'),id+" must have a stable identity");
assert.match(home,/tutorId="lively-female"/);
assert.match(studio,/tutorId=\{t.id\}/);
assert.match(stage,/tutorId=\{tutorId\} scene=\{scene\}/);
assert.match(stage,/40_000/,"avoid jumpy scene changes");

assert.match(stage, /createMediaStreamSource/);
assert.match(stage,/source\.connect\(analyser\)/);
assert.doesNotMatch(stage,/analyser\.connect\(audioContext\.destination\)/,
  "animation must not route or delay actual voice playback");
assert.match(stage,/time - lastPaint < 52/);
assert.match(stage,/visibilitychange/);
assert.match(stage,/prefers-reduced-motion/);
assert.match(stage,/움직임 끄기/);
assert.match(css,/tai-avatar-lipsync/);
assert.match(css,/taiAvatarBlink/);
assert.match(home,/617-28-89258/);
assert.match(home,/제2010-부산남구-221호/);
assert.doesNotMatch(stage, /fetch\(|setInterval\(/, "scenes must not add service calls");
console.log("PASS: six immutable tutor faces, intentional scene changes and low-cost audio motion");
