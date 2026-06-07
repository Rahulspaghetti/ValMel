import { NextRequest, NextResponse } from 'next/server';
import { query, ensureTables, isValidPin, MASTER_PIN } from '@/lib/db';

interface SubtitleContent {
  content: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sid = parseInt(id, 10);
  if (isNaN(sid)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

  const pin = new URL(req.url).searchParams.get('pin');
  if (!(await isValidPin(pin))) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    await ensureTables();
    const rows = await query<SubtitleContent>(
      `SELECT content FROM subtitles WHERE id = $1`,
      [sid],
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

    return new NextResponse(rows[0].content, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('[subtitles/id] GET error:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const pin = new URL(req.url).searchParams.get('pin');
  if (pin !== MASTER_PIN) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const sid = parseInt(id, 10);
  if (isNaN(sid)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

  try {
    await query(`DELETE FROM subtitles WHERE id = $1`, [sid]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[subtitles/id] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete subtitle.' }, { status: 500 });
  }
}
