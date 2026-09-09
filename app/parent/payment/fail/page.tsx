import Link from "next/link";

type PageProps = {
  searchParams: Promise<{
    code?: string;
    message?: string;
    orderId?: string;
  }>;
};

function getFriendlyMessage(
  code: string | undefined,
  originalMessage: string | undefined
) {
  switch (code) {
    case "PAY_PROCESS_CANCELED":
      return "결제가 취소되었습니다. 원하시면 수강신청 상세에서 다시 결제할 수 있습니다.";

    case "PAY_PROCESS_ABORTED":
      return "결제 진행 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

    case "REJECT_CARD_COMPANY":
      return "카드사에서 결제를 승인하지 않았습니다. 카드 정보를 확인하거나 다른 결제수단을 이용해 주세요.";

    default:
      return (
        originalMessage ||
        "결제가 완료되지 않았습니다. 수강신청 상세에서 다시 시도해 주세요."
      );
  }
}

export default async function PaymentFailPage({
  searchParams,
}: PageProps) {
  const {
    code,
    message,
    orderId,
  } =
    await searchParams;

  const friendlyMessage =
    getFriendlyMessage(
      code,
      message
    );

  return (
    <main
      style={{
        minHeight:
          "100vh",
        padding:
          "56px 20px 90px",
        background:
          "linear-gradient(180deg, #fff7f5 0%, #ffffff 58%)",
      }}
    >
      <section
        style={{
          width:
            "100%",
          maxWidth:
            "620px",
          margin:
            "0 auto",
          padding:
            "32px",
          borderRadius:
            "24px",
          border:
            "1px solid #e4e7ec",
          background:
            "#ffffff",
          boxShadow:
            "0 20px 55px rgba(10,31,68,0.10)",
          textAlign:
            "center",
        }}
      >
        <div
          style={{
            color:
              "#3978ef",
            fontSize:
              "12px",
            fontWeight:
              900,
            letterSpacing:
              "0.1em",
          }}
        >
          TALKLY PAYMENT
        </div>

        <div
          style={{
            width:
              "64px",
            height:
              "64px",
            margin:
              "26px auto 0",
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            borderRadius:
              "999px",
            background:
              "#fef3f2",
            color:
              "#b42318",
            fontSize:
              "28px",
            fontWeight:
              900,
          }}
        >
          !
        </div>

        <h1
          style={{
            margin:
              "22px 0 0",
            color:
              "#0A1F44",
            fontSize:
              "30px",
          }}
        >
          결제가 완료되지
          않았습니다
        </h1>

        <p
          style={{
            margin:
              "14px auto 0",
            maxWidth:
              "470px",
            color:
              "#667085",
            fontSize:
              "14px",
            lineHeight:
              1.8,
          }}
        >
          {friendlyMessage}
        </p>

        {(code ||
          orderId) && (
          <div
            style={{
              marginTop:
                "26px",
              padding:
                "20px",
              borderRadius:
                "16px",
              background:
                "#f8fafc",
              border:
                "1px solid #eaecf0",
              textAlign:
                "left",
            }}
          >
            {code && (
              <ResultRow
                label="오류코드"
                value={code}
              />
            )}

            {orderId && (
              <ResultRow
                label="주문번호"
                value={orderId}
              />
            )}
          </div>
        )}

        <div
          style={{
            marginTop:
              "28px",
            display:
              "grid",
            gap:
              "10px",
          }}
        >
          <Link
            href="/parent"
            style={{
              minHeight:
                "50px",
              display:
                "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              padding:
                "0 18px",
              borderRadius:
                "12px",
              background:
                "#0A1F44",
              color:
                "#ffffff",
              textDecoration:
                "none",
              fontWeight:
                900,
            }}
          >
            학부모 대시보드로
            이동
          </Link>

          <div
            style={{
              color:
                "#667085",
              fontSize:
                "11px",
              lineHeight:
                1.7,
            }}
          >
            결제 취소 또는
            인증 실패 상태에서는
            실제 수강료가
            결제되지 않습니다.
          </div>
        </div>
      </section>
    </main>
  );
}

function ResultRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display:
          "flex",
        justifyContent:
          "space-between",
        alignItems:
          "center",
        gap:
          "18px",
        padding:
          "8px 0",
      }}
    >
      <span
        style={{
          color:
            "#667085",
          fontSize:
            "12px",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          color:
            "#101828",
          fontSize:
            "12px",
          textAlign:
            "right",
          wordBreak:
            "break-all",
        }}
      >
        {value}
      </strong>
    </div>
  );
}