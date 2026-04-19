import { NextRequest, NextResponse } from 'next/server';
import { query, ensureTables } from '@/lib/db';

interface MessageRow {
  intent: string;
  response: string;
  filename: string | null;
  created_at: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const pin = req.nextUrl.searchParams.get('pin')?.trim();
  if (!pin || !/^\d{4}$/.test(pin))
    return NextResponse.json({ error: '`pin` query param must be a 4-digit number.' }, { status: 400 });

  try {
    await ensureTables();
    // Verify this session belongs to the given pin
    const session = await query<{ session_id: string }>(
      `SELECT session_id FROM sessions WHERE session_id = $1 AND pin_code = $2`,
      [sessionId, pin],
    );
    if (session.length === 0)
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });

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
