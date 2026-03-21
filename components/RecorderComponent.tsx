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
          summary = await summarize(latestTranscript, recorder.language);
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
    <div className="flex-1 overflow-y-auto">
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 p-4 md:p-8 flex items-center justify-center">
        <div className="w-full max-w-2xl">
          {/* Main Card */}
          <div className="rounded-3xl border border-slate-200/60 bg-white/80 backdrop-blur-sm p-6 md:p-10 shadow-xl hover:shadow-2xl transition">
            {/* Header */}
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-100 to-green-100 px-4 py-2 text-sm font-semibold text-emerald-700 mb-4">
                🎙️ Grabadora en Vivo
              </div>
              <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent mb-2">
                Captura tu clase
              </h2>
              <p className="text-slate-600">
                Transcripción automática + Resumen inteligente en tu idioma
              </p>
            </div>

            {/* Settings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {/* Language */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  🌐 Idioma
                </label>
                <select
                  value={recorder.language}
                  onChange={(e) =>
                    setLanguage(e.target.value as 'en' | 'es')
                  }
                  disabled={isRecording}
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 bg-slate-50"
                >
                  <option value="es">🇪🇸 Español</option>
                  <option value="en">🇺🇸 English</option>
                </select>
              </div>

              {/* Engine */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  ⚡ Motor
                </label>
                <select
                  value={liveEngineMode}
                  onChange={(e) =>
                    setLiveEngineMode(e.target.value as 'auto' | 'browser' | 'api')
                  }
                  disabled={isRecording}
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 bg-slate-50"
                >
                  <option value="auto">Auto (Recomendado)</option>
                  <option value="browser">Navegador (Gratis)</option>
                  <option value="api">Whisper API</option>
                </select>
              </div>

              {/* Dialect */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  🗣️ Dialecto
                </label>
                <select
                  value={selectedDialect}
                  onChange={(e) => setSelectedDialect(e.target.value)}
                  disabled={isRecording}
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 bg-slate-50"
                >
                  <option value="es-ES">Español (España)</option>
                  <option value="es-MX">Español (México)</option>
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                </select>
              </div>
            </div>

            {/* Timer Display */}
            <div className="mb-8 rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-6 text-center">
              <div className="text-5xl md:text-6xl font-mono font-bold text-indigo-600 mb-2">
                {formatDuration(duration)}
              </div>
              {isRecording && (
                <div className="flex items-center justify-center gap-2 text-emerald-700 font-medium">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Grabando en vivo...
                </div>
              )}
            </div>

            {/* Real-time Feedback - Collapsible */}
            <div className="mb-8 rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5 overflow-hidden">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-semibold text-slate-900">📊 Retroalimentación</h3>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    isRecording
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isRecording ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="flex flex-col items-center p-2 bg-white rounded-lg border border-slate-200/50">
                  <span className="text-xs text-slate-500 font-medium">Nivel</span>
                  <span className="text-lg font-bold text-indigo-600">{audioLevel}%</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-white rounded-lg border border-slate-200/50">
                  <span className="text-xs text-slate-500 font-medium">Chunks</span>
                  <span className="text-lg font-bold text-indigo-600">{processedChunks}</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-white rounded-lg border border-slate-200/50">
                  <span className="text-xs text-slate-500 font-medium">Palabras</span>
                  <span className="text-lg font-bold text-indigo-600">{wordCount}</span>
                </div>
              </div>

              {/* Level Bar */}
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-150 ${
                        audioLevel > 65
                          ? 'bg-emerald-500'
                          : audioLevel > 30
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${isRecording ? audioLevel : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Equalizer */}
              <div className="mb-3 flex items-end justify-center gap-1.5 h-8 bg-white rounded-lg border border-slate-200/50 p-2">
                {eqLevels.map((level, index) => (
                  <div
                    key={`eq-${index}`}
                    className={`flex-1 rounded-sm transition-all duration-150 ${
                      isRecording ? 'bg-gradient-to-t from-indigo-500 to-blue-500' : 'bg-slate-300'
                    }`}
                    style={{
                      height: `${level}%`,
                      opacity: isRecording ? 1 : 0.5,
                    }}
                  />
                ))}
              </div>

              {/* Status Text */}
              {isRecording && !recorder.transcript && (
                <p className="text-xs text-indigo-700 font-medium">
                  🎤 Habla nearamente. El texto aparecerá pronto...
                </p>
              )}

              {lastChunkText && (
                <div className="mt-3 p-2.5 rounded-lg bg-white border border-indigo-200/50">
                  <p className="text-xs text-slate-500 font-medium mb-1">Última frase detectada:</p>
                  <p className="text-sm text-slate-800 leading-relaxed">{lastChunkText}</p>
                </div>
              )}
            </div>

            {/* Transcript Display - Expandable */}
            {recorder.transcript && (
              <div className="mb-8 rounded-2xl border border-slate-200/60 bg-blue-50/50 p-5">
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  ✍️ Transcripción en Vivo
                  {isRecording && (
                    <span className="text-xs font-normal text-blue-600 animate-pulse">
                      • actualizando...
                    </span>
                  )}
                </h3>
                <div className="p-4 bg-white rounded-lg max-h-40 overflow-y-auto border border-blue-200">
                  <p className="text-slate-800 text-sm leading-relaxed">{recorder.transcript}</p>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  📖 {Math.ceil(recorder.transcript.split(/\s+/).length / 150)} min aprox.
                </p>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
                <p className="text-red-800 text-sm font-medium">⚠️ {error}</p>
              </div>
            )}

            {/* Control Buttons */}
            <div className="flex gap-4 mb-4">
              <button
                onClick={handleStart}
                disabled={isRecording || isProcessing || summarizing}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-4 font-bold text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:scale-100"
              >
                <Mic size={20} />
                Empezar Grabación
              </button>

              <button
                onClick={handleStop}
                disabled={!isRecording || isProcessing || summarizing}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-6 py-4 font-bold text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:scale-100"
              >
                <Square size={20} />
                Detener
              </button>
            </div>

            {/* Processing Status */}
            {(isProcessing || summarizing) && (
              <div className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-indigo-900 text-sm font-medium">
                    {isProcessing && '⏳ Procesando audio...'}
                    {summarizing && '🤖 Generando resumen...'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
