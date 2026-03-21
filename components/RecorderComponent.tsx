"use client";

import React, { useState } from 'react';
import { Mic, Globe, FileText } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useAudioRecorder } from '@/hooks/useRecorder';
import { useSummarization } from '@/hooks/useTranscription';
import { formatDuration, transcribeAudio } from '@/lib/utils';
import TestPhase from './TestPhase';
import SoundWaves from './SoundWaves';
import type { Session, Summary } from '@/lib/types';

interface RecorderComponentProps {
  onCreateSession?: (sessionData: Partial<Session>) => Promise<Session>;
  onSessionSaved?: (session: Session) => void;
}

export default function RecorderComponent({
  onCreateSession,
  onSessionSaved,
}: RecorderComponentProps) {
  const [showTestPhase, setShowTestPhase] = useState(true);
  const [testPassed, setTestPassed] = useState(false);

  const {
    startRecording,
    stopRecording,
    isRecording,
    duration,
    error,
    audioLevel,
    selectedDialect,
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

  const handleStart = async () => {
    resetRecorder();
    await startRecording({
      engineMode: 'auto',
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

      // Transcribe full audio after recording
      const transcript = await transcribeAudio(audioBlob, recorder.language);

      if (!transcript.trim()) {
        addToast(
          'info',
          'No detectamos voz con claridad. Intenta hablar un poco más cerca del micrófono y vuelve a grabar.'
        );
        return;
      }

      setTranscript(transcript.trim());

      let summary: Summary | null = null;

      // Auto-summarize if transcript is long enough
      if (transcript.length > 100) {
        setStore_Summarizing(true);
        try {
          summary = await summarize(transcript.trim(), recorder.language);
        } catch (err) {
          console.error('Auto-summarize failed:', err);
        }
      }

      if (onCreateSession) {
        const now = new Date().toISOString();
        const titleFromTranscript = transcript
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
          transcript: transcript.trim(),
          summary,
          tags: [],
          createdAt: now,
          updatedAt: now,
        });

        onSessionSaved?.(savedSession);
        addToast('success', 'Sesión guardada correctamente.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed';
      addToast('error', `No se pudo procesar la grabación: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Show test phase if not passed
  if (showTestPhase && !testPassed) {
    return (
      <TestPhase
        onTestPassed={() => {
          setTestPassed(true);
          setShowTestPhase(false);
        }}
        onCancel={() => {
          // Go back to home
          window.history.back();
        }}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-transparent">
      <div className="min-h-full w-full p-6 md:p-12 flex flex-col items-center justify-center">
        <div className="w-full max-w-xl">
          {/* Main Card */}
          <div className="rounded-xl border border-[#EAEAEB] bg-white p-8 md:p-10 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            {/* Header */}
            <div className="mb-10 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-50 border border-[#EAEAEB] mb-5 shadow-sm">
                <Mic size={20} className="text-slate-700" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
                Record Session
              </h2>
              <p className="text-[14px] text-slate-500">
                Capture high-quality audio and automatically generate structured notes.
              </p>
            </div>

            {/* Settings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
              {/* Language */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <Globe size={14} className="text-slate-400" /> Language
                </label>
                <select
                  value={recorder.language}
                  onChange={(e) => setLanguage(e.target.value as 'en' | 'es')}
                  disabled={isRecording}
                  className="w-full px-3 py-2 bg-[#F9F9FA] border border-[#EAEAEB] rounded-md text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:bg-white disabled:opacity-50 transition-colors shadow-sm"
                >
                  <option value="es">Spanish</option>
                  <option value="en">English</option>
                </select>
              </div>

              {/* Dialect */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 12 2.1 12A10 10 0 0 1 12 2z"></path></svg> 
                  Dialect
                </label>
                <select
                  value={selectedDialect}
                  onChange={(e) => setSelectedDialect(e.target.value)}
                  disabled={isRecording}
                  className="w-full px-3 py-2 bg-[#F9F9FA] border border-[#EAEAEB] rounded-md text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:bg-white disabled:opacity-50 transition-colors shadow-sm"
                >
                  <option value="es-ES">España</option>
                  <option value="es-MX">México</option>
                  <option value="en-US">US English</option>
                  <option value="en-GB">UK English</option>
                </select>
              </div>
            </div>

            {/* Timer Display */}
            <div className="mb-8 p-8 flex flex-col items-center justify-center relative">
              <div className="text-6xl font-semibold tracking-tighter text-slate-900 mb-3" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatDuration(duration)}
              </div>
              {isRecording && (
                <div className="flex items-center justify-center gap-2 text-red-500 font-medium text-[13px]">
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  Recording
                </div>
              )}
            </div>

            {/* Sound Waves Animation */}
            {isRecording && (
              <div className="mb-8 rounded-xl bg-[#F9F9FA] border border-[#EAEAEB] p-6 h-28 flex items-center justify-center">
                <SoundWaves isActive={isRecording} audioLevel={audioLevel} />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center gap-4 mb-8">
              {!isRecording ? (
                <button
                  onClick={handleStart}
                  disabled={isProcessing}
                  className="flex flex-1 items-center justify-center gap-2 px-6 py-2.5 rounded-md font-medium text-[14px] text-white bg-slate-900 hover:bg-slate-800 transition-colors disabled:opacity-50 shadow-sm"
                >
                  <Mic size={16} />
                  Start Recording
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  disabled={isProcessing}
                  className="flex flex-1 items-center justify-center gap-2 px-6 py-2.5 rounded-md font-medium text-[14px] text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 shadow-sm"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                  Stop Recording
                </button>
              )}
            </div>

            {/* Status Messages */}
            {isProcessing && (
              <div className="mb-6 rounded-md border border-[#EAEAEB] bg-[#F9F9FA] p-4 text-center shadow-sm">
                <div className="inline-flex items-center gap-2.5">
                  <div className="h-3.5 w-3.5 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
                  <span className="text-[13px] text-slate-700 font-medium">
                    {duration > 5
                      ? 'Generating insights & summary...'
                      : 'Processing audio...'}
                  </span>
                </div>
              </div>
            )}

            {/* Transcript Section */}
            {recorder.transcript && (
              <div className="mb-6">
                <div className="rounded-md border border-[#EAEAEB] bg-[#F9F9FA] p-5 shadow-sm">
                  <h3 className="text-[13px] font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
                    <FileText size={14} className="text-slate-500" /> Transcript Preview
                  </h3>
                  <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto pr-2">
                    {recorder.transcript}
                  </p>
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="text-center text-[12px] text-slate-500 mt-2">
                 Speak clearly for best accuracy. Summary generation is automatic.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
