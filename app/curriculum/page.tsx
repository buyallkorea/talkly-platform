import Image from "next/image";
import Link from "next/link";
import HomeAuthMenu from "@/components/HomeAuthMenu";

const levels = [
  {
    code: "LEVEL 1",
    name: "Pre-Beginner",
    age: "유아",
    duration: "9~12개월",
    summary: "영어의 소리와 문자에 친숙해지는 첫 단계",
    goals: [
      "알파벳 학습",
      "그림 + 단어 학습",
      "파닉스 + 기초 발음 학습",
      "활동 · 게임 · 퀴즈를 통한 영어 감각 훈련",
    ],
  },
  {
    code: "LEVEL 2",
    name: "Beginner",
    age: "초등 1~2학년",
    duration: "9~12개월",
    summary: "기초 어휘를 바탕으로 읽기와 말하기를 시작하는 단계",
    goals: [
      "기초 어휘 학습",
      "문장 중심 읽기 + 말하기 훈련",
    ],
  },
  {
    code: "LEVEL 3",
    name: "High Beginner",
    age: "초등 3~4학년",
    duration: "6개월",
    summary: "기초 문법을 실제 의사소통에 적용하는 단계",
    goals: [
      "기초 어휘 + 문법 적용 의사소통 훈련",
      "실용 회화 훈련",
    ],
  },
  {
    code: "LEVEL 4",
    name: "Pre-Intermediate",
    age: "초등 5학년~중등",
    duration: "6개월",
    summary: "다양한 문장 패턴으로 말하고 쓰는 힘을 키우는 단계",
    goals: [
      "새로운 어휘 + 세련된 문장 패턴 훈련",
      "말하기 + 쓰기 훈련",
    ],
  },
  {
    code: "LEVEL 5",
    name: "Intermediate",
    age: "중등",
    duration: "2년",
    summary: "문법·독해·의사소통을 균형 있게 확장하는 단계",
    goals: [
      "중급 문법과 장문 독해 강화",
      "의사소통 범위 확대",
      "확장된 복합문 패턴 학습",
      "심화된 어휘 · 문법 학습",
      "중등 영어과정 연계",
    ],
  },
  {
    code: "LEVEL 6",
    name: "High-Intermediate",
    age: "고등",
    duration: "1년 6개월~2년",
    summary: "고급 독해와 정교한 표현 능력을 완성하는 단계",
    goals: [
      "독해력 반복 훈련",
      "고급 수준 말하기와 쓰기",
      "중등과정의 심화 · 확장",
      "정교하고 세분화된 표현 훈련",
    ],
  },
  {
    code: "LEVEL 7",
    name: "Advanced",
    age: "성인",
    duration: "1년",
    summary: "토론과 작문을 통해 논리적이고 유창한 표현을 완성하는 단계",
    goals: [
      "토론 과정",
      "종합적이고 실용적인 작문 단계",
      "토론형 수업에서 새로운 어휘와 표현 학습",
      "주제에 대한 생각 공유를 통한 말하기 기술 향상",
      "특정 주제에 대한 자신의 주장과 근거 구성",
      "확실한 논리로 유창하게 의사 표현",
    ],
  },
];

const textbookGroups = [
  {
    label: "PHONICS & BEGINNER",
    title: "파닉스 · 입문",
    description: "알파벳과 소리, 기초 단어와 문장을 자연스럽게 익히는 교재",
    books: [
      { name: "Smart Phonics", image: "/textbooks/smart-phonics.png" },
      { name: "Phonics Monster", image: "/textbooks/phonics-monster.png" },
      { name: "Let's Go Begin", image: "/textbooks/lets-go-begin.png" },
      { name: "Let's Go", image: "/textbooks/lets-go.png" },
    ],
  },
  {
    label: "SPEAKING",
    title: "회화 · 스피킹",
    description: "실제 대화 상황과 다양한 주제를 중심으로 말하기 자신감을 키우는 교재",
    books: [
      { name: "Hi Five", image: "/textbooks/hi-five.png" },
      { name: "Super Star", image: "/textbooks/super-star.png" },
      { name: "Everybody Up", image: "/textbooks/everybody-up.png" },
      { name: "Speak Up", image: "/textbooks/speak-up.png" },
    ],
  },
  {
    label: "READING",
    title: "리딩 · 표현 확장",
    description: "읽기 이해력과 어휘, 표현을 단계적으로 확장하는 교재",
    books: [
      { name: "The Best Reading", image: "/textbooks/the-best-reading.png" },
      { name: "Wonderful World", image: "/textbooks/wonderful-world.png" },
      { name: "Can You Believe It?", image: "/textbooks/can-you-believe-it.png" },
    ],
  },
  {
    label: "INTERMEDIATE & ADVANCED",
    title: "중급 · 고급 회화",
    description: "복합 문장, 실용 회화와 고급 의사소통으로 이어지는 교재",
    books: [
      { name: "Side by Side", image: "/textbooks/side-by-side.png" },
      { name: "Interchange", image: "/textbooks/interchange.png" },
    ],
  },
];

