import Link from "next/link";

export const metadata = {
  title: "수강 취소 및 환불정책 | TALKLY",
  description: "TALKLY 실시간 화상영어 수강 취소 및 환불정책",
};

const policySections = [
  {
    title: "제1조 목적 및 적용 범위",
    text: "본 정책은 TALKLY에서 제공하는 실시간 화상영어 수강권의 수강 취소, 계약 해지 및 환불 처리 기준을 정합니다. 거래에 적용되는 관계 법령의 의무사항을 따릅니다.",
  },
  {
    title: "제2조 수강료 및 장기 수강 할인",
    text: "수강료는 수업 시간, 주당 수업 횟수, 총 수강기간 및 선택한 상품에 따라 결정됩니다. 장기 수강권에는 할인 혜택을 제공할 수 있으며, 결제 전에 할인 전 정상 수강료, 할인율, 실제 결제금액, 수업기간, 총 수업 회차 및 중도 해지 정산 방식을 안내합니다.",
  },
  {
    title: "제3조 수업 시작 전 취소",
    text: "첫 수업이 시작되기 전에 수강계약을 취소한 경우, 납부한 수강료 전액을 환불합니다. 별도 교재나 독립적으로 판매되는 상품이 포함된 경우에는 해당 상품의 제공 여부와 관련 기준에 따라 구분하여 처리합니다.",
  },
  {
    title: "제4조 수업 시작 후 일반 수강권 환불",
    text: "수업이 시작된 이후에는 계약 해지 의사가 접수된 시점까지의 수업 제공 내역과 해당 계약에 적용되는 반환기준에 따라 환불금액을 정산합니다. 수강기간, 회차 및 수업 제공 방식에 따라 적용되는 기준이 다를 수 있습니다.",
  },
  {
    title: "제5조 장기 할인 수강권 중도 해지 정산",
    text: "3개월·6개월·12개월 등 장기 수강권은 약정한 수강기간을 이용하는 조건으로 할인이 적용됩니다. 수강생의 개인적인 사정으로 중도 해지하는 경우, TALKLY는 이미 제공된 수업을 최초 결제 시 안내한 할인 전 정상 수강료로 재산정하고, 그 금액을 실제 결제 수강료에서 공제하는 방식을 기본 정산 원칙으로 합니다.",
  },
  {
    title: "제6조 수업 이용량 및 해지 시점",
    text: "수업 제공 여부는 출결 기록, 실제 진행된 수업 회차 및 수업 일정 등을 통해 확인합니다. 해지 접수 이후 제공하지 않은 수업에 대해서는 임의로 이용료를 부과하지 않습니다. 결석 및 수업 취소에 관한 처리는 사전에 안내한 운영규정과 해당 기준에 따릅니다.",
  },
  {
    title: "제7조 TALKLY 귀책 사유 및 수업 미제공",
    text: "강사의 사정, 서비스 장애 등 TALKLY의 귀책으로 수업을 제공하지 못한 경우에는 보강수업을 제공하거나 미제공 수업에 대한 환불을 처리합니다. 회사의 귀책으로 제공되지 않은 수업에는 장기 할인 정상가 정산 방식을 일방적으로 적용하지 않습니다.",
  },
  {
    title: "제8조 환불 신청 및 처리",
    text: "수강생은 TALKLY 홈페이지의 1:1 상담을 통해 환불을 신청할 수 있습니다. TALKLY는 신청 접수일, 결제 내역 및 제공된 수업 기록을 확인하고 환불 정산 내역을 안내합니다. 환불은 적용되는 관련 기준에 따라 처리하며, 결제수단 또는 카드사에 따라 취소 금액의 실제 반영 시점이 다를 수 있습니다.",
  },
  {
    title: "제9조 이의 신청 및 기타",
    text: "수강생은 환불 산정 결과에 이의가 있는 경우 고객센터에 재검토를 요청할 수 있습니다. TALKLY는 계약 당시 고지한 조건, 결제 내역 및 수업 이용 내역을 확인하여 처리합니다. 별도로 정하지 않은 사항은 관련 법령과 소비자분쟁해결기준에 따릅니다.",
  },
];

export default function RefundPolicyPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#fafaf7", color: "#1b2a4a", padding: "48px 18px 80px" }}>
      <article style={{ width: "min(880px, 100%)", margin: "0 auto", background: "#fff", border: "1px solid #e7e9f0", borderRadius: 20, boxShadow: "0 10px 32px rgba(27,42,74,0.05)", padding: "clamp(24px, 5vw, 56px)" }}>
        <Link href="/" style={{ display: "inline-block", color: "#476699", textDecoration: "none", fontWeight: 700, marginBottom: 22 }}>← TALKLY 홈으로</Link>
        <p style={{ fontSize: 12, letterSpacing: ".13em", color: "#4e7aae", fontWeight: 800 }}>TALKLY / REFUND POLICY</p>
        <h1 style={{ margin: "12px 0", fontWeight: 850, letterSpacing: "-.035em", fontSize: "clamp(26px, 4vw, 38px)" }}>수강 취소 및 환불정책</h1>
        <p style={{ color: "#64748b", fontSize: 14 }}>적용 서비스: TALKLY 실시간 화상영어 수강권</p>
        <div style={{ borderTop: "2px solid #1b2a4a", margin: "28px 0 14px" }} />
        {policySections.map(({ title, text }) => (
          <section key={title} style={{ padding: "22px 0", borderBottom: "1px solid #edf0f4" }}>
            <h2 style={{ margin: "0 0 12px", fontWeight: 750, fontSize: 19 }}>{title}</h2>
            <p style={{ margin: 0, lineHeight: 1.95, color: "#475569", fontSize: 15, wordBreak: "keep-all" }}>{text}</p>
          </section>
        ))}
        <p style={{ marginTop: 34, fontSize: 14, color: "#475569" }}>
          환불 문의: <Link href="/consultation" style={{ color: "#345a9c", textDecoration: "underline", fontWeight: 700 }}>TALKLY 홈페이지 1:1 상담</Link>
        </p>
      </article>
    </main>
  );
}
