# Screen-share layout correction — 2026-11-05

## Observed failure and scope

Live screenshots showed a received share larger than the student viewport (horizontal/vertical clipping), camera tiles crowding the share, and a large empty region on the presenter side. The presenter was already sending the external textbook correctly. Expanding only the host page's grid did not give the Zoom widget an independent viewport or create a presenter preview.

The user then clarified the teaching workflow: operate the original external textbook tab/window, keep the teacher classroom alongside it for student video/chat, and let students stay solely in the classroom. A proposed second-capture local preview was removed before release because it adds selection prompts without solving textbook interaction. No additional capture or media provider is introduced.

## Final change

- Isolate the intact Meeting SDK 6.2.0 in an authenticated same-origin `/classroom/[sessionId]/zoom` frame. The SDK now measures the available embedded viewport rather than the whole classroom browser window. Keep the existing SDK video/ribbon controls; resize both supported view sizes. No canvas copying, internal SDK DOM reparenting, API monkey-patching, or extra meeting participant.
- Teacher screen mode uses compact video/chat columns, including split-window sizes. Students retain the wider received-share/participant area plus separate TALKLY chat. Registered material layout and textbook instance/progress behavior remain.
- The frame authorizes its own entry through fresh user identity, profile role, enrollment ownership, substitute-teacher precedence, and terminal-state checks. It obtains meeting details server-side only after authorization. URLs carry no meeting password, signature, ZAK or user-controlled role/name.
- Same-origin frame permissions allow the existing camera/microphone/display-capture/autoplay/fullscreen operations. Actual browser permissions remain explicit. Share-state messages are accepted only from the exact frame window, same origin and matching lesson ID; other messages are ignored.
- Teacher schedule rows have separate Lesson details and prominent Enter Classroom actions (46px minimum height, explicit white-on-blue styling), without nested links. The lesson detail repeats the same prominent internal-classroom action. Closed/unlinked classes show an unavailable state; no raw Zoom URL is needed for a linked Zoom lesson.

## Important boundary

Screen sharing sends pixels. It cannot make an unrelated website interactive inside TALKLY or bypass the provider's embedding restrictions. Teachers still navigate the source textbook window. An in-class interactive external viewer requires an embed/API permitted by that provider and would need separate integration verification. Do not present a read-only preview as an interactive textbook integration.

## Verification

106 automated tests pass, including independent frame authorization (all roles, substitute/external teachers, terminal states), password lookup ordering, frame URL/permission attributes, forged-message rejection/cleanup, prominent teacher CTA behavior, and all existing material/Zoom/test-student/chat/message/login/route regressions. TypeScript, targeted ESLint and production build are checked before release. The existing teacher dashboard Date.now render-purity lint finding predates this change.

No new real meeting, user, message or payment is created. No schema/RLS/env changes are needed. OS permission dialogs and actual Zoom media rendering still require a teacher/student live check; fixture tests cannot prove those outcomes. Existing open classrooms are not forcibly reloaded. Test after finishing the ongoing lesson and reopening the classroom.
