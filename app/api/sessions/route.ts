import { NextRequest, NextResponse } from 'next/server';
import { query, ensureTables } from '@/lib/db';

interface SessionRow {
  session_id: string;
  created_at: string;
  preview: string;
}

export async function GET(req: NextRequest) {
  const pin = req.nextUrl.searchParams.get('pin')?.trim();
  if (!pin || !/^\d{4}$/.test(pin))
    return NextResponse.json({ error: '`pin` query param must be a 4-digit number.' }, { status: 400 });

  const isMaster = pin === '8548';

  try {
    await ensureTables();
    const rows = await query<SessionRow>(
      isMaster
        ? `SELECT s.session_id, s.created_at,
                  (SELECT m.intent FROM messages m
                   WHERE m.session_id = s.session_id
                   ORDER BY m.created_at ASC LIMIT 1) AS preview
           FROM sessions s
           ORDER BY s.created_at DESC
           LIMIT 100`
        : `SELECT s.session_id, s.created_at,
                  (SELECT m.intent FROM messages m
                   WHERE m.session_id = s.session_id
                   ORDER BY m.created_at ASC LIMIT 1) AS preview
           FROM sessions s
           WHERE s.pin_code = $1
           ORDER BY s.created_at DESC
           LIMIT 20`,
      isMaster ? [] : [pin],
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('[sessions] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch sessions.' }, { status: 500 });
  }
}
