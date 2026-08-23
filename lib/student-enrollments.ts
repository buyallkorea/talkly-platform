import { createClient } from "@/lib/supabase-server";

type ServerSupabaseClient =
  Awaited<ReturnType<typeof createClient>>;

export type StudentEnrollmentRow = {
  id: number;
  child_id: number | null;
  student_user_id: string | null;
  course_id: number;
  teacher_user_id: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  lessons_per_week: number | null;
  total_lessons: number | null;
  created_at: string;
};

export async function getStudentEnrollments({
  supabase,
  userId,
}: {
  supabase: ServerSupabaseClient;
  userId: string;
}): Promise<StudentEnrollmentRow[]> {
  const { data: directEnrollments, error: directError } =
    await supabase
      .from("enrollments")
      .select(`
        id,
        child_id,
        student_user_id,
        course_id,
        teacher_user_id,
        status,
        start_date,
        end_date,
        lessons_per_week,
        total_lessons,
        created_at
      `)
      .eq("student_user_id", userId);

  if (directError) {
    throw new Error(
      `학생 수강정보 조회 실패: ${directError.message}`
    );
  }

  const { data: linkedChildren, error: childError } =
    await supabase
      .from("children")
      .select(`
        id,
        student_user_id,
        linked_student_user_id
      `)
      .or(
        `student_user_id.eq.${userId},linked_student_user_id.eq.${userId}`
      )
      .eq("is_active", true);

  if (childError) {
    throw new Error(
      `학생 연결정보 조회 실패: ${childError.message}`
    );
  }

  const childIds =
    (linkedChildren ?? []).map((child) => child.id);

  let childEnrollments: StudentEnrollmentRow[] = [];

  if (childIds.length > 0) {
    const { data, error } = await supabase
      .from("enrollments")
      .select(`
        id,
        child_id,
        student_user_id,
        course_id,
        teacher_user_id,
        status,
        start_date,
        end_date,
        lessons_per_week,
        total_lessons,
        created_at
      `)
      .in("child_id", childIds);

    if (error) {
      throw new Error(
        `연결된 자녀 수강정보 조회 실패: ${error.message}`
      );
    }

    childEnrollments =
      (data ?? []) as StudentEnrollmentRow[];
  }

  const merged = new Map<number, StudentEnrollmentRow>();

  for (const enrollment of [
    ...(directEnrollments ?? []),
    ...childEnrollments,
  ]) {
    merged.set(
      enrollment.id,
      enrollment as StudentEnrollmentRow
    );
  }

  return Array.from(merged.values()).sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
  );
}