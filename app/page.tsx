import Image from "next/image";
import Link from "next/link";
import HomeAuthMenu from "@/components/HomeAuthMenu";
import HomeEnrollActions from "@/components/HomeEnrollActions";
import HomeTeachers from "@/components/HomeTeachers";
import HomeClassMenu from "@/components/HomeClassMenu";

const reasons = [
  {
    en: "Verified Tutors",
    ko: "철저히 검증된 강사진",
    text: "정확한 발음, 풍부한 어휘력, 티칭 스킬까지 검증된 강사진과 함께합니다.",
  },
  {
    en: "1:1 Correction",
    ko: "세심하고 디테일한 1:1 교정",
    text: "단순한 대화에 그치지 않고 발음·표현·어휘를 수업 중 세심하게 교정합니다.",
  },
  {
    en: "Smart Management",
    ko: "수강생 맞춤형 지속 관리",
    text: "출결, 회차별 평가, 숙제와 강사 코멘트를 누적해 학습의 흐름을 계속 관리합니다.",
  },
  {
    en: "TALKLY AI",
    ko: "AI 밀착 피드백",
    text: "수업 녹음과 발화를 분석해 문법·어휘·표현·유창성 리포트와 다음 학습 방향을 제공합니다.",
  },
];

const aiCards = [
  {
    title: "AI Lesson Report",
    text: "수업 발화를 분석해 문법·어휘·표현·유창성의 반복 오류와 추천 표현을 정리합니다.",
  },
  {
    title: "AI Growth Report",
    text: "여러 회차의 학습 데이터를 누적해 학생의 변화와 성장 흐름을 한눈에 보여줍니다.",
  },
  {
    title: "AI Writing",
    text: "영작 원문을 문법·어휘·문장구조·자연스러운 표현 기준으로 첨삭하고 이유까지 설명합니다.",
  },
  {
    title: "AI Class Brief",
    text: "강사가 다음 수업 전 최근 오류와 강점, 추천 질문을 확인할 수 있도록 수업 브리핑을 제공합니다.",
  },
];

const programs = [
  {
    no: "01",
    title: "화상영어 라이브 멘토링",
    subtitle: "화면 너머 만나는 나만의 1:1 영어 메이트",
    text: "검증된 강사진의 실시간 교정과 TALKLY 학습관리 시스템으로 꾸준한 영어 말하기 습관을 만듭니다.",
    href: "/level-test",
  },
  {
    no: "02",
    title: "레벨별 커리큘럼 · 교재",
    subtitle: "현재 수준과 목표에 맞춘 단계별 학습",
    text: "Pre-Beginner부터 Advanced까지 레벨별 교육목표와 교재를 연결해 학습 방향을 명확하게 제시합니다.",
    href: "/curriculum",
  },
  {
    no: "03",
    title: "AI 밀착 학습관리",
    subtitle: "수업이 끝난 뒤에도 계속되는 피드백",
    text: "Teacher Evaluation과 AI 분석을 분리해 제공하고, 학부모·학생·강사에게 필요한 정보를 각각 보여줍니다.",
    href: "#ai",
  },
];


