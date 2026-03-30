/**
 * Utility functions for the lecture transcriber application
 */

export async function transcribeAudio(
  audioBlob: Blob,
  language: "en" | "es",
  options?: { softFail?: boolean }
): Promise<string> {
  // Whisper-compatible APIs can reject very small/incomplete chunks.
  // Return empty text for tiny chunks to keep real-time flow stable.
  if (audioBlob.size < 4096) {
    return "";
  }

  const formData = new FormData();
  const audioType = audioBlob.type || "audio/webm";
  const filename = audioType.includes("wav")
    ? "chunk.wav"
    : audioType.includes("mpeg") || audioType.includes("mp3")
    ? "chunk.mp3"
    : audioType.includes("ogg")
    ? "chunk.ogg"
    : "chunk.webm";

  formData.append("audio", new Blob([audioBlob], { type: audioType }), filename);
  formData.append("language", language);
  if (options?.softFail) {
    formData.append("mode", "realtime");
  }

  const response = await fetch("/api/transcribe", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let details = "";
    try {
      const payload = await response.json();
      details = payload?.details || payload?.error || "";
    } catch {
      details = response.statusText;
    }

    if (options?.softFail) {
      return "";
    }

    throw new Error(`Transcription failed (${response.status}): ${details}`);
  }

  const data = await response.json();
  return data.text || "";
}

export async function summarizeTranscript(transcript: string): Promise<any> {
  try {
    const response = await fetch("/api/summarize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transcript }),
    });

    if (!response.ok) {
      throw new Error(`Summarization failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.summary;
  } catch (error) {
    console.error("Summarization error:", error);
    throw error;
  }
}

export async function saveSession(session: any): Promise<any> {
  try {
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(session),
    });

    if (!response.ok) {
      throw new Error(`Save failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.session;
  } catch (error) {
    console.error("Save error:", error);
    throw error;
  }
}

export async function getSessions(): Promise<any[]> {
  try {
    const response = await fetch("/api/sessions", {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.sessions || [];
  } catch (error) {
    console.error("Fetch error:", error);
    return [];
  }
}

export async function updateSession(session: any): Promise<any> {
  try {
    const response = await fetch(`/api/sessions/${session.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(session),
    });

    if (!response.ok) {
      throw new Error(`Update failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.session;
  } catch (error) {
    console.error("Update error:", error);
    throw error;
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.statusText}`);
    }
  } catch (error) {
    console.error("Delete error:", error);
    throw error;
  }
}

export function generateId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  } as any);
}

export function exportAsText(session: any): string {
  return `${session.title}
Date: ${session.date}
Duration: ${session.duration}s
Language: ${session.language}

TRANSCRIPT
${"-".repeat(50)}
${session.transcript}

${session.summary ? `SUMMARY\n${"-".repeat(50)}\n${session.summary.executiveSummary}` : ""}
`;
}

export function exportAsMarkdown(session: any): string {
  let md = `# ${session.title}

**Date:** ${session.date}  
**Duration:** ${session.duration}s  
**Language:** ${session.language}

## Transcript

${session.transcript}
`;

  if (session.summary) {
    md += `\n## Summary

### Executive Summary
${session.summary.executiveSummary}

### Key Points
${session.summary.keyPoints.map((p: string) => `- ${p}`).join("\n")}

### Lecture Notes
${session.summary.lectureNotes}

### Actionable Insights
${session.summary.actionableInsights.map((i: string) => `- ${i}`).join("\n")}
`;
  }

  return md;
}

export function exportAsJson(session: any): string {
  return JSON.stringify(session, null, 2);
}

export function downloadFile(content: string, filename: string): void {
  const element = document.createElement("a");
  element.setAttribute("href", `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`);
  element.setAttribute("download", filename);
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

/**
 * Chunk a transcript for summarization if it exceeds token limit
 */
export function chunkTranscript(transcript: string, chunkSize: number = 2000): string[] {
  const words = transcript.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];

  for (const word of words) {
    currentChunk.push(word);
    if (currentChunk.join(" ").length >= chunkSize) {
      chunks.push(currentChunk.join(" "));
      currentChunk = [];
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(" "));
  }

  return chunks;
}
