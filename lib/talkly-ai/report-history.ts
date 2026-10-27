import "server-only";
import type { createAdminClient } from "@/lib/supabase-admin";
import type { reportMonth } from "./reports";
type Activity = { seconds: number; days: number; segments: number };
function activity(value: unknown): Activity | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const fields = [row.seconds, row.days, row.segments];
  if (
    !fields.every(
      (number) =>
        typeof number === "number" &&
        Number.isSafeInteger(number) &&
        number >= 0,
    ) ||
    Number(row.days) > 31
  )
    return null;
  return {
    seconds: row.seconds as number,
    days: row.days as number,
    segments: row.segments as number,
  };
}
export async function loadReportHistory(
  db: ReturnType<typeof createAdminClient>,
  userId: string,
  periods: ReturnType<typeof reportMonth>[],
  publicationsEnabled: boolean,
  cutoff: string,
) {
  if (periods.length < 1 || periods.length > 3)
    throw new Error("Invalid history size");
  const [live, published] = await Promise.all([
    (async () => {
      try {
        const response = await db.rpc("ai_activity_history", {
          p_user: userId,
          p_from: periods[0].from,
          p_to: periods[periods.length - 1].to,
        });
        return response.error || !Array.isArray(response.data)
          ? null
          : (response.data as Record<string, unknown>[]);
      } catch {
        return null;
      }
    })(),
    publicationsEnabled
      ? Promise.resolve(
          db
            .from("ai_monthly_publications")
            .select(
              "month,published_at,connected_seconds,learning_days,segments",
            )
            .eq("user_id", userId)
            .in(
              "month",
              periods.map((period) => period.from),
            )
            .gt("published_at", cutoff),
        ).catch(() => ({ data: null, error: true }))
      : Promise.resolve({ data: [], error: null }),
  ]);
  return {
    publicationError: !!published.error,
    rows: periods.map((period) => {
      const snapshot = published.error
        ? null
        : published.data?.find((row) => row.month === period.from);
      const frozen =
        snapshot &&
        typeof snapshot.published_at === "string" &&
        Number.isFinite(Date.parse(snapshot.published_at))
          ? activity({
              seconds: snapshot.connected_seconds,
              days: snapshot.learning_days,
              segments: snapshot.segments,
            })
          : null;
      return {
        period,
        activity:
          frozen ?? activity(live?.find((row) => row.month === period.from)),
        publishedAt: frozen ? (snapshot!.published_at as string) : null,
      };
    }),
  };
}
