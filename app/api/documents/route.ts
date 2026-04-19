import { NextRequest, NextResponse } from 'next/server';
import { query, ensureTables } from '@/lib/db';

interface DocRow {
  id: number;
  title: string;
  created_at: string;
}

export async function GET() {
  try {
    await ensureTables();
    const rows = await query<DocRow>(
      `SELECT id, title, created_at FROM documents ORDER BY created_at DESC`,
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('[documents] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch documents.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const form = await req.formData();
    const file  = form.get('file') as File | null;
    const title = (form.get('title') as string | null)?.trim();

    if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    if (!file.name.endsWith('.md'))
      return NextResponse.json({ error: 'Only .md files accepted.' }, { status: 415 });

    const content = await file.text();
    const docTitle = title || file.name.replace(/\.md$/, '');

    const [row] = await query<DocRow>(
      `INSERT INTO documents (title, content) VALUES ($1, $2) RETURNING id, title, created_at`,
      [docTitle, content],
    );
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error('[documents] POST error:', err);
    return NextResponse.json({ error: 'Failed to save document.' }, { status: 500 });
  }
}
