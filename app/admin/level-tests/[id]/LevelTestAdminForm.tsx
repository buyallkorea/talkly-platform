"use client";

import {
  FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Props = {
  levelTest: {
    id: number;
    status: string;
    interview_required: boolean;
    final_level: string | null;
    admin_note: string | null;
  };
};

export default function LevelTestAdminForm({
  levelTest,
}: Props) {
  const router = useRouter();

  const [
    interviewRequired,
    setInterviewRequired,
  ] = useState(
    levelTest.interview_required
  );

  const [
    finalLevel,
    setFinalLevel,
  ] = useState(
    levelTest.final_level || ""
  );

  const [
    adminNote,
    setAdminNote,
  ] = useState(
    levelTest.admin_note || ""
  );

  const [loading, setLoading] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  async function checkAdmin() {
    const supabase =
      createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error(
        "로그인 정보를 확인할 수 없습니다."
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
      !profile ||
      profile.role !== "admin"
    ) {
      throw new Error(
        "관리자 권한을 확인할 수 없습니다."
      );
    }

    return supabase;
  }

  async function handleInterviewChoice(
    required: boolean
  ) {
    setErrorMessage("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const supabase =
        await checkAdmin();

      const now =
        new Date().toISOString();

      const {
        data: updated,
        error: updateError,
      } = await supabase
        .from("level_tests")
        .update({
          interview_required:
            required,

          interview_status:
            required
              ? "scheduling"
              : null,

          status:
            required
              ? "interview_required"
              : "admin_review",

          final_level:
            null,

          finalized_at:
            null,

          updated_at:
            now,
        })
        .eq("id", levelTest.id)
        .select("id")
        .maybeSingle();

      if (updateError) {
        throw new Error(
          `관리자 판단 변경 실패: ${updateError.message} / code: ${updateError.code}`
        );
      }

      if (!updated) {
        throw new Error(
          "관리자 판단 변경 결과를 확인할 수 없습니다."
        );
      }

      if (required) {
        const {
          data:
            existingInterview,
          error:
            interviewCheckError,
        } = await supabase
          .from(
            "level_test_interviews"
          )
          .select("id")
          .eq(
            "level_test_id",
            levelTest.id
          )
          .in("status", [
            "scheduling",
            "scheduled",
            "in_progress",
          ])
          .limit(1)
          .maybeSingle();

        if (
          interviewCheckError
        ) {
          throw new Error(
            `원어민 테스트 확인 실패: ${interviewCheckError.message}`
          );
        }

        if (
          !existingInterview
        ) {
          const {
            error: insertError,
          } = await supabase
            .from(
              "level_test_interviews"
            )
            .insert({
              level_test_id:
                levelTest.id,

              status:
                "scheduling",

              duration_minutes:
                20,
            });

          if (insertError) {
            throw new Error(
              `원어민 테스트 생성 실패: ${insertError.message} / code: ${insertError.code}`
            );
          }
        }
      } else {
        const {
          error: cancelError,
        } = await supabase
          .from(
            "level_test_interviews"
          )
          .update({
            status:
              "cancelled",
          })
          .eq(
            "level_test_id",
            levelTest.id
          )
          .in("status", [
            "scheduling",
            "scheduled",
          ]);

        if (cancelError) {
          throw new Error(
            `기존 원어민 테스트 취소 실패: ${cancelError.message}`
          );
        }
      }

      setInterviewRequired(
        required
      );

      setSuccessMessage(
        required
          ? "원어민 추가 테스트 대상으로 변경되었습니다."
          : "추가 테스트 없이 판단하도록 변경되었습니다."
      );

      router.refresh();
    } catch (error) {
      console.error(
        "INTERVIEW CHOICE UPDATE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "관리자 판단 변경 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleReviewSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const supabase =
        await checkAdmin();

      const now =
        new Date().toISOString();

      const nextStatus =
        interviewRequired
          ? "interview_required"
          : finalLevel.trim()
          ? "completed"
          : "admin_review";

      const {
        data: updated,
        error: updateError,
      } = await supabase
        .from("level_tests")
        .update({
          interview_required:
            interviewRequired,

          interview_status:
            interviewRequired
              ? "scheduling"
              : null,

          status: nextStatus,

          final_level:
            interviewRequired
              ? null
              : finalLevel.trim() ||
                null,

          finalized_at:
            !interviewRequired &&
            finalLevel.trim()
              ? now
              : null,

          admin_note:
            adminNote.trim() ||
            null,

          updated_at: now,
        })
        .eq("id", levelTest.id)
        .select("id")
        .maybeSingle();

      if (updateError) {
        setErrorMessage(
          `관리자 검토 저장 실패: ${updateError.message} / code: ${updateError.code}`
        );
        return;
      }

      if (!updated) {
        setErrorMessage(
          "변경 요청은 처리되었지만 저장된 정보를 확인할 수 없습니다."
        );
        return;
      }

      /*
       * 원어민 추가 테스트가 필요한 경우
       * interview 레코드가 이미 있는지 확인합니다.
       */
      if (interviewRequired) {
        const {
          data: existingInterview,
          error: interviewCheckError,
        } = await supabase
          .from(
            "level_test_interviews"
          )
          .select("id")
          .eq(
            "level_test_id",
            levelTest.id
          )
          .in("status", [
            "scheduling",
            "scheduled",
            "in_progress",
          ])
          .limit(1)
          .maybeSingle();

        if (interviewCheckError) {
          setErrorMessage(
            `원어민 테스트 확인 실패: ${interviewCheckError.message}`
          );
          return;
        }

        /*
         * 진행 중인 원어민 테스트가 없을 때만
         * 새 일정협의 레코드를 만듭니다.
         */
        if (!existingInterview) {
          const {
            error: insertError,
          } = await supabase
            .from(
              "level_test_interviews"
            )
            .insert({
              level_test_id:
                levelTest.id,

              status:
                "scheduling",

              duration_minutes:
                20,
            });

          if (insertError) {
            setErrorMessage(
              `원어민 테스트 생성 실패: ${insertError.message} / code: ${insertError.code}`
            );
            return;
          }
        }
      }

      setSuccessMessage(
        interviewRequired
          ? "원어민 추가 테스트 대상으로 저장되었습니다."
          : finalLevel.trim()
          ? "최종 레벨이 확정되었습니다."
          : "관리자 검토 내용이 저장되었습니다."
      );

      router.refresh();
    } catch (error) {
      console.error(
        "LEVEL TEST ADMIN UPDATE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "레벨테스트 관리 중 알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
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
      <div>
        <h2
          style={{
            margin: 0,
            color: "#101828",
            fontSize: "20px",
            letterSpacing:
              "-0.02em",
          }}
        >
          관리자 판단 및 최종 확정
        </h2>

        <p
          style={{
            margin: "8px 0 0",
            color: "#667085",
            fontSize: "13px",
            lineHeight: 1.7,
          }}
        >
          AI 테스트 결과를 검토한 뒤
          바로 최종 레벨을 확정하거나
          원어민 화상 테스트를 추가로
          요청할 수 있습니다.
        </p>
      </div>

      <form
        onSubmit={
          handleReviewSubmit
        }
        style={{
          marginTop: "26px",
          display: "flex",
          flexDirection: "column",
          gap: "22px",
        }}
      >
        {/* 원어민 추가 테스트 */}
        <div>
          <div
            style={labelStyle}
          >
            원어민 추가 테스트
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: "12px",
            }}
          >
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                void handleInterviewChoice(
                  false
                );
              }}
              style={{
                ...choiceButtonStyle,

                border:
                  !interviewRequired
                    ? "2px solid #2f6fed"
                    : "1px solid #d0d5dd",

                background:
                  !interviewRequired
                    ? "#f5f8ff"
                    : "#ffffff",

                color:
                  !interviewRequired
                    ? "#2f6fed"
                    : "#344054",
              }}
            >
              추가 테스트 없이 판단
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setFinalLevel("");

                void handleInterviewChoice(
                  true
                );
              }}
              style={{
                ...choiceButtonStyle,

                border:
                  interviewRequired
                    ? "2px solid #b54708"
                    : "1px solid #d0d5dd",

                background:
                  interviewRequired
                    ? "#fff7ed"
                    : "#ffffff",

                color:
                  interviewRequired
                    ? "#b54708"
                    : "#344054",
              }}
            >
              원어민 추가 테스트 필요
            </button>
          </div>

          <div
            style={helpStyle}
          >
            AI 결과만으로 판단하기
            어려운 경우에만 원어민 추가
            테스트를 선택합니다.
          </div>
        </div>

        {/* 최종 레벨 */}
        {!interviewRequired && (
          <div>
            <label
              htmlFor="finalLevel"
              style={labelStyle}
            >
              최종 레벨
            </label>

            <input
              id="finalLevel"
              type="text"
              value={finalLevel}
              onChange={(event) => {
                setFinalLevel(
                  event.target.value
                );
                setSuccessMessage("");
              }}
              placeholder="예: Elementary 3, TALKLY Level 4"
              disabled={loading}
              style={fieldStyle}
            />

            <div
              style={helpStyle}
            >
              최종 레벨을 입력하고
              저장하면 해당 레벨테스트는
              최종 완료 상태가 됩니다.
              아직 확정하지 않으려면
              비워두세요.
            </div>
          </div>
        )}

        {interviewRequired && (
          <div
            style={{
              padding: "17px 18px",
              border:
                "1px solid #fedf89",
              borderRadius: "11px",
              background: "#fffaeb",
            }}
          >
            <div
              style={{
                color: "#b54708",
                fontSize: "12px",
                fontWeight: 900,
              }}
            >
              원어민 화상 테스트
              추가 진행
            </div>

            <p
              style={{
                margin: "7px 0 0",
                color: "#667085",
                fontSize: "11px",
                lineHeight: 1.7,
              }}
            >
              저장하면 해당 학생을
              원어민 추가 테스트 대상으로
              등록합니다. 학부모와 전화
              또는 SNS로 일정을 협의한
              다음 관리자가 강사와
              테스트 시간을 지정하게
              됩니다.
            </p>
          </div>
        )}

        {/* 관리자 메모 */}
        <div>
          <label
            htmlFor="adminNote"
            style={labelStyle}
          >
            관리자 메모
          </label>

          <textarea
            id="adminNote"
            value={adminNote}
            onChange={(event) => {
              setAdminNote(
                event.target.value
              );
              setSuccessMessage("");
            }}
            rows={5}
            placeholder="AI 결과 검토 내용, 추가 테스트 사유, 수업 배정 참고사항 등을 입력해주세요."
            disabled={loading}
            style={{
              ...fieldStyle,
              minHeight: "120px",
              padding: "13px 14px",
              resize: "vertical",
              lineHeight: 1.7,
            }}
          />
        </div>

        {/* 오류 */}
        {errorMessage && (
          <div
            style={{
              padding: "14px 16px",
              border:
                "1px solid #fda29b",
              borderRadius: "10px",
              background: "#fffbfa",
              color: "#b42318",
              fontSize: "12px",
              fontWeight: 700,
              lineHeight: 1.6,
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* 성공 */}
        {successMessage && (
          <div
            style={{
              padding: "14px 16px",
              border:
                "1px solid #abefc6",
              borderRadius: "10px",
              background: "#ecfdf3",
              color: "#027a48",
              fontSize: "12px",
              fontWeight: 800,
            }}
          >
            {successMessage}
          </div>
        )}

        <div
          style={{
            paddingTop: "4px",
            display: "flex",
            justifyContent:
              "flex-end",
          }}
        >
          <button
            type="submit"
            disabled={loading}
            style={{
              minHeight: "46px",
              padding: "0 22px",
              border: "none",
              borderRadius: "10px",
              background: loading
                ? "#98a2b3"
                : "#0A1F44",
              color: "#ffffff",
              fontFamily: "inherit",
              fontSize: "13px",
              fontWeight: 900,
              cursor: loading
                ? "default"
                : "pointer",
            }}
          >
            {loading
              ? "저장 중..."
              : interviewRequired
              ? "추가 테스트 대상으로 저장"
              : finalLevel.trim()
              ? "최종 레벨 확정"
              : "검토 내용 저장"}
          </button>
        </div>
      </form>
    </section>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  color: "#344054",
  fontSize: "13px",
  fontWeight: 800,
};

const fieldStyle = {
  width: "100%",
  minHeight: "46px",
  boxSizing: "border-box" as const,
  padding: "0 14px",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#101828",
  fontFamily: "inherit",
  fontSize: "14px",
  outline: "none",
};

const choiceButtonStyle = {
  minHeight: "54px",
  padding: "0 16px",
  borderRadius: "10px",
  fontFamily: "inherit",
  fontSize: "13px",
  fontWeight: 900,
  cursor: "pointer",
};

const helpStyle = {
  marginTop: "9px",
  color: "#98a2b3",
  fontSize: "11px",
  lineHeight: 1.6,
};