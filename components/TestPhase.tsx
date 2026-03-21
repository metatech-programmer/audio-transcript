'use client';

import React, { useState, useEffect } from 'react';
import { Mic, Volume2, CheckCircle, AlertCircle } from 'lucide-react';

interface TestPhaseProps {
  onTestPassed: () => void;
  onCancel: () => void;
}

export default function TestPhase({ onTestPassed, onCancel }: TestPhaseProps) {
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [micPermission, setMicPermission] = useState<boolean | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    testMicrophone();
  }, []);

  const testMicrophone = async () => {
    setTestStatus('testing');
    setStatusMessage('Solicitando acceso al micrófono...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission(true);
      setStatusMessage('✓ Micrófono accesible');

      // Test audio level
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      const javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

      analyser.smoothingTimeConstant = 0.8;
      analyser.fftSize = 1024;

      microphone.connect(analyser);
      analyser.connect(javascriptNode);
      javascriptNode.connect(audioContext.destination);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let maxLevel = 0;
      let testTime = 0;
      const testDuration = 3000; // 3 seconds

      const testInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(Math.min(100, average / 2.55));
        maxLevel = Math.max(maxLevel, average);
        testTime += 100;

        if (testTime >= testDuration) {
          clearInterval(testInterval);
          stream.getTracks().forEach(track => track.stop());
          audioContext.close();

          if (maxLevel > 10) {
            setTestStatus('success');
            setStatusMessage('✓ Micrófono funcionando correctamente');
            setTimeout(() => {
              onTestPassed();
            }, 1500);
          } else {
            setTestStatus('failed');
            setStatusMessage('✗ Nivel de audio muy bajo. Acerca el micrófono e intenta de nuevo.');
          }
        }
      }, 100);
    } catch (error) {
      setMicPermission(false);
      setTestStatus('failed');
      setStatusMessage('✗ No se pudo acceder al micrófono. Verifica los permisos.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/60 shadow-xl p-8">
        <div className="text-center">
          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <div className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all ${
              testStatus === 'testing' ? 'bg-blue-100 animate-pulse' :
              testStatus === 'success' ? 'bg-emerald-100' :
              testStatus === 'failed' ? 'bg-red-100' :
              'bg-slate-100'
            }`}>
              {testStatus === 'success' ? (
                <CheckCircle size={48} className="text-emerald-600" />
              ) : testStatus === 'failed' ? (
                <AlertCircle size={48} className="text-red-600" />
              ) : (
                <Mic size={48} className="text-indigo-600" />
              )}
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-slate-900 mb-2 flex items-center gap-2 justify-center">
            <Mic size={20} className="text-indigo-600" />
            Verificación de Micrófono
          </h2>

          {/* Subtitle */}
          <p className="text-slate-600 text-sm mb-6">
            Necesitamos verificar que tu micrófono funcione correctamente
          </p>

          {/* Status Message */}
          <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className={`font-medium text-sm ${
              testStatus === 'success' ? 'text-emerald-700' :
              testStatus === 'failed' ? 'text-red-700' :
              testStatus === 'testing' ? 'text-blue-700' :
              'text-slate-600'
            }`}>
              {statusMessage || 'Preparando prueba...'}
            </p>
          </div>

          {/* Audio Level Visualization */}
          {testStatus === 'testing' && (
            <div className="mb-8 space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Volume2 size={16} />
                <span>Nivel de audio detectado:</span>
              </div>

              {/* Level Bar */}
              <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-100 ${
                    audioLevel > 60 ? 'bg-emerald-500' :
                    audioLevel > 30 ? 'bg-amber-500' :
                    'bg-blue-500'
                  }`}
                  style={{ width: `${audioLevel}%` }}
                />
              </div>

              {/* Waveform */}
              <div className="flex items-end justify-center gap-1 h-12 bg-slate-50 rounded-lg border border-slate-200 p-2">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-indigo-500 to-blue-500 rounded-sm transition-all duration-75"
                    style={{
                      height: `${Math.random() * audioLevel}%`,
                      opacity: 0.6 + Math.random() * 0.4,
                    }}
                  />
                ))}
              </div>

              <p className="text-xs text-slate-500">Habla cerca del micrófono...</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            {testStatus !== 'testing' && (
              <>
                <button
                  onClick={onCancel}
                  className="flex-1 px-4 py-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium transition"
                >
                  Cancelar
                </button>

                {testStatus === 'failed' && (
                  <button
                    onClick={testMicrophone}
                    className="flex-1 px-4 py-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium transition"
                  >
                    Intentar de Nuevo
                  </button>
                )}
              </>
            )}

            {testStatus === 'testing' && (
              <div className="w-full h-12 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0s' }} />
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
