import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { transcribeAudio, generateId } from '@/lib/utils';
import { saveFailedChunk, getAllFailedChunks, deleteFailedChunk, clearFailedChunksBySession, saveTranscriptChunk, getTranscriptChunksBySession, clearTranscriptChunksBySession } from '@/lib/idb';

// Transcode helpers: convert an AudioBuffer to WAV ArrayBuffer
function audioBufferToWav(buffer: AudioBuffer) {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);

  /* RIFF identifier */ writeString(view, 0, 'RIFF');
  /* file length */ view.setUint32(4, 36 + buffer.length * numOfChan * 2, true);
  /* RIFF type */ writeString(view, 8, 'WAVE');
  /* format chunk identifier */ writeString(view, 12, 'fmt ');
  /* format chunk length */ view.setUint32(16, 16, true);
  /* sample format (raw) */ view.setUint16(20, 1, true);
  /* channel count */ view.setUint16(22, numOfChan, true);
  /* sample rate */ view.setUint32(24, buffer.sampleRate, true);
  /* byte rate (sample rate * block align) */ view.setUint32(28, buffer.sampleRate * numOfChan * 2, true);
  /* block align (channel count * bytes per sample) */ view.setUint16(32, numOfChan * 2, true);
  /* bits per sample */ view.setUint16(34, 16, true);
  /* data chunk identifier */ writeString(view, 36, 'data');
  /* data chunk length */ view.setUint32(40, buffer.length * numOfChan * 2, true);

  // write interleaved data
  let offset = 44;
  const channels: Float32Array[] = [];
  for (let i = 0; i < numOfChan; i++) channels.push(buffer.getChannelData(i));

  const sampleCount = buffer.length;
  for (let i = 0; i < sampleCount; i++) {
    for (let ch = 0; ch < numOfChan; ch++) {
      const chan = channels[ch];
      let sample = (chan && chan[i]) ?? 0;
      sample = Math.max(-1, Math.min(1, sample));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return bufferArray;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

async function transcodeBlobToWav(blob: Blob): Promise<Blob> {
  if (typeof window === 'undefined' || !(window.AudioContext || (window as any).webkitAudioContext)) {
    throw new Error('AudioContext not available');
  }

  const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as any;
  const audioCtx = new AudioCtx();
  try {
    const ab = await blob.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(ab.slice(0));
    const offline = new (window.OfflineAudioContext || (window as any).OfflineAudioContext)(
      decoded.numberOfChannels,
      decoded.length,
      decoded.sampleRate
    );
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    const wavArray = audioBufferToWav(rendered);
    return new Blob([wavArray], { type: 'audio/wav' });
  } finally {
    try {
      audioCtx.close();
    } catch {}
  }
}

/**
 * Hook for handling audio recording with MediaRecorder API
 */
export function useAudioRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const processedChunksRef = useRef<number>(0);
  // Para evitar subidas simultáneas
  const isUploadingRef = useRef<boolean>(false);
  // Para llevar la cuenta de reintentos por chunk
  const retryCountsRef = useRef<Record<string, number>>({});
  const lastRotateIndexRef = useRef<number>(0);
  const sessionIdRef = useRef<string | null>(null);
  const rotateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rotateFuncRef = useRef<((final: boolean) => Promise<void>) | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const isBrowserLiveRef = useRef(false);
  const transcriptRef = useRef<string>('');
  const isChunkTranscribingRef = useRef(false);
  const [isLiveTranscribing, setIsLiveTranscribing] = useState(false);
  const [liveStatus, setLiveStatus] = useState<
    'idle' | 'listening' | 'transcribing' | 'updated'
  >('idle');
  const [lastChunkText, setLastChunkText] = useState('');
  const [processedChunks, setProcessedChunks] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [queuedCount, setQueuedCount] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [liveEngine, setLiveEngine] = useState<'browser' | 'api'>('api');
  const [liveEngineMode, setLiveEngineMode] = useState<'auto' | 'browser' | 'api'>('auto');
  const [selectedDialect, setSelectedDialect] = useState('es-ES');

  const { setRecording, setDuration, setRecorderError, setTranscript, recorder } =
    useAppStore();

  // Helper: read persisted per-chunk transcripts from IndexedDB and join them in order
  const readPersistedTranscript = async (sessionId: string | null) => {
    try {
      if (!sessionId) return '';
      const arr = await getTranscriptChunksBySession(sessionId);
      if (!Array.isArray(arr) || arr.length === 0) return '';
      // Sort by chunkIndex and dedupe
      const sorted = arr.slice().sort((a: any, b: any) => (Number(a.chunkIndex) || 0) - (Number(b.chunkIndex) || 0));
      const seen = new Set<number>();
      const parts: string[] = [];
      for (const it of sorted) {
        const idx = Number(it?.chunkIndex ?? NaN);
        if (Number.isNaN(idx) || seen.has(idx)) continue;
        seen.add(idx);
        const txt = it?.text ?? it?.transcript ?? '';
        if (txt && String(txt).trim()) parts.push(String(txt).trim());
      }
      return parts.join(' ').trim();
    } catch (e) {
      return '';
    }
  };

  // Helper: return details about persisted transcript (text, count, lastSavedAt)
  const readPersistedTranscriptDetails = async (sessionId: string | null) => {
    try {
      if (!sessionId) return { text: '', count: 0, lastSavedAt: null };
      const arr = await getTranscriptChunksBySession(sessionId);
      if (!Array.isArray(arr) || arr.length === 0) return { text: '', count: 0, lastSavedAt: null };
      const text = await readPersistedTranscript(sessionId);
      const count = arr.length;
      // pick most recent savedAt if available
      const savedTimes = arr.map((x: any) => x?.savedAt).filter(Boolean);
      const lastSavedAt = savedTimes.length ? savedTimes[savedTimes.length - 1] : null;
      return { text, count, lastSavedAt };
    } catch {
      return { text: '', count: 0, lastSavedAt: null };
    }
  };

  const startRecording = async (opts?: { engineMode?: 'auto' | 'browser' | 'api'; dialect?: string; stream?: MediaStream }) => {
    try {
      if (recorder.isRecording) return;

      const providedStream = opts?.stream;
      const stream = providedStream ?? (await navigator.mediaDevices.getUserMedia({ audio: true }));
      streamRef.current = stream;

      const MediaRec = typeof MediaRecorder !== 'undefined' ? MediaRecorder : (window as any).MediaRecorder;
      const mr = new MediaRec(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];

      mr.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      mr.onerror = (event: any) => {
        setRecorderError(`Recording error: ${event?.error ?? String(event)}`);
      };

      // Simple audio level meter (best-effort)
      try {
        const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as any;
        audioContextRef.current = new AudioCtx();
        const src = audioContextRef.current!.createMediaStreamSource(stream as MediaStream);
        analyserRef.current = audioContextRef.current!.createAnalyser();
        analyserRef.current!.fftSize = 256;
        src.connect(analyserRef.current!);
        const tick = () => {
          if (!analyserRef.current) return;
          const data = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(data);
          const level = data.reduce((a, b) => a + b, 0) / data.length;
          setAudioLevel(level || 0);
          animationFrameRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {}

      mr.start(800);
      setRecording(true);
      transcriptRef.current = '';

      let seconds = 0;
      if (timerRef.current) clearInterval(timerRef.current as any);
      timerRef.current = setInterval(() => {
        seconds += 1;
        setDuration(seconds);
      }, 1000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start recording';
      setRecorderError(message);
      console.error('Recording error:', error);
    }
  };

  const stopRecording = async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      const mediaRecorder = mediaRecorderRef.current;
      mediaRecorder.onstop = async () => {
        // If no chunks collected yet, ask MediaRecorder to emit buffered data and wait briefly.
        if (audioChunksRef.current.length === 0 && mediaRecorder && mediaRecorder.state !== 'inactive') {
          try {
            mediaRecorder.requestData();
            // Wait a short time for ondataavailable to run and push chunks
            await new Promise((r) => setTimeout(r, 800));
          } catch {}
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/webm;codecs=opus',
        });

        // Attempt a final full transcription of the entire recording, but do not
        // blindly overwrite the accumulated per-chunk transcript. Prefer the
        // assembled persisted transcript (from per-chunk uploads) when available
        // because final large-blob transcription can fail or be truncated by the
        // provider for very long recordings.
        let finalText: string | null = null;
        try {
          finalText = await transcribeAudio(audioBlob, recorder.language, {
            softFail: true,
          });
        } catch (err) {
          console.error('Final transcription error:', err);
          finalText = null;
        }
        // Send any remaining rotated chunk to server as final
        try {
          if (rotateFuncRef.current) {
            await rotateFuncRef.current(true);
          }
        } catch (e) {
          console.debug('Final rotate/send failed', e);
        }
        // Reconstruct the best-available transcript: prefer persisted per-chunk
        // transcripts (they are saved as chunks complete), fall back to finalText
        // if no persisted content exists, otherwise merge if finalText is longer.
        try {
          const persisted = await readPersistedTranscript(sessionIdRef.current);
          const cleanedFinal = finalText ? String(finalText).trim() : '';
          let chosen = '';
          if (persisted && persisted.length > 0) {
            // If final transcription produced extra unique content, append it.
            if (cleanedFinal && cleanedFinal.length > persisted.length + 20) {
              // If final is substantially longer, use it; otherwise keep persisted.
              chosen = cleanedFinal;
            } else {
              chosen = persisted;
            }
          } else if (cleanedFinal) {
            chosen = cleanedFinal;
          }

          if (chosen) {
            transcriptRef.current = chosen.trim();
            setTranscript(transcriptRef.current);
            // Mark all chunks as processed
            processedChunksRef.current = audioChunksRef.current.length;
            setProcessedChunks(processedChunksRef.current);
          }
        } catch (e) {
          // ignore reconstruction errors
        }
        // Clear rotate timer
        try {
          if (rotateTimerRef.current) {
            clearInterval(rotateTimerRef.current);
            rotateTimerRef.current = null;
          }
        } catch {}
        
        resolve(audioBlob);
      };

      mediaRecorder.stop();
      setRecording(false);
      setIsLiveTranscribing(false);
      setLiveStatus('idle');
      setAudioLevel(0);

      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.onend = null;
          speechRecognitionRef.current.stop();
        } catch {
          // no-op
        }
        speechRecognitionRef.current = null;
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }

      analyserRef.current = null;

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (rotateTimerRef.current) {
        clearInterval(rotateTimerRef.current);
        rotateTimerRef.current = null;
      }
    });
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }

      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.onend = null;
          speechRecognitionRef.current.stop();
        } catch {
          // no-op
        }
      }
    };
  }, []);

  // If user hides the tab or navigates away, try to flush MediaRecorder data so we don't lose chunks.
  useEffect(() => {
    const onVisibilityChange = () => {
      try {
        if (document.hidden) {
          // Ask the recorder to emit any buffered data immediately
          mediaRecorderRef.current?.requestData();
          // Also attempt a rotation flush (non-final) so server gets recent audio
          void rotateFuncRef.current?.(false);
        }
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onVisibilityChange as any);

    return () => {
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onVisibilityChange as any);
    };
  }, []);

  // Retry worker: periodically attempt to resend failed chunks stored in IndexedDB
  let _running = false;
  const processQueue = async () => {
    if (_running) return;
    if (!navigator.onLine) return;
    _running = true;
    setRetrying(true);
    try {
      let items = await getAllFailedChunks();
      // Elimina automáticamente cada grupo de 5 chunks fallidos
      if (items.length >= 5) {
        const toDelete = items.slice(0, Math.floor(items.length / 5) * 5);
        for (const chunk of toDelete) {
          await deleteFailedChunk(chunk.id);
        }
        items = await getAllFailedChunks();
      }
      setQueuedCount(items.length || 0);
      for (const item of items) {
        try {
          // Validate queued item before attempting to resend
          if (!item || !item.blob) {
            console.warn('processQueue: invalid queued item, deleting', item?.id);
            await deleteFailedChunk(item.id);
            continue;
          }

          if (item.blob.size === 0) {
            console.warn('processQueue: queued blob empty, deleting', item.id);
            await deleteFailedChunk(item.id);
            continue;
          }

          const form = new FormData();
          form.append('audio', item.blob, `retry_${item.sessionId}_${item.chunkIndex}.webm`);
          form.append('sessionId', item.sessionId || '');
          form.append('chunkIndex', String(item.chunkIndex));
          form.append('final', item.final ? '1' : '0');
          form.append('language', item.language || recorder.language);

          const resp = await fetch('/api/transcribe-chunk', { method: 'POST', body: form });
          if (resp.ok) {
            const payload = await resp.json();
            const text = payload.text || '';
            if (text && text.trim()) {
              transcriptRef.current = `${transcriptRef.current} ${text.trim()}`.trim();
              setTranscript(transcriptRef.current);
            }
            await deleteFailedChunk(item.id);
            const remaining = await getAllFailedChunks();
            setQueuedCount(remaining.length || 0);
          }
        } catch (e) {
          // leave in queue for next attempt
        }
      }
    } catch (e) {
      // ignore
    } finally {
      setRetrying(false);
      _running = false;
    }
  };

  useEffect(() => {
    // Do not automatically resend queued audio to avoid unexpected transcription
    // (and token usage). Only update the queued count here. Use `triggerRetry()`
    // to manually send queued items when the user explicitly requests it.
    (async () => {
      try {
        const items = await getAllFailedChunks();
        setQueuedCount(items.length || 0);
      } catch (e) {
        // ignore
      }
    })();

    return () => {
      // no-op
    };
  }, [recorder.language]);

  // Expose clearQueue and sessionId via the returned API
  const clearQueue = async (forSessionId?: string) => {
    try {
      await clearFailedChunksBySession(forSessionId);
    } catch (e) {
      try {
        const items = await getAllFailedChunks();
        for (const it of items) {
          if (!forSessionId || it.sessionId === forSessionId) {
            await deleteFailedChunk(it.id);
          }
        }
      } catch {}
    }
    try {
      const all = await getAllFailedChunks();
      setQueuedCount(all.length || 0);
    } catch {}
  };

  return {
    startRecording,
    stopRecording,
    isRecording: recorder.isRecording,
    duration: recorder.duration,
    error: recorder.error,
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
    queuedCount,
    retrying,
    triggerRetry: processQueue,
    refreshQueue: async () => {
      try {
        const items = await getAllFailedChunks();
        setQueuedCount(items.length || 0);
      } catch {}
    },
    clearQueue,
    sessionId: sessionIdRef.current,
    reconstructPersistedTranscript: () => readPersistedTranscript(sessionIdRef.current),
    reconstructPersistedTranscriptDetails: () => readPersistedTranscriptDetails(sessionIdRef.current),
  };
}

