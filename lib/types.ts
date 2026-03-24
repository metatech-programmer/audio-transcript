// Core types for the application

export interface Session {
  id: string;
  title: string;
  date: string;
  duration: number;
  language: 'en' | 'es';
  // Optional subject/classification for grouping
  subject?: string;
  transcript: string;
  summary: Summary | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Summary {
  // Backwards-compatible quick fields
  executiveSummary: string;
  keyPoints: string[];
  lectureNotes: string;
  actionableInsights: string[];

  // High-complexity structured fields
  metadata?: {
    subject?: string;
    unit?: string;
    sessionNumber?: string;
    thematicAxis?: string;
    keywords?: string[];
  };
  learningOutcomes?: {
    competencies?: string[];
    mainProblem?: string;
  };
  theoreticalCore?: {
    concepts?: string;
    modelsStandards?: string;
    referencedAuthors?: string[];
  };
  comparativeAnalysis?: {
    prosCons?: string;
    comparisons?: string;
    contextOfUse?: string;
  };
  examples?: {
    academicExample?: string;
    caseStudy?: string;
    antipatterns?: string;
  };
  technicalComponent?: {
    codeSnippets?: string;
    tools?: string[];
    diagrams?: string;
  };
  debate?: {
    controversies?: string;
    participantContributions?: string;
  };
  interdisciplinary?: {
    relations?: string;
    workplaceApplications?: string;
  };
  keyTakeaways?: string[]; // 3 golden points
  references?: {
    readings?: string[];
    questionsForStudy?: string[];
  };
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
