# TALKLY online material / Zoom screen sharing — 2026-11-04

## User flow

Assigned teachers entering `/classroom/[sessionId]` choose registered textbook or online material/screen sharing before Zoom initializes. A registered textbook can be chosen from the enrollment assignments. Saving and entering uses the existing classroom URL with `materials=ready`; this marker skips only the setup UI and never grants access or host privileges.

In screen mode the teacher uses the Zoom toolbar's native **Share Screen** control, then chooses the actual textbook tab/window in the browser dialog. For listening activities select Chrome/Edge tab audio. Students, parents and administrator observers view the same Zoom share and cannot change TALKLY material settings. No source URL, login or third-party password is distributed or stored.

Admin test lesson creation supports both material types. Screen mode requires no book and creates no textbook assignment or charge. Existing requests default to textbook mode. The existing temporary-test flag, isolation, overlap checks and Zoom rollback remain.

## Layout and compatibility

The deployed Meeting SDK is pinned at 6.2.0. Its public Component View API has no separate screen-share mounting target or public programmatic start-share method. The Video SDK methods are not available in this Meeting SDK. Accordingly screen mode spans the existing Zoom component across the former video/material columns, retaining Zoom's video/ribbon/share controls and the separate TALKLY chat. It does **not** extract/reparent SDK internal DOM. Registered textbook mode restores the original three-column layout.

The React instances of Zoom, textbook and chat remain mounted across mode changes. No signature, meeting join, attendance flow or host credentials are reissued just to change mode. Public SDK `peer-share-state-change` / `user-updated` / `user-removed` events expand the viewing area during a share. Stop the Zoom share before switching back. Stopping sharing leaves screen mode in a waiting state; it does not end the class. Actual sharing permission remains a browser/OS choice and Zoom's native host controls, never auto-approved by TALKLY.

## Data and authorization

Additive `class_sessions.material_mode` column defaults to `textbook`, constrained to `textbook|screen`. Existing selected_textbook_id, assignments, progress and RLS policies are unchanged. No media is sent through Supabase.

`GET /api/classroom/material-mode` validates identity and lesson ownership (assigned teacher, enrolled student, active child-owning parent, or existing admin access). `POST` is assigned internal teacher only, including substitute teacher precedence. Administrator observer/test-student mode does not grant write permission. The update uses the authenticated Supabase client so RLS rechecks current teacher ownership at write time, and atomically filters live statuses, ended_at and scheduled_end. Optional assigned-book selection is saved in that same update.

Mode sync uses the existing class_sessions Postgres Changes subscription as invalidation only and rechecks the authorized no-store API. A 15-second visible-tab fallback and online/visibility recheck recover missed events. An in-flight GET cannot overwrite a newer successful teacher selection. Unmount aborts reads, removes subscriptions/listeners and clears timers.

## Validation and remaining live check

- Automated API role/ownership/expired/terminal/concurrent-close checks, preparation navigation and error behavior, observer view-only UI, SDK events/cleanup, stale-response protection, preserved child instances, and mock admin creation for both modes.
- Existing classroom terminal routing, Zoom host/participant signatures, chat, textbook selection, signup, login and route regression suites.
- TypeScript, changed-file ESLint and production build. Route scan includes the new API and retains all existing paths.
- Tests use fixtures only: no real lessons, messages, accounts, payments or Zoom meetings are created.
- Real teacher/student browser screen selection, tab audio, Zoom host settings, and cross-country network quality still require a live classroom test. Protected preview/production runtime log access may require existing Vercel team authorization; this report does not assert a clean runtime log scan.

## Release / fallback

Apply the additive migration before releasing code that selects the new column. Existing code ignores the extra column safely. Rollback application code without dropping the column or any lesson data. No Zoom SDK version upgrade or account-wide setting change is included.
