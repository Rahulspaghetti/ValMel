import { NextRequest, NextResponse } from 'next/server';
import { query, ensureTables } from '@/lib/db';

interface VideoRow {
  id: number;
  title: string;
  thumbnail_url: string | null;
  duration: number | null;
  created_at: string;
}

export async function GET() {
  try {
    await ensureTables();
    const rows = await query<VideoRow>(
      `SELECT id, title, thumbnail_url, duration, created_at FROM videos ORDER BY created_at DESC`,
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('[videos] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch videos.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json();
    const { pin, title, description, thumbnail_url, url_360p, url_720p, url_1080p, duration } = body;

    if (pin !== '8548') return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    if (!title?.trim()) return NextResponse.json({ error: 'Title required.' }, { status: 400 });
    if (!url_360p && !url_720p && !url_1080p)
      return NextResponse.json({ error: 'At least one quality URL required.' }, { status: 400 });

    const [row] = await query<VideoRow>(
      `INSERT INTO videos (title, description, thumbnail_url, url_360p, url_720p, url_1080p, duration)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, thumbnail_url, duration, created_at`,
      [title.trim(), description ?? null, thumbnail_url ?? null, url_360p ?? null, url_720p ?? null, url_1080p ?? null, duration ?? null],
    );
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error('[videos] POST error:', err);
    return NextResponse.json({ error: 'Failed to create video.' }, { status: 500 });
  }
}
