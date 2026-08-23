type Props = {
  status: string;
  requestedAt: string;
  reviewedAt: string | null;
  reason: string | null;
  adminNote: string | null;
  automaticApproval: boolean;
};

function formatDateTime(
  value: string | null
) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(
    new Date(value)
  );
}

function getStatusLabel(
  status: string,
  automaticApproval: boolean
) {
  switch (status) {
    case "approved":
      return automaticApproval
        ? "자동 승인"
        : "이전 수동 승인";

    case "requested":
      return "이전 승인 대기";

    case "rejected":
      return "이전 반려";

    case "cancelled":
      return "연기 취소";

    default:
      return status;
  }
}

function getStatusStyle(
  status: string,
  automaticApproval: boolean
) {
  if (
    status === "approved" &&
    automaticApproval
  ) {
    return {
      background: "#ecfdf3",
      border: "#abefc6",
      color: "#067647",
    };
  }

  if (status === "approved") {
    return {
      background: "#eff8ff",
      border: "#b2ddff",
      color: "#175cd3",
    };
  }

  if (status === "requested") {
    return {
      background: "#fffaeb",
      border: "#fedf89",
      color: "#b54708",
    };
  }

  if (status === "rejected") {
    return {
      background: "#fef3f2",
      border: "#fecdca",
      color: "#b42318",
    };
  }

  return {
    background: "#f2f4f7",
    border: "#e4e7ec",
    color: "#475467",
  };
}

export default function ClassHoldReviewForm({
  status,
  requestedAt,
  reviewedAt,
  reason,
  adminNote,
  automaticApproval,
}: Props) {
  const badge =
    getStatusStyle(
      status,
      automaticApproval
    );

  return (
    <section
      style={{
        padding: "24px",
        border:
          "1px solid #e4e7ec",
        borderRadius: "16px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color: "#2f6fed",
              fontSize: "12px",
              fontWeight: 900,
              letterSpacing:
                "0.08em",
            }}
          >
            PROCESSING RESULT
          </div>

          <h2
            style={{
              margin: "7px 0 0",
              color: "#101828",
              fontSize: "22px",
            }}
          >
            수업 연기 처리 결과
          </h2>
        </div>

        <span
          style={{
            display:
              "inline-flex",
            minHeight: "32px",
            padding: "0 12px",
            alignItems: "center",
            border:
              `1px solid ${badge.border}`,
            borderRadius: "999px",
            background:
              badge.background,
            color: badge.color,
            fontSize: "12px",
            fontWeight: 900,
          }}
        >
          {getStatusLabel(
            status,
            automaticApproval
          )}
        </span>
      </div>

      <div
        style={{
          marginTop: "22px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "12px",
        }}
      >
        <InfoBox
          label="신청일시"
          value={formatDateTime(
            requestedAt
          )}
        />

        <InfoBox
          label="처리일시"
          value={formatDateTime(
            reviewedAt
          )}
        />

        <InfoBox
          label="처리 방식"
          value={
            automaticApproval
              ? "시스템 자동승인"
              : status ===
                  "approved"
                ? "이전 수동 승인"
                : status ===
                    "requested"
                  ? "이전 수동처리 방식"
                  : "기존 처리 내역"
          }
        />
      </div>

      <div
        style={{
          marginTop: "18px",
          padding: "18px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "12px",
          background: "#f9fafb",
        }}
      >
        <div
          style={{
            color: "#667085",
            fontSize: "12px",
            fontWeight: 800,
          }}
        >
          신청 사유
        </div>

        <div
          style={{
            marginTop: "8px",
            color: "#344054",
            fontSize: "14px",
            lineHeight: 1.75,
            whiteSpace: "pre-wrap",
          }}
        >
          {reason ||
            "신청 사유가 입력되지 않았습니다."}
        </div>
      </div>

      {adminNote && (
        <div
          style={{
            marginTop: "12px",
            padding: "18px",
            border:
              automaticApproval
                ? "1px solid #b2ddff"
                : "1px solid #e4e7ec",
            borderRadius: "12px",
            background:
              automaticApproval
                ? "#f5f8ff"
                : "#f9fafb",
          }}
        >
          <div
            style={{
              color:
                automaticApproval
                  ? "#175cd3"
                  : "#667085",
              fontSize: "12px",
              fontWeight: 900,
            }}
          >
            처리 안내
          </div>

          <div
            style={{
              marginTop: "8px",
              color: "#475467",
              fontSize: "13px",
              lineHeight: 1.75,
              whiteSpace: "pre-wrap",
            }}
          >
            {adminNote}
          </div>
        </div>
      )}

      {automaticApproval && (
        <div
          style={{
            marginTop: "18px",
            padding: "18px",
            border:
              "1px solid #dbe7ff",
            borderRadius: "12px",
            background: "#f7faff",
          }}
        >
          <div
            style={{
              color: "#2f6fed",
              fontSize: "13px",
              fontWeight: 900,
            }}
          >
            자동승인 기준
          </div>

          <div
            style={{
              marginTop: "9px",
              color: "#475467",
              fontSize: "13px",
              lineHeight: 1.75,
            }}
          >
            이 수업 연기는 시스템이
            신청 시점에 규정을
            확인하여 자동
            승인했습니다.
            <br />
            • 월 최대 2회
            <br />
            • 수업 시작 2시간
            전까지 신청
          </div>
        </div>
      )}

      {status === "requested" && (
        <div
          style={{
            marginTop: "18px",
            padding: "18px",
            border:
              "1px solid #fedf89",
            borderRadius: "12px",
            background: "#fffaeb",
            color: "#b54708",
            fontSize: "13px",
            lineHeight: 1.7,
          }}
        >
          이 신청은 자동승인
          시스템 도입 전에 생성된
          과거 승인 대기
          데이터입니다. 현재
          시스템에서는 관리자가
          수업 연기를 승인하거나
          반려하지 않습니다.
        </div>
      )}

      <div
        style={{
          marginTop: "18px",
          padding: "15px 17px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "11px",
          background: "#ffffff",
          color: "#667085",
          fontSize: "12px",
          lineHeight: 1.7,
        }}
      >
        현재 TALKLY의 수업 연기는
        규정 충족 여부를 시스템이
        자동으로 판단합니다. 이
        화면에서는 처리 결과만
        확인할 수 있으며 관리자가
        승인 또는 반려할 수
        없습니다.
      </div>
    </section>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "16px",
        border:
          "1px solid #e4e7ec",
        borderRadius: "11px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          color: "#667085",
          fontSize: "11px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "7px",
          color: "#101828",
          fontSize: "14px",
          fontWeight: 800,
          lineHeight: 1.5,
        }}
      >
        {value}
      </div>
    </div>
  );
}