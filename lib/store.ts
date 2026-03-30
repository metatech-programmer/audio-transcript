import { create } from "zustand";
import type { Session, RecorderState } from "./types";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastMessage {
  id: string;
  type: ToastType;
  text: string;
}

interface AppStore {
  // Recorder state
  recorder: RecorderState;
  setRecording: (isRecording: boolean) => void;
  setPaused: (isPaused: boolean) => void;
  setDuration: (duration: number) => void;
  setTranscript: (transcript: string) => void;
  setLanguage: (language: "en" | "es") => void;
  setSummarizing: (isSummarizing: boolean) => void;
  setRecorderError: (error: string | null) => void;
  resetRecorder: () => void;

  // Sessions
  sessions: Session[];
  currentSession: Session | null;
  setSessions: (sessions: Session[]) => void;
  setCurrentSession: (session: Session | null) => void;
  addSession: (session: Session) => void;
  updateSession: (session: Session) => void;

  // UI
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  toasts: ToastMessage[];
  addToast: (type: ToastType, text: string) => string;
  removeToast: (id: string) => void;
}

const initialRecorderState: RecorderState = {
  isRecording: false,
  isPaused: false,
  duration: 0,
  transcript: "",
  language: "es",
  isSummarizing: false,
  error: null,
};

/**
 * Global application store using Zustand
 * Manages recorder state, sessions, and UI state
 * Data is kept in memory (can be enhanced with localStorage persistence)
 */
export const useAppStore = create<AppStore>((set) => ({
  // Recorder
  recorder: initialRecorderState,
  setRecording: (isRecording) =>
    set((state) => ({
      recorder: { ...state.recorder, isRecording },
    })),
  setPaused: (isPaused) =>
    set((state) => ({
      recorder: { ...state.recorder, isPaused },
    })),
  setDuration: (duration) =>
    set((state) => ({
      recorder: { ...state.recorder, duration },
    })),
  setTranscript: (transcript) =>
    set((state) => ({
      recorder: { ...state.recorder, transcript },
    })),
  setLanguage: (language) =>
    set((state) => ({
      recorder: { ...state.recorder, language },
    })),
  setSummarizing: (isSummarizing) =>
    set((state) => ({
      recorder: { ...state.recorder, isSummarizing },
    })),
  setRecorderError: (error) =>
    set((state) => ({
      recorder: { ...state.recorder, error },
    })),
  resetRecorder: () =>
    set((state) => ({
      recorder: {
        ...initialRecorderState,
        language: state.recorder.language, // KEEP language selection
      },
    })),

  // Sessions
  sessions: [],
  currentSession: null,
  setSessions: (sessions) => set({ sessions }),
  setCurrentSession: (currentSession) => set({ currentSession }),
  addSession: (session) =>
    set((state) => ({
      sessions: [session, ...state.sessions],
    })),
  updateSession: (session) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === session.id ? session : s)),
    })),

  // UI
  selectedTags: [],
  setSelectedTags: (selectedTags) => set({ selectedTags }),
  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  toasts: [],
  addToast: (type, text) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    set((state) => ({
      toasts: [...state.toasts, { id, type, text }],
    }));
    return id;
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}));
