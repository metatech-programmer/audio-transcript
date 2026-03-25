import { NextRequest, NextResponse } from 'next/server';
import { dbSaveSession, dbGetSessions, dbGetSession, dbUpdateSession, dbDeleteSession } from '@/lib/db';
import type { DBSession } from '@/lib/db';

/**
 * GET /api/sessions
 * Retrieve all sessions
 */
export async function GET() {
  try {
    const sessions = await dbGetSessions();
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    return NextResponse.json({ error: 'Failed to retrieve sessions' }, { status: 500 });
  }
}

/**
 * POST /api/sessions
 * Create a new session
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    const session: DBSession = {
      id: data.id || generateId(),
      title: data.title || 'Untitled Lecture',
      date: data.date || new Date().toISOString(),
      duration: data.duration || 0,
      language: data.language || 'en',
      subject: data.subject || undefined,
      transcript: data.transcript || '',
      summary: data.summary || null,
      tags: data.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await dbSaveSession(session);
    return NextResponse.json({ session: saved });
  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/sessions/:id
 * Update a session
 */
export async function PUT(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname;
    const id = pathname.split('/').pop();

    if (!id) {
      return NextResponse.json({ error: 'Missing session ID' }, { status: 400 });
    }

    const data = await request.json();

    const existing = await dbGetSession(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const updated: DBSession = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const result = await dbUpdateSession(updated);
    return NextResponse.json({ session: result });
  } catch (error) {
    console.error('Update session error:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions/:id
 * Delete a session
 */
export async function DELETE(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname;
    const id = pathname.split('/').pop();

    if (!id) {
      return NextResponse.json({ error: 'Missing session ID' }, { status: 400 });
    }

    await dbDeleteSession(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete session error:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}

function generateId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
