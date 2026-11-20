export type CommentSegment =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string; href: string };

const SAFE_URL_REGEX = /https?:\/\/[^\s<>"]+/g;
const TRAILING_PUNCTUATION = /[.,;:!?)]+$/;

export function tokenizeCommentText(text: string): CommentSegment[] {
  if (!text) return [];
  const segments: CommentSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(SAFE_URL_REGEX)) {
    const start = match.index ?? 0;
    const rawUrl = match[0];
    const cleanUrl = rawUrl.replace(TRAILING_PUNCTUATION, '');
    const trailing = rawUrl.slice(cleanUrl.length);

    if (start > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, start) });
    }

    if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
      segments.push({ type: 'link', value: cleanUrl, href: cleanUrl });
    } else {
      segments.push({ type: 'text', value: cleanUrl });
    }

    lastIndex = start + cleanUrl.length;
    if (trailing) {
      // Let the trailing punctuation merge with whatever text follows
    }
  }

  if (lastIndex < text.length) {
    const rest = text.slice(lastIndex);
    const prev = segments[segments.length - 1];
    if (prev && prev.type === 'text') {
      prev.value += rest;
    } else {
      segments.push({ type: 'text', value: rest });
    }
  }

  return segments;
}
