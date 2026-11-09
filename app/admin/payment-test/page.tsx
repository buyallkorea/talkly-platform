import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { isSandboxKeyPair, TOSS_SANDBOX_AMOUNT } from "@/lib/payments/toss-sandbox-order";
import TossSandboxCheckout from "./TossSandboxCheckout";

export const dynamic = "force-dynamic";
export const metadata = { title: "토스페이먼츠 테스트 결제 | TALKLY", robots: { index: false } };

export default async function AdminTossPaymentTestPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  const secretKey = process.env.TOSS_SECRET_KEY;
  const ready = isSandboxKeyPair(clientKey, secretKey);

  return <div className="talkly-toss-test-page">
    <header className="talkly-toss-test-hero">
      <span>PAYMENT TEST · ADMIN ONLY</span>
      <h1>토스페이먼츠 테스트 결제</h1>
      <p>실제 요금 청구 없이 토스 결제창과 결제 승인 API 연결을 확인하는 관리자 전용 기능입니다.</p>
    </header>

    <div className="talkly-toss-test-grid">
      <section className="talkly-toss-test-panel">
        <h2>연결 상태</h2>
        <div className={"talkly-toss-test-status " + (ready ? "is-ready" : "is-blocked")}>
          {ready ? "테스트용 키 형식 확인 · 가상 결제 가능" : "테스트 키 설정 확인 필요"}
        </div>
        <p>{ready
          ? "현재 클라이언트·서버 키가 모두 토스 결제창형 테스트 키 형식입니다. 실제 키 한 쌍의 일치 여부는 가상 결제 승인 시 검증됩니다."
          : "Vercel Production에서 NEXT_PUBLIC_TOSS_CLIENT_KEY=test_gck_… 와 TOSS_SECRET_KEY=test_gsk_… 를 같은 토스 상점의 한 쌍으로 설정해야 합니다. 보안상 키 전체값은 화면에 표시하지 않습니다."}</p>
        <div className="talkly-toss-test-amount"><span>가상 결제 금액</span><strong>{TOSS_SANDBOX_AMOUNT.toLocaleString("ko-KR")}원</strong></div>
        {ready
          ? <TossSandboxCheckout clientKey={clientKey!} />
          : <p className="talkly-toss-test-notice">라이브 키가 설정되면 이 테스트 기능은 자동으로 비활성화됩니다. 잘못된 키로는 결제를 진행할 수 없습니다.</p>}
      </section>
      <section className="talkly-toss-test-panel">
        <h2>테스트 안내</h2>
        <ol>
          <li>본 관리자 계정으로 로그인한 상태에서 아래의 ‘가상 결제창 열기’를 선택합니다.</li>
          <li>토스 테스트 결제창에서 카드 등 지원되는 결제수단을 선택하고 인증을 진행합니다.</li>
          <li>결제가 끝나면 TALKLY 결과 화면에서 <strong>DONE</strong> 승인 여부를 확인합니다.</li>
          <li>토스 개발자센터의 ‘테스트 결제내역’에서 해당 주문을 대조합니다.</li>
        </ol>
        <p className="talkly-toss-test-notice">실제 카드 금액은 출금되지 않습니다. 이 테스트는 결제 게이트웨이만 검증하며 실제 수강신청·수업 일정·급여·주문 DB는 변경하지 않습니다.</p>
        <Link href="/admin/enrollment-requests" className="talkly-toss-test-link">일반 수강신청 관리로 돌아가기 →</Link>
      </section>
    </div>
  </div>;
}
