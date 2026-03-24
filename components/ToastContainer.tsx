'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';

export default function ToastContainer() {
  const { toasts, removeToast } = useAppStore();

  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }

    const timers = toasts.map((toast) =>
      setTimeout(() => {
        removeToast(toast.id);
      }, 3200)
    );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [toasts, removeToast]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => {
        const toneClass =
          toast.type === 'success'
            ? 'border-green-200 bg-green-50 text-green-800'
            : toast.type === 'error'
            ? 'border-red-200 bg-red-50 text-red-800'
            : 'border-blue-200 bg-blue-50 text-blue-800';

        return (
          <div
            key={toast.id}
            className={`rounded-lg border px-4 py-3 text-sm shadow-sm ${toneClass}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p>{toast.text}</p>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-xs font-semibold opacity-80 hover:opacity-100"
                aria-label="Descartar notificación"
              >
                Cerrar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
