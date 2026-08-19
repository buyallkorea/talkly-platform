"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const NATIONALITIES = [
  "미국",
  "영국",
  "호주",
  "뉴질랜드",
  "아일랜드",
  "남아공",
  "캐나다",
  "기타",
] as const;

type Profile = {
  id: string;
  name: string | null;
  phone: string | null;
  birth_date: string | null;
  gender: string | null;
  profile_image_url: string | null;
};

type Teacher = {
  user_id: string;
  display_name: string | null;
  nationality: string | null;
  bio: string | null;
  specialties: string[] | null;
  years_experience: number | null;
  education: string | null;
  certifications: string | null;
  hourly_rate: number | null;
  is_active: boolean;
};

export default function EditTeacherForm({
  profile,
  teacher,
}: {
  profile: Profile;
  teacher: Teacher;
}) {
  const router = useRouter();

  const knownNationality =
    teacher.nationality &&
    NATIONALITIES.includes(
      teacher.nationality as (typeof NATIONALITIES)[number]
    ) &&
    teacher.nationality !== "기타";

  const [name, setName] = useState(profile.name || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [birthDate, setBirthDate] = useState(
    profile.birth_date || ""
  );
  const [gender, setGender] = useState(
    profile.gender || ""
  );

  const [imageFile, setImageFile] =
    useState<File | null>(null);

  const [imagePreview, setImagePreview] =
    useState(profile.profile_image_url || "");

  const [displayName, setDisplayName] = useState(
    teacher.display_name || ""
  );

  const [nationality, setNationality] = useState(
    knownNationality
      ? teacher.nationality || ""
      : teacher.nationality
        ? "기타"
        : ""
  );

  const [customNationality, setCustomNationality] =
    useState(
      knownNationality
        ? ""
        : teacher.nationality || ""
    );

  const [bio, setBio] = useState(
    teacher.bio || ""
  );

  const [specialties, setSpecialties] = useState(
    teacher.specialties?.join(", ") || ""
  );

  const [yearsExperience, setYearsExperience] =
    useState(
      teacher.years_experience != null
        ? String(teacher.years_experience)
        : ""
    );

  const [education, setEducation] = useState(
    teacher.education || ""
  );

  const [certifications, setCertifications] =
    useState(
      teacher.certifications || ""
    );

  const [hourlyRate, setHourlyRate] = useState(
    teacher.hourly_rate != null
      ? String(teacher.hourly_rate)
      : ""
  );

  const [isActive, setIsActive] = useState(
    teacher.is_active
  );

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  function handleImageChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    setErrorMessage("");

    if (!file) {
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setErrorMessage(
        "프로필 사진은 JPG, PNG, WEBP 형식만 등록할 수 있습니다."
      );
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage(
        "프로필 사진은 5MB 이하만 등록할 수 있습니다."
      );
      event.target.value = "";
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");

    if (!name.trim()) {
      setErrorMessage("강사 이름을 입력해주세요.");
      return;
    }

    if (!nationality) {
      setErrorMessage("국적을 선택해주세요.");
      return;
    }

    if (
      nationality === "기타" &&
      !customNationality.trim()
    ) {
      setErrorMessage(
        "기타 국적을 직접 입력해주세요."
      );
      return;
    }

    if (
      yearsExperience &&
      Number(yearsExperience) < 0
    ) {
      setErrorMessage(
        "강사 경력을 확인해주세요."
      );
      return;
    }

    if (
      hourlyRate &&
      Number(hourlyRate) < 0
    ) {
      setErrorMessage(
        "시간당 수업료를 확인해주세요."
      );
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMessage(
          "로그인 정보를 확인할 수 없습니다."
        );
        setLoading(false);
        return;
      }

      const { data: adminProfile, error: adminError } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

      if (
        adminError ||
        !adminProfile ||
        adminProfile.role !== "admin"
      ) {
        setErrorMessage(
          "관리자 권한을 확인할 수 없습니다."
        );
        setLoading(false);
        return;
      }

      const finalNationality =
        nationality === "기타"
          ? customNationality.trim()
          : nationality;

      const specialtyArray = specialties
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      let profileImageUrl =
        profile.profile_image_url;

      if (imageFile) {
        const imagePath =
          `${teacher.user_id}/profile-image`;

        const { error: uploadError } =
          await supabase.storage
            .from("teacher-profile-images")
            .upload(imagePath, imageFile, {
              upsert: true,
              contentType: imageFile.type,
              cacheControl: "3600",
            });

        if (uploadError) {
          setErrorMessage(
            `프로필 사진 업로드 실패: ${uploadError.message}`
          );
          setLoading(false);
          return;
        }

        const { data: publicUrlData } =
          supabase.storage
            .from("teacher-profile-images")
            .getPublicUrl(imagePath);

        profileImageUrl =
          `${publicUrlData.publicUrl}?v=${Date.now()}`;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          name: name.trim(),
          phone: phone.trim() || null,
          birth_date: birthDate || null,
          gender: gender || null,
          profile_image_url: profileImageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (profileError) {
        setErrorMessage(
          `기본정보 수정 실패: ${profileError.message}`
        );
        setLoading(false);
        return;
      }

      const { data, error: teacherError } =
        await supabase
          .from("teacher_profiles")
          .update({
            display_name:
              displayName.trim() || name.trim(),
            nationality: finalNationality,
            bio: bio.trim() || null,
            specialties: specialtyArray,
            years_experience:
              yearsExperience !== ""
                ? Number(yearsExperience)
                : null,
            education: education.trim() || null,
            certifications:
              certifications.trim() || null,
            hourly_rate:
              hourlyRate !== ""
                ? Number(hourlyRate)
                : null,
            is_active: isActive,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", teacher.user_id)
          .select();

      if (teacherError) {
        setErrorMessage(
          `강사정보 수정 실패: ${teacherError.message}`
        );
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setErrorMessage(
          "수정된 강사정보를 확인할 수 없습니다."
        );
        setLoading(false);
        return;
      }

      router.push(
        `/admin/teachers/${teacher.user_id}`
      );
      router.refresh();
    } catch (error) {
      console.error(
        "TEACHER UPDATE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? `강사정보 수정 오류: ${error.message}`
          : "강사정보 수정 중 오류가 발생했습니다."
      );

      setLoading(false);
    }
  }

  const labelStyle = {
    display: "block",
    marginBottom: "8px",
    fontWeight: 600,
  };

  const fieldStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "12px 14px",
    border: "1px solid #d9d9d9",
    borderRadius: "8px",
    fontSize: "16px",
  };

  const sectionStyle = {
    padding: "24px",
    border: "1px solid #ddd",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "18px",
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        width: "100%",
        maxWidth: "650px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>
          프로필 사진
        </h2>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "22px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: "150px",
              height: "150px",
              borderRadius: "50%",
              border: "1px solid #ddd",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#f5f5f5",
              color: "#777",
              flexShrink: 0,
            }}
          >
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="강사 프로필 사진 미리보기"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <span style={{ fontSize: "13px" }}>
                등록된 사진 없음
              </span>
            )}
          </div>

          <div style={{ flex: 1, minWidth: "240px" }}>
            <label
              htmlFor="profileImage"
              style={labelStyle}
            >
              사진 선택
            </label>

            <input
              id="profileImage"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              style={{
                ...fieldStyle,
                padding: "10px",
              }}
            />

            <p
              style={{
                marginTop: "9px",
                marginBottom: 0,
                fontSize: "13px",
                color: "#666",
                lineHeight: 1.6,
              }}
            >
              JPG, PNG, WEBP 형식 · 최대 5MB
              <br />
              새 사진을 선택한 뒤 아래의 강사정보 수정 버튼을 누르면 저장됩니다.
            </p>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>
          기본 정보
        </h2>

        <div>
          <label htmlFor="name" style={labelStyle}>
            강사 이름 *
          </label>

          <input
            id="name"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            required
            style={fieldStyle}
          />
        </div>

        <div>
          <label
            htmlFor="displayName"
            style={labelStyle}
          >
            표시 이름
          </label>

          <input
            id="displayName"
            value={displayName}
            onChange={(event) =>
              setDisplayName(event.target.value)
            }
            style={fieldStyle}
          />
        </div>

        <div>
          <label
            htmlFor="nationality"
            style={labelStyle}
          >
            국적 *
          </label>

          <select
            id="nationality"
            value={nationality}
            onChange={(event) => {
              const value = event.target.value;
              setNationality(value);

              if (value !== "기타") {
                setCustomNationality("");
              }
            }}
            required
            style={fieldStyle}
          >
            <option value="">
              국적을 선택해주세요
            </option>

            {NATIONALITIES.map((item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            ))}
          </select>
        </div>

        {nationality === "기타" && (
          <div>
            <label
              htmlFor="customNationality"
              style={labelStyle}
            >
              기타 국적 *
            </label>

            <input
              id="customNationality"
              value={customNationality}
              onChange={(event) =>
                setCustomNationality(
                  event.target.value
                )
              }
              required
              style={fieldStyle}
            />
          </div>
        )}

        <div>
          <label htmlFor="phone" style={labelStyle}>
            연락처
          </label>

          <input
            id="phone"
            value={phone}
            onChange={(event) =>
              setPhone(event.target.value)
            }
            style={fieldStyle}
          />
        </div>

        <div>
          <label
            htmlFor="birthDate"
            style={labelStyle}
          >
            생년월일
          </label>

          <input
            id="birthDate"
            type="date"
            value={birthDate}
            onChange={(event) =>
              setBirthDate(event.target.value)
            }
            style={fieldStyle}
          />
        </div>

        <div>
          <label
            htmlFor="gender"
            style={labelStyle}
          >
            성별
          </label>

          <select
            id="gender"
            value={gender}
            onChange={(event) =>
              setGender(event.target.value)
            }
            style={fieldStyle}
          >
            <option value="">선택 안 함</option>
            <option value="male">남성</option>
            <option value="female">여성</option>
            <option value="other">기타</option>
          </select>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>
          강사 프로필
        </h2>

        <div>
          <label htmlFor="bio" style={labelStyle}>
            강사 소개
          </label>

          <textarea
            id="bio"
            value={bio}
            onChange={(event) =>
              setBio(event.target.value)
            }
            rows={5}
            style={{
              ...fieldStyle,
              resize: "vertical",
            }}
          />
        </div>

        <div>
          <label
            htmlFor="specialties"
            style={labelStyle}
          >
            전문분야
          </label>

          <input
            id="specialties"
            value={specialties}
            onChange={(event) =>
              setSpecialties(event.target.value)
            }
            placeholder="초등영어, 회화, 파닉스"
            style={fieldStyle}
          />
        </div>

        <div>
          <label
            htmlFor="yearsExperience"
            style={labelStyle}
          >
            경력(년)
          </label>

          <input
            id="yearsExperience"
            type="number"
            min="0"
            value={yearsExperience}
            onChange={(event) =>
              setYearsExperience(
                event.target.value
              )
            }
            style={fieldStyle}
          />
        </div>

        <div>
          <label
            htmlFor="education"
            style={labelStyle}
          >
            학력
          </label>

          <textarea
            id="education"
            value={education}
            onChange={(event) =>
              setEducation(event.target.value)
            }
            rows={3}
            style={{
              ...fieldStyle,
              resize: "vertical",
            }}
          />
        </div>

        <div>
          <label
            htmlFor="certifications"
            style={labelStyle}
          >
            자격 및 인증
          </label>

          <textarea
            id="certifications"
            value={certifications}
            onChange={(event) =>
              setCertifications(
                event.target.value
              )
            }
            rows={3}
            style={{
              ...fieldStyle,
              resize: "vertical",
            }}
          />
        </div>

        <div>
          <label
            htmlFor="hourlyRate"
            style={labelStyle}
          >
            시간당 수업료
          </label>

          <input
            id="hourlyRate"
            type="number"
            min="0"
            step="1000"
            value={hourlyRate}
            onChange={(event) =>
              setHourlyRate(event.target.value)
            }
            style={fieldStyle}
          />
        </div>

        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) =>
                setIsActive(event.target.checked)
              }
            />

            활성 강사
          </label>

          <small>
            비활성화하면 신규 수강생 강사 배정 목록에서 제외됩니다.
          </small>
        </div>
      </section>

      {errorMessage && (
        <div
          style={{
            padding: "14px",
            border: "1px solid #d93025",
            borderRadius: "8px",
            color: "#d93025",
          }}
        >
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "15px",
          border: "none",
          borderRadius: "8px",
          fontSize: "16px",
          fontWeight: 700,
          cursor: loading
            ? "default"
            : "pointer",
        }}
      >
        {loading
          ? "강사정보 수정 중..."
          : "강사정보 수정"}
      </button>
    </form>
  );
}