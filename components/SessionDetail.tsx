'use client';

import React, { useState } from 'react';
import { FileText, Download, Copy, Tag, Edit2, Save, X, ChevronDown } from 'lucide-react';
import { useExport } from '@/hooks/useTranscription';
import { useAppStore } from '@/lib/store';
import { formatDate, formatDuration } from '@/lib/utils';
import type { Session } from '@/lib/types';

interface SessionDetailProps {
  session: Session;
  onUpdate: (session: Session) => Promise<void>;
  onBack: () => void;
}

export default function SessionDetail({
  session,
  onUpdate,
  onBack,
}: SessionDetailProps) {
  const summaryData = normalizeSummaryForRender(session.summary);
  const { exportToFile, exportNotionMarkdown } = useExport();
  const { addToast } = useAppStore();
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    summary: true,
    notes: true,
    transcript: false,
    export: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) return;

    const updatedSession = {
      ...session,
      tags: [...new Set([...session.tags, newTag.trim()])],
    };

    setIsUpdating(true);
    try {
      await onUpdate(updatedSession);
      setNewTag('');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const updatedSession = {
      ...session,
      tags: session.tags.filter((t) => t !== tagToRemove),
    };

    setIsUpdating(true);
    try {
      await onUpdate(updatedSession);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopyNotionMarkdown = async () => {
    try {
      const markdown = exportNotionMarkdown(session);
      await navigator.clipboard.writeText(markdown);
      addToast('success', 'Notion markdown copied to clipboard.');
    } catch (error) {
      console.error('Clipboard copy failed:', error);
      addToast('error', 'Failed to copy markdown. Please try again.');
    }
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200/50 shadow-sm">
            <div className="max-w-5xl mx-auto px-6 py-4">
              <button
                onClick={onBack}
                className="mb-3 px-4 py-2 text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-2 hover:bg-indigo-50 rounded-lg transition"
              >
                ← Back
              </button>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                {session.title}
              </h1>
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-600">
                <span className="flex items-center gap-1">
                  📅 {formatDate(session.date)}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  ⏱️ {formatDuration(session.duration)}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  🌐 {session.language === 'es' ? 'Español' : 'English'}
                </span>
              </div>
            </div>
          </div>

          <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
            {/* Tags Section */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition overflow-hidden">
              <div
                onClick={() => toggleSection('summary')}
                className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition"
              >
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Tag size={20} className="text-indigo-600" />
                  Tags
                </h2>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingTags(!isEditingTags);
                  }}
                  className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition"
                >
                  {isEditingTags ? (
                    <>
                      <X size={16} />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Edit2 size={16} />
                      Edit
                    </>
                  )}
                </button>
              </div>
              <div className="px-6 pb-4 border-t border-slate-200/30">
                <div className="flex flex-wrap gap-2">
                  {session.tags.map((tag) => (
                    <div
                      key={tag}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-100 to-blue-100 text-indigo-900 rounded-full text-sm font-medium hover:shadow-sm transition"
                    >
                      {tag}
                      {isEditingTags && (
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          disabled={isUpdating}
                          className="text-indigo-700 hover:text-indigo-900 disabled:opacity-50 ml-1"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {isEditingTags && (
                  <div className="mt-4 flex gap-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') handleAddTag();
                      }}
                      placeholder="Add new tag..."
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                    />
                    <button
                      onClick={handleAddTag}
                      disabled={isUpdating || !newTag.trim()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition"
                    >
                      <Save size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Summary & Notes - Notebook Style */}
            {summaryData && (
              <>
                {/* Executive Summary */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border-l-4 border-amber-400 shadow-md p-6">
                  <h2 className="text-2xl font-bold text-amber-900 mb-3">📝 Resumen Ejecutivo</h2>
                  <p className="text-amber-900/80 leading-relaxed text-lg">
                    {summaryData.executiveSummary}
                  </p>
                </div>

                {/* Key Points - Highlighted Cards */}
                {summaryData.keyPoints.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                      ⭐ Puntos Clave
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {summaryData.keyPoints.map((point, i) => (
                        <div
                          key={i}
                          className="bg-white rounded-xl border-2 border-indigo-200 p-5 hover:shadow-lg hover:border-indigo-400 transition hover:scale-105 transform"
                        >
                          <div className="flex gap-3">
                            <div className="flex-shrink-0">
                              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm">
                                {i + 1}
                              </div>
                            </div>
                            <p className="text-indigo-900 leading-relaxed">{point}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lecture Notes - Notebook Style */}
                {summaryData.lectureNotes && (
                  <div
                    className="cursor-pointer transition"
                    onClick={() => toggleSection('notes')}
                  > 
                    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition overflow-hidden">
                      <div className="px-6 py-5 flex items-center justify-between bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200/30">
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                          📔 Notas de Класса
                        </h2>
                        <ChevronDown
                          size={20}
                          className={`text-slate-500 transition transform ${
                            expandedSections.notes ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                      {expandedSections.notes && (
                        <div className="px-6 py-6 bg-white/50 backdrop-blur-sm">
                          <div className="bg-white rounded-xl border-l-4 border-blue-400 p-6 shadow-sm">
                            <p className="text-slate-800 leading-relaxed whitespace-pre-wrap font-sans text-base">
                              {summaryData.lectureNotes}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actionable Insights */}
                {summaryData.actionableInsights.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                      💡 Conceptos Aplicables
                    </h2>
                    <div className="space-y-3">
                      {summaryData.actionableInsights.map((insight, i) => (
                        <div
                          key={i}
                          className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border-l-4 border-emerald-400 p-5 hover:shadow-md transition"
                        >
                          <div className="flex gap-3">
                            <span className="text-2xl">💭</span>
                            <p className="text-emerald-900 leading-relaxed">{insight}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Full Transcript */}
            <div
              className="cursor-pointer transition"
              onClick={() => toggleSection('transcript')}
            >
              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition overflow-hidden">
                <div className="px-6 py-5 flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200/30">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <FileText size={20} className="text-slate-600" />
                    Transcripción Completa
                  </h2>
                  <ChevronDown
                    size={20}
                    className={`text-slate-500 transition transform ${
                      expandedSections.transcript ? 'rotate-180' : ''
                    }`}
                  />
                </div>
                {expandedSections.transcript && (
                  <div className="px-6 py-6">
                    <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 max-h-96 overflow-y-auto">
                      <p className="text-slate-800 leading-relaxed whitespace-pre-wrap text-sm font-mono">
                        {session.transcript}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Export Options */}
            <div
              className="cursor-pointer transition"
              onClick={() => toggleSection('export')}
            >
              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition overflow-hidden">
                <div className="px-6 py-5 flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50 border-b border-slate-200/30">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Download size={20} className="text-purple-600" />
                    Exportar
                  </h2>
                  <ChevronDown
                    size={20}
                    className={`text-slate-500 transition transform ${
                      expandedSections.export ? 'rotate-180' : ''
                    }`}
                  />
                </div>
                {expandedSections.export && (
                  <div className="px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button
                      onClick={() => exportToFile(session, 'txt')}
                      className="flex flex-col items-center justify-center gap-2 px-4 py-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg hover:scale-105 transition font-medium text-sm"
                    >
                      <Download size={20} />
                      TXT
                    </button>

                    <button
                      onClick={() => exportToFile(session, 'md')}
                      className="flex flex-col items-center justify-center gap-2 px-4 py-4 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-lg hover:shadow-lg hover:scale-105 transition font-medium text-sm"
                    >
                      <Download size={20} />
                      Markdown
                    </button>

                    <button
                      onClick={() => exportToFile(session, 'json')}
                      className="flex flex-col items-center justify-center gap-2 px-4 py-4 bg-gradient-to-br from-slate-600 to-slate-700 text-white rounded-lg hover:shadow-lg hover:scale-105 transition font-medium text-sm"
                    >
                      <Download size={20} />
                      JSON
                    </button>

                    <button
                      onClick={handleCopyNotionMarkdown}
                      className="flex flex-col items-center justify-center gap-2 px-4 py-4 bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-lg hover:shadow-lg hover:scale-105 transition font-medium text-sm"
                    >
                      <Copy size={20} />
                      Notion
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer spacing */}
          <div className="h-12" />
        </div>
      </div>
    </div>
  );
}

function normalizeSummaryForRender(summary: unknown) {
  if (!summary || typeof summary !== 'object') {
    return null;
  }

  const source = summary as Record<string, unknown>;
  const executiveSummary = toText(source.executiveSummary);
  const keyPoints = toList(source.keyPoints);
  const lectureNotes = toText(source.lectureNotes);
  const actionableInsights = toList(source.actionableInsights);

  return {
    executiveSummary,
    keyPoints,
    lectureNotes,
    actionableInsights,
  };
}

function toText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toText(item)).filter(Boolean).join('\n');
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => `${key}: ${toText(val)}`)
      .join('\n');
  }

  return value == null ? '' : String(value);
}

function toList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => toText(item).trim()).filter(Boolean);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => `${key}: ${toText(val)}`.trim())
      .filter(Boolean);
  }

  const text = toText(value).trim();
  return text ? [text] : [];
}
