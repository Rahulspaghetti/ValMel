import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await query(`DELETE FROM documents WHERE id = $1`, [parseInt(id, 10)]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[documents/id] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete document.' }, { status: 500 });
  }
}
