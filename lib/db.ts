/**
 * Database utilities for Vercel KV
 * Fallback to localStorage if KV not available
 */

import { kv } from '@vercel/kv';

const USE_KV = process.env.USE_KV_DATABASE === 'true';
const memorySessions = new Map<string, DBSession>();

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
 */
export async function dbSaveSession(session: DBSession): Promise<DBSession> {
  if (USE_KV) {
    try {
      await kv.hset(`session:${session.id}`, session as any);
      await kv.lpush('sessions:list', session.id);
    } catch (error) {
      console.error('KV save error, falling back to memory:', error);
    }
  }

  memorySessions.set(session.id, session);
  return session;
}

/**
 * Get all sessions
 */
export async function dbGetSessions(): Promise<DBSession[]> {
  if (!USE_KV) {
    return Array.from(memorySessions.values()).sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  try {
    const sessionIds = (await kv.lrange('sessions:list', 0, -1)) as string[];
    const sessions = [];

    for (const id of sessionIds) {
      const session = await kv.hgetall(`session:${id}`);
      if (session && Object.keys(session).length > 0) {
        sessions.push(session as unknown as DBSession);
      }
    }

    return sessions.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error('DB error:', error);
    return [];
  }
}

/**
 * Get a session by ID
 */
export async function dbGetSession(id: string): Promise<DBSession | null> {
  if (!USE_KV) return memorySessions.get(id) || null;

  try {
    const session = await kv.hgetall(`session:${id}`);
    return session && Object.keys(session).length > 0
      ? (session as unknown as DBSession)
      : null;
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
  if (USE_KV) {
    try {
      await kv.hset(`session:${session.id}`, session as any);
    } catch (error) {
      console.error('KV update error, falling back to memory:', error);
    }
  }

  memorySessions.set(session.id, session);
  return session;
}

/**
 * Delete a session
 */
export async function dbDeleteSession(id: string): Promise<void> {
  if (USE_KV) {
    try {
      await kv.del(`session:${id}`);
      await kv.lrem('sessions:list', 1, id);
    } catch (error) {
      console.error('KV delete error:', error);
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
    (s) =>
      s.title.toLowerCase().includes(lowerQuery) ||
      s.transcript.toLowerCase().includes(lowerQuery)
  );
}
