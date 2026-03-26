
"use client";

import React, { useState, useEffect } from 'react';
import { Mic, Globe, FileText } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useAudioRecorder } from '@/hooks/useRecorder';
import { useSummarization } from '@/hooks/useTranscription';
import { formatDuration, transcribeAudio } from '@/lib/utils';
import TestPhase from './TestPhase';
import SoundWaves from './SoundWaves';
import SubjectSelector from './SubjectSelector';
import type { Session, Summary } from '@/lib/types';
import { getAllFailedChunks } from '@/lib/idb';

// Helper para estimar el uso de localStorage
function getLocalStorageUsage() {
  if (typeof window === 'undefined' || !window.localStorage) return { used: 0, max: 5 * 1024 * 1024 };
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    const v = localStorage.getItem(k);
    if (v) total += k.length + v.length;
  }
  // Máximo típico: 5MB
  return { used: total, max: 5 * 1024 * 1024 };
}

interface RecorderComponentProps {
  onCreateSession?: (sessionData: Partial<Session>) => Promise<Session>;
  onSessionSaved?: (session: Session) => void;
}

export default function RecorderComponent({
  onCreateSession,
  onSessionSaved,
}: RecorderComponentProps) {
  // Estado para advertencia de localStorage casi lleno
  const [lsWarning, setLsWarning] = useState(false);
  const [showTestPhase, setShowTestPhase] = useState(false);
  const [testPassed, setTestPassed] = useState(false);
  // Nueva opción: fuente de audio
  const [audioSource, setAudioSource] = useState<'mic' | 'tab' | 'system'>('mic');
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const {
    startRecording,
    stopRecording,
    isRecording,
    duration,
    error,
    audioLevel,
    selectedDialect,
    setSelectedDialect,
    queuedCount,
    retrying,
    triggerRetry,
    reconstructPersistedTranscript,
    reconstructPersistedTranscriptDetails,
  } = useAudioRecorder() as any;

  const [persistedInfo, setPersistedInfo] = useState<{ text: string; count: number; lastSavedAt: string | null }>({ text: '', count: 0, lastSavedAt: null });

  // Poll persisted transcript details while recording (shows incremental save progress)
  const recIsRecording = typeof isRecording === 'boolean' ? isRecording : false;
  useEffect(() => {
    let id: number | null = null;
    const poll = async () => {
      try {
        if (typeof reconstructPersistedTranscriptDetails === 'function') {
          const d = await reconstructPersistedTranscriptDetails();
          // Depuración: mostrar sessionId y cantidad de fragmentos detectados
          if (window && typeof window !== 'undefined') {
            const sessionId = (window as any).__recorderController?.sessionId || 'N/A';
            // eslint-disable-next-line no-console
            console.log('[Recorder][poll] sessionId:', sessionId, 'persistedInfo.count:', persistedInfo.count, 'detected count:', d?.count, 'lastSavedAt:', d?.lastSavedAt);
          }
          if (d && (d.count !== persistedInfo.count || d.lastSavedAt !== persistedInfo.lastSavedAt)) {
            setPersistedInfo({ text: d.text || '', count: d.count || 0, lastSavedAt: d.lastSavedAt || null });
          }
        }
      } catch (e) {
        // ignore
      }
    };

    if (recIsRecording) {
      // initial poll
      void poll();
      id = window.setInterval(() => void poll(), 2000);
    } else {
      // when not recording, take one final snapshot
      void poll();
    }

    return () => { if (id) window.clearInterval(id); };
  }, [recIsRecording, reconstructPersistedTranscriptDetails, persistedInfo.count, persistedInfo.lastSavedAt]);

  // Stop any existing persistent recorder when switching to tab/system capture
  const handleAudioSourceChange = async (value: 'mic' | 'tab' | 'system') => {
    setAudioSource(value);
    if (value === 'tab' || value === 'system') {
      try {
        const hostController = typeof window !== 'undefined' ? (window as any).__recorderController : null;
        if (hostController && hostController.isRecording) {
          try {
            await hostController.stopRecording();
            try { addToast('info', 'Se detuvo la grabación previa para evitar interferencias con la fuente compartida.'); } catch {}
          } catch (e) {
            // ignore errors stopping host
          }
        }
      } catch {}
    }
  };

  const [queuedItems, setQueuedItems] = useState<any[]>([]);
  const [showQueueDetails, setShowQueueDetails] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const items = await getAllFailedChunks();
        if (mounted) setQueuedItems(items || []);
      } catch (e) {
        // ignore
      }
    };
    void load();
    return () => { mounted = false; };
  }, [queuedCount, retrying]);

  function fmtTime(iso?: string) {
    if (!iso) return '-';
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h`;
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
  const isFirefox = ua.includes('firefox');
  const isSafari = /safari/.test(ua) && !/chrome|crios|crmo|edg/.test(ua);
  const isChromium = /chrome|crios|crmo|edg|brave/.test(ua);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioIns = devices.filter(d => d.kind === 'audioinput');
        setAudioInputs(audioIns);
        const first = audioIns[0];
        // Auto-select known virtual devices if present (VB‑Cable, BlackHole, Stereo Mix, loopback)
        const virtualRegex = /vb[- ]?cable|blackhole|stereo mix|loopback|virtual audio|cable input|vcable/i;
        const preferred = audioIns.find(d => virtualRegex.test(d.label || ''));
        if (preferred && !selectedDeviceId) {
          setSelectedDeviceId(preferred.deviceId);
          try { addToast('info', `Dispositivo virtual detectado: "${preferred.label || preferred.deviceId.slice(0,6)}" seleccionado automáticamente.`); } catch {}
        } else if (first && !selectedDeviceId) setSelectedDeviceId(first.deviceId);
      } catch (err) {
        // ignore
      }
    };
    loadDevices();
  }, []);

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
  const [summaryFailed, setSummaryFailed] = useState<string | null>(null);
  const [showAudioHelpModal, setShowAudioHelpModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const handleStart = async () => {
    // If user chose microphone and hasn't passed test, show test flow first
    if (audioSource === 'mic' && !testPassed) {
      setShowTestPhase(true);
      return;
    }

    // Otherwise proceed to start recording immediately
    await startRecordingFlow();
  };

  // Core start logic extracted so TestPhase can trigger it after passing
  const startRecordingFlow = async () => {
    resetRecorder();
    // Selección de fuente de audio
    let stream: MediaStream | undefined;
    try {
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
      const isFirefox = ua.includes('firefox');
      if (isFirefox && (audioSource === 'tab' || audioSource === 'system')) {
        addToast('info', 'Firefox limita la captura de audio de pestañas/sistema. Intentaremos un fallback automático.');
      }
      if (audioSource === 'mic') {
        // Micrófono normal. If user selected a specific device, prefer it.
        const constraints: MediaStreamConstraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            ...(selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : {}),
          },
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } else if (audioSource === 'tab' || audioSource === 'system') {
        // Many browsers require video:true for the display picker to allow selecting a tab/window
        // and to enable the "share audio" option. Request both and then strip video tracks.
          try {
            const disp = await navigator.mediaDevices.getDisplayMedia({ audio: true as any, video: true as any });
            const audioTracks = disp.getAudioTracks();
            const videoTracks = disp.getVideoTracks();
            // Remove video tracks before handing off to recorder to avoid capturing camera
            videoTracks.forEach(t => t.stop());

            // If audio tracks found, create a new stream that contains ONLY those audio tracks
            // This avoids accidentally including microphone tracks from elsewhere.
            if (audioTracks.length > 0) {
              const displayOnly = new MediaStream(audioTracks.map((t) => t));
              stream = displayOnly;
            } else {
              // No audio tracks — do NOT fallback automatically to the microphone to avoid
              // unintentionally recording the mic. Show help so the user can enable "Compartir audio".
              disp.getTracks().forEach(t => t.stop());
              addToast('error', 'No se detectó audio al compartir la pantalla/pestaña. Asegúrate de marcar "Compartir audio" en el diálogo del navegador.');
              setShowAudioHelpModal(true);
              return;
            }
          } catch (e) {
            // If user cancels the display picker or browser blocks it
            addToast('error', 'No se pudo abrir el selector de pantalla/pestaña. Revisa los permisos o prueba con Chrome/Edge/Brave.');
            setShowAudioHelpModal(true);
            return;
          }
      }
    } catch (err) {
      addToast('error', 'No se pudo acceder a la fuente de audio seleccionada. Asegúrate de permitir el acceso en el diálogo del navegador.');
      return;
    }

    // If a persistent host controller exists, prefer it so the recording instance stays mounted across navigation
    try {
      const hostController = typeof window !== 'undefined' ? (window as any).__recorderController : null;
      if (hostController && hostController.startRecording) {
        await hostController.startRecording({ engineMode: 'auto', dialect: selectedDialect, stream });
        return;
      }
    } catch (e) {
      // ignore and fall back to local startRecording below
    }

    await startRecording({
      engineMode: 'auto',
      dialect: selectedDialect,
      stream,
    });
  };

  const startAfterTest = async () => {
    setTestPassed(true);
    setShowTestPhase(false);
    // small delay to let modal close
    setTimeout(() => startRecordingFlow(), 150);
  };

  const handleStop = async () => {
    try {
      setIsProcessing(true);
      // prefer host controller if available (persistent recorder mounted in layout)
      const hostController = typeof window !== 'undefined' ? (window as any).__recorderController : null;
      const stopFn = hostController?.stopRecording ?? stopRecording;
      const audioBlob = await stopFn();

      if (!audioBlob) {
        throw new Error('No audio recorded');
      }

      // Process the recording; if stopped via host controller, host may have already
      // populated the store transcript. Pass a flag so we don't double-transcribe.
      await processRecording(audioBlob, Boolean(hostController));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed';
      addToast('error', `No se pudo procesar la grabación: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Process a recorded Blob: transcribe (if needed), summarize, and save session
  const processRecording = async (audioBlob: Blob, transcriptAlreadySet = false) => {
    if (!audioBlob) return;

    let transcriptText = recorder.transcript?.trim() || '';

    try {
      if (!transcriptAlreadySet) {
        // Transcribe full audio after recording
        transcriptText = await transcribeAudio(audioBlob, recorder.language);
      }

      // Siempre usar la reconstrucción incremental para guardar y resumir
      let persisted = '';
      if (typeof reconstructPersistedTranscript === 'function') {
        persisted = await reconstructPersistedTranscript();
      }
      let finalTranscript = (persisted && persisted.length > 0) ? persisted : (transcriptText || '').trim();

      if (!finalTranscript || !finalTranscript.trim()) {
        addToast('info', 'No detectamos voz con claridad. Intenta hablar un poco más cerca del micrófono y vuelve a grabar.');
        return;
      }

      // Log/alert si la transcripción es sospechosamente corta
      if (finalTranscript.split(/\s+/).length < 20) {
        try { addToast('warning', '¡Advertencia! La transcripción reconstruida es muy corta. Puede que haya un problema con el guardado incremental.'); } catch {}
      }

      setTranscript(finalTranscript.trim());
      transcriptText = finalTranscript.trim();

      let summary: Summary | null = null;
      let summaryError = null;

      // Auto-summarize if transcript is long enough
      if (transcriptText.length > 100) {
        setStore_Summarizing(true);
        try {
          summary = await summarize(transcriptText.trim(), recorder.language);
          setSummaryFailed(null);
        } catch (err) {
          summaryError = err instanceof Error ? err.message : 'Auto-summarize failed';
          setSummaryFailed(summaryError);
          console.error('Auto-summarize failed:', err);
        }
      }

        if (onCreateSession) {
        const now = new Date().toISOString();
        const titleFromTranscript = transcriptText
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
            transcript: transcriptText.trim(),
            summary: summary || undefined,
            subject: selectedSubject || undefined,
          tags: [],
          createdAt: now,
          updatedAt: now,
        });

        onSessionSaved?.(savedSession);
        if (summary) {
          addToast('success', 'Sesión guardada correctamente (con resumen).');
        } else {
          addToast('warning', `Sesión guardada solo con transcripción.\n${summaryError ? 'No se pudo generar el resumen: ' + summaryError : ''}`);
        }
      }

      // Clear queued items for this session (they're now saved) and refresh UI
      try {
        const hostController = typeof window !== 'undefined' ? (window as any).__recorderController : null;
        await hostController?.clearQueue?.(hostController?.sessionId);
        setQueuedItems([]);
      } catch {}

      // Reset recorder UI/state so pill and counters return to initial state
      try {
        resetRecorder();
      } catch {}
    } catch (err) {
      console.error('processRecording error', err);
      throw err;
    } finally {
      setStore_Summarizing(false);
    }
  };

  const handleRetrySummary = async () => {
    if (!recorder.transcript || recorder.transcript.trim().length === 0) {
      addToast('info', 'No hay transcripción para resumir.');
      return;
    }
    try {
      setStore_Summarizing(true);
      setSummaryFailed(null);
      const s = await summarize(recorder.transcript.trim(), recorder.language);
      if (!s) {
        setSummaryFailed('No se generó resumen.');
        addToast('error', 'No se pudo generar el resumen.');
        return;
      }

      if (!onCreateSession) {
        // If parent didn't supply a create handler, just notify
        addToast('success', 'Resumen generado (local) — no hay handler para crear sesión.');
        return;
      }

      // Create session as normal flow (title, meta, transcript, summary)
      const now = new Date().toISOString();
      const titleFromTranscript = recorder.transcript
        .split(/\s+/)
        .slice(0, 8)
        .join(' ');

      const savedSession = await onCreateSession({
        title: titleFromTranscript ? `${titleFromTranscript}...` : `Lecture ${new Date().toLocaleString()}`,
        date: now,
        duration,
        language: recorder.language,
        transcript: recorder.transcript.trim(),
        summary: s || undefined,
        subject: selectedSubject || undefined,
        tags: [],
        createdAt: now,
        updatedAt: now,
      });

      onSessionSaved?.(savedSession);
      addToast('success', 'Resumen regenerado y sesión guardada.');

      // Clear queued items for this session and refresh UI
      try {
        const hostController = typeof window !== 'undefined' ? (window as any).__recorderController : null;
        await hostController?.clearQueue?.(hostController?.sessionId);
        setQueuedItems([]);
      } catch {}

      try { resetRecorder(); } catch {}
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Resumen fallido';
      setSummaryFailed(msg);
      addToast('error', `Reintento falló: ${msg}`);
    } finally {
      setStore_Summarizing(false);
    }
  };

  // Allow external UI to stop recording via a window event (used by persistent recording pill)
  useEffect(() => {
    const onExternalStop = async () => {
      if (isRecording) {
        try {
          // Use host controller if present to ensure single instance stop
          const hostController = typeof window !== 'undefined' ? (window as any).__recorderController : null;
          if (hostController && hostController.stopRecording) {
            const audioBlob = await hostController.stopRecording();
            // Process using the existing transcript set by host, only if audio returned
            if (audioBlob) {
              await processRecording(audioBlob, true);
            }
          } else {
            await handleStop();
          }
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('app-stop-recording', onExternalStop as EventListener);
    return () => window.removeEventListener('app-stop-recording', onExternalStop as EventListener);
  }, [isRecording]);

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
      {/* Advertencia si localStorage está casi lleno */}
      {lsWarning && (
        <div className="mb-4 p-3 rounded bg-yellow-100 text-yellow-800 border border-yellow-300 text-sm">
          <b>Advertencia:</b> El almacenamiento local del navegador está casi lleno. Si la grabación es muy larga, podrías perder fragmentos. Considera guardar el respaldo o finalizar pronto.
        </div>
      )}

      {showAudioHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl bg-white rounded-lg p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-3">No se pudo capturar audio</h3>
            <p className="text-sm text-slate-700 mb-4">Algunos navegadores (p. ej. Firefox) no permiten capturar audio de pestañas/sistema directamente. Puedes usar una de las opciones automáticas o seguir la guía rápida:</p>
            <ul className="list-disc pl-5 text-sm text-slate-700 mb-4">
              <li>Usar Chrome/Edge/Brave y marcar "Compartir audio" cuando compartas la pestaña/ventana.</li>
              <li>Instalar un cable de audio virtual (Windows: VB-Cable, macOS: BlackHole) y seleccionarlo como micrófono en la app.</li>
              <li>Usar un dispositivo físico de loopback si lo tienes.</li>
            </ul>
            <div className="flex gap-2 justify-end">
              <button onClick={() => {
                const text = `Guía rápida:\n\n1) Si usas Firefox: instala VB-Cable (Windows) o BlackHole (macOS) y configúralo como dispositivo de entrada.\n2) Reinicia el navegador y selecciona ese dispositivo en la opción "Seleccionar micrófono".\n3) Para captura de pestaña en Chrome/Edge/Brave, al compartir, marca 'Compartir audio'.`;
                try { navigator.clipboard.writeText(text); addToast('success','Instrucciones copiadas'); } catch { addToast('error','No se pudo copiar'); }
              }} className="px-3 py-2 border rounded">Copiar instrucciones</button>
              <button onClick={() => { window.open('https://www.vb-audio.com/Cable/', '_blank'); }} className="px-3 py-2 border rounded">VB-Cable (Windows)</button>
              <button onClick={() => { window.open('https://github.com/ExistentialAudio/BlackHole', '_blank'); }} className="px-3 py-2 border rounded">BlackHole (macOS)</button>
              <button onClick={() => setShowAudioHelpModal(false)} className="px-3 py-2 bg-slate-900 text-white rounded">Cerrar</button>
            </div>
          </div>
        </div>
      )}
      {showTestPhase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <TestPhase
            onTestPassed={() => startAfterTest()}
            onCancel={() => setShowTestPhase(false)}
          />
        </div>
      )}
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
                Grabar sesión
              </h2>
              <p className="text-[14px] text-slate-500">
                Captura audio de alta calidad y genera notas estructuradas automáticamente.
              </p>
            </div>

            {/* Settings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-10 items-start min-w-0">

              {/* Fuente de audio */}
                <div className="space-y-1.5 min-w-0">
                  <label className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4l3 3"></path></svg>
                    Fuente de audio
                  </label>
                  <select value={audioSource} onChange={(e) => void handleAudioSourceChange(e.target.value as any)} className="w-full mt-2 px-3 py-2 bg-white border border-[#EAEAEB] rounded-md text-[13px] text-slate-800 shadow-sm min-w-0 truncate overflow-hidden max-w-[60dvw] md:max-w-[40dvw] lg:max-w-[25dvw]">
                      <option value="mic">Micrófono</option>
                      <option value="tab">Pestaña</option>
                      <option value="system">Sistema</option>
                    </select>

                {(audioSource === 'tab' || audioSource === 'system') && (isFirefox || isSafari) && (
                  <div className="mt-2 p-3 rounded-md bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">
                    Nota: {isFirefox ? 'Firefox' : 'Safari'} limita la captura directa de audio de pestañas/sistema. Para grabar audio del PC o de una pestaña, usa <strong>Chrome</strong>, <strong>Edge</strong> o <strong>Brave</strong>, o instala un cable de audio virtual (VB‑Cable / BlackHole) y selecciónalo como micrófono.
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => setShowAudioHelpModal(true)} className="px-3 py-1 bg-white border rounded">Ver guía</button>
                    </div>
                  </div>
                )}

                {(audioSource === 'tab' || audioSource === 'system') && (
                  <div className="mt-2 text-sm text-slate-600">Nota: Solo se grabará el audio compartido (pestaña/ventana/sistema). El micrófono no será usado automáticamente para evitar interferencias.</div>
                )}

                {audioSource === 'mic' && (
                  <div className="mt-2 min-w-0">
                    <label className="text-[12px] text-slate-600">Seleccionar micrófono</label>
                    <select
                      value={selectedDeviceId ?? ''}
                      onChange={e => setSelectedDeviceId(e.target.value || null)}
                      disabled={isRecording}
                        className="w-full mt-1 px-3 py-2 bg-white border border-[#EAEAEB] rounded-md text-[13px] text-slate-800 shadow-sm min-w-0 truncate overflow-hidden max-w-[60dvw] md:max-w-[40dvw] lg:max-w-[25dvw]"
                    >
                      {audioInputs.length === 0 && <option value="">Predeterminado</option>}
                      {audioInputs.map(d => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label || 'Micrófono ' + d.deviceId.slice(0,6)}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Language + Dialect */}
              <div className="space-y-4">
                <div className="space-y-1.5 min-w-0">
                  <label className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5">
                    <Globe size={14} className="text-slate-400" /> Idioma
                  </label>
                  <select
                    value={recorder.language}
                    onChange={(e) => setLanguage(e.target.value as 'en' | 'es')}
                    disabled={isRecording}
                    className="w-full px-3 py-2 bg-[#F9F9FA] border border-[#EAEAEB] rounded-md text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:bg-white disabled:opacity-50 transition-colors shadow-sm min-w-0 truncate overflow-hidden max-w-[50dvw] md:max-w-[36dvw] lg:max-w-[24dvw]"
                  >
                    <option value="es">Español</option>
                    <option value="en">Inglés</option>
                  </select>
                </div>

                <div className="space-y-1.5 min-w-0">
                  <label className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 12 2.1 12A10 10 0 0 1 12 2z"></path></svg>
                    Dialect
                  </label>
                  <select
                    value={selectedDialect}
                    onChange={(e) => setSelectedDialect(e.target.value)}
                    disabled={isRecording}
                    className="w-full px-3 py-2 bg-[#F9F9FA] border border-[#EAEAEB] rounded-md text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:bg-white disabled:opacity-50 transition-colors shadow-sm min-w-0 truncate overflow-hidden max-w-[50dvw] md:max-w-[36dvw] lg:max-w-[24dvw]"
                  >
                    <option value="es-ES">España</option>
                    <option value="es-MX">México</option>
                    <option value="en-US">US English</option>
                    <option value="en-GB">UK English</option>
                  </select>
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <SubjectSelector value={selectedSubject} onChange={(v) => setSelectedSubject(v)} />
              </div>
            </div>

            {/* Timer Display */}
            <div className="mb-8 p-8 flex flex-col items-center justify-center relative">
              <div className="text-6xl font-semibold tracking-tighter text-slate-900 mb-3" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatDuration(duration)}
              </div>
              {/* Persisted transcript indicator */}
              <div className="mt-2 text-sm text-slate-600 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <div>
                    <div className="text-xs">Transcripción guardada:</div>
                    <div className="text-sm font-medium">
                      {persistedInfo.count > 0 ? `${persistedInfo.count} fragmentos · ${Math.max(0, persistedInfo.text.split(/\s+/).length)} palabras` : '0 fragmentos'}
                    </div>
                  </div>
                </div>
                {persistedInfo.lastSavedAt && <div className="text-xs text-slate-500">último guardado: {new Date(persistedInfo.lastSavedAt).toLocaleTimeString()}</div>}
                {persistedInfo.count > 0 && (
                  <button onClick={() => {
                    try {
                      const blob = new Blob([persistedInfo.text || ''], { type: 'text/plain;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `transcript_${new Date().toISOString()}.txt`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    } catch (e) {
                      try { addToast('error', 'No se pudo descargar la transcripción.'); } catch {}
                    }
                  }} className="ml-2 px-2 py-1 text-xs bg-white border rounded">Descargar</button>
                )}
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
              <>
                <div className="mb-4 rounded-xl bg-[#F9F9FA] border border-[#EAEAEB] p-6 h-28 flex items-center justify-center">
                  <SoundWaves isActive={isRecording} audioLevel={audioLevel} />
                </div>
                {/* Real-time Transcript Box */}
                <div className="mb-8">
                  <div className="rounded-md border border-[#EAEAEB] bg-[#F9F9FA] p-5 shadow-sm">
                    <h3 className="text-[13px] font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
                      <FileText size={14} className="text-slate-500" /> Transcripción en tiempo real
                    </h3>
                    <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto pr-2">
                      {persistedInfo.text ? persistedInfo.text : <span className="italic text-slate-400">Esperando audio...</span>}
                    </p>
                  </div>
                </div>
              </>
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
                  Iniciar grabación
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  disabled={isProcessing}
                  className="flex flex-1 items-center justify-center gap-2 px-6 py-2.5 rounded-md font-medium text-[14px] text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 shadow-sm"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                  Detener grabación
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

            {/* Upload queue status */}
            {(queuedCount > 0 || retrying) && (
              <div className="mb-4 rounded-md border border-[#EAEAEB] bg-[#FFF7ED] p-3 text-center text-sm text-slate-800 shadow-sm relative">
                <div className="flex items-center justify-center gap-2">
                  {retrying ? (
                    <div className="h-3.5 w-3.5 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
                  ) : (
                    <div className="h-2.5 w-2.5 rounded-full bg-orange-400" />
                  )}
                  <span>
                    {retrying ? 'Reintentando envíos pendientes...' : 'Envíos pendientes:'} {queuedCount}
                  </span>
                  <button onClick={() => setShowQueueDetails((s) => !s)} className="ml-3 px-2 py-1 text-xs border rounded bg-white">Detalles</button>
                  <button onClick={() => void triggerRetry?.()} className="ml-2 px-2 py-1 text-xs border rounded bg-white">Reintentar ahora</button>
                </div>

                {showQueueDetails && (
                  <div className="absolute left-1/2 -translate-x-1/2 mt-3 w-[28rem] max-w-full bg-white border rounded shadow-lg p-3 text-left text-xs z-50">
                    <div className="flex items-center justify-between mb-2">
                      <strong>Historial de reintentos ({queuedItems.length})</strong>
                      <button onClick={() => setShowQueueDetails(false)} className="px-2 py-1 text-xs">Cerrar</button>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {queuedItems.length === 0 && <div className="text-slate-600">No hay elementos en la cola.</div>}
                      {queuedItems.map((it: any) => (
                        <div key={it.id} className="py-1 border-b last:border-b-0">
                          <div className="flex items-center justify-between">
                            <div className="text-slate-700 truncate-ellipsis max-w-dvw-60 flex-truncate">{it.sessionId || '—'}</div>
                            <div className="text-slate-500">chunk #{it.chunkIndex}</div>
                          </div>
                          <div className="text-slate-500">Guardado: {fmtTime(it.createdAt)} atrás · id: {it.id.slice(0, 12)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Transcript Section */}
            {recorder.transcript && !isRecording && (
              <div className="mb-6">
                <div className="rounded-md border border-[#EAEAEB] bg-[#F9F9FA] p-5 shadow-sm">
                  <h3 className="text-[13px] font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
                    <FileText size={14} className="text-slate-500" /> Vista previa de la transcripción
                  </h3>
                  <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto pr-2">
                    {recorder.transcript}
                  </p>
                  {!isRecording && (
                    <>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-sm text-slate-600">¿Falto el resumen?</div>
                        <div className="flex items-center gap-2">
                          {summarizing ? (
                            <div className="h-3.5 w-3.5 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
                          ) : (
                            <button onClick={() => void handleRetrySummary()} className="px-3 py-1 text-sm border rounded bg-white">Reintentar resumen</button>
                          )}
                        </div>
                      </div>

                      {summaryFailed && (
                        <div className="mt-3 p-2 rounded bg-red-50 border border-red-100 text-sm text-red-700">Error: {summaryFailed}</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Info Box (hidden while recording) */}
            {!isRecording && (
              <div className="text-center text-[12px] text-slate-500 mt-2">
                Speak clearly for best accuracy. Summary generation is automatic.<br />
                <span className="block mt-2 text-orange-500 font-semibold">
                  ⚠️ Para grabaciones largas (&gt;2 horas):
                  <br />
                  - Recomendado grabar en segmentos de 1-2 horas para mayor seguridad.<br />
                  - Si la transcripción es muy larga, puede que el resumen falle, pero la transcripción completa siempre se guardará.<br />
                  - El procesamiento de grabaciones muy largas puede tardar varios minutos.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
