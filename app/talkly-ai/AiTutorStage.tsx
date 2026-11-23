"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Turn } from "@/lib/talkly-ai/config";
import { AI_SCENES, inferAiScene, isAiSceneId } from "@/lib/talkly-ai/scenes";
import type { AiSceneId, SceneChoice } from "@/lib/talkly-ai/scenes";
import TutorPortrait from "./TutorPortrait";

type LessonState = "idle" | "connecting" | "live" | "paused";

/**
 * The portrait is rendered from one immutable tutor ID. Scene is never sent to
 * the portrait's identity function: changing setting/outfit cannot replace
 * facial geometry. Effects are optional, do not touch streaming audio and run
 * only while the tab is visible.
 */
export default function AiTutorStage({
  tutorId, tutorName, state, turns, audioRef,
}: {
  tutorId: string;
  tutorName: string;
  state: LessonState;
  turns: Turn[];
  audioRef: RefObject<HTMLAudioElement | null>;
}) {
  const [scene, setScene] = useState<AiSceneId>("home");
  const [choice, setChoice] = useState<SceneChoice>("auto");
  const [animate, setAnimate] = useState(true);
  const [supportsAudioMotion, setSupportsAudioMotion] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const changedAt = useRef(0);
  const active = state === "live";
  const selected = AI_SCENES.find(s => s.id === scene) ?? AI_SCENES[0];

  useEffect(() => {
    if (choice !== "auto") return;
    const suggestion = inferAiScene(turns);
    if (!suggestion || suggestion === scene) return;
    // Slow down changes even when an AI answer repeats a roleplay cue.
    if (Date.now() - changedAt.current < 40_000) return;
    changedAt.current = Date.now();
    setScene(suggestion);
  }, [turns, scene, choice]);

  useEffect(() => {
    const element = panel.current;
    if (!element || !animate || !active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const audio = audioRef.current;
    if (!audio) return;
    let audioContext: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let bins: Uint8Array<ArrayBuffer> | null = null;
    let raf = 0;
    let cancelled = false;
    let lastPaint = 0;
    let smoothed = 0;
    const showQuiet = () => {
      element.style.setProperty("--tai-mouth", "0");
      element.style.setProperty("--tai-nod", "0");
    };
    const stopAnalysis = () => {
      window.cancelAnimationFrame(raf);
      source?.disconnect();
      analyser?.disconnect();
      source = null;
      analyser = null;
      bins = null;
      if (audioContext) void audioContext.close().catch(() => {});
      audioContext = null;
      showQuiet();
      setSupportsAudioMotion(false);
    };
    const paint = (time: number) => {
      if (cancelled || !analyser || !bins) return;
      raf = window.requestAnimationFrame(paint);
      if (time - lastPaint < 52) return; // <= 20fps; audio always has priority
      lastPaint = time;
      if (document.visibilityState !== "visible" || audio.paused || audio.muted) {
        showQuiet();
        return;
      }
      analyser.getByteTimeDomainData(bins);
      let sum = 0;
      for (let i = 0; i < bins.length; i += 2) {
        const sample = (bins[i] - 128) / 128;
        sum += sample * sample;
      }
      const rms = Math.sqrt(sum / Math.ceil(bins.length / 2));
      const level = Math.min(1, Math.max(0, (rms - 0.017) * 9));
      smoothed = smoothed * 0.52 + level * 0.48;
      element.style.setProperty("--tai-mouth", String(smoothed.toFixed(3)));
      element.style.setProperty("--tai-nod", String((smoothed * 1.7).toFixed(2)) + "deg");
    };
    const startAnalysis = () => {
      if (cancelled || audioContext || !audio.srcObject || document.visibilityState !== "visible") return;
      try {
        const stream = audio.srcObject as MediaStream;
        if (!stream.getAudioTracks().length) return;
        const Context = window.AudioContext;
        if (!Context) return;
        audioContext = new Context();
        source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;
        // Intentional: analyser is NOT connected to destination.
        // The <audio> element plays audio normally; animation adds no latency.
        source.connect(analyser);
        bins = new Uint8Array(new ArrayBuffer(analyser.fftSize));
        void audioContext.resume().catch(() => { stopAnalysis(); });
        setSupportsAudioMotion(true);
        raf = window.requestAnimationFrame(paint);
      } catch {
        stopAnalysis(); // Animation failure must never stop AI voice.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stopAnalysis();
      else startAnalysis();
    };
    audio.addEventListener("playing", startAnalysis);
    audio.addEventListener("loadedmetadata", startAnalysis);
    document.addEventListener("visibilitychange", onVisibility);
    startAnalysis();
    return () => {
      cancelled = true;
      audio.removeEventListener("playing", startAnalysis);
      audio.removeEventListener("loadedmetadata", startAnalysis);
      document.removeEventListener("visibilitychange", onVisibility);
      stopAnalysis();
    };
  }, [active, animate, audioRef]);

  function selectScene(next: string) {
    if (next === "auto") {
      setChoice("auto");
      const inferred = inferAiScene(turns);
      if (inferred) {
        setScene(inferred);
        changedAt.current = Date.now();
      }
    } else if (isAiSceneId(next)) {
      setChoice(next);
      setScene(next);
      changedAt.current = Date.now();
    }
  }

  return <div ref={panel} className={"tai-live-stage tai-live-stage--" + scene +
    (animate ? " is-animated" : " is-still") + (active ? " is-live" : "")}>
    <div className="tai-live-stage-scene" aria-hidden="true">
      <span className="tai-scene-window"/>
      <span className="tai-scene-highlight"/>
      <span className="tai-scene-furniture"/>
    </div>
    <div className="tai-live-stage-person">
      <TutorPortrait tutorId={tutorId} scene={scene}/>
    </div>
    <div className="tai-live-stage-label">
      <span className="tai-live-stage-label-icon" aria-hidden="true">{selected.icon}</span>
      <span>{tutorName}<small>{selected.label} · {selected.outfit}</small></span>
      <span className="tai-live-stage-voice" aria-label={
        supportsAudioMotion && active ? "AI 목소리 반응형 애니메이션" : "AI 튜터 고정 얼굴"
      }> {active ? supportsAudioMotion ? "● VOICE SYNC" : "● LIVE" : "AI TUTOR"}</span>
    </div>
    <div className="tai-stage-customize">
      <label htmlFor="tai-stage-scene-select">대화 공간
        <select id="tai-stage-scene-select" value={choice} onChange={e => selectScene(e.target.value)}>
          <option value="auto">자동 추천</option>
          {AI_SCENES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      <button type="button" aria-pressed={!animate} onClick={() => setAnimate(s => !s)}
        title="움직임으로 기기가 느려지면 이 버튼으로 끌 수 있어요.">
        {animate ? "움직임 끄기" : "움직임 켜기"}
      </button>
    </div>
    <p className="tai-stage-note">
      동일한 강사의 얼굴은 모든 상황에서 유지됩니다. 입술 움직임은 AI 출력 음성의 크기에 따른 가벼운 시각 효과이며 정확한 음소별 립싱크가 아닙니다.
    </p>
  </div>;
}
