# TALKLY Initial Level Test Evaluation — 2026-11-09 document replacement

Source: user-provided `TALKLY_Level_Test_Evaluation.docx` (2-page English instructor form; 7 formatted tables), supplied 2026-11-09.

Scope: Replace **initial/diagnostic assessment content only**. The continuing student/monthly progress form, lesson schedule, authentication, submitted level-test lifecycle, RLS, payments and parent publication were not altered.

## Instructor form sections

1. Student & assessment information — Student name, Nick Name, age, grade, assessment date, instructor, native language, test duration, connection quality, prior English exposure and details, primary goals, guardian presence.
2. Skill evaluation — E / D / I / NYO ratings, the document's definitions, observed behaviors and evidence/instructor support for Listening, Comprehension, Speaking, Pronunciation, Vocabulary, Sentence patterns and age-appropriate Early literacy.
3. Learner response & engagement — Willingness to participate, Interaction with instructor, Support used (including Gesture), Reaction to feedback, Attention / pace, Comfort on camera; each with an independent Example / note.
4. Level placement — Suggested starting level (Grade K to Grade 9 or Adult), estimated CEFR, level versus age/grade, confidence and optional placement recheck after N lessons.
5. Textbook recommendation — Primary textbook / series, textbook starting level, reason for fit, rationale and easier/harder alternatives.
6. Instructor summary & follow-up — Strengths, priority growth areas, three focus items for first four lessons, notes for next instructor / parent feedback.

The screen displays observed-behavior hints per skill and the complete rating key. The existing submitted-value key `startingLevel` is preserved because the existing server-only save RPC uses it to populate the **teacher's suggestion**, not the administrator's final placement. Save validation remains strict for unknown fields; the database is the existing JSONB assessment store. There were no existing teacher_assessments records at the time of the migration-safe audit (2026-11-09). No DB migration, new table, environment variable, or destructive operation is required.

Changes apply to existing routes `/teacher/assessments/initial/[sourceId]` and `/admin/assessments/initial/[sourceId]`, reached from the existing teacher reviews and admin evaluations menus. The monthly form is unchanged.

## Verification before operational rollout

- `npx tsc --noEmit`
- `npm run test:assessments`
- `npm run test:regression`
- `npm run check:routes`
- Vercel Preview build and production build
- Real authenticated teacher/admin review to confirm all six sections, save draft, submit, edit, and no student/parent publication (separately required; cannot be concluded from build tests).

The source Word document itself is not automatically delivered to the user as a new website download link.
