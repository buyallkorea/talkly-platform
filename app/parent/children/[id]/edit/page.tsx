import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TalklyUserHeader from "@/components/TalklyUserHeader";
import EditChildForm from "./EditChildForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditChildPage({
  params,
}: PageProps) {
  const { id } = await params;

  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "parent"
  ) {
    redirect("/");
  }

  const {
    data: child,
    error,
  } = await supabase
    .from("children")
    .select(`
      id,
      name,
      birth_date,
      school_name,
      grade,
      learning_goal
    `)
    .eq("id", id)
    .eq(
      "parent_user_id",
      user.id
    )
    .eq(
      "is_active",
      true
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message
    );
  }

  if (!child) {
    notFound();
  }

  return (
    <div className="talkly-dashboard">
      <TalklyUserHeader
        role="parent"
        userName={
          profile.name
        }
      />

      <main className="talkly-dashboard-main">
        <div
          style={{
            marginBottom:
              "20px",
            display: "flex",
            alignItems:
              "center",
            gap: "14px",
            flexWrap:
              "wrap",
          }}
        >
          <Link
            href={`/parent/children/${child.id}`}
            style={{
              color:
                "var(--talkly-blue)",
              textDecoration:
                "none",
              fontSize:
                "14px",
              fontWeight:
                800,
            }}
          >
            ← 자녀 상세
          </Link>

          <span
            style={{
              color:
                "var(--text-muted)",
              fontSize:
                "12px",
            }}
          >
            /
          </span>

          <Link
            href="/parent/children"
            style={{
              color:
                "var(--text-muted)",
              textDecoration:
                "none",
              fontSize:
                "13px",
              fontWeight:
                700,
            }}
          >
            자녀 목록
          </Link>
        </div>

        <section
          style={{
            position:
              "relative",
            overflow:
              "hidden",
            padding:
              "32px",
            borderRadius:
              "22px",
            background:
              "linear-gradient(135deg, #ffffff 0%, #f1f6ff 65%, #e8f1ff 100%)",
            border:
              "1px solid #e1e9f5",
            boxShadow:
              "var(--shadow-card)",
          }}
        >
          <div
            style={{
              position:
                "relative",
              zIndex: 1,
              display:
                "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              gap: "24px",
              flexWrap:
                "wrap",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap: "18px",
              }}
            >
              <div
                style={{
                  width:
                    "64px",
                  height:
                    "64px",
                  borderRadius:
                    "20px",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  background:
                    "var(--talkly-blue)",
                  color:
                    "#ffffff",
                  fontSize:
                    "27px",
                  fontWeight:
                    900,
                }}
              >
                {child.name.slice(
                  0,
                  1
                )}
              </div>

              <div>
                <div className="talkly-section-label">
                  EDIT STUDENT
                  PROFILE
                </div>

                <h1
                  className="talkly-dashboard-title"
                  style={{
                    marginTop:
                      "5px",
                  }}
                >
                  {child.name} 정보 수정
                </h1>

                <p
                  style={{
                    margin:
                      "6px 0 0",
                    color:
                      "var(--text-secondary)",
                    lineHeight:
                      1.7,
                  }}
                >
                  등록된 자녀의 기본 정보와
                  학습 목표를 수정합니다.
                </p>
              </div>
            </div>

            <Link
              href={`/parent/children/${child.id}`}
              className="talkly-button talkly-button-secondary"
            >
              수정 취소
            </Link>
          </div>
        </section>

        <section
          className="talkly-card"
          style={{
            marginTop:
              "24px",
            padding:
              "30px",
          }}
        >
          <div className="talkly-section-label">
            BASIC INFORMATION
          </div>

          <h2
            style={{
              margin:
                "5px 0 8px",
              color:
                "var(--talkly-navy)",
              fontSize:
                "24px",
            }}
          >
            자녀 기본 정보
          </h2>

          <p
            style={{
              margin:
                "0 0 26px",
              color:
                "var(--text-muted)",
              fontSize:
                "14px",
              lineHeight:
                1.7,
            }}
          >
            수업과 레벨테스트,
            학습관리에서 사용하는
            자녀 정보를 수정합니다.
          </p>

          <EditChildForm
            child={child}
          />
        </section>
      </main>
    </div>
  );
}