"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { validUnsubscribeToken } from "@/lib/talkly-ai/unsubscribe-token";
export default function UnsubscribeForm() {
  const token = useRef<string | null>(null),
    guard = useRef(false);
  const [ready, setReady] = useState(false),
    [valid, setValid] = useState(false),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (token.current === null) {
      token.current =
        new URLSearchParams(location.hash.slice(1)).get("token") ?? "";
      history.replaceState(null, "", location.pathname);
    }
    void Promise.resolve().then(() => {
      if (!cancelled) {
        setValid(validUnsubscribeToken(token.current));
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  async function withdraw() {
    if (guard.current || !valid) return;
    guard.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/talkly-ai/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.current, confirm: true }),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true)
        throw new Error(result.error || "수신거부를 확인하지 못했어요.");
      setDone(true);
      token.current = "";
      setMessage(
        "이 링크와 연결된 채널의 TALKLY AI 재이용·재결제 안내 수신을 중지했어요.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error &&
          !(error instanceof TypeError) &&
          !(error instanceof SyntaxError) &&
          !["AbortError", "TimeoutError"].includes(error.name)
          ? error.message
          : "처리 결과를 확인하지 못했어요. 같은 화면에서 다시 시도해 주세요.",
      );
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <p>
        로그인 없이 이 안내를 보낸 채널의 수신 설정을 끌 수 있어요. 링크를 여는
        것만으로는 변경되지 않아요.
      </p>
      <p>
        이 설정은 TALKLY AI 재이용·재결제 안내에 적용되며, 이용권과 회화 기록은
        유지돼요.
      </p>
      {!ready ? (
        <p>링크를 확인 중이에요.</p>
      ) : !valid && !done ? (
        <p>
          유효한 수신거부 링크를 열어 주세요. 또는 로그인 후 안내 수신 설정을
          변경할 수 있어요.
        </p>
      ) : !done ? (
        <button disabled={busy} onClick={withdraw}>
          {busy ? "수신거부 확인 중…" : "이 안내 채널 수신거부 확인"}
        </button>
      ) : null}
      <p role="status" aria-live="polite">
        {message}
      </p>
      <Link href="/talkly-ai/notifications">로그인 후 전체 안내 수신 설정</Link>
      <noscript>
        <p>
          이 화면에서는 자바스크립트가 필요해요. 로그인 후 안내 수신 설정에서도
          변경할 수 있어요.
        </p>
      </noscript>
    </>
  );
}
