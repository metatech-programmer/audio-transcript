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
    <div className="flex h-screen overflow-hidden bg-transparent">
      {/* Sidebar */}
      <div className="hidden md:block w-80">
        <SessionHistory
          sessions={sessions}
          currentSession={currentSession}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onCreateNew={handleCreateNew}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden border-b border-white/70 bg-white/80 p-4 backdrop-blur-sm flex gap-2">
          <button
            onClick={handleCreateNew}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              view === 'recorder'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            Grabar
          </button>
          <button
            onClick={() => setView('session')}
            disabled={!currentSession}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              view === 'session' && currentSession
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50'
            }`}
          >
            Ver
          </button>
        </div>

        {/* Content Area */}
        {loadingInitial ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-600 font-medium">Loading sessions...</p>
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
                <div className="text-center">
                  <p className="mb-4 font-medium text-slate-600">
                    Aun no seleccionaste una sesion
                  </p>
                  <button
                    onClick={handleCreateNew}
                    className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition hover:bg-blue-700"
                  >
                    Crear nueva grabacion
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Error Notification */}
        {error && (
          <div className="absolute bottom-4 right-4 max-w-sm p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
      </div>
      <ToastContainer />
    </div>
  );
}
