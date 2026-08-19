"use client";

import { useEffect, useState } from "react";

type Props = {
  sessionId: number;
  courseName: string;
  lessonNumber: number;
  studentName: string;
  teacherName: string;
};

export default function ClassroomWaitingRoom({
  sessionId,
  courseName,
  lessonNumber,
  studentName,
  teacherName,
}: Props) {
  const [message, setMessage] =
    useState("강사의 수업 시작을 기다리고 있습니다.");

  useEffect(() => {
    let stopped = false;

    async function checkStatus() {
      try {
        const response = await fetch(
          `/api/classroom/session-status?sessionId=${sessionId}`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (
          !response.ok ||
          !data.success ||
          stopped
        ) {
          return;
        }

        const effectiveStatus =
          data.session?.effectiveStatus;

        if (effectiveStatus === "in_progress") {
          setMessage("수업이 시작되었습니다. 입장 중...");
          window.location.reload();
          return;
        }

        if (effectiveStatus === "completed") {
          setMessage("수업이 종료되었습니다.");
          window.location.reload();
        }
      } catch {
        // 일시적인 네트워크 오류는 다음 확인 주기에서 다시 시도합니다.
      }
    }

    void checkStatus();

    const timer = window.setInterval(
      checkStatus,
      2000
    );

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [sessionId]);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "40px 20px",
        boxSizing: "border-box",
        background: "#0b0b0d",
        color: "#f7f7f8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "620px",
          padding: "38px 34px",
          borderRadius: "18px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "#15161a",
          textAlign: "center",
          boxShadow:
            "0 22px 60px rgba(0,0,0,0.28)",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            opacity: 0.5,
            letterSpacing: "0.08em",
          }}
        >
          TALKLY CLASSROOM
        </div>

        <h1
          style={{
            margin: "14px 0 10px",
            fontSize: "30px",
          }}
        >
          아직 수업 시작 전입니다
        </h1>

        <p
          style={{
            margin: 0,
            lineHeight: 1.75,
            opacity: 0.68,
          }}
        >
          {studentName} 학생의 수업 준비가 완료되었습니다.
          <br />
          강사가 수업을 시작하면 자동으로 교실에 입장합니다.
        </p>

        <div
          style={{
            marginTop: "26px",
            padding: "16px",
            borderRadius: "12px",
            background: "rgba(255,255,255,0.045)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: "15px",
            }}
          >
            {courseName} · {lessonNumber}회차
          </div>

          <div
            style={{
              marginTop: "6px",
              fontSize: "13px",
              opacity: 0.6,
            }}
          >
            담당 강사: {teacherName}
          </div>
        </div>

        <div
          style={{
            marginTop: "24px",
            display: "inline-flex",
            alignItems: "center",
            gap: "9px",
            fontSize: "13px",
            opacity: 0.72,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 9,
              height: 9,
              borderRadius: 999,
              background: "#35d07f",
              boxShadow:
                "0 0 0 5px rgba(53,208,127,0.10)",
            }}
          />
          {message}
        </div>
      </div>
    </main>
  );
}