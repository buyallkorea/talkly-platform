import { cache } from "react";
import { createClient } from "@/lib/supabase-server";

// React cache is scoped to one server render, never a shared user/session cache.
// Keep getUser's server validation and return its exact data/error contract.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  return supabase.auth.getUser();
});
