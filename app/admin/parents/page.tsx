import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type PageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

type ParentProfile = {
  id: string;
  name: string | null;
  created_at: string;
};

type Child = {
  id: number;
  name: string;
  parent_user_id: string;
  is_active: boolean;
};

type Enrollment = {
  id: number;
  child_id: number | null;
  status: string;
};

export default async function AdminParentsPage({
  searchParams,
}: PageProps) {
  const { q = "" } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!adminProfile || adminProfile.role !== "admin") {
    redirect("/");
  }

  const [
    parentsResult,
    childrenResult,
    enrollmentsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(`
        id,
        name,
        created_at
      `)
      .eq("role", "parent")
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("children")
      .select(`
        id,
        name,
        parent_user_id,
        is_active
      `),

    supabase
      .from("enrollments")
      .select(`
        id,
        child_id,
        status
      `)
      .not("child_id", "is", null),
  ]);

  const firstError =
    parentsResult.error ||
    childrenResult.error ||
    enrollmentsResult.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const parents =
    (parentsResult.data ?? []) as ParentProfile[];

  const children =
    (childrenResult.data ?? []) as Child[];

  const enrollments =
    (enrollmentsResult.data ?? []) as Enrollment[];

  const normalizedQuery =
    q.trim().toLowerCase();

  function formatDate(value: string | null) {
    if (!value) {
      return "-";
    }

    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  }

  function getChildren(parentId: string) {
    return children.filter(
      (child) =>
        child.parent_user_id === parentId
    );
  }

  function getActiveEnrollmentCount(
    parentId: string
  ) {
    const childIds = new Set(
      getChildren(parentId).map(
        (child) => child.id
      )
    );

    return enrollments.filter(
      (enrollment) =>
        enrollment.child_id !== null &&
        childIds.has(enrollment.child_id) &&
        enrollment.status === "active"
    ).length;
  }

  const rows = parents
    .map((parent) => {
      const linkedChildren =
        getChildren(parent.id);

      const activeChildrenCount =
        linkedChildren.filter(
          (child) => child.is_active
        ).length;

      return {
        ...parent,
        linkedChildren,
        activeChildrenCount,
        activeEnrollmentCount:
          getActiveEnrollmentCount(parent.id),
      };
    })
    .filter((parent) => {
      if (!normalizedQuery) {
        return true;
      }

      const searchableValues = [
        parent.name || "",
        ...parent.linkedChildren.map(
          (child) => child.name
        ),
      ];

      return searchableValues.some(
        (value) =>
          value
            .toLowerCase()
            .includes(normalizedQuery)
      );
    });

  const totalChildren = children.length;

  const activeChildren =
    children.filter(
      (child) => child.is_active
    ).length;

  const parentsWithActiveEnrollment =
    parents.filter(
      (parent) =>
        getActiveEnrollmentCount(parent.id) >
        0
    ).length;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              letterSpacing: "-0.03em",
            }}
          >
            학부모 관리
          </h1>

          <p
            style={{
              marginTop: "9px",
              marginBottom: 0,
              opacity: 0.6,
            }}
          >
            학부모 계정과 연결된 자녀 및 수강 상태를 확인합니다.
          </p>
        </div>
      </div>

      <section
        style={{
          marginTop: "28px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
        }}
      >
        {[
          {
            label: "전체 학부모",
            value: parents.length,
          },
          {
            label: "전체 자녀",
            value: totalChildren,
          },
          {
            label: "활성 자녀",
            value: activeChildren,
          },
          {
            label: "수강중 자녀 보유",
            value:
              parentsWithActiveEnrollment,
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              padding: "16px",
              border:
                "1px solid #e2e8f0",
              borderRadius: "12px",
              background:
                "#ffffff",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                opacity: 0.58,
              }}
            >
              {item.label}
            </div>

            <div
              style={{
                marginTop: "8px",
                fontSize: "30px",
                fontWeight: 800,
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </section>

      <form
        method="get"
        style={{
          marginTop: "22px",
          padding: "18px",
          border:
            "1px solid #e2e8f0",
          borderRadius: "12px",
          display: "grid",
          gridTemplateColumns:
            "minmax(220px, 1fr) auto",
          gap: "10px",
          background:
            "#ffffff",
        }}
      >
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="학부모명 또는 자녀명 검색"
          style={{
            minWidth: 0,
            padding: "11px 12px",
            border:
              "1px solid #d7dee9",
            borderRadius: "8px",
            background: "#ffffff",
            color: "#172033",
          }}
        />

        <button
          type="submit"
          style={{
            padding: "11px 18px",
            border:
              "1px solid #d7dee9",
            borderRadius: "8px",
            background: "#0a1f44",
            color: "#ffffff",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          검색
        </button>
      </form>

      <section
        style={{
          marginTop: "18px",
          border:
            "1px solid #e2e8f0",
          borderRadius: "14px",
          overflow: "hidden",
          background:
            "#ffffff",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(170px, 1.1fr) minmax(220px, 1.5fr) 110px 120px 120px 90px",
            gap: "12px",
            padding: "14px 18px",
            borderBottom:
              "1px solid #e5eaf1",
            fontSize: "12px",
            fontWeight: 700,
            opacity: 0.55,
          }}
        >
          <div>학부모</div>
          <div>연결 자녀</div>
          <div>활성 자녀</div>
          <div>수강중 자녀</div>
          <div>가입일</div>
          <div />
        </div>

        {rows.length === 0 ? (
          <div
            style={{
              padding: "36px",
              textAlign: "center",
              opacity: 0.62,
            }}
          >
            조건에 맞는 학부모가 없습니다.
          </div>
        ) : (
          rows.map((parent) => (
            <div
              key={parent.id}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(170px, 1.1fr) minmax(220px, 1.5fr) 110px 120px 120px 90px",
                gap: "12px",
                alignItems: "center",
                padding: "13px 18px",
                borderBottom:
                  "1px solid #edf0f4",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 800,
                  }}
                >
                  {parent.name ||
                    "이름 미등록"}
                </div>

                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "12px",
                    opacity: 0.5,
                  }}
                >
                  학부모 계정
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {parent.linkedChildren.length > 0 ? (
                  parent.linkedChildren.map((child) => (
                    <Link
                      key={child.id}
                      href={`/admin/students/child/${child.id}`}
                      style={{
                        color: "#0a4f9e",
                        textDecoration: "none",
                        fontWeight: 700,
                      }}
                    >
                      {child.name}
                    </Link>
                  ))
                ) : (
                  <span style={{ color: "#8a94a6" }}>연결된 자녀 없음</span>
                )}
              </div>

              <div
                style={{
                  fontWeight: 700,
                }}
              >
                {parent.activeChildrenCount}
                명
              </div>

              <div
                style={{
                  fontWeight: 700,
                }}
              >
                {
                  parent.activeEnrollmentCount
                }
                건
              </div>

              <div>
                {formatDate(
                  parent.created_at
                )}
              </div>

              <Link
                href={`/admin/parents/${parent.id}`}
                style={{
                  textAlign: "center",
                  padding: "9px 10px",
                  border:
                    "1px solid #d7dee9",
                  borderRadius: "8px",
                  color: "inherit",
                  textDecoration: "none",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                상세 보기 →
              </Link>
            </div>
          ))
        )}
      </section>
    </div>
  );
}