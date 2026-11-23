import Link from "next/link";

export const metadata = {
  title: "TALKLY AI | 나의 생각이 영어가 되는 시간",
  description: "TALKLY AI 영어 자유회화 서비스. 자막, 생활 문법, 오늘의 수업 PDF를 통해 대화가 학습으로 이어집니다.",
  robots: { index: true, follow: true },
};

const features = [
  { number:"01", title:"자유로운 AI 영어회화", subtitle:"FREE CONVERSATION",
    detail:"일상·학교·여행·직장 이야기를 나만의 속도로 말해 보세요. 여섯 명의 AI 튜터를 준비하고 있습니다." },
  { number:"02", title:"내가 말한 영어 문장", subtitle:"LIVE CONVERSATION NOTES",
    detail:"대화 자막을 확인하고, 실제 말한 문장을 더 자연스러운 영어로 복습하도록 설계했습니다." },
  { number:"03", title:"실생활 문법과 PDF 기록", subtitle:"YOUR DAILY REVIEW",
    detail:"오늘 대화의 문법과 표현을 정리하고 학습 기록을 PDF로 저장하는 기능을 준비하고 있습니다." },
];

export default function TalklyAiPublicIntroduction() {
  return <main className="talkly-ai-teaser">
    <header className="talkly-ai-teaser-nav">
      <div className="talkly-ai-teaser-nav-inner">
        <Link href="/talkly-ai" className="talkly-ai-teaser-brand" aria-label="TALKLY AI 홈">TALKLY <span>AI</span></Link>
        <Link href="/" className="talkly-ai-teaser-back">토클리 홈 ↗</Link>
      </div>
    </header>
    <div className="talkly-ai-teaser-content">
      <section className="talkly-ai-teaser-hero" aria-labelledby="talkly-ai-hero-title">
        <div className="talkly-ai-teaser-hero-copy">
          <span className="talkly-ai-teaser-kicker">YOUR ENGLISH, YOUR PACE</span>
          <h1 id="talkly-ai-hero-title">천천히 생각하고,<br/><em>나의 영어로 이야기해요.</em></h1>
          <p>AI와 편하게 대화하고, 내가 말한 문장으로 생활 문법을 배우고, 오늘의 영어를 나만의 기록으로 남기는 서비스.</p>
          <div className="talkly-ai-teaser-actions">
            <span className="talkly-ai-teaser-state">서비스 준비 중</span>
            <Link href="/" className="talkly-ai-teaser-alt">TALKLY 화상영어 이용하기 ↗</Link>
          </div>
          <small>현재 AI 회화·유료 결제는 정식 출시 전 검증 단계입니다.</small>
        </div>
        <div className="talkly-ai-teaser-demo" aria-label="AI 자유회화 기능을 설명하는 가상 대화 예시">
          <div className="talkly-ai-teaser-demo-head"><span>✦</span><div><strong>YOUR AI TUTOR</strong><small>FREE CONVERSATION · PREVIEW</small></div></div>
          <div className="talkly-ai-teaser-bubble">How was your day today?</div>
          <div className="talkly-ai-teaser-bubble is-mine">I go to work yesterday.</div>
          <div className="talkly-ai-teaser-grammar">
            <strong>✦ REAL-LIFE GRAMMAR</strong>
            <span>I went to work yesterday.</span>
            <small>어제 일어난 일을 말할 때는 과거형 went를 사용해요.</small>
          </div>
          <div className="talkly-ai-teaser-demo-foot">Conversation · Grammar · Daily PDF</div>
          <p>기능 설명용 화면 예시</p>
        </div>
      </section>
      <section className="talkly-ai-teaser-features" aria-labelledby="talkly-ai-features-title">
        <span className="talkly-ai-teaser-kicker">WHY TALKLY AI</span>
        <h2 id="talkly-ai-features-title">자유롭게 이야기하고, 배운 영어는 오래 남도록.</h2>
        <div className="talkly-ai-teaser-grid">
          {features.map(feature => <article key={feature.number}>
            <span>{feature.number} / {feature.subtitle}</span>
            <h3>{feature.title}</h3>
            <p>{feature.detail}</p>
          </article>)}
        </div>
      </section>
      <footer className="talkly-ai-teaser-footer">
        <div className="talkly-ai-teaser-footer-brand">TALKLY <span>AI</span></div>
        <p>운영사업자: 토클리 Talkly　|　대표자: 박선희　|　사업자등록번호: 617-28-89258</p>
        <p>통신판매업 신고번호: 제2010-부산남구-221호　|　주소: 부산광역시 남구 용호로216번길 8</p>
        <p>개인정보보호책임자: 박선희　|　<Link href="/">TALKLY 홈</Link></p>
        <p>© 2026 TALKLY. All rights reserved.</p>
      </footer>
    </div>
  </main>;
}
