import Link from "next/link";
import TossReviewCheckout from "./TossReviewCheckout";
import { isSandboxKeyPair, TOSS_SANDBOX_AMOUNT } from "@/lib/payments/toss-sandbox-order";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "토스페이먼츠 결제 연동 테스트 | TALKLY",
  description: "TALKLY 토스페이먼츠 결제 연동을 확인하는 심사 전용 가상 결제 화면입니다.",
  robots: { index: false, follow: false },
};

export default function TossPaymentReviewPage() {
  const publicKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  const secretKey = process.env.TOSS_SECRET_KEY;
  const ready = isSandboxKeyPair(publicKey, secretKey);

  return (
    <main className="talkly-toss-test-page">
      <header className="talkly-toss-test-hero">
        <span>PAYMENT REVIEW · SANDBOX ONLY</span>
        <h1>TALKLY 결제 연동 확인</h1>
        <p>토스페이먼츠 심사 담당자가 로그인이나 강사 배정 없이 결제창 및 승인 연동을 확인할 수 있는 가상 결제 화면입니다.</p>
      </header>
      <div className="talkly-toss-test-grid">
        <section className="talkly-toss-test-panel">
          <h2>테스트 결제</h2>
          <div className={"talkly-toss-test-status " + (ready ? "is-ready" : "is-blocked")}>
            {ready ? "테스트 결제 가능 · 실제 청구 없음" : "테스트 결제 설정 확인 필요"}
          </div>
          <p>{ready
            ? "토스 테스트 키 환경입니다. 신용카드 등 테스트 가능한 결제수단을 선택하시면 승인 결과를 확인할 수 있습니다."
            : "현재 테스트 키가 설정되지 않았습니다. 관리자에게 토스 테스트 키 설정을 요청해 주세요. 실결제 키로는 이 화면이 비활성화됩니다."}</p>
          <div className="talkly-toss-test-amount"><span>가상 결제 금액</span><strong>{TOSS_SANDBOX_AMOUNT.toLocaleString("ko-KR")}원</strong></div>
          {ready && publicKey
            ? <TossReviewCheckout clientKey={publicKey} />
            : <p className="talkly-toss-test-notice">테스트 키가 준비되기 전에는 결제창을 열 수 없습니다.</p>}
          <p className="talkly-toss-test-notice">
            본 결제는 심사 목적의 테스트 거래입니다. 실제 카드 청구·TALKLY 수강 등록·강사 배정·실제 수강료 결제는 발생하지 않습니다.
          </p>
        </section>
        <section className="talkly-toss-test-panel">
          <h2>심사 담당자 이용 안내</h2>
          <ol>
            <li>별도 계정 로그인 없이 ‘가상 결제창 열기’를 선택합니다.</li>
            <li>토스 테스트 결제창에서 지원되는 결제수단을 선택해 인증합니다.</li>
            <li>완료 화면에서 ‘승인 성공 · DONE’ 및 주문번호를 확인합니다.</li>
            <li>토스 개발자센터의 테스트 결제내역에서 주문번호를 대조할 수 있습니다.</li>
          </ol>
          <p className="talkly-toss-test-notice">일반 수강료 결제는 수강신청, 강사·수업시간 배정, 수강기간 및 금액 확인, 필수 약관 동의를 거쳐 진행됩니다.</p>
          <div className="talkly-toss-test-actions">
            <Link className="talkly-toss-test-link" href="/tuition">수강료 안내</Link>
            <Link className="talkly-toss-test-link" href="/enroll">실제 수강신청 절차</Link>
            <Link className="talkly-toss-test-link" href="/refund-policy">환불정책</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
