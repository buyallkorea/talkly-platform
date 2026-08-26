import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import LevelTestStartPanel from "./LevelTestStartPanel";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type ChildRow = {
  id: number;
  name: string;
  grade: string | null;
  school_name: string | null;
};

type AttemptRow = {
  id: number;
  status: string;
  grammar_score: number | null;
  listening_score: number | null;
  total_score: number | null;
  grammar_level: number | null;
  listening_level: number | null;
  suggested_level: string | null;
  confidence: number | null;
  started_at: string | null;
  completed_at: string | null;
};

export default async function ParentLevelTestDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const levelTestId =
    Number(id);

  if (
    !Number.isInteger(levelTestId) ||
    levelTestId <= 0
  ) {
    notFound();
  }

  const supabase =
    await createClient();

  /*
   * =====================================================
   * 1. 로그인 확인
   * =====================================================
   */
  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /*
   * =====================================================
   * 2. 학부모 / 학생 확인
   * =====================================================
   */
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
    (
      profile.role !== "parent" &&
      profile.role !== "student"
    )
  ) {
    redirect("/");
  }

  const isStudent =
    profile.role === "student";

  /*
   * =====================================================
   * 3. 레벨테스트 본체
   * =====================================================
   */
  const {
    data: levelTest,
    error: levelTestError,
  } = await supabase
    .from("level_tests")
    .select(`
      id,
      child_id,
      student_user_id,
      parent_user_id,

      student_name,
      student_birth_date,
      student_age,
      school_name,
      grade,
      learning_history,
      learning_goal,

      status,
      test_type,
      target_group,

      score,

      ai_status,
      ai_suggested_level,
      ai_confidence,

      interview_required,
      interview_status,

      teacher_suggested_level,
      final_level,

      created_at,
      updated_at
    `)
    .eq(
      "id",
      levelTestId
    )
    .maybeSingle();

  if (levelTestError) {
    throw new Error(
      `레벨테스트 정보를 불러오지 못했습니다: ${levelTestError.message}`
    );
  }

  if (!levelTest) {
    notFound();
  }

  /*
   * =====================================================
   * 4. 접근 권한 확인
   *
   * 학부모:
   * 본인이 신청한 레벨테스트
   *
   * 학생:
   * 본인 student_user_id 또는
   * child 연결 학생
   * =====================================================
   */
  if (!isStudent) {
    if (
      levelTest.parent_user_id !==
      user.id
    ) {
      redirect("/parent");
    }
  }

  if (isStudent) {
    let studentHasAccess =
      levelTest.student_user_id ===
      user.id;

    if (
      !studentHasAccess &&
      levelTest.child_id
    ) {
      const {
        data: linkedChild,
        error: linkedChildError,
      } = await supabase
        .from("children")
        .select(`
          id,
          student_user_id,
          linked_student_user_id
        `)
        .eq(
          "id",
          levelTest.child_id
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle();

      if (linkedChildError) {
        throw new Error(
          `학생 연결 정보를 확인하지 못했습니다: ${linkedChildError.message}`
        );
      }

      studentHasAccess =
        linkedChild?.student_user_id ===
          user.id ||
        linkedChild?.linked_student_user_id ===
          user.id;
    }

    if (!studentHasAccess) {
      redirect("/student");
    }
  }

  /*
   * =====================================================
   * 5. 자녀 정보
   * =====================================================
   */
  let child:
    ChildRow | null = null;

  if (levelTest.child_id) {
    let childQuery =
      supabase
        .from("children")
        .select(`
          id,
          name,
          grade,
          school_name
        `)
        .eq(
          "id",
          levelTest.child_id
        );

    if (!isStudent) {
      childQuery =
        childQuery.eq(
          "parent_user_id",
          user.id
        );
    }

    const {
      data: childData,
      error: childError,
    } =
      await childQuery.maybeSingle();

    if (childError) {
      throw new Error(
        `학생 정보를 불러오지 못했습니다: ${childError.message}`
      );
    }

    child =
      childData as
        ChildRow | null;
  }

  /*
   * 신청 당시 저장된 정보를 우선 사용하고,
   * 과거 데이터는 children 정보를 fallback으로 사용
   */
  const studentName =
    levelTest.student_name ||
    child?.name ||
    "학생";

  const studentGrade =
    levelTest.grade ||
    child?.grade ||
    "-";

  const studentSchool =
    levelTest.school_name ||
    child?.school_name ||
    "-";

  const studentAge =
    levelTest.student_age
      ? `${levelTest.student_age}세`
      : levelTest.student_birth_date
        ? `${calculateAge(
            levelTest.student_birth_date
          )}세`
        : "-";

  /*
   * =====================================================
   * 6. 가장 최근 응시 기록
   *
   * 온라인 결과도 여기서 읽습니다.
   * =====================================================
   */
  const {
    data: attemptsData,
    error: attemptsError,
  } = await supabase
    .from("level_test_attempts")
    .select(`
      id,
      status,

      grammar_score,
      listening_score,
      total_score,

      grammar_level,
      listening_level,

      suggested_level,
      confidence,

      started_at,
      completed_at,

      created_at
    `)
    .eq(
      "level_test_id",
      levelTestId
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (attemptsError) {
    throw new Error(
      `레벨테스트 응시 기록을 불러오지 못했습니다: ${attemptsError.message}`
    );
  }

  const latestAttempt:
    AttemptRow | null =
    attemptsData &&
    attemptsData.length > 0
      ? attemptsData[0]
      : null;

  /*
   * =====================================================
   * 7. 온라인 테스트 완료 여부
   * =====================================================
   */
  const completed =
    levelTest.ai_status ===
      "completed" ||
    latestAttempt?.status ===
      "completed" ||
    levelTest.status ===
      "admin_review" ||
    levelTest.status ===
      "interview_required" ||
    levelTest.status ===
      "interview_scheduled" ||
    levelTest.status ===
      "interview_completed" ||
    levelTest.status ===
      "completed";

  /*
   * 실제 화면에 보여줄 온라인 결과
   *
   * attempt 결과를 우선 사용하고,
   * 요약값은 level_tests를 fallback으로 사용
   */
  const grammarScore =
    latestAttempt
      ?.grammar_score ??
    null;

  const listeningScore =
    latestAttempt
      ?.listening_score ??
    null;

  const totalScore =
    latestAttempt
      ?.total_score ??
    levelTest.score ??
    null;

  const grammarLevel =
    latestAttempt
      ?.grammar_level ??
    null;

  const listeningLevel =
    latestAttempt
      ?.listening_level ??
    null;

  const suggestedLevel =
    latestAttempt
      ?.suggested_level ||
    levelTest.ai_suggested_level ||
    null;

  const confidence =
    latestAttempt
      ?.confidence ??
    levelTest.ai_confidence ??
    null;

  const hasResult =
    completed &&
    (
      totalScore !== null ||
      grammarScore !== null ||
      listeningScore !== null ||
      suggestedLevel !== null
    );

  /*
   * =====================================================
   * 8. 화상레벨테스트 신청 여부 확인
   *
   * 우리가 새로 만든 희망 수업계획 테이블을
   * 읽기만 합니다.
   *
   * 아직 신청 페이지는 다음 작업에서 만듭니다.
   * =====================================================
   */
  const {
    data: preference,
    error: preferenceError,
  } = await supabase
    .from(
      "level_test_class_preferences"
    )
    .select(`
      id,
      status,
      created_at
    `)
    .eq(
      "level_test_id",
      levelTestId
    )
    .maybeSingle();

  /*
   * 아직 RLS를 다음 작업에서 정리할 예정이므로
   * 권한 문제로 조회가 실패하더라도
   * 기존 레벨테스트 페이지 전체를 깨뜨리지 않습니다.
   */
  const hasInterviewRequest =
    !preferenceError &&
    Boolean(preference);

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
        href={
          isStudent
            ? "/student"
            : "/parent"
        }
        style={{
          color: "#667085",
          textDecoration:
            "none",
          fontSize: "13px",
          fontWeight: 800,
        }}
      >
        {isStudent
          ? "← 내 강의실"
          : "← 내 강의실"}
      </Link>

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <div
        style={{
          marginTop: "24px",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
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
            온라인 레벨테스트
          </h1>

          <p
            style={{
              margin:
                "14px 0 0",
              color: "#667085",
              fontSize: "14px",
              lineHeight: 1.8,
            }}
          >
            Grammar와 Listening을
            중심으로 현재 영어 수준을
            확인합니다.
          </p>
        </div>

        <StatusBadge
          label={getParentStatusLabel(
            levelTest.status,
            levelTest.ai_status,
            hasInterviewRequest
          )}
        />
      </div>

      {/* ================================================= */}
      {/* 학생 정보 */}
      {/* ================================================= */}

      <section
        style={{
          marginTop: "28px",
          padding: "24px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "16px",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#101828",
              fontSize: "19px",
            }}
          >
            테스트 대상
          </h2>

          <span
            style={{
              padding:
                "5px 9px",
              borderRadius:
                "999px",
              background:
                "#f2f4f7",
              color: "#667085",
              fontSize: "10px",
              fontWeight: 800,
            }}
          >
            {levelTest.child_id
              ? "등록 자녀"
              : "레벨테스트 신청자"}
          </span>
        </div>

        <div
          style={{
            marginTop: "20px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "16px",
          }}
        >
          <InfoItem
            label="학생"
            value={studentName}
          />

          <InfoItem
            label="학년"
            value={studentGrade}
          />

          <InfoItem
            label="나이"
            value={studentAge}
          />

          <InfoItem
            label="학교"
            value={studentSchool}
          />
        </div>

        <div
          style={{
            marginTop: "18px",
            paddingTop: "18px",
            borderTop:
              "1px solid #eaecf0",
          }}
        >
          <InfoItem
            label="테스트 유형"
            value={getTargetGroupLabel(
              levelTest.target_group
            )}
          />
        </div>
      </section>

      {/* ================================================= */}
      {/* 학습정보 */}
      {/* ================================================= */}

      {(levelTest.learning_history ||
        levelTest.learning_goal) && (
        <section
          style={{
            marginTop: "22px",
            padding: "24px",
            border:
              "1px solid #e4e7ec",
            borderRadius:
              "16px",
            background:
              "#ffffff",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#101828",
              fontSize: "19px",
            }}
          >
            학습 정보
          </h2>

          {levelTest.learning_history && (
            <TextInfo
              label="영어 학습경력"
              value={
                levelTest.learning_history
              }
            />
          )}

          {levelTest.learning_goal && (
            <TextInfo
              label="영어 학습 목표"
              value={
                levelTest.learning_goal
              }
            />
          )}
        </section>
      )}

      {/* ================================================= */}
      {/* 응시 전 */}
      {/* ================================================= */}

      {!completed && (
        <>
          <section
            style={{
              marginTop: "22px",
              padding: "22px",
              border:
                "1px solid #dbe7ff",
              borderRadius:
                "14px",
              background:
                "#f5f8ff",
            }}
          >
            <div
              style={{
                color: "#2f6fed",
                fontSize: "13px",
                fontWeight: 900,
              }}
            >
              테스트 전 확인해주세요
            </div>

            <div
              style={{
                marginTop: "12px",
                display: "flex",
                flexDirection:
                  "column",
                gap: "8px",
                color: "#667085",
                fontSize: "12px",
                lineHeight: 1.7,
              }}
            >
              <div>
                • 실제 테스트를 받을 학생이
                직접 문제를 풀어주세요.
              </div>

              <div>
                • 조용한 장소에서 테스트를
                진행해주세요.
              </div>

              <div>
                • Listening 문제가 있으므로
                스피커 또는 이어폰을
                준비해주세요.
              </div>

              <div>
                • 다른 사람의 도움이나
                번역기를 사용하면 정확한
                레벨 판단이 어렵습니다.
              </div>

              <div>
                • 테스트 결과는 완료 즉시
                내 강의실에서 확인할 수
                있습니다.
              </div>
            </div>
          </section>

          <LevelTestStartPanel
            levelTestId={
              levelTest.id
            }
            parentUserId={
              levelTest.parent_user_id
            }
            childId={
              levelTest.child_id
            }
            targetGroup={
              levelTest.target_group
            }
            aiStatus={
              levelTest.ai_status
            }
            status={
              levelTest.status
            }
            latestAttempt={
              latestAttempt
                ? {
                    id:
                      latestAttempt.id,
                    status:
                      latestAttempt.status,
                  }
                : null
            }
          />
        </>
      )}

      {/* ================================================= */}
      {/* 온라인 테스트 결과 */}
      {/* ================================================= */}

      {completed && (
        <section
          style={{
            marginTop: "22px",
            padding: "28px",
            border:
              "1px solid #dbe7ff",
            borderRadius: "18px",
            background:
              "linear-gradient(135deg, #ffffff 0%, #f4f8ff 100%)",
            boxShadow:
              "0 12px 34px rgba(47,111,237,0.07)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "flex-start",
              gap: "18px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  color: "#2f6fed",
                  fontSize: "11px",
                  fontWeight: 900,
                  letterSpacing:
                    "0.08em",
                }}
              >
                ONLINE LEVEL TEST RESULT
              </div>

              <h2
                style={{
                  margin:
                    "8px 0 0",
                  color: "#101828",
                  fontSize: "25px",
                  letterSpacing:
                    "-0.03em",
                }}
              >
                {studentName}님의
                온라인 레벨테스트 결과
              </h2>

              <p
                style={{
                  margin:
                    "10px 0 0",
                  color: "#667085",
                  fontSize: "13px",
                  lineHeight: 1.75,
                }}
              >
                Grammar와 Listening의
                적응형 테스트 결과를
                종합한 TALKLY 온라인
                추천 레벨입니다.
              </p>
            </div>

            {suggestedLevel && (
              <div
                style={{
                  minWidth: "120px",
                  padding:
                    "16px 18px",
                  borderRadius:
                    "14px",
                  background:
                    "#2f6fed",
                  color: "#ffffff",
                  textAlign:
                    "center",
                }}
              >
                <div
                  style={{
                    fontSize:
                      "10px",
                    fontWeight: 800,
                    opacity: 0.82,
                  }}
                >
                  RECOMMENDED
                </div>

                <div
                  style={{
                    marginTop:
                      "5px",
                    fontSize:
                      "24px",
                    fontWeight: 900,
                  }}
                >
                  {suggestedLevel}
                </div>
              </div>
            )}
          </div>

          {hasResult ? (
            <>
              <div
                style={{
                  marginTop: "24px",
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(135px, 1fr))",
                  gap: "12px",
                }}
              >
                <ResultCard
                  label="Grammar"
                  score={
                    grammarScore
                  }
                  level={
                    grammarLevel
                  }
                />

                <ResultCard
                  label="Listening"
                  score={
                    listeningScore
                  }
                  level={
                    listeningLevel
                  }
                />

                <ResultCard
                  label="Overall"
                  score={
                    totalScore
                  }
                  level={null}
                />

                <div
                  style={{
                    padding:
                      "18px",
                    border:
                      "1px solid #e4e7ec",
                    borderRadius:
                      "13px",
                    background:
                      "#ffffff",
                  }}
                >
                  <div
                    style={{
                      color: "#98a2b3",
                      fontSize:
                        "10px",
                      fontWeight: 800,
                    }}
                  >
                    RESULT CONFIDENCE
                  </div>

                  <div
                    style={{
                      marginTop:
                        "8px",
                      color: "#101828",
                      fontSize:
                        "24px",
                      fontWeight: 900,
                    }}
                  >
                    {confidence !== null
                      ? `${confidence}%`
                      : "-"}
                  </div>

                  <div
                    style={{
                      marginTop:
                        "5px",
                      color: "#667085",
                      fontSize:
                        "11px",
                      lineHeight:
                        1.5,
                    }}
                  >
                    온라인 테스트 결과의
                    안정성을 나타냅니다.
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: "20px",
                  padding:
                    "15px 17px",
                  borderRadius:
                    "11px",
                  background:
                    "#ffffff",
                  border:
                    "1px solid #e4e7ec",
                  color: "#667085",
                  fontSize: "12px",
                  lineHeight: 1.75,
                }}
              >
                온라인 테스트 결과는
                Grammar와 Listening을
                중심으로 산출된
                <strong
                  style={{
                    color: "#344054",
                  }}
                >
                  {" "}
                  1차 레벨 결과
                </strong>
                입니다. 실제 말하기,
                발음, 의사소통 능력까지
                확인하려면 무료 원어민
                화상레벨테스트를 함께
                진행하는 것을 권장합니다.
              </div>
            </>
          ) : (
            <div
              style={{
                marginTop: "22px",
                padding: "18px",
                borderRadius:
                  "12px",
                border:
                  "1px solid #fedf89",
                background:
                  "#fffaeb",
                color: "#93370d",
                fontSize: "12px",
                lineHeight: 1.7,
              }}
            >
              온라인 테스트는 완료되었지만
              결과 데이터가 아직 생성되지
              않았습니다. 기존 테스트 기록일
              경우 관리자에게 문의해주세요.
            </div>
          )}
        </section>
      )}

      {/* ================================================= */}
      {/* 다음 단계 */}
      {/* ================================================= */}

      {completed && (
        <section
          style={{
            marginTop: "22px",
            padding: "26px",
            border:
              "1px solid #e4e7ec",
            borderRadius: "16px",
            background: "#ffffff",
          }}
        >
          <div
            style={{
              color: "#101828",
              fontSize: "20px",
              fontWeight: 900,
            }}
          >
            다음 단계
          </div>

          <p
            style={{
              margin:
                "10px 0 0",
              color: "#667085",
              fontSize: "13px",
              lineHeight: 1.8,
            }}
          >
            TALKLY는 보다 정확한
            레벨 확인을 위해 무료 원어민
            화상레벨테스트를 권장합니다.
            화상레벨테스트 신청 시 앞으로
            희망하는 정규수업 조건도 함께
            알려주세요.
          </p>

          {hasInterviewRequest ? (
            <div
              style={{
                marginTop: "20px",
                padding:
                  "17px 18px",
                border:
                  "1px solid #abefc6",
                borderRadius:
                  "12px",
                background:
                  "#ecfdf3",
                color: "#067647",
                fontSize: "13px",
                lineHeight: 1.7,
                fontWeight: 800,
              }}
            >
              원어민 화상레벨테스트 신청이
              접수되었습니다. TALKLY
              관리자가 신청 내용을 확인한
              후 상담 및 테스트 일정을
              안내합니다.
            </div>
          ) : (
            <div
              style={{
                marginTop: "20px",
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <Link
                href={`/parent/level-tests/${levelTestId}/interview-request`}
                style={{
                  minHeight: "48px",
                  padding:
                    "0 20px",
                  display:
                    "inline-flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  borderRadius:
                    "10px",
                  background:
                    "#2f6fed",
                  color: "#ffffff",
                  textDecoration:
                    "none",
                  fontSize: "14px",
                  fontWeight: 900,
                  boxShadow:
                    "0 8px 18px rgba(47,111,237,0.20)",
                }}
              >
                무료 원어민 화상레벨테스트 신청 →
              </Link>

              <div
                style={{
                  padding:
                    "10px 2px",
                  color: "#667085",
                  fontSize: "11px",
                  lineHeight: 1.6,
                }}
              >
                화상레벨테스트는 기본적으로
                필리핀 원어민 강사가
                진행합니다.
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: "18px",
              paddingTop: "18px",
              borderTop:
                "1px solid #eaecf0",
              color: "#667085",
              fontSize: "12px",
              lineHeight: 1.7,
            }}
          >
            화상레벨테스트를 받지 않고
            바로 수강을 원하는 경우에도
            향후 내 강의실에서 수강신청을
            진행할 수 있도록 연결할
            예정입니다.
          </div>
        </section>
      )}

      {/* ================================================= */}
      {/* 최종 레벨 */}
      {/* ================================================= */}

      {levelTest.final_level && (
        <section
          style={{
            marginTop: "22px",
            padding: "24px",
            border:
              "1px solid #abefc6",
            borderRadius: "16px",
            background: "#ecfdf3",
          }}
        >
          <div
            style={{
              color: "#067647",
              fontSize: "12px",
              fontWeight: 900,
            }}
          >
            TALKLY FINAL LEVEL
          </div>

          <div
            style={{
              marginTop: "7px",
              color: "#065f46",
              fontSize: "25px",
              fontWeight: 900,
            }}
          >
            {levelTest.final_level}
          </div>

          <div
            style={{
              marginTop: "7px",
              color: "#047857",
              fontSize: "12px",
              lineHeight: 1.7,
            }}
          >
            온라인 레벨테스트와 원어민
            화상평가를 종합하여 확정된
            TALKLY 최종 레벨입니다.
          </div>
        </section>
      )}

      <div
        style={{
          marginTop: "24px",
        }}
      >
        <Link
          href={
            isStudent
              ? "/student"
              : "/parent"
          }
          style={
            secondaryButtonStyle
          }
        >
          ← 내 강의실
        </Link>
      </div>
    </main>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={{
          color: "#98a2b3",
          fontSize: "11px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "7px",
          color: "#101828",
          fontSize: "14px",
          fontWeight: 900,
          lineHeight: 1.6,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TextInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        marginTop: "18px",
        padding: "16px",
        border:
          "1px solid #eaecf0",
        borderRadius: "11px",
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          color: "#667085",
          fontSize: "11px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "7px",
          color: "#344054",
          fontSize: "13px",
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ResultCard({
  label,
  score,
  level,
}: {
  label: string;
  score: number | null;
  level: number | null;
}) {
  return (
    <div
      style={{
        padding: "18px",
        border:
          "1px solid #e4e7ec",
        borderRadius: "13px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          color: "#98a2b3",
          fontSize: "10px",
          fontWeight: 800,
          textTransform:
            "uppercase",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "8px",
          display: "flex",
          alignItems:
            "baseline",
          gap: "6px",
        }}
      >
        <span
          style={{
            color: "#101828",
            fontSize: "26px",
            fontWeight: 900,
          }}
        >
          {score !== null
            ? score
            : "-"}
        </span>

        {score !== null && (
          <span
            style={{
              color: "#98a2b3",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            / 100
          </span>
        )}
      </div>

      {level !== null && (
        <div
          style={{
            marginTop: "6px",
            color: "#2f6fed",
            fontSize: "12px",
            fontWeight: 900,
          }}
        >
          Level {level}
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  label,
}: {
  label: string;
}) {
  return (
    <span
      style={{
        minHeight: "30px",
        padding: "0 11px",
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        background: "#eef4ff",
        color: "#2f6fed",
        fontSize: "11px",
        fontWeight: 900,
      }}
    >
      {label}
    </span>
  );
}

function getParentStatusLabel(
  status: string,
  aiStatus: string,
  hasInterviewRequest: boolean
) {
  if (
    aiStatus === "pending"
  ) {
    return "테스트 대기";
  }

  if (
    aiStatus ===
    "in_progress"
  ) {
    return "테스트 진행 중";
  }

  if (
    status ===
      "interview_scheduled"
  ) {
    return "화상테스트 일정 확정";
  }

  if (
    status ===
      "interview_completed"
  ) {
    return "화상테스트 완료";
  }

  if (
    status === "completed"
  ) {
    return "레벨 확정";
  }

  if (
    hasInterviewRequest
  ) {
    return "화상테스트 신청 완료";
  }

  if (
    aiStatus ===
      "completed" ||
    status ===
      "admin_review" ||
    status ===
      "interview_required"
  ) {
    return "온라인 테스트 완료";
  }

  return "신청 완료";
}

function getTargetGroupLabel(
  value: string | null
) {
  switch (value) {
    case "elementary":
      return "초등 영어";

    case "middle":
      return "중등 영어";

    case "high":
      return "고등 영어";

    case "adult":
      return "대학생·성인 영어";

    default:
      return value || "-";
  }
}

function calculateAge(
  birthDate: string
) {
  const today =
    new Date();

  const birth =
    new Date(
      `${birthDate}T00:00:00`
    );

  let age =
    today.getFullYear() -
    birth.getFullYear();

  const monthDifference =
    today.getMonth() -
    birth.getMonth();

  if (
    monthDifference < 0 ||
    (
      monthDifference === 0 &&
      today.getDate() <
        birth.getDate()
    )
  ) {
    age -= 1;
  }

  return age;
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