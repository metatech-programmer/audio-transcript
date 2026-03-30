"use client";

import React, { useEffect, useState } from "react";
import { PlusCircle, Trash2 } from "lucide-react";

interface SubjectSelectorProps {
  value?: string | null;
  onChange?: (v: string | null) => void;
}

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

export default function SubjectSelector({ value, onChange }: SubjectSelectorProps) {
  const [subjects, setSubjects] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    setSubjects(loadSubjects());
  }, []);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    if (subjects.includes(name)) {
      setNewName("");
      setAdding(false);
      onChange?.(name);
      return;
    }
    const next = [...subjects, name];
    setSubjects(next);
    saveSubjects(next);
    setNewName("");
    setAdding(false);
    onChange?.(name);
  };

  // Subject deletion is handled from the Settings modal.
  const handleDelete = (n: string) => {
    // kept for possible future use but does not expose UI here
    const next = subjects.filter((s) => s !== n);
    setSubjects(next);
    saveSubjects(next);
    if (value === n) onChange?.(null);
  };

  return (
    <div>
      <label className="text-[13px] font-semibold text-slate-700 flex items-center gap-2">
        Materia
      </label>
      <div className="mt-1 flex items-center gap-2 min-w-0">
        <select
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value || null)}
          className="flex-1 px-3 py-2 bg-white border border-[#EAEAEB] rounded-md text-[13px] text-slate-800 shadow-sm min-w-0 truncate overflow-hidden max-w-[70dvw] md:max-w-[45dvw] lg:max-w-[30dvw]"
        >
          <option value="">Sin clasificar</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <button
          onClick={() => setAdding((a) => !a)}
          className="h-10 w-10 flex items-center justify-center rounded-md border border-[#EAEAEB] bg-white hover:bg-slate-50 flex-shrink-0"
          aria-label="Add subject"
        >
          <PlusCircle size={18} className="text-slate-600" />
        </button>
      </div>

      {adding && (
        <div className="mt-2 flex gap-2 min-w-0">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre de la materia"
            className="flex-1 px-3 py-2 border rounded text-[13px] min-w-0 truncate overflow-hidden max-w-[70dvw] md:max-w-[45dvw] lg:max-w-[30dvw]"
          />
          <button onClick={handleAdd} className="px-3 py-2 bg-slate-900 text-white rounded">
            Crear
          </button>
          <button
            onClick={() => {
              setAdding(false);
              setNewName("");
            }}
            className="px-3 py-2 border rounded"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Subjects list is managed in Settings. Keep selector compact. */}
    </div>
  );
}
