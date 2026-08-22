import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function LevelTestStartPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /*
   * 비로그인 사용자만 로그인 페이지로 보냅니다.
   */
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
    .select(`
      id,
      role,
      name
    `)
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile
  ) {
    redirect("/");
  }

  /*
   * 학부모
   *
   * 기존에 만든 학부모용
   * 레벨테스트 신청 화면으로 이동합니다.
   */
  if (profile.role === "parent") {
    redirect(
      "/parent/level-tests/new"
    );
  }

  /*
   * 학생
   *
   * 학생 계정과 연결된 자녀 정보를 찾습니다.
   * 수강등록 여부는 확인하지 않습니다.
   */
  if (profile.role === "student") {
    const {
      data: child,
      error: childError,
    } = await supabase
      .from("children")
      .select(`
        id,
        name,
        grade,
        birth_date,
        student_user_id,
        is_active
      `)
      .eq(
        "student_user_id",
        user.id
      )
      .eq(
        "is_active",
        true
      )
      .maybeSingle();

    if (childError) {
      throw new Error(
        childError.message
      );
    }

    /*
     * 학생 계정과 연결된 자녀가 있으면
     * 기존 레벨테스트 신청 페이지에
     * studentMode와 childId를 전달합니다.
     */
    if (child) {
      redirect(
        `/parent/level-tests/new?studentMode=1&childId=${child.id}`
      );
    }

    /*
     * 연결된 자녀 정보가 없는 학생 계정
     */
    return (
      <main
        style={{
          minHeight: "100vh",
          background:
            "linear-gradient(180deg, #f5f8ff 0%, #ffffff 100%)",
          padding:
            "70px 20px",
        }}
      >
        <section
          style={{
            width:
              "min(720px, 100%)",
            margin:
              "0 auto",
            padding:
              "40px 34px",
            border:
              "1px solid #e4e7ec",
            borderRadius:
              "20px",
            background:
              "#ffffff",
            boxShadow:
              "0 16px 40px rgba(16,24,40,.06)",
            textAlign:
              "center",
          }}
        >
          <div
            style={{
              color:
                "#2f6fed",
              fontSize:
                "12px",
              fontWeight:
                900,
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
              color:
                "#0A1F44",
              fontSize:
                "30px",
              lineHeight:
                1.35,
              letterSpacing:
                "-0.04em",
            }}
          >
            학생 연결 정보를
            <br />
            확인할 수 없습니다.
          </h1>

          <p
            style={{
              margin:
                "16px auto 0",
              maxWidth:
                "520px",
              color:
                "#667085",
              fontSize:
                "14px",
              lineHeight:
                1.8,
            }}
          >
            현재 로그인한 학생 계정과 연결된
            자녀 정보가 없습니다.
            학부모 계정에서 자녀와 학생 계정을
            먼저 연결한 뒤 다시 이용해주세요.
          </p>

          <div
            style={{
              marginTop:
                "26px",
              display:
                "flex",
              justifyContent:
                "center",
              gap:
                "10px",
              flexWrap:
                "wrap",
            }}
          >
            <Link
              href="/student"
              style={{
                minHeight:
                  "46px",
                padding:
                  "0 20px",
                display:
                  "inline-flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                borderRadius:
                  "999px",
                background:
                  "#2f6fed",
                color:
                  "#ffffff",
                textDecoration:
                  "none",
                fontSize:
                  "13px",
                fontWeight:
                  900,
              }}
            >
              학생 마이페이지 →
            </Link>

            <Link
              href="/"
              style={{
                minHeight:
                  "46px",
                padding:
                  "0 20px",
                display:
                  "inline-flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                border:
                  "1px solid #d0d5dd",
                borderRadius:
                  "999px",
                background:
                  "#ffffff",
                color:
                  "#344054",
                textDecoration:
                  "none",
                fontSize:
                  "13px",
                fontWeight:
                  800,
              }}
            >
              TALKLY 홈
            </Link>
          </div>
        </section>
      </main>
    );
  }

  /*
   * 강사 / 관리자 등은 일반 응시 대상이 아닙니다.
   */
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f5f8ff 0%, #ffffff 100%)",
        padding:
          "70px 20px",
      }}
    >
      <section
        style={{
          width:
            "min(720px, 100%)",
          margin:
            "0 auto",
          padding:
            "40px 34px",
          border:
            "1px solid #e4e7ec",
          borderRadius:
            "20px",
          background:
            "#ffffff",
          boxShadow:
            "0 16px 40px rgba(16,24,40,.06)",
          textAlign:
            "center",
        }}
      >
        <div
          style={{
            color:
              "#2f6fed",
            fontSize:
              "12px",
            fontWeight:
              900,
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
            color:
              "#0A1F44",
            fontSize:
              "30px",
            lineHeight:
              1.35,
            letterSpacing:
              "-0.04em",
          }}
        >
          레벨테스트 응시 대상이
          아닙니다.
        </h1>

        <p
          style={{
            margin:
              "16px auto 0",
            maxWidth:
              "520px",
            color:
              "#667085",
            fontSize:
              "14px",
            lineHeight:
              1.8,
          }}
        >
          무료 레벨테스트는
          학부모와 학생 계정에서
          이용할 수 있습니다.
        </p>

        <Link
          href="/"
          style={{
            marginTop:
              "26px",
            minHeight:
              "46px",
            padding:
              "0 20px",
            display:
              "inline-flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            borderRadius:
              "999px",
            background:
              "#2f6fed",
            color:
              "#ffffff",
            textDecoration:
              "none",
            fontSize:
              "13px",
            fontWeight:
              900,
          }}
        >
          TALKLY 홈으로 →
        </Link>
      </section>
    </main>
  );
}