"use client";

import {
  useCallback,
  useEffect,
  useRef,
} from "react";

type Props = {
  sessionId: number;
};

export default function ClassSessionEndWatcher({
  sessionId,
}: Props) {
  const reloadingRef =
    useRef(false);

  const checkStatus =
    useCallback(async () => {
      if (reloadingRef.current) {
        return;
      }

      try {
        const response =
          await fetch(
            `/api/classroom/session-status?sessionId=${sessionId}`,
            {
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          return;
        }

        if (
          data.session
            ?.effectiveStatus ===
          "completed"
        ) {
          reloadingRef.current =
            true;

          window.location.reload();
        }
      } catch {
        // 다음 확인 주기에 다시 시도합니다.
      }
    }, [sessionId]);

  useEffect(() => {
    const timer =
      window.setInterval(
        checkStatus,
        2000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, [checkStatus]);

  return null;
}