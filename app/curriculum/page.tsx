import Link from "next/link";

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
      {
        name: "Smart Phonics",
        image: "/textbooks/smart-phonics.png",
      },
      {
        name: "Phonics Monster",
        image: "/textbooks/phonics-monster.png",
      },
      {
        name: "Let's Go Begin",
        image: "/textbooks/lets-go-begin.png",
      },
      {
        name: "Let's Go",
        image: "/textbooks/lets-go.png",
      },
    ],
  },
  {
    label: "SPEAKING",
    title: "회화 · 스피킹",
    description: "실제 대화 상황과 다양한 주제를 중심으로 말하기 자신감을 키우는 교재",
    books: [
      {
        name: "Hi Five",
        image: "/textbooks/hi-five.png",
      },
      {
        name: "Super Star",
        image: "/textbooks/super-star.png",
      },
      {
        name: "Everybody Up",
        image: "/textbooks/everybody-up.png",
      },
      {
        name: "Speak Up",
        image: "/textbooks/speak-up.png",
      },
    ],
  },
  {
    label: "READING",
    title: "리딩 · 표현 확장",
    description: "읽기 이해력과 어휘, 표현을 단계적으로 확장하는 교재",
    books: [
      {
        name: "The Best Reading",
        image: "/textbooks/the-best-reading.png",
      },
      {
        name: "Wonderful World",
        image: "/textbooks/wonderful-world.png",
      },
      {
        name: "Can You Believe It?",
        image: "/textbooks/can-you-believe-it.png",
      },
    ],
  },
  {
    label: "INTERMEDIATE & ADVANCED",
    title: "중급 · 고급 회화",
    description: "복합 문장, 실용 회화와 고급 의사소통으로 이어지는 교재",
    books: [
      {
        name: "Side by Side",
        image: "/textbooks/side-by-side.png",
      },
      {
        name: "Interchange",
        image: "/textbooks/interchange.png",
      },
    ],
  },
];

