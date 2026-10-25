import { createClient } from "@supabase/supabase-js";

export function createAdminClient(options?: { timeoutMs?: number }) {
  const timeoutMs = options?.timeoutMs;
  if (
    timeoutMs !== undefined &&
    (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 30000)
  )
    throw new Error("Invalid admin request timeout");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL 환경변수가 없습니다.");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    ...(timeoutMs === undefined
      ? {}
      : {
          global: {
            fetch: (input: RequestInfo | URL, init?: RequestInit) => {
              const previous =
                init?.signal ??
                (input instanceof Request ? input.signal : undefined);
              const timeout = AbortSignal.timeout(timeoutMs);
              return fetch(input, {
                ...init,
                signal: previous
                  ? AbortSignal.any([previous, timeout])
                  : timeout,
              });
            },
          },
        }),
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
