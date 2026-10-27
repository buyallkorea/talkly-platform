"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
type Channel = "kakao" | "email";
type Settings = {
  preferences: { channel: Channel; enabled: boolean; updated_at: string }[];
  noticeVersion: string;
  optInEnabled: boolean;
};
export default function NotificationSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load(signal?: AbortSignal) {
    const response = await fetch("/api/talkly-ai/notifications", {
      cache: "no-store",
      signal,
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "수신 설정을 불러오지 못했어요.");
    setSettings(result);
  }
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).catch((error) => {
      if (!controller.signal.aborted) setMessage(error.message);
    });
    return () => controller.abort();
  }, []);
  async function change(channel: Channel, enabled: boolean) {
    if (!settings) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/talkly-ai/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          enabled,
          noticeVersion: settings.noticeVersion,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "수신 설정을 저장하지 못했어요.");
      // Reflect the confirmed save even if the subsequent refresh fails.
      setSettings((previous) =>
        previous
          ? {
              ...previous,
              preferences: [
                ...previous.preferences.filter((p) => p.channel !== channel),
                { channel, enabled, updated_at: new Date().toISOString() },
              ],
            }
          : previous,
      );
      setMessage(
        enabled ? "수신 동의를 저장했어요." : "수신 동의를 철회했어요.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "저장하지 못했어요. 다시 확인해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="tai-card">
      <h1>AI 이용 안내 수신 설정</h1>
      <p>
        무료 체험 후 다시 시작하기, 이용권 만료 후 재구매 등 광고성 안내의 수신
        여부를 채널별로 관리합니다. 동의하지 않아도 AI 회화를 이용할 수
        있습니다.
      </p>
      <p>
        언제든 이 화면에서 채널별 동의를 철회할 수 있어요. 수신 설정은 토클리 AI
        안내에 적용됩니다.
      </p>
      {settings && !settings.optInEnabled && (
        <p>
          안내 서비스를 준비 중입니다. 새 수신 동의는 아직 받지 않으며, 기존
          동의가 있다면 철회할 수 있어요.
        </p>
      )}
      {!settings && !message && <p role="status">설정을 불러오는 중…</p>}
      {settings &&
        (["kakao", "email"] as const).map((channel) => {
          const enabled =
            settings.preferences.find((p) => p.channel === channel)?.enabled ??
            false;
          return (
            <section
              key={channel}
              aria-label={
                channel === "kakao" ? "카카오톡 수신 설정" : "이메일 수신 설정"
              }
            >
              <h2>
                {channel === "kakao" ? "카카오톡" : "이메일"} 안내:{" "}
                {enabled ? "수신 동의" : "미동의"}
              </h2>
              <button
                disabled={busy || (!enabled && !settings.optInEnabled)}
                onClick={() => change(channel, !enabled)}
              >
                {enabled ? "수신 동의 철회" : "광고성 안내 수신에 동의"}
              </button>
            </section>
          );
        })}
      <p role="status" aria-live="polite">
        {message}
      </p>
      {!settings && message && (
        <button
          onClick={() => {
            setMessage("");
            void load().catch((error) => setMessage(error.message));
          }}
        >
          다시 불러오기
        </button>
      )}
      <p>
        <Link href="/talkly-ai">AI 회화로 돌아가기</Link> ·{" "}
        <Link href="/login">로그인</Link>
      </p>
    </section>
  );
}
