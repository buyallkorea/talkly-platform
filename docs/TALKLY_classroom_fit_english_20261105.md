# Shared-material fit and teacher English UI

User supplied a fresh student screenshot after the previous release: the book
was still displayed in a small native Zoom widget, camera tiles were vertically
clipped, and nested scrollbars consumed the shared-material area. Teacher
classroom system UI also contained Korean.

## Layout correction

Measure the allocated iframe body after the TALKLY controls, rather than assuming
its full document height is available. Pin the SDK mount to a relative block;
Zoom initialization otherwise changes it to flex. Keep status/actions outside
the scrolling native widget area.

Mark the actual native widget and all intervening sizing wrappers. The previous
CSS assumed an ancestor depth and left shrink-to-fit wrappers in the path. The
adapter applies classes only, without moving React nodes, copying canvases,
creating a second capture, or changing media transport. Camera / share / divider
classes target the SDK's accessible share canvas and widget region.

When receiving a share, use the public gallery view after the native receiving
transition. SDK 6.2.0 ribbon layout forces a 615px base height, which caused the
large empty camera area and clipped thumbnails. Gallery respects compact video
sizes; shared content still uses Zoom's native Fit to Window and ResizeObserver.
Camera width stays 240–320px; the remaining central space goes to the book, with
TALKLY chat on the right. Preserve source aspect ratio: some letterboxing can be
correct and should not be removed by stretching or cropping textbook text.

## English teacher interface

System labels in setup, live controls, Zoom connection/error/audio prompts,
material mode, registered textbook selection/progress, chat, whiteboard and
completed/unavailable lesson pages select authored English for teachers.
Student Korean copy stays available. Stable translation function identities keep
copy rendering from causing media effect restarts. Untranslated Korean server
errors get an English retry fallback. User messages and original lesson content
are not machine translated. A Korean-only course title uses the generic Online
English heading in teacher view.

## Verification and limits

Tests render teacher setup/material/chat/textbook selection, check all translated
system labels for English copy, preserve Korean student labels, test stable
translator identity and API-error fallback, verify layout wrapper marking keeps
media node parents unchanged, and verify allocated video dimensions/public
gallery transition with one SDK join. Existing auth/role/material/audio/route
regressions are included. Production build/type checking and lint regression
comparison are run before release.

These are not a live two-device Zoom media/geometry test. Do not claim that the
actual shared textbook, microphones or listening audio have been proven by these
fixtures. Reopen both classrooms after deployment before the next real share.
No DB, RLS, meeting account setting, SDK version or external textbook access
policy changes.
