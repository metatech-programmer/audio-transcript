import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { transcribeAudio, generateId } from '@/lib/utils';
import { saveFailedChunk, getAllFailedChunks, deleteFailedChunk, clearFailedChunksBySession } from '@/lib/idb';

/**
 * Hook for handling audio recording with MediaRecorder API
 */
export function useAudioRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const processedChunksRef = useRef<number>(0);
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


  /**
   * Inicia la grabación, permitiendo pasar un stream personalizado (mic, tab, system)
   */
  const startRecording = async (
    options?: {
      engineMode?: 'auto' | 'browser' | 'api';
      dialect?: string;
      stream?: MediaStream;
    }
  ) => {
    try {
      setRecorderError(null);
      const engineMode = options?.engineMode || liveEngineMode;
      const dialect =
        options?.dialect ||
        selectedDialect ||
        (recorder.language === 'es' ? 'es-ES' : 'en-US');

      setLiveEngineMode(engineMode);
      setSelectedDialect(dialect);

      const SpeechRecognitionClass =
        typeof window !== 'undefined'
          ? (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition
          : null;

      isBrowserLiveRef.current =
        engineMode === 'browser'
          ? Boolean(SpeechRecognitionClass)
          : engineMode === 'api'
          ? false
          : Boolean(SpeechRecognitionClass);

      if (engineMode === 'browser' && !SpeechRecognitionClass) {
        setRecorderError('Browser Speech no esta disponible. Usando API fallback.');
      }

      setLiveEngine(isBrowserLiveRef.current ? 'browser' : 'api');

      // Permitir pasar un stream personalizado (mic, tab, system)
      let stream: MediaStream;
      if (options?.stream) {
        stream = options.stream;
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      }

      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setLiveStatus('listening');
      setLastChunkText('');
      setProcessedChunks(0);

      // initialize session ID and rotation pointer
      sessionIdRef.current = generateId();
      lastRotateIndexRef.current = 0;

      // Define rotation/send function (chunked uploader) and store on ref so stopRecording can call it
      rotateFuncRef.current = async (final: boolean) => {
        try {
          const start = lastRotateIndexRef.current || 0;
          const end = audioChunksRef.current.length;
          if (end <= start) return;

          // Maximum batch size: 3 MB to avoid serverless payload limits
          const MAX_BYTES = 3 * 1024 * 1024;

          // Helper to persist transcript piece to localStorage (same shape as before)
          const persistTranscript = (idx: number, text: string, status = 'done') => {
            try {
              const key = `session:${sessionIdRef.current}`;
              const raw = localStorage.getItem(key);
              const parsed = raw ? JSON.parse(raw) : { sessionId: sessionIdRef.current, transcripts: [] };
              parsed.transcripts = parsed.transcripts || [];
              parsed.transcripts.push({ index: idx, text, createdAt: new Date().toISOString(), status });
              localStorage.setItem(key, JSON.stringify(parsed));
            } catch {}
          };

          // Ensure sessionId exists
          if (!sessionIdRef.current) {
            console.warn('rotateFunc: missing sessionId — generating temporary id');
            sessionIdRef.current = String(Date.now());
          }

          // Build and send batches without exceeding MAX_BYTES
          let batch: Blob[] = [];
          let batchSize = 0;
          let batchStartIndex = start;

          const flushBatch = async (batchChunks: Blob[], batchStart: number, batchEnd: number, isFinal: boolean) => {
            if (!batchChunks || batchChunks.length === 0) return true;

            // Instead of concatenating chunks into a single Blob (which can
            // produce an invalid container), send each MediaRecorder chunk as
            // its own file to the transcribe endpoint. Queue failed items.
            let anyFailure = false;

            for (let i = 0; i < batchChunks.length; i++) {
              const absIndex = batchStart + i;
              const chunkBlob = batchChunks[i];

              if (!chunkBlob || (chunkBlob as Blob).size === 0) {
                // save marker for empty chunk
                try {
                  await saveFailedChunk({
                    id: `${sessionIdRef.current}:${absIndex}:${Date.now()}:empty`,
                    sessionId: sessionIdRef.current || '',
                    chunkIndex: absIndex,
                    blob: chunkBlob as Blob,
                    final: isFinal,
                    language: recorder.language,
                    createdAt: new Date().toISOString(),
                  } as any);
                  const all = await getAllFailedChunks();
                  setQueuedCount(all.length || 0);
                } catch {
                  persistTranscript(absIndex, '', 'failed-empty');
                }
                anyFailure = true;
                continue;
              }

              const form = new FormData();
              form.append('audio', chunkBlob as Blob, `chunk_${absIndex}.webm`);
              form.append('sessionId', sessionIdRef.current || '');
              form.append('chunkIndex', String(absIndex));
              form.append('final', isFinal && i === batchChunks.length - 1 ? '1' : '0');
              form.append('language', recorder.language);

              try {
                const resp = await fetch('/api/transcribe-chunk', { method: 'POST', body: form });
                if (resp.ok) {
                  const payload = await resp.json();
                  const text = payload.text || '';
                  persistTranscript(absIndex, text, 'done');
                  if (text && text.trim()) {
                    transcriptRef.current = `${transcriptRef.current} ${text.trim()}`.trim();
                    setTranscript(transcriptRef.current);
                  }
                  // advance rotation pointer to after this chunk
                  lastRotateIndexRef.current = Math.max(lastRotateIndexRef.current, absIndex + 1);
                  setProcessedChunks(lastRotateIndexRef.current);
                  continue;
                }

                // non-ok response -> queue for retry
                const errText = await resp.text().catch(() => '');
                try {
                  await saveFailedChunk({
                    id: `${sessionIdRef.current}:${absIndex}:${Date.now()}`,
                    sessionId: sessionIdRef.current || '',
                    chunkIndex: absIndex,
                    blob: chunkBlob as Blob,
                    final: isFinal && i === batchChunks.length - 1,
                    language: recorder.language,
                  } as any);
                  const all = await getAllFailedChunks();
                  setQueuedCount(all.length || 0);
                } catch (e) {
                  persistTranscript(absIndex, '', 'failed');
                }
                console.warn('Chunk upload failed:', resp.status, errText);
                anyFailure = true;
                continue;
              } catch (e) {
                // Network or fetch error -> queue for retry
                try {
                  await saveFailedChunk({
                    id: `${sessionIdRef.current}:${absIndex}:${Date.now()}`,
                    sessionId: sessionIdRef.current || '',
                    chunkIndex: absIndex,
                    blob: chunkBlob as Blob,
                    final: isFinal && i === batchChunks.length - 1,
                    language: recorder.language,
                  } as any);
                  const all = await getAllFailedChunks();
                  setQueuedCount(all.length || 0);
                } catch {
                  persistTranscript(absIndex, '', 'failed');
                }
                console.debug('Chunk upload exception', e);
                anyFailure = true;
                continue;
              }
            }

            return !anyFailure;
          };

          for (let i = start; i < end; i++) {
            const chunk = audioChunksRef.current[i];
            // Defensive: skip any missing chunks to avoid pushing `undefined` into batch
            if (!chunk) {
              // Advance pointer if holes exist
              batchStartIndex = Math.max(batchStartIndex, i + 1);
              continue;
            }

            const size = (chunk as Blob).size || 0;

            // If adding this chunk would exceed MAX_BYTES and we have a batch to send, flush first
            if (batchSize + size > MAX_BYTES && batch.length > 0) {
              const batchEnd = i; // exclusive
              const ok = await flushBatch(batch, batchStartIndex, batchEnd, false);
              if (!ok) {
                // stop attempting further batches for now
                return;
              }
              // reset batch
              batch = [];
              batchSize = 0;
              batchStartIndex = i;
            }

            batch.push(chunk as Blob);
            batchSize += size;
          }

          // flush remaining batch
          if (batch.length > 0) {
            const batchEnd = end;
            await flushBatch(batch, batchStartIndex, batchEnd, final);
          }
        } catch (err) {
          console.debug('rotateAndSendChunk (chunked) error', err);
        }
      };

      // Start rotation timer: flush regularly (30s) to keep chunk sizes small
      rotateTimerRef.current = setInterval(() => {
        void rotateFuncRef.current?.(false);
      }, 30 * 1000);

      // Setup microphone level meter for real-time user feedback.
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateAudioLevel = () => {
        if (!analyserRef.current) {
          return;
        }

        analyserRef.current.getByteTimeDomainData(dataArray);

        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i += 1) {
          const sample = dataArray[i] ?? 128;
          const normalized = (sample - 128) / 128;
          sumSquares += normalized * normalized;
        }

        const rms = Math.sqrt(sumSquares / dataArray.length);
        const level = Math.min(100, Math.round(rms * 220));
        setAudioLevel(level);

        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };

      updateAudioLevel();

      if (SpeechRecognitionClass && isBrowserLiveRef.current) {
        const recognition = new SpeechRecognitionClass();
        recognition.lang = dialect;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setLiveStatus('transcribing');
        };

        recognition.onresult = (event: any) => {
          let combined = '';
          for (let i = 0; i < event.results.length; i += 1) {
            const segment = event.results[i]?.[0]?.transcript || '';
            combined += `${segment} `;
          }

          const text = combined.trim();
          if (text) {
            transcriptRef.current = text;
            setTranscript(text);
            setLastChunkText(text.split(/\s+/).slice(-8).join(' '));
            setProcessedChunks((count) => count + 1);
            setLiveStatus('updated');
          }
        };

        recognition.onerror = () => {
          setLiveStatus('listening');
        };

        recognition.onend = () => {
          if (useAppStore.getState().recorder.isRecording) {
            try {
              recognition.start();
            } catch {
              setLiveStatus('listening');
            }
          }
        };

        speechRecognitionRef.current = recognition;
        try {
          recognition.start();
        } catch {
          speechRecognitionRef.current = null;
          isBrowserLiveRef.current = false;
          setLiveEngine('api');
        }
      }

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);

          if (isBrowserLiveRef.current) {
            return;
          }

          // Skip if another chunk is still in-flight to avoid overlapping requests.
          if (isChunkTranscribingRef.current) {
            return;
          }

          isChunkTranscribingRef.current = true;
          setIsLiveTranscribing(true);
          setLiveStatus('transcribing');

          // Transcribe only the new/unprocessed chunks to avoid overlapping text.
          try {
            const startIndex = processedChunksRef.current;
            const newChunks = audioChunksRef.current.slice(startIndex);
            if (newChunks.length === 0) {
              isChunkTranscribingRef.current = false;
              setIsLiveTranscribing(false);
              setLiveStatus('listening');
              return;
            }

            const payload = new Blob(newChunks, {
              type: 'audio/webm',
            });

            const chunkText = await transcribeAudio(payload, recorder.language, {
              softFail: true,
            });

            if (chunkText && chunkText.trim()) {
              // Append new chunk text to the running transcript.
              transcriptRef.current = `${transcriptRef.current} ${chunkText.trim()}`.trim();
              setTranscript(transcriptRef.current);
              setLastChunkText(
                transcriptRef.current.split(/\s+/).slice(-8).join(' ')
              );
              // Mark all of the new chunks as processed.
              processedChunksRef.current = audioChunksRef.current.length;
              setProcessedChunks(processedChunksRef.current);
              setLiveStatus('updated');
            } else {
              setLiveStatus('listening');
            }
          } catch (err) {
            // Keep this soft to avoid noisy console while recording.
            console.debug('Real-time transcription skipped:', err);
            // Continue recording even if chunk transcription fails
            setLiveStatus('listening');
          } finally {
            isChunkTranscribingRef.current = false;
            setIsLiveTranscribing(false);
          }
        }
      };

      mediaRecorder.onerror = (event) => {
        setRecorderError(`Recording error: ${event.error}`);
      };

      mediaRecorder.start(2000); // Capture data every 2 seconds for more stable chunks
      setRecording(true);
      transcriptRef.current = ''; // Reset transcript for new recording

      // Start timer
      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds += 1;
        setDuration(seconds);
      }, 1000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to start recording';
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
          type: 'audio/webm',
        });

        // Always attempt a final full transcription of the entire recording so
        // the saved transcript covers from second 0 until the end.
        try {
          const finalText = await transcribeAudio(audioBlob, recorder.language, {
            softFail: true,
          });
          if (finalText && finalText.trim()) {
            transcriptRef.current = finalText.trim();
            setTranscript(transcriptRef.current);
            // Mark all chunks as processed
            processedChunksRef.current = audioChunksRef.current.length;
            setProcessedChunks(processedChunksRef.current);
          }
        } catch (err) {
          console.error('Final transcription error:', err);
        }
        // Send any remaining rotated chunk to server as final
        try {
          if (rotateFuncRef.current) {
            await rotateFuncRef.current(true);
          }
        } catch (e) {
          console.debug('Final rotate/send failed', e);
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
      const items = await getAllFailedChunks();
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
