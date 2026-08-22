"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase-browser";

type Teacher = {
  user_id: string;
  display_name: string | null;
  nationality: string | null;
  profile_image_url: string | null;
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

  /*
   * 강사가 5명을 초과하면
   * 5초마다 한 명씩 이동하면서
   * 다음 강사들이 자연스럽게 보입니다.
   */
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

  const visibleTeachers =
    useMemo(() => {
      if (
        teachers.length <=
        DISPLAY_COUNT
      ) {
        return teachers;
      }

      return Array.from(
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
    }, [
      teachers,
      startIndex,
    ]);

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

  if (
    teachers.length === 0
  ) {
    return (
      <div
        style={{
          padding: "44px 24px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "18px",
          background: "#ffffff",
          textAlign: "center",
          color: "#667085",
          fontSize: "14px",
        }}
      >
        현재 공개 중인 강사
        정보가 없습니다.
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
            `repeat(${Math.min(
              visibleTeachers.length,
              DISPLAY_COUNT
            )}, minmax(0, 1fr))`,
          gap: "18px",
        }}
      >
        {visibleTeachers.map(
          (teacher) => (
            <TeacherCard
              key={
                teacher.user_id
              }
              teacher={
                teacher
              }
            />
          )
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
          position: "relative",
          width: "100%",
          aspectRatio: "4 / 5",
          background:
            "linear-gradient(135deg, #eef4ff, #f7f9fc)",
          overflow: "hidden",
        }}
      >
        {teacher.profile_image_url ? (
          <Image
            src={
              teacher.profile_image_url
            }
            alt={`${name} teacher`}
            fill
            sizes="(max-width: 480px) 100vw, (max-width: 760px) 50vw, 240px"
            style={{
              objectFit:
                "cover",
              objectPosition:
                "center top",
            }}
          />
        ) : (
          <div
            style={{
              position:
                "absolute",
              inset: 0,
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              color: "#9aaccc",
              fontSize: "42px",
              fontWeight: 900,
            }}
          >
            T
          </div>
        )}
      </div>

      <div
        style={{
          padding: "18px 16px 20px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            color: "#101828",
            fontSize: "17px",
            fontWeight: 900,
            lineHeight: 1.4,
          }}
        >
          {name}
        </div>

        <div
          style={{
            marginTop: "6px",
            color: "#667085",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          {nationality}
        </div>
      </div>
    </article>
  );
}