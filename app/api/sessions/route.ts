import { NextResponse } from 'next/server';
import { query, ensureTables } from '@/lib/db';

interface SessionRow {
  session_id: string;
  created_at: string;
  preview: string;
}

export async function GET() {
  try {
    await ensureTables();
    const rows = await query<SessionRow>(`
      SELECT s.session_id, s.created_at,
             (SELECT m.intent FROM messages m
              WHERE m.session_id = s.session_id
              ORDER BY m.created_at ASC LIMIT 1) AS preview
      FROM sessions s
      ORDER BY s.created_at DESC
      LIMIT 20
    `);
    return NextResponse.json(rows);
  } catch (err) {
    console.error('[sessions] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch sessions.' }, { status: 500 });
  }
}
