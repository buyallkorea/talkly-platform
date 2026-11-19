const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const compiled = ts.transpileModule(
  fs.readFileSync("lib/classroom-audio-diagnostics.ts", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }
).outputText;

function checkWith({ secure = true, policy, devices, getUserMedia } = {}) {
  const exports = {};
  const browser = {
    isSecureContext: secure,
  };
  const navigator = {
    mediaDevices: devices === false ? undefined : {
      getUserMedia: getUserMedia || (async () => ({ getTracks: () => [] })),
    },
  };
  const document = policy === undefined ? {} : {
    permissionsPolicy: { allowsFeature: () => policy },
  };
  vm.runInNewContext(compiled, { exports, navigator, window: browser, document });
  return exports;
}

test("user-initiated mic test requests only audio and immediately stops every track", async () => {
  let constraints;
  const stopped = [0, 0];
  const api = checkWith({
    getUserMedia: async (options) => {
      constraints = options;
      return {
        getTracks: () => stopped.map((_, i) => ({ stop: () => { stopped[i] += 1; } })),
      };
    },
  });
  const outcome = await api.checkClassroomMicrophone();
  assert.equal(outcome.ok, true);
  assert.equal(constraints.audio, true);
  assert.equal(constraints.video, false);
  assert.deepEqual(stopped, [1, 1]);
});

test("denied microphone permission, busy device and absent device have distinct explanations", async () => {
  for (const [name, problem] of [
    ["NotAllowedError", "permission"],
    ["NotReadableError", "device"],
    ["NotFoundError", "device"],
  ]) {
    const api = checkWith({
      getUserMedia: async () => { const error = new Error("Device error"); error.name = name; throw error; },
    });
    const result = await api.checkClassroomMicrophone();
    assert.equal(result.ok, false);
    assert.equal(result.problem, problem);
    assert(result.message.length > 30);
  }
});

test("insecure origin, missing mediaDevices and iframe policy denial fail without recording", async () => {
  for (const option of [{ secure: false }, { devices: false }, { policy: false }]) {
    let attempts = 0;
    const api = checkWith({ ...option, getUserMedia: async () => { attempts++; throw Error("should not be called"); } });
    const result = await api.checkClassroomMicrophone();
    assert.equal(result.ok, false);
    assert.equal(attempts, 0);
  }
});

test("Zoom recovery is an explicit gesture and duplicate names give a warning, not forced disconnect", () => {
  const embed = fs.readFileSync("app/classroom/[sessionId]/ClassroomZoomEmbed.tsx", "utf8");
  const ui = fs.readFileSync("lib/zoom-ui-controls.ts", "utf8");
  const frame = fs.readFileSync("app/classroom/[sessionId]/ClassroomZoomFrame.tsx", "utf8");
  assert.match(embed, /onClick=\{\(\) => void checkMicrophone\(\)\}/);
  assert.match(embed, /sameNameParticipants > 0/);
  assert.match(embed, /Check microphone/);
  assert.match(ui, /join audio\(\?: by computer\)/i);
  assert.match(frame, /allow="camera; microphone;/);
  assert.doesNotMatch(embed, /getUserMedia\(\)/); // No auto capture on mount
});