export default function CurriculumPage() {
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
          <Link href="/enroll" style={utilityLinkStyle}>
            수강신청
          </Link>
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
              <Link href="/#greeting" className="talkly-nav-link">
                토클리소개 ▾
              </Link>
              <div className="talkly-dropdown">
                <Link href="/#greeting">인사말</Link>
                <Link href="/#why">Why TALKLY?</Link>
                <Link href="/#programs">프로그램</Link>
                <Link href="/#business-areas">사업영역</Link>
              </div>
            </div>

            <div className="talkly-nav-item">
              <Link href="/#programs" className="talkly-nav-link">
                교육센터 ▾
              </Link>
              <div className="talkly-dropdown">
                <Link href="/#programs">프로그램소개</Link>
                <Link href="/curriculum">커리큘럼/교재</Link>
                <Link href="/#teachers">교사소개</Link>
              </div>
            </div>

            <div className="talkly-nav-item">
              <Link href="/#ai" className="talkly-nav-link">
                TALKLY AI ▾
              </Link>
              <div className="talkly-dropdown">
                <Link href="/#ai">AI 수업리포트</Link>
                <Link href="/#ai">AI 성장리포트</Link>
                <Link href="/#ai">AI Writing</Link>
                <Link href="/#ai">강사 AI Brief</Link>
              </div>
            </div>

            <Link href="/level-test" className="talkly-nav-link">
              레벨테스트
            </Link>

            <div className="talkly-nav-item">
              <Link href="/enroll" className="talkly-nav-link">
                수강신청 ▾
              </Link>
              <div className="talkly-dropdown">
                <Link href="/enroll">수강신청</Link>
                <Link href="/login">내 수업관리</Link>
              </div>
            </div>

            <div className="talkly-nav-item">
              <Link href="/#information" className="talkly-nav-link">
                인포메이션 ▾
              </Link>
              <div className="talkly-dropdown">
                <Link href="/notice">공지사항</Link>
                <Link href="/#reviews">수업후기</Link>
                <Link href="/consultation">1:1상담</Link>
              </div>
            </div>
          </nav>

          <HomeAuthMenu />
        </div>
      </header>

      <section
        style={{
          background:
            "radial-gradient(circle at 90% 82%, rgba(91,137,226,.16) 0 12%, transparent 12.5%), linear-gradient(135deg, #f8fbff 0%, #edf4ff 100%)",
          borderBottom: "1px solid #e4eaf5",
        }}
      >
        <div
          style={{
            width: "min(1200px, calc(100% - 36px))",
            margin: "0 auto",
            padding: "92px 0 80px",
          }}
        >
          <div
            style={{
              color: "#2f6fed",
              fontSize: "13px",
              fontWeight: 900,
              letterSpacing: "0.04em",
            }}
          >
            TALKLY 7-LEVEL CURRICULUM
          </div>

          <h1
            style={{
              margin: "17px 0 0",
              maxWidth: "860px",
              color: "#0a1f44",
              fontSize: "clamp(42px, 5.7vw, 70px)",
              lineHeight: 1.18,
              letterSpacing: "-0.055em",
              fontWeight: 900,
            }}
          >
            수준에 맞게 시작하고,
            <br />
            <span style={{ color: "#3f75dc" }}>
              단계적으로 성장하는 영어
            </span>
          </h1>

          <p
            style={{
              margin: "26px 0 0",
              maxWidth: "680px",
              color: "#5f6f86",
              fontSize: "16px",
              lineHeight: 1.85,
            }}
          >
            유아부터 성인까지 7단계 레벨을 기준으로 학습 목표와 권장 교재를
            구성합니다. 현재 실력과 학습 목적을 확인한 뒤 학생에게 맞는 단계에서
            시작합니다.
          </p>

          <div
            style={{
              marginTop: "32px",
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <a href="#levels" className="talkly-hero-primary">
              7단계 커리큘럼 보기 ↓
            </a>
            <a href="#textbooks" className="talkly-hero-secondary">
              교재 살펴보기
            </a>
          </div>
        </div>
      </section>

      <section
        id="levels"
        style={{
          background: "#ffffff",
          padding: "92px 0",
        }}
      >
        <div
          style={{
            width: "min(1200px, calc(100% - 36px))",
            margin: "0 auto",
          }}
        >
          <SectionHead
            tag="LEVEL ROADMAP"
            title="TALKLY 7-Level Curriculum"
            description="학년은 권장 기준이며, 실제 시작 레벨은 학생의 영어 경험과 실력에 따라 달라질 수 있습니다."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
              gap: "18px",
            }}
          >
            {levels.map((level, index) => (
              <article
                key={level.name}
                style={{
                  overflow: "hidden",
                  border: "1px solid #e4e7ec",
                  borderRadius: "18px",
                  background: "#ffffff",
                  boxShadow: "0 12px 30px rgba(16,24,40,.04)",
                }}
              >
                <div
                  style={{
                    height: "7px",
                    background:
                      index < 2
                        ? "#8bb5ff"
                        : index < 4
                        ? "#5c8ee8"
                        : index < 6
                        ? "#2f62b6"
                        : "#0a1f44",
                  }}
                />

                <div style={{ padding: "26px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        minHeight: "27px",
                        padding: "0 10px",
                        borderRadius: "999px",
                        background: "#eef4ff",
                        color: "#2f6fed",
                        fontSize: "11px",
                        fontWeight: 900,
                      }}
                    >
                      {level.code}
                    </span>

                    <span
                      style={{
                        color: "#98a2b3",
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    >
                      {level.duration}
                    </span>
                  </div>

                  <h3
                    style={{
                      margin: "18px 0 0",
                      color: "#0a1f44",
                      fontSize: "24px",
                    }}
                  >
                    {level.name}
                  </h3>

                  <div
                    style={{
                      marginTop: "5px",
                      color: "#2f6fed",
                      fontWeight: 800,
                      fontSize: "13px",
                    }}
                  >
                    {level.age}
                  </div>

                  <p
                    style={{
                      margin: "14px 0 0",
                      color: "#667085",
                      lineHeight: 1.7,
                      minHeight: "48px",
                      fontSize: "13px",
                    }}
                  >
                    {level.summary}
                  </p>

                  <div
                    style={{
                      marginTop: "20px",
                      paddingTop: "18px",
                      borderTop: "1px solid #edf0f5",
                    }}
                  >
                    {level.goals.map((goal) => (
                      <div
                        key={goal}
                        style={{
                          display: "flex",
                          gap: "9px",
                          marginTop: "9px",
                          color: "#667085",
                          fontSize: "13px",
                          lineHeight: 1.6,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            color: "#2f6fed",
                            fontWeight: 900,
                          }}
                        >
                          ✓
                        </span>
                        <span>{goal}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="textbooks"
        style={{
          background: "#f5f8ff",
          padding: "92px 0",
          borderTop: "1px solid #e8edf6",
          borderBottom: "1px solid #e8edf6",
        }}
      >
        <div
          style={{
            width: "min(1200px, calc(100% - 36px))",
            margin: "0 auto",
          }}
        >
          <SectionHead
            tag="TALKLY TEXTBOOKS"
            title="레벨과 목표에 맞춘 다양한 교재"
            description="파닉스, 회화, 스피킹, 리딩부터 중·고급 회화까지 다양한 교재를 활용합니다. 실제 수업 교재는 레벨과 학습 목표에 맞춰 결정됩니다."
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "22px",
            }}
          >
            {textbookGroups.map((group) => (
              <section
                key={group.label}
                style={{
                  padding: "28px",
                  border: "1px solid #e4e7ec",
                  borderRadius: "18px",
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    color: "#20b6a0",
                    fontSize: "11px",
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                  }}
                >
                  {group.label}
                </div>

                <h3
                  style={{
                    margin: "6px 0 0",
                    color: "#0a1f44",
                    fontSize: "24px",
                  }}
                >
                  {group.title}
                </h3>

                <p
                  style={{
                    margin: "8px 0 0",
                    color: "#667085",
                    fontSize: "13px",
                    lineHeight: 1.7,
                  }}
                >
                  {group.description}
                </p>

                <div
                  style={{
                    marginTop: "22px",
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "14px",
                  }}
                >
                  {group.books.map((book) => (
                    <article
                      key={book.name}
                      style={{
                        border: "1px solid #e4e7ec",
                        borderRadius: "14px",
                        background: "#ffffff",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "155px",
                          padding: "16px",
                          background: "#f8faff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <img
                          src={book.image}
                          alt={`${book.name} 교재 표지`}
                          style={{
                            width: "100%",
                            maxHeight: "120px",
                            objectFit: "contain",
                          }}
                        />
                      </div>

                      <div style={{ padding: "15px 17px" }}>
                        <strong
                          style={{
                            color: "#0a1f44",
                            fontSize: "15px",
                          }}
                        >
                          {book.name}
                        </strong>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      <section
        style={{
          background: "#ffffff",
          padding: "86px 0",
        }}
      >
        <div
          style={{
            width: "min(1120px, calc(100% - 36px))",
            margin: "0 auto",
            padding: "38px 40px",
            border: "1px solid #dfe7f3",
            borderRadius: "22px",
            background: "linear-gradient(135deg, #ffffff, #edf4ff)",
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) auto",
            gap: "28px",
            alignItems: "center",
          }}
          className="talkly-level-cta"
        >
          <div>
            <div
              style={{
                color: "#2f6fed",
                fontSize: "11px",
                fontWeight: 900,
                letterSpacing: "0.08em",
              }}
            >
              START YOUR LEVEL
            </div>

            <h2
              style={{
                margin: "8px 0 0",
                color: "#0a1f44",
                fontSize: "29px",
                letterSpacing: "-0.035em",
              }}
            >
              어떤 레벨에서 시작해야 할까요?
            </h2>

            <p
              style={{
                margin: "10px 0 0",
                color: "#667085",
                lineHeight: 1.75,
                fontSize: "14px",
              }}
            >
              학년만으로 레벨을 정하지 않습니다. 현재 영어 경험과 목표를 함께
              확인해 적합한 시작점을 찾습니다.
            </p>
          </div>

          <Link
            href="/level-test"
            style={{
              minHeight: "48px",
              padding: "0 22px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "999px",
              background: "#2f6fed",
              color: "#ffffff",
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 900,
              whiteSpace: "nowrap",
            }}
          >
            무료 레벨테스트 →
          </Link>
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
              items={[
                ["인사말", "/#greeting"],
                ["Why TALKLY?", "/#why"],
                ["프로그램", "/#programs"],
                ["사업영역", "/#business-areas"],
              ]}
            />

            <FooterColumn
              title="교육센터"
              items={[
                ["프로그램소개", "/#programs"],
                ["커리큘럼/교재", "/curriculum"],
                ["교사소개", "/#teachers"],
              ]}
            />

            <FooterColumn
              title="TALKLY AI"
              items={[
                ["AI Lesson Report", "/#ai"],
                ["AI Growth Report", "/#ai"],
                ["AI Writing", "/#ai"],
              ]}
            />

            <FooterColumn
              title="인포메이션"
              items={[
                ["공지사항", "/notice"],
                ["수업후기", "/#reviews"],
                ["1:1상담", "/consultation"],
              ]}
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
        .talkly-hero-secondary {
          min-height: 50px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 24px;
          border-radius: 12px;
          text-decoration: none;
          font-size: 14px;
          font-weight: 900;
        }

        .talkly-hero-primary {
          background: #0a1f44;
          color: #ffffff;
          box-shadow: 0 10px 24px rgba(10,31,68,.18);
        }

        .talkly-hero-secondary {
          background: #ffffff;
          color: #0a1f44;
          border: 1px solid #d5deec;
        }

        @media (max-width: 1040px) {
          .talkly-main-header {
            grid-template-columns: 190px 1fr auto !important;
          }

          .talkly-desktop-nav {
            display: none !important;
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

          .talkly-level-cta {
            grid-template-columns: 1fr !important;
            padding: 28px 24px !important;
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
  description: string;
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
    </div>
  );
}

function FooterColumn({
  title,
  items,
}: {
  title: string;
  items: [string, string][];
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
        {items.map(([label, href]) => (
          <Link
            key={`${title}-${label}`}
            href={href}
            style={{
              color: "inherit",
              textDecoration: "none",
            }}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

const utilityLinkStyle = {
  color: "inherit",
  textDecoration: "none",
  opacity: 0.88,
};