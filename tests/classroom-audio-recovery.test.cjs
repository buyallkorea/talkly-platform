const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const zoom = readFileSync("app/classroom/[sessionId]/ClassroomZoomEmbed.tsx", "utf8");
const controls = readFileSync("lib/zoom-ui-controls.ts", "utf8");
const css = readFileSync("app/classroom/[sessionId]/zoom-layout.css", "utf8");
const frame = readFileSync("app/classroom/[sessionId]/ClassroomZoomFrame.tsx", "utf8");
const responsive = readFileSync("app/classroom/[sessionId]/ClassroomResponsiveZoom.tsx", "utf8");

test("meeting joined is separate from computer audio connected", () => {
  assert.match(zoom, /await client\.join\(/);
  assert.match(zoom, /setScreen\(\s*"joined"\s*\)/);
  assert.match(zoom, /const audioConnected = audioState === "ready" \|\| audioState === "muted"/);
  assert.match(zoom, /const audioAttention = screen === "joined" && !audioConnected/);
  assert.match(zoom, /talkly-audio-connection-banner/);
  assert.match(zoom, /role=\{audioAttention \? "alert" : "status"\}/);
});

test("audio button cannot accidentally toggle mute while audio is disconnected", () => {
  assert.match(zoom, /activateZoomControlWithOverflow\(rootRef\.current, "join-audio"\)/);
  assert.match(controls, /"join-audio"/);
  assert.match(controls, /audioStatus\?:number/);
  assert.match(controls, /if \(status === 3\) return "failed"/);
  assert.match(controls, /if \(status === 1\) return "connecting"/);
  assert.match(controls, /if \(status === 0\) return "disconnected"/);
});

test("audio join must be triggered by a user gesture and checked after attempt", () => {
  assert.match(zoom, /onClick=\{\(\) => void audioAction\(\)\}/);
  assert.match(zoom, /for \(const delay of \[600, 2200, 8500\]\)/);
  assert.match(zoom, /generation !== generationRef\.current/);
  assert.match(zoom, /setAudioRecoveryStatus\("timeout"\)/);
  assert.match(zoom, /clearAudioRecoveryTimers\(\)/);
  assert.doesNotMatch(zoom, /client\.startAudio\(/);
  assert.doesNotMatch(zoom, /client\.joinAudio\(/);
});

test("recovery preserves Zoom-owned media and class session, textbooks, chat", () => {
  assert.match(zoom, /client\.getCurrentUser\?\.\(\)/);
  assert.match(zoom, /client\.on\?\.\("user-updated", updateAudio\)/);
  assert.match(zoom, /client\.off\?\.\("user-updated", updateAudio\)/);
  assert.match(zoom, /Zoom\'s Join Audio button was not found/);
  assert.match(frame, /allow="camera; microphone; display-capture; autoplay; fullscreen"/);
  assert.match(responsive, /Audio trouble\? Open in Zoom app/);
  assert.match(css, /talkly-audio-connection-banner/);
  assert.match(css, /talkly-sdk-native-toolbar/);
  assert.doesNotMatch(zoom, /\.stop\(\)|\.getTracks\(\)|\.removeTrack\(/);
});
