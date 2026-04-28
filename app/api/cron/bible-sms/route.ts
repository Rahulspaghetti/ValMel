import { NextRequest } from 'next/server';
import twilio from 'twilio';
import { getDailyVerse } from '@/lib/bible';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const verse = await getDailyVerse();
  const body = `Good morning! 🌅\n\n${verse.reference}\n\n"${verse.text}"`;

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  await client.messages.create({
    body,
    from: process.env.TWILIO_FROM_NUMBER!,
    to: process.env.RECIPIENT_PHONE!,
  });

  return Response.json({ success: true, reference: verse.reference });
}
