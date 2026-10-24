import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { signStoragePaths } from "@/lib/storage-signing";

// Only already-public catalogue covers are reusable across visitors. No account,
// lesson, PDF, page/audio, or authorization data enters this cache.
export const getPublicCoverUrls = unstable_cache(async (paths: string[]) => {
  return Object.fromEntries(await signStoragePaths(createAdminClient(), "textbook-files", paths));
}, ["public-catalogue-cover-urls-v1"], { revalidate: 60 });
