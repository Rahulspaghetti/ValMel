import { NextRequest, NextResponse } from 'next/server';
import { query, ensureTables } from '@/lib/db';

interface SubtitleRow {
  id: number;
  video_id: number;
  language: string;
  label: string;
  created_at: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const vid = parseInt(id, 10);
  if (isNaN(vid)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

  try {
    await ensureTables();
    const body = await req.json();
    const { pin, language, label, vtt_content } = body;

    if (pin !== '8548') return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    if (!language?.trim()) return NextResponse.json({ error: 'Language required.' }, { status: 400 });
    if (!label?.trim()) return NextResponse.json({ error: 'Label required.' }, { status: 400 });
    if (!vtt_content?.trimStart().startsWith('WEBVTT'))
      return NextResponse.json({ error: 'VTT content must start with WEBVTT.' }, { status: 400 });

    const [row] = await query<SubtitleRow>(
      `INSERT INTO subtitles (video_id, language, label, content)
       VALUES ($1, $2, $3, $4)
       RETURNING id, video_id, language, label, created_at`,
      [vid, language.trim(), label.trim(), vtt_content],
    );
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error('[videos/id/subtitles] POST error:', err);
    return NextResponse.json({ error: 'Failed to add subtitle.' }, { status: 500 });
  }
}
