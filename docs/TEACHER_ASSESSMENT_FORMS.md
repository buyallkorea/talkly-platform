# TALKLY document-based teacher assessment replacement

The initial diagnostic and continuing-student progress documents replace new
numeric assessment input when `TALKLY_ASSESSMENTS_ENABLED=true`. This change is
based on main at 4ed477a and is independent of the TALKLY AI development branch.
Existing numerical records remain unchanged and accessible from legacy-history
links. No E/D/I/NYO-to-number conversion is performed.

## Routes and workflow

- `/teacher/reviews` opens the replacement list (existing due periods, assigned targets,
  saved status, create/view/edit links). `/teacher/assessments` is its direct URL.
- `/teacher/level-tests/[id]` preserves scheduled entry and re-entry controls and
  replaces active/completed score input with the diagnostic form link.
- `/teacher/students/[enrollmentId]` and `/teacher/classes/[sessionId]` link to the
  progress review. A lesson link selects the existing four-week/final evaluation period.
- `/admin/evaluations` opens the administrator replacement list.
  `/admin/assessments` is its direct URL. Administrator level-test/enrollment
  details also link to the corresponding forms.
- Detail paths: `/{teacher|admin}/assessments/{initial|monthly}/[sourceId]`.
  Initial source IDs are **interview IDs**, not level-test request IDs. Monthly
  source IDs are enrollment IDs, with `?period=period-N` or `?period=final` selecting the existing review cycle.
  Lists can be narrowed with `?enrollment=ID`, as linked from learner details.
  Source queries have explicit caps and fail rather than silently using truncated schedules.
- Drafts accept incomplete fields. Submission requires ratings with evidence,
  placement/textbook rationale (initial), or progress/next-month/parent sections
  (monthly). Parent feedback after communication and optional plans may be added
  later. Submitted records remain editable by current assigned teacher/admin.
- Old score-write endpoints reject completion writes when replacement is enabled;
  the level-test `start` action remains available. Old histories are read-only
  through the replacement workflow; legacy tables are not migrated or deleted.

## Data and authority

New tables `teacher_assessments` and `teacher_assessment_versions` keep the
structured form, draft/submitted state, optimistic revision and audit snapshots.
RLS is enabled with no public/anonymous/authenticated table access. Only the
server service role can use the save RPC. Every page/API verifies live Auth and
the profile role; source access checks the current assigned tester/regular teacher.
The RPC rechecks that assignment while locking the source row. Admins can edit
both kinds. Students and parents cannot access these internal forms.

Record and version save together. Stale revisions return 409 and preserve the
browser's input. Failed or uncertain saves never display success. An uncertain
save followed by a conflict requires copying edits and reloading; it does not
blindly overwrite a newer revision. Each version identifies actor and time.

Diagnostic submission atomically completes the current interview and returns
its parent level-test to `admin_review`, a status allowed by the existing DB
constraint. A final `completed` parent stays completed. Teacher starting-level
recommendations update the existing recommendation fields; final level/course
fields and numerical scores are not changed. Archived interviews cannot be
modified by teachers. Administrators' historical corrections do not finalize
an unrelated newer interview.

Progress forms are per enrollment and the existing **four-week/final review cycle**, replacing the old numeric form. The existing teacher-evaluations scheduler determines when each form is due; arbitrary or premature periods are rejected. The same document is used for the final progress review. Auto-filled identity is a form snapshot and does not edit the learner's
profile. Attendance is independently queried for that assigned observation period,
counts unique present/late lesson IDs and excludes cancelled/test lessons. It
is not an invented lesson count or a skill score. Internal handover notes and
parent-facing text are separate fields, but automatic parent publication and
notifications are intentionally not part of this teacher/admin request.

## Deployment status and activation

No production migration, production feature flag, main merge or live classroom
write was performed for this implementation. The previous instruction forbids
production migration and main merge without new authorization.

Before enabling:
1. Review the additive migration ending `_teacher_assessment_forms.sql`.
2. Apply it in an authorized database with the existing classroom baseline.
3. Set `TALKLY_ASSESSMENTS_ENABLED=true` in that environment and redeploy.
4. For Preview writes, also set `TALKLY_ASSESSMENTS_PREVIEW_DB_REF` to an isolated
   project matching `NEXT_PUBLIC_SUPABASE_URL` exactly; production ref is blocked.
5. Verify teacher A creates/saves/submits, teacher B is denied, admin edits, and
   teacher A reloads the admin revision. Confirm the current interview lifecycle.

The retained AI test branch lacks enrollments, interviews and classroom tables;
no incomplete classroom baseline or student data was copied into it. Local
PGlite tests use minimal synthetic source tables solely to exercise the migration.
Full hosted/browser testing with real authenticated teacher/admin accounts remains
pending environment activation. The Supabase CLI bootstrap exited unsuccessfully
in this workspace; the timestamped migration was prepared locally and executed
against ephemeral PGlite for validation instead of running hosted CLI commands.

Checks: `npm run test:assessments`, `npm run test:regression`,
`npm run check:routes`, `npx tsc --noEmit`, new-component ESLint, Next build.
