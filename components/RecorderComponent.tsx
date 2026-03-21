'use client';

import React, { useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useAudioRecorder } from '@/hooks/useRecorder';
import { useSummarization } from '@/hooks/useTranscription';
import { formatDuration, transcribeAudio } from '@/lib/utils';
import type { Session, Summary } from '@/lib/types';

interface RecorderComponentProps {
  onCreateSession?: (sessionData: Partial<Session>) => Promise<Session>;
  onSessionSaved?: (session: Session) => void;
}

export default function RecorderComponent({
  onCreateSession,
  onSessionSaved,
}: RecorderComponentProps) {
  // Real-time transcription enabled in useAudioRecorder hook
  const {
    startRecording,
    stopRecording,
    isRecording,
    duration,
    error,
    isLiveTranscribing,
    liveStatus,
    lastChunkText,
    processedChunks,
    audioLevel,
    liveEngine,
    liveEngineMode,
    selectedDialect,
    setLiveEngineMode,
    setSelectedDialect,
  } = useAudioRecorder();
  const { summarize, loading: summarizing } = useSummarization();

  const {
    recorder,
    setLanguage,
    setTranscript,
    resetRecorder,
    setSummarizing: setStore_Summarizing,
    addToast,
  } = useAppStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const wordCount = recorder.transcript.trim()
    ? recorder.transcript.trim().split(/\s+/).length
    : 0;

  const liveStatusLabel = {
    idle: 'Idle',
    listening: 'Listening...',
    transcribing: 'Transcribing now...',
    updated: 'Updated',
  }[liveStatus];

  const eqOffsets = [-22, -8, 10, -8, -22];
  const eqLevels = eqOffsets.map((offset) => {
    if (!isRecording) return 8;
    const level = audioLevel + offset;
    return Math.max(8, Math.min(100, level));
  });

  const handleStart = async () => {
    resetRecorder();
    await startRecording({
      engineMode: liveEngineMode,
      dialect: selectedDialect,
    });
  };

  const handleStop = async () => {
    try {
      setIsProcessing(true);
      const audioBlob = await stopRecording();

      if (!audioBlob) {
        throw new Error('No audio recorded');
      }

      let latestTranscript = useAppStore
        .getState()
        .recorder.transcript.trim();

      // Friendly fallback: if live chunks produced no text, transcribe full recording once.
      if (!latestTranscript) {
        const finalTranscript = await transcribeAudio(audioBlob, recorder.language);

        if (finalTranscript.trim()) {
          latestTranscript = finalTranscript.trim();
          setTranscript(latestTranscript);
        }
      }

      if (!latestTranscript) {
        addToast(
          'info',
          'No detectamos voz con claridad. Intenta hablar un poco mas cerca del microfono y vuelve a grabar.'
        );
        return;
      }

      let summary: Summary | null = null;

      // Transcript already being updated in real-time via chunks
      // Just auto-summarize if transcript is long enough
      if (latestTranscript.length > 100) {
        setStore_Summarizing(true);
        try {
          summary = await summarize(latestTranscript);
        } catch (err) {
          console.error('Auto-summarize failed:', err);
          // Continue without summary
        }
      }

      if (onCreateSession) {
        const now = new Date().toISOString();
        const titleFromTranscript = latestTranscript
          .split(/\s+/)
          .slice(0, 8)
          .join(' ');

        const savedSession = await onCreateSession({
          title: titleFromTranscript
            ? `${titleFromTranscript}...`
            : `Lecture ${new Date().toLocaleString()}`,
          date: now,
          duration,
          language: recorder.language,
          transcript: latestTranscript,
          summary,
          tags: [],
          createdAt: now,
          updatedAt: now,
        });

        onSessionSaved?.(savedSession);
        addToast('success', 'Sesion guardada correctamente.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed';
      addToast('error', `No se pudo procesar la grabacion: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-white via-rose-50 to-amber-50 p-5 shadow-xl sm:p-8">
        <div className="mb-6">
          <p className="mb-2 inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-700 shadow-sm">
            Study Buddy Recorder
          </p>
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Graba tu clase con calma
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Nosotros te ayudamos con transcripcion en vivo y resumen automatico.
          </p>
        </div>

        {/* Language Selector */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Lecture Language
          </label>
          <select
            value={recorder.language}
            onChange={(e) =>
              setLanguage(e.target.value as 'en' | 'es')
            }
            disabled={isRecording}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="en">English</option>
            <option value="es">Spanish (Español)</option>
          </select>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Live Engine
            </label>
            <select
              value={liveEngineMode}
              onChange={(e) =>
                setLiveEngineMode(e.target.value as 'auto' | 'browser' | 'api')
              }
              disabled={isRecording}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="auto">Auto (recommended)</option>
              <option value="browser">Browser Speech (free)</option>
              <option value="api">Whisper API</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Dialect
            </label>
            <select
              value={selectedDialect}
              onChange={(e) => setSelectedDialect(e.target.value)}
              disabled={isRecording}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="es-ES">Español (España)</option>
              <option value="es-MX">Español (México)</option>
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
            </select>
          </div>
        </div>

        {/* Recording Timer */}
        <div className="mb-8 rounded-xl border border-white/70 bg-white/80 py-5 text-center shadow-sm">
          <div className="mb-2 text-4xl font-mono font-bold text-rose-600">
            {formatDuration(duration)}
          </div>
          <div className="flex justify-center">
            {isRecording && (
              <div className="inline-flex items-center gap-2 text-rose-700">
                <div className="h-3 w-3 rounded-full bg-rose-500 animate-pulse"></div>
                <span className="text-sm font-medium">Grabando ahora...</span>
              </div>
            )}
          </div>
        </div>

        {/* Real-time Feedback */}
        <div className="mb-6 p-4 rounded-lg border border-slate-200 bg-slate-50">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-900">Live Feedback</h3>
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                isRecording
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {isRecording ? liveStatusLabel : 'Not recording'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 mb-3">
            <p>
              Chunks processed: <span className="font-semibold">{processedChunks}</span>
            </p>
            <p>
              Words detected: <span className="font-semibold">{wordCount}</span>
            </p>
          </div>

          <p className="mb-3 text-xs text-slate-500">
            Live engine:{' '}
            <span className="font-semibold text-slate-700">
              {liveEngine === 'browser' ? 'Browser Speech (free)' : 'Whisper API fallback'}
            </span>
          </p>

          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
              <span>Mic input level</span>
              <span className="font-semibold">{audioLevel}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  audioLevel > 65
                    ? 'bg-green-500'
                    : audioLevel > 30
                    ? 'bg-yellow-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${isRecording ? audioLevel : 0}%` }}
              />
            </div>
          </div>

          <div className="mb-3 rounded-md border border-slate-200 bg-white px-3 py-2">
            <div className="flex items-end justify-center gap-1.5 h-10">
              {eqLevels.map((level, index) => (
                <div
                  key={`eq-${index}`}
                  className={`w-1.5 rounded-sm transition-all duration-150 ${
                    isRecording ? 'bg-blue-500' : 'bg-slate-300'
                  }`}
                  style={{
                    height: `${level}%`,
                    opacity: isRecording ? 1 : 0.6,
                  }}
                />
              ))}
            </div>
          </div>

          {isRecording && !recorder.transcript && (
            <p className="text-sm text-blue-700">
              Habla con naturalidad. Tu texto aparecera cuando llegue el primer bloque estable.
            </p>
          )}

          {lastChunkText && (
            <div className="mt-2 p-2 rounded bg-white border border-slate-200">
              <p className="text-xs text-slate-500 mb-1">Last detected phrase</p>
              <p className="text-sm text-slate-800">{lastChunkText}</p>
            </div>
          )}

          {isLiveTranscribing && (
            <p className="mt-2 text-xs text-blue-600 animate-pulse">
              Sending audio chunk to transcription service...
            </p>
          )}
        </div>

        {/* Transcript Display */}
        {recorder.transcript && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              Transcript (Live)
              {isRecording && (
                <span className="text-xs font-normal text-blue-600 animate-pulse">
                  ● updating...
                </span>
              )}
            </h3>
            <p className="text-slate-700 text-sm max-h-32 overflow-y-auto">
              {recorder.transcript}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              {Math.ceil(recorder.transcript.split(/\s+/).length / 200)} minutes
              of content
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleStart}
            disabled={
              isRecording || isProcessing || summarizing
            }
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Mic size={20} />
            Empezar
          </button>

          <button
            onClick={handleStop}
            disabled={
              !isRecording || isProcessing || summarizing
            }
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Square size={20} />
            Detener
          </button>
        </div>

        {/* Processing Status */}
        {(isProcessing || summarizing) && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-blue-800 text-sm font-medium">
                {isProcessing && 'Processing audio...'}
                {summarizing && 'Generating summary...'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
