// Public API client for easy integration

export const API = {
  async transcribe(audioBlob: Blob, language: "en" | "es" = "en") {
    const formData = new FormData();
    formData.append("audio", audioBlob);
    formData.append("language", language);

    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.statusText}`);
    }

    return response.json();
  },

  async summarize(transcript: string) {
    const response = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });

    if (!response.ok) {
      throw new Error(`Summarization failed: ${response.statusText}`);
    }

    return response.json();
  },

  async getSessions() {
    const response = await fetch("/api/sessions");
    if (!response.ok) {
      throw new Error("Failed to fetch sessions");
    }
    return response.json();
  },

  async getSession(id: string) {
    const response = await fetch(`/api/sessions/${id}`);
    if (!response.ok) {
      throw new Error("Failed to fetch session");
    }
    return response.json();
  },

  async createSession(session: any) {
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session),
    });

    if (!response.ok) {
      throw new Error("Failed to create session");
    }

    return response.json();
  },

  async updateSession(id: string, updates: any) {
    const response = await fetch(`/api/sessions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error("Failed to update session");
    }

    return response.json();
  },

  async deleteSession(id: string) {
    const response = await fetch(`/api/sessions/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Failed to delete session");
    }

    return response.json();
  },
};
