import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import LevelTestRequestForm from "./LevelTestRequestForm";

type ChildRow = {
  id: number;
  name: string;
  grade: string | null;
  school_name: string | null;
  birth_date: string | null;
  learning_goal: string | null;
  student_user_id: string | null;
  linked_student_user_id: string | null;
};

export default async function ParentLevelTestNewPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "parent"
  ) {
    redirect("/");
  }

  /*
   * 기존 TALKLY 자녀가 있는 경우
   * 선택해서 레벨테스트를 신청할 수 있도록
   * 자녀 정보를 불러옵니다.
   *
   * 자녀가 없어도 직접 학생 정보를 입력해
   * 레벨테스트를 신청할 수 있습니다.
   */
  const {
    data: childrenData,
    error: childrenError,
  } = await supabase
    .from("children")
    .select(`
      id,
      name,
      grade,
      school_name,
      birth_date,
      learning_goal,
      student_user_id,
      linked_student_user_id
    `)
    .eq(
      "parent_user_id",
      user.id
    )
    .eq(
      "is_active",
      true
    )
    .order(
      "created_at",
      {
        ascending: true,
      }
    );

  if (childrenError) {
    throw new Error(
      `자녀 정보를 불러오지 못했습니다: ${childrenError.message}`
    );
  }

  const children =
    (childrenData ??
      []) as ChildRow[];

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "900px",
        margin: "0 auto",
        padding:
          "54px 32px 90px",
      }}
    >
      <Link
        href="/parent"
        style={{
          color: "#667085",
          textDecoration:
            "none",
          fontSize: "13px",
          fontWeight: 800,
        }}
      >
        ← 대시보드
      </Link>

      <div
        style={{
          marginTop: "24px",
        }}
      >
        <div
          style={{
            color: "#2f6fed",
            fontSize: "12px",
            fontWeight: 900,
            letterSpacing:
              "0.08em",
          }}
        >
          TALKLY LEVEL TEST
        </div>

        <h1
          style={{
            margin:
              "10px 0 0",
            color: "#101828",
            fontSize: "36px",
            lineHeight: 1.2,
            letterSpacing:
              "-0.04em",
          }}
        >
          AI 레벨테스트 신청
        </h1>

        <p
          style={{
            margin:
              "14px 0 0",
            maxWidth: "700px",
            color: "#667085",
            fontSize: "14px",
            lineHeight: 1.8,
          }}
        >
          TALKLY AI 레벨테스트는
          문법과 리스닝을 중심으로
          학생의 현재 영어 수준을
          진단합니다. 수강신청 여부와
          관계없이 레벨테스트만
          신청할 수도 있습니다.
        </p>
      </div>

      {/* 진행 방식 */}
      <section
        style={{
          marginTop: "28px",
          padding: "20px",
          border:
            "1px solid #dbe7ff",
          borderRadius: "14px",
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
          TALKLY 레벨테스트 진행 방식
        </div>

        <div
          style={{
            marginTop: "14px",
            display: "grid",
            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",
            gap: "12px",
          }}
        >
          <StepCard
            number="01"
            title="AI 레벨테스트"
            description="문법과 리스닝 중심의 온라인 테스트를 진행합니다."
          />

          <StepCard
            number="02"
            title="관리자 검토"
            description="AI 결과를 바탕으로 TALKLY 내부에서 레벨을 검토합니다."
          />

          <StepCard
            number="03"
            title="필요 시 원어민 테스트"
            description="추가 확인이 필요한 경우 원어민 화상 테스트를 진행합니다."
          />
        </div>
      </section>

      {/* 테스트 안내 */}
      <section
        style={{
          marginTop: "22px",
          padding: "20px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "14px",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            color: "#101828",
            fontSize: "14px",
            fontWeight: 900,
          }}
        >
          신청 전 안내
        </div>

        <div
          style={{
            marginTop: "12px",
            display: "flex",
            flexDirection:
              "column",
            gap: "7px",
            color: "#667085",
            fontSize: "12px",
            lineHeight: 1.7,
          }}
        >
          <div>
            • 기존 TALKLY 자녀가
            있다면 등록된 자녀를
            선택할 수 있습니다.
          </div>

          <div>
            • TALKLY 수강생이
            아니더라도 학생 이름,
            학년, 나이 등을 직접
            입력하여 레벨테스트만
            신청할 수 있습니다.
          </div>

          <div>
            • AI 테스트 결과는
            TALKLY 내부 상담 및
            레벨 판단 자료로
            사용합니다.
          </div>

          <div>
            • 추가 확인이 필요한
            경우 보호자에게 전화
            또는 SNS로 연락하여
            원어민 화상 테스트를
            안내합니다.
          </div>
        </div>
      </section>

      {/* 신청 폼 */}
      <LevelTestRequestForm
        parentUserId={user.id}
        children={children}
      />

      <div
        style={{
          marginTop: "24px",
        }}
      >
        <Link
          href="/parent"
          style={
            secondaryButtonStyle
          }
        >
          ← 대시보드로
        </Link>
      </div>
    </main>
  );
}

function StepCard({
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
        padding: "16px",
        border:
          "1px solid #dbe7ff",
        borderRadius: "11px",
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
        STEP {number}
      </div>

      <div
        style={{
          marginTop: "7px",
          color: "#101828",
          fontSize: "14px",
          fontWeight: 900,
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop: "6px",
          color: "#667085",
          fontSize: "11px",
          lineHeight: 1.6,
        }}
      >
        {description}
      </div>
    </div>
  );
}

const secondaryButtonStyle = {
  minHeight: "46px",
  padding: "0 18px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border:
    "1px solid #d0d5dd",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#344054",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 800,
};