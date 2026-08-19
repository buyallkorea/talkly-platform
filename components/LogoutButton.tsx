"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(
        `로그아웃에 실패했습니다: ${error.message}`
      );
      return;
    }

    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      style={{
        padding: "10px 16px",
        border: "1px solid #ddd",
        borderRadius: "8px",
        background: "transparent",
        color: "inherit",
        fontSize: "14px",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      로그아웃
    </button>
  );
}