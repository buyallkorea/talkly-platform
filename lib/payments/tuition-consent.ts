/** Exact wording shown at checkout; changes require a new immutable version. */
export const TUITION_CONSENT_VERSION = "2026-11-18-v4";
export const TUITION_CONSENT_ITEMS = [
  {
    key: "discount",
    label: "① 수강 조건 및 장기 수강 할인금액 확인",
    text: "선택한 강사 유형과 주당 수업 횟수, 희망시간, 총 수강기간 및 최종 결제금액을 확인하였습니다. 관리자 추천강사는 결제 완료 후 학생의 수준과 강사 근무시간을 검토해 배정하며, 배정과 수업 일정 확정 전에는 수업이 시작되지 않습니다.",
    positive: "확인",
    negative: "미확인",
  },
  {
    key: "refund",
    label: "② 중도 해지 및 환불 기준 동의",
    text: "장기 수강 할인은 약정 수강기간에 대한 혜택으로 중도 해지 시 할인 전 1개월 수강료를 기준으로 이용한 수업을 정산할 수 있습니다. 다만 실제 환불에는 관계 법령의 반환기준이 우선 적용됩니다.",
    positive: "동의",
    negative: "미동의",
  },
  {
    key: "finalConfirmation",
    label: "③ 위 사항을 모두 확인하고 수강료 결제에 동의합니다.",
    text: "위 수강 조건과 환불 기준, 최종 결제금액을 확인하였습니다.",
    positive: "확인",
    negative: "미확인",
  },
] as const;
export type TuitionConsentKey = (typeof TUITION_CONSENT_ITEMS)[number]["key"];
export type TuitionConsentAnswers = Record<TuitionConsentKey, "" | "yes" | "no">;
export const EMPTY_TUITION_CONSENT: TuitionConsentAnswers = {
  discount: "", refund: "", finalConfirmation: "",
};
export function isTuitionConsentComplete(answers: TuitionConsentAnswers) {
  return answers.discount === "yes" && answers.refund === "yes" && answers.finalConfirmation === "yes";
}