const businessAreas = [
  {
    no: "02",
    title: "지자체·기관 영어 지원 사업",
    subtitle: "지역 사회와 함께 성장하는 공공 영어 솔루션",
    text: "지자체 및 교육청과 협력하여 지역 학생과 주민들에게 고품질 화상영어 및 검증된 영어 교육 콘텐츠를 지원합니다.",
    tags: ["#공공협력", "#지자체사업", "#교육격차해소"],
    accent: "#f5a623",
    iconBackground: "#fef1dc",
    icon: "▥",
  },
  {
    no: "03",
    title: "영유아 오감 자극 교육",
    subtitle: "소리·촉감·놀이로 시작하는 첫 영어 생태계",
    text: "감각을 자극하는 스토리텔링과 오감 중심 커리큘럼으로 아이가 모국어처럼 자연스럽고 친근하게 영어를 받아들이도록 돕습니다.",
    tags: ["#영유아맞춤", "#오감자극", "#놀이중심"],
    accent: "#20b6a0",
    iconBackground: "#e4f7f3",
    icon: "◉",
  },
  {
    no: "04",
    title: "영어 체험 행사 & 페스티벌",
    subtitle: "온 가족이 함께 즐기고 소통하는 영어 축제",
    text: "오프라인 체험 부스, 미션 이벤트, 문화 축제를 통해 학습한 영어를 마음껏 표현하고 즐기는 살아있는 소통의 장을 만듭니다.",
    tags: ["#영어축제", "#체험부스", "#가족참여"],
    accent: "#7c5ce0",
    iconBackground: "#efeafb",
    icon: "△",
  },
  {
    no: "05",
    title: "창의 영어 캠프 & 아웃도어",
    subtitle: "자연 속에서 온몸으로 체득하는 액티비티 영어",
    text: "트레킹, 캠핑, 미션 수행 등 다채로운 야외 활동과 창의적 프로젝트를 통해 영어를 언어가 아닌 '경험'으로 체득합니다.",
    tags: ["#창의체험", "#아웃도어", "#몰입형캠프"],
    accent: "#4c9a4e",
    iconBackground: "#e7f3e4",
    icon: "⌁",
  },
];

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fafaf7",
        color: "#1b2a4a",
      }}
    >
      <div
        className="talkly-utility"
        style={{
          background: "#16213e",
          color: "#cfd8ee",
          fontSize: "12px",
        }}
      >
        <div
          style={{
            width: "min(1200px, calc(100% - 36px))",
            minHeight: "36px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "18px",
          }}
        >
          <Link href="/level-test" style={utilityLinkStyle}>
            레벨테스트신청
          </Link>
          <span style={{ opacity: 0.25 }}>|</span>
          <a href="/enroll" style={utilityLinkStyle}>
            수강신청
          </a>
          <span style={{ opacity: 0.25 }}>|</span>
          <Link href="/consultation" style={utilityLinkStyle}>
            1:1상담
          </Link>
        </div>
      </div>

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(255,255,255,0.94)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #e7e9f0",
        }}
      >
        <div
          className="talkly-main-header"
          style={{
            width: "min(1200px, calc(100% - 36px))",
            minHeight: "82px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "260px 1fr auto",
            alignItems: "center",
            gap: "24px",
          }}
        >
          <Link
            href="/"
            aria-label="TALKLY 홈"
            style={{
              display: "inline-flex",
              alignItems: "center",
              width: "fit-content",
            }}
          >
            <Image
              src="/talkly-logo.png"
              alt="TALKLY"
              width={320}
              height={110}
              priority
              style={{
                width: "auto",
                height: "82px",
                objectFit: "contain",
              }}
            />
          </Link>

          <nav
            className="talkly-desktop-nav"
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "5px",
              fontSize: "14px",
              fontWeight: 800,
            }}
          >
            <div className="talkly-nav-item">
              <a href="#greeting" className="talkly-nav-link">
                토클리소개 ▾
              </a>
              <div className="talkly-dropdown">
                <a href="#greeting">인사말</a>
                <a href="#why">Why TALKLY?</a>
                <a href="#programs">프로그램</a>
                <a href="#business-areas">사업영역</a>
              </div>
            </div>

            <div className="talkly-nav-item">
              <a href="#programs" className="talkly-nav-link">
                교육센터 ▾
              </a>
              <div className="talkly-dropdown">
                <a href="#programs">프로그램소개</a>
                <Link href="/curriculum">커리큘럼/교재</Link>
                <a href="#teachers">교사소개</a>
              </div>
            </div>

            <div className="talkly-nav-item">
              <a href="#ai" className="talkly-nav-link">
                TALKLY AI ▾
              </a>
              <div className="talkly-dropdown">
                <a href="#ai">AI 수업리포트</a>
                <a href="#ai">AI 성장리포트</a>
                <a href="#ai">AI Writing</a>
                <a href="#ai">강사 AI Brief</a>
              </div>
            </div>

            <Link href="/level-test" className="talkly-nav-link">
              레벨테스트
            </Link>

            <div className="talkly-nav-item">
              <a href="/enroll" className="talkly-nav-link">
                수강신청 ▾
              </a>
              <div className="talkly-dropdown">
                <Link href="/enroll">수강신청</Link>
                <HomeClassMenu />
              </div>
            </div>

            <div className="talkly-nav-item">
              <a href="#information" className="talkly-nav-link">
                인포메이션 ▾
              </a>
              <div className="talkly-dropdown">
                <Link href="/notice">공지사항</Link>
                <a href="#reviews">수업후기</a>
                <Link href="/consultation">1:1상담</Link>
              </div>
            </div>
          </nav>

          <HomeAuthMenu />
        </div>
      </header>

      <section
        style={{
          position: "relative",
          minHeight: "720px",
          display: "flex",
          alignItems: "flex-end",
          overflow: "hidden",
          backgroundImage: `
            linear-gradient(
              180deg,
              rgba(16,25,50,.14) 0%,
              rgba(15,22,46,.28) 42%,
              rgba(10,16,36,.82) 100%
            ),
            url("/talkly-hero-conversation.png")
          `,
          backgroundSize: "cover",
          backgroundPosition: "center 42%",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(8,20,48,.72) 0%, rgba(8,20,48,.36) 55%, rgba(8,20,48,.12) 100%)",
          }}
        />

        <div
          className="talkly-hero-copy"
          style={{
            width: "min(1200px, calc(100% - 36px))",
            margin: "0 auto",
            padding: "120px 0 72px",
            position: "relative",
            zIndex: 2,
          }}
        >
          <h1
            style={{
              margin: "0",
              maxWidth: "860px",
              color: "#ffffff",
              fontSize: "clamp(44px, 5vw, 64px)",
              lineHeight: 1.22,
              letterSpacing: "-0.045em",
              fontWeight: 900,
              textShadow:
                "0 2px 10px rgba(0,0,0,.35), 0 8px 30px rgba(0,0,0,.3)",
            }}
          >
            Anytime, Anywhere,
            <br />
            <span style={{ color: "#7fe0cf" }}>
              AI Real English
            </span>{" "}
            - {" "}
            <span style={{ color: "#8fb4ff" }}>
              TALKLY
            </span>
          </h1>

          <p
            style={{
              margin: "22px 0 0",
              maxWidth: "680px",
              color: "#f1f3fa",
              fontSize: "16px",
              lineHeight: 1.82,
              textShadow: "0 2px 8px rgba(0,0,0,.35)",
            }}
          >
            세상은 이미 온라인과 AI로 연결되어 있습니다. 어린이부터
            성인까지 실시간으로 원어민 강사와 즐겁게 영어를 배워요!
          </p>

          <div
            style={{
              marginTop: "30px",
              display: "flex",
              gap: "11px",
              flexWrap: "wrap",
            }}
          >
            <Link href="/level-test" className="talkly-hero-primary">
              무료 레벨테스트 신청
            </Link>
            <Link href="/login" className="talkly-hero-live">
              <span className="talkly-live-dot" />
              강의실 바로 입장
            </Link>
            <a href="#programs" className="talkly-hero-ghost">
              화상영어 자세히 보기
            </a>
          </div>

          <div
            className="talkly-age-strip"
            style={{
              marginTop: "34px",
              maxWidth: "650px",
              paddingTop: "24px",
              borderTop: "1px solid rgba(255,255,255,.22)",
              display: "flex",
              gap: "20px",
              flexWrap: "wrap",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            <span>👶 영유아</span>
            <span>🎒 초중등</span>
            <span>💼 성인</span>
            <span>🌿 시니어</span>
          </div>
        </div>
      </section>

      <section
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e7e9f0",
        }}
      >
        <div
          className="talkly-trust-grid"
          style={{
            width: "min(1200px, calc(100% - 36px))",
            minHeight: "116px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0,1fr))",
            alignItems: "center",
          }}
        >
          {[
            ["누구나", "영어를 원하는 사람이라면 누구나"],
            ["언제든", "원하는 시간대에 자유롭게 수업"],
            ["1:1", "맞춤 화상영어 수업"],
            ["AI+", "수업 분석과 성장 데이터 연결"],
          ].map(([num, text]) => (
            <div key={num} style={{ textAlign: "center", padding: "20px" }}>
              <div
                style={{
                  color: "#1b2a4a",
                  fontSize: "26px",
                  fontWeight: 900,
                }}
              >
                {num}
              </div>
              <div
                style={{
                  marginTop: "5px",
                  color: "#697386",
                  fontSize: "12px",
                }}
              >
                {text}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="greeting" style={{ background: "#ffffff", padding: "92px 0" }}>
        <div
          className="talkly-greeting"
          style={{
            width: "min(1200px, calc(100% - 36px))",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1.15fr .85fr",
            gap: "58px",
            alignItems: "center",
          }}
        >
          <div>
            <div className="talkly-sec-tag">
              토클리소개 · 인사말
            </div>

            <blockquote
              style={{
                margin: "16px 0 0",
                paddingLeft: "21px",
                borderLeft: "4px solid #2f6fed",
                color: "#1b2a4a",
                fontSize: "25px",
                lineHeight: 1.55,
                fontWeight: 900,
              }}
            >
              “꾸준히 말하는 것보다 빠른 영어 회화 완성법은 없습니다.”
            </blockquote>

            <p
              style={{
                margin: "14px 0 0",
                color: "#697386",
                fontSize: "15px",
              }}
            >
              영어 선생님과 대화하며 자연스럽게 영어를 일상으로
              만들어보세요.
            </p>

            <h2
              style={{
                margin: "38px 0 0",
                color: "#1b2a4a",
                fontSize: "28px",
                letterSpacing: "-0.035em",
              }}
            >
              왜 ‘토클리(TALKLY)’를 선택해야 할까요?
            </h2>

            <div
              id="why"
              className="talkly-reason-grid"
              style={{
                marginTop: "24px",
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0,1fr))",
                gap: "22px",
              }}
            >
              {reasons.map((item) => (
                <div key={item.en}>
                  <div
                    style={{
                      color: "#2f6fed",
                      fontSize: "11px",
                      fontWeight: 900,
                      letterSpacing: ".06em",
                    }}
                  >
                    {item.en}
                  </div>
                  <h3
                    style={{
                      margin: "7px 0 0",
                      color: "#1b2a4a",
                      fontSize: "16px",
                    }}
                  >
                    {item.ko}
                  </h3>
                  <p
                    style={{
                      margin: "8px 0 0",
                      color: "#697386",
                      fontSize: "13px",
                      lineHeight: 1.75,
                    }}
                  >
                    {item.text}
                  </p>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: "32px",
                paddingTop: "26px",
                borderTop: "1px solid #e7e9f0",
                color: "#1b2a4a",
                fontSize: "14px",
                lineHeight: 1.85,
              }}
            >
              <strong>부담 없이 시작하는 검증된 화상영어, 토클리.</strong>
              <br />
              수업부터 AI 학습 피드백까지, 영어 자신감의 변화를
              함께 만들어갑니다.
            </div>
          </div>

          <div
            style={{
              minHeight: "610px",
              borderRadius: "24px",
              overflow: "hidden",
              position: "relative",
              boxShadow: "0 24px 50px -18px rgba(20,30,60,.25)",
            }}
          >
            <Image
              src="/talkly-greeting-online-class.png"
              alt="원어민 강사와 학생이 온라인 화상영어 수업을 하는 모습"
              fill
              sizes="(max-width: 900px) 100vw, 42vw"
              style={{
                objectFit: "cover",
                objectPosition: "62% center",
              }}
            />
          </div>
        </div>
      </section>

      <section id="programs" style={{ background: "#fafaf7", padding: "92px 0" }}>
        <div
          style={{
            width: "min(1200px, calc(100% - 36px))",
            margin: "0 auto",
          }}
        >
          <SectionHead
            tag="Programs"
            title="화상영어를 중심으로 이어지는 TALKLY 학습 시스템"
          />

          <div
            className="talkly-program-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0,1fr))",
              gap: "20px",
            }}
          >
            {programs.map((item) => (
              <article
                key={item.no}
                style={{
                  padding: "30px 26px",
                  borderRadius: "20px",
                  border: "1px solid #e7e9f0",
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    color: "#2f6fed",
                    fontSize: "12px",
                    fontWeight: 900,
                  }}
                >
                  {item.no}
                </div>
                <h3
                  style={{
                    margin: "14px 0 0",
                    color: "#1b2a4a",
                    fontSize: "21px",
                  }}
                >
                  {item.title}
                </h3>
                <div
                  style={{
                    marginTop: "8px",
                    color: "#20b6a0",
                    fontSize: "13px",
                    fontWeight: 800,
                  }}
                >
                  {item.subtitle}
                </div>
                <p
                  style={{
                    margin: "13px 0 0",
                    color: "#697386",
                    fontSize: "13.5px",
                    lineHeight: 1.75,
                  }}
                >
                  {item.text}
                </p>
                {item.href.startsWith("/") ? (
                  <Link href={item.href} className="talkly-card-link">
                    자세히 보기 →
                  </Link>
                ) : (
                  <a href={item.href} className="talkly-card-link">
                    자세히 보기 →
                  </a>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="ai"
        style={{
          background:
            "linear-gradient(135deg, #16213e 0%, #213d73 66%, #2f6fed 100%)",
          color: "#ffffff",
          padding: "96px 0",
        }}
      >
        <div
          style={{
            width: "min(1200px, calc(100% - 36px))",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              color: "#7fe0cf",
              fontSize: "13px",
              fontWeight: 900,
              letterSpacing: "1.6px",
              textTransform: "uppercase",
            }}
          >
            TALKLY AI Learning Care
          </div>

          <h2
            style={{
              margin: "12px 0 0",
              maxWidth: "760px",
              fontSize: "clamp(34px, 4vw, 48px)",
              lineHeight: 1.35,
              letterSpacing: "-0.045em",
            }}
          >
            수업이 끝나는 순간,
            <br />
            AI 피드백은 시작됩니다.
          </h2>

          <div
            className="talkly-ai-grid"
            style={{
              marginTop: "38px",
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0,1fr))",
              gap: "16px",
            }}
          >
            {aiCards.map((item) => (
              <article
                key={item.title}
                style={{
                  minHeight: "220px",
                  padding: "24px",
                  borderRadius: "18px",
                  border: "1px solid rgba(255,255,255,.16)",
                  background: "rgba(255,255,255,.08)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "12px",
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(143,180,255,.16)",
                    color: "#8fb4ff",
                    fontWeight: 900,
                  }}
                >
                  AI
                </div>

                <h3
                  style={{
                    margin: "18px 0 0",
                    fontSize: "18px",
                  }}
                >
                  {item.title}
                </h3>

                <p
                  style={{
                    margin: "11px 0 0",
                    color: "#c6cde3",
                    fontSize: "13px",
                    lineHeight: 1.75,
                  }}
                >
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="level-test" style={{ background: "#ffffff", padding: "92px 0" }}>
        <div
          className="talkly-cta-box"
          style={{
            width: "min(1120px, calc(100% - 36px))",
            margin: "0 auto",
            borderRadius: "26px",
            padding: "50px 54px",
            background:
              "linear-gradient(120deg, #eaf1ff, #e4f7f3)",
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "center",
            gap: "30px",
          }}
        >
          <div>
            <div
              style={{
                color: "#2f6fed",
                fontSize: "12px",
                fontWeight: 900,
              }}
            >
              LEVEL TEST
            </div>
            <h2
              style={{
                margin: "9px 0 0",
                color: "#1b2a4a",
                fontSize: "30px",
              }}
            >
              우리 아이의 영어 수준, 먼저 확인해보세요.
            </h2>
            <p
              style={{
                margin: "12px 0 0",
                maxWidth: "650px",
                color: "#4a5268",
                fontSize: "14px",
                lineHeight: 1.75,
              }}
            >
              Grammar와 Listening을 중심으로 TALKLY AI 레벨테스트를
              진행합니다. AI 분석 후 추가 확인이 필요한 경우
              원어민 강사의 화상 레벨테스트를 별도로 안내드립니다.
            </p>
          </div>

          <Link
            href="/level-test"
            style={{
              minHeight: "50px",
              padding: "0 24px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "999px",
              background: "#1b2a4a",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 900,
              fontSize: "14px",
              whiteSpace: "nowrap",
            }}
          >
            레벨테스트 안내 →
          </Link>
        </div>
      </section>

      <section id="teachers" style={{ background: "#fafaf7", padding: "88px 0" }}>
        <div
          style={{
            width: "min(1200px, calc(100% - 36px))",
            margin: "0 auto",
          }}
        >
          <SectionHead
            tag="Our Teachers"
            title="TALKLY 강사 소개"
            description="검증된 학력과 경력을 갖춘 TALKLY 강사진이 연령과 학습 목표에 맞는 수업을 함께합니다."
          />

          <HomeTeachers />
        </div>
      </section>

      <section id="information" style={{ background: "#ffffff", padding: "88px 0" }}>
        <div
          style={{
            width: "min(1200px, calc(100% - 36px))",
            margin: "0 auto",
          }}
        >
          <SectionHead
            tag="Information"
            title="TALKLY 이용안내"
            description="공지사항과 1:1 상담을 통해 TALKLY의 주요 안내를 확인하고 필요한 문의를 편리하게 남길 수 있습니다."
          />

          <div
            className="talkly-info-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0,1fr))",
              gap: "18px",
            }}
          >
            {[
              [
                "공지사항",
                "수강 전 확인할 내용과 TALKLY의 새로운 소식을 확인합니다.",
                "/notice",
              ],
              [
                "수업후기",
                "학생과 학부모의 실제 학습 경험을 공유합니다.",
                "#reviews",
              ],
              [
                "1:1 상담",
                "수강·수업·결제·강사 및 TALKLY 이용에 관한 문의를 남깁니다.",
                "/consultation",
              ],
            ].map(([title, text, href], index) => (
              <Link
                key={title}
                href={href}
                id={index === 1 ? "reviews" : undefined}
                style={{
                  display: "block",
                  padding: "28px",
                  borderRadius: "18px",
                  border: "1px solid #e7e9f0",
                  background: "#fafaf7",
                  textDecoration: "none",
                  transition: "transform .18s ease, box-shadow .18s ease, border-color .18s ease",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    color: "#1b2a4a",
                    fontSize: "20px",
                  }}
                >
                  {title}
                </h3>
                <p
                  style={{
                    margin: "10px 0 0",
                    color: "#697386",
                    fontSize: "13.5px",
                    lineHeight: 1.75,
                  }}
                >
                  {text}
                </p>

                <div
                  style={{
                    marginTop: "18px",
                    color: "#2f6fed",
                    fontSize: "13px",
                    fontWeight: 900,
                  }}
                >
                  {title === "수업후기" ? "후기 보기 →" : "바로가기 →"}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="enroll" style={{ background: "#fafaf7", padding: "86px 0" }}>
        <div
          className="talkly-enroll"
          style={{
            width: "min(1120px, calc(100% - 36px))",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "26px",
            alignItems: "center",
          }}
        >
          <div>
            <div className="talkly-sec-tag">
              Enroll & My Class
            </div>
            <h2
              style={{
                margin: "9px 0 0",
                color: "#1b2a4a",
                fontSize: "31px",
              }}
            >
              수강신청과 내 수업관리를 TALKLY에서.
            </h2>
          </div>

          <HomeEnrollActions />
        </div>
      </section>


      <section
        id="business-areas"
        style={{
          background: "#ffffff",
          padding: "94px 0 100px",
          borderTop: "1px solid #eef0f4",
        }}
      >
        <div
          style={{
            width: "min(1200px, calc(100% - 36px))",
            margin: "0 auto",
          }}
        >
          <SectionHead
            tag="Business Areas"
            title="화상영어를 넘어, TALKLY가 만드는 영어 경험"
            description="TALKLY는 화상영어를 중심으로 공공 영어교육, 영유아 교육, 영어 체험 행사와 캠프까지 영어를 삶 속에서 경험하는 다양한 사업을 운영합니다."
          />

          <div
            className="talkly-business-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "20px",
            }}
          >
            {businessAreas.map((item) => (
              <article
                key={item.no}
                style={{
                  minHeight: "430px",
                  padding: "28px 26px",
                  border: "1px solid #e2e6ee",
                  borderRadius: "20px",
                  background: "#fffefb",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: "0 8px 30px rgba(20,30,60,.035)",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "25px",
                    right: "26px",
                    color: "#e1e6f2",
                    fontSize: "24px",
                    fontWeight: 900,
                  }}
                >
                  {item.no}
                </div>

                <div
                  style={{
                    width: "54px",
                    height: "54px",
                    borderRadius: "14px",
                    display: "grid",
                    placeItems: "center",
                    background: item.iconBackground,
                    color: item.accent,
                    fontSize: "26px",
                    fontWeight: 900,
                  }}
                >
                  {item.icon}
                </div>

                <h3
                  style={{
                    margin: "25px 0 0",
                    color: "#1b2a4a",
                    fontSize: "21px",
                    lineHeight: 1.45,
                  }}
                >
                  {item.title}
                </h3>

                <div
                  style={{
                    marginTop: "10px",
                    color: "#697386",
                    fontSize: "13px",
                    fontWeight: 800,
                    lineHeight: 1.65,
                  }}
                >
                  {item.subtitle}
                </div>

                <p
                  style={{
                    margin: "28px 0 0",
                    color: "#697386",
                    fontSize: "13.5px",
                    lineHeight: 1.8,
                  }}
                >
                  {item.text}
                </p>

                <div
                  style={{
                    marginTop: "20px",
                    display: "flex",
                    gap: "7px",
                    flexWrap: "wrap",
                  }}
                >
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        padding: "5px 10px",
                        border: "1px solid #e0e4ec",
                        borderRadius: "999px",
                        background: "#ffffff",
                        color: "#697386",
                        fontSize: "11px",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

              </article>
            ))}
          </div>
        </div>
      </section>

      <footer
        style={{
          background: "#1b2a4a",
          color: "#c6cde3",
          padding: "56px 0 24px",
        }}
      >
        <div
          style={{
            width: "min(1200px, calc(100% - 36px))",
            margin: "0 auto",
          }}
        >
          <div
            className="talkly-footer-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr repeat(4, 1fr)",
              gap: "26px",
              marginBottom: "40px",
            }}
          >
            <div>
              <Image
                src="/talkly-logo-white.png"
                alt="TALKLY"
                width={280}
                height={95}
                style={{
                  width: "auto",
                  height: "48px",
                  objectFit: "contain",
                }}
              />
              <p
                style={{
                  margin: "12px 0 0",
                  color: "#8b96b8",
                  fontSize: "13px",
                  lineHeight: 1.7,
                }}
              >
                언제 어디서나 톡.
                <br />
                전 연령을 위한 화상영어 학습 플랫폼 TALKLY.
              </p>
            </div>

            <FooterColumn
              title="토클리소개"
              items={["인사말", "Why TALKLY?", "프로그램", "사업영역"]}
            />
            <FooterColumn
              title="교육센터"
              items={["프로그램소개", "커리큘럼/교재", "교사소개"]}
            />
            <FooterColumn
              title="TALKLY AI"
              items={["AI Lesson Report", "AI Growth Report", "AI Writing"]}
            />
            <FooterColumn
              title="인포메이션"
              items={["공지사항", "수업후기", "1:1상담"]}
            />
          </div>

          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,.1)",
              paddingTop: "20px",
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
              color: "#7a84a6",
              fontSize: "12px",
            }}
          >
            <span>© 2026 TALKLY. All rights reserved.</span>
            <span>이용약관 · 개인정보처리방침 · 고객센터</span>
          </div>
        </div>
      </footer>

      <style>{`
        html {
          scroll-behavior: smooth;
        }

        .talkly-nav-item {
          position: relative;
        }

        .talkly-nav-link {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          padding: 0 13px;
          border-radius: 8px;
          color: #1b2a4a;
          text-decoration: none;
          white-space: nowrap;
        }

        .talkly-nav-link:hover {
          background: #f0f3fc;
          color: #2f6fed;
        }

        .talkly-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          min-width: 185px;
          padding: 9px;
          border: 1px solid #e7e9f0;
          border-radius: 12px;
          background: #ffffff;
          box-shadow: 0 14px 34px rgba(20,30,60,.12);
          opacity: 0;
          visibility: hidden;
          transform: translateY(6px);
          transition: .18s ease;
        }

        .talkly-nav-item:hover .talkly-dropdown {
          opacity: 1;
          visibility: visible;
          transform: translateY(3px);
        }

        .talkly-dropdown a {
          display: block;
          padding: 9px 11px;
          border-radius: 7px;
          color: #3d4560;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
        }

        .talkly-dropdown a:hover {
          background: #f0f3fc;
          color: #2f6fed;
        }

        .talkly-hero-primary,
        .talkly-hero-live,
        .talkly-hero-ghost {
          min-height: 50px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 24px;
          border-radius: 999px;
          text-decoration: none;
          font-size: 14px;
          font-weight: 900;
        }

        .talkly-hero-primary {
          background: #2f6fed;
          color: #ffffff;
          box-shadow: 0 8px 20px rgba(47,111,237,.28);
        }

        .talkly-hero-live {
          gap: 9px;
          color: #ffffff;
          border: 1.5px solid rgba(255,255,255,.5);
          background: rgba(255,255,255,.12);
          backdrop-filter: blur(4px);
        }

        .talkly-hero-ghost {
          color: #ffffff;
          border: 1.5px solid rgba(255,255,255,.5);
          background: rgba(10,16,36,.10);
        }

        .talkly-live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ff5c5c;
        }

        .talkly-sec-tag {
          color: #20b6a0;
          font-weight: 900;
          font-size: 13px;
          letter-spacing: 1.3px;
        }

        .talkly-card-link {
          display: inline-flex;
          margin-top: 20px;
          color: #2f6fed;
          text-decoration: none;
          font-size: 13px;
          font-weight: 900;
        }

        .talkly-bottom-primary,
        .talkly-bottom-ghost {
          min-height: 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 20px;
          border-radius: 999px;
          text-decoration: none;
          font-size: 13px;
          font-weight: 900;
        }

        .talkly-bottom-primary {
          background: #2f6fed;
          color: #ffffff;
        }

        .talkly-bottom-ghost {
          border: 1px solid #dfe3ec;
          background: #ffffff;
          color: #1b2a4a;
        }

        @media (max-width: 1040px) {
          .talkly-main-header {
            grid-template-columns: 190px 1fr auto !important;
          }

          .talkly-desktop-nav {
            display: none !important;
          }

          .talkly-greeting {
            grid-template-columns: 1fr !important;
          }

          .talkly-program-grid,
          .talkly-ai-grid,
          .talkly-business-grid {
            grid-template-columns: repeat(2, minmax(0,1fr)) !important;
          }

          .talkly-footer-grid {
            grid-template-columns: repeat(2, minmax(0,1fr)) !important;
          }
        }

        @media (max-width: 680px) {
          .talkly-utility {
            display: none !important;
          }

          .talkly-main-header {
            grid-template-columns: 1fr auto !important;
          }

          .talkly-main-header img {
            height: 46px !important;
          }

          .talkly-hero-copy {
            padding-top: 90px !important;
          }

          .talkly-age-strip {
            gap: 12px !important;
          }

          .talkly-trust-grid,
          .talkly-reason-grid,
          .talkly-program-grid,
          .talkly-ai-grid,
          .talkly-info-grid,
          .talkly-business-grid {
            grid-template-columns: 1fr !important;
          }

          .talkly-cta-box,
          .talkly-enroll {
            grid-template-columns: 1fr !important;
            padding-left: 24px !important;
            padding-right: 24px !important;
          }

          .talkly-footer-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

function SectionHead({
  tag,
  title,
  description,
}: {
  tag: string;
  title: string;
  description?: string;
}) {
  return (
    <div
      style={{
        maxWidth: "680px",
        margin: "0 auto 42px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          color: "#20b6a0",
          fontSize: "13px",
          fontWeight: 900,
          letterSpacing: "1.5px",
          textTransform: "uppercase",
        }}
      >
        {tag}
      </div>
      <h2
        style={{
          margin: "11px 0 0",
          color: "#1b2a4a",
          fontSize: "34px",
          lineHeight: 1.4,
          letterSpacing: "-0.04em",
        }}
      >
        {title}
      </h2>
      {description ? (
        <p
          style={{
            margin: "13px 0 0",
            color: "#697386",
            fontSize: "14px",
            lineHeight: 1.75,
          }}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

function FooterColumn({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div>
      <h5
        style={{
          margin: 0,
          color: "#ffffff",
          fontSize: "13px",
        }}
      >
        {title}
      </h5>
      <div
        style={{
          marginTop: "13px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          color: "#9aa4c4",
          fontSize: "12.5px",
        }}
      >
        {items.map((item) => {
          if (title === "인포메이션") {
            if (item === "공지사항") {
              return (
                <Link
                  key={item}
                  href="/notice"
                  style={footerLinkStyle}
                >
                  {item}
                </Link>
              );
            }

            if (item === "1:1상담") {
              return (
                <Link
                  key={item}
                  href="/consultation"
                  style={footerLinkStyle}
                >
                  {item}
                </Link>
              );
            }

            if (item === "수업후기") {
              return (
                <a
                  key={item}
                  href="#reviews"
                  style={footerLinkStyle}
                >
                  {item}
                </a>
              );
            }
          }

          if (title === "토클리소개") {
            const introLinks: Record<string, string> = {
              인사말: "#greeting",
              "Why TALKLY?": "#why",
              프로그램: "#programs",
              사업영역: "#business-areas",
            };

            if (introLinks[item]) {
              return (
                <a key={item} href={introLinks[item]} style={footerLinkStyle}>
                  {item}
                </a>
              );
            }
          }

          return <span key={item}>{item}</span>;
        })}
      </div>
    </div>
  );
}

const footerLinkStyle = {
  color: "inherit",
  textDecoration: "none",
};

const utilityLinkStyle = {
  color: "inherit",
  textDecoration: "none",
  opacity: 0.88,
};