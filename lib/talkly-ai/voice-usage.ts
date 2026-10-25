const object = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const count = (v: unknown) =>
  typeof v === "number" &&
  Number.isSafeInteger(v) &&
  v >= 0 &&
  v <= 1_000_000_000
    ? v
    : null;
function subset(v: unknown, total: number) {
  const n = count(v);
  return n !== null && n <= total ? n : null;
}
/** Accept only usage from a provider response.done event, never transcript/audio. */
export function voiceUsageRow(event: unknown) {
  const e = object(event),
    response = object(e.response),
    usage = object(response.usage);
  if (
    e.type !== "response.done" ||
    typeof response.id !== "string" ||
    !/^resp_[A-Za-z0-9_-]{1,180}$/.test(response.id) ||
    typeof response.status !== "string" ||
    !["completed", "cancelled", "failed", "incomplete"].includes(
      response.status,
    )
  )
    return null;
  const input = count(usage.input_tokens),
    output = count(usage.output_tokens);
  if (input === null || output === null) return null;
  if (
    usage.total_tokens !== undefined &&
    count(usage.total_tokens) !== input + output
  )
    return null;
  const details = object(usage.input_token_details),
    cached = object(details.cached_tokens_details),
    out = object(usage.output_token_details);
  const cachedTotal = subset(details.cached_tokens, input);
  const inputAudio = subset(details.audio_tokens, input),
    inputText = subset(details.text_tokens, input),
    inputImage = subset(details.image_tokens, input);
  const outputAudio = subset(out.audio_tokens, output),
    outputText = subset(out.text_tokens, output);
  const cachedAudio =
    cachedTotal === null
      ? null
      : subset(
          cached.audio_tokens,
          Math.min(cachedTotal, inputAudio ?? cachedTotal),
        );
  const cachedText =
    cachedTotal === null
      ? null
      : subset(
          cached.text_tokens,
          Math.min(cachedTotal, inputText ?? cachedTotal),
        );
  const cachedImage =
    cachedTotal === null
      ? null
      : subset(
          cached.image_tokens,
          Math.min(cachedTotal, inputImage ?? cachedTotal),
        );
  // Invalid optional breakdowns remain unknown; totals are still evidenced.
  const inputValid =
    (inputAudio ?? 0) + (inputText ?? 0) + (inputImage ?? 0) <= input;
  const outputValid = (outputAudio ?? 0) + (outputText ?? 0) <= output;
  const cacheValid =
    (cachedAudio ?? 0) + (cachedText ?? 0) + (cachedImage ?? 0) <=
    (cachedTotal ?? 0);
  return {
    response_id: response.id,
    status: response.status as string,
    input_tokens: input,
    output_tokens: output,
    cached_input_tokens: cachedTotal,
    input_audio_tokens: inputValid ? inputAudio : null,
    input_text_tokens: inputValid ? inputText : null,
    input_image_tokens: inputValid ? inputImage : null,
    output_audio_tokens: outputValid ? outputAudio : null,
    output_text_tokens: outputValid ? outputText : null,
    cached_audio_tokens: cacheValid && inputValid ? cachedAudio : null,
    cached_text_tokens: cacheValid && inputValid ? cachedText : null,
    cached_image_tokens: cacheValid && inputValid ? cachedImage : null,
  };
}
export type VoiceUsageRow = NonNullable<ReturnType<typeof voiceUsageRow>>;
