# Classroom share layout and audio controls

User report: registered textbooks had video/material/chat columns, but screen
sharing merged video and material into one oversized native widget. Neither
textbook sound nor conversation audio was reliably audible; icon buttons were
hard to understand.

## Change

- Keep one authenticated Zoom client and one same-origin iframe. Student screen
  sharing keeps small camera tiles on the left and the native shared canvas in
  the centre; TALKLY chat stays on the right. Small phone widths stack the areas.
- The camera default view is gallery. Public `viewSizes` keep video at 240–320px
  in shared mode. The pinned SDK's native share paper otherwise hardcodes
  `min(80vw,1120px)` and positions cameras on the right. Scoped CSS targets the
  SDK's accessible `Screen share` canvas and `Zoom Web SDK Widget` region to
  reverse that layout, constrain width, and allow the SDK's own ResizeObserver
  to fit the source. No canvas copy, React node relocation, extra capture,
  duplicate participant, private stream API or separate media transport.
- Parent/frame handshake sends only a session ID and split boolean. Both sides
  validate same origin, exact window source and session. Mode updates do not
  remount/rejoin Zoom. Independent frame authorization remains unchanged.
- Zoom join is NOT computer audio join. `getCurrentUser()`/participant events
  drive disconnected, muted, ready and unknown indicators and remote audio
  status. Creation routes currently use `mute_upon_entry: true`; preserve that
  setting and make the deliberate unmute action prominent.
- Large labelled connect-audio, microphone, camera and teacher screen-share
  buttons. Mute uses the public SDK API. Component View has no public connect
  audio/start-share API, so a small adapter activates only the visible matching
  native accessible control in the user's gesture. If it is in Zoom's More
  menu, open that menu and activate only the matching enabled menu item. If no
  match is available, display native-toolbar instructions, never fake success.
- Local speaker tone is explicitly a device output check, not proof of remote
  transport. Settings/help explain microphone/site-sound permission, selected
  input/output device and volume. Permission is not bypassed; no auto unmute.
- Textbook audio requires Chrome tab sharing with **Share tab audio** checked.
  An arbitrary window/whole-screen source may not include audio. Instructor
  instructions now say to stop and re-share the textbook tab if audio was not
  selected. User/browser must choose this; code cannot force that checkbox.
- Start Class blue, End Class red, larger text and visible focus outlines.

## Boundaries

No DB, RLS, meeting-account settings, SDK version, payment, recording, attendance,
chat transport or teacher/student role changes. Teacher operates the original
textbook beside TALKLY. Students do not need the source website login.

SDK styling/control adapter is deliberately pinned to 6.2.0. An SDK upgrade
requires rechecking accessible labels, share canvas and wrapper structure.
Sources inspected: official package `@zoom/meetingsdk@6.2.0` embedded.d.ts and
component bundle; official Component View initialization/positioning/resizing
and participant-event documentation.

## Verification

Automated authorization, mode sync, host/participant signature, source-window
validation, native control targeting, audio-state distinction and existing
regressions are checked. TypeScript/lint/build and route checks are run before
release. ClassSessionControls has pre-existing effect-setState lint finding;
only button styling is changed there.

Live microphone/speaker transmission and actual two-device share geometry are
NOT proven by these tests. Headless Chromium could not start under the execution
sandbox; cloud browser disallowed the local fixture URL. No bypass was attempted.
No successful browser fixture measurement is claimed. A fresh two-device rehearsal
is required, with teacher and student both reopening the classroom after deploy:

1. Both click Connect audio if disconnected, then unmute. Exchange spoken words
   in both directions; check each side's state and selected device.
2. Teacher opens original textbook in a separate Chrome window, shares its tab
   with Share tab audio checked, and plays listening audio.
3. Student confirms left cameras / centre shared book / right chat at laptop and
   desktop widths. Stop/restart share and switch back to a registered book.
4. Teacher stops source audio: verify ordinary speech still passes both ways.
5. Neither browser's local speaker tone substitutes for steps 1–4.
