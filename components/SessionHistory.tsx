"use client";

import React, { useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import type { Session } from "@/lib/types";

interface SessionHistoryProps {
  sessions: Session[];
  currentSession: Session | null;
  onSelectSession: (session: Session) => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onCreateNew: () => void;
}

interface SubjectGroupProps {
  subject: string;
  items: Session[];
  currentSession: Session | null;
  onSelectSession: (s: Session) => void;
  onDeleteRequest?: (id: string, e: React.MouseEvent) => void;
}

function SubjectGroup({ subject, items, currentSession, onSelectSession, onDeleteRequest }: SubjectGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="border rounded-md bg-white">
      <div className="px-3 py-2 flex items-center justify-between cursor-pointer" onClick={() => setCollapsed((c) => !c)}>
        <div className="flex items-center gap-2">
          <strong className="text-sm">{subject}</strong>
          <span className="text-xs text-slate-500">{items.length}</span>
        </div>
        <div className="text-sm text-slate-500">{collapsed ? "Mostrar" : "Ocultar"}</div>
      </div>
      {!collapsed && (
        <div className="divide-y">
          {items.map((session: Session) => (
            <div
              key={session.id}
              onClick={() => onSelectSession(session)}
              className={`group relative flex flex-col p-3 cursor-pointer transition-colors ${
                currentSession?.id === session.id ? "bg-white shadow-sm ring-1 ring-[#EAEAEB]" : "border border-transparent hover:bg-[#EAEAEB]/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-800">{session.title || 'Grabación'}</div>
                  <div className="text-xs text-slate-500">{formatDate(session.createdAt)}</div>
                </div>
                <button onClick={(e) => onDeleteRequest?.(session.id, e)} className="p-2 rounded hover:bg-red-50 text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SessionHistory({ sessions, currentSession, onSelectSession, onDeleteSession, onCreateNew }: SessionHistoryProps) {
  const { addToast } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const allTags = Array.from(new Set(sessions.flatMap((s: Session) => s.tags || []))) as string[];

  const filteredSessions: Session[] = sessions.filter((session: Session) => {
    const matchesSearch = (session.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (session.transcript || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTags = selectedTags.length === 0 || selectedTags.some((tag) => (session.tags || []).includes(tag));
    return matchesSearch && matchesTags;
  });

  const handleDeleteRequest = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeleteId(sessionId);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;
    const sessionId = pendingDeleteId;
    setIsDeleting(sessionId);
    try {
      await onDeleteSession(sessionId);
      addToast('success', 'Grabación eliminada correctamente.');
      setPendingDeleteId(null);
    } catch (error) {
      console.error('Delete session failed:', error);
      addToast('error', 'No se pudo eliminar la grabación. Intenta de nuevo.');
    } finally {
      setIsDeleting(null);
    }
  };

  // Group by subject
  const groups: Record<string, Session[]> = {};
  filteredSessions.forEach((s: Session) => {
    const key = s.subject || 'Sin clasificar';
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  return (
    <div className="w-full flex-col h-full bg-transparent">
      <div className="px-5 py-4 border-b border-[#EAEAEB] bg-white">
        <button onClick={onCreateNew} className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 text-[13px] font-medium transition-colors shadow-sm">
          Nueva grabación
        </button>

        <div className="relative group">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Buscar grabaciones..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-[#F9F9FA] border border-transparent rounded-md text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white" />
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="px-5 py-3 border-b border-[#EAEAEB] bg-[#F9F9FA]/50">
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => (
              <button key={tag} onClick={() => setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border ${selectedTags.includes(tag) ? 'bg-slate-800 text-white border-slate-800 shadow-sm' : 'bg-white text-slate-600 border-[#EAEAEB]'}`}>
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-6 px-2 py-2 space-y-3">
        {filteredSessions.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-500">
            <p className="text-[13px]">{sessions.length === 0 ? 'No hay grabaciones todavía' : 'No hay coincidencias'}</p>
          </div>
        ) : (
          Object.entries(groups).map(([subject, items]) => (
            <SubjectGroup key={subject} subject={subject} items={items} currentSession={currentSession} onSelectSession={onSelectSession} onDeleteRequest={handleDeleteRequest} />
          ))
        )}
      </div>

      {pendingDeleteId && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-lg">
            <h3 className="mb-2 text-base font-semibold text-slate-900">¿Eliminar grabación?</h3>
            <p className="mb-4 text-sm text-slate-600">Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPendingDeleteId(null)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancelar</button>
              <button type="button" onClick={handleConfirmDelete} disabled={!!isDeleting} className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">{isDeleting ? 'Eliminando...' : 'Eliminar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
