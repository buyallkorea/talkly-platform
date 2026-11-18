import Link from "next/link";

export default function TossReviewInfo({ requestId, applicationNumber }: { requestId?: number; applicationNumber?: string | null }) {
  return (
    <aside aria-label="수강신청 및 결제 진행 안내" style={{
      marginTop: 18, padding: "19px 22px", background: "#f5f8ff",
      border: "1px solid #dbe6fb", borderRadius: 15, color: "#0a1f44",
      fontSize: 13, lineHeight: 1.8,
    }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>
        {requestId ? `수강신청 ${applicationNumber ?? requestId} 접수 완료 · 강사 배정 대기` : "수강신청 후 결제는 어떻게 진행되나요?"}
      </h2>
      <p style={{ margin: "8px 0 10px", color: "#475467" }}>
        관리자 추천강사를 선택한 경우에는 수강료를 먼저 결제하고, 결제 완료 후 관리자가 학생 수준과 강사 근무시간을 확인해 배정합니다.
        특정 강사를 선택한 경우에는 해당 강사와 시간을 확인한 후 결제를 진행합니다.
        결제 전 할인·환불 조건 및 최종 금액을 반드시 확인해 주세요.
      </p>
      <div style={{ borderTop: "1px solid #d7e3f5", paddingTop: 10 }}>
        <strong>토스페이먼츠 심사 담당자이신가요?</strong>
        <p style={{ margin: "3px 0 10px", color: "#667085" }}>
          강사 배정을 기다리지 않고 결제창을 확인할 수 있는 별도의 1,000원 가상 결제 테스트를 제공합니다.
          실제 청구나 수강신청·수강권 생성은 발생하지 않습니다.
        </p>
        <Link href="/payment-review" style={{
          display: "inline-flex", minHeight: 40, padding: "0 15px", alignItems: "center",
          background: "#0a1f44", color: "#fff", textDecoration: "none",
          borderRadius: 9, fontSize: 13, fontWeight: 800,
        }}>토스 심사 전용 테스트 결제 열기 →</Link>
      </div>
    </aside>
  );
}
