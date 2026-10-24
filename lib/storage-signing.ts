import type { SupabaseClient } from "@supabase/supabase-js";

// Callers authorize the page/lesson first. URLs stay private, expire as before,
// and are not cached across users. Deduplicate paths and bound request payloads.
export async function signStoragePaths(client: SupabaseClient, bucket: string, paths: string[], expiresIn = 3600) {
  const unique = [...new Set(paths.filter(Boolean))];
  const urls = new Map<string, string>();
  const batches: string[][] = [];
  for (let offset = 0; offset < unique.length; offset += 200) batches.push(unique.slice(offset, offset + 200));
  const results = await Promise.all(batches.map(batch => client.storage.from(bucket).createSignedUrls(batch, expiresIn)));
  for (const result of results) {
    if (result.error) throw result.error;
    for (const item of result.data ?? []) if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
  }
  return urls;
}
