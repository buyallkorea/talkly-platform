import Link from "next/link";

export const metadata = {
  title: "수강 취소 및 환불정책 | TALKLY",
  description: "TALKLY 화상영어 수강 취소 및 환불 정책 안내",
};

const sections = [
  ["제1조 적용 범위", "본 정책은 TALKLY의 실시간 화상영어 교육 서비스에 적용됩니다. 관계 법령의 강행규정이 본 정책과 다를 경우 관계 법령을 우선 적용합니다."],
  ["제2조 수업 시작 전", "첫 수업 시작 전에 취소하는 경우 결제한 수강료 전액을 반환합니다."],
  ["제3조 수업 시작 후", "수강 중 취소 시 관계 법령이 정한 교습비·학습비 반환기준을 따릅니다. 1개월 이내 과정에 시간 단위 기준이 적용될 경우 총 수업시간 1/3 경과 전에는 납부한 학습비의 2/3, 1/3 경과 후부터 1/2 경과 전에는 1/2을 반환합니다. 1/2 경과 후에는 해당 기간의 반환금액이 없습니다. 1개월 초과 과정 및 회차 단위 과정에는 해당 법정 기준을 우선 적용합니다."],
  ["제4조 할인 상품의 중도 해지", "3개월·6개월·12개월 등 장기 수강 할인은 약정 기간을 이용하는 조건으로 제공됩니다. 수업 시작 후 수강생 사정으로 중도 해지하는 경우, 제공된 수업은 결제 전에 고지된 할인 전 정상 회당 수강료로 정산하는 것을 원칙으로 합니다. 정상가 기준 환불 예정금액은 실제 결제금액에서 (정상 회당 수강료 × 제공된 수업 횟수)를 공제하여 계산하며 음수는 0원으로 봅니다. 다만 관계 법령이 보장하는 반환금액이 더 크거나 정상가 차감이 허용되지 않는 경우에는 관계 법령에 따라 산정한 금액을 반환합니다. 정상가·할인율·정산 방식을 결제 전에 명확히 고지합니다. TALKLY 귀책으로 인한 중단에는 할인 회수 기준을 일방적으로 적용하지 않습니다."],
  ["제5조 일정 변경 및 결석", "수업 취소 및 일정 변경 기한, 결석 처리 방식은 신청 시 별도로 고지합니다. TALKLY 또는 강사 귀책으로 제공하지 못한 수업은 보강하거나 해당 미제공분을 반환합니다."],
  ["제6조 환불 신청", "고객은 홈페이지 1:1 상담을 통해 환불을 신청할 수 있습니다. TALKLY는 수강 기록과 결제내역에 근거해 환불 산정 내역을 안내하고 관련 법령에서 정한 기한 내 처리합니다."],
  ["제7조 별도 교재 및 콘텐츠", "별도로 판매한 교재 및 디지털 콘텐츠의 반환은 각 상품의 제공 상태와 관계 법령에 따라 처리합니다."],
  ["제8조 분쟁 해결", "본 정책에 규정되지 않은 사항은 관계 법령과 소비자분쟁해결기준에 따릅니다."],
];

export default function RefundPolicyPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#fafaf7", padding: "40px 20px", color: "#1b2a4a" }}>
      <article style={{ maxWidth: 820, margin: "0 auto", background: "#fff", border: "1px solid #e7e9f0", borderRadius: 20, padding: "clamp(24px, 5vw, 56px)" }}>
        <Link href="/" style={{ color: "#345a9c" }}>← TALKLY 홈</Link>
        <h1 style={{ marginTop: 30, fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 800 }}>수강 취소 및 환불정책</h1>
        <p style={{ marginTop: 12, color: "#64748b" }}>TALKLY 화상영어 수업의 취소·환불 기준을 안내합니다.</p>
        <p style={{ marginTop: 8, color: "#9a3412", fontSize: 14 }}>본 페이지는 운영 정책 검토안입니다. 실제 적용 전 사업자 신고 형태와 법정 반환기준을 최종 확인해야 합니다.</p>
        {sections.map(([title, text]) => (
          <section key={title} style={{ paddingTop: 26 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{title}</h2>
            <p style={{ lineHeight: 1.85, whiteSpace: "pre-line", color: "#334155" }}>{text}</p>
          </section>
        ))}
        <p style={{ marginTop: 36, fontSize: 14, color: "#64748b" }}>환불 문의: <Link href="/consultation" style={{ textDecoration: "underline" }}>1:1 상담</Link></p>
      </article>
    </main>
  );
}
