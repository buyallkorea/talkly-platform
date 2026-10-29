import { getSafeNextPath } from "@/lib/safe-next-path";

/** Use platform-owned Preview hosts; never use a submitted Origin/Host as a mail target. */
export function signupConfirmationRedirect(value: unknown) {
  let origin = "https://www.talkly.co.kr";
  if (process.env.VERCEL_ENV === "preview") {
    const host = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
    if (!host || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/i.test(host))
      throw new Error("Preview confirmation host unavailable");
    origin = `https://${host}`;
  }
  const redirect = new URL("/login", origin);
  const next = getSafeNextPath(typeof value === "string" ? value : null);
  if (next) redirect.searchParams.set("next", next);
  return redirect.toString();
}
