'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useSessions } from '@/hooks/useRecorder';
import SessionHistory from '@/components/SessionHistory';
import RecorderComponent from '@/components/RecorderComponent';
import SessionDetail from '@/components/SessionDetail';
import ToastContainer from '@/components/ToastContainer';
import type { Session } from '@/lib/types';

export default function Home() {
  const [view, setView] = useState<'recorder' | 'session'>('recorder');
  const [loadingInitial, setLoadingInitial] = useState(true);

  const {
    sessions,
    currentSession,
    loading,
    error,
    fetchSessions,
    createSession,
    updateSessionData,
    deleteSessionData,
    setCurrentSession,
  } = useSessions();

  useEffect(() => {
    const initializeSessions = async () => {
      try {
        await fetchSessions();
      } catch (err) {
        console.error('Failed to load sessions:', err);
      } finally {
        setLoadingInitial(false);
      }
    };

    initializeSessions();
  }, []);

  const handleCreateNew = async () => {
    setView('recorder');
    setCurrentSession(null);
  };

  const handleSessionSaved = (session: Session) => {
    setCurrentSession(session);
    setView('session');
  };

  const handleSelectSession = (session: Session) => {
    setCurrentSession(session);
    setView('session');
  };

  const handleUpdateSession = async (session: Session) => {
    await updateSessionData(session.id, session);
  };

  const handleDeleteSession = async (sessionId: string) => {
    await deleteSessionData(sessionId);
  };

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      {/* Sidebar */}
      <div className="hidden lg:flex lg:w-80 lg:flex-col bg-white border-r border-slate-200/60 shadow-sm overflow-hidden">
        <div className="sticky top-0 z-20 px-4 py-4 bg-gradient-to-r from-white to-blue-50 border-b border-slate-200/60">
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
            📚 Study Buddy
          </h1>
          <p className="text-xs text-slate-600 mt-1">Tu asistente de notas</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SessionHistory
            sessions={sessions}
            currentSession={currentSession}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            onCreateNew={handleCreateNew}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile/Tablet Header */}
        <div className="lg:hidden sticky top-0 z-20 border-b border-white/70 bg-white/80 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
              📚 Study Buddy
            </h1>
            <div className="flex gap-2">
              <button
                onClick={handleCreateNew}
                className={`px-3 py-1.5 rounded-lg font-medium text-sm transition ${
                  view === 'recorder'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Grabar
              </button>
              <button
                onClick={() => setView('session')}
                disabled={!currentSession}
                className={`px-3 py-1.5 rounded-lg font-medium text-sm transition ${
                  view === 'session' && currentSession
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50'
                }`}
              >
                Ver
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {loadingInitial ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600 font-medium">Cargando sesiones...</p>
              </div>
            </div>
          ) : (
            <>
              {view === 'recorder' ? (
                <RecorderComponent
                  onCreateSession={createSession}
                  onSessionSaved={handleSessionSaved}
                />
              ) : currentSession ? (
                <SessionDetail
                  session={currentSession}
                  onUpdate={handleUpdateSession}
                  onBack={() => setView('recorder')}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center space-y-6">
                    <div>
                      <div className="text-6xl mb-4">🎯</div>
                      <p className="text-lg font-medium text-slate-600 mb-2">
                        Sin sesiones seleccionadas
                      </p>
                      <p className="text-sm text-slate-500">
                        Crea una nueva grabación o selecciona una existente del historial
                      </p>
                    </div>
                    <button
                      onClick={handleCreateNew}
                      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-3 font-semibold text-white shadow-lg hover:shadow-xl hover:scale-105 transition transform"
                    >
                      ✨ Crear nueva grabación
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Error Notification */}
        {error && (
          <div className="absolute bottom-4 right-4 max-w-sm p-4 bg-red-50 border border-red-200 rounded-xl shadow-lg">
            <p className="text-red-800 text-sm font-medium">⚠️ {error}</p>
          </div>
        )}
      </div>
      <ToastContainer />
    </main>
  );
}
