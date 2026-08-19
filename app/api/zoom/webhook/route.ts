import crypto from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ZoomWebhookPayload = {
  event?: string;
  event_ts?: number;
  payload?: {
    plainToken?: string;
    account_id?: string;
    object?: {
      id?: string | number;
      uuid?: string;
      topic?: string;
      host_id?: string;
      start_time?: string;
      duration?: number;
      recording_count?: number;
      recording_files?: unknown[];
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
};

function getWebhookSecret() {
  const secret =
    process.env.ZOOM_WEBHOOK_SECRET_TOKEN;

  if (!secret) {
    throw new Error(
      "ZOOM_WEBHOOK_SECRET_TOKEN 환경변수가 설정되지 않았습니다."
    );
  }

  return secret;
}

function createZoomSignature(
  timestamp: string,
  rawBody: string,
  secret: string
) {
  const message =
    `v0:${timestamp}:${rawBody}`;

  const hash =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(message)
      .digest("hex");

  return `v0=${hash}`;
}

function safeEqual(
  a: string,
  b: string
) {
  const aBuffer =
    Buffer.from(a);

  const bBuffer =
    Buffer.from(b);

  if (
    aBuffer.length !==
    bBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    aBuffer,
    bBuffer
  );
}

function isTimestampFresh(
  timestamp: string
) {
  const seconds =
    Number(timestamp);

  if (
    !Number.isFinite(
      seconds
    )
  ) {
    return false;
  }

  const now =
    Math.floor(
      Date.now() / 1000
    );

  /*
   * Replay 공격 완화를 위해
   * Zoom 요청 timestamp가 현재 시각에서
   * 5분 이상 벗어난 경우 거부합니다.
   */
  return (
    Math.abs(
      now - seconds
    ) <= 300
  );
}

export async function POST(
  request: Request
) {
  try {
    /*
     * ==========================================
     * 중요:
     * Zoom 서명 검증은 JSON.parse 이후의 객체가 아니라
     * "원본 request body 문자열"을 사용해야 합니다.
     * ==========================================
     */
    const rawBody =
      await request.text();

    let body:
      ZoomWebhookPayload;

    try {
      body =
        JSON.parse(
          rawBody
        ) as ZoomWebhookPayload;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Zoom Webhook JSON 형식이 올바르지 않습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const secret =
      getWebhookSecret();

    /*
     * ==========================================
     * Zoom Endpoint URL Validation
     *
     * Zoom이 endpoint.url_validation 이벤트를 보내면
     * plainToken을 Secret Token으로 HMAC-SHA256 처리하여
     * plainToken + encryptedToken을 3초 이내 반환합니다.
     * ==========================================
     */
    if (
      body.event ===
      "endpoint.url_validation"
    ) {
      const plainToken =
        body.payload
          ?.plainToken;

      if (
        !plainToken ||
        typeof plainToken !==
          "string"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Zoom URL Validation plainToken이 없습니다.",
          },
          {
            status: 400,
          }
        );
      }

      const encryptedToken =
        crypto
          .createHmac(
            "sha256",
            secret
          )
          .update(
            plainToken
          )
          .digest(
            "hex"
          );

      return NextResponse.json(
        {
          plainToken,
          encryptedToken,
        },
        {
          status: 200,
        }
      );
    }

    /*
     * ==========================================
     * 일반 Zoom Webhook 서명 검증
     * ==========================================
     */
    const timestamp =
      request.headers.get(
        "x-zm-request-timestamp"
      );

    const receivedSignature =
      request.headers.get(
        "x-zm-signature"
      );

    if (
      !timestamp ||
      !receivedSignature
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Zoom Webhook 서명 헤더가 없습니다.",
        },
        {
          status: 401,
        }
      );
    }

    if (
      !isTimestampFresh(
        timestamp
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Zoom Webhook timestamp가 허용 범위를 벗어났습니다.",
        },
        {
          status: 401,
        }
      );
    }

    const expectedSignature =
      createZoomSignature(
        timestamp,
        rawBody,
        secret
      );

    if (
      !safeEqual(
        expectedSignature,
        receivedSignature
      )
    ) {
      console.error(
        "[Zoom Webhook] signature verification failed"
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Zoom Webhook 서명 검증에 실패했습니다.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * ==========================================
     * recording.completed
     *
     * 현재 단계에서는:
     * 1. Zoom Webhook 정상 수신
     * 2. 서명 검증
     * 3. meeting 식별정보 추출
     * 까지만 처리합니다.
     *
     * 다음 단계에서 이 정보를
     * class_sessions와 연결하고,
     * recording file을 Storage로 가져오는
     * 비동기 처리 구조를 붙입니다.
     *
     * Webhook 요청 안에서 OpenAI 분석을 직접 실행하지 않습니다.
     * Zoom에는 빠르게 200을 반환해야 하기 때문입니다.
     * ==========================================
     */
    if (
      body.event ===
      "recording.completed"
    ) {
      const object =
        body.payload
          ?.object;

      console.log(
        "[Zoom Webhook] recording.completed",
        {
          accountId:
            body.payload
              ?.account_id ??
            null,

          meetingId:
            object?.id ??
            null,

          meetingUuid:
            object?.uuid ??
            null,

          topic:
            object?.topic ??
            null,

          hostId:
            object?.host_id ??
            null,

          startTime:
            object?.start_time ??
            null,

          duration:
            object?.duration ??
            null,

          recordingCount:
            object
              ?.recording_count ??
            null,

          receivedAt:
            new Date()
              .toISOString(),
        }
      );

      return NextResponse.json(
        {
          success: true,
          received: true,
          event:
            "recording.completed",
        },
        {
          status: 200,
        }
      );
    }

    /*
     * ==========================================
     * 구독했지만 아직 TALKLY에서 처리하지 않는 이벤트
     * Zoom 재전송을 막기 위해 정상 수신으로 응답합니다.
     * ==========================================
     */
    console.log(
      "[Zoom Webhook] ignored event:",
      body.event ??
        "unknown"
    );

    return NextResponse.json(
      {
        success: true,
        received: true,
        ignored: true,
        event:
          body.event ??
          null,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "[Zoom Webhook] error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Zoom Webhook 처리 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}