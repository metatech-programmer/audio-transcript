import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import type { Session, Summary } from '@/lib/types';

/**
 * Hook for transcribing audio
 */
export function useTranscription() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setTranscript } = useAppStore();

  const transcribe = async (
    audioBlob: Blob,
    language: 'en' | 'es'
  ): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('language', language);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
      }

      const data = await response.json();
      setTranscript(data.text);
      return data.text;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transcription failed';
      setError(message);
      console.error('Transcription error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { transcribe, loading, error };
}

/**
 * Hook for summarizing transcripts
 */
export function useSummarization() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setSummarizing } = useAppStore();

  const summarize = async (transcript: string): Promise<Summary> => {
    setLoading(true);
    setSummarizing(true);
    setError(null);

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });

      if (!response.ok) {
        throw new Error(`Summarization failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.summary;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Summarization failed';
      setError(message);
      console.error('Summarization error:', err);
      throw err;
    } finally {
      setLoading(false);
      setSummarizing(false);
    }
  };

  return { summarize, loading, error };
}

/**
 * Hook for exporting sessions
 */
export function useExport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportToFile = (
    session: Session,
    format: 'txt' | 'md' | 'json'
  ): void => {
    try {
      let content = '';
      let filename = '';

      switch (format) {
        case 'txt':
          content = exportAsText(session);
          filename = `${session.title.replace(/\s+/g, '_')}.txt`;
          break;
        case 'md':
          content = exportAsMarkdown(session);
          filename = `${session.title.replace(/\s+/g, '_')}.md`;
          break;
        case 'json':
          content = JSON.stringify(session, null, 2);
          filename = `${session.title.replace(/\s+/g, '_')}.json`;
          break;
      }

      downloadFile(content, filename);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      setError(message);
      console.error('Export error:', err);
    }
  };

  const exportNotionMarkdown = (session: Session): string => {
    return exportAsMarkdown(session);
  };

  return {
    exportToFile,
    exportNotionMarkdown,
    loading,
    error,
  };
}

function exportAsText(session: Session): string {
  return `${session.title}
Date: ${session.date}
Duration: ${session.duration}s
Language: ${session.language}

TRANSCRIPT
${'='.repeat(60)}
${session.transcript}

${
  session.summary
    ? `SUMMARY
${'='.repeat(60)}
${session.summary.executiveSummary}`
    : ''
}
`;
}

function exportAsMarkdown(session: Session): string {
  let md = `# ${session.title}

**Date:** ${session.date}  
**Duration:** ${session.duration}s  
**Language:** ${session.language}  
**Tags:** ${session.tags.join(', ') || 'None'}

## Transcript

${session.transcript}
`;

  if (session.summary) {
    md += `

## Summary

### Executive Summary
${session.summary.executiveSummary}

### Key Points
${session.summary.keyPoints.map((p) => `- ${p}`).join('\n')}

### Lecture Notes
${session.summary.lectureNotes}

### Actionable Insights
${session.summary.actionableInsights.map((i) => `- ${i}`).join('\n')}
`;
  }

  return md;
}

function downloadFile(content: string, filename: string): void {
  const element = document.createElement('a');
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  element.setAttribute('href', url);
  element.setAttribute('download', filename);
  element.style.display = 'none';

  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);

  URL.revokeObjectURL(url);
}
