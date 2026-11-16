/** Exact wording shown at checkout; changing text requires a new version. */
export const TUITION_CONSENT_VERSION = "2026-11-16-v1";
export const TUITION_CONSENT_ITEMS = [
  {
    key: "discount",
    label: "① 수강기간 및 할인금액 확인",
    text: "선택한 수강기간에 따라 3개월 5%, 6개월 10%, 12개월 20%의 장기 수강 할인이 적용되며, 결제 예정금액은 해당 할인 혜택이 반영된 금액임을 확인합니다.",
    positive: "확인",
    negative: "미확인",
  },
  {
    key: "earlyTermination",
    label: "② 약정기간 중도 해지 시 할인 조건 확인",
    text: "장기 수강 할인은 선택한 약정기간 이용을 조건으로 제공됩니다. 기간 만료 전 중도 해지 시 할인 조건에 따른 재정산이 이루어질 수 있으며, 관계 법령상 환불기준이 적용됩니다.",
    positive: "확인",
    negative: "미확인",
  },
  {
    key: "refund",
    label: "③ 중도 해지 및 환불 조건 동의",
    text: "중도 해지 시 이미 이용한 수업은 결제 당시 고지된 할인 전 1개월 정상 수강료를 기준으로 정산하는 것이 TALKLY의 기본 원칙이며, 관계 법령에서 정하는 환불기준이 우선 적용될 수 있음을 확인하고 동의합니다.",
    positive: "동의",
    negative: "미동의",
  },
] as const;
export type TuitionConsentKey = (typeof TUITION_CONSENT_ITEMS)[number]["key"];
export type TuitionConsentAnswers = Record<TuitionConsentKey, "" | "yes" | "no">;
export const EMPTY_TUITION_CONSENT: TuitionConsentAnswers = {
  discount: "", earlyTermination: "", refund: "",
};
export function isTuitionConsentComplete(answers: TuitionConsentAnswers) {
  return answers.discount === "yes" && answers.earlyTermination === "yes" && answers.refund === "yes";
}
