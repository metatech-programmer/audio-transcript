"use client";

import React, { useEffect, useState } from "react";
import { Square, Mic, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAudioRecorder } from "@/hooks/useRecorder";

declare global {
  interface Window {
    __recorderController?: any;
  }
}

export default function PersistentRecorderHost() {
  const router = useRouter();
  // Create a local instance of the recorder hook and attach to window for sharing
  const controller = useAudioRecorder() as any;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // expose singleton controller so RecorderComponent can reuse the same instance
    if (!window.__recorderController) {
      window.__recorderController = controller;
    }
    setMounted(true);
    return () => {
      // do not remove controller on unmount to avoid losing state across HMR,
      // but if it points to this instance, clear it
      if (window.__recorderController === controller) {
        // keep it — we want persistence across navigations
      }
    };
    // Intentionally run only once
  }, []);

  if (!mounted) return null;

  const isRecording = controller?.isRecording;
  const duration = controller?.duration ?? 0;
  const queued = controller?.queuedCount ?? 0;
  const retrying = controller?.retrying ?? false;

  // Only render the pill when actively recording
  if (!isRecording) return null;

  return (
    <div className="fixed bottom-3 left-1/2 transform -translate-x-1/2 z-50">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600 text-white shadow-lg text-sm">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2"
          aria-label="Volver al grabador"
        >
          <Mic size={14} className="text-white" />
          <span className="font-medium">Rec.</span>
          <span className="ml-1 text-xs opacity-90">
            {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}
          </span>
        </button>

        {queued > 0 && (
          <div className="ml-2 inline-flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-full">
            <RotateCw size={12} className="text-white opacity-90" />
            <span className="text-xs">{queued}</span>
          </div>
        )}

        <button
          onClick={() => {
            try {
              if ((queued || 0) > 0) {
                const ok = window.confirm(
                  `¿Reintentar el envío de ${queued} elemento(s) ahora? Esto puede consumir recursos.`
                );
                if (!ok) return;
              }
              controller?.triggerRetry?.();
            } catch {}
          }}
          title="Reintentar cola"
          disabled={retrying || queued === 0}
          className="ml-1 p-1 rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-50"
        >
          <RotateCw size={12} className="text-white" />
        </button>

        <button
          onClick={() => {
            window.dispatchEvent(new Event("app-stop-recording"));
          }}
          title="Detener grabación"
          className="ml-1 p-1 rounded-full bg-white/20 hover:bg-white/30"
        >
          <Square size={12} className="text-white" />
        </button>
      </div>
    </div>
  );
}
