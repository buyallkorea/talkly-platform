/** Client response scheduling; VAD detects/commits speech, the app chooses when to reply. */
export class TurnCoordinator {
  holding = false;
  speaking = false;
  pending = false;
  queued = false;
  private committedIds: string[] = [];
  reset(holding = false) {
    this.holding = holding;
    this.speaking = this.pending = this.queued = false;
    this.committedIds = [];
  }
  event(event: { type: string; item_id?: string }) {
    if (event.type === "input_audio_buffer.speech_started")
      this.speaking = true;
    if (event.type === "input_audio_buffer.speech_stopped")
      this.speaking = false;
    if (
      event.type === "input_audio_buffer.committed" &&
      typeof event.item_id === "string" &&
      !this.committedIds.includes(event.item_id)
    ) {
      this.committedIds = [...this.committedIds, event.item_id].slice(-100);
      this.queued = true;
    }
    if (event.type === "response.created") this.pending = true;
    if (event.type === "response.done") this.pending = false;
  }
  beginResponse() {
    if (this.holding || this.speaking || this.pending) return false;
    this.pending = true;
    return true;
  }
  takeResponse() {
    if (!this.queued || !this.beginResponse()) return false;
    this.queued = false;
    return true;
  }
}
