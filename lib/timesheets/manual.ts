export type ClassBlock = { day: number; slot: number; student: string };
export type ManualStatus = "draft" | "submitted";
export type ManualTimesheet = {
  month: string;
  teacher_id: string;
  status: ManualStatus;
  entries: ClassBlock[];
  roster_notes: string;
  teacher_note: string;
  time_zone: string;
  revision: number;
  updated_at: string;
  submitted_at: string | null;
};
export const TIMESHEET_ZONES = ["Asia/Seoul", "Asia/Manila", "Asia/Tokyo", "UTC"] as const;
export const SLOTS_PER_DAY = 36;
export const SLOT_MINUTES = 30;
export function validMonth(value: unknown): value is string {
  return typeof value === "string" && /^20\d{2}-(0[1-9]|1[0-2])$/.test(value);
}
export function currentKoreanMonth(): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return (parts.find(part => part.type === "year")?.value ?? "2026") + "-" + (parts.find(part => part.type === "month")?.value ?? "01");
}
export function daysInMonth(month: string): number {
  if (!validMonth(month)) throw Error("Invalid month.");
  const [year, mon] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon, 0)).getUTCDate();
}
export function timeLabel(slot: number): string {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOTS_PER_DAY) throw Error("Invalid time slot.");
  const minutes = 360 + slot * SLOT_MINUTES;
  return String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
}
export function weeklyGroups(month: string): Array<{ key: string; days: (number | null)[] }> {
  const [year, mon] = month.split("-").map(Number);
  const groups: Array<{ key: string; days: (number | null)[] }> = [];
  for (let day = 1; day <= daysInMonth(month); day++) {
    const date = new Date(Date.UTC(year, mon - 1, day));
    const weekday = (date.getUTCDay() + 6) % 7;
    const monday = new Date(Date.UTC(year, mon - 1, day - weekday)).toISOString().slice(0, 10);
    if (groups[groups.length - 1]?.key !== monday) groups.push({ key: monday, days: Array(7).fill(null) });
    groups[groups.length - 1].days[weekday] = day;
  }
  return groups;
}
export function blockMinutes(blocks: ClassBlock[]): number { return blocks.length * SLOT_MINUTES; }
export function formatDuration(minutes: number): string { return Math.floor(minutes / 60) + "h " + String(minutes % 60).padStart(2, "0") + "m"; }
export function dailyMinutes(blocks: ClassBlock[], day: number): number { return blocks.filter(block => block.day === day).length * SLOT_MINUTES; }
export function validateManualTimesheet(month: unknown, input: unknown): {
  entries: ClassBlock[]; rosterNotes: string; teacherNote: string; timeZone: string; status: ManualStatus;
} {
  if (!validMonth(month) || !input || typeof input !== "object" || Array.isArray(input)) throw Error("Invalid timesheet.");
  const data = input as Record<string, unknown>;
  if (Object.keys(data).some(key => !["entries","rosterNotes","teacherNote","timeZone","status"].includes(key))) throw Error("Unknown timesheet field.");
  const status = data.status;
  if (status !== "draft" && status !== "submitted") throw Error("Invalid timesheet status.");
  if (!Array.isArray(data.entries) || data.entries.length > daysInMonth(month) * SLOTS_PER_DAY) throw Error("Invalid time blocks.");
  const seen = new Set<string>(), entries: ClassBlock[] = [];
  for (const raw of data.entries) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("Invalid time block.");
    const row = raw as Record<string, unknown>;
    if (Object.keys(row).some(key => !["day","slot","student"].includes(key))) throw Error("Unexpected block field.");
    if (typeof row.day !== "number" || !Number.isInteger(row.day) || row.day < 1 || row.day > daysInMonth(month) ||
        typeof row.slot !== "number" || !Number.isInteger(row.slot) || row.slot < 0 || row.slot >= SLOTS_PER_DAY ||
        typeof row.student !== "string") throw Error("Invalid time block.");
    const student = row.student.trim();
    if (!student || student.length > 80 || /[\u0000-\u001f\u007f]/.test(student)) throw Error("Enter a student name or ✓ (up to 80 characters).");
    const day = row.day as number, slot = row.slot as number, key = day + ":" + slot;
    if (seen.has(key)) throw Error("Duplicate time block.");
    seen.add(key); entries.push({ day, slot, student });
  }
  if (status === "submitted" && !entries.length) throw Error("Please mark at least one completed class before submitting.");
  const rosterNotes = data.rosterNotes ?? "", teacherNote = data.teacherNote ?? "", timeZone = data.timeZone ?? "Asia/Seoul";
  if (typeof rosterNotes !== "string" || rosterNotes.length > 3000 || typeof teacherNote !== "string" || teacherNote.length > 2000) throw Error("Notes are too long.");
  if (typeof timeZone !== "string" || !TIMESHEET_ZONES.includes(timeZone as typeof TIMESHEET_ZONES[number])) throw Error("Select a valid time zone.");
  entries.sort((a, b) => a.day - b.day || a.slot - b.slot);
  return { entries, rosterNotes: rosterNotes.trim(), teacherNote: teacherNote.trim(), timeZone, status };
}
