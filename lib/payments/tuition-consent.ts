/** Exact wording shown at checkout; changes require a new immutable version. */
export const TUITION_CONSENT_VERSION = "2026-11-18-v2";
export const TUITION_CONSENT_ITEMS = [
  {
    key: "discount",
    label: "① 수강 조건 및 결제금액 확인",
    text: "선택한 강사, 주당 수업 횟수, 수업 시간, 총 수강기간 및 최종 결제예정금액을 확인하였습니다.",
    positive: "확인",
    negative: "미확인",
  },
  {
    key: "refund",
    label: "② 중도 해지 및 환불 기준 동의",
    text: "중도 해지 시 이미 이용한 수업은 할인 전 1개월 정상 수강료를 기준으로 정산하여 남은 금액을 환불하는 것이 TALKLY의 기본 원칙이며, 실제 환불에는 관계 법령상 반환기준이 적용됨을 확인하고 동의합니다.",
    positive: "동의",
    negative: "미동의",
  },
] as const;
export type TuitionConsentKey = (typeof TUITION_CONSENT_ITEMS)[number]["key"];
export type TuitionConsentAnswers = Record<TuitionConsentKey, "" | "yes" | "no">;
export const EMPTY_TUITION_CONSENT: TuitionConsentAnswers = {
  discount: "", refund: "",
};
export function isTuitionConsentComplete(answers: TuitionConsentAnswers) {
  return answers.discount === "yes" && answers.refund === "yes";
}