export default function CurriculumPage() {
  return (
    <div className="talkly-page">
      <header className="talkly-header">
        <div className="talkly-container talkly-header-inner">
          <Link href="/" className="talkly-logo">
            TALKLY
          </Link>

          <nav className="talkly-nav" aria-label="메인 메뉴">
            <Link href="/curriculum">
              수업 과정
            </Link>

            <Link href="/#teachers">
              강사 소개
            </Link>

            <Link href="/#learning">
              학습 시스템
            </Link>

            <Link href="/#guide">
              수강 안내
            </Link>
          </nav>

          <div className="talkly-header-actions">
            <Link
              href="/login"
              className="talkly-button talkly-button-secondary"
            >
              로그인
            </Link>

            <Link
              href="/level-test"
              className="talkly-button talkly-button-primary"
            >
              무료 레벨테스트
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section
          className="talkly-hero"
          style={{
            paddingBottom: 68,
          }}
        >
          <div className="talkly-container">
            <div
              style={{
                maxWidth: 820,
              }}
            >
              <div className="talkly-eyebrow">
                TALKLY 7-LEVEL CURRICULUM
              </div>

              <h1
                className="talkly-hero-title"
                style={{
                  fontSize:
                    "clamp(42px, 6vw, 72px)",
                }}
              >
                수준에 맞게 시작하고,
                <br />

                <span className="talkly-hero-title-highlight">
                  단계적으로 성장하는 영어
                </span>
              </h1>

              <p className="talkly-hero-description">
                유아부터 성인까지 7단계 레벨을 기준으로 학습 목표와 권장 교재를 구성합니다.
                현재 실력과 학습 목적을 확인한 뒤 학생에게 맞는 단계에서 시작합니다.
              </p>

              <div className="talkly-hero-actions">
                <Link
                  href="#levels"
                  className="talkly-button talkly-button-primary"
                >
                  7단계 커리큘럼 보기 ↓
                </Link>

                <Link
                  href="#textbooks"
                  className="talkly-button talkly-button-secondary"
                >
                  교재 살펴보기
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section
          id="levels"
          className="talkly-section"
        >
          <div className="talkly-container">
            <div className="talkly-section-heading">
              <div className="talkly-section-label">
                LEVEL ROADMAP
              </div>

              <h2 className="talkly-section-title">
                TALKLY 7-Level Curriculum
              </h2>

              <p className="talkly-section-description">
                학년은 권장 기준이며, 실제 시작 레벨은 학생의 영어 경험과 실력에 따라 달라질 수 있습니다.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(290px, 1fr))",
                gap: 18,
              }}
            >
              {levels.map(
                (
                  level,
                  index
                ) => (
                  <article
                    key={
                      level.name
                    }
                    className="talkly-card talkly-card-hover"
                    style={{
                      overflow:
                        "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: 7,
                        background:
                          index < 2
                            ? "#8bb5ff"
                            : index < 4
                            ? "#5c8ee8"
                            : index < 6
                            ? "#2f62b6"
                            : "var(--talkly-navy)",
                      }}
                    />

                    <div
                      style={{
                        padding: 26,
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          gap: 12,
                          alignItems:
                            "center",
                        }}
                      >
                        <span className="talkly-badge talkly-badge-blue">
                          {
                            level.code
                          }
                        </span>

                        <span
                          style={{
                            color:
                              "var(--text-muted)",
                            fontSize:
                              13,
                            fontWeight:
                              700,
                          }}
                        >
                          {
                            level.duration
                          }
                        </span>
                      </div>

                      <h3
                        style={{
                          margin:
                            "18px 0 0",
                          color:
                            "var(--talkly-navy)",
                          fontSize:
                            25,
                        }}
                      >
                        {
                          level.name
                        }
                      </h3>

                      <div
                        style={{
                          marginTop:
                            5,
                          color:
                            "var(--talkly-blue)",
                          fontWeight:
                            800,
                          fontSize:
                            14,
                        }}
                      >
                        {
                          level.age
                        }
                      </div>

                      <p
                        style={{
                          margin:
                            "14px 0 0",
                          color:
                            "var(--text-secondary)",
                          lineHeight:
                            1.7,
                          minHeight:
                            48,
                        }}
                      >
                        {
                          level.summary
                        }
                      </p>

                      <div
                        style={{
                          marginTop:
                            20,
                          paddingTop:
                            18,
                          borderTop:
                            "1px solid var(--border-light)",
                        }}
                      >
                        {level.goals.map(
                          (
                            goal
                          ) => (
                            <div
                              key={
                                goal
                              }
                              style={{
                                display:
                                  "flex",
                                gap: 9,
                                marginTop:
                                  9,
                                color:
                                  "var(--text-secondary)",
                                fontSize:
                                  14,
                                lineHeight:
                                  1.6,
                              }}
                            >
                              <span
                                aria-hidden="true"
                                style={{
                                  color:
                                    "var(--talkly-blue)",
                                  fontWeight:
                                    900,
                                }}
                              >
                                ✓
                              </span>

                              <span>
                                {
                                  goal
                                }
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>
          </div>
        </section>

        <section
          id="textbooks"
          className="talkly-section talkly-section-blue"
        >
          <div className="talkly-container">
            <div className="talkly-section-heading">
              <div className="talkly-section-label">
                TALKLY TEXTBOOKS
              </div>

              <h2 className="talkly-section-title">
                레벨과 목표에 맞춘 다양한 교재
              </h2>

              <p className="talkly-section-description">
                파닉스, 회화, 스피킹, 리딩부터 중·고급 회화까지 다양한 교재를 활용합니다.
                실제 수업 교재는 레벨과 학습 목표에 맞춰 결정됩니다.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection:
                  "column",
                gap: 22,
              }}
            >
              {textbookGroups.map(
                (group) => (
                  <section
                    key={
                      group.label
                    }
                    className="talkly-card"
                    style={{
                      padding:
                        28,
                    }}
                  >
                    <div className="talkly-section-label">
                      {
                        group.label
                      }
                    </div>

                    <h3
                      style={{
                        margin:
                          "5px 0 0",
                        color:
                          "var(--talkly-navy)",
                        fontSize:
                          24,
                      }}
                    >
                      {
                        group.title
                      }
                    </h3>

                    <p
                      style={{
                        margin:
                          "8px 0 0",
                        color:
                          "var(--text-muted)",
                        fontSize:
                          14,
                      }}
                    >
                      {
                        group.description
                      }
                    </p>

                    <div
                      style={{
                        marginTop:
                          22,
                        display:
                          "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 14,
                      }}
                    >
                      {group.books.map(
                        (
                          book
                        ) => (
                          <article
                            key={
                              book.name
                            }
                            style={{
                              border:
                                "1px solid var(--border)",
                              borderRadius:
                                14,
                              background:
                                "#fff",
                              overflow:
                                "hidden",
                            }}
                          >
                            <div
                              style={{
                                height:
                                  155,
                                padding:
                                  16,
                                background:
                                  "#f8faff",
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                justifyContent:
                                  "center",
                              }}
                            >
                              <img
                                src={
                                  book.image
                                }
                                alt={`${book.name} 교재 표지`}
                                style={{
                                  width:
                                    "100%",
                                  maxHeight:
                                    120,
                                  objectFit:
                                    "contain",
                                }}
                              />
                            </div>

                            <div
                              style={{
                                padding:
                                  "15px 17px",
                              }}
                            >
                              <strong
                                style={{
                                  color:
                                    "var(--talkly-navy)",
                                  fontSize:
                                    15,
                                }}
                              >
                                {
                                  book.name
                                }
                              </strong>
                            </div>
                          </article>
                        )
                      )}
                    </div>
                  </section>
                )
              )}
            </div>
          </div>
        </section>

        <section className="talkly-section">
          <div className="talkly-container">
            <div
              className="talkly-card"
              style={{
                padding: "34px",
                display: "grid",
                gridTemplateColumns:
                  "minmax(0, 1fr) auto",
                gap: 28,
                alignItems:
                  "center",
                background:
                  "linear-gradient(135deg, #ffffff, #edf4ff)",
              }}
            >
              <div>
                <div className="talkly-section-label">
                  START YOUR LEVEL
                </div>

                <h2
                  style={{
                    margin:
                      "7px 0 0",
                    color:
                      "var(--talkly-navy)",
                    fontSize:
                      30,
                  }}
                >
                  어떤 레벨에서 시작해야 할까요?
                </h2>

                <p
                  style={{
                    margin:
                      "10px 0 0",
                    color:
                      "var(--text-secondary)",
                    lineHeight:
                      1.7,
                  }}
                >
                  학년만으로 레벨을 정하지 않습니다. 현재 영어 경험과 목표를 함께 확인해 적합한 시작점을 찾습니다.
                </p>
              </div>

              <Link
                href="/level-test"
                className="talkly-button talkly-button-primary"
              >
                무료 레벨테스트 →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <section className="talkly-cta">
        <h2>
          나에게 맞는 영어의 시작, TALKLY
        </h2>

        <p>
          레벨을 확인하고 목표에 맞는 커리큘럼과 교재로 수업을 시작해보세요.
        </p>

        <div
          style={{
            marginTop: 24,
          }}
        >
          <Link
            href="/level-test"
            className="talkly-button"
            style={{
              background:
                "#fff",
              color:
                "var(--talkly-navy)",
            }}
          >
            무료 레벨테스트 시작하기 →
          </Link>
        </div>
      </section>
    </div>
  );
}