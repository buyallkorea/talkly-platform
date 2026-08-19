"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function DeactivateChildButton({
  childId,
}: {
  childId: string;
}) {
  const router = useRouter();

  async function handleDeactivate() {
    const confirmed = window.confirm(
      "이 자녀를 등록 해제하시겠습니까?\n기존 수업 및 학습 기록은 삭제되지 않습니다."
    );

    if (!confirmed) {
      return;
    }

    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("로그인 정보를 확인할 수 없습니다.");
      return;
    }

    const { error } = await supabase
      .from("children")
      .update({
        is_active: false,
      })
      .eq("id", childId)
      .eq("parent_user_id", user.id);

    if (error) {
      alert(`자녀 등록 해제에 실패했습니다: ${error.message}`);
      return;
    }

    router.push("/parent/children");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleDeactivate}
      style={{
        padding: "12px 18px",
        border: "1px solid #ccc",
        borderRadius: "8px",
        background: "transparent",
        cursor: "pointer",
        fontWeight: 700,
      }}
    >
      자녀 등록 해제
    </button>
  );
}