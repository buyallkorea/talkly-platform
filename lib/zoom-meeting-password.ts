async function getZoomAccessToken() {
  const accountId =
    process.env.ZOOM_ACCOUNT_ID;

  const clientId =
    process.env.ZOOM_CLIENT_ID;

  const clientSecret =
    process.env.ZOOM_CLIENT_SECRET;

  if (
    !accountId ||
    !clientId ||
    !clientSecret
  ) {
    throw new Error(
      "Zoom Server-to-Server 환경변수가 없습니다."
    );
  }

  const credentials =
    Buffer.from(
      `${clientId}:${clientSecret}`
    ).toString("base64");

  const response =
    await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(
        accountId
      )}`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Basic ${credentials}`,

          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        cache: "no-store",
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.access_token
  ) {
    throw new Error(
      "Zoom Access Token 발급에 실패했습니다."
    );
  }

  return data.access_token as string;
}

export async function getZoomMeetingPassword(
  meetingId: string
) {
  const accessToken =
    await getZoomAccessToken();

  const response =
    await fetch(
      `https://api.zoom.us/v2/meetings/${encodeURIComponent(
        meetingId
      )}`,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },

        cache: "no-store",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      `Zoom 회의정보 조회 실패: ${
        typeof data?.message === "string"
          ? data.message
          : response.status
      }`
    );
  }

  return typeof data.password ===
    "string"
    ? data.password
    : "";
}

