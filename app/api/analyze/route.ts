import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { query, ensureTables, isValidPin } from '@/lib/db';

const MODEL = 'claude-sonnet-4-6';
const MAX_BYTES = 15 * 1024 * 1024;
const URL_TIMEOUT_MS = 15_000;
const MAX_TEXT_CHARS = 60_000;

const ANALYZE_SYSTEM = `You analyze law sources (cases, statutes, articles, papers) into structured study cards for a law student, Miss Melissa Villagran.

ONLY law-related sources are accepted. If the provided source is NOT about law — science, cooking, coding, pop culture, general news, or any non-legal topic — set law_related to false and leave all other fields empty.

When the source IS law-related, fill the fields accurately and concisely. Write summaries and takeaways in clear, exam-focused language a student can revise from. Use the provided tool to return your answer.`;

const CARD_TOOL: Anthropic.Tool = {
  name: 'present_law_cards',
  description: 'Return structured study cards for a law paper/case. If the source is NOT law-related, set law_related=false and leave other fields empty.',
  input_schema: {
    type: 'object',
    properties: {
      law_related : { type: 'boolean', description: 'True only if the source is about law.' },
      title       : { type: 'string' },
      citation    : { type: 'string', description: 'e.g. "Roe v. Wade, 410 U.S. 113 (1973)"' },
      parties     : { type: 'string' },
      court       : { type: 'string' },
      year        : { type: 'string' },
      summary     : { type: 'string' },
      holdings    : { type: 'array', items: { type: 'string' } },
      legal_issues: { type: 'array', items: { type: 'string' } },
      key_terms   : {
        type : 'array',
        items: {
          type      : 'object',
          properties: { term: { type: 'string' }, definition: { type: 'string' } },
          required  : ['term', 'definition'],
        },
      },
      takeaways   : { type: 'array', items: { type: 'string' } },
    },
    required: ['law_related'],
  },
};

type MediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
const IMAGE_TYPES: MediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
function isImageType(mime: string): mime is MediaType {
  return IMAGE_TYPES.includes(mime as MediaType);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pdfBlock(buffer: Buffer): Anthropic.ContentBlockParam {
  return {
    type  : 'document',
    source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') },
  } as Anthropic.ContentBlockParam;
}

async function fileToBlock(file: File): Promise<Anthropic.ContentBlockParam> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime   = file.type || 'application/octet-stream';

  if (isImageType(mime)) {
    return {
      type  : 'image',
      source: { type: 'base64', media_type: mime, data: buffer.toString('base64') },
    } as Anthropic.ContentBlockParam;
  }
  if (mime === 'application/pdf') return pdfBlock(buffer);

  return {
    type: 'text',
    text: `<file name="${file.name}" type="${mime}">\n${buffer.toString('utf8').slice(0, MAX_TEXT_CHARS)}\n</file>`,
  } as Anthropic.ContentBlockParam;
}

async function urlToBlock(url: string): Promise<Anthropic.ContentBlockParam> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http/https URLs are allowed.');
  }

  const res = await fetch(parsed.toString(), {
    signal : AbortSignal.timeout(URL_TIMEOUT_MS),
    headers: { 'User-Agent': 'ValMel-StudyCards/1.0' },
  });
  if (!res.ok) throw new Error(`Failed to fetch URL (${res.status}).`);

  const contentType = res.headers.get('content-type') ?? '';
  const buffer      = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) throw new Error('Linked resource is too large.');

  if (contentType.includes('application/pdf')) return pdfBlock(buffer);

  const text = stripHtml(buffer.toString('utf8')).slice(0, MAX_TEXT_CHARS);
  if (!text) throw new Error('Could not extract any text from the link.');
  return {
    type: 'text',
    text: `<source url="${parsed.toString()}">\n${text}\n</source>`,
  } as Anthropic.ContentBlockParam;
}

// ── GET — list past analyses ──────────────────────────────
export async function GET(req: NextRequest) {
  const pin = new URL(req.url).searchParams.get('pin');
  if (!(await isValidPin(pin))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  try {
    await ensureTables();
    const rows = await query(
      `SELECT id, title, source_ref, created_at, data
       FROM analyses WHERE pin_code = $1 ORDER BY created_at DESC LIMIT 50`,
      [pin],
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('[analyze] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch analyses.' }, { status: 500 });
  }
}

// ── POST — analyze a source ───────────────────────────────
export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 });
  }

  const pinCode = (formData.get('pinCode') as string | null)?.trim();
  const url     = (formData.get('url') as string | null)?.trim();
  const file    = formData.get('file') as File | null;

  if (!pinCode || !/^\d{4}$/.test(pinCode))
    return NextResponse.json({ error: '`pinCode` must be a 4-digit number.' }, { status: 400 });
  if (!(await isValidPin(pinCode)))
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!file && !url)
    return NextResponse.json({ error: 'Provide a file or a URL.' }, { status: 400 });
  if (file && file.size > MAX_BYTES)
    return NextResponse.json({ error: 'File exceeds 15 MB limit.' }, { status: 413 });

  try {
    await ensureTables();
  } catch (err) {
    console.error('[analyze] ensureTables failed:', err);
    return NextResponse.json({ error: 'DB init failed.' }, { status: 502 });
  }

  // Build source block
  let sourceBlock: Anthropic.ContentBlockParam;
  let sourceType: 'file' | 'url';
  let sourceRef : string;
  try {
    if (file && file.size > 0) {
      sourceBlock = await fileToBlock(file);
      sourceType  = 'file';
      sourceRef   = file.name;
    } else {
      sourceBlock = await urlToBlock(url!);
      sourceType  = 'url';
      sourceRef   = url!;
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not read source.' }, { status: 400 });
  }

  // Ask Claude for structured cards
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let payload: Record<string, unknown>;
  try {
    const message = await client.messages.create({
      model      : MODEL,
      max_tokens : 2048,
      system     : ANALYZE_SYSTEM,
      tools      : [CARD_TOOL],
      tool_choice: { type: 'tool', name: 'present_law_cards' },
      messages   : [{
        role   : 'user',
        content: [sourceBlock, { type: 'text', text: 'Analyze this law source into study cards.' }],
      }],
    });
    const toolUse = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (!toolUse) throw new Error('No structured output returned.');
    payload = toolUse.input as Record<string, unknown>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[analyze] Anthropic error:', msg);
    return NextResponse.json({ error: `Anthropic API error: ${msg}` }, { status: 502 });
  }

  if (payload.law_related !== true) {
    return NextResponse.json({ lawRelated: false });
  }

  // Persist
  try {
    const [row] = await query<{ id: number }>(
      `INSERT INTO analyses (pin_code, source_type, source_ref, title, data)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [pinCode, sourceType, sourceRef, (payload.title as string) ?? null, JSON.stringify(payload)],
    );
    return NextResponse.json({ lawRelated: true, id: row.id, data: payload });
  } catch (err) {
    console.warn('[analyze] persist failed:', err);
    // Still return cards even if save failed
    return NextResponse.json({ lawRelated: true, id: null, data: payload });
  }
}

export const config = { api: { bodyParser: false } };
