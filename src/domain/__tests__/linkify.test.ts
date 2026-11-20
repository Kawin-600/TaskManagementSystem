import { describe, it, expect } from 'vitest';
import { tokenizeCommentText } from '../linkify';

describe('tokenizeCommentText', () => {
  it('splits safe http and https URLs into link segments while keeping surrounding text', () => {
    const res = tokenizeCommentText(
      'ส่งไฟล์แล้ว https://drive.google.com/file/1 และ http://example.com/a ครับ',
    );
    expect(res).toEqual([
      { type: 'text', value: 'ส่งไฟล์แล้ว ' },
      { type: 'link', value: 'https://drive.google.com/file/1', href: 'https://drive.google.com/file/1' },
      { type: 'text', value: ' และ ' },
      { type: 'link', value: 'http://example.com/a', href: 'http://example.com/a' },
      { type: 'text', value: ' ครับ' },
    ]);
  });

  it('strips trailing punctuation from detected URLs', () => {
    const res = tokenizeCommentText('ดูที่ (https://figma.com/file/abc).');
    expect(res).toEqual([
      { type: 'text', value: 'ดูที่ (' },
      { type: 'link', value: 'https://figma.com/file/abc', href: 'https://figma.com/file/abc' },
      { type: 'text', value: ').' },
    ]);
  });

  it('keeps javascript: URIs and HTML tags as plain text (Review Focus #5)', () => {
    const raw = 'ลอง javascript:alert(1) หรือ <script>alert(1)</script>';
    expect(tokenizeCommentText(raw)).toEqual([{ type: 'text', value: raw }]);
  });
});
