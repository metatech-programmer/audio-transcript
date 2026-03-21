'use client';

import React, { useState } from 'react';
import { FileText, Download, Copy, Tag, Edit2, Save, X } from 'lucide-react';
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
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="mb-4 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
          >
            ← Back
          </button>

          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            {session.title}
          </h1>

          <div className="flex gap-4 text-sm text-slate-600">
            <span>{formatDate(session.date)}</span>
            <span>•</span>
            <span>{formatDuration(session.duration)}</span>
            <span>•</span>
            <span>{session.language === 'es' ? 'Spanish' : 'English'}</span>
          </div>
        </div>

        {/* Tags */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Tag size={20} />
              Tags
            </h2>
            <button
              onClick={() => setIsEditingTags(!isEditingTags)}
              className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700"
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

          <div className="flex flex-wrap gap-2">
            {session.tags.map((tag) => (
              <div
                key={tag}
                className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-900 rounded-lg text-sm"
              >
                {tag}
                {isEditingTags && (
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    disabled={isUpdating}
                    className="text-blue-700 hover:text-blue-900 disabled:opacity-50"
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
                placeholder="Add new tag and press Enter..."
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddTag}
                disabled={isUpdating || !newTag.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition"
              >
                <Save size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Summary */}
        {summaryData && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Summary</h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">
                  Executive Summary
                </h3>
                <p className="text-slate-700 leading-relaxed">
                  {summaryData.executiveSummary}
                </p>
              </div>

              {summaryData.keyPoints.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">
                    Key Points
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-700">
                    {summaryData.keyPoints.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}

              {summaryData.lectureNotes && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">
                    Lecture Notes
                  </h3>
                  <p className="text-slate-700 leading-relaxed">
                    {summaryData.lectureNotes}
                  </p>
                </div>
              )}

              {summaryData.actionableInsights.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">
                    Actionable Insights
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-700">
                    {summaryData.actionableInsights.map((insight, i) => (
                      <li key={i}>{insight}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transcript */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FileText size={24} />
            Full Transcript
          </h2>
          <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 max-h-96 overflow-y-auto">
            <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
              {session.transcript}
            </p>
          </div>
        </div>

        {/* Export Options */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Export</h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => exportToFile(session, 'txt')}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
            >
              <Download size={18} />
              Export as TXT
            </button>

            <button
              onClick={() => exportToFile(session, 'md')}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
            >
              <Download size={18} />
              Export as MD
            </button>

            <button
              onClick={() => exportToFile(session, 'json')}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 font-medium transition"
            >
              <Download size={18} />
              Export as JSON
            </button>

            <button
              onClick={handleCopyNotionMarkdown}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition"
            >
              <Copy size={18} />
              Copy for Notion
            </button>
          </div>
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
