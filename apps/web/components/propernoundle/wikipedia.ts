const WIKI_API = 'https://en.wikipedia.org/api/rest_v1/page/summary';

interface WikiSummary {
  extract: string;
  title: string;
  description?: string;
  thumbnail?: { source: string; width: number; height: number };
}

export async function fetchWikipediaHint(
  displayName: string,
  wikiTitle?: string
): Promise<string> {
  const title = encodeURIComponent(
    (wikiTitle || displayName).replace(/\s+/g, '_')
  );

  const response = await fetch(`${WIKI_API}/${title}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Wikipedia API returned ${response.status}`);
  }

  const data: WikiSummary = await response.json();

  if (!data.extract) {
    throw new Error('No summary available');
  }

  return sanitizeHint(data.extract, displayName);
}

export async function fetchWikipediaImage(
  displayName: string,
  wikiTitle?: string
): Promise<string | null> {
  const title = encodeURIComponent(
    (wikiTitle || displayName).replace(/\s+/g, '_')
  );

  try {
    const response = await fetch(`${WIKI_API}/${title}`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return null;

    const data: WikiSummary = await response.json();
    return data.thumbnail?.source || null;
  } catch {
    return null;
  }
}

// Common single-word abbreviations whose internal period must NOT trigger
// a sentence-split. Wikipedia summaries are full of "No. 1", "Dr. X",
// "Inc.", etc. — without protecting them the hint truncates mid-thought
// (reported: "ranked as the world No." cutting off before the rank).
const SINGLE_WORD_ABBREVIATIONS = [
  'No', 'Nos',
  'Mr', 'Mrs', 'Ms', 'Dr', 'Prof',
  'Sr', 'Jr',
  'St', 'Mt', 'Ft',
  'Inc', 'Ltd', 'Co', 'Corp', 'Bros',
  'etc', 'vs', 'cf', 'al',
  'e.g', 'i.e',
  'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Sept', 'Oct', 'Nov', 'Dec',
  'Mon', 'Tue', 'Tues', 'Wed', 'Thu', 'Thur', 'Thurs', 'Fri', 'Sat', 'Sun',
];

function sanitizeHint(extract: string, displayName: string): string {
  // Protect multi-letter capitalized abbreviations like "U.S.", "U.K.", "D.C."
  let protected_ = extract.replace(/\b([A-Z])\.\s?([A-Z])\.(\s?[A-Z]\.)?/g, (m) => m.replace(/\./g, '###'));

  // Protect common single-word abbreviations (case-insensitive). Must
  // run before sentence segmentation so the period stays welded to the
  // preceding token rather than being treated as a sentence terminator.
  for (const abbr of SINGLE_WORD_ABBREVIATIONS) {
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\.`, 'gi');
    protected_ = protected_.replace(re, (m) => m.replace(/\./g, '###'));
  }

  // Get first 2 sentences
  const sentences = protected_.match(/[^.!?]+[.!?]+/g) || [protected_];
  let hint = sentences.slice(0, 2).join(' ').trim();

  // Restore abbreviation periods
  hint = hint.replace(/###/g, '.');

  // Build patterns to redact: full name first, then each individual word (>2 chars)
  const nameParts = displayName.split(/\s+/).filter(p => p.length > 2);
  const patterns = [displayName, ...nameParts];

  for (const pattern of patterns) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    hint = hint.replace(regex, '______');
  }

  // Collapse consecutive redactions
  hint = hint.replace(/(______\s*)+/g, '______');
  hint = hint.replace(/______(\w)/g, '______ $1');

  return hint;
}
