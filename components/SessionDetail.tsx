'use client';

import React, { useState } from 'react';
import { FileText, Download, Copy, Tag, Edit2, Save, X, ChevronDown, Calendar, Clock, Globe, BookOpen, Lightbulb, Check, ChevronUp, Eye } from 'lucide-react';
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
  const [showRawJson, setShowRawJson] = useState(false);
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
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 dark:text-slate-100 overflow-auto">
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-700 shadow-sm">
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
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} /> {formatDate(session.date)}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock size={14} /> {formatDuration(session.duration)}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Globe size={14} /> {session.language === 'es' ? 'Español' : 'English'}
                    </span>
                  </div>
            </div>
          </div>

          <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
            {/* Tags Section */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-sm hover:shadow-md transition overflow-hidden">
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
                <div className="relative bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border border-amber-200 shadow-lg p-8">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-amber-100 text-amber-700 shadow-inner dark:bg-amber-700/10 dark:text-amber-300">
                        <FileText size={20} />
                      </div>
                      <div>
                        <h2 className="text-3xl font-extrabold text-amber-900 dark:text-amber-300">Resumen Ejecutivo</h2>
                        <p className="text-sm text-amber-800/70 mt-1 dark:text-amber-200">Captura concisa y accionable de la clase</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(summaryData.executiveSummary || '');
                          addToast('success', 'Resumen ejecutivo copiado.');
                        } catch (err) {
                          addToast('error', 'No se pudo copiar.');
                        }
                      }}
                      className="px-3 py-2 bg-white/60 backdrop-blur-sm rounded-lg hover:bg-white shadow-sm border border-amber-100 text-amber-700 font-medium transition dark:bg-slate-800 dark:border-slate-700 dark:text-amber-200 hover:shadow-md"
                    >
                      <Copy size={16} /> Copiar
                    </button>
                  </div>

                  <div className="mt-6">
                    <div className="text-amber-900/90 leading-relaxed text-base max-w-4xl dark:text-amber-50 space-y-5">
                      {sanitizeSummaryText(summaryData.executiveSummary)
                        .split(/\n\n+/)
                        .filter(Boolean)
                        .map((paragraph, idx) => (
                          <p 
                            key={idx} 
                            className={`mb-0 text-justify ${idx === 0 ? 'text-lg font-medium tracking-wide text-amber-950 dark:text-amber-100' : 'text-[15px]'}`}
                          >
                            {idx === 0 && (
                              <span className="float-left text-4xl mr-2 font-black text-amber-500 leading-none">
                                {paragraph.charAt(0)}
                              </span>
                            )}
                            {idx === 0 ? paragraph.slice(1) : paragraph.trim()}
                          </p>
                        ))}
                    </div>
                  </div>
                </div>

                {/* Key Points - Highlighted Cards */}
                {summaryData.keyPoints.length > 0 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b-2 border-yellow-200 pb-3">
                      <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-3 dark:text-slate-100">
                        <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700">
                          <Eye size={20} />
                        </div>
                        Puntos Clave
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                      {summaryData.keyPoints.map((point, i) => (
                        <div
                          key={i}
                          className="group relative overflow-hidden bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition hover:-translate-y-0.5 duration-300 dark:bg-slate-800 dark:border-slate-700"
                        >
                          <div className="absolute top-0 left-0 w-1.5 h-full bg-yellow-400 opacity-80" />
                          <div className="relative flex gap-4 items-start pl-2">
                            <div className="flex-shrink-0 mt-0.5">
                              <div className="h-8 w-8 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center font-black text-sm dark:bg-yellow-500/10 dark:text-yellow-400">
                                {i + 1}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-slate-800 font-medium leading-relaxed dark:text-slate-200 text-[15px]">{point}</p>
                            </div>
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
                    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                      <div className="px-6 py-5 flex items-center justify-between bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200/30 dark:from-slate-800 dark:to-slate-700 dark:border-slate-700">
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3 dark:text-slate-100">
                          <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center dark:bg-indigo-500/10 dark:text-indigo-300">
                            <BookOpen size={18} />
                          </div>
                          Notas de Clase
                        </h2>
                        <ChevronDown
                          size={20}
                          className={`text-slate-500 transition transform duration-300 ${
                            expandedSections.notes ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                      {expandedSections.notes && (
                        <div className="px-6 py-6 bg-white/50 backdrop-blur-sm dark:bg-slate-800/50">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {parseLectureNotes(summaryData.lectureNotes).map((block, idx) => (
                              <div key={idx} className="group relative overflow-hidden bg-white rounded-2xl border-l-4 border-l-indigo-500 border-y border-r border-slate-200 p-6 shadow-sm hover:shadow-md transition dark:bg-slate-900 dark:border-y-slate-700 dark:border-r-slate-700 dark:border-l-indigo-400">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/0 to-blue-50/0 group-hover:from-indigo-50/30 group-hover:to-blue-50/30 dark:from-indigo-500/5 dark:to-blue-500/5 transition" />
                                <div className="relative">
                                  {block.title && (
                                    <h3 className="text-lg font-bold text-indigo-800 mb-3 flex items-center gap-2 dark:text-indigo-300">
                                      {block.title}
                                    </h3>
                                  )}
                                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-[15px] dark:text-slate-300">
                                    {block.content}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actionable Insights */}
                {summaryData.actionableInsights.length > 0 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b-2 border-emerald-200 pb-3">
                      <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-3 dark:text-slate-100">
                        <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                          <Lightbulb size={20} />
                        </div>
                        Conceptos Aplicables
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {summaryData.actionableInsights.map((insight, i) => (
                        <div key={i} className="group relative overflow-hidden bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition hover:border-emerald-300 duration-300 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-emerald-600/50">
                          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 opacity-80" />
                          <div className="relative flex items-start gap-4 pl-2">
                            <div className="flex-shrink-0 mt-1">
                              <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold dark:bg-emerald-500/10 dark:text-emerald-400">
                                <Check size={16} strokeWidth={3} />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-slate-800 font-medium leading-relaxed text-[15px] dark:text-slate-200">{insight}</p>
                              <div className="mt-4 flex gap-2">
                                <span className="text-[11px] font-bold tracking-wider text-emerald-700 uppercase bg-emerald-100/80 px-2.5 py-1 rounded-md dark:text-emerald-300 dark:bg-emerald-500/20">Aplicable</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Raw JSON preview (hidden by default) */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">Vista JSON</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowRawJson(prev => !prev)}
                        className="px-3 py-1 rounded-md bg-slate-50 border border-slate-100 text-sm text-slate-700"
                      >
                        <Eye size={14} /> {showRawJson ? 'Ocultar JSON' : 'Ver JSON'}
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(JSON.stringify(session.summary, null, 2));
                            addToast('success', 'JSON copiado.');
                          } catch (err) {
                            addToast('error', 'No se pudo copiar.');
                          }
                        }}
                        className="px-3 py-1 rounded-md bg-slate-50 border border-slate-100 text-sm text-slate-700"
                      >
                        <Copy size={14} /> Copiar JSON
                      </button>
                    </div>
                  </div>
                  {showRawJson && (
                    <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-auto max-h-56">
                      {JSON.stringify(session.summary, null, 2)}
                    </pre>
                  )}
                </div>
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
                      className="flex flex-col items-center justify-center gap-2 px-4 py-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg hover:scale-105 transition font-medium text-sm dark:from-blue-600 dark:to-blue-700"
                    >
                      <Download size={20} />
                      TXT
                    </button>

                    <button
                      onClick={() => exportToFile(session, 'md')}
                      className="flex flex-col items-center justify-center gap-2 px-4 py-4 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-lg hover:shadow-lg hover:scale-105 transition font-medium text-sm dark:from-indigo-600 dark:to-indigo-700"
                    >
                      <Download size={20} />
                      Markdown
                    </button>

                    <button
                      onClick={() => exportToFile(session, 'json')}
                      className="flex flex-col items-center justify-center gap-2 px-4 py-4 bg-gradient-to-br from-slate-600 to-slate-700 text-white rounded-lg hover:shadow-lg hover:scale-105 transition font-medium text-sm dark:from-slate-700 dark:to-slate-800"
                    >
                      <Download size={20} />
                      JSON
                    </button>

                    <button
                      onClick={handleCopyNotionMarkdown}
                      className="flex flex-col items-center justify-center gap-2 px-4 py-4 bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-lg hover:shadow-lg hover:scale-105 transition font-medium text-sm dark:from-purple-600 dark:to-pink-700"
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

function fixJsonString(str: string): string {
  let isInsideString = false;
  let isEscaped = false;
  let fixed = '';
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && !isEscaped) {
      isInsideString = !isInsideString;
      fixed += char;
    } else if (char === '\\' && !isEscaped) {
      isEscaped = true;
      fixed += char;
    } else if (char === '\n' && isInsideString) {
      fixed += '\\n';
    } else if (char === '\r' && isInsideString) {
      fixed += '\\r';
    } else if (char === '\t' && isInsideString) {
      fixed += '\\t';
    } else {
      if (isEscaped) isEscaped = false;
      fixed += char;
    }
  }
  return fixed;
}

function normalizeSummaryForRender(summary: unknown) {
  // First, try to parse if it's a string containing JSON
  let source: Record<string, unknown> = {};
  
  if (typeof summary === 'string') {
    const trimmed = summary.trim();
    // Try parsing if it looks like JSON
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        // Find JSON object if it's embedded within text
        const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            source = JSON.parse(fixJsonString(jsonMatch[0]));
        } else {
            source = JSON.parse(fixJsonString(trimmed));
        }
      } catch {
        // If parsing fails, treat the entire string as raw summary text
        return {
          executiveSummary: trimmed,
          keyPoints: [],
          lectureNotes: '',
          actionableInsights: [],
        };
      }
    } else {
      // Regular string, treat as executive summary
      return {
        executiveSummary: trimmed,
        keyPoints: [],
        lectureNotes: '',
        actionableInsights: [],
      };
    }
  } else if (!summary || typeof summary !== 'object') {
    return null;
  } else {
    source = summary as Record<string, unknown>;
  }

  // Handle nested structure from some AI responses
  const extractedSrc = source.summary ? (source.summary as Record<string, unknown>) : source;

  const executiveSummary = toText(extractedSrc.executiveSummary || extractedSrc.resumen || extractedSrc.summary || '');
  const keyPoints = toList(extractedSrc.keyPoints || extractedSrc.puntosClave || extractedSrc.puntos_clave || []);
  const lectureNotes = toText(extractedSrc.lectureNotes || extractedSrc.notas || extractedSrc.notasDeClase || '');
  const actionableInsights = toList(extractedSrc.actionableInsights || extractedSrc.conceptosAplicables || extractedSrc.insights || []);

  // Make sure at least one field has data
  if (!executiveSummary && keyPoints.length === 0 && !lectureNotes && actionableInsights.length === 0) {
      if (typeof summary === 'string') {
          return {
              executiveSummary: summary,
              keyPoints: [],
              lectureNotes: '',
              actionableInsights: [],
          }
      }
  }

  return {
    executiveSummary,
    keyPoints,
    lectureNotes,
    actionableInsights,
  };
}

function toText(value: unknown): string {
  if (typeof value === 'string') {
    let s = value.trim();
    
    // If the string is valid JSON, try to parse and convert to text
    if ((s.startsWith('{') || s.startsWith('[')) && (s.endsWith('}') || s.endsWith(']'))) {
      try {
        const parsed = JSON.parse(fixJsonString(s));
        // Recursively convert parsed JSON to text
        return toText(parsed);
      } catch {
        // If parse fails, return the original string
        return s;
      }
    }
    
    // Remove common JSON quote escaping artifacts
    s = s.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    return s;
  }

  if (Array.isArray(value)) {
    // For arrays, join items with newlines, not JSON formatting
    return value
      .map((item) => {
        const text = toText(item).trim();
        return text;
      })
      .filter(Boolean)
      .join('\n\n');
  }

  if (value && typeof value === 'object') {
    // For objects, extract just the values, not key:value pairs
    const entries = Object.entries(value as Record<string, unknown>);
    return entries
      .map(([, val]) => {
        const text = toText(val).trim();
        return text;
      })
      .filter(Boolean)
      .join('\n\n');
  }

  return value == null ? '' : String(value);
}

function toList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const text = toText(item).trim();
        // Remove any remaining JSON artifacts
        return text
          .replace(/^["']|["']$/g, '') // Remove quotes at start/end
          .replace(/\\"/g, '"') // Unescape quotes
          .trim();
      })
      .filter((item) => item.length > 0);
  }

  if (value && typeof value === 'object') {
    // Extract values from object as list items
    return Object.values(value as Record<string, unknown>)
      .map((item) => {
        const text = toText(item).trim();
        return text
          .replace(/^["']|["']$/g, '')
          .replace(/\\"/g, '"')
          .trim();
      })
      .filter((item) => item.length > 0);
  }

  const text = toText(value).trim();
  return text
    .split(/\n+/)
    .map((line) => line.trim().replace(/^["']|["']$/g, '').trim())
    .filter((item) => item.length > 0);
}

function sanitizeSummaryText(s: string): string {
  if (!s) return '';
  
  let text = String(s).trim();

  // If it looks like JSON, try to parse and extract executiveSummary
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(fixJsonString(text));
      if (parsed && typeof parsed === 'object' && parsed.executiveSummary) {
        text = String(parsed.executiveSummary).trim();
      }
    } catch {
      // Continue with the original text if parsing fails silently
    }
  }

  // Remove wrapping quotes
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }

  // Clean up escaped characters (these are now actual text, not JSON artifacts)
  text = text
    .replace(/\\n/g, '\n')     // Unescape newlines
    .replace(/\\"/g, '"')       // Unescape double quotes
    .replace(/\\'/g, "'")       // Unescape single quotes
    .replace(/\\t/g, '\t');     // Unescape tabs

  return text;
}

function parseLectureNotes(text: string) {
  if (!text || !text.trim()) return [];

  // Clean up any weird JSON formatting that might have leaked
  const cleanText = text.replace(/\\n/g, '\n').replace(/\\"/g, '"');

  const headers = [
    'TEMAS PRINCIPALES',
    'DEFINICIONES',
    'EJEMPLOS',
    'EXPLICACIONES',
    'ESTRUCTURA LÓGICA',
    'CONEXIONES',
    'CONCEPTOS CLAVES',
    'RESUMEN',
    'INTRODUCCIÓN',
    'CONCLUSIONES'
  ];

  const blocks: {title: string, content: string}[] = [];
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);
  
  let currentTitle = 'Ideas Generales';
  let currentContent: string[] = [];

  lines.forEach((line) => {
    const isKnownHeader = headers.some(h => line.toUpperCase() === h || line.toUpperCase().includes(h + ':'));
    const isAllCaps = /^[A-ZÁÉÍÓÚÑ\s]{3,40}$/.test(line.replace(/[0-9:.-]/g, '').trim());

    if (isKnownHeader || (isAllCaps && !line.includes(' '))) {
      // It's a header, save previous block
      if (currentContent.length > 0) {
        blocks.push({ title: currentTitle, content: currentContent.join('\n\n') });
        currentContent = [];
      }
      currentTitle = line.replace(/[:*]/g, '').trim(); // Clean trailing colons
    } else {
      currentContent.push(line);
    }
  });

  if (currentContent.length > 0) {
    blocks.push({ title: currentTitle, content: currentContent.join('\n\n') });
  }

  return blocks.filter(b => b.content.trim() !== '');
}
