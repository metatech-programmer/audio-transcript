import { NextRequest, NextResponse } from "next/server";
import { dbGetSession, dbUpdateSession, dbDeleteSession } from "@/lib/db";

/**
 * GET /api/sessions/:id
 * Retrieve a specific session
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await dbGetSession(id);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error("Get session error:", error);
    return NextResponse.json({ error: "Failed to retrieve session" }, { status: 500 });
  }
}

/**
 * PUT /api/sessions/:id
 * Update a specific session
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();

    const existing = await dbGetSession(id);
    if (!existing) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const updated = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const result = await dbUpdateSession(updated);
    return NextResponse.json({ session: result });
  } catch (error) {
    console.error("Update session error:", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

/**
 * DELETE /api/sessions/:id
 * Delete a specific session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await dbGetSession(id);
    if (!existing) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    await dbDeleteSession(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete session error:", error);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
