"use client";

import {
  ChangeEvent,
  FormEvent,
  useState,
} from "react";
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

export default function TeacherForm() {
  const router =
    useRouter();

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    name,
    setName,
  ] = useState("");

  const [
    phone,
    setPhone,
  ] = useState("");

  const [
    displayName,
    setDisplayName,
  ] = useState("");

  const [
    nationality,
    setNationality,
  ] = useState("");

  const [
    customNationality,
    setCustomNationality,
  ] = useState("");

  const [
    bio,
    setBio,
  ] = useState("");

  const [
    specialties,
    setSpecialties,
  ] = useState("");

  const [
    yearsExperience,
    setYearsExperience,
  ] = useState("");

  const [
    education,
    setEducation,
  ] = useState("");

  const [
    certifications,
    setCertifications,
  ] = useState("");

  const [
    hourlyRate,
    setHourlyRate,
  ] = useState("");

  const [
    imageFile,
    setImageFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    imagePreview,
    setImagePreview,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  function handleImageChange(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    setErrorMessage("");
    setSuccessMessage("");

    if (!file) {
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (
      !allowedTypes.includes(
        file.type
      )
    ) {
      setErrorMessage(
        "프로필 사진은 JPG, PNG, WEBP 형식만 등록할 수 있습니다."
      );

      event.target.value = "";

      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      setErrorMessage(
        "프로필 사진은 5MB 이하만 등록할 수 있습니다."
      );

      event.target.value = "";

      return;
    }

    setImageFile(file);

    setImagePreview(
      URL.createObjectURL(
        file
      )
    );
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    if (!email.trim()) {
      setErrorMessage(
        "이메일을 입력해주세요."
      );

      return;
    }

    if (!name.trim()) {
      setErrorMessage(
        "강사 이름을 입력해주세요."
      );

      return;
    }

    if (!nationality) {
      setErrorMessage(
        "강사 국적을 선택해주세요."
      );

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
      Number(
        yearsExperience
      ) < 0
    ) {
      setErrorMessage(
        "강사 경력을 확인해주세요."
      );

      return;
    }

    if (
      hourlyRate &&
      Number(
        hourlyRate
      ) < 0
    ) {
      setErrorMessage(
        "시간당 수업료를 확인해주세요."
      );

      return;
    }

    setLoading(true);

    try {
      const specialtyArray =
        specialties
          .split(",")
          .map((item) =>
            item.trim()
          )
          .filter(Boolean);

      const finalNationality =
        nationality === "기타"
          ? customNationality.trim()
          : nationality;

      /*
       * 관리자에게 강사의 비밀번호를
       * 입력받지 않습니다.
       */
      const response =
        await fetch(
          "/api/admin/teachers",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                email:
                  email
                    .trim()
                    .toLowerCase(),

                name:
                  name.trim(),

                phone:
                  phone.trim(),

                displayName:
                  displayName.trim(),

                nationality:
                  finalNationality,

                bio:
                  bio.trim(),

                specialties:
                  specialtyArray,

                yearsExperience,

                education:
                  education.trim(),

                certifications:
                  certifications.trim(),

                hourlyRate,
              }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        setErrorMessage(
          result.error ||
            "강사 초대에 실패했습니다."
        );

        return;
      }

      const teacherUserId =
        typeof result.userId === "string"
          ? result.userId
          : "";

      if (!teacherUserId) {
        setErrorMessage(
          "생성된 강사 ID를 확인할 수 없습니다."
        );

        return;
      }

      /*
       * 기존 프로필 사진 등록 기능 유지
       */
      if (imageFile) {
        const supabase =
          createClient();

        const imagePath =
          `${teacherUserId}/profile-image`;

        const {
          error: uploadError,
        } =
          await supabase.storage
            .from(
              "teacher-profile-images"
            )
            .upload(
              imagePath,
              imageFile,
              {
                upsert: true,

                contentType:
                  imageFile.type,

                cacheControl:
                  "3600",
              }
            );

        if (uploadError) {
          setErrorMessage(
            `강사 초대는 완료되었지만 프로필 사진 업로드에 실패했습니다: ${uploadError.message}`
          );

          return;
        }

        const {
          data: publicUrlData,
        } =
          supabase.storage
            .from(
              "teacher-profile-images"
            )
            .getPublicUrl(
              imagePath
            );

        const profileImageUrl =
          `${publicUrlData.publicUrl}?v=${Date.now()}`;

        const {
          error: profileImageError,
        } =
          await supabase
            .from("profiles")
            .update({
              profile_image_url:
                profileImageUrl,

              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              teacherUserId
            );

        if (profileImageError) {
          setErrorMessage(
            `강사 초대는 완료되었지만 프로필 사진 정보 저장에 실패했습니다: ${profileImageError.message}`
          );

          return;
        }
      }

      setSuccessMessage(
        typeof result.message === "string"
          ? result.message
          : "강사 초대 이메일을 발송했습니다."
      );

      window.setTimeout(
        () => {
          router.push(
            `/admin/teachers/${teacherUserId}`
          );

          router.refresh();
        },
        900
      );
    } catch (error) {
      console.error(
        "TEACHER INVITE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? `강사 초대 오류: ${error.message}`
          : "강사 초대 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  const labelStyle = {
    display: "block",
    marginBottom: "8px",
    fontWeight: 700,
  };

  const fieldStyle = {
    width: "100%",
    boxSizing:
      "border-box" as const,
    padding: "12px 14px",
    border:
      "1px solid #d6deea",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#101828",
    fontSize: "15px",
    outline: "none",
  };

  const sectionStyle = {
    padding: "24px",
    border:
      "1px solid #e4e7ec",
    borderRadius: "14px",
    background: "#ffffff",
    boxShadow:
      "0 1px 2px rgba(16,24,40,0.03), 0 8px 24px rgba(16,24,40,0.04)",
    display: "flex",
    flexDirection:
      "column" as const,
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
      {/* 프로필 사진 */}
      <section style={sectionStyle}>
        <div>
          <h2
            style={{
              margin: 0,
            }}
          >
            프로필 사진
          </h2>

          <p
            style={{
              marginTop: "6px",
              marginBottom: 0,
              color: "#667085",
              fontSize: "13px",
            }}
          >
            메인 페이지와 강사 소개 화면에
            표시될 사진입니다.
          </p>
        </div>

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
              border:
                "1px solid #d6deea",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#f2f4f7",
              color: "#667085",
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
              <span
                style={{
                  fontSize: "13px",
                }}
              >
                등록할 사진 없음
              </span>
            )}
          </div>

          <div
            style={{
              flex: 1,
              minWidth: "240px",
            }}
          >
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
              onChange={
                handleImageChange
              }
              disabled={loading}
              style={{
                ...fieldStyle,
                padding: "7px",
              }}
            />

            <p
              style={{
                marginTop: "9px",
                marginBottom: 0,
                fontSize: "13px",
                color: "#667085",
                lineHeight: 1.6,
              }}
            >
              JPG, PNG, WEBP · 최대 5MB ·
              1:1 비율 권장
            </p>
          </div>
        </div>
      </section>

      {/* 로그인 / 초대 */}
      <section style={sectionStyle}>
        <div>
          <h2
            style={{
              margin: 0,
            }}
          >
            로그인 / 초대 정보
          </h2>

          <p
            style={{
              marginBottom: 0,
              color: "#667085",
              lineHeight: 1.65,
            }}
          >
            관리자는 강사의 비밀번호를
            입력하지 않습니다. 아래 이메일로
            계정 설정 링크를 보내며, 강사가
            직접 비밀번호를 설정합니다.
          </p>
        </div>

        <div>
          <label
            htmlFor="email"
            style={labelStyle}
          >
            이메일 *
          </label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(
                event.target.value
              )
            }
            placeholder="teacher@example.com"
            autoComplete="email"
            required
            disabled={loading}
            style={fieldStyle}
          />
        </div>

        <div
          style={{
            padding: "14px 16px",
            border:
              "1px solid #dbe7ff",
            borderRadius: "10px",
            background: "#f7faff",
            color: "#344054",
            fontSize: "13px",
            lineHeight: 1.65,
          }}
        >
          등록 후 강사에게 TALKLY 초대
          이메일이 발송됩니다. 초대 링크에서
          계정 설정을 완료하기 전까지는 강사
          페이지 접근을 제한합니다.
        </div>
      </section>

      {/* 기본 정보 */}
      <section style={sectionStyle}>
        <h2
          style={{
            margin: 0,
          }}
        >
          기본 정보
        </h2>

        <div>
          <label
            htmlFor="name"
            style={labelStyle}
          >
            강사 이름 *
          </label>

          <input
            id="name"
            value={name}
            onChange={(event) =>
              setName(
                event.target.value
              )
            }
            placeholder="예: Daniel Smith"
            required
            disabled={loading}
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
              setDisplayName(
                event.target.value
              )
            }
            placeholder="예: Daniel Teacher"
            disabled={loading}
            style={fieldStyle}
          />

          <small>
            비워두면 강사 이름이 자동으로
            사용됩니다.
          </small>
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
              const value =
                event.target.value;

              setNationality(value);

              if (
                value !== "기타"
              ) {
                setCustomNationality(
                  ""
                );
              }
            }}
            required
            disabled={loading}
            style={fieldStyle}
          >
            <option value="">
              국적을 선택해주세요
            </option>

            {NATIONALITIES.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              )
            )}
          </select>
        </div>

        {nationality ===
          "기타" && (
          <div>
            <label
              htmlFor="customNationality"
              style={labelStyle}
            >
              기타 국적 *
            </label>

            <input
              id="customNationality"
              type="text"
              value={
                customNationality
              }
              onChange={(event) =>
                setCustomNationality(
                  event.target.value
                )
              }
              placeholder="예: 필리핀"
              required
              disabled={loading}
              style={fieldStyle}
            />

            <small>
              실제 국적명을 직접
              입력해주세요.
            </small>
          </div>
        )}

        <div>
          <label
            htmlFor="phone"
            style={labelStyle}
          >
            연락처
          </label>

          <input
            id="phone"
            value={phone}
            onChange={(event) =>
              setPhone(
                event.target.value
              )
            }
            placeholder="010-0000-0000"
            disabled={loading}
            style={fieldStyle}
          />
        </div>
      </section>

      {/* 강사 프로필 */}
      <section style={sectionStyle}>
        <h2
          style={{
            margin: 0,
          }}
        >
          강사 프로필
        </h2>

        <div>
          <label
            htmlFor="bio"
            style={labelStyle}
          >
            강사 소개
          </label>

          <textarea
            id="bio"
            value={bio}
            onChange={(event) =>
              setBio(
                event.target.value
              )
            }
            rows={5}
            placeholder="강사의 수업 경력과 특징 등을 입력해주세요."
            disabled={loading}
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
              setSpecialties(
                event.target.value
              )
            }
            placeholder="초등영어, 회화, 파닉스"
            disabled={loading}
            style={fieldStyle}
          />

          <small>
            여러 분야는 쉼표(,)로
            구분해주세요.
          </small>
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
            placeholder="예: 10"
            disabled={loading}
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
              setEducation(
                event.target.value
              )
            }
            rows={3}
            placeholder="예: University of California, English Education"
            disabled={loading}
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
            placeholder="예: TESOL, TEFL"
            disabled={loading}
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
              setHourlyRate(
                event.target.value
              )
            }
            placeholder="예: 30000"
            disabled={loading}
            style={fieldStyle}
          />
        </div>
      </section>

      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: "14px",
            border:
              "1px solid #d93025",
            borderRadius: "8px",
            color: "#b42318",
            background: "#fef3f2",
          }}
        >
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          style={{
            padding: "14px",
            border:
              "1px solid #abefc6",
            borderRadius: "8px",
            color: "#067647",
            background: "#ecfdf3",
            lineHeight: 1.65,
          }}
        >
          {successMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "15px",
          border: "none",
          borderRadius: "10px",
          background:
            loading
              ? "#98a2b3"
              : "#0a1f44",
          color: "#ffffff",
          fontSize: "16px",
          fontWeight: 800,
          cursor:
            loading
              ? "default"
              : "pointer",
        }}
      >
        {loading
          ? "강사 초대 중..."
          : "강사 초대 이메일 발송"}
      </button>
    </form>
  );
}