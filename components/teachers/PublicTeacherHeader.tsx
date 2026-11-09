import Image from "next/image";
import Link from "next/link";

export default function PublicTeacherHeader() {
  return <header className="talkly-public-teachers-header">
    <div className="talkly-public-teachers-header-inner">
      <Link href="/" aria-label="TALKLY 메인으로" className="talkly-public-teachers-logo">
        <Image src="/talkly-logo.png" width={220} height={76} alt="TALKLY" priority/>
      </Link>
      <nav aria-label="TALKLY 서비스 메뉴">
        <Link href="/teachers">강사진 소개</Link>
        <Link href="/level-test">레벨테스트</Link>
        <Link href="/enroll">수강신청</Link>
        <Link href="/consultation">1:1 상담</Link>
      </nav>
    </div>
  </header>;
}
