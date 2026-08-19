import { supabase } from "@/lib/supabase";

export default async function TestSupabasePage() {
  const { data, error } = await supabase
    .from("connection_test")
    .select("id, created_at, message")
    .order("id", { ascending: true });

  if (error) {
    return (
      <main style={{ padding: "40px", fontFamily: "Arial, sans-serif" }}>
        <h1>Supabase 연결 테스트</h1>
        <p style={{ color: "red" }}>오류가 발생했습니다.</p>
        <pre>{error.message}</pre>
      </main>
    );
  }

  return (
    <main style={{ padding: "40px", fontFamily: "Arial, sans-serif" }}>
      <h1>Supabase 연결 테스트</h1>

      {data && data.length > 0 ? (
        data.map((item) => (
          <div key={item.id} style={{ marginTop: "20px" }}>
            <p>
              <strong>ID:</strong> {item.id}
            </p>
            <p>
              <strong>Message:</strong> {item.message}
            </p>
            <p>
              <strong>Created At:</strong> {item.created_at}
            </p>
          </div>
        ))
      ) : (
        <p>데이터가 없습니다.</p>
      )}
    </main>
  );
}