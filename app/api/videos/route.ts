import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { query, ensureTables, isValidPin, MASTER_PIN } from '@/lib/db';

async function generateDescription(title: string): Promise<string | null> {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const res = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Write a brief, evocative 1-2 sentence description for the movie "${title}". Tone: warm, slightly lyrical, suitable for a personal romantic gift website. No quotes around the answer, no preface like "Here is...". Just the description.`,
      }],
    });
    const block = res.content[0];
    return block?.type === 'text' ? block.text.trim() : null;
  } catch (err) {
    console.error('[videos] description generation failed:', err);
    return null;
  }
}

interface VideoRow {
  id: number;
  title: string;
  thumbnail_url: string | null;
  duration: number | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  try {
    const pin = new URL(req.url).searchParams.get('pin');
    if (!(await isValidPin(pin))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
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

    if (pin !== MASTER_PIN) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    if (!title?.trim()) return NextResponse.json({ error: 'Title required.' }, { status: 400 });
    if (!url_360p && !url_720p && !url_1080p)
      return NextResponse.json({ error: 'At least one quality URL required.' }, { status: 400 });

    let finalDescription: string | null = description?.trim() || null;
    if (!finalDescription) {
      finalDescription = await generateDescription(title.trim());
    }

    const [row] = await query<VideoRow>(
      `INSERT INTO videos (title, description, thumbnail_url, url_360p, url_720p, url_1080p, duration)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, thumbnail_url, duration, created_at`,
      [title.trim(), finalDescription, thumbnail_url ?? null, url_360p ?? null, url_720p ?? null, url_1080p ?? null, duration ?? null],
    );
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error('[videos] POST error:', err);
    return NextResponse.json({ error: 'Failed to create video.' }, { status: 500 });
  }
}
