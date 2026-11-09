export type AssessmentKind = "initial" | "monthly";
export type AssessmentStatus = "draft" | "submitted";
export type Values = Record<string, string | string[]>;
export type Field = { key: string; label: string; type?: "textarea" | "select" | "multi" | "date" | "number"; options?: string[]; required?: boolean; max?: number; hint?: string };
export type Section = { title: string; fields: Field[] };
export const RATINGS = ["E — Emerging", "D — Developing", "I — Independent", "NYO — Not Yet Observed"];
export const DOMAINS = ["Listening", "Comprehension", "Speaking", "Pronunciation", "Vocabulary", "Sentence patterns", "Reading & writing (age appropriate)"];
const INITIAL_OBSERVED_BEHAVIORS = [
  "Responds to greetings, own name, or 1-step directions",
  "Identifies pictures/objects; answers yes/no or simple questions",
  "Attempts words, phrases, or simple sentences; length of utterance",
  "Imitates familiar sounds/words intelligibly",
  "Recognizes/uses basic everyday words",
  'Attempts "I am…", "I like…", "It is…", etc.',
  "Recognizes letters, sounds, or sight words; reads/writes as age-appropriate. Assess only if age-appropriate; otherwise mark NYO.",
];
const f = (key: string, label: string, type?: Field["type"], options?: string[], required = false, hint?: string): Field => ({ key, label, type, options, required, hint });
export function assessmentSections(kind: AssessmentKind): Section[] {
  const monthly = kind === "monthly";
  return [
    { title: "01 · Student & assessment information", fields: [
      f("studentName", "Student name", undefined, undefined, true), f("nickname", monthly ? "Nickname / English name" : "Nick Name"),
      f("age", "Age", "number"), f("grade", monthly ? "School grade (not English proficiency)" : "Grade"),
      f("assessmentDate", monthly ? "Assessment / report date" : "Assessment date", "date", undefined, true), f("instructor", "Instructor", undefined, undefined, true),
      ...(monthly ? [f("reviewFrom", "Review period — from", "date", undefined, true), f("reviewTo", "Review period — to", "date", undefined, true),
        f("currentLevel", "Current English level"), f("textbook", "Textbook / series"), f("contentCovered", "Content covered", "textarea"),
        f("basis", "Basis of evaluation", "multi", ["Direct observation", "Lesson notes", "Homework / review checks", "In-class mini-check"])]
        : [
          f("nativeLanguage", "Native language"),
          f("duration", "Test duration (minutes)", "number"),
          f("connectionQuality", "Connection quality", "select", ["Stable", "Minor issues", "Unstable"]),
          f("exposure", "Prior English exposure", "select", ["None", "Some", "Regular"]),
          f("exposureDetails", "Prior English exposure — details (school, academy, tutor, abroad, duration)", "textarea"),
          f("goals", "Primary goal (select all that apply)", "multi", ["Confidence", "Speaking", "Comprehension", "Listening", "Reading", "Grammar", "School studies", "Other"]),
          f("otherGoal", "Primary goal — Other"),
          f("guardianPresent", "Guardian present", "select", ["Yes, assisted during session", "Yes, observed only", "No"]),
        ]),    ] },
    { title: monthly ? "02 · Skill progress" : "02 · Skill evaluation", fields: DOMAINS.flatMap((domain, i) => [
      f(`skill${i}Rating`, i === 6 && !monthly ? "Early literacy (age-appropriate)" : domain, "select", RATINGS, true, monthly ? undefined : INITIAL_OBSERVED_BEHAVIORS[i]),
      ...(monthly ? [f(`skill${i}Trend`, `${domain} — progress this period`, "select", ["Improved ↑", "Maintained →", "Needs attention ↓", "NYO / no comparison"], true)] : []),
      f(`skill${i}Evidence`, `${domain} — evidence / example / instructor support`, "textarea", undefined, true),
    ]) },
    { title: monthly ? "03 · Learning behaviors" : "03 · Learner response & engagement", fields: monthly
      ? ["Participation & engagement", "Speaking confidence", "Response to feedback", "Attention & pace", "Preparation & homework", "Attendance & punctuality", "Camera & tech readiness"].flatMap((name, i) => [
        f(`behavior${i}`, name, "select", ["Consistently", "Often", "Sometimes", "Rarely", "NYO"]), f(`behavior${i}Note`, `${name} — example / note`, "textarea"),
      ]) : [
        f("participation", "Willingness to Participate (select all that apply)", "multi", ["Eager", "Warming up", "Hesitant", "NYO"]),
        f("participationExample", "Willingness to Participate — example / note", "textarea"),
        f("interaction", "Interaction with instructor (select all that apply)", "multi", ["Initiates", "Responds when asked", "Minimal response", "NYO"]),
        f("interactionExample", "Interaction with instructor — example / note", "textarea"),
        f("support", "Support used (select all that apply)", "multi", ["Visual", "Model", "Repetition", "Gesture", "No support needed"]),
        f("supportExample", "Support used — example / note", "textarea"),
        f("feedback", "Reaction to feedback (select all that apply)", "multi", ["Repeats/tries again", "Needs to check", "NYO"]),
        f("feedbackExample", "Reaction to feedback — example / note", "textarea"),
        f("attention", "Attention / pace (select all that apply)", "multi", ["Short attention span", "Moderate pace", "Extended focus", "NYO"]),
        f("attentionExample", "Attention / pace — example / note", "textarea"),
        f("camera", "Comfort on camera (select all that apply)", "multi", ["Comfortable", "Needs warm-up", "Very shy", "Technical issue"]),
        f("cameraExample", "Comfort on camera — example / note", "textarea"),
      ] },
    { title: monthly ? "04 · Progress summary & level recommendation" : "04 · Level placement", fields: monthly ? [
      f("overall", "Overall progress", "select", ["Exceeding expectations", "On track", "Gradual progress", "Needs additional support"], true),
      f("levelRecommendation", "Level recommendation", "select", ["Advance to next level", "Continue current level", "Review & consolidate", "Adjust level"], true),
      f("pace", "Textbook pace", "select", ["Ahead", "On pace", "Behind"]), f("nextUnit", "Next unit / lesson"), f("learningGoal", "Learning goal"),
      f("goalProgress", "Learning goal progress", "select", ["Exceeding", "On track", "Slower than expected"]),
      f("achievements", "Key achievements", "textarea", undefined, true), f("growth", "Priority areas for growth", "textarea", undefined, true),
    ] : [
      f("startingLevel", "Suggested starting level", "select", ["Grade K", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Adult"], true),
      f("estimatedCEFR", "Estimated CEFR", "select", ["Pre-A1", "A1", "A2", "B1", "B2 or above"]),
      f("levelVsAge", "Level vs. age / grade", "select", ["Below expected", "At expected", "Above expected"]),
      f("placementConfidence", "Placement confidence", "select", ["High", "Medium", "Low – re-check recommended"]),
      f("reassessmentLessons", "(If it needs change) Re-assessment — review placement after how many lessons?", "number"),
    ] },
    { title: monthly ? "05 · Next-month focus plan" : "05 · Textbook recommendation — primary decision", fields: monthly ? [
      ...[1, 2, 3].flatMap(i => [f(`plan${i}Skill`, `Focus ${i} — skill`, undefined, undefined, i === 1), f(`plan${i}Strategy`, `Focus ${i} — strategy / activities`, "textarea", undefined, i === 1), f(`plan${i}Success`, `Focus ${i} — success indicator`, "textarea", undefined, i === 1)]),
      f("homework", "Materials / homework", "textarea"), f("internalNotes", "Notes for next instructor — INTERNAL ONLY", "textarea"),
    ] : [
      f("primaryTextbook", "Primary textbook / series", undefined, undefined, true),
      f("textbookStartingLevel", "Starting level (recommended textbook)"),
      f("bookFit", "Why this book fits (select all that apply)", "multi", ["Visual / phonics", "Repetition", "Dialogues", "Guided speaking", "Other"]),
      f("bookFitOther", "Why this book fits — Other"),
      f("bookReason", "Rationale", "textarea", undefined, true),
      f("easierBook", "Alternative if too easy / hard — Easier"),
      f("harderBook", "Alternative if too easy / hard — Harder"),
    ] },
    ...(!monthly ? [{ title: "06 · Instructor summary & follow-up", fields: [
      f("keyStrengths", "Key strengths", "textarea"),
      f("growthAreas", "Priority areas for growth", "textarea"),
      f("firstFourLesson1", "Focus for first 4 lessons — 1"),
      f("firstFourLesson2", "Focus for first 4 lessons — 2"),
      f("firstFourLesson3", "Focus for first 4 lessons — 3"),
      f("instructorHandover", "Notes for next instructor / parent feedback", "textarea"),
    ] }] : []),
    ...(monthly ? [{ title: "06 · Parent feedback", fields: [
      f("parentHighlights", "Progress highlights — for parents", "textarea", undefined, true), f("parentNext", "What we are working on next", "textarea", undefined, true),
      f("homeSupport", "Support at home", "multi", ["Daily 5–10 min vocabulary review", "Read aloud together", "Listen to English audio / songs", "Practice target sentences", "Other"]),
      f("homeSupportOther", "Other home support"), f("parentCommunication", "Parent communication", "multi", ["Written report only", "Call / meeting suggested", "Parent question noted"]),
      f("parentQuestion", "Parent question", "textarea"), f("parentFeedback", "Feedback from parent (after communication)", "textarea"),
    ] }] : []),
  ];
}
export function validProgressPeriod(value: unknown): value is string { return typeof value === "string" && /^(period-[1-9]\d{0,2}|final)$/.test(value); }
export function validMonth(value: unknown): value is string { return typeof value === "string" && /^20\d{2}-(0[1-9]|1[0-2])$/.test(value); }
export function validDate(value: string) { return /^20\d{2}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
export function validateAssessment(kind: AssessmentKind, input: unknown, status: AssessmentStatus): Values {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("Invalid assessment data.");
  const raw = input as Record<string, unknown>, values: Values = {};
  const fields = assessmentSections(kind).flatMap(s => s.fields);
  if (Object.keys(raw).some(key => !fields.some(f => f.key === key))) throw Error("Unknown assessment field.");
  for (const field of fields) {
    const value = raw[field.key] ?? (field.type === "multi" ? [] : "");
    if (field.type === "multi") {
      if (!Array.isArray(value) || value.length > (field.options?.length ?? 0) || new Set(value).size !== value.length || value.some(v => typeof v !== "string" || !field.options?.includes(v))) throw Error(`Invalid ${field.label}.`);
      values[field.key] = [...value];
    } else {
      if (typeof value !== "string" || value.length > (field.type === "textarea" ? 2000 : 200)) throw Error(`Invalid ${field.label}.`);
      const text = value.trim();
      if (text && field.type === "select" && !field.options?.includes(text)) throw Error(`Invalid ${field.label}.`);
      if (text && field.type === "date" && !validDate(text)) throw Error(`Invalid ${field.label}.`);
      if (text && field.type === "number" && (!/^\d{1,3}$/.test(text) || Number(text) > (field.key === "age" ? 120 : 240))) throw Error(`Invalid ${field.label}.`);
      if (status === "submitted" && field.required && !text) throw Error(`Please complete: ${field.label}. Use NYO with an explanation when not observed.`);
      values[field.key] = text;
    }
  }
  if (kind === "monthly" && values.reviewFrom && values.reviewTo && values.reviewFrom > values.reviewTo) throw Error("Review end must be on or after its start.");
  return values;
}
