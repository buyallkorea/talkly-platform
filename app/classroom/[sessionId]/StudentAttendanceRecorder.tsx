"use client";

import { useEffect, useRef } from "react";

type Props = {
  sessionId: number;
  enabled: boolean;
};

export default function StudentAttendanceRecorder({
  sessionId,
  enabled,
}: Props) {
  const recordedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (recordedRef.current) {
      return;
    }

    recordedRef.current = true;

    const recordAttendance = async () => {
      try {
        const response = await fetch(
          "/api/classroom/attendance",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              sessionId,
            }),
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          console.error(
            "출석 자동 기록 실패:",
            data?.error ||
              "알 수 없는 오류"
          );

          recordedRef.current =
            false;

          return;
        }

        console.log(
          "출석 자동 기록 완료:",
          data
        );
      } catch (error) {
        console.error(
          "출석 자동 기록 요청 실패:",
          error
        );

        recordedRef.current =
          false;
      }
    };

    void recordAttendance();
  }, [sessionId, enabled]);

  return null;
}