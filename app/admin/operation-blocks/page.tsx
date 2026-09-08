import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

type OperationBlockRow = {
  id: number;
  block_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function formatDateKorean(date: string) {
  const parsed = new Date(`${date}T00:00:00+09:00`);

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  }).format(parsed);
}

function normalizeTime(value: string | null) {
  if (!value) {
    return null;
  }

  return value.slice(0, 5);
}

function compareTime(
  start: string,
  end: string
) {
  const [startHour, startMinute] = start
    .split(":")
    .map(Number);

  const [endHour, endMinute] = end
    .split(":")
    .map(Number);

  const startTotal =
    startHour * 60 + startMinute;

  const endTotal =
    endHour * 60 + endMinute;

  return startTotal < endTotal;
}

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  return user;
}

async function createOperationBlock(
  formData: FormData
) {
  "use server";

  const user = await requireAdmin();

  const blockDate = String(
    formData.get("block_date") ?? ""
  ).trim();

  const blockType = String(
    formData.get("block_type") ?? ""
  ).trim();

  const startTime = String(
    formData.get("start_time") ?? ""
  ).trim();

  const endTime = String(
    formData.get("end_time") ?? ""
  ).trim();

  const reason =
    String(
      formData.get("reason") ?? ""
    ).trim() || null;

  if (!blockDate) {
    throw new Error(
      "운영중단 날짜를 선택해 주세요."
    );
  }

  if (
    blockType !== "full_day" &&
    blockType !== "partial"
  ) {
    throw new Error(
      "운영중단 유형을 확인해 주세요."
    );
  }

  let saveStartTime: string | null = null;
  let saveEndTime: string | null = null;

  if (blockType === "partial") {
    if (!startTime || !endTime) {
      throw new Error(
        "시간 지정 중단은 시작시간과 종료시간이 필요합니다."
      );
    }

    if (!compareTime(startTime, endTime)) {
      throw new Error(
        "종료시간은 시작시간보다 늦어야 합니다."
      );
    }

    saveStartTime = startTime;
    saveEndTime = endTime;
  }

  const admin = createAdminClient();

  /*
   * 같은 날짜의 동일한 운영중단이 이미 존재하는지 확인합니다.
   * 비활성화된 기존 행이 있으면 새 행을 만들지 않고 다시 활성화합니다.
   */
  let duplicateQuery = admin
    .from("class_operation_blocks")
    .select(
      `
        id,
        is_active
      `
    )
    .eq("block_date", blockDate);

  if (saveStartTime === null) {
    duplicateQuery =
      duplicateQuery.is("start_time", null);
  } else {
    duplicateQuery =
      duplicateQuery.eq(
        "start_time",
        saveStartTime
      );
  }

  if (saveEndTime === null) {
    duplicateQuery =
      duplicateQuery.is("end_time", null);
  } else {
    duplicateQuery =
      duplicateQuery.eq(
        "end_time",
        saveEndTime
      );
  }

  const { data: existingRows, error: existingError } =
    await duplicateQuery.limit(1);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existing = existingRows?.[0];

  if (existing) {
    const { error } = await admin
      .from("class_operation_blocks")
      .update({
        reason,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const { error } = await admin
      .from("class_operation_blocks")
      .insert({
        block_date: blockDate,
        start_time: saveStartTime,
        end_time: saveEndTime,
        reason,
        is_active: true,
        created_by: user.id,
      });

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/admin/operation-blocks");
}

async function deactivateOperationBlock(
  formData: FormData
) {
  "use server";

  await requireAdmin();

  const id = Number(
    formData.get("block_id")
  );

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(
      "운영중단 정보가 올바르지 않습니다."
    );
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("class_operation_blocks")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/operation-blocks");
}

async function reactivateOperationBlock(
  formData: FormData
) {
  "use server";

  await requireAdmin();

  const id = Number(
    formData.get("block_id")
  );

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(
      "운영중단 정보가 올바르지 않습니다."
    );
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("class_operation_blocks")
    .update({
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/operation-blocks");
}

export default async function OperationBlocksPage() {
  await requireAdmin();

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("class_operation_blocks")
    .select(
      `
        id,
        block_date,
        start_time,
        end_time,
        reason,
        is_active,
        created_by,
        created_at,
        updated_at
      `
    )
    .order("block_date", {
      ascending: true,
    })
    .order("start_time", {
      ascending: true,
      nullsFirst: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  const rows =
    (data ?? []) as OperationBlockRow[];

  const today = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date());

  const activeRows = rows.filter(
    (row) => row.is_active
  );

  const upcomingRows = activeRows.filter(
    (row) => row.block_date >= today
  );

  const pastRows = activeRows.filter(
    (row) => row.block_date < today
  );

  const inactiveRows = rows.filter(
    (row) => !row.is_active
  );

  const fullDayUpcomingCount =
    upcomingRows.filter(
      (row) =>
        !row.start_time &&
        !row.end_time
    ).length;

  const partialUpcomingCount =
    upcomingRows.filter(
      (row) =>
        row.start_time &&
        row.end_time
    ).length;

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f7f9fc 0%, #eef3f9 100%)",
        padding: "34px 24px 70px",
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <section
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "flex-start",
            gap: 20,
            marginBottom: 24,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#53719d",
                letterSpacing: "0.08em",
                marginBottom: 8,
              }}
            >
              OPERATION BLOCKS
            </div>

            <h1
              style={{
                margin: 0,
                color: "#0a1f44",
                fontSize: 32,
                lineHeight: 1.25,
              }}
            >
              운영일 · 휴무 관리
            </h1>

            <p
              style={{
                margin: "10px 0 0",
                color: "#64748b",
                fontSize: 14,
                lineHeight: 1.7,
              }}
            >
              전체 휴무일 또는 특정 시간의
              수업 운영중단을 관리합니다.
            </p>
          </div>

          <a
            href="/admin"
            style={{
              textDecoration: "none",
              color: "#475569",
              fontSize: 14,
              fontWeight: 700,
              border:
                "1px solid #dbe3ee",
              background: "#ffffff",
              borderRadius: 12,
              padding: "11px 15px",
            }}
          >
            ← 관리자 홈
          </a>
        </section>

        {/* Summary */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 14,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border:
                "1px solid #e2e8f0",
              borderRadius: 18,
              padding: 20,
            }}
          >
            <div
              style={{
                color: "#7a889c",
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 9,
              }}
            >
              예정 운영중단
            </div>

            <div
              style={{
                color: "#0a1f44",
                fontSize: 28,
                fontWeight: 900,
              }}
            >
              {upcomingRows.length}
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border:
                "1px solid #e2e8f0",
              borderRadius: 18,
              padding: 20,
            }}
          >
            <div
              style={{
                color: "#7a889c",
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 9,
              }}
            >
              전체 휴무
            </div>

            <div
              style={{
                color: "#0a1f44",
                fontSize: 28,
                fontWeight: 900,
              }}
            >
              {fullDayUpcomingCount}
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border:
                "1px solid #e2e8f0",
              borderRadius: 18,
              padding: 20,
            }}
          >
            <div
              style={{
                color: "#7a889c",
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 9,
              }}
            >
              시간 지정 중단
            </div>

            <div
              style={{
                color: "#0a1f44",
                fontSize: 28,
                fontWeight: 900,
              }}
            >
              {partialUpcomingCount}
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border:
                "1px solid #e2e8f0",
              borderRadius: 18,
              padding: 20,
            }}
          >
            <div
              style={{
                color: "#7a889c",
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 9,
              }}
            >
              비활성 기록
            </div>

            <div
              style={{
                color: "#0a1f44",
                fontSize: 28,
                fontWeight: 900,
              }}
            >
              {inactiveRows.length}
            </div>
          </div>
        </section>

        {/* Notice */}
        <section
          style={{
            borderRadius: 18,
            padding: "18px 20px",
            background: "#eef5ff",
            border:
              "1px solid #d5e5fb",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              color: "#153c75",
              fontSize: 14,
              fontWeight: 800,
              marginBottom: 5,
            }}
          >
            운영중단 적용 기준
          </div>

          <div
            style={{
              color: "#52657e",
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            등록된 운영중단 시간은 강사
            가능시간 조회와 레벨테스트
            가능시간 조회에서 제외됩니다.
            전체 휴무일은 시작·종료시간 없이
            날짜 전체가 차단됩니다.
          </div>
        </section>

        {/* Register */}
        <section
          style={{
            background: "#ffffff",
            border:
              "1px solid #e2e8f0",
            borderRadius: 22,
            overflow: "hidden",
            boxShadow:
              "0 8px 30px rgba(15, 23, 42, 0.04)",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              padding: "22px 24px",
              borderBottom:
                "1px solid #edf1f5",
            }}
          >
            <h2
              style={{
                margin: 0,
                color: "#0f274f",
                fontSize: 20,
              }}
            >
              운영중단 등록
            </h2>

            <p
              style={{
                margin: "7px 0 0",
                color: "#7a889c",
                fontSize: 13,
              }}
            >
              휴무일 또는 일부 운영중단
              시간을 등록합니다.
            </p>
          </div>

          <form
            action={createOperationBlock}
            style={{
              padding: 24,
              display: "grid",
              gap: 20,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              <label>
                <span
                  style={{
                    display: "block",
                    color: "#5e6c80",
                    fontSize: 12,
                    fontWeight: 800,
                    marginBottom: 7,
                  }}
                >
                  날짜
                </span>

                <input
                  type="date"
                  name="block_date"
                  required
                  style={{
                    width: "100%",
                    boxSizing:
                      "border-box",
                    border:
                      "1px solid #d9e1eb",
                    borderRadius: 11,
                    padding:
                      "12px 13px",
                    fontSize: 14,
                    color: "#1e293b",
                    background:
                      "#ffffff",
                  }}
                />
              </label>

              <label>
                <span
                  style={{
                    display: "block",
                    color: "#5e6c80",
                    fontSize: 12,
                    fontWeight: 800,
                    marginBottom: 7,
                  }}
                >
                  운영중단 유형
                </span>

                <select
                  name="block_type"
                  required
                  defaultValue="full_day"
                  style={{
                    width: "100%",
                    boxSizing:
                      "border-box",
                    border:
                      "1px solid #d9e1eb",
                    borderRadius: 11,
                    padding:
                      "12px 13px",
                    fontSize: 14,
                    color: "#1e293b",
                    background:
                      "#ffffff",
                  }}
                >
                  <option value="full_day">
                    전체 휴무
                  </option>

                  <option value="partial">
                    특정 시간 운영중단
                  </option>
                </select>
              </label>

              <label>
                <span
                  style={{
                    display: "block",
                    color: "#5e6c80",
                    fontSize: 12,
                    fontWeight: 800,
                    marginBottom: 7,
                  }}
                >
                  시작시간
                </span>

                <input
                  type="time"
                  name="start_time"
                  step="1800"
                  style={{
                    width: "100%",
                    boxSizing:
                      "border-box",
                    border:
                      "1px solid #d9e1eb",
                    borderRadius: 11,
                    padding:
                      "12px 13px",
                    fontSize: 14,
                    color: "#1e293b",
                  }}
                />

                <div
                  style={{
                    color: "#94a3b8",
                    fontSize: 11,
                    marginTop: 6,
                  }}
                >
                  전체 휴무일이면 입력하지
                  않아도 됩니다.
                </div>
              </label>

              <label>
                <span
                  style={{
                    display: "block",
                    color: "#5e6c80",
                    fontSize: 12,
                    fontWeight: 800,
                    marginBottom: 7,
                  }}
                >
                  종료시간
                </span>

                <input
                  type="time"
                  name="end_time"
                  step="1800"
                  style={{
                    width: "100%",
                    boxSizing:
                      "border-box",
                    border:
                      "1px solid #d9e1eb",
                    borderRadius: 11,
                    padding:
                      "12px 13px",
                    fontSize: 14,
                    color: "#1e293b",
                  }}
                />

                <div
                  style={{
                    color: "#94a3b8",
                    fontSize: 11,
                    marginTop: 6,
                  }}
                >
                  예: 12:00 ~ 14:00
                </div>
              </label>
            </div>

            <label>
              <span
                style={{
                  display: "block",
                  color: "#5e6c80",
                  fontSize: 12,
                  fontWeight: 800,
                  marginBottom: 7,
                }}
              >
                사유
              </span>

              <input
                type="text"
                name="reason"
                maxLength={200}
                placeholder="예: 추석 연휴, 서버 점검, 사내 행사"
                style={{
                  width: "100%",
                  boxSizing:
                    "border-box",
                  border:
                    "1px solid #d9e1eb",
                  borderRadius: 11,
                  padding:
                    "12px 13px",
                  fontSize: 14,
                  color: "#1e293b",
                }}
              />
            </label>

            <div
              style={{
                display: "flex",
                justifyContent:
                  "flex-end",
              }}
            >
              <button
                type="submit"
                style={{
                  border: 0,
                  borderRadius: 11,
                  padding:
                    "12px 20px",
                  background:
                    "#0a1f44",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                운영중단 등록
              </button>
            </div>
          </form>
        </section>

        {/* Upcoming */}
        <section
          style={{
            background: "#ffffff",
            border:
              "1px solid #e2e8f0",
            borderRadius: 22,
            overflow: "hidden",
            boxShadow:
              "0 8px 30px rgba(15, 23, 42, 0.04)",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              padding: "22px 24px",
              borderBottom:
                "1px solid #edf1f5",
            }}
          >
            <h2
              style={{
                margin: 0,
                color: "#0f274f",
                fontSize: 20,
              }}
            >
              예정된 운영중단
            </h2>

            <p
              style={{
                margin: "7px 0 0",
                color: "#7a889c",
                fontSize: 13,
              }}
            >
              오늘 이후 적용되는 활성
              운영중단입니다.
            </p>
          </div>

          {upcomingRows.length === 0 ? (
            <div
              style={{
                padding: "42px 24px",
                textAlign: "center",
                color: "#8794a5",
                fontSize: 13,
              }}
            >
              예정된 운영중단이 없습니다.
            </div>
          ) : (
            <div>
              {upcomingRows.map(
                (row, index) => {
                  const fullDay =
                    !row.start_time &&
                    !row.end_time;

                  return (
                    <div
                      key={row.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "minmax(220px, 1.2fr) minmax(180px, 0.9fr) minmax(220px, 1.4fr) auto",
                        gap: 18,
                        alignItems:
                          "center",
                        padding:
                          "18px 24px",
                        borderTop:
                          index === 0
                            ? "none"
                            : "1px solid #edf1f5",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color:
                              "#112b55",
                            fontSize: 14,
                            fontWeight: 800,
                          }}
                        >
                          {formatDateKorean(
                            row.block_date
                          )}
                        </div>

                        <div
                          style={{
                            marginTop: 5,
                            color:
                              "#8a97a8",
                            fontSize: 11,
                          }}
                        >
                          #{row.id}
                        </div>
                      </div>

                      <div>
                        <span
                          style={{
                            display:
                              "inline-flex",
                            alignItems:
                              "center",
                            borderRadius: 999,
                            padding:
                              "6px 10px",
                            background:
                              fullDay
                                ? "#fff1f2"
                                : "#fff7e8",
                            color:
                              fullDay
                                ? "#b4233c"
                                : "#97600c",
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          {fullDay
                            ? "전체 휴무"
                            : `${normalizeTime(
                                row.start_time
                              )} ~ ${normalizeTime(
                                row.end_time
                              )}`}
                        </span>
                      </div>

                      <div
                        style={{
                          color:
                            "#637286",
                          fontSize: 13,
                        }}
                      >
                        {row.reason ||
                          "등록된 사유 없음"}
                      </div>

                      <form
                        action={
                          deactivateOperationBlock
                        }
                      >
                        <input
                          type="hidden"
                          name="block_id"
                          value={row.id}
                        />

                        <button
                          type="submit"
                          style={{
                            border:
                              "1px solid #e0e6ee",
                            borderRadius: 10,
                            background:
                              "#ffffff",
                            color:
                              "#64748b",
                            padding:
                              "9px 13px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor:
                              "pointer",
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          해제
                        </button>
                      </form>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* Past + inactive */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(360px, 1fr))",
            gap: 18,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border:
                "1px solid #e2e8f0",
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "19px 21px",
                borderBottom:
                  "1px solid #edf1f5",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "#1b3156",
                  fontSize: 16,
                }}
              >
                지난 운영중단
              </h3>
            </div>

            {pastRows.length === 0 ? (
              <div
                style={{
                  padding: 22,
                  color: "#8995a5",
                  fontSize: 12,
                }}
              >
                지난 운영중단이 없습니다.
              </div>
            ) : (
              <div>
                {pastRows
                  .slice()
                  .reverse()
                  .slice(0, 8)
                  .map((row) => {
                    const fullDay =
                      !row.start_time &&
                      !row.end_time;

                    return (
                      <div
                        key={row.id}
                        style={{
                          padding:
                            "14px 20px",
                          borderTop:
                            "1px solid #f0f3f6",
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            gap: 12,
                          }}
                        >
                          <strong
                            style={{
                              color:
                                "#44546a",
                              fontSize: 12,
                            }}
                          >
                            {row.block_date}
                          </strong>

                          <span
                            style={{
                              color:
                                "#8290a2",
                              fontSize: 11,
                            }}
                          >
                            {fullDay
                              ? "전체 휴무"
                              : `${normalizeTime(
                                  row.start_time
                                )}~${normalizeTime(
                                  row.end_time
                                )}`}
                          </span>
                        </div>

                        <div
                          style={{
                            color:
                              "#94a3b8",
                            fontSize: 11,
                            marginTop: 5,
                          }}
                        >
                          {row.reason ||
                            "사유 없음"}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <div
            style={{
              background: "#ffffff",
              border:
                "1px solid #e2e8f0",
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "19px 21px",
                borderBottom:
                  "1px solid #edf1f5",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "#1b3156",
                  fontSize: 16,
                }}
              >
                해제된 운영중단
              </h3>
            </div>

            {inactiveRows.length === 0 ? (
              <div
                style={{
                  padding: 22,
                  color: "#8995a5",
                  fontSize: 12,
                }}
              >
                해제된 운영중단이 없습니다.
              </div>
            ) : (
              <div>
                {inactiveRows
                  .slice()
                  .reverse()
                  .slice(0, 8)
                  .map((row) => {
                    const fullDay =
                      !row.start_time &&
                      !row.end_time;

                    return (
                      <div
                        key={row.id}
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "center",
                          gap: 14,
                          padding:
                            "14px 20px",
                          borderTop:
                            "1px solid #f0f3f6",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              color:
                                "#44546a",
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            {row.block_date}
                            {" · "}
                            {fullDay
                              ? "전체 휴무"
                              : `${normalizeTime(
                                  row.start_time
                                )}~${normalizeTime(
                                  row.end_time
                                )}`}
                          </div>

                          <div
                            style={{
                              color:
                                "#94a3b8",
                              fontSize: 11,
                              marginTop: 4,
                            }}
                          >
                            {row.reason ||
                              "사유 없음"}
                          </div>
                        </div>

                        <form
                          action={
                            reactivateOperationBlock
                          }
                        >
                          <input
                            type="hidden"
                            name="block_id"
                            value={row.id}
                          />

                          <button
                            type="submit"
                            style={{
                              border:
                                "1px solid #dbe4ef",
                              borderRadius: 9,
                              background:
                                "#f8fafc",
                              color:
                                "#52647a",
                              padding:
                                "8px 11px",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor:
                                "pointer",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            다시 활성화
                          </button>
                        </form>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}