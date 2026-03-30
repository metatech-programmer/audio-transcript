"use client";

import React, { useEffect, useState } from "react";
import {
  BookOpen,
  Mic,
  Eye,
  Target,
  PlusCircle,
  AlertCircle,
  Square,
  Settings,
} from "lucide-react";
import SettingsModal from "@/components/SettingsModal";
import { formatDuration } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { useSessions } from "@/hooks/useRecorder";
import SessionHistory from "@/components/SessionHistory";
import RecorderComponent from "@/components/RecorderComponent";
import ToastContainer from "@/components/ToastContainer";
import type { Session } from "@/lib/types";
import SessionDetail from "@/components/SessionDetail";

export default function Home() {
  const [view, setView] = useState<"recorder" | "session">("recorder");
  const [showMobileList, setShowMobileList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [mounted, setMounted] = useState(false);

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

  const { recorder } = useAppStore();

  useEffect(() => {
    setMounted(true);
    const initializeSessions = async () => {
      try {
        await fetchSessions();
      } catch (err) {
        console.error("Failed to load sessions:", err);
      } finally {
        setLoadingInitial(false);
      }
    };

    initializeSessions();
  }, []);

  const handleCreateNew = async () => {
    setView("recorder");
    setCurrentSession(null);
  };

  const handleSessionSaved = (session: Session) => {
    setCurrentSession(session);
    setView("session");
  };

  const handleSelectSession = (session: Session) => {
    setCurrentSession(session);
    setView("session");
  };

  const handleUpdateSession = async (session: Session) => {
    await updateSessionData(session.id, session);
  };

  const handleDeleteSession = async (sessionId: string) => {
    await deleteSessionData(sessionId);
  };

  return (
    <main className="flex min-h-screen w-screen bg-[#FBFBFC]">
      {/* Sidebar */}
      <div className="hidden lg:flex lg:w-72 lg:flex-col bg-[#F5F5F6] border-r border-[#EAEAEB] shadow-sm shrink-0">
        <div className="sticky top-0 z-20 px-5 py-4 border-b border-[#EAEAEB] flex items-center justify-between">
          <div className="flex gap-2 items-center">
            <BookOpen size={18} className="text-slate-800" />
            <span className="text-[15px] font-semibold text-slate-800 tracking-tight">
              StudyBuddy
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              title="Ajustes"
              className="p-2 rounded hover:bg-slate-100"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto w-full">
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
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile/Tablet Header */}
        <div className="lg:hidden sticky top-0 z-20 border-b border-[#EAEAEB] bg-white/80 backdrop-blur-md">
          <div className="flex items-center justify-between px-3 py-3">
            <h1 className="text-[15px] font-semibold tracking-tight text-slate-800 flex items-center gap-2">
              <BookOpen size={18} className="text-slate-800" />
              StudyBuddy
            </h1>
            <nav role="tablist" aria-label="Main navigation" className="flex gap-2">
              <button
                onClick={() => setShowSettings(true)}
                className="min-w-[44px] px-3 py-2 rounded-md font-medium text-[14px] transition flex items-center justify-center gap-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                title="Ajustes"
              >
                <Settings size={16} />
              </button>
              <button
                role="tab"
                aria-pressed={view === "recorder"}
                aria-current={view === "recorder" ? "true" : undefined}
                onClick={handleCreateNew}
                className={`min-w-[88px] px-4 py-2 rounded-md font-medium text-[14px] transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                  view === "recorder"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Mic size={16} />
                Record
              </button>
              <button
                role="tab"
                aria-pressed={view === "session"}
                aria-current={view === "session" && currentSession ? "true" : undefined}
                onClick={() => {
                  setView("session");
                  setShowMobileList(true);
                }}
                className={`min-w-[88px] px-4 py-2 rounded-md font-medium text-[14px] transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                  view === "session"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Eye size={16} />
                Sessions
              </button>
            </nav>
          </div>
        </div>

        {/* Mobile modal: show session list */}
        {showMobileList && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b">
                <h3 className="text-sm font-semibold">Grabaciones</h3>
                <button onClick={() => setShowMobileList(false)} className="px-2 py-1 text-sm">
                  Cerrar
                </button>
              </div>
              <div className="p-3 max-h-[70vh] overflow-y-auto">
                <SessionHistory
                  sessions={sessions}
                  currentSession={currentSession}
                  onSelectSession={(s) => {
                    setShowMobileList(false);
                    handleSelectSession(s);
                  }}
                  onDeleteSession={handleDeleteSession}
                  onCreateNew={handleCreateNew}
                />
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-white rounded-tl-xl border-l border-t border-[#EAEAEB] mt-0 lg:mt-2 lg:ml-0 lg:mr-2 lg:mb-2 shadow-sm">
          {loadingInitial ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600 font-medium">Cargando sesiones...</p>
              </div>
            </div>
          ) : (
            <>
              {view === "recorder" ? (
                <RecorderComponent
                  onCreateSession={createSession}
                  onSessionSaved={handleSessionSaved}
                />
              ) : currentSession ? (
                <SessionDetail
                  session={currentSession}
                  onUpdate={handleUpdateSession}
                  onBack={() => setView("recorder")}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[500px]">
                  <div className="text-center max-w-sm px-6">
                    <div className="mb-6 flex justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-[#F5F5F6] flex items-center justify-center border border-[#EAEAEB] shadow-sm">
                        <Target size={24} className="text-slate-400" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      No hay grabación seleccionada
                    </h3>
                    <p className="text-[14px] text-slate-500 mb-8">
                      Selecciona una grabación existente desde la barra lateral o inicia una nueva
                      para comenzar a capturar notas.
                    </p>
                    <button
                      onClick={handleCreateNew}
                      className="inline-flex items-center gap-2 rounded-md bg-slate-900 text-white px-5 py-2.5 text-[14px] font-medium hover:bg-slate-800 transition-colors shadow-sm"
                    >
                      <PlusCircle size={16} />
                      Nueva grabación
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
            <p className="text-red-800 text-sm font-medium flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </p>
          </div>
        )}
      </div>
      <ToastContainer />
      {/* Persistent recorder pill rendered in layout via PersistentRecorderHost; removed duplicate large pill here. */}
      {showSettings && <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />}
    </main>
  );
}
