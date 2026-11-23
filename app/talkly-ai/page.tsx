import Link from "next/link";
import AiStudio from "./AiStudio";

export const metadata = {
  title: "TALKLY AI | 나의 생각이 영어가 되는 시간",
  description: "AI와 자유롭게 영어로 대화하고, 실생활 문법과 문장을 정리해 하루의 수업을 PDF로 저장하세요.",
};

const benefits = [
  { no: "01", icon: "◎", en: "REAL CONVERSATION", title: "내 얘기로 시작하는 영어", description: "정해진 교재 대신 오늘 있었던 일, 관심사, 공부와 일상을 자연스럽게 이야기하세요." },
  { no: "02", icon: "Aa", en: "CONVERSATION NOTES", title: "말한 문장이 눈앞에", description: "나와 AI가 말한 영어를 자막으로 확인하고, 필요하면 자막을 잠시 숨길 수도 있어요." },
  { no: "03", icon: "✦", en: "YOUR DAILY REVIEW", title: "문법 정리부터 PDF까지", description: "수업 뒤 실제 말한 문장에서 생활 문법을 배우고, 오늘 대화를 PDF로 보관하세요." },
];
const steps = [
  { no: "01", title: "나와 맞는 AI 튜터 선택", description: "활기찬·지적인·차분한 대화 스타일의 AI 튜터 6명 중 선택" },
  { no: "02", title: "오늘 하고 싶은 이야기를 자유롭게", description: "말을 서두르지 않고 듣고 대화하며, 자막은 선택적으로 표시" },
  { no: "03", title: "오늘의 영어를 내 것으로", description: "문장·생활 문법 확인, PDF 수업 기록 저장 및 복습" },
];

