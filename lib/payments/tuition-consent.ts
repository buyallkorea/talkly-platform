/** Exact wording shown at checkout; changes require a new immutable version. */
export const TUITION_CONSENT_VERSION = "2026-11-19-v5";
export const TUITION_CONSENT_ITEMS = [
  {
    key: "refund",
    label: "① 중도 해지 및 환불 기준 동의",
    text: "장기 수강 할인은 약정 수강기간에 대한 혜택입니다. 중도 해지 시 할인 전 1개월 기본 수강료를 기준으로 실제 진행한 수업 횟수에 해당하는 수업료를 산정하여 환불액에 반영합니다. 다만 관계 법령에서 정한 반환기준이 우선 적용되며, 해당 기준보다 불리하게 정산하지 않습니다.",
    positive: "동의",
    negative: "미동의",
  },
  {
    key: "finalConfirmation",
    label: "② 위 사항을 모두 확인하고 수강료 결제에 동의합니다.",
    text: "위 수강 조건과 환불 기준, 최종 결제금액을 확인하였습니다.",
    positive: "확인",
    negative: "미확인",
  },
] as const;
export type TuitionConsentKey = (typeof TUITION_CONSENT_ITEMS)[number]["key"];
export type TuitionConsentAnswers = Record<TuitionConsentKey, "" | "yes" | "no">;
export const EMPTY_TUITION_CONSENT: TuitionConsentAnswers = {
  refund: "", finalConfirmation: "",
};
export function isTuitionConsentComplete(answers: TuitionConsentAnswers) {
  return answers.refund === "yes" && answers.finalConfirmation === "yes";
}