/**
 * Hook for managing sessions
 */
export function useSessions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    sessions,
    currentSession,
    setSessions,
    setCurrentSession,
    addSession,
    updateSession,
  } = useAppStore();

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sessions');
      if (!response.ok) throw new Error('Failed to fetch sessions');
      const data = await response.json();
      const apiSessions = data.sessions || [];
      // If API returns nothing (in-memory server), try client-side fallback
      if ((!apiSessions || apiSessions.length === 0) && typeof window !== 'undefined') {
        try {
          const stored = window.localStorage.getItem('local_sessions');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              setSessions(parsed);
              setLoading(false);
              setError(null);
              return;
            }
          }
        } catch (e) {
          console.warn('Failed to parse local_sessions', e);
        }
      }

      setSessions(apiSessions);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const createSession = async (sessionData: any) => {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData),
      });

      if (!response.ok) throw new Error('Failed to create session');

      const data = await response.json();
      addSession(data.session);
      setCurrentSession(data.session);
      // Mirror to localStorage as fallback for persistence across reloads
      try {
        const existing = typeof window !== 'undefined' ? window.localStorage.getItem('local_sessions') : null;
        const list = existing ? JSON.parse(existing) : [];
        list.unshift(data.session);
        if (typeof window !== 'undefined') window.localStorage.setItem('local_sessions', JSON.stringify(list));
      } catch (e) {
        console.warn('Failed to write local_sessions', e);
      }
      setError(null);
      return data.session;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Create error:', err);
      throw err;
    }
  };

  const updateSessionData = async (sessionId: string, updates: any) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        // If server reports not found (e.g., in-memory store lost), fallback to local update
        if (response.status === 404) {
          console.warn('Update API returned 404 — falling back to local update for session', sessionId);
          const fallback = { ...(sessions.find(s => s.id === sessionId) || {}), ...updates, id: sessionId, updatedAt: new Date().toISOString() } as any;
          updateSession(fallback);
          setCurrentSession(fallback);
          try {
            if (typeof window !== 'undefined') {
              const existing = window.localStorage.getItem('local_sessions');
              const list = existing ? JSON.parse(existing) as any[] : [];
              const idx = list.findIndex((s) => s.id === sessionId);
              if (idx !== -1) { list[idx] = fallback; } else { list.unshift(fallback); }
              window.localStorage.setItem('local_sessions', JSON.stringify(list));
            }
          } catch (e) {
            console.warn('Failed to sync fallback update to local_sessions', e);
          }
          setError(null);
          return fallback;
        }

        throw new Error('Failed to update session');
      }

      const data = await response.json();
      updateSession(data.session);
      setCurrentSession(data.session);
      // Update localStorage fallback
      try {
        if (typeof window !== 'undefined') {
          const existing = window.localStorage.getItem('local_sessions');
          if (existing) {
            const list = JSON.parse(existing) as any[];
            const idx = list.findIndex((s) => s.id === data.session.id);
            if (idx !== -1) {
              list[idx] = data.session;
              window.localStorage.setItem('local_sessions', JSON.stringify(list));
            }
          }
        }
      } catch (e) {
        console.warn('Failed to sync updated session to local_sessions', e);
      }
      setError(null);
      return data.session;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Update error:', err);
      throw err;
    }
  };

  const deleteSessionData = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Server doesn't know this session (in-memory dev server). Fallback to local removal.
          console.warn('Delete API returned 404 — performing local delete fallback for', sessionId);
          setSessions(sessions.filter((s) => s.id !== sessionId));
          if (currentSession?.id === sessionId) {
            setCurrentSession(null);
          }
          try {
            if (typeof window !== 'undefined') {
              const existing = window.localStorage.getItem('local_sessions');
              if (existing) {
                const list = JSON.parse(existing) as any[];
                const filtered = list.filter((s) => s.id !== sessionId);
                window.localStorage.setItem('local_sessions', JSON.stringify(filtered));
              }
            }
          } catch (e) {
            console.warn('Failed to remove session from local_sessions during fallback delete', e);
          }
          setError(null);
          return;
        }

        throw new Error('Failed to delete session');
      }

      // Remove from store on success
      setSessions(sessions.filter((s) => s.id !== sessionId));
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
      }
      // Remove from localStorage fallback
      try {
        if (typeof window !== 'undefined') {
          const existing = window.localStorage.getItem('local_sessions');
          if (existing) {
            const list = JSON.parse(existing) as any[];
            const filtered = list.filter((s) => s.id !== sessionId);
            window.localStorage.setItem('local_sessions', JSON.stringify(filtered));
          }
        }
      } catch (e) {
        console.warn('Failed to remove session from local_sessions', e);
      }
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Delete error:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  return {
    sessions,
    currentSession,
    loading,
    error,
    fetchSessions,
    createSession,
    updateSessionData,
    deleteSessionData,
    setCurrentSession,
  };
}
