// Core types for the application

export interface Session {
  id: string;
  title: string;
  date: string;
  duration: number;
  language: 'en' | 'es';
  transcript: string;
  summary: Summary | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Summary {
  executiveSummary: string;
  keyPoints: string[];
  lectureNotes: string;
  actionableInsights: string[];
}

export interface TranscriptionChunk {
  timestamp: number;
  text: string;
  language: 'en' | 'es';
}

export interface RecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  transcript: string;
  language: 'en' | 'es';
  isSummarizing: boolean;
  error: string | null;
}

export interface ExportOptions {
  format: 'txt' | 'md' | 'json' | 'notion';
  includeTranscript: boolean;
  includeSummary: boolean;
}
