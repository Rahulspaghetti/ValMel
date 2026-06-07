import { NextRequest, NextResponse } from 'next/server';
import { isValidPin } from '@/lib/db';

export async function GET(req: NextRequest) {
  const pin = new URL(req.url).searchParams.get('pin');
  try {
    const valid = await isValidPin(pin);
    return NextResponse.json({ valid });
  } catch (err) {
    console.error('[auth/pin] GET error:', err);
    return NextResponse.json({ error: 'Validation failed.' }, { status: 500 });
  }
}
