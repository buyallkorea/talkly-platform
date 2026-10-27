type Usage = {
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number | null;
  input_audio_tokens: number | null;
  input_text_tokens: number | null;
  output_audio_tokens: number | null;
  output_text_tokens: number | null;
  cached_audio_tokens: number | null;
  cached_text_tokens: number | null;
};
type Observation = {
  state: string;
  reason: string | null;
  recording_errors: number;
  dropped_events: boolean;
  started_at: string;
};
export default function VoiceUsagePanel({
  rows,
  observations,
  unavailable,
  enabled,
}: {
  rows: Usage[];
  observations: Observation[];
  unavailable: boolean;
  enabled: boolean;
}) {
  const metrics: [keyof Usage, string][] = [
    ["input_tokens", "전체 입력"],
    ["output_tokens", "전체 출력"],
    ["input_audio_tokens", "입력 중 음성"],
    ["input_text_tokens", "입력 중 텍스트"],
    ["output_audio_tokens", "출력 중 음성"],
    ["output_text_tokens", "출력 중 텍스트"],
    ["cached_input_tokens", "입력 중 캐시"],
    ["cached_audio_tokens", "캐시 중 음성"],
    ["cached_text_tokens", "캐시 중 텍스트"],
  ];
  return (
    <section>
      <h2>음성 응답 사용량 관찰</h2>
      <p>
        서버 관찰 스위치: {enabled ? "ON" : "OFF"}. 실제 사용량·서버
        실행시간·추가 전송량 검증 후 활성화합니다. 현재 목록은 저장된 최근 응답
        1,000건과 관찰 연결 100건이며 전체 청구 원장이 아닙니다.
      </p>
      <p>
        측정 누락·연결 전 응답·자막 전사 비용이 포함되지 않을 수 있습니다.
        캐시는 입력의 일부이므로 합산하지 않습니다. 음성·텍스트에 다른 단가가
        적용될 수 있어 토큰 합계를 비용으로 표시하지 않습니다.
      </p>
      {unavailable ? (
        <p>음성 사용량 기록을 불러오지 못했습니다.</p>
      ) : (
        <>
          <p>
            저장된 응답 {rows.length}건 · 관찰 연결 기록 {observations.length}
            건. 기록 없음은 사용량 0의 확인이 아닙니다.
          </p>
          <ul>
            {metrics.map(([key, label]) => {
              const known = rows.filter((row) => row[key] !== null);
              return (
                <li key={key}>
                  {label}:{" "}
                  {known.length
                    ? known
                        .reduce((sum, row) => sum + (row[key] ?? 0), 0)
                        .toLocaleString()
                    : "미수집"}{" "}
                  {known.length ? `토큰 (${known.length}건에서 확인)` : ""}
                </li>
              );
            })}
          </ul>
          <p>
            관찰 연결 실패{" "}
            {observations.filter((row) => row.state === "failed").length}건 ·
            저장 오류가 있었던 연결{" "}
            {observations.filter((row) => row.recording_errors > 0).length}건 ·
            수집 제한으로 누락된 연결{" "}
            {observations.filter((row) => row.dropped_events).length}건. 관찰
            연결 종료는 학습자의 음성 대화 종료나 청구 확정을 뜻하지 않습니다.
          </p>
        </>
      )}
    </section>
  );
}
