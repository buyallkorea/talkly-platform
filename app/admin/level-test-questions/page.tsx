import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase-server";

import LevelTestQuestionAudioManager from "@/components/admin/level-tests/LevelTestQuestionAudioManager";

type SearchParams = Promise<{
  target_group?: string;
  category?: string;
  difficulty?: string;
}>;

type QuestionRow = {
  id: number;
  target_group: string;
  category: string;
  difficulty: number;
  question_text: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  audio_script: string | null;
  audio_url: string | null;
  is_active: boolean;
};

const TARGET_GROUPS = [
  {
    value: "early_kids",
    label: "7세~초2",
  },
  {
    value: "elementary",
    label: "초3~초6",
  },
  {
    value: "secondary",
    label: "중·고등",
  },
  {
    value: "adult",
    label: "성인",
  },
];

function getTargetGroupLabel(
  value: string
) {
  return (
    TARGET_GROUPS.find(
      (item) =>
        item.value === value
    )?.label ||
    value ||
    "미지정"
  );
}

function getCategoryLabel(
  category: string,
  targetGroup: string
) {
  if (category === "listening") {
    return "Listening";
  }

  if (
    category === "grammar" &&
    targetGroup === "early_kids"
  ) {
    return "Words & Sentences";
  }

  if (category === "grammar") {
    return "Grammar";
  }

  return category;
}

