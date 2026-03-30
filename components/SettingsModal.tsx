"use client";

import React, { useEffect, useState } from "react";
import { X, Plus, Trash2, Settings } from "lucide-react";
import { API } from "@/lib/api";

const STORAGE_KEY = "audio_transcript_subjects_v1";

function loadSubjects(): string[] {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function saveSubjects(items: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [subjects, setSubjects] = useState<string[]>([]);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    setSubjects(loadSubjects());
  }, [open]);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    if (subjects.includes(name)) {
      setNewName("");
      return;
    }
    const next = [...subjects, name];
    setSubjects(next);
    saveSubjects(next);
    setNewName("");
  };

  const handleDelete = (name: string) => {
    const next = subjects.filter((s) => s !== name);
    setSubjects(next);
    saveSubjects(next);

    // Also remove subject assignment from any session that used it
    (async () => {
      try {
        const resp: any = await API.getSessions();
        const all: any[] = resp.sessions || [];
        const toUpdate = all.filter((ss) => ss.subject === name);
        await Promise.all(toUpdate.map((ss) => API.updateSession(ss.id, { ...ss, subject: "" })));
      } catch (err) {
        console.error("Failed to clear subject from sessions:", err);
      }
    })();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative w-full max-w-lg bg-white rounded-lg shadow-lg p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Settings size={18} /> Ajustes
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <section className="mb-4">
          <h4 className="text-sm font-semibold text-slate-800 mb-2">Materias</h4>
          <p className="text-xs text-slate-500 mb-3">
            Gestiona las materias aquí. Eliminarlas las quitará de la lista disponible.
          </p>

          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nueva materia"
              className="flex-1 px-3 py-2 border rounded"
            />
            <button
              onClick={handleAdd}
              className="px-3 py-2 bg-slate-900 text-white rounded flex items-center gap-2"
            >
              <Plus size={14} />
              Agregar
            </button>
          </div>

          <div className="mt-4 grid gap-2">
            {subjects.length === 0 ? (
              <div className="text-sm text-slate-500">No hay materias aún.</div>
            ) : (
              subjects.map((s) => (
                <div
                  key={s}
                  className="flex items-center justify-between px-3 py-2 rounded border bg-[#FBFBFC]"
                >
                  <div className="truncate">{s}</div>
                  <button
                    onClick={() => handleDelete(s)}
                    className="p-1 rounded hover:bg-red-50 text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded border">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
