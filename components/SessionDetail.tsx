'use client';

import React, { useState } from 'react';
import { FileText, Download, Copy, Tag, Edit2, Save, X, ChevronDown, Calendar, Clock, Globe, BookOpen, Lightbulb, Check, Eye } from 'lucide-react';
import { useExport, useSummarization } from '@/hooks/useTranscription';
import { useAppStore } from '@/lib/store';
import { formatDate, formatDuration } from '@/lib/utils';
import type { Session } from '@/lib/types';

interface SessionDetailProps {
  session: Session;
  onUpdate: (session: Session) => Promise<void>;
  onBack?: () => void;
}

export default function SessionDetail({ session, onUpdate, onBack }: SessionDetailProps) {
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
  const { summarize, loading: summarizing, error: summarizingError } = useSummarization();
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
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
      setIsEditingTags(false);
      addToast('success', 'Etiqueta agregada.');
    } catch (err) {
      addToast('error', 'No se pudo agregar la etiqueta.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const updatedSession = { ...session, tags: session.tags.filter(t => t !== tagToRemove) };
    setIsUpdating(true);
    try {
      await onUpdate(updatedSession);
      addToast('success', 'Etiqueta eliminada.');
    } catch {
      addToast('error', 'No se pudo eliminar la etiqueta.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopyNotionMarkdown = async () => {
    try {
      const markdown = exportNotionMarkdown(session);
      await navigator.clipboard.writeText(markdown);
      addToast('success', 'Copiado para Notion.');
    } catch (err) {
      addToast('error', 'No se pudo copiar.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-transparent">
      <div className="min-h-full w-full p-6 md:p-12">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-amber-100 text-amber-700 shadow-inner">
                <FileText size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 truncate-ellipsis max-w-dvw-80 flex-truncate">{session.title}</h1>
                <div className="text-sm text-slate-600 mt-1 flex items-center gap-4">
                  <span className="flex items-center gap-1"><Calendar size={14} /> {formatDate(session.date)}</span>
                  <span className="flex items-center gap-1"><Clock size={14} /> {formatDuration(session.duration)}</span>
                  <span className="flex items-center gap-1"><Globe size={14} /> {session.language === 'es' ? 'Español' : 'English'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex gap-2 items-center">
                {session.tags.map((tag) => (
                  <div key={tag} className="flex items-center gap-2 bg-slate-50 rounded-full px-3 py-1 text-sm border border-slate-100">
                    <span className="text-slate-700">{tag}</span>
                    <button onClick={() => handleRemoveTag(tag)} className="text-slate-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {isEditingTags ? (
                <div className="flex items-center gap-2">
                  <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter') handleAddTag(); }} placeholder="Add new tag..." className="px-3 py-1 border rounded-md bg-slate-50" />
                  <button onClick={handleAddTag} disabled={isUpdating || !newTag.trim()} className="px-3 py-1 bg-indigo-600 text-white rounded-md">
                    <Save size={14} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setIsEditingTags(true)} className="px-3 py-1 bg-white border rounded-md">
                  <Edit2 size={14} /> Editar etiquetas
                </button>
              )}
            </div>
          </div>

          {/* Summary & Notes */}
          {summaryData && (
            <div className="space-y-10">
              {/* Metadata */}
              <section className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2"><BookOpen size={18} /> Identificación y Metadatos</h3>
                </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-slate-700">
                  <div><strong>Asignatura:</strong> <span className="truncate-ellipsis max-w-dvw-50 inline-block">{String((summaryData.metadata && (summaryData.metadata as any).subject) || '—')}</span></div>
                  <div><strong>Unidad:</strong> <span className="truncate-ellipsis max-w-dvw-40 inline-block">{String((summaryData.metadata && (summaryData.metadata as any).unit) || '—')}</span></div>
                  <div><strong>Sesión:</strong> {String((summaryData.metadata && (summaryData.metadata as any).sessionNumber) || '—')}</div>
                  <div className="sm:col-span-3"><strong>Eje temático:</strong> <span className="truncate-ellipsis max-w-dvw-70 inline-block">{String((summaryData.metadata && (summaryData.metadata as any).thematicAxis) || '—')}</span></div>
                  <div className="sm:col-span-3"><strong>Keywords:</strong> <span className="truncate-ellipsis max-w-dvw-70 inline-block">{Array.isArray((summaryData.metadata && (summaryData.metadata as any).keywords)) ? (summaryData.metadata as any).keywords.join(', ') : String((summaryData.metadata && (summaryData.metadata as any).keywords) || '—')}</span></div>
                </div>
              </section>

              {/* Learning Outcomes */}
              <section className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2"><Check size={18} /> Objetivos de Aprendizaje</h3>
                </div>
                <div className="text-sm text-slate-700">
                  <div className="mb-2"><strong>Competencias:</strong> {Array.isArray((summaryData.learningOutcomes && (summaryData.learningOutcomes as any).competencies)) ? (summaryData.learningOutcomes as any).competencies.join('; ') : String((summaryData.learningOutcomes && (summaryData.learningOutcomes as any).competencies) || '—')}</div>
                  <div><strong>Problema principal:</strong> {String((summaryData.learningOutcomes && (summaryData.learningOutcomes as any).mainProblem) || '—')}</div>
                </div>
              </section>

              {/* Theoretical Core */}
              <section className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2"><BookOpen size={18} /> Núcleo Teórico y Estado del Arte</h3>
                </div>
                <div className="text-sm text-slate-700">
                  <div className="mb-2"><strong>Conceptos:</strong> {String((summaryData.theoreticalCore && (summaryData.theoreticalCore as any).concepts) || '—')}</div>
                  <div className="mb-2"><strong>Modelos/Estándares:</strong> {String((summaryData.theoreticalCore && (summaryData.theoreticalCore as any).modelsStandards) || '—')}</div>
                  <div><strong>Autores referenciados:</strong> {Array.isArray((summaryData.theoreticalCore && (summaryData.theoreticalCore as any).referencedAuthors)) ? (summaryData.theoreticalCore as any).referencedAuthors.join(', ') : String((summaryData.theoreticalCore && (summaryData.theoreticalCore as any).referencedAuthors) || '—')}</div>
                </div>
              </section>

              {/* Comparative Analysis */}
              <section className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2"><Lightbulb size={18} /> Análisis Comparativo y Crítico</h3>
                </div>
                <div className="text-sm text-slate-700">
                  <div className="mb-2"><strong>Ventajas/Desventajas:</strong> {String((summaryData.comparativeAnalysis && (summaryData.comparativeAnalysis as any).prosCons) || '—')}</div>
                  <div className="mb-2"><strong>Comparaciones:</strong> {String((summaryData.comparativeAnalysis && (summaryData.comparativeAnalysis as any).comparisons) || '—')}</div>
                  <div><strong>Contexto de uso:</strong> {String((summaryData.comparativeAnalysis && (summaryData.comparativeAnalysis as any).contextOfUse) || '—')}</div>
                </div>
              </section>

              {/* Examples */}
              <section className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2"><FileText size={18} /> Bloque de Ejemplos y Casos de Uso</h3>
                </div>
                <div className="text-sm text-slate-700">
                  <div className="mb-2"><strong>Ejemplo Académico:</strong> {String((summaryData.examples && (summaryData.examples as any).academicExample) || '—')}</div>
                  <div className="mb-2"><strong>Caso de Estudio:</strong> {String((summaryData.examples && (summaryData.examples as any).caseStudy) || '—')}</div>
                  <div><strong>Anti-patrones:</strong> {String((summaryData.examples && (summaryData.examples as any).antipatterns) || '—')}</div>
                </div>
              </section>

              {/* Technical Component */}
              <section className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2"><BookOpen size={18} /> Componente Técnico / Práctico</h3>
                </div>
                <div className="text-sm text-slate-700">
                  <div className="mb-2"><strong>Snippets / Código:</strong>
                    <pre className="bg-slate-50 p-3 rounded mt-2 text-xs whitespace-pre-wrap">{String((summaryData.technicalComponent && (summaryData.technicalComponent as any).codeSnippets) || '—')}</pre>
                  </div>
                  <div className="mb-2"><strong>Herramientas:</strong> {Array.isArray((summaryData.technicalComponent && (summaryData.technicalComponent as any).tools)) ? (summaryData.technicalComponent as any).tools.join(', ') : String((summaryData.technicalComponent && (summaryData.technicalComponent as any).tools) || '—')}</div>
                  <div><strong>Diagramas:</strong> {String((summaryData.technicalComponent && (summaryData.technicalComponent as any).diagrams) || '—')}</div>
                </div>
              </section>

              {/* Debate & Interdisciplinary */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                  <h4 className="text-lg font-semibold mb-2">Debate y Participaciones Clave</h4>
                  <div className="text-sm text-slate-700">
                    <div className="mb-2"><strong>Puntos polémicos:</strong> {String((summaryData.debate && (summaryData.debate as any).controversies) || '—')}</div>
                    <div><strong>Aportes relevantes:</strong> {String((summaryData.debate && (summaryData.debate as any).participantContributions) || '—')}</div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                  <h4 className="text-lg font-semibold mb-2">Conexión Interdisciplinar</h4>
                  <div className="text-sm text-slate-700">
                    <div className="mb-2"><strong>Relaciones:</strong> {String((summaryData.interdisciplinary && (summaryData.interdisciplinary as any).relations) || '—')}</div>
                    <div><strong>Aplicación en el trabajo:</strong> {String((summaryData.interdisciplinary && (summaryData.interdisciplinary as any).workplaceApplications) || '—')}</div>
                  </div>
                </div>
              </section>

              {/* Executive Summary */}
              <section className="relative bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border border-amber-200 shadow-lg p-8">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-amber-100 flex items-center justify-center">
                      <FileText size={22} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-amber-900">Resumen Ejecutivo</h2>
                      <p className="text-sm text-amber-800/70">Captura concisa y accionable de la clase</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                                    <button onClick={async () => {
                                      try {
                                        const parsed = parseJsonFromString(String(summaryData.executiveSummary || ''));
                                        const toCopy = parsed ? JSON.stringify(parsed, null, 2) : String(summaryData.executiveSummary || '');
                                        await navigator.clipboard.writeText(toCopy);
                                        addToast('success','Resumen copiado');
                                      } catch {
                                        addToast('error','No se pudo copiar');
                                      }
                                    }} className="px-3 py-2 bg-white rounded-md border"> <Copy size={14} /> Copiar</button>
                                    <button
                                      onClick={async () => {
                                        if (!session.transcript || !session.transcript.trim()) {
                                          addToast('error', 'No hay transcripción para resumir.');
                                          return;
                                        }
                                        try {
                                          setIsGeneratingSummary(true);
                                          const summary = await summarize(session.transcript, session.language);
                                          const updated = { ...session, summary } as Session;
                                          await onUpdate(updated);
                                          addToast('success', 'Resumen regenerado y guardado.');
                                        } catch (err) {
                                          const msg = err instanceof Error ? err.message : 'Error al generar resumen';
                                          addToast('error', `No se pudo generar el resumen: ${msg}`);
                                        } finally {
                                          setIsGeneratingSummary(false);
                                        }
                                      }}
                                      disabled={isGeneratingSummary || summarizing}
                                      className="px-3 py-2 bg-white rounded-md border ml-2 disabled:opacity-50"
                                    >
                                      {isGeneratingSummary || summarizing ? 'Generando...' : 'Reintentar resumen'}
                                    </button>
                  </div>
                </div>

                                <div className="prose max-w-none text-slate-800">
                                  {(() => {
                                    // Si el resumen es un objeto grande (Gemini), extraer executiveSummary
                                    let execSummary = '';
                                    if (typeof summaryData === 'object' && summaryData !== null) {
                                      const alt: any = summaryData;
                                      execSummary = alt.executiveSummary || alt.resumen || alt.summary || '';
                                      // Si accidentalmente viene como objeto anidado, intenta extraerlo
                                      if (typeof execSummary === 'object' && execSummary !== null) {
                                        const inner: any = execSummary;
                                        execSummary = inner.executiveSummary || inner.resumen || inner.summary || '';
                                      }
                                    }
                                    // Si sigue vacío, intenta extraer del string plano
                                    if (!execSummary) {
                                      const alt = summaryData as any;
                                      const raw = String(alt.executiveSummary || alt.resumen || alt.summary || '');
                                      const parsed = parseJsonFromString(raw);
                                      if (parsed && typeof parsed.executiveSummary === 'string') {
                                        execSummary = parsed.executiveSummary;
                                      } else if (parsed && typeof parsed.summary === 'string') {
                                        execSummary = parsed.summary;
                                      } else if (parsed && typeof parsed === 'string') {
                                        execSummary = parsed;
                                      } else {
                                        execSummary = raw;
                                      }
                                    }
                                    // Renderizar como párrafos limpios
                                    return sanitizeSummaryText(execSummary).split(/\n\n+/).filter(Boolean).map((p: string, idx: number) => (
                                      <p key={idx} className={idx === 0 ? 'text-lg font-medium' : ''}>{p}</p>
                                    ));
                                  })()}
                                </div>
              </section>

              {/* Key Points */}
              {summaryData.keyPoints.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center"><FileText size={18} /></div> Puntos Clave</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {summaryData.keyPoints.map((kp, i) => (
                      <div key={i} className="p-4 rounded-xl border bg-white shadow-sm">
                        <div className="font-semibold text-slate-800">{kp}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Lecture Notes */}
              {summaryData.lectureNotes && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center"><BookOpen size={18} /></div> Notas de Clase</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {parseLectureNotes(summaryData.lectureNotes).map((block, idx) => (
                      <div key={idx} className="p-4 rounded-lg border bg-white shadow-sm">
                        {block.title && <h4 className="font-bold mb-2">{block.title}</h4>}
                        <div className="whitespace-pre-wrap text-slate-700">{block.content}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Actionable Insights */}
              {summaryData.actionableInsights.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center"><Lightbulb size={18} /></div> Conceptos Aplicables</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {summaryData.actionableInsights.map((ins, i) => (
                      <div key={i} className="p-4 rounded-xl border bg-white shadow-sm">
                        <div className="font-medium text-slate-800">{ins}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Raw JSON */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Vista JSON</h3>
                  <div className="flex gap-2">
                    <button onClick={() => setShowRawJson(s => !s)} className="px-3 py-1 border rounded-md">{showRawJson ? 'Ocultar JSON' : 'Ver JSON'}</button>
                    <button onClick={async () => { try { await navigator.clipboard.writeText(JSON.stringify(session.summary, null, 2)); addToast('success','JSON copiado'); } catch { addToast('error','No se pudo copiar'); } }} className="px-3 py-1 border rounded-md"> <Copy size={14} /> Copiar JSON</button>
                  </div>
                </div>
                {showRawJson && <pre className="bg-slate-900 text-white p-4 rounded-md text-xs overflow-auto max-h-56">{JSON.stringify(session.summary, null, 2)}</pre>}
              </section>

            </div>
          )}

          {/* Transcript */}
          <div className="cursor-pointer" onClick={() => toggleSection('transcript')}>
            <div className="bg-white rounded-2xl border p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2"><FileText size={18} /> Transcripción Completa</h2>
                <ChevronDown size={18} />
              </div>
              {expandedSections.transcript && (
                <>
                  <div className="mt-4 p-4 bg-slate-50 rounded-md">
                    <pre className="whitespace-pre-wrap text-sm font-mono">{session.transcript}</pre>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!session.transcript || !session.transcript.trim()) {
                          addToast('error', 'No hay transcripción para resumir.');
                          return;
                        }
                        try {
                          setIsGeneratingSummary(true);
                          const summary = await summarize(session.transcript, session.language);
                          const updated = { ...session, summary } as Session;
                          await onUpdate(updated);
                          addToast('success', 'Resumen regenerado y guardado.');
                        } catch (err) {
                          const msg = err instanceof Error ? err.message : 'Error al generar resumen';
                          addToast('error', `No se pudo generar el resumen: ${msg}`);
                        } finally {
                          setIsGeneratingSummary(false);
                        }
                      }}
                      disabled={isGeneratingSummary || summarizing}
                      className="px-4 py-2 bg-amber-600 text-white rounded-md ml-2 disabled:opacity-50"
                    >
                      {isGeneratingSummary || summarizing ? 'Generando resumen...' : 'Volver a generar resumen'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Export */}
          <div className="cursor-pointer" onClick={() => toggleSection('export')}>
            <div className="bg-white rounded-2xl border p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2"><Download size={18} /> Exportar</h2>
                <ChevronDown size={18} />
              </div>
              {expandedSections.export && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button onClick={() => exportToFile(session, 'txt')} className="px-4 py-3 bg-blue-600 text-white rounded-md">TXT</button>
                  <button onClick={() => exportToFile(session, 'md')} className="px-4 py-3 bg-indigo-600 text-white rounded-md">Markdown</button>
                  <button onClick={() => exportToFile(session, 'json')} className="px-4 py-3 bg-slate-700 text-white rounded-md">JSON</button>
                  <button onClick={handleCopyNotionMarkdown} className="px-4 py-3 bg-purple-600 text-white rounded-md">Notion</button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// --- Helper functions (kept robust parsing and sanitization) ---
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
  let source: Record<string, unknown> = {};
  if (typeof summary === 'string') {
    const trimmed = summary.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
        if (jsonMatch) source = JSON.parse(fixJsonString(jsonMatch[0]));
        else source = JSON.parse(fixJsonString(trimmed));
      } catch {
        return { executiveSummary: trimmed, keyPoints: [], lectureNotes: '', actionableInsights: [] };
      }
    } else {
      return { executiveSummary: trimmed, keyPoints: [], lectureNotes: '', actionableInsights: [] };
    }
  } else if (!summary || typeof summary !== 'object') {
    return null;
  } else {
    source = summary as Record<string, unknown>;
  }

  let extractedSrc = source.summary ? (source.summary as Record<string, unknown>) : source;
  let executiveSummary = toText(extractedSrc.executiveSummary || extractedSrc.resumen || extractedSrc.summary || '');
  let keyPoints = toList(extractedSrc.keyPoints || extractedSrc.puntosClave || extractedSrc.puntos_clave || []);
  let lectureNotes = toText(extractedSrc.lectureNotes || extractedSrc.notas || extractedSrc.notasDeClase || '');
  let actionableInsights = toList(extractedSrc.actionableInsights || extractedSrc.conceptosAplicables || extractedSrc.insights || []);

  // If the LLM put the structured JSON inside the executiveSummary as a code block or string,
  // try to parse it and merge into extractedSrc so metadata and other fields are properly populated.
  try {
    const inner = parseJsonFromString(executiveSummary);
    if (inner && typeof inner === 'object') {
      extractedSrc = { ...extractedSrc, ...inner } as Record<string, unknown>;
      executiveSummary = toText(extractedSrc.executiveSummary || extractedSrc.resumen || extractedSrc.summary || '');
      keyPoints = toList(extractedSrc.keyPoints || extractedSrc.puntosClave || extractedSrc.puntos_clave || []);
      lectureNotes = toText(extractedSrc.lectureNotes || extractedSrc.notas || extractedSrc.notasDeClase || '');
      actionableInsights = toList(extractedSrc.actionableInsights || extractedSrc.conceptosAplicables || extractedSrc.insights || []);
    }
  } catch (e) {
    // ignore parse errors and keep original values
  }

  if (!executiveSummary && keyPoints.length === 0 && !lectureNotes && actionableInsights.length === 0) {
    if (typeof summary === 'string') return { executiveSummary: summary, keyPoints: [], lectureNotes: '', actionableInsights: [] };
  }

  // extract high-complexity fields when present
  const metadata = extractedSrc.metadata && typeof extractedSrc.metadata === 'object' ? (extractedSrc.metadata as Record<string, unknown>) : {
    subject: toText((extractedSrc as any).subject || ''),
    unit: toText((extractedSrc as any).unit || ''),
    sessionNumber: toText((extractedSrc as any).sessionNumber || ''),
    thematicAxis: toText((extractedSrc as any).thematicAxis || ''),
    keywords: toList((extractedSrc as any).keywords || []),
  };

  const learningOutcomes = {
    competencies: toList((extractedSrc.learningOutcomes && (extractedSrc.learningOutcomes as any).competencies) || (extractedSrc as any).competencies || []),
    mainProblem: toText((extractedSrc.learningOutcomes && (extractedSrc.learningOutcomes as any).mainProblem) || (extractedSrc as any).mainProblem || ''),
  };

  const theoreticalCore = {
    concepts: toText((extractedSrc.theoreticalCore && (extractedSrc.theoreticalCore as any).concepts) || (extractedSrc as any).concepts || ''),
    modelsStandards: toText((extractedSrc.theoreticalCore && (extractedSrc.theoreticalCore as any).modelsStandards) || (extractedSrc as any).modelsStandards || ''),
    referencedAuthors: toList((extractedSrc.theoreticalCore && (extractedSrc.theoreticalCore as any).referencedAuthors) || (extractedSrc as any).referencedAuthors || []),
  };

  const comparativeAnalysis = {
    prosCons: toText((extractedSrc.comparativeAnalysis && (extractedSrc.comparativeAnalysis as any).prosCons) || (extractedSrc as any).prosCons || ''),
    comparisons: toText((extractedSrc.comparativeAnalysis && (extractedSrc.comparativeAnalysis as any).comparisons) || (extractedSrc as any).comparisons || ''),
    contextOfUse: toText((extractedSrc.comparativeAnalysis && (extractedSrc.comparativeAnalysis as any).contextOfUse) || (extractedSrc as any).contextOfUse || ''),
  };

  const examples = {
    academicExample: toText((extractedSrc.examples && (extractedSrc.examples as any).academicExample) || (extractedSrc as any).academicExample || ''),
    caseStudy: toText((extractedSrc.examples && (extractedSrc.examples as any).caseStudy) || (extractedSrc as any).caseStudy || ''),
    antipatterns: toText((extractedSrc.examples && (extractedSrc.examples as any).antipatterns) || (extractedSrc as any).antipatterns || ''),
  };

  const technicalComponent = {
    codeSnippets: toText((extractedSrc.technicalComponent && (extractedSrc.technicalComponent as any).codeSnippets) || (extractedSrc as any).codeSnippets || ''),
    tools: toList((extractedSrc.technicalComponent && (extractedSrc.technicalComponent as any).tools) || (extractedSrc as any).tools || []),
    diagrams: toText((extractedSrc.technicalComponent && (extractedSrc.technicalComponent as any).diagrams) || (extractedSrc as any).diagrams || ''),
  };

  const debate = {
    controversies: toText((extractedSrc.debate && (extractedSrc.debate as any).controversies) || (extractedSrc as any).controversies || ''),
    participantContributions: toText((extractedSrc.debate && (extractedSrc.debate as any).participantContributions) || (extractedSrc as any).participantContributions || ''),
  };

  const interdisciplinary = {
    relations: toText((extractedSrc.interdisciplinary && (extractedSrc.interdisciplinary as any).relations) || (extractedSrc as any).relations || ''),
    workplaceApplications: toText((extractedSrc.interdisciplinary && (extractedSrc.interdisciplinary as any).workplaceApplications) || (extractedSrc as any).workplaceApplications || ''),
  };

  const keyTakeaways = toList(extractedSrc.keyTakeaways || (extractedSrc as any).keyTakeaways || []);

  const references = {
    readings: toList((extractedSrc.references && (extractedSrc.references as any).readings) || (extractedSrc as any).readings || []),
    questionsForStudy: toList((extractedSrc.references && (extractedSrc.references as any).questionsForStudy) || (extractedSrc as any).questionsForStudy || []),
  };

  return { executiveSummary, keyPoints, lectureNotes, actionableInsights, metadata, learningOutcomes, theoreticalCore, comparativeAnalysis, examples, technicalComponent, debate, interdisciplinary, keyTakeaways, references };
}

function toText(value: unknown): string {
  if (typeof value === 'string') {
    let s = value.trim();
    if ((s.startsWith('{') || s.startsWith('[')) && (s.endsWith('}') || s.endsWith(']'))) {
      try { const parsed = JSON.parse(fixJsonString(s)); return toText(parsed); } catch { return s; }
    }
    s = s.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    return s;
  }
  if (Array.isArray(value)) return value.map(item => toText(item).trim()).filter(Boolean).join('\n\n');
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).map(v => toText(v)).filter(Boolean).join('\n\n');
  return value == null ? '' : String(value);
}

function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => toText(item).trim().replace(/^['\"]|['\"]$/g, '')).filter(Boolean);
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).map(item => toText(item).trim()).filter(Boolean);
  const text = toText(value).trim();
  return text ? text.split(/\n+/).map(l => l.trim()).filter(Boolean) : [];
}

function sanitizeSummaryText(s: string): string {
  if (!s) return '';
  let text = String(s).trim();
  if (text.startsWith('{')) {
    try { const parsed = JSON.parse(fixJsonString(text)); if (parsed && typeof parsed === 'object' && (parsed as any).executiveSummary) text = String((parsed as any).executiveSummary).trim(); } catch {}
  }
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) text = text.slice(1, -1).trim();
  text = text.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\t/g, '\t');
  return text;
}

function parseLectureNotes(text: string) {
  if (!text || !text.trim()) return [];
  const cleanText = text.replace(/\\n/g, '\n').replace(/\\"/g, '"');
  const headers = ['TEMAS PRINCIPALES','DEFINICIONES','EJEMPLOS','EXPLICACIONES','ESTRUCTURA LÓGICA','CONEXIONES','CONCEPTOS CLAVES','RESUMEN','INTRODUCCIÓN','CONCLUSIONES'];
  const blocks: { title: string; content: string }[] = [];
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);
  let currentTitle = 'Ideas Generales';
  let currentContent: string[] = [];
  lines.forEach(line => {
    const isKnownHeader = headers.some(h => line.toUpperCase() === h || line.toUpperCase().includes(h + ':'));
    const isAllCaps = /^[A-ZÁÉÍÓÚÑ\s]{3,40}$/.test(line.replace(/[0-9:.-]/g, '').trim());
    if (isKnownHeader || (isAllCaps && !line.includes(' '))) {
      if (currentContent.length > 0) { blocks.push({ title: currentTitle, content: currentContent.join('\n\n') }); currentContent = []; }
      currentTitle = line.replace(/[:*]/g, '').trim();
    } else {
      currentContent.push(line);
    }
  });
  if (currentContent.length > 0) blocks.push({ title: currentTitle, content: currentContent.join('\n\n') });
  return blocks.filter(b => b.content.trim() !== '');
}

function parseJsonFromString(raw: string): any | null {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();
  // try fenced code block first
  const codeBlockMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = codeBlockMatch ? codeBlockMatch[1] : (s.match(/\{[\s\S]*\}/)?.[0] || null);
  if (!candidate) return null;
  try {
    return JSON.parse(fixJsonString(candidate));
  } catch (e) {
    try {
      // last resort: try to unescape quotes and parse
      const unescaped = candidate.replace(/\\"/g, '"').replace(/\\n/g, '\n');
      return JSON.parse(unescaped);
    } catch {
      return null;
    }
  }
}
