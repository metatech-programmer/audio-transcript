/**
 * Database utilities using Supabase as primary store.
 * Falls back to in-memory map when Supabase not configured.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_KEY);

const memorySessions = new Map<string, DBSession>();

let supabase: SupabaseClient | null = null;
if (USE_SUPABASE) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });
}

export interface DBSession {
  id: string;
  title: string;
  date: string;
  duration: number;
  language: 'en' | 'es';
  transcript: string;
  summary: any;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Save a session to database
 * Assumes a Supabase table `sessions` with columns: id (text PK), data (jsonb), created_at, updated_at
 */
export async function dbSaveSession(session: DBSession): Promise<DBSession> {
  session.createdAt = session.createdAt || new Date().toISOString();
  session.updatedAt = session.updatedAt || session.createdAt;

  if (USE_SUPABASE && supabase) {
    try {
      await supabase.from('sessions').upsert({ id: session.id, data: session, created_at: session.createdAt, updated_at: session.updatedAt });
    } catch (error) {
      console.error('Supabase save error, falling back to memory:', error);
    }
  }

  memorySessions.set(session.id, session);
  return session;
}

/**
 * Get all sessions
 */
export async function dbGetSessions(): Promise<DBSession[]> {
  if (!USE_SUPABASE || !supabase) {
    return Array.from(memorySessions.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  try {
    const { data, error } = await supabase.from('sessions').select('id, data').order('created_at', { ascending: false });
    if (error) {
      console.error('Supabase query error:', error);
      return [];
    }

    const sessions: DBSession[] = (data || []).map((row: any) => row.data as DBSession);
    return sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('DB error:', error);
    return [];
  }
}

/**
 * Get a session by ID
 */
export async function dbGetSession(id: string): Promise<DBSession | null> {
  if (!USE_SUPABASE || !supabase) return memorySessions.get(id) || null;

  try {
    const { data, error } = await supabase.from('sessions').select('data').eq('id', id).single();
    if (error) {
      console.error('Supabase get error:', error);
      return null;
    }

    return data ? (data.data as DBSession) : null;
  } catch (error) {
    console.error('DB error:', error);
    return null;
  }
}

/**
 * Update a session
 */
export async function dbUpdateSession(session: DBSession): Promise<DBSession> {
  session.updatedAt = new Date().toISOString();

  if (USE_SUPABASE && supabase) {
    try {
      await supabase.from('sessions').upsert({ id: session.id, data: session, updated_at: session.updatedAt });
    } catch (error) {
      console.error('Supabase update error, falling back to memory:', error);
    }
  }

  memorySessions.set(session.id, session);
  return session;
}

/**
 * Delete a session
 */
export async function dbDeleteSession(id: string): Promise<void> {
  if (USE_SUPABASE && supabase) {
    try {
      await supabase.from('sessions').delete().eq('id', id);
    } catch (error) {
      console.error('Supabase delete error:', error);
    }
  }

  memorySessions.delete(id);
}

/**
 * Search sessions by tag
 */
export async function dbGetSessionsByTag(tag: string): Promise<DBSession[]> {
  const sessions = await dbGetSessions();
  return sessions.filter((s) => s.tags.includes(tag));
}

/**
 * Search sessions by query
 */
export async function dbSearchSessions(query: string): Promise<DBSession[]> {
  const sessions = await dbGetSessions();
  const lowerQuery = query.toLowerCase();

  return sessions.filter(
    (s) => s.title.toLowerCase().includes(lowerQuery) || s.transcript.toLowerCase().includes(lowerQuery)
  );
}