export default function TalklyAiPage() {
  return (
    <main className="tai tai-landing">
      <header className="tai-nav tai-nav-rich">
        <div className="tai-brand-group">
          <Link href="/talkly-ai" className="tai-wordmark" aria-label="TALKLY AI 홈">
            TALKLY <span>AI</span>
          </Link>
          <span className="tai-brand-note">ENGLISH CONVERSATION</span>
        </div>
        <nav aria-label="페이지 안내" className="tai-landing-nav">
          <a href="#tai-benefits">서비스 특징</a>
          <a href="#tai-how">이용 방법</a>
          <a href="#tai-studio">AI 회화 시작</a>
        </nav>
        <Link href="/" className="tai-home-link">토클리 홈 ↗</Link>
      </header>

      {process.env.TALKLY_AI_TEST_MODE === "true" &&
        process.env.VERCEL_ENV === "preview" && (
          <p className="tai-guide tai-test-notice">
            테스트 배포 · 유료 결제는 비활성화되어 있어요. AI 가입 후 3분 무료
            체험이 제공되며, 관리자는 추가 검증용 이용권을 활성화할 수 있어요.
          </p>
        )}

      <section className="tai-intro tai-ai-hero" aria-labelledby="tai-hero-title">
        <div className="tai-intro-copy tai-ai-hero-copy">
          <span className="tai-hero-overline"><i aria-hidden="true" /> YOUR ENGLISH, YOUR PACE</span>
          <p className="tai-kicker">A LITTLE ENGLISH, EVERY DAY</p>
          <h1 id="tai-hero-title">
            천천히 생각하고,
            <br />
            <span>나의 영어로 이야기해요.</span>
          </h1>
          <p className="tai-hero-description">
            오늘 무슨 일이 있었는지, 어떤 생각을 하고 있는지 편하게 말해 보세요.
            AI는 기다려 주고, 대화가 끝나면 문장과 생활 문법이 나만의 복습 노트가 돼요.
          </p>
          <div className="tai-hero-actions">
            <a className="tai-button tai-hero-cta" href="#tai-studio">AI 튜터와 대화 시작하기 <span aria-hidden="true">↗</span></a>
            <a className="tai-hero-secondary" href="#tai-benefits">어떤 방식으로 배우나요? <span aria-hidden="true">↓</span></a>
          </div>
          <div className="tai-features tai-hero-tags" aria-label="AI 회화의 특징">
            <span>3가지 성격의 AI 튜터 6명</span>
            <span>말한 문장 자막</span>
            <span>생활 문법 정리</span>
            <span>수업 PDF 저장</span>
          </div>
          <p className="tai-hero-smallprint">가입 시 3분 무료 체험 · 성인 이용 기준 적용 · 유료 결제는 별도 안내</p>
        </div>

        <div className="tai-hero-visual" aria-label="AI 영어회화의 대화 및 문법 복습 화면 구성 예시">
          <div className="tai-visual-halo tai-visual-halo-one" aria-hidden="true" />
          <div className="tai-visual-halo tai-visual-halo-two" aria-hidden="true" />
          <div className="tai-mock-window">
            <div className="tai-mock-heading">
              <span className="tai-mock-avatar" aria-hidden="true">AI</span>
              <div><strong>Your conversation partner</strong><small>FREE CONVERSATION · SAMPLE</small></div>
              <span className="tai-mock-live">● AI Tutor</span>
            </div>
            <div className="tai-mock-content">
              <div className="tai-mock-bubble is-tutor">
                <small>AI TUTOR</small>
                <p>How was your day today?</p>
              </div>
              <div className="tai-mock-bubble is-student">
                <small>YOU</small>
                <p>I go to work yesterday.</p>
              </div>
              <div className="tai-mock-note">
                <span>✦ &nbsp; REAL-LIFE GRAMMAR</span>
                <strong>I went to work yesterday.</strong>
                <p>어제 일어난 일에는 과거형 <b>went</b>를 사용해요.</p>
              </div>
            </div>
            <div className="tai-mock-foot"><span className="tai-mock-microphone" aria-hidden="true">♪</span><span>Speak naturally. Learn from every sentence.</span><span className="tai-mock-wave" aria-hidden="true">▂▄▆▄▂▅</span></div>
          </div>
          <div className="tai-mock-floating"><span aria-hidden="true">⇩</span> 오늘의 학습 노트를 PDF로</div>
          <p className="tai-mock-disclaimer">* 기능을 설명하기 위한 화면 예시이며, 실제 수업 기록이 아닙니다.</p>
        </div>
      </section>

      <section id="tai-benefits" className="tai-landing-section tai-benefit-section">
        <div className="tai-section-heading">
          <span>WHY TALKLY AI</span>
          <h2>자유롭게 말하고,<br /><em>배운 영어는 오래 남도록.</em></h2>
          <p>토클리의 체계적인 학습 경험을 AI 자유회화에 맞게 담았어요.</p>
        </div>
        <div className="tai-benefit-grid">
          {benefits.map((benefit) => <article key={benefit.no} className="tai-benefit-card">
            <div className="tai-benefit-top"><span className="tai-benefit-icon">{benefit.icon}</span><small>{benefit.no}</small></div>
            <span className="tai-benefit-en">{benefit.en}</span>
            <h3>{benefit.title}</h3>
            <p>{benefit.description}</p>
          </article>)}
        </div>
      </section>

      <section id="tai-how" className="tai-landing-section tai-how-section">
        <div className="tai-section-heading">
          <span>HOW IT WORKS</span>
          <h2>어려운 준비 없이,<br /><em>나답게 이야기해요.</em></h2>
        </div>
        <div className="tai-step-grid">
          {steps.map((step) => <article key={step.no}>
            <span>{step.no}</span><h3>{step.title}</h3><p>{step.description}</p>
          </article>)}
        </div>
        <div className="tai-price-strip">
          <div><span>THE DAILY PLAN</span><strong>하루 10분의 영어 습관</strong><small>30일 이용권 · 자동결제 없음 · 한국시간 자정 초기화 · 남은 시간 이월 없음</small></div>
          <div className="tai-price-action"><strong>13,900<small>원</small></strong><a href="#tai-studio">회화 시작하기 ↗</a></div>
        </div>
      </section>

      <section className="tai-landing-studio" id="tai-studio">
        <div className="tai-section-heading">
          <span>YOUR PERSONAL AI TUTOR</span>
          <h2>지금, 오늘의 영어를 시작해요.</h2>
          <p>선호하는 대화 스타일을 선택하고 직접 이야기를 시작하세요. 마이크와 사용 시간은 아래에서 확인할 수 있어요.</p>
        </div>
        {process.env.TALKLY_AI_ENABLED === "true" ? <AiStudio /> :
          <section className="tai-card">
            <h2>곧 만나요.</h2>
            <p>회화 연결과 결제 기능을 점검하고 있어요. 준비가 끝나면 이곳에서 시작할 수 있어요.</p>
          </section>}
      </section>

      <footer className="tai-footer tai-landing-footer">
        <div className="tai-footer-brand">TALKLY <span>AI</span><p>Speak naturally. Grow every day.</p></div>
        <p>실제 사람이 아닌 AI 튜터예요. 발화 전사와 AI 문법 교정은 부정확할 수 있으며, 정식 서비스 출시 전 실제 이용 환경 검증이 필요합니다.</p>
        <p><Link href="/talkly-ai/privacy">AI 정보 처리 안내</Link> · <Link href="/talkly-ai/terms">AI 이용 안내</Link> · <Link href="/">TALKLY 화상영어</Link></p>
      </footer>
    </main>
  );
}
