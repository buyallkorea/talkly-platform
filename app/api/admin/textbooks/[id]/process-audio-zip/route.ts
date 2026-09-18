import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type AudioTrack = {
  trackNumber: number;
  label: string;
  sourceFilename: string;
  storagePath: string;
  size: number;
};

function parseTrackNumber(filename: string) {
  const baseName = filename
    .split("/")
    .pop()
    ?.trim();

  if (!baseName) {
    return null;
  }

  const match = baseName.match(
    /(?:^|[_\-\s])TR\s*0*(\d+)(?=[_\-\s.]|$)/i
  );

  if (!match) {
    return null;
  }

  const trackNumber = Number(match[1]);

  if (
    !Number.isInteger(trackNumber) ||
    trackNumber <= 0
  ) {
    return null;
  }

  return trackNumber;
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const textbookId = Number(id);

    if (
      !Number.isInteger(textbookId) ||
      textbookId <= 0
    ) {
      return NextResponse.json(
        { error: "교재 ID가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.role !== "admin"
    ) {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      sourcePath?: unknown;
    };

    const sourcePath =
      typeof body.sourcePath === "string"
        ? body.sourcePath.trim()
        : "";

    if (!sourcePath) {
      return NextResponse.json(
        { error: "오디오 ZIP Storage 경로가 필요합니다." },
        { status: 400 }
      );
    }

    const expectedPrefix =
      `textbooks/${textbookId}/audio-source/`;

    if (!sourcePath.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: "오디오 ZIP 경로가 교재 ID와 일치하지 않습니다." },
        { status: 400 }
      );
    }

    if (!sourcePath.toLowerCase().endsWith(".zip")) {
      return NextResponse.json(
        { error: "ZIP 파일만 처리할 수 있습니다." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: textbook, error: textbookError } =
      await admin
        .from("textbooks")
        .select("id, title")
        .eq("id", textbookId)
        .maybeSingle();

    if (textbookError) {
      return NextResponse.json(
        {
          error: `교재 조회 실패: ${textbookError.message}`,
        },
        { status: 500 }
      );
    }

    if (!textbook) {
      return NextResponse.json(
        { error: "교재를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const { data: zipBlob, error: downloadError } =
      await admin.storage
        .from("textbook-files")
        .download(sourcePath);

    if (downloadError || !zipBlob) {
      return NextResponse.json(
        {
          error: `오디오 ZIP 다운로드 실패: ${
            downloadError?.message ||
            "파일을 불러올 수 없습니다."
          }`,
        },
        { status: 500 }
      );
    }

    const zipArrayBuffer =
      await zipBlob.arrayBuffer();

    const zip = new AdmZip(
      Buffer.from(zipArrayBuffer)
    );

    const mp3Entries = zip
      .getEntries()
      .filter(
        (entry) =>
          !entry.isDirectory &&
          entry.entryName
            .toLowerCase()
            .endsWith(".mp3")
      );

    if (mp3Entries.length === 0) {
      return NextResponse.json(
        {
          error: "ZIP 안에서 MP3 파일을 찾을 수 없습니다.",
        },
        { status: 400 }
      );
    }

    const parsedEntries = mp3Entries.map(
      (entry) => ({
        entry,
        trackNumber: parseTrackNumber(
          entry.entryName
        ),
      })
    );

    const unrecognizedFiles = parsedEntries
      .filter(
        (item) => item.trackNumber === null
      )
      .map((item) => item.entry.entryName);

    const recognizedEntries = parsedEntries
      .filter(
        (item) => item.trackNumber !== null
      )
      .map((item) => ({
        entry: item.entry,
        trackNumber: item.trackNumber as number,
      }));

    if (recognizedEntries.length === 0) {
      return NextResponse.json(
        {
          error:
            "MP3 파일은 있지만 TR 번호가 포함된 파일명을 찾지 못했습니다.",
          unrecognizedFiles,
        },
        { status: 400 }
      );
    }

    const trackMap = new Map<
      number,
      typeof recognizedEntries
    >();

    for (const item of recognizedEntries) {
      const current =
        trackMap.get(item.trackNumber) || [];

      current.push(item);
      trackMap.set(item.trackNumber, current);
    }

    const duplicateTracks = Array.from(
      trackMap.entries()
    )
      .filter(([, items]) => items.length > 1)
      .map(([trackNumber, items]) => ({
        trackNumber,
        files: items.map(
          (item) => item.entry.entryName
        ),
      }));

    if (duplicateTracks.length > 0) {
      return NextResponse.json(
        {
          error:
            "같은 TR 번호를 가진 MP3 파일이 중복되어 있습니다.",
          duplicateTracks,
        },
        { status: 400 }
      );
    }

    const orderedEntries = recognizedEntries.sort(
      (a, b) =>
        a.trackNumber - b.trackNumber
    );

    const uploadedTracks: AudioTrack[] = [];

    for (const item of orderedEntries) {
      const audioBuffer =
        item.entry.getData();

      if (audioBuffer.length === 0) {
        return NextResponse.json(
          {
            error: `빈 MP3 파일입니다: ${item.entry.entryName}`,
          },
          { status: 400 }
        );
      }

      const paddedTrack = String(
        item.trackNumber
      ).padStart(2, "0");

      const storagePath =
        `textbooks/${textbookId}/tracks/TR${paddedTrack}.mp3`;

      const { error: uploadError } =
        await admin.storage
          .from("textbook-audio")
          .upload(
            storagePath,
            audioBuffer,
            {
              contentType: "audio/mpeg",
              cacheControl: "3600",
              upsert: true,
            }
          );

      if (uploadError) {
        return NextResponse.json(
          {
            error: `TR${paddedTrack} 업로드 실패: ${uploadError.message}`,
            uploadedTracks,
          },
          { status: 500 }
        );
      }

      uploadedTracks.push({
        trackNumber: item.trackNumber,
        label: `TR${paddedTrack}`,
        sourceFilename:
          item.entry.entryName,
        storagePath,
        size: audioBuffer.length,
      });
    }

    return NextResponse.json({
      success: true,
      textbook: {
        id: textbook.id,
        title: textbook.title,
      },
      sourcePath,
      mp3Count: mp3Entries.length,
      recognizedCount:
        recognizedEntries.length,
      uploadedCount: uploadedTracks.length,
      unrecognizedCount:
        unrecognizedFiles.length,
      unrecognizedFiles,
      tracks: uploadedTracks,
      trackNumbers: uploadedTracks.map(
        (track) => track.trackNumber
      ),
    });
  } catch (error) {
    console.error(
      "TEXTBOOK AUDIO ZIP PROCESS ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "교재 오디오 ZIP 처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}