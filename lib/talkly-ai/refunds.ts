export const REFUND_REASONS: Record<string, string> = {
  unused: "이용하지 않았어요",
  quality: "회화 품질 관련",
  technical: "기술적인 문제",
  other: "기타 문의",
};
export const REFUND_STATES: Record<string, string> = {
  requested: "접수됨",
  reviewing: "관리자 검토 중",
  awaiting_action: "검토 후 추가 처리 대기",
};
export function refundInput(value: Record<string, unknown>) {
  return (
    typeof value.orderId === "string" &&
    /^[A-Za-z0-9_-]{6,64}$/.test(value.orderId) &&
    typeof value.reason === "string" &&
    Object.hasOwn(REFUND_REASONS, value.reason) &&
    value.confirm === true
  );
}
