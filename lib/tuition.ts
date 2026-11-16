/** 공개 안내 가격은 TALKLY course_pricing (25분, 월 4주 기준)과 동일합니다. */
export type TuitionRegion = "philippines" | "western" | "special";
export type TuitionMonths = 1 | 3 | 6 | 12;
export const TUITION_REGIONS: { key: TuitionRegion; label: string; perLesson: number }[] = [
  { key: "philippines", label: "필리핀 강사", perLesson: 12_500 },
  { key: "western", label: "서구권 강사", perLesson: 20_000 },
  { key: "special", label: "북미권 강사", perLesson: 25_000 },
];
export const TUITION_MONTHS: { months: TuitionMonths; discount: number }[] = [
  { months: 1, discount: 0 },
  { months: 3, discount: 5 },
  { months: 6, discount: 10 },
  { months: 12, discount: 20 },
];
export const TUITION_WEEKS_PER_MONTH = 4;
export function tuitionAmount(region: TuitionRegion, lessonsPerWeek: number, months: TuitionMonths) {
  const perLesson = TUITION_REGIONS.find((r) => r.key === region)?.perLesson ?? 0;
  const regular = perLesson * TUITION_WEEKS_PER_MONTH * lessonsPerWeek * months;
  const rate = TUITION_MONTHS.find((p) => p.months === months)?.discount ?? 0;
  const discount = Math.round(regular * rate / 100);
  return { monthly: perLesson * TUITION_WEEKS_PER_MONTH * lessonsPerWeek, regular, discount, final: regular - discount, rate };
}
export function tuitionRegionForNationality(nationality: string | null): TuitionRegion {
  const value = (nationality ?? "").trim().toLowerCase();
  if (value.includes("필리핀") || value.includes("philipp")) return "philippines";
  if (value.includes("미국") || value.includes("캐나다") || value.includes("united states") || value.includes("american") || value.includes("canad") || value === "usa" || value === "us") return "special";
  return "western";
}
