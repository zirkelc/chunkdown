import { f } from 'f-strings';
import { describe, expect, it } from 'vitest';
import { BlockquoteSplitter } from './blockquote';

describe('BlockquoteSplitter', () => {
  const text = `> First blockquote paragraph.
>
> Second blockquote paragraph.
>
> Third blockquote paragraph.`;

  it('should keep blockquotes together', () => {
    const splitter = new BlockquoteSplitter({
      chunkSize: 90,
      maxOverflowRatio: 1.0,
    });

    const chunks = splitter.splitText(text);

    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe(
      '> First blockquote paragraph.\n>\n> Second blockquote paragraph.\n>\n> Third blockquote paragraph.',
    );
  });

  it('should split blockquotes', () => {
    const splitter = new BlockquoteSplitter({
      chunkSize: 35,
      maxOverflowRatio: 1.0,
    });

    const chunks = splitter.splitText(text);

    expect(chunks.length).toBe(3);
    expect(chunks[0]).toBe('> First blockquote paragraph.');
    expect(chunks[1]).toBe('> Second blockquote paragraph.');
    expect(chunks[2]).toBe('> Third blockquote paragraph.');
  });
});
