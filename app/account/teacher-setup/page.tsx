import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import TeacherAccountSetupForm from "./TeacherAccountSetupForm";

export default async function TeacherAccountSetupPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/account/teacher-setup"
    );
  }

  const {
    data: profile,
    error: profileError,
  } =
    await supabase
      .from("profiles")
      .select(`
        role,
        name
      `)
      .eq(
        "id",
        user.id
      )
      .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "teacher"
  ) {
    redirect("/");
  }

  /*
   * teacher_profiles의 활성 상태 확인
   */
  const adminClient =
    createAdminClient();

  const {
    data: teacherProfile,
    error: teacherProfileError,
  } =
    await adminClient
      .from("teacher_profiles")
      .select(`
        display_name,
        is_active
      `)
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();

  if (
    teacherProfileError ||
    !teacherProfile
  ) {
    redirect(
      "/account/teacher-disabled?reason=profile"
    );
  }

  if (
    !teacherProfile.is_active
  ) {
    redirect(
      "/account/teacher-disabled"
    );
  }

  /*
   * 신규 초대 계정 여부
   */
  const teacherInvited =
    user.user_metadata
      ?.teacher_invited === true;

  const accountReady =
    user.user_metadata
      ?.teacher_account_ready === true;

  /*
   * 이미 설정을 완료한 신규 강사라면
   * 다시 비밀번호 설정페이지를 보여주지 않음
   */
  if (
    teacherInvited &&
    accountReady
  ) {
    redirect("/teacher");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "56px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #f8fbff 0%, #eef4ff 50%, #e6efff 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "620px",
        }}
      >
        <div
          style={{
            marginBottom: "22px",
          }}
        >
          <div
            style={{
              color: "#2f6fed",
              fontSize: "12px",
              fontWeight: 900,
              letterSpacing: "0.09em",
            }}
          >
            TALKLY TEACHER
          </div>

          <h1
            style={{
              margin: "7px 0 0",
              color: "#0a1f44",
              fontSize: "34px",
              lineHeight: 1.25,
            }}
          >
            Set up your teacher account
          </h1>

          <p
            style={{
              margin: "12px 0 0",
              color: "#475467",
              fontSize: "15px",
              lineHeight: 1.75,
            }}
          >
            Welcome to TALKLY. Create
            your own password to finish
            setting up your teacher
            account.
          </p>

          <p
            style={{
              margin: "7px 0 0",
              color: "#667085",
              fontSize: "13px",
              lineHeight: 1.65,
            }}
          >
            TALKLY 강사 계정 설정을
            완료하려면 본인이 사용할
            비밀번호를 직접 설정해 주세요.
          </p>
        </div>

        <section
          style={{
            padding: "28px",
            border:
              "1px solid #dfe7f3",
            borderRadius: "18px",
            background: "#ffffff",
            boxShadow:
              "0 18px 50px rgba(15, 23, 42, 0.08)",
          }}
        >
          <div
            style={{
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                color: "#667085",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              Teacher
            </div>

            <div
              style={{
                marginTop: "5px",
                color: "#0a1f44",
                fontSize: "20px",
                fontWeight: 900,
              }}
            >
              {teacherProfile.display_name ||
                profile.name ||
                "TALKLY Teacher"}
            </div>

            <div
              style={{
                marginTop: "4px",
                color: "#667085",
                fontSize: "13px",
              }}
            >
              {user.email}
            </div>
          </div>

          <TeacherAccountSetupForm />
        </section>
      </div>
    </main>
  );
}