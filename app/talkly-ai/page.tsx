import Link from "next/link";
import AiStudio from "./AiStudio";
import "./talkly-ai.css";
export const metadata = {
  title: "TALKLY AI | 하루 10분 영어 대화",
  description:
    "나의 속도를 기다려 주는 AI 영어 회화. 하루 10분, 30일 13,900원.",
};
export default function TalklyAiPage() {
  return (
    <main className="tai">
      <header className="tai-nav">
        <Link href="/">
          TALKLY <span>AI</span>
        </Link>
        <Link href="/">토클리 홈 ↗</Link>
      </header>
      <section className="tai-intro">
        <div>
          <p className="tai-kicker">A LITTLE ENGLISH, EVERY DAY</p>
          <h1>
            천천히 생각하고,
            <br />
            나의 영어로 이야기해요.
          </h1>
          <p>
            정해진 주제 없이 오늘의 이야기를 나누세요.
            <br />
            단어 하나에서 시작해도, 짧은 문장으로 함께 만들어 가요.
          </p>
        </div>
        <aside>
          <b>하루 10분 · 30일</b>
          <strong>
            13,900<span>원</span>
          </strong>
          <p>
            단일 요금제 · 자동결제 없음
            <br />
            한국시간 자정 초기화 · 남은 시간 이월 없음
          </p>
        </aside>
      </section>
      {process.env.TALKLY_AI_ENABLED === "true" ? (
        <AiStudio />
      ) : (
        <section className="tai-card">
          <h2>곧 만나요.</h2>
          <p>
            회화 연결과 결제 기능을 점검하고 있어요. 준비가 끝나면 이곳에서
            시작할 수 있어요.
          </p>
        </section>
      )}
      <footer className="tai-footer">
        실제 사람이 아닌 AI 튜터예요. 국가별 억양은 AI 지시를 기반으로 하며 실제
        현지 음성과 차이가 있을 수 있어요.{" "}
        <Link href="/talkly-ai/privacy">AI 정보 처리 안내</Link> ·{" "}
        <Link href="/talkly-ai/terms">AI 이용 안내</Link>
      </footer>
    </main>
  );
}
