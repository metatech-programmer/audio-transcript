import { NextRequest, NextResponse } from "next/server";

function normalizeFilenameByMimeType(mimeType: string): string {
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) {
    return "audio.mp3";
  }
  if (mimeType.includes("wav")) {
    return "audio.wav";
  }
  if (mimeType.includes("ogg")) {
    return "audio.ogg";
  }
  if (mimeType.includes("m4a") || mimeType.includes("mp4")) {
    return "audio.m4a";
  }
  return "audio.webm";
}

function isAcceptedAudioMimeType(mimeType: string): boolean {
  if (!mimeType) {
    return true;
  }

  return mimeType.startsWith("audio/") || mimeType === "video/webm";
}

/**
 * POST /api/transcribe
 * Transcribe audio using external Whisper-compatible API
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio") as Blob | File | null;
    const language = (formData.get("language") as string) || "es";
    const mode = (formData.get("mode") as string) || "default";

    if (!audio) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const incomingMimeType = audio.type || "audio/webm";
    if (!isAcceptedAudioMimeType(incomingMimeType)) {
      return NextResponse.json(
        { error: `Unsupported media type: ${incomingMimeType}` },
        { status: 400 }
      );
    }

    // Convert blob to Buffer
    const buffer = Buffer.from(await audio.arrayBuffer());

    // Very short/incomplete chunks can be rejected by Whisper providers.
    // Return empty text so real-time UI remains stable.
    if (mode === "realtime" && buffer.byteLength < 12000) {
      return NextResponse.json({
        text: "",
        language,
        duration: audio.size,
      });
    }

    // Use Groq Whisper API (recommended for speed)
    const groqApiKey = process.env.GROQ_API_KEY || process.env.TRANSCRIPTION_API_KEY;

    if (!groqApiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const formDataGroq = new FormData();
    formDataGroq.append(
      "file",
      new Blob([buffer], { type: incomingMimeType }),
      normalizeFilenameByMimeType(incomingMimeType)
    );
    formDataGroq.append("model", "whisper-large-v3");
    formDataGroq.append("language", language === "es" ? "es" : "en");

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: formDataGroq,
    });

    if (!response.ok) {
      const error = await response.text();

      // In realtime mode we degrade gracefully to keep UI responsive
      // and avoid noisy 4xx errors in browser network panel.
      if (mode === "realtime") {
        return NextResponse.json({
          text: "",
          language,
          duration: audio.size,
        });
      }

      console.error("Groq API error:", error);

      return NextResponse.json(
        { error: "Transcription failed", details: error },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      text: result.text || "",
      language,
      duration: audio.size,
    });
  } catch (error) {
    console.error("Transcription error:", error);
    const message = error instanceof Error ? error.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
