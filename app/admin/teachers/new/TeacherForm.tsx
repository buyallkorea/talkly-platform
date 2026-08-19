"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] =
    useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] =
    useState("");

  const [nationality, setNationality] =
    useState("");

  const [customNationality, setCustomNationality] =
    useState("");

  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] =
    useState("");

  const [yearsExperience, setYearsExperience] =
    useState("");

  const [education, setEducation] = useState("");
  const [certifications, setCertifications] =
    useState("");

  const [hourlyRate, setHourlyRate] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");

    if (!email.trim()) {
      setErrorMessage("이메일을 입력해주세요.");
      return;
    }

    if (!name.trim()) {
      setErrorMessage("강사 이름을 입력해주세요.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage(
        "비밀번호는 8자 이상이어야 합니다."
      );
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage(
        "비밀번호와 비밀번호 확인이 일치하지 않습니다."
      );
      return;
    }

    if (!nationality) {
      setErrorMessage("강사 국적을 선택해주세요.");
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
      const specialtyArray = specialties
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const finalNationality =
        nationality === "기타"
          ? customNationality.trim()
          : nationality;

      const response = await fetch(
        "/api/admin/teachers",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            password,
            name: name.trim(),
            phone: phone.trim(),
            displayName: displayName.trim(),

            nationality: finalNationality,

            bio: bio.trim(),
            specialties: specialtyArray,
            yearsExperience,
            education: education.trim(),
            certifications:
              certifications.trim(),
            hourlyRate,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(
          result.error ||
            "강사 등록에 실패했습니다."
        );
        setLoading(false);
        return;
      }

      router.push("/admin/teachers");
      router.refresh();
    } catch (error) {
      console.error(
        "TEACHER CREATE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? `강사 등록 오류: ${error.message}`
          : "강사 등록 중 오류가 발생했습니다."
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
      {/* 로그인 정보 */}
      <section style={sectionStyle}>
        <div>
          <h2 style={{ margin: 0 }}>
            로그인 정보
          </h2>

          <p
            style={{
              marginBottom: 0,
              opacity: 0.7,
            }}
          >
            강사가 TALKLY에 로그인할 때 사용하는
            계정입니다.
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
              setEmail(event.target.value)
            }
            placeholder="teacher@example.com"
            required
            style={fieldStyle}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            style={labelStyle}
          >
            초기 비밀번호 *
          </label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            minLength={8}
            required
            autoComplete="new-password"
            style={fieldStyle}
          />
        </div>

        <div>
          <label
            htmlFor="passwordConfirm"
            style={labelStyle}
          >
            비밀번호 확인 *
          </label>

          <input
            id="passwordConfirm"
            type="password"
            value={passwordConfirm}
            onChange={(event) =>
              setPasswordConfirm(
                event.target.value
              )
            }
            minLength={8}
            required
            autoComplete="new-password"
            style={fieldStyle}
          />
        </div>
      </section>

      {/* 기본 정보 */}
      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>
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
              setName(event.target.value)
            }
            placeholder="예: Daniel Smith"
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
              setDisplayName(
                event.target.value
              )
            }
            placeholder="예: Daniel Teacher"
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
              type="text"
              value={customNationality}
              onChange={(event) =>
                setCustomNationality(
                  event.target.value
                )
              }
              placeholder="예: 필리핀"
              required
              style={fieldStyle}
            />

            <small>
              실제 국적명을 직접 입력해주세요.
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
              setPhone(event.target.value)
            }
            placeholder="010-0000-0000"
            style={fieldStyle}
          />
        </div>
      </section>

      {/* 강사 프로필 */}
      <section style={sectionStyle}>
        <h2 style={{ margin: 0 }}>
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
              setBio(event.target.value)
            }
            rows={5}
            placeholder="강사의 수업 경력과 특징 등을 입력해주세요."
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
            style={fieldStyle}
          />

          <small>
            여러 분야는 쉼표(,)로 구분해주세요.
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
            placeholder="예: University of California, English Education"
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
            style={fieldStyle}
          />
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
          ? "강사 등록 중..."
          : "강사 등록"}
      </button>
    </form>
  );
}