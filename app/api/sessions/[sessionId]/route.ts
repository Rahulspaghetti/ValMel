import { NextRequest, NextResponse } from 'next/server';
import { query, ensureTables } from '@/lib/db';

interface MessageRow {
  intent: string;
  response: string;
  filename: string | null;
  created_at: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  try {
    await ensureTables();
    const rows = await query<MessageRow>(
      `SELECT intent, response, filename, created_at
       FROM messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId],
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('[sessions/id] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch messages.' }, { status: 500 });
  }
}
