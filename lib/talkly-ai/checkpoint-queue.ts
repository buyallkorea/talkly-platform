import type { Turn } from "./config";
type Waiter = { resolve: () => void; reject: (error: unknown) => void };
type Pending = { turns: Turn[]; version?: number; waiters: Waiter[] };
/** Serialize writes and replace only snapshots that have not yet been sent. */
export class CheckpointQueue {
  private pending = new Map<string, Pending>();
  private running = false;
  constructor(
    private send: (sessionId: string, turns: Turn[], version?: number) => Promise<unknown>,
  ) {}
  save(sessionId: string, turns: Turn[], version?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const queued = this.pending.get(sessionId);
      const snapshot = turns.slice(-20).map((turn) => ({ ...turn }));
      if (queued) {
        if (version === undefined || queued.version === undefined || version >= queued.version) {
          queued.turns = snapshot;
          queued.version = version;
        }
        queued.waiters.push({ resolve, reject });
      } else
        this.pending.set(sessionId, {
          turns: snapshot,
          version,
          waiters: [{ resolve, reject }],
        });
      if (!this.running) void this.drain();
    });
  }
  private async drain() {
    this.running = true;
    while (this.pending.size) {
      const [sessionId, job] = this.pending.entries().next().value!;
      this.pending.delete(sessionId);
      try {
        try {
          await this.send(sessionId, job.turns, job.version);
        } catch {
          // A second identical snapshot is safe: the checkpoint endpoint
          // overwrites the latest memory for this owned session.
          await this.send(sessionId, job.turns);
        }
        for (const waiter of job.waiters) waiter.resolve();
      } catch (error) {
        for (const waiter of job.waiters) waiter.reject(error);
      }
    }
    this.running = false;
  }
}
