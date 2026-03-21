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
    <div className="w-full max-w-sm bg-white border-r border-slate-200 flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">
          Lecture Recordings
        </h1>

        <button
          onClick={onCreateNew}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
        >
          + New Recording
        </button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-slate-200">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Tags Filter */}
      {allTags.length > 0 && (
        <div className="p-4 border-b border-slate-200">
          <p className="text-xs font-semibold text-slate-600 mb-2 uppercase">
            Filter by Tag
          </p>
          <div className="flex flex-wrap gap-2">
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
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  selectedTags.includes(tag)
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {filteredSessions.length === 0 ? (
          <div className="p-4 text-center text-slate-500">
            <p className="text-sm">
              {sessions.length === 0
                ? 'No recordings yet'
                : 'No matching sessions'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSelectSession(session)}
                className={`p-4 cursor-pointer transition ${
                  currentSession?.id === session.id
                    ? 'bg-blue-50 border-l-4 border-l-blue-600'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-medium text-slate-900 flex-1 truncate">
                    {session.title}
                  </h3>
                  <button
                    onClick={(e) => handleDeleteRequest(session.id, e)}
                    disabled={isDeleting === session.id}
                    className="p-1 text-slate-400 hover:text-red-600 transition disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <p className="text-xs text-slate-500 mb-2">
                  {formatDate(session.date)}
                </p>

                {session.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {session.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-200 text-slate-700"
                      >
                        <Tag size={10} />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-xs text-slate-600 line-clamp-2">
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
