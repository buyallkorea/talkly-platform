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
  parent_user_id: string;
};

type PageProps = {
  searchParams: Promise<{
    studentMode?: string;
    childId?: string;
  }>;
};

export default async function ParentLevelTestNewPage({
  searchParams,
}: PageProps) {
  const query = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=%2Flevel-test%2Fstart"
    );
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
    !profile
  ) {
    redirect("/");
  }

  if (
    profile.role !== "parent" &&
    profile.role !== "student"
  ) {
    redirect("/");
  }

  const userRole = profile.role as
    | "parent"
    | "student";

  const isStudent =
    userRole === "student";

  let children: ChildRow[] = [];
  let parentUserId = user.id;

  /*
   * 학부모:
   * 본인에게 연결된 활성 자녀를 모두 조회합니다.
   */
  if (userRole === "parent") {
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
        linked_student_user_id,
        parent_user_id
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

    children =
      (childrenData ??
        []) as ChildRow[];
  }

  /*
   * 학생:
   * 현재 학생 로그인 계정과 연결된 children 행만 조회합니다.
   * 수강신청 여부는 확인하지 않습니다.
   */
  if (userRole === "student") {
    const {
      data: studentChildren,
      error: studentChildError,
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
        linked_student_user_id,
        parent_user_id
      `)
      .or(
        `student_user_id.eq.${user.id},linked_student_user_id.eq.${user.id}`
      )
      .eq(
        "is_active",
        true
      )
      .limit(5);

    if (studentChildError) {
      throw new Error(
        `학생 정보를 불러오지 못했습니다: ${studentChildError.message}`
      );
    }

    const linkedChildren =
      (studentChildren ??
        []) as ChildRow[];

    if (
      linkedChildren.length === 0
    ) {
      return (
        <main
          style={{
            width: "100%",
            maxWidth: "760px",
            margin: "0 auto",
            padding:
              "70px 32px 100px",
          }}
        >
          <Link
            href="/"
            style={{
              color: "#667085",
              textDecoration:
                "none",
              fontSize: "13px",
              fontWeight: 800,
            }}
          >
            ← TALKLY 홈
          </Link>

          <section
            style={{
              marginTop: "26px",
              padding: "36px",
              border:
                "1px solid #e4e7ec",
              borderRadius: "18px",
              background: "#ffffff",
              textAlign: "center",
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
                  "12px 0 0",
                color: "#101828",
                fontSize: "28px",
                lineHeight: 1.4,
              }}
            >
              학생 연결 정보를
              확인할 수 없습니다.
            </h1>

            <p
              style={{
                margin:
                  "14px auto 0",
                maxWidth: "520px",
                color: "#667085",
                fontSize: "14px",
                lineHeight: 1.8,
              }}
            >
              현재 로그인한 학생 계정과 연결된
              자녀 정보가 없습니다.
              학부모 계정에서 자녀와 학생 계정을
              연결한 뒤 다시 이용해주세요.
            </p>

            <Link
              href="/student"
              style={{
                marginTop: "24px",
                minHeight: "46px",
                padding: "0 20px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "10px",
                background: "#2f6fed",
                color: "#ffffff",
                textDecoration:
                  "none",
                fontSize: "13px",
                fontWeight: 900,
              }}
            >
              학생 마이페이지 →
            </Link>
          </section>
        </main>
      );
    }

    /*
     * /level-test/start에서 childId를 전달한 경우
     * 그 자녀가 현재 학생 계정과 실제 연결되어 있는지 확인합니다.
     */
    const requestedChildId =
      query.childId
        ? Number(query.childId)
        : null;

    if (
      requestedChildId &&
      Number.isInteger(
        requestedChildId
      )
    ) {
      const requestedChild =
        linkedChildren.find(
          (child) =>
            child.id ===
            requestedChildId
        );

      if (!requestedChild) {
        redirect(
          "/level-test/start"
        );
      }

      children = [
        requestedChild,
      ];
    } else {
      children = [
        linkedChildren[0],
      ];
    }

    parentUserId =
      children[0].parent_user_id;
  }

  const backHref =
    isStudent
      ? "/student"
      : "/parent";

  const backLabel =
    isStudent
      ? "← 학생 마이페이지"
      : "← 대시보드";

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
        href={backHref}
        style={{
          color: "#667085",
          textDecoration:
            "none",
          fontSize: "13px",
          fontWeight: 800,
        }}
      >
        {backLabel}
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
          관계없이 무료 레벨테스트를
          진행할 수 있습니다.
        </p>

        {isStudent && (
          <div
            style={{
              marginTop: "16px",
              padding:
                "14px 16px",
              border:
                "1px solid #dbe7ff",
              borderRadius: "10px",
              background: "#f5f8ff",
              color: "#344054",
              fontSize: "13px",
              lineHeight: 1.7,
            }}
          >
            현재 로그인한 학생 계정과 연결된
            <strong>
              {" "}
              {children[0]?.name}
            </strong>
            님의 정보로 레벨테스트를 진행합니다.
          </div>
        )}
      </div>

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
          {isStudent ? (
            <>
              <div>
                • 현재 로그인한 학생 계정과
                연결된 본인 정보로 응시합니다.
              </div>

              <div>
                • TALKLY 수강생이 아니어도
                무료 레벨테스트를 받을 수 있습니다.
              </div>
            </>
          ) : (
            <>
              <div>
                • 기존 TALKLY 자녀가 있다면
                등록된 자녀를 선택할 수 있습니다.
              </div>

              <div>
                • TALKLY 수강생이 아니더라도
                학생 이름, 학년, 나이 등을 직접
                입력하여 레벨테스트만 신청할 수 있습니다.
              </div>
            </>
          )}

          <div>
            • AI 테스트 결과는 TALKLY 내부 상담 및
            레벨 판단 자료로 사용합니다.
          </div>

          <div>
            • 추가 확인이 필요한 경우 보호자에게
            전화 또는 SNS로 연락하여 원어민 화상 테스트를 안내합니다.
          </div>
        </div>
      </section>

      <LevelTestRequestForm
        currentUserId={user.id}
        parentUserId={parentUserId}
        userRole={userRole}
        children={children}
      />

      <div
        style={{
          marginTop: "24px",
        }}
      >
        <Link
          href={backHref}
          style={
            secondaryButtonStyle
          }
        >
          {backLabel}
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