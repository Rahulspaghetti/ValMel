import { NextRequest, NextResponse } from 'next/server';
import { query, ensureTables, isValidPin, MASTER_PIN } from '@/lib/db';

interface VideoFull {
  id: number;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  url_360p: string | null;
  url_720p: string | null;
  url_1080p: string | null;
  duration: number | null;
  created_at: string;
  subtitles: { id: number; language: string; label: string }[];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const vid = parseInt(id, 10);
  if (isNaN(vid)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

  const pin = new URL(req.url).searchParams.get('pin');
  if (!(await isValidPin(pin))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    await ensureTables();
    const rows = await query<VideoFull & { sub_id: number | null; sub_language: string | null; sub_label: string | null }>(
      `SELECT v.id, v.title, v.description, v.thumbnail_url,
              v.url_360p, v.url_720p, v.url_1080p, v.duration, v.created_at,
              s.id AS sub_id, s.language AS sub_language, s.label AS sub_label
       FROM videos v
       LEFT JOIN subtitles s ON s.video_id = v.id
       WHERE v.id = $1
       ORDER BY s.id`,
      [vid],
    );

    if (rows.length === 0) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

    const first = rows[0];
    const video: VideoFull = {
      id: first.id,
      title: first.title,
      description: first.description,
      thumbnail_url: first.thumbnail_url,
      url_360p: first.url_360p,
      url_720p: first.url_720p,
      url_1080p: first.url_1080p,
      duration: first.duration,
      created_at: first.created_at,
      subtitles: rows
        .filter(r => r.sub_id !== null)
        .map(r => ({ id: r.sub_id as number, language: r.sub_language as string, label: r.sub_label as string })),
    };

    return NextResponse.json(video);
  } catch (err) {
    console.error('[videos/id] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch video.' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const vid = parseInt(id, 10);
  if (isNaN(vid)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

  try {
    await ensureTables();
    const body = await req.json();
    const { pin, title, description, thumbnail_url, url_360p, url_720p, url_1080p, duration } = body;

    if (pin !== MASTER_PIN) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    if (!title?.trim()) return NextResponse.json({ error: 'Title required.' }, { status: 400 });

    const [row] = await query<{ id: number; title: string; thumbnail_url: string | null; duration: number | null; created_at: string }>(
      `UPDATE videos SET title=$1, description=$2, thumbnail_url=$3,
        url_360p=$4, url_720p=$5, url_1080p=$6, duration=$7
       WHERE id=$8
       RETURNING id, title, thumbnail_url, duration, created_at`,
      [title.trim(), description ?? null, thumbnail_url ?? null,
       url_360p ?? null, url_720p ?? null, url_1080p ?? null,
       duration ?? null, vid],
    );

    if (!row) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    console.error('[videos/id] PUT error:', err);
    return NextResponse.json({ error: 'Failed to update video.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const pin = new URL(req.url).searchParams.get('pin');
  if (pin !== '8548') return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const vid = parseInt(id, 10);
  if (isNaN(vid)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

  try {
    await query(`DELETE FROM videos WHERE id = $1`, [vid]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[videos/id] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete video.' }, { status: 500 });
  }
}
