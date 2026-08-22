"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase-browser";

type Teacher = {
  user_id: string;
  display_name: string | null;
  nationality: string | null;
  profile_image_url: string | null;
};

type TeacherSlot =
  | {
      type: "teacher";
      teacher: Teacher;
    }
  | {
      type: "empty";
      id: string;
    };

const DISPLAY_COUNT = 5;
const ROTATE_INTERVAL = 5000;

export default function HomeTeachers() {
  const [teachers, setTeachers] =
    useState<Teacher[]>([]);

  const [startIndex, setStartIndex] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadTeachers() {
      const supabase =
        createClient();

      try {
        const {
          data,
          error,
        } = await supabase.rpc(
          "get_public_teachers"
        );

        if (error) {
          console.error(
            "HOME TEACHERS ERROR:",
            error
          );
          return;
        }

        if (!mounted) {
          return;
        }

        setTeachers(
          (data ?? []) as Teacher[]
        );
      } catch (error) {
        console.error(
          "HOME TEACHERS ERROR:",
          error
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadTeachers();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (
      teachers.length <=
      DISPLAY_COUNT
    ) {
      setStartIndex(0);
      return;
    }

    const timer =
      window.setInterval(
        () => {
          setStartIndex(
            (current) =>
              (current + 1) %
              teachers.length
          );
        },
        ROTATE_INTERVAL
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, [teachers.length]);

  const slots =
    useMemo<TeacherSlot[]>(
      () => {
        let visible: Teacher[] =
          [];

        if (
          teachers.length <=
          DISPLAY_COUNT
        ) {
          visible = teachers;
        } else {
          visible =
            Array.from(
              {
                length:
                  DISPLAY_COUNT,
              },
              (_, offset) =>
                teachers[
                  (startIndex +
                    offset) %
                    teachers.length
                ]
            );
        }

        const teacherSlots: TeacherSlot[] =
          visible.map(
            (teacher) => ({
              type: "teacher",
              teacher,
            })
          );

        const emptyCount =
          Math.max(
            0,
            DISPLAY_COUNT -
              teacherSlots.length
          );

        const emptySlots: TeacherSlot[] =
          Array.from(
            {
              length:
                emptyCount,
            },
            (_, index) => ({
              type: "empty",
              id: `empty-${index}`,
            })
          );

        return [
          ...teacherSlots,
          ...emptySlots,
        ];
      },
      [
        teachers,
        startIndex,
      ]
    );

  if (loading) {
    return (
      <div
        style={{
          minHeight: "260px",
          display: "flex",
          alignItems: "center",
          justifyContent:
            "center",
          color: "#98a2b3",
          fontSize: "13px",
          fontWeight: 700,
        }}
      >
        TALKLY 강사진을
        불러오는 중입니다...
      </div>
    );
  }

  return (
    <div>
      <div
        className="talkly-home-teacher-grid"
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(5, minmax(0, 1fr))",
          gap: "18px",
        }}
      >
        {slots.map(
          (
            slot,
            index
          ) => {
            if (
              slot.type ===
              "empty"
            ) {
              return (
                <EmptyTeacherCard
                  key={
                    slot.id
                  }
                />
              );
            }

            return (
              <TeacherCard
                key={
                  slot.teacher
                    .user_id
                }
                teacher={
                  slot.teacher
                }
              />
            );
          }
        )}
      </div>

      {teachers.length >
        DISPLAY_COUNT && (
        <div
          style={{
            marginTop: "22px",
            display: "flex",
            justifyContent:
              "center",
            alignItems:
              "center",
            gap: "10px",
          }}
        >
          {teachers.map(
            (
              teacher,
              index
            ) => (
              <button
                key={
                  teacher.user_id
                }
                type="button"
                aria-label={`강사 ${
                  index + 1
                } 보기`}
                onClick={() =>
                  setStartIndex(
                    index
                  )
                }
                style={{
                  width:
                    index ===
                    startIndex
                      ? "22px"
                      : "7px",
                  height: "7px",
                  padding: 0,
                  border: "none",
                  borderRadius:
                    "999px",
                  background:
                    index ===
                    startIndex
                      ? "#2f6fed"
                      : "#d9e0eb",
                  cursor:
                    "pointer",
                  transition:
                    "all .25s ease",
                }}
              />
            )
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 1050px) {
          .talkly-home-teacher-grid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 760px) {
          .talkly-home-teacher-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 480px) {
          .talkly-home-teacher-grid {
            grid-template-columns:
              1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function TeacherCard({
  teacher,
}: {
  teacher: Teacher;
}) {
  const name =
    teacher.display_name?.trim() ||
    "TALKLY Teacher";

  const nationality =
    teacher.nationality?.trim() ||
    "TALKLY";

  const [imageError, setImageError] =
    useState(false);

  return (
    <article
      style={{
        minWidth: 0,
        border:
          "1px solid #e4e7ec",
        borderRadius: "20px",
        overflow: "hidden",
        background: "#ffffff",
        boxShadow:
          "0 12px 32px rgba(16,24,40,.05)",
      }}
    >
      <div
        style={{
          position:
            "relative",
          width:
            "100%",
          aspectRatio:
            "4 / 5",
          background:
            "linear-gradient(135deg, #eef4ff, #f7f9fc)",
          overflow:
            "hidden",
        }}
      >
        {teacher.profile_image_url &&
        !imageError ? (
          <img
            src={
              teacher.profile_image_url
            }
            alt={`${name} teacher`}
            onError={() =>
              setImageError(
                true
              )
            }
            style={{
              width:
                "100%",
              height:
                "100%",
              objectFit:
                "cover",
              objectPosition:
                "center top",
              display:
                "block",
            }}
          />
        ) : (
          <div
            style={{
              position:
                "absolute",
              inset: 0,
              display:
                "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              color:
                "#9aaccc",
              fontSize:
                "42px",
              fontWeight:
                900,
            }}
          >
            T
          </div>
        )}
      </div>

      <div
        style={{
          padding:
            "18px 16px 20px",
          textAlign:
            "center",
        }}
      >
        <div
          style={{
            color:
              "#101828",
            fontSize:
              "17px",
            fontWeight:
              900,
            lineHeight:
              1.4,
          }}
        >
          {name}
        </div>

        <div
          style={{
            marginTop:
              "6px",
            color:
              "#667085",
            fontSize:
              "12px",
            fontWeight:
              700,
          }}
        >
          {nationality}
        </div>
      </div>
    </article>
  );
}

function EmptyTeacherCard() {
  return (
    <article
      style={{
        minWidth: 0,
        border:
          "1px solid #e4e7ec",
        borderRadius:
          "20px",
        overflow:
          "hidden",
        background:
          "#ffffff",
      }}
    >
      <div
        style={{
          width:
            "100%",
          aspectRatio:
            "4 / 5",
          background:
            "linear-gradient(135deg, #f7f9fc, #fbfcfe)",
        }}
      />

      <div
        style={{
          height:
            "74px",
          padding:
            "18px 16px 20px",
        }}
      />
    </article>
  );
}