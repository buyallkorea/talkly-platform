"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Props = {
  holdId: number;
  sessionId: number;
};

export default function ClassHoldReviewForm({
  holdId,
  sessionId,
}: Props) {
  const router = useRouter();

  const [adminNote, setAdminNote] =
    useState("");

  const [loading, setLoading] = useState<
    "approved" | "rejected" | null
  >(null);

  const [errorMessage, setErrorMessage] =
    useState("");

  async function reviewHold(
    status: "approved" | "rejected"
  ) {
    if (loading) {
      return;
    }

    setErrorMessage("");
    setLoading(status);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMessage(
          "로그인 정보를 확인할 수 없습니다."
        );
        setLoading(null);
        return;
      }

      /*
       * 관리자 권한 확인
       */
      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (
        profileError ||
        !profile ||
        profile.role !== "admin"
      ) {
        setErrorMessage(
          "관리자 권한을 확인할 수 없습니다."
        );
        setLoading(null);
        return;
      }

      /*
       * 현재 신청상태 확인
       */
      const {
        data: currentHold,
        error: holdReadError,
      } = await supabase
        .from("class_holds")
        .select(`
          id,
          status
        `)
        .eq("id", holdId)
        .maybeSingle();

      if (holdReadError) {
        setErrorMessage(
          `결석신청 확인 실패: ${holdReadError.message}`
        );
        setLoading(null);
        return;
      }

      if (!currentHold) {
        setErrorMessage(
          "결석신청 정보를 찾을 수 없습니다."
        );
        setLoading(null);
        return;
      }

      if (
        currentHold.status !== "requested"
      ) {
        setErrorMessage(
          "이미 처리된 결석신청입니다."
        );
        setLoading(null);
        return;
      }

      const now =
        new Date().toISOString();

      /*
       * 결석신청 승인 / 거절
       */
      const {
        data: updatedHold,
        error: holdUpdateError,
      } = await supabase
        .from("class_holds")
        .update({
          status,
          reviewed_by: user.id,
          reviewed_at: now,
          admin_note:
            adminNote.trim() || null,
          updated_at: now,
        })
        .eq("id", holdId)
        .eq("status", "requested")
        .select("id");

      if (holdUpdateError) {
        setErrorMessage(
          `결석신청 처리 실패: ${holdUpdateError.message}`
        );
        setLoading(null);
        return;
      }

      if (
        !updatedHold ||
        updatedHold.length === 0
      ) {
        setErrorMessage(
          "결석신청 상태가 변경되어 처리할 수 없습니다."
        );
        setLoading(null);
        return;
      }

      /*
       * 승인 시 대상 수업을 held 상태로 변경
       */
      if (status === "approved") {
        const {
          data: updatedSession,
          error: sessionUpdateError,
        } = await supabase
          .from("class_sessions")
          .update({
            status: "held",
            updated_at: now,
          })
          .eq("id", sessionId)
          .select("id");

        if (sessionUpdateError) {
          setErrorMessage(
            `결석신청은 승인되었지만 수업 상태 변경에 실패했습니다: ${sessionUpdateError.message}`
          );
          setLoading(null);
          return;
        }

        if (
          !updatedSession ||
          updatedSession.length === 0
        ) {
          setErrorMessage(
            "결석신청은 승인되었지만 대상 수업의 상태를 변경하지 못했습니다."
          );
          setLoading(null);
          return;
        }
      }

      router.refresh();
    } catch (error) {
      console.error(
        "CLASS HOLD REVIEW ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? `결석신청 처리 오류: ${error.message}`
          : "결석신청 처리 중 오류가 발생했습니다."
      );

      setLoading(null);
    }
  }

  return (
    <div>
      <div>
        <label
          htmlFor="adminNote"
          style={{
            display: "block",
            color: "#344054",
            fontSize: "13px",
            fontWeight: 900,
          }}
        >
          관리자 메모
        </label>

        <p
          style={{
            margin: "6px 0 0",
            color: "#98a2b3",
            fontSize: "12px",
            lineHeight: 1.6,
          }}
        >
          승인 또는 거절 사유와 안내사항을
          기록할 수 있습니다.
        </p>

        <textarea
          id="adminNote"
          value={adminNote}
          onChange={(event) =>
            setAdminNote(
              event.target.value
            )
          }
          rows={6}
          placeholder="예: 해당 회차 결석 승인 처리합니다. 보강 일정은 별도 안내 예정입니다."
          disabled={loading !== null}
          style={{
            marginTop: "12px",
            width: "100%",
            minHeight: "150px",
            boxSizing: "border-box",
            padding: "14px",
            border:
              "1px solid #d0d5dd",
            borderRadius: "10px",
            background:
              loading !== null
                ? "#f9fafb"
                : "#ffffff",
            color: "#101828",
            fontFamily: "inherit",
            fontSize: "14px",
            lineHeight: 1.75,
            resize: "vertical",
            outline: "none",
          }}
        />
      </div>

      {errorMessage && (
        <div
          style={{
            marginTop: "16px",
            padding: "14px 16px",
            border:
              "1px solid #fecdca",
            borderRadius: "10px",
            background: "#fef3f2",
            color: "#b42318",
            fontSize: "13px",
            fontWeight: 700,
            lineHeight: 1.7,
          }}
        >
          {errorMessage}
        </div>
      )}

      <div
        style={{
          marginTop: "22px",
          paddingTop: "20px",
          borderTop:
            "1px solid #eaecf0",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "14px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                color: "#101828",
                fontSize: "14px",
                fontWeight: 900,
              }}
            >
              처리 결과 선택
            </div>

            <div
              style={{
                marginTop: "5px",
                color: "#98a2b3",
                fontSize: "12px",
                lineHeight: 1.6,
              }}
            >
              처리 후에는 상태가 확정되므로
              신청 내용을 다시 확인해주세요.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              disabled={loading !== null}
              onClick={() =>
                reviewHold("rejected")
              }
              style={{
                minHeight: "46px",
                padding: "0 18px",
                border:
                  "1px solid #fda29b",
                borderRadius: "10px",
                background: "#ffffff",
                color: "#b42318",
                fontFamily: "inherit",
                fontSize: "13px",
                fontWeight: 900,
                cursor:
                  loading !== null
                    ? "default"
                    : "pointer",
                opacity:
                  loading !== null
                    ? 0.55
                    : 1,
              }}
            >
              {loading === "rejected"
                ? "거절 처리 중..."
                : "신청 거절"}
            </button>

            <button
              type="button"
              disabled={loading !== null}
              onClick={() =>
                reviewHold("approved")
              }
              style={{
                minHeight: "46px",
                padding: "0 20px",
                border: "none",
                borderRadius: "10px",
                background: "#0A1F44",
                color: "#ffffff",
                fontFamily: "inherit",
                fontSize: "13px",
                fontWeight: 900,
                cursor:
                  loading !== null
                    ? "default"
                    : "pointer",
                boxShadow:
                  "0 8px 18px rgba(10,31,68,.12)",
                opacity:
                  loading !== null
                    ? 0.6
                    : 1,
              }}
            >
              {loading === "approved"
                ? "승인 처리 중..."
                : "결석 신청 승인"}
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: "18px",
          padding: "14px 16px",
          borderRadius: "10px",
          background: "#f9fafb",
          color: "#667085",
          fontSize: "11px",
          lineHeight: 1.7,
        }}
      >
        결석 신청을 승인하면 대상 수업의 상태가
        <strong
          style={{
            margin: "0 4px",
            color: "#344054",
          }}
        >
          held
        </strong>
        로 변경됩니다. 거절하는 경우 수업 상태는
        변경되지 않습니다.
      </div>
    </div>
  );
}