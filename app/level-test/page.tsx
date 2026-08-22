import Link from "next/link";

export default function LevelTestPage() {
  return (
    <main
      style={{
        width: "100%",
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f5f8ff 0%, #ffffff 42%, #ffffff 100%)",
      }}
    >
      {/* Hero */}
      <section
        style={{
          width: "100%",
          maxWidth: "1120px",
          margin: "0 auto",
          padding: "76px 32px 58px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: "30px",
            padding: "0 12px",
            borderRadius: "999px",
            background: "#eaf1ff",
            color: "#2f6fed",
            fontSize: "11px",
            fontWeight: 900,
            letterSpacing: "0.08em",
          }}
        >
          TALKLY AI LEVEL TEST
        </div>

        <h1
          style={{
            margin: "22px auto 0",
            maxWidth: "760px",
            color: "#0A1F44",
            fontSize: "clamp(38px, 5vw, 58px)",
            lineHeight: 1.15,
            letterSpacing: "-0.05em",
          }}
        >
          지금의 영어 수준을
          <br />
          먼저 확인해보세요
        </h1>

        <p
          style={{
            margin: "22px auto 0",
            maxWidth: "700px",
            color: "#667085",
            fontSize: "16px",
            lineHeight: 1.85,
          }}
        >
          TALKLY AI 레벨테스트는 Grammar와 Listening을 중심으로
          학생의 현재 영어 수준을 확인합니다.
          <br />
          테스트 결과는 TALKLY의 상담과 수업 과정 배정을 위한
          내부 참고자료로 활용됩니다.
        </p>

        <div
          style={{
            marginTop: "34px",
            display: "flex",
            justifyContent: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/login?next=/parent/level-tests/new"
            style={{
              minHeight: "52px",
              padding: "0 26px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "12px",
              background: "#0A1F44",
              color: "#ffffff",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: 900,
              boxShadow:
                "0 10px 30px rgba(10, 31, 68, 0.16)",
            }}
          >
            무료 AI 레벨테스트 시작
          </Link>

          <Link
            href="/"
            style={{
              minHeight: "52px",
              padding: "0 22px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #d0d5dd",
              borderRadius: "12px",
              background: "#ffffff",
              color: "#344054",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: 800,
            }}
          >
            TALKLY 둘러보기
          </Link>
        </div>

        <p
          style={{
            margin: "14px auto 0",
            color: "#98a2b3",
            fontSize: "11px",
            lineHeight: 1.7,
          }}
        >
          ※ 레벨테스트 신청 및 응시를 위해 로그인이 필요합니다.
        </p>
      </section>

      {/* Summary */}
      <section
        style={{
          width: "100%",
          maxWidth: "980px",
          margin: "0 auto",
          padding: "0 32px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",
            gap: "14px",
          }}
        >
          <SummaryCard
            number="01"
            title="Grammar"
            description="문법 구조와 기본 영어 문장 이해 수준을 확인합니다."
          />

          <SummaryCard
            number="02"
            title="Listening"
            description="영어 음성을 듣고 핵심 정보와 의미를 이해하는 수준을 확인합니다."
          />

          <SummaryCard
            number="03"
            title="Adaptive Test"
            description="응답에 따라 문제 난이도가 조정되는 적응형 방식으로 진행합니다."
          />
        </div>
      </section>

      {/* Process */}
      <section
        style={{
          width: "100%",
          maxWidth: "980px",
          margin: "70px auto 0",
          padding: "0 32px",
        }}
      >
        <div
          style={{
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: "#2f6fed",
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing: "0.08em",
            }}
          >
            HOW IT WORKS
          </div>

          <h2
            style={{
              margin: "10px 0 0",
              color: "#101828",
              fontSize: "30px",
              letterSpacing: "-0.04em",
            }}
          >
            레벨테스트는 이렇게 진행됩니다
          </h2>
        </div>

        <div
          style={{
            marginTop: "30px",
            display: "grid",
            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",
            gap: "16px",
          }}
        >
          <ProcessCard
            step="STEP 1"
            title="AI 레벨테스트"
            description="학생 정보를 입력한 후 Grammar와 Listening 중심의 온라인 레벨테스트를 진행합니다."
          />

          <ProcessCard
            step="STEP 2"
            title="TALKLY 내부 검토"
            description="AI 분석 결과와 영역별 수준을 TALKLY 관리자가 확인합니다."
          />

          <ProcessCard
            step="STEP 3"
            title="필요 시 원어민 테스트"
            description="추가 확인이 필요한 경우 보호자와 일정을 협의하여 원어민 화상 테스트를 진행합니다."
          />
        </div>
      </section>

      {/* Important */}
      <section
        style={{
          width: "100%",
          maxWidth: "900px",
          margin: "70px auto 0",
          padding: "0 32px",
        }}
      >
        <div
          style={{
            padding: "28px",
            border: "1px solid #dbe7ff",
            borderRadius: "18px",
            background: "#f5f8ff",
          }}
        >
          <div
            style={{
              color: "#2f6fed",
              fontSize: "13px",
              fontWeight: 900,
            }}
          >
            레벨테스트 결과 안내
          </div>

          <p
            style={{
              margin: "10px 0 0",
              color: "#667085",
              fontSize: "13px",
              lineHeight: 1.85,
            }}
          >
            레벨테스트의 세부 점수, AI 추천 레벨,
            신뢰도 및 내부 분석 결과는 별도로 제공하지 않습니다.
            해당 결과는 TALKLY의 상담 및 적합한 과정 배정을 위한
            내부 자료로 활용됩니다.
          </p>

          <p
            style={{
              margin: "10px 0 0",
              color: "#667085",
              fontSize: "13px",
              lineHeight: 1.85,
            }}
          >
            AI 결과만으로 정확한 판단이 어려운 경우에는
            보호자에게 전화 또는 SNS로 연락드린 후
            원어민 강사와 추가 화상 레벨테스트를 진행할 수 있습니다.
          </p>
        </div>
      </section>

      {/* Who */}
      <section
        style={{
          width: "100%",
          maxWidth: "980px",
          margin: "70px auto 0",
          padding: "0 32px",
        }}
      >
        <div
          style={{
            textAlign: "center",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#101828",
              fontSize: "30px",
              letterSpacing: "-0.04em",
            }}
          >
            수강신청 전에도 받을 수 있어요
          </h2>

          <p
            style={{
              margin: "12px auto 0",
              maxWidth: "650px",
              color: "#667085",
              fontSize: "14px",
              lineHeight: 1.8,
            }}
          >
            TALKLY 수강생이 아니어도 괜찮습니다.
            학부모 계정으로 로그인한 뒤 학생 이름,
            학년, 나이 등의 기본 정보를 입력하면
            레벨테스트만 먼저 받을 수 있습니다.
          </p>
        </div>

        <div
          style={{
            marginTop: "26px",
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: "14px",
          }}
        >
          <AudienceCard
            title="기존 TALKLY 자녀"
            description="이미 등록된 자녀 정보를 선택하여 간편하게 레벨테스트를 신청할 수 있습니다."
          />

          <AudienceCard
            title="레벨테스트만 원하는 학생"
            description="수강신청이나 학생 계정 생성 없이 학생 정보를 직접 입력해 테스트를 받을 수 있습니다."
          />
        </div>
      </section>

      {/* Final CTA */}
      <section
        style={{
          width: "100%",
          maxWidth: "980px",
          margin: "72px auto 0",
          padding: "0 32px 90px",
        }}
      >
        <div
          style={{
            padding: "42px 28px",
            borderRadius: "20px",
            background: "#0A1F44",
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: "#9dc0ff",
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing: "0.08em",
            }}
          >
            TALKLY LEVEL TEST
          </div>

          <h2
            style={{
              margin: "12px 0 0",
              color: "#ffffff",
              fontSize: "30px",
              letterSpacing: "-0.04em",
            }}
          >
            지금 영어 레벨을 확인해보세요
          </h2>

          <p
            style={{
              margin: "12px auto 0",
              maxWidth: "590px",
              color: "#cbd5e1",
              fontSize: "13px",
              lineHeight: 1.8,
            }}
          >
            약 15~20분이면 완료할 수 있습니다.
            실제 테스트를 받을 학생이 직접 응시해주세요.
          </p>

          <Link
            href="/login?next=/parent/level-tests/new"
            style={{
              marginTop: "24px",
              minHeight: "50px",
              padding: "0 26px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "11px",
              background: "#ffffff",
              color: "#0A1F44",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: 900,
            }}
          >
            무료 레벨테스트 시작하기 →
          </Link>
        </div>
      </section>
    </main>
  );
}

function SummaryCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        padding: "22px",
        border: "1px solid #e4e7ec",
        borderRadius: "16px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          color: "#2f6fed",
          fontSize: "10px",
          fontWeight: 900,
        }}
      >
        {number}
      </div>

      <div
        style={{
          marginTop: "9px",
          color: "#101828",
          fontSize: "18px",
          fontWeight: 900,
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop: "8px",
          color: "#667085",
          fontSize: "12px",
          lineHeight: 1.7,
        }}
      >
        {description}
      </div>
    </div>
  );
}

function ProcessCard({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        padding: "24px",
        border: "1px solid #e4e7ec",
        borderRadius: "16px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          color: "#2f6fed",
          fontSize: "10px",
          fontWeight: 900,
        }}
      >
        {step}
      </div>

      <div
        style={{
          marginTop: "9px",
          color: "#101828",
          fontSize: "16px",
          fontWeight: 900,
        }}
      >
        {title}
      </div>

      <p
        style={{
          margin: "8px 0 0",
          color: "#667085",
          fontSize: "12px",
          lineHeight: 1.75,
        }}
      >
        {description}
      </p>
    </div>
  );
}

function AudienceCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        padding: "22px",
        border: "1px solid #e4e7ec",
        borderRadius: "16px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          color: "#101828",
          fontSize: "16px",
          fontWeight: 900,
        }}
      >
        {title}
      </div>

      <p
        style={{
          margin: "8px 0 0",
          color: "#667085",
          fontSize: "12px",
          lineHeight: 1.75,
        }}
      >
        {description}
      </p>
    </div>
  );
}