import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type RequestTextbook = {
  textbookId: number;
  paymentRequired: boolean;
  adminNote: string | null;
};

function jsonError(
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
    }
  );
}

export async function POST(
  request: Request,
  { params }: RouteContext
) {
  const { id } = await params;
  const enrollmentId = Number(id);

  if (
    !Number.isInteger(enrollmentId) ||
    enrollmentId <= 0
  ) {
    return jsonError(
      "잘못된 수강등록 ID입니다.",
      400
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError(
      "로그인이 필요합니다.",
      401
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return jsonError(
      "관리자만 커리큘럼과 교재를 배정할 수 있습니다.",
      403
    );
  }

  let body: {
    curriculumLevelId?: unknown;
    textbooks?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return jsonError(
      "요청 데이터를 확인할 수 없습니다.",
      400
    );
  }

  const curriculumLevelId =
    Number(body.curriculumLevelId);

  if (
    !Number.isInteger(curriculumLevelId) ||
    curriculumLevelId <= 0
  ) {
    return jsonError(
      "TALKLY Grade를 선택해 주세요.",
      400
    );
  }

  if (!Array.isArray(body.textbooks)) {
    return jsonError(
      "교재 선택정보가 올바르지 않습니다.",
      400
    );
  }

  const requestedTextbooks: RequestTextbook[] =
    body.textbooks.map((value: any) => ({
      textbookId: Number(value?.textbookId),
      paymentRequired:
        value?.paymentRequired === true,
      adminNote:
        typeof value?.adminNote === "string" &&
        value.adminNote.trim()
          ? value.adminNote.trim()
          : null,
    }));

  if (
    requestedTextbooks.length === 0 ||
    requestedTextbooks.some(
      (item) =>
        !Number.isInteger(item.textbookId) ||
        item.textbookId <= 0
    )
  ) {
    return jsonError(
      "실제 수업 교재를 1권 이상 선택해 주세요.",
      400
    );
  }

  const textbookIds =
    requestedTextbooks.map(
      (item) => item.textbookId
    );

  if (
    new Set(textbookIds).size !==
    textbookIds.length
  ) {
    return jsonError(
      "동일한 교재가 중복 선택되었습니다.",
      400
    );
  }

  const admin = createAdminClient();

  const { data: enrollment, error: enrollmentError } =
    await admin
      .from("enrollments")
      .select(`
        id,
        source_payment_id
      `)
      .eq("id", enrollmentId)
      .maybeSingle();

  if (enrollmentError || !enrollment) {
    return jsonError(
      "수강등록 정보를 찾을 수 없습니다.",
      404
    );
  }

  if (!enrollment.source_payment_id) {
    return jsonError(
      "수강료 결제정보가 연결되지 않은 수강입니다.",
      409
    );
  }

  const { data: payment, error: paymentError } =
    await admin
      .from("enrollment_payments")
      .select(`
        id,
        status,
        enrollment_id
      `)
      .eq("id", enrollment.source_payment_id)
      .eq("enrollment_id", enrollmentId)
      .maybeSingle();

  if (
    paymentError ||
    !payment ||
    payment.status !== "paid"
  ) {
    return jsonError(
      "수강료 결제가 완료된 수강만 커리큘럼과 교재를 배정할 수 있습니다.",
      409
    );
  }

  const { data: level, error: levelError } =
    await admin
      .from("curriculum_levels")
      .select("id")
      .eq("id", curriculumLevelId)
      .eq("is_active", true)
      .maybeSingle();

  if (levelError || !level) {
    return jsonError(
      "선택한 TALKLY Grade를 사용할 수 없습니다.",
      400
    );
  }

  const {
    data: allowedMappings,
    error: mappingError,
  } = await admin
    .from("curriculum_level_textbooks")
    .select("textbook_id")
    .eq(
      "curriculum_level_id",
      curriculumLevelId
    )
    .eq("is_active", true)
    .in("textbook_id", textbookIds);

  if (mappingError) {
    return jsonError(
      `교재 Grade 연결정보 확인 실패: ${mappingError.message}`,
      400
    );
  }

  const allowedTextbookIds = new Set(
    (allowedMappings ?? []).map(
      (row) => Number(row.textbook_id)
    )
  );

  if (
    textbookIds.some(
      (textbookId) =>
        !allowedTextbookIds.has(textbookId)
    )
  ) {
    return jsonError(
      "선택한 Grade의 후보 교재가 아닌 교재가 포함되어 있습니다.",
      400
    );
  }

  const { data: textbookRows, error: textbookError } =
    await admin
      .from("textbooks")
      .select(`
        id,
        title,
        sale_price,
        is_for_sale
      `)
      .in("id", textbookIds)
      .eq("is_active", true)
      .eq("status", "ready");

  if (
    textbookError ||
    !textbookRows ||
    textbookRows.length !== textbookIds.length
  ) {
    return jsonError(
      "선택한 교재 중 현재 사용할 수 없는 교재가 있습니다.",
      400
    );
  }

  const textbookMap = new Map(
    textbookRows.map((row) => [
      Number(row.id),
      row,
    ])
  );

  for (const item of requestedTextbooks) {
    const textbook =
      textbookMap.get(item.textbookId);

    if (!textbook) {
      return jsonError(
        "교재 정보를 확인할 수 없습니다.",
        400
      );
    }

    if (
      item.paymentRequired &&
      (!textbook.is_for_sale ||
        textbook.sale_price === null)
    ) {
      return jsonError(
        `${textbook.title} 교재는 TALKLY 판매가가 등록되지 않아 별도 결제 필요로 설정할 수 없습니다.`,
        400
      );
    }
  }

  const {
    data: existingCurriculum,
    error: existingCurriculumError,
  } = await admin
    .from("enrollment_curriculum_assignments")
    .select("id")
    .eq("enrollment_id", enrollmentId)
    .order("id", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (existingCurriculumError) {
    return jsonError(
      `기존 커리큘럼 배정 확인 실패: ${existingCurriculumError.message}`,
      400
    );
  }

  if (existingCurriculum) {
    const { error } = await admin
      .from("enrollment_curriculum_assignments")
      .update({
        curriculum_level_id:
          curriculumLevelId,
      })
      .eq("id", existingCurriculum.id);

    if (error) {
      return jsonError(
        `커리큘럼 배정 저장 실패: ${error.message}`,
        400
      );
    }
  } else {
    const { error } = await admin
      .from("enrollment_curriculum_assignments")
      .insert({
        enrollment_id: enrollmentId,
        curriculum_level_id:
          curriculumLevelId,
      });

    if (error) {
      return jsonError(
        `커리큘럼 배정 저장 실패: ${error.message}`,
        400
      );
    }
  }

  const {
    data: existingAssignments,
    error: existingAssignmentsError,
  } = await admin
    .from("enrollment_textbooks")
    .select(`
      id,
      textbook_id,
      status
    `)
    .eq("enrollment_id", enrollmentId)
    .in("status", ["assigned", "in_use"]);

  if (existingAssignmentsError) {
    return jsonError(
      `기존 교재 배정 확인 실패: ${existingAssignmentsError.message}`,
      400
    );
  }

  const existingMap = new Map(
    (existingAssignments ?? []).map(
      (row) => [
        Number(row.textbook_id),
        row,
      ]
    )
  );

  for (const existing of existingAssignments ?? []) {
    const stillSelected =
      textbookIds.includes(
        Number(existing.textbook_id)
      );

    if (!stillSelected) {
      const { error } = await admin
        .from("enrollment_textbooks")
        .update({
          status: "removed",
        })
        .eq("id", existing.id);

      if (error) {
        return jsonError(
          `기존 교재 배정 해제 실패: ${error.message}`,
          400
        );
      }
    }
  }

  for (const item of requestedTextbooks) {
    const textbook =
      textbookMap.get(item.textbookId)!;

    const priceSnapshot =
      item.paymentRequired
        ? Number(textbook.sale_price)
        : null;

    const existing =
      existingMap.get(item.textbookId);

    if (existing) {
      const { error } = await admin
        .from("enrollment_textbooks")
        .update({
          payment_required:
            item.paymentRequired,
          price_snapshot:
            priceSnapshot,
          admin_note:
            item.adminNote,
          status:
            existing.status === "in_use"
              ? "in_use"
              : "assigned",
        })
        .eq("id", existing.id);

      if (error) {
        return jsonError(
          `교재 배정 수정 실패: ${error.message}`,
          400
        );
      }

      continue;
    }

    const { error } = await admin
      .from("enrollment_textbooks")
      .insert({
        enrollment_id:
          enrollmentId,
        textbook_id:
          item.textbookId,
        payment_required:
          item.paymentRequired,
        price_snapshot:
          priceSnapshot,
        admin_note:
          item.adminNote,
        status: "assigned",
      });

    if (error) {
      return jsonError(
        `교재 배정 저장 실패: ${error.message}`,
        400
      );
    }
  }

  return NextResponse.json({
    ok: true,
    enrollmentId,
    curriculumLevelId,
    textbookCount:
      requestedTextbooks.length,
  });
}