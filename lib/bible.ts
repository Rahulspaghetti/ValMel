export interface BibleVerse {
  text: string;
  reference: string;
}

const VERSES = [
  'John 3:16',
  'Psalm 23:1',
  'Jeremiah 29:11',
  'Philippians 4:13',
  'Romans 8:28',
  'Isaiah 40:31',
  'Proverbs 3:5-6',
  'Matthew 11:28',
  'John 14:27',
  'Psalm 46:1',
  'Romans 15:13',
  '1 Corinthians 13:4-5',
  'Zephaniah 3:17',
  'Psalm 139:14',
  'Lamentations 3:22-23',
];

export async function getDailyVerse(): Promise<BibleVerse> {
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const verse = VERSES[dayIndex % VERSES.length];
  const res = await fetch(`https://bible-api.com/${encodeURIComponent(verse)}`);
  if (!res.ok) throw new Error('Failed to fetch verse');
  const data = await res.json();
  return { text: data.text.trim(), reference: data.reference };
}
