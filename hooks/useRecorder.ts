import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { transcribeAudio } from '@/lib/utils';

/**
 * Hook for handling audio recording with MediaRecorder API
 */
export function useAudioRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const processedChunksRef = useRef<number>(0);
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
      setSessions(data.sessions || []);
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

      if (!response.ok) throw new Error('Failed to update session');

      const data = await response.json();
      updateSession(data.session);
      setCurrentSession(data.session);
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

      if (!response.ok) throw new Error('Failed to delete session');

      // Remove from store
      setSessions(sessions.filter((s) => s.id !== sessionId));
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
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
