/** Automatic turn-taking: VAD commits audio, then a short grace period allows continuation. */
export class TurnCoordinator {
  speaking = false;
  pending = false;
  queued = false;
  awaitingCommit = false;
  private speechItem: string | null = null;
  private latestItem: string | null = null;
  private committedAt = 0;
  private readyAt = 0;
  private committedIds: string[] = [];
  private transcribedIds: string[] = [];
  private recentLengths: number[] = [];
  reset() {
    this.speaking = this.pending = this.queued = this.awaitingCommit = false;
    this.speechItem = this.latestItem = null;
    this.committedAt = this.readyAt = 0;
    this.committedIds = this.transcribedIds = [];
    // Keep this connection's recent short-answer pacing across automatic renewal.
  }
  private grace(transcript?: string) {
    const text = transcript?.trim() ?? "";
    if (
      /\b(um|uh|hmm|well|and|but|because|so|to|the|a|an|i)\s*[.,…-]*$/i.test(
        text,
      )
    )
      return 3500;
    const words = text ? text.split(/\s+/).length : 0;
    if (words && words <= 3) return 2500;
    const mostlyShort = this.recentLengths.filter((n) => n <= 3).length >= 2;
    if (mostlyShort) return 2200;
    return words >= 7 ? 800 : 1500;
  }
  event(
    event: { type: string; item_id?: string; transcript?: string },
    now = performance.now(),
  ) {
    if (event.type === "input_audio_buffer.speech_started") {
      this.speaking = true;
      this.awaitingCommit = true;
      this.speechItem =
        typeof event.item_id === "string" ? event.item_id : null;
    }
    if (
      event.type === "input_audio_buffer.speech_stopped" &&
      (!this.speechItem || !event.item_id || event.item_id === this.speechItem)
    )
      this.speaking = false;
    if (
      event.type === "input_audio_buffer.committed" &&
      typeof event.item_id === "string" &&
      !this.committedIds.includes(event.item_id)
    ) {
      this.committedIds = [...this.committedIds, event.item_id].slice(-100);
      this.queued = true;
      this.latestItem = event.item_id;
      this.committedAt = now;
      this.readyAt = now + this.grace();
      if (!this.speechItem || event.item_id === this.speechItem)
        this.awaitingCommit = false;
    }
    if (
      event.type === "conversation.item.input_audio_transcription.completed" &&
      typeof event.item_id === "string" &&
      typeof event.transcript === "string" &&
      !this.transcribedIds.includes(event.item_id)
    ) {
      this.transcribedIds = [...this.transcribedIds, event.item_id].slice(-100);
      if (event.transcript.trim())
        this.recentLengths = [
          ...this.recentLengths,
          event.transcript.trim().split(/\s+/).length,
        ].slice(-3);
      if (this.queued && event.item_id === this.latestItem)
        this.readyAt = this.committedAt + this.grace(event.transcript);
    }
    if (event.type === "response.created") this.pending = true;
    if (event.type === "response.done") this.pending = false;
  }
  queueText(now = performance.now()) {
    this.queued = true;
    this.latestItem = null;
    this.readyAt = now;
  }
  restoreQueued(now = performance.now()) {
    this.queued = true;
    this.latestItem = null;
    this.readyAt = now + this.grace();
  }
  beginResponse() {
    if (this.speaking || this.awaitingCommit || this.pending) return false;
    this.pending = true;
    return true;
  }
  responseDelay(now = performance.now()): number | null {
    if (!this.queued || this.speaking || this.awaitingCommit || this.pending)
      return null;
    return Math.max(0, this.readyAt - now);
  }
  takeResponse(now = performance.now()) {
    if (this.responseDelay(now) !== 0 || !this.beginResponse()) return false;
    this.queued = false;
    return true;
  }
}
