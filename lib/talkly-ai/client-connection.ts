/** Guards async microphone/connection setup after cancellation or navigation. */
export class CancelledConnection extends Error {
  constructor() {
    super("Connection cancelled");
  }
}
export class ConnectionEpoch {
  private value = 0;
  begin() {
    return ++this.value;
  }
  cancel() {
    this.value++;
  }
  current(id: number) {
    return id === this.value;
  }
  assert(id: number) {
    if (!this.current(id)) throw new CancelledConnection();
  }
  async microphone<T extends { getTracks(): { stop(): void }[] }>(
    id: number,
    media: Promise<T>,
  ): Promise<T> {
    const stream = await media;
    if (!this.current(id)) {
      stream.getTracks().forEach((t) => t.stop());
      throw new CancelledConnection();
    }
    return stream;
  }
}
/** Use server timestamps and monotonic browser time, never the user's wall clock. */
export function leaseMilliseconds(
  deadline: string,
  serverNow: string,
  reservedSeconds: number,
) {
  const value = Date.parse(deadline) - Date.parse(serverNow);
  if (
    !Number.isFinite(value) ||
    !Number.isInteger(reservedSeconds) ||
    reservedSeconds < 1 ||
    reservedSeconds > 240
  )
    throw new Error("음성 연결 시간을 확인하지 못했어요.");
  return Math.max(0, Math.min(reservedSeconds * 1000, value));
}
