import { createClient } from "@/lib/supabase-server";

export default async function TestAuthPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main style={{ padding: "40px" }}>
        <h1>로그인되지 않았습니다.</h1>
      </main>
    );
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return (
    <main style={{ padding: "40px" }}>
      <h1>TALKLY 인증 테스트</h1>

      <p>
        <strong>Email:</strong> {user.email}
      </p>

      <p>
        <strong>User ID:</strong> {user.id}
      </p>

      <p>
        <strong>Role:</strong>{" "}
        {error ? `오류: ${error.message}` : profile?.role ?? "없음"}
      </p>
    </main>
  );
}