import Link from "next/link";
export default function AiPaymentFail() {
  return (
    <main className="tai tai-info">
      <h1>결제가 완료되지 않았어요.</h1>
      <p>
        취소했거나 승인에 실패했을 수 있어요. 결제 내역을 확인한 뒤 다시 시도해
        주세요.
      </p>
      <Link href="/talkly-ai">TALKLY AI로 돌아가기</Link>
    </main>
  );
}