export default async function AdminLevelTestQuestionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase =
    await createClient();

  /*
   * ==========================================
   * 관리자 권한 확인
   * ==========================================
   */
  const {
    data: { user },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (
    userError ||
    !user
  ) {
    redirect("/login");
  }

  const {
    data: profile,
    error: profileError,
  } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin"
  ) {
    redirect("/");
  }

  /*
   * ==========================================
   * 필터
   * ==========================================
   */
  const params =
    await searchParams;

  const allowedTargetGroups =
    TARGET_GROUPS.map(
      (group) =>
        group.value
    );

  const targetGroup =
    params.target_group &&
    allowedTargetGroups.includes(
      params.target_group
    )
      ? params.target_group
      : "early_kids";

  const category =
    params.category ===
      "grammar" ||
    params.category ===
      "listening"
      ? params.category
      : "listening";

  const parsedDifficulty =
    Number(
      params.difficulty
    );

  const difficulty =
    Number.isInteger(
      parsedDifficulty
    ) &&
    parsedDifficulty >= 1 &&
    parsedDifficulty <= 5
      ? parsedDifficulty
      : null;

  /*
   * ==========================================
   * 문제 조회
   *
   * 실제 level_test_questions 컬럼:
   * choice_a ~ choice_d
   * ==========================================
   */
  let query =
    supabase
      .from(
        "level_test_questions"
      )
      .select(`
        id,
        target_group,
        category,
        difficulty,
        question_text,
        choice_a,
        choice_b,
        choice_c,
        choice_d,
        audio_script,
        audio_url,
        is_active
      `)
      .eq(
        "target_group",
        targetGroup
      )
      .eq(
        "category",
        category
      )
      .order(
        "difficulty",
        {
          ascending: true,
        }
      )
      .order(
        "id",
        {
          ascending: true,
        }
      );

  if (difficulty) {
    query =
      query.eq(
        "difficulty",
        difficulty
      );
  }

  const {
    data,
    error,
  } =
    await query;

  const questions =
    (data || []) as QuestionRow[];

  const totalCount =
    questions.length;

  const audioCompletedCount =
    category === "listening"
      ? questions.filter(
          (question) =>
            Boolean(
              question.audio_url
            )
        ).length
      : 0;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* 상단 */}
        <div className="mb-6">
          <Link
            href="/admin"
            className="text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            ← 관리자 대시보드
          </Link>
        </div>

        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
              TALKLY ADMIN
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              레벨테스트 문제은행
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              대상별 Grammar 및
              Listening 문제를 확인하고,
              Listening AI 음원을
              생성·재생성할 수 있습니다.
            </p>
          </div>

          <Link
            href="/admin/level-tests"
            className="inline-flex w-fit items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            학생 레벨테스트 관리
          </Link>
        </div>

        {/* 대상 그룹 */}
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            대상 그룹
          </div>

          <div className="flex flex-wrap gap-2">
            {TARGET_GROUPS.map(
              (group) => {
                const active =
                  targetGroup ===
                  group.value;

                return (
                  <Link
                    key={
                      group.value
                    }
                    href={`/admin/level-test-questions?target_group=${group.value}&category=${category}${
                      difficulty
                        ? `&difficulty=${difficulty}`
                        : ""
                    }`}
                    style={
                      active
                        ? {
                            backgroundColor:
                              "#0A1F44",
                            color:
                              "#FFFFFF",
                          }
                        : undefined
                    }
                    className={
                      active
                        ? "rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm"
                        : "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    }
                  >
                    {group.label}
                  </Link>
                );
              }
            )}
          </div>
        </section>

        {/* 카테고리 */}
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            영역
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/level-test-questions?target_group=${targetGroup}&category=grammar${
                difficulty
                  ? `&difficulty=${difficulty}`
                  : ""
              }`}
              style={
                category ===
                "grammar"
                  ? {
                      backgroundColor:
                        "#0A1F44",
                      color:
                        "#FFFFFF",
                    }
                  : undefined
              }
              className={
                category ===
                "grammar"
                  ? "rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm"
                  : "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              }
            >
              {targetGroup ===
              "early_kids"
                ? "Words & Sentences"
                : "Grammar"}
            </Link>

            <Link
              href={`/admin/level-test-questions?target_group=${targetGroup}&category=listening${
                difficulty
                  ? `&difficulty=${difficulty}`
                  : ""
              }`}
              style={
                category ===
                "listening"
                  ? {
                      backgroundColor:
                        "#0A1F44",
                      color:
                        "#FFFFFF",
                    }
                  : undefined
              }
              className={
                category ===
                "listening"
                  ? "rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm"
                  : "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              }
            >
              Listening
            </Link>
          </div>
        </section>

        {/* 난이도 */}
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            난이도
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/level-test-questions?target_group=${targetGroup}&category=${category}`}
              style={
                !difficulty
                  ? {
                      backgroundColor:
                        "#2563EB",
                      color:
                        "#FFFFFF",
                    }
                  : undefined
              }
              className={
                !difficulty
                  ? "rounded-xl px-4 py-2 text-sm font-semibold"
                  : "rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              }
            >
              전체
            </Link>

            {[1, 2, 3, 4, 5].map(
              (level) => {
                const active =
                  difficulty ===
                  level;

                return (
                  <Link
                    key={level}
                    href={`/admin/level-test-questions?target_group=${targetGroup}&category=${category}&difficulty=${level}`}
                    style={
                      active
                        ? {
                            backgroundColor:
                              "#2563EB",
                            color:
                              "#FFFFFF",
                          }
                        : undefined
                    }
                    className={
                      active
                        ? "rounded-xl px-4 py-2 text-sm font-semibold"
                        : "rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    }
                  >
                    Level {level}
                  </Link>
                );
              }
            )}
          </div>
        </section>

        {/* 현황 */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-slate-500">
              현재 대상
            </div>

            <div className="mt-2 text-xl font-bold text-slate-950">
              {getTargetGroupLabel(
                targetGroup
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-slate-500">
              표시 문제
            </div>

            <div className="mt-2 text-xl font-bold text-slate-950">
              {totalCount}문항
            </div>
          </div>

          {category ===
            "listening" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-medium text-slate-500">
                AI 음원 생성
              </div>

              <div className="mt-2 text-xl font-bold text-slate-950">
                {
                  audioCompletedCount
                }
                /{totalCount}
              </div>
            </div>
          )}
        </div>

        {/* 조회 오류 */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
            문제은행을 불러오지
            못했습니다:{" "}
            {error.message}
          </div>
        )}

        {/* 문제 없음 */}
        {!error &&
          questions.length ===
            0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <div className="text-lg font-bold text-slate-800">
                등록된 문제가
                없습니다.
              </div>

              <p className="mt-2 text-sm text-slate-500">
                현재 필터 조건에
                해당하는 문제가
                없습니다.
              </p>
            </div>
          )}

        {/* 문제 목록 */}
        <div className="space-y-4">
          {questions.map(
            (question) => (
              <article
                key={
                  question.id
                }
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">
                      #
                      {
                        question.id
                      }
                    </span>

                    <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                      Level{" "}
                      {
                        question.difficulty
                      }
                    </span>

                    <span className="rounded-lg bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700">
                      {getCategoryLabel(
                        question.category,
                        question.target_group
                      )}
                    </span>

                    <span
                      className={
                        question.is_active
                          ? "rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"
                          : "rounded-lg bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700"
                      }
                    >
                      {question.is_active
                        ? "사용중"
                        : "비활성"}
                    </span>
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-5">
                    <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                      Question
                    </div>

                    <div className="text-base font-semibold leading-7 text-slate-950">
                      {
                        question.question_text
                      }
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      [
                        "A",
                        question.choice_a,
                      ],
                      [
                        "B",
                        question.choice_b,
                      ],
                      [
                        "C",
                        question.choice_c,
                      ],
                      [
                        "D",
                        question.choice_d,
                      ],
                    ].map(
                      ([
                        label,
                        choice,
                      ]) => (
                        <div
                          key={
                            label
                          }
                          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                        >
                          <span className="mr-2 font-bold text-slate-950">
                            {
                              label
                            }.
                          </span>

                          {choice}
                        </div>
                      )
                    )}
                  </div>

                  {question.category ===
                    "listening" && (
                    <LevelTestQuestionAudioManager
                      questionId={
                        question.id
                      }
                      targetGroup={
                        question.target_group
                      }
                      audioScript={
                        question.audio_script
                      }
                      audioPath={
                        question.audio_url
                      }
                    />
                  )}
                </div>
              </article>
            )
          )}
        </div>
      </div>
    </main>
  );
}