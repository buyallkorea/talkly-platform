"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Course = {
  id: number | string;
  name: string;
  description: string | null;
  course_type: string;
  target_group: string | null;
  subject_category: string | null;
  level: string | null;
  class_format: string | null;
  duration_minutes: number;
  lessons_per_week: number | null;
  total_lessons: number | null;
  duration_weeks: number | null;
  price: number | null;
  is_active: boolean;
  created_at: string;
};

export default function CourseListClient({
  courses,
}: {
  courses: Course[];
}) {
  const [query, setQuery] = useState("");

  /*
   * filter_all은 UI에서만 사용하는 값입니다.
   *
   * 실제 DB의 target_group = "all"은
   * "전연령"을 의미하므로 서로 구분합니다.
   */
  const [targetGroup, setTargetGroup] =
    useState("filter_all");

  const [subjectCategory, setSubjectCategory] =
    useState("filter_all");

  const [level, setLevel] =
    useState("filter_all");

  const [status, setStatus] =
    useState("filter_all");

  const filteredCourses = useMemo(() => {
    const normalized =
      query.trim().toLowerCase();

    return courses.filter((course) => {
      const matchesQuery =
        !normalized ||
        [
          course.name,
          course.description || "",
          getCourseTypeLabel(course.course_type),
          getTargetGroupLabel(course.target_group),
          getSubjectLabel(course.subject_category),
          getLevelLabel(course.level),
          getClassFormatLabel(course.class_format),
        ].some((value) =>
          value.toLowerCase().includes(normalized)
        );

      const matchesTarget =
        targetGroup === "filter_all" ||
        course.target_group === targetGroup;

      const matchesSubject =
        subjectCategory === "filter_all" ||
        course.subject_category === subjectCategory;

      const matchesLevel =
        level === "filter_all" ||
        course.level === level;

      const matchesStatus =
        status === "filter_all" ||
        (status === "active" && course.is_active) ||
        (status === "inactive" && !course.is_active);

      return (
        matchesQuery &&
        matchesTarget &&
        matchesSubject &&
        matchesLevel &&
        matchesStatus
      );
    });
  }, [
    courses,
    query,
    targetGroup,
    subjectCategory,
    level,
    status,
  ]);

  const filterApplied =
    query.trim() !== "" ||
    targetGroup !== "filter_all" ||
    subjectCategory !== "filter_all" ||
    level !== "filter_all" ||
    status !== "filter_all";

  function resetFilters() {
    setQuery("");
    setTargetGroup("filter_all");
    setSubjectCategory("filter_all");
    setLevel("filter_all");
    setStatus("filter_all");
  }

  return (
    <section
      style={{
        marginTop: "22px",
      }}
    >
      {/* 검색 / 필터 */}
      <div
        style={{
          padding: "18px",
          border: "1px solid #e4e7ec",
          borderRadius: "14px",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(240px, 1.4fr) repeat(4, minmax(145px, .7fr)) auto",
            gap: "10px",
          }}
        >
          {/* 검색 */}
          <input
            type="search"
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="과정명, 설명, 분류 검색"
            style={fieldStyle}
          />

          {/* 수강 대상 */}
          <select
            value={targetGroup}
            onChange={(event) =>
              setTargetGroup(event.target.value)
            }
            style={fieldStyle}
          >
            <option value="filter_all">
              전체 대상
            </option>

            <option value="preschool">
              영유아
            </option>

            <option value="elementary">
              초등
            </option>

            <option value="middle">
              중등
            </option>

            <option value="high">
              고등
            </option>

            <option value="university">
              대학생
            </option>

            <option value="adult">
              성인
            </option>

            <option value="senior">
              시니어
            </option>

            <option value="all">
              전연령
            </option>
          </select>

          {/* 과정 분야 */}
          <select
            value={subjectCategory}
            onChange={(event) =>
              setSubjectCategory(event.target.value)
            }
            style={fieldStyle}
          >
            <option value="filter_all">
              전체 분야
            </option>

            <option value="conversation">
              회화
            </option>

            <option value="phonics">
              파닉스
            </option>

            <option value="reading">
              리딩
            </option>

            <option value="grammar">
              문법
            </option>

            <option value="writing">
              작문
            </option>

            <option value="test">
              시험
            </option>

            <option value="business">
              비즈니스
            </option>

            <option value="experiential">
              체험영어
            </option>

            <option value="comprehensive">
              종합
            </option>

            <option value="other">
              기타
            </option>
          </select>

          {/* 학습 레벨 */}
          <select
            value={level}
            onChange={(event) =>
              setLevel(event.target.value)
            }
            style={fieldStyle}
          >
            <option value="filter_all">
              전체 레벨
            </option>

            <option value="beginner">
              입문
            </option>

            <option value="elementary">
              초급
            </option>

            <option value="pre_intermediate">
              초중급
            </option>

            <option value="intermediate">
              중급
            </option>

            <option value="upper_intermediate">
              중고급
            </option>

            <option value="advanced">
              고급
            </option>

            <option value="all">
              레벨 무관
            </option>
          </select>

          {/* 운영 상태 */}
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
            style={fieldStyle}
          >
            <option value="filter_all">
              전체 상태
            </option>

            <option value="active">
              활성
            </option>

            <option value="inactive">
              비활성
            </option>
          </select>

          {/* 초기화 */}
          <button
            type="button"
            onClick={resetFilters}
            disabled={!filterApplied}
            style={{
              minHeight: "44px",
              padding: "0 15px",
              border: "1px solid #d0d5dd",
              borderRadius: "9px",
              background: "#ffffff",
              color: filterApplied
                ? "#344054"
                : "#98a2b3",
              fontSize: "12px",
              fontWeight: 800,
              cursor: filterApplied
                ? "pointer"
                : "default",
              whiteSpace: "nowrap",
              opacity: filterApplied ? 1 : 0.65,
            }}
          >
            초기화
          </button>
        </div>

        {/* 검색 결과 개수 */}
        <div
          style={{
            marginTop: "13px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              color: "#667085",
              fontSize: "12px",
            }}
          >
            전체 {courses.length}개 중{" "}
            <strong
              style={{
                color: "#101828",
              }}
            >
              {filteredCourses.length}개
            </strong>{" "}
            과정 표시
          </div>

          {filterApplied && (
            <div
              style={{
                color: "#2f6fed",
                fontSize: "11px",
                fontWeight: 800,
              }}
            >
              필터 적용 중
            </div>
          )}
        </div>
      </div>

      {/* 검색 결과 없음 */}
      {filteredCourses.length === 0 ? (
        <div
          style={{
            marginTop: "18px",
            padding: "70px 24px",
            border: "1px solid #e4e7ec",
            borderRadius: "16px",
            background: "#ffffff",
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: "#101828",
              fontSize: "17px",
              fontWeight: 900,
            }}
          >
            조건에 맞는 과정이 없습니다.
          </div>

          <p
            style={{
              margin: "8px 0 0",
              color: "#98a2b3",
              fontSize: "13px",
            }}
          >
            검색어 또는 필터 조건을 변경해주세요.
          </p>

          {filterApplied && (
            <button
              type="button"
              onClick={resetFilters}
              style={{
                marginTop: "18px",
                minHeight: "40px",
                padding: "0 15px",
                border: "1px solid #d0d5dd",
                borderRadius: "9px",
                background: "#ffffff",
                color: "#344054",
                fontSize: "12px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              검색 조건 초기화
            </button>
          )}
        </div>
      ) : (
        /* 과정 카드 */
        <div
          style={{
            marginTop: "18px",
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: "14px",
          }}
        >
          {filteredCourses.map((course) => (
            <article
              key={course.id}
              style={{
                padding: "22px",
                border: "1px solid #e4e7ec",
                borderRadius: "15px",
                background: course.is_active
                  ? "#ffffff"
                  : "#f9fafb",
                opacity: course.is_active
                  ? 1
                  : 0.82,
              }}
            >
              {/* 카드 상단 */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <h2
                      style={{
                        margin: 0,
                        color: "#101828",
                        fontSize: "20px",
                        lineHeight: 1.35,
                        letterSpacing: "-0.025em",
                      }}
                    >
                      {course.name}
                    </h2>

                    <StatusBadge
                      active={course.is_active}
                    />
                  </div>

                  <p
                    style={{
                      margin: "9px 0 0",
                      color: "#667085",
                      fontSize: "12px",
                      lineHeight: 1.65,
                      minHeight: "40px",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {course.description ||
                      "등록된 과정 설명이 없습니다."}
                  </p>
                </div>

                <Link
                  href={`/admin/courses/${course.id}`}
                  style={{
                    minHeight: "38px",
                    padding: "0 12px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid #d0d5dd",
                    borderRadius: "8px",
                    background: "#ffffff",
                    color: "#344054",
                    textDecoration: "none",
                    fontSize: "12px",
                    fontWeight: 900,
                    whiteSpace: "nowrap",
                  }}
                >
                  상세보기
                </Link>
              </div>

              {/* 분류 태그 */}
              <div
                style={{
                  marginTop: "18px",
                  display: "flex",
                  gap: "7px",
                  flexWrap: "wrap",
                }}
              >
                <Tag>
                  {getTargetGroupLabel(
                    course.target_group
                  )}
                </Tag>

                <Tag>
                  {getSubjectLabel(
                    course.subject_category
                  )}
                </Tag>

                <Tag>
                  {getLevelLabel(course.level)}
                </Tag>

                <Tag>
                  {getClassFormatLabel(
                    course.class_format
                  )}
                </Tag>

                <Tag>
                  {getCourseTypeLabel(
                    course.course_type
                  )}
                </Tag>
              </div>

              {/* 과정 조건 */}
              <div
                style={{
                  marginTop: "18px",
                  paddingTop: "17px",
                  borderTop: "1px solid #eef1f5",
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(5, minmax(0, 1fr))",
                  gap: "12px",
                }}
              >
                <Info
                  label="수업시간"
                  value={`${course.duration_minutes}분`}
                />

                <Info
                  label="주당"
                  value={
                    course.lessons_per_week != null
                      ? `${course.lessons_per_week}회`
                      : "-"
                  }
                />

                <Info
                  label="기간"
                  value={
                    course.duration_weeks != null
                      ? `${course.duration_weeks}주`
                      : "-"
                  }
                />

                <Info
                  label="총수업"
                  value={
                    course.total_lessons != null
                      ? `${course.total_lessons}회`
                      : "-"
                  }
                />

                <Info
                  label="수강료"
                  value={
                    course.price != null
                      ? `${Number(
                          course.price
                        ).toLocaleString(
                          "ko-KR"
                        )}원`
                      : "-"
                  }
                />
              </div>

              {/* 카드 하단 */}
              <div
                style={{
                  marginTop: "18px",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "8px",
                }}
              >
                <Link
                  href={`/admin/courses/${course.id}/edit`}
                  style={{
                    minHeight: "38px",
                    padding: "0 13px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid #d0d5dd",
                    borderRadius: "8px",
                    background: "#ffffff",
                    color: "#344054",
                    textDecoration: "none",
                    fontSize: "12px",
                    fontWeight: 900,
                  }}
                >
                  수정
                </Link>

                <Link
                  href={`/admin/courses/${course.id}`}
                  style={{
                    minHeight: "38px",
                    padding: "0 13px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    borderRadius: "8px",
                    background: "#0A1F44",
                    color: "#ffffff",
                    textDecoration: "none",
                    fontSize: "12px",
                    fontWeight: 900,
                  }}
                >
                  과정 상세 →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Tag({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        minHeight: "27px",
        padding: "0 9px",
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        background: "#eef4ff",
        color: "#2f6fed",
        fontSize: "10px",
        fontWeight: 900,
      }}
    >
      {children}
    </span>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={{
          color: "#98a2b3",
          fontSize: "10px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "5px",
          color: "#344054",
          fontSize: "12px",
          fontWeight: 900,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      style={{
        minHeight: "25px",
        padding: "0 8px",
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        background: active
          ? "#ecfdf3"
          : "#f2f4f7",
        color: active
          ? "#027a48"
          : "#667085",
        fontSize: "10px",
        fontWeight: 900,
      }}
    >
      {active ? "활성" : "비활성"}
    </span>
  );
}

function getCourseTypeLabel(
  value: string
) {
  switch (value) {
    case "video_english":
      return "화상영어";

    case "phone_english":
      return "전화영어";

    case "experience":
      return "체험영어";

    case "other":
      return "기타";

    default:
      return value || "-";
  }
}

function getTargetGroupLabel(
  value: string | null
) {
  switch (value) {
    case "preschool":
      return "영유아";

    case "elementary":
      return "초등";

    case "middle":
      return "중등";

    case "high":
      return "고등";

    case "university":
      return "대학생";

    case "adult":
      return "성인";

    case "senior":
      return "시니어";

    case "all":
      return "전연령";

    default:
      return "미분류";
  }
}

function getSubjectLabel(
  value: string | null
) {
  switch (value) {
    case "conversation":
      return "회화";

    case "phonics":
      return "파닉스";

    case "reading":
      return "리딩";

    case "grammar":
      return "문법";

    case "writing":
      return "작문";

    case "test":
      return "시험";

    case "business":
      return "비즈니스";

    case "experiential":
      return "체험영어";

    case "comprehensive":
      return "종합";

    case "other":
      return "기타";

    default:
      return "미분류";
  }
}

function getLevelLabel(
  value: string | null
) {
  switch (value) {
    case "beginner":
      return "입문";

    case "elementary":
      return "초급";

    case "pre_intermediate":
      return "초중급";

    case "intermediate":
      return "중급";

    case "upper_intermediate":
      return "중고급";

    case "advanced":
      return "고급";

    case "all":
      return "레벨 무관";

    default:
      return "미분류";
  }
}

function getClassFormatLabel(
  value: string | null
) {
  switch (value) {
    case "one_to_one":
      return "1:1";

    case "group":
      return "그룹";

    default:
      return "미분류";
  }
}

const fieldStyle = {
  width: "100%",
  minHeight: "44px",
  boxSizing: "border-box" as const,
  padding: "0 12px",
  border: "1px solid #d0d5dd",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#101828",
  fontFamily: "inherit",
  fontSize: "12px",
  outline: "none",
};