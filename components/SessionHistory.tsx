'use client';

import React, { useState } from 'react';
import { Search, Tag, Trash2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { formatDate } from '@/lib/utils';
import type { Session } from '@/lib/types';

interface SessionHistoryProps {
  sessions: Session[];
  currentSession: Session | null;
  onSelectSession: (session: Session) => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onCreateNew: () => void;
}

export default function SessionHistory({
  sessions,
  currentSession,
  onSelectSession,
  onDeleteSession,
  onCreateNew,
}: SessionHistoryProps) {
  const { addToast } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Get all unique tags
  const allTags = Array.from(
    new Set(sessions.flatMap((s) => s.tags))
  ) as string[];

  // Filter sessions
  const filteredSessions = sessions.filter((session) => {
    const matchesSearch =
      session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.transcript.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTags =
      selectedTags.length === 0 ||
      selectedTags.some((tag) => session.tags.includes(tag));

    return matchesSearch && matchesTags;
  });

  const handleDeleteRequest = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeleteId(sessionId);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) {
      return;
    }

    const sessionId = pendingDeleteId;
    setIsDeleting(sessionId);
    try {
      await onDeleteSession(sessionId);
      addToast('success', 'Session deleted successfully.');
      setPendingDeleteId(null);
    } catch (error) {
      console.error('Delete session failed:', error);
      addToast('error', 'Failed to delete session. Please try again.');
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="w-full flex-col h-full bg-transparent">
      {/* Search & Actions Header */}
      <div className="px-5 py-4 border-b border-[#EAEAEB] bg-white">
        <button
          onClick={onCreateNew}
          className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 text-[13px] font-medium transition-colors shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          New Recording
        </button>

        <div className="relative group">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-600 transition-colors" />
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#F9F9FA] border border-transparent hover:border-[#EAEAEB] rounded-md text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-200 focus:border-slate-300 transition-all"
          />
        </div>
      </div>

      {/* Tags Filter */}
      {allTags.length > 0 && (
        <div className="px-5 py-3 border-b border-[#EAEAEB] bg-[#F9F9FA]/50">
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() =>
                  setSelectedTags((prev) =>
                    prev.includes(tag)
                      ? prev.filter((t) => t !== tag)
                      : [...prev, tag]
                  )
                }
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border ${
                  selectedTags.includes(tag)
                    ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                    : 'bg-white text-slate-600 border-[#EAEAEB] hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto pb-6">
        {filteredSessions.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-500">
            <p className="text-[13px]">
              {sessions.length === 0
                ? 'No recordings yet'
                : 'No matching sessions'}
            </p>
          </div>
        ) : (
          <div className="px-2 py-2 space-y-0.5">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSelectSession(session)}
                className={`group relative flex flex-col p-3 rounded-lg cursor-pointer transition-colors ${
                  currentSession?.id === session.id
                    ? 'bg-white shadow-sm ring-1 ring-[#EAEAEB]'
                    : 'border border-transparent hover:bg-[#EAEAEB]/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h3 className={`text-[14.5px] font-semibold leading-tight line-clamp-1 flex-1 tracking-tight ${
                    currentSession?.id === session.id ? 'text-slate-900' : 'text-slate-700 group-hover:text-slate-900'
                  }`}>
                    {session.title}
                  </h3>
                  <button
                    onClick={(e) => handleDeleteRequest(session.id, e)}
                    disabled={isDeleting === session.id}
                    className={`opacity-0 group-hover:opacity-100 p-1 -mr-1 -mt-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50 ${currentSession?.id === session.id ? 'opacity-100' : ''}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-2 text-[11.5px] text-slate-500 font-medium">
                  <span>{formatDate(session.date)}</span>
                  {session.duration && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                      <span>{Math.floor(session.duration / 60)}:{(session.duration % 60).toString().padStart(2, '0')}</span>
                    </>
                  )}
                </div>

                {session.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {session.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F1F1F2] text-slate-600 border border-transparent shadow-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-[12px] text-slate-500 line-clamp-2 leading-relaxed">
                  {session.transcript.substring(0, 80)}...
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingDeleteId && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-lg">
            <h3 className="mb-2 text-base font-semibold text-slate-900">
              Delete session?
            </h3>
            <p className="mb-4 text-sm text-slate-600">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={!!isDeleting}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
