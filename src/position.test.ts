import { describe, expect, it } from 'vitest';
import { loadFixtures } from '../benchmarks/dataset';
import { chunkdown } from './chunkdown';
import type { Chunk } from './types';

/**
 * The source region of a chunk, or undefined when the chunk has no position.
 */
const sourceOf = (text: string, chunk: Chunk): string | undefined =>
  chunk.source ? text.slice(chunk.source.position.start.offset, chunk.source.position.end.offset) : undefined;

/**
 * The 1-based line of every offset of a text, for many lookups in a long text.
 */
const linesOf = (text: string): Array<number> => {
  const lines = [1];
  let line = 1;
  for (let i = 0; i < text.length; i++) {
    const isLineEnding = text[i] === '\n' || (text[i] === '\r' && text[i + 1] !== '\n');
    if (isLineEnding) line++;
    lines.push(line);
  }
  return lines;
};

describe('chunk positions', () => {
  it('should give the source region of plain paragraphs', () => {
    // Arrange
    const text = 'First paragraph.\n\nSecond paragraph.\n';
    const splitter = chunkdown({ chunkSize: 20 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => chunk.text)).toEqual(['First paragraph.', 'Second paragraph.']);
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual(['First paragraph.', 'Second paragraph.']);
    expect(chunks[0].source?.position).toEqual({ start: { line: 1, offset: 0 }, end: { line: 1, offset: 16 } });
    expect(chunks[1].source?.position).toEqual({ start: { line: 3, offset: 18 }, end: { line: 3, offset: 35 } });
  });

  it('should give the source region of headings with breadcrumbs', () => {
    // Arrange
    const text = '# Title\n\nIntro text for the title.\n\n## Section\n\nBody text of the section.\n';
    const splitter = chunkdown({ chunkSize: 30 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual([
      '# Title\n\nIntro text for the title.',
      '## Section',
      'Body text of the section.',
    ]);
    expect(chunks.map((chunk) => chunk.breadcrumbs.map((breadcrumb) => breadcrumb.text))).toEqual([
      [],
      ['Title'],
      ['Title', 'Section'],
    ]);
    expect(chunks.map((chunk) => chunk.source?.position.start.line)).toEqual([1, 5, 7]);
  });

  it('should give the source region of the parts of a split list', () => {
    // Arrange
    const text = 'Intro:\n\n- item one\n- item two\n- item three\n';
    const splitter = chunkdown({ chunkSize: 10 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => chunk.text)).toEqual(['Intro:', '* item one', '* item two', '* item three']);
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual([
      'Intro:',
      '- item one',
      '- item two',
      '- item three',
    ]);
    expect(chunks.map((chunk) => chunk.source?.position.start.line)).toEqual([1, 3, 4, 5]);
  });

  it('should give the source region of a list item split into parts', () => {
    // Arrange
    const text = '- First paragraph of the item.\n\n  Second paragraph of the item.\n';
    const splitter = chunkdown({ chunkSize: 30 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => chunk.text)).toEqual([
      '* First paragraph of the item.',
      'Second paragraph of the item.',
    ]);
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual([
      '- First paragraph of the item.',
      'Second paragraph of the item.',
    ]);
    expect(chunks.map((chunk) => chunk.source?.position.start.line)).toEqual([1, 3]);
  });

  it('should not include the repeated header row of a split table', () => {
    // Arrange
    const text = '| Name | Value |\n| --- | --- |\n| alpha | one |\n| beta | two |\n| gamma | three |\n';
    const splitter = chunkdown({ chunkSize: 20 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => chunk.text)).toEqual([
      '| Name | Value |\n| - | - |\n| alpha | one |\n| beta | two |',
      '| Name | Value |\n| - | - |\n| gamma | three |',
    ]);
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual([
      '| Name | Value |\n| --- | --- |\n| alpha | one |\n| beta | two |',
      '| gamma | three |',
    ]);
    expect(chunks.map((chunk) => chunk.source?.position.start.line)).toEqual([1, 5]);
  });

  it('should include the header row only in the first chunk of a table row split into cells', () => {
    // Arrange
    const text = '| Name | Value |\n| --- | --- |\n| alpha | one |\n';
    const splitter = chunkdown({ chunkSize: 5 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => chunk.text)).toEqual(['| Name |\n| - |\n| alpha |', '| Value |\n| - |\n| one |']);
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual([
      '| Name | Value |\n| --- | --- |\n| alpha',
      '| one |',
    ]);
    expect(chunks.map((chunk) => chunk.source?.position.start.line)).toEqual([1, 3]);
  });

  it('should give the source region of the parts of a text cut by the text splitter', () => {
    // Arrange
    const text = 'Intro\n\nThe first sentence is here. The second sentence is here. The third one ~~too~~.\n';
    const splitter = chunkdown({ chunkSize: 30 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual([
      'Intro',
      'The first sentence is here.',
      'The second sentence is here.',
      'The third one ~~too~~.',
    ]);
    expect(chunks.map((chunk) => chunk.source?.position.start.line)).toEqual([1, 3, 3, 3]);
  });

  it('should leave the blockquote markers of later lines out of the parts of a cut blockquote', () => {
    // Arrange
    const text = '> The first sentence is here.\n> The second sentence is here.\n> The third one.\n';
    const splitter = chunkdown({ chunkSize: 30 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual([
      '> The first sentence is here.',
      'The second sentence is here.',
      'The third one.',
    ]);
    expect(chunks.map((chunk) => chunk.source?.position.start.line)).toEqual([1, 2, 3]);
  });

  it('should give the source region of a bare link that is written as an inline link', () => {
    // Arrange
    const text = 'Mail info@example.com today. Then call us.\n';
    const splitter = chunkdown({ chunkSize: 10 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks[1].text).toBe('[info@example.com](mailto:info@example.com)');
    expect(sourceOf(text, chunks[1])).toBe('info@example.com');
  });

  it('should give the source region of the parts of a chunk cut by maxRawSize', () => {
    // Arrange
    const text = 'Some words with ~~tilde~~ in a row that are long enough to be cut.\n';
    const splitter = chunkdown({ chunkSize: 200, maxRawSize: 30 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => chunk.text)).toEqual([
      'Some words with ~~tilde~~ in',
      'a row that are long enough to',
      'be cut.',
    ]);
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual([
      'Some words with ~~tilde~~ in',
      'a row that are long enough to',
      'be cut.',
    ]);
  });

  it('should map the parts of a chunk cut by maxRawSize over added escapes', () => {
    // Arrange
    const text = 'The ~~ marks and ~~ more ~~ things are cut here.\n';
    const splitter = chunkdown({ chunkSize: 200, maxRawSize: 22 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => chunk.text)).toEqual([
      'The \\~\\~ marks and',
      '\\~\\~ more \\~\\~ things',
      'are cut here.',
    ]);
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual([
      'The ~~ marks and',
      '~~ more ~~ things',
      'are cut here.',
    ]);
  });

  it('should give the source region of the parts of a list cut by maxRawSize', () => {
    // Arrange
    const text = '- one two three four five six seven\n';
    const splitter = chunkdown({ chunkSize: 200, maxRawSize: 20 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => chunk.text)).toEqual(['* one two three four', ' five six seven']);
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual(['- one two three four', 'five six seven']);
  });

  it('should give the source region of the parts of a long list cut by maxRawSize', () => {
    // Arrange
    const text = Array.from({ length: 1_100 }, (_, i) => `- item ${i}`).join('\n');
    const splitter = chunkdown({ chunkSize: 100_000, maxRawSize: 500 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    const last = chunks[chunks.length - 1];
    expect(chunks.filter((chunk) => chunk.source === undefined).length).toBe(0);
    expect(last.text.endsWith('* item 1099')).toBe(true);
    expect(sourceOf(text, last)?.endsWith('- item 1099')).toBe(true);
  });

  it('should give the source region of the parts of a list of equal items cut by maxRawSize', () => {
    // Arrange
    const text = Array(1_100).fill('- todo').join('\n');
    const splitter = chunkdown({ chunkSize: 100_000, maxRawSize: 500 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.filter((chunk) => chunk.source === undefined).length).toBe(0);
  });

  it('should give the source region of the parts of a padded table cut by maxRawSize', () => {
    // Arrange
    const rows = Array.from(
      { length: 400 },
      (_, i) => `| row ${String(i).padEnd(6)} | value ${String(i).padEnd(6)} | x      |`,
    );
    const text = `| name       | value        | flag   |\n| ---------- | ------------ | ------ |\n${rows.join('\n')}\n`;
    const splitter = chunkdown({ chunkSize: 100_000, maxRawSize: 1_000 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    const last = chunks[chunks.length - 1];
    expect(chunks.filter((chunk) => chunk.source === undefined).length).toBe(0);
    expect(last.text).toBe('row 399 | value 399 | x |');
    expect(sourceOf(text, last)).toBe('row 399    | value 399    | x      |');
  });

  it('should keep the marker of a blockquote in the region of the first part cut by maxRawSize', () => {
    // Arrange
    const text = '> one two three four five six seven\n';
    const splitter = chunkdown({ chunkSize: 200, maxRawSize: 20 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => chunk.text)).toEqual(['> one two three four', ' five six seven']);
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual(['> one two three four', 'five six seven']);
  });

  it('should give the source region of the parts of a paragraph with many reference links', () => {
    // Arrange
    const links = Array.from({ length: 150 }, (_, i) => `[item ${i}][r${i}]`).join(' and ');
    const definitions = Array.from({ length: 150 }, (_, i) => `[r${i}]: https://example.com/page/${i}`).join('\n');
    const text = `See ${links}.\n\n${definitions}\n`;
    const splitter = chunkdown({ chunkSize: 200 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.filter((chunk) => chunk.source === undefined).length).toBe(0);
    expect(sourceOf(text, chunks[0])?.startsWith('See [item 0][r0]')).toBe(true);
  });

  it('should keep the blockquote markers that are content of a code block', () => {
    // Arrange
    const text = '```r\n> mean(x)\n> sd(x)\n>\n> median(x)\n```\n';
    const splitter = chunkdown({ chunkSize: 15 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => chunk.text)).toEqual(['```r\n> mean(x)', '> sd(x)', '>\n> median(x)\n```']);
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual(['```r\n> mean(x)', '> sd(x)', '>\n> median(x)\n```']);
  });

  it('should give the source region of the parts of a table cut by maxRawSize', () => {
    // Arrange
    const text = '| Name | Value |\n|------|-------|\n| alpha | one |\n| beta | two |\n';
    const splitter = chunkdown({ chunkSize: 200, maxRawSize: 25 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => chunk.text)).toEqual([
      '| Name | Value |\n| - | -',
      '|\n| alpha | one |\n| beta',
      '| two |',
    ]);
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual([
      '| Name | Value |\n|------|-',
      '|\n| alpha | one |\n| beta',
      '| two |',
    ]);
  });

  it('should give no source to the repeated table header in parts cut by maxRawSize', () => {
    // Arrange
    const text =
      '| Climate data for the city | Value |\n|---|---|\n| January | 1 |\n| February | 2 |\n| March | 3 |\n| April | 4 |\n';
    const splitter = chunkdown({ chunkSize: 20, maxRawSize: 30 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => chunk.text)).toEqual([
      '| Climate data for the city |',
      'Value |\n| - | - |\n| January |',
      '1 |\n| February | 2 |',
      '| Climate data for the city |',
      'Value |\n| - | - |\n| March | 3',
      '|\n| April | 4 |',
    ]);
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual([
      '| Climate data for the city |',
      'Value |\n|---|---|\n| January |',
      '1 |\n| February | 2 |',
      undefined,
      '| March | 3',
      '|\n| April | 4 |',
    ]);
  });

  it('should give the source region of the parts of a code block in a list', () => {
    // Arrange
    const text = '- Example:\n\n  ```js\n  const alpha = 1;\n  const beta = 2;\n  const gamma = 3;\n  ```\n';
    const splitter = chunkdown({ chunkSize: 20 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => chunk.text)).toEqual([
      '* Example:',
      '```js\nconst alpha = 1;',
      'const beta = 2;',
      'const gamma = 3;\n```',
    ]);
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual([
      '- Example:',
      '```js\n  const alpha = 1;',
      'const beta = 2;',
      'const gamma = 3;\n  ```',
    ]);
  });

  it('should give the source region of the parts of an indented code block', () => {
    // Arrange
    const text = 'Run this:\n\n    python test/spec_tests.py --spec spec.txt --program PROGRAM\n';
    const splitter = chunkdown({ chunkSize: 20 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => chunk.text)).toEqual([
      'Run this:',
      '```\npython',
      'test/spec_tests.py',
      '--spec spec.txt',
      '--program PROGRAM\n```',
    ]);
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual([
      'Run this:',
      'python',
      'test/spec_tests.py',
      '--spec spec.txt',
      '--program PROGRAM',
    ]);
  });

  it('should give the source region of the parts of a paragraph with trailing spaces on a line', () => {
    // Arrange
    const text = 'The title, the link text and even \nthe destination may be omitted:\n';
    const splitter = chunkdown({ chunkSize: 20 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual([
      'The title,',
      'the link',
      'text and even',
      'the destination',
      'may be omitted:',
    ]);
  });

  it('should give the source region of a reference link that is rewritten as an inline link', () => {
    // Arrange
    const text = 'See [the docs][docs] for more.\n\n[docs]: https://example.com/docs\n';
    const splitter = chunkdown({ chunkSize: 100 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => chunk.text)).toEqual(['See [the docs](https://example.com/docs) for more.']);
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual(['See [the docs][docs] for more.']);
  });

  it('should keep the position of a node replaced by a transform that keeps it', () => {
    // Arrange
    const text = 'Some **bold** text.\n\nNext paragraph.\n';
    const splitter = chunkdown({
      chunkSize: 100,
      rules: { strong: { transform: (node) => ({ ...node, children: [{ type: 'text', value: 'BOLD' }] }) } },
    });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => chunk.text)).toEqual(['Some **BOLD** text.\n\nNext paragraph.']);
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual(['Some **bold** text.\n\nNext paragraph.']);
  });

  it('should have no position for a chunk of nodes that a transform creates', () => {
    // Arrange
    const text = '```\nold code\n```\n';
    const splitter = chunkdown({
      chunkSize: 100,
      rules: { code: { transform: () => ({ type: 'code', value: 'new code' }) } },
    });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => chunk.text)).toEqual(['```\nnew code\n```']);
    expect(chunks[0].source).toBe(undefined);
  });

  it('should count lines over CRLF line endings', () => {
    // Arrange
    const text = 'First paragraph.\r\n\r\nSecond paragraph.\r\n';
    const splitter = chunkdown({ chunkSize: 20 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual(['First paragraph.', 'Second paragraph.']);
    expect(chunks.map((chunk) => chunk.source?.position.start.line)).toEqual([1, 3]);
  });

  it('should keep the regions of a text with nested formatting in order', () => {
    // Arrange
    const text = '**alpha beta *gamma* delta epsilon zeta**\n';
    const splitter = chunkdown({ chunkSize: 15 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => chunk.text)).toEqual(['**alpha', 'beta *gamma*', 'delta', 'epsilon zeta**']);
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual([
      '**alpha',
      'beta *gamma*',
      'delta',
      'epsilon zeta**',
    ]);
  });

  it('should cover the whole chunk when a cut is after formatting with a link inside', () => {
    // Arrange
    const text = '**Read the [docs](https://x.y) and then the rest of it now.** Next.\n';
    const splitter = chunkdown({ chunkSize: 20 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual([
      '**Read the [docs](https://x.y) and then the rest of it now.**',
      'Next.',
    ]);
  });

  it('should cover the whole link when a cut is after inline code inside a link', () => {
    // Arrange
    const text = 'Use the tool like [`streamText`](/docs/stream-text) to stream. Then more text here.\n';
    const splitter = chunkdown({ chunkSize: 30 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual([
      'Use the tool like',
      '[`streamText`](/docs/stream-text) to stream.',
      'Then more text here.',
    ]);
  });

  it('should count offsets from the start of a text with a byte order mark', () => {
    // Arrange
    const text = '\uFEFF# Title\n\nSome paragraph text here.\n';
    const splitter = chunkdown({ chunkSize: 100 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual(['# Title\n\nSome paragraph text here.']);
    expect(chunks[0].source?.position).toEqual({ start: { line: 1, offset: 1 }, end: { line: 3, offset: 35 } });
  });

  it('should give the source region of the parts of a text with a footnote reference', () => {
    // Arrange
    const text = 'The first sentence is here[^1]. The second sentence is here. The third one.\n\n[^1]: Note.\n';
    const splitter = chunkdown({ chunkSize: 30 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual([
      'The first sentence',
      'is here[^1].',
      'The second sentence is here.',
      'The third one.',
      '[^1]: Note.',
    ]);
  });

  it('should give the source region of the parts of a text with a character reference', () => {
    // Arrange
    const text = '> Tom and Jerry went out.\n> They came&nbsp;back. Then slept well.\n';
    const splitter = chunkdown({ chunkSize: 30 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual([
      '> Tom and Jerry went out.',
      'They came&nbsp;back.',
      'Then slept well.',
    ]);
    expect(chunks.map((chunk) => chunk.source?.position.start.line)).toEqual([1, 2, 2]);
  });

  it('should include the marker of a list item whose text is cut into parts', () => {
    // Arrange
    const text = '1. First sentence of the item. Second sentence of the item.\n';
    const splitter = chunkdown({ chunkSize: 30 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => chunk.text)).toEqual([
      '1. First sentence of the item.',
      'Second sentence of the item.',
    ]);
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual([
      '1. First sentence of the item.',
      'Second sentence of the item.',
    ]);
  });

  it('should include the header row in the first chunk of a table whose first row is split into cells', () => {
    // Arrange
    const text = '| Name | Value |\n| --- | --- |\n| alpha alpha | one one one |\n| b | c |\n';
    const splitter = chunkdown({ chunkSize: 10 });

    // Act
    const { chunks } = splitter.split(text);

    // Assert
    expect(chunks.map((chunk) => sourceOf(text, chunk))).toEqual([
      '| Name | Value |\n| --- | --- |\n| alpha',
      'alpha',
      '| one',
      'one one |',
      '| b | c |',
    ]);
  });

  describe('fixtures', () => {
    const fixtures = loadFixtures();
    const options = [
      { chunkSize: 30 },
      { chunkSize: 100 },
      { chunkSize: 500, maxOverflowRatio: 1.5 },
      { chunkSize: 200, maxRawSize: 300 },
      { chunkSize: 5_000, maxRawSize: 1_000 },
    ];

    /**
     * Words of a text, without the number of an ordered list item, which the
     * chunk text writes again and can differ from the source.
     */
    const wordsOf = (text: string): Array<string> =>
      text.replace(/^(\s*\d+[.)]\s)+/, '').match(/[\p{L}\p{N}]+/gu) ?? [];

    for (const fixture of fixtures) {
      for (const option of options) {
        it(`should give ordered positions that cover their chunk for ${fixture.name} with ${JSON.stringify(option)}`, () => {
          // Arrange
          const splitter = chunkdown(option);

          // Act
          const { chunks } = splitter.split(fixture.text);

          // Assert
          const lines = linesOf(fixture.text);
          const violations: Array<string> = [];
          let previousEnd = 0;
          for (const chunk of chunks) {
            // Table chunks repeat the header row, which is not in the region
            const isTable = chunk.text.startsWith('|');
            if (!chunk.source) {
              violations.push(`${JSON.stringify(chunk.text.slice(0, 40))}: no source`);
              continue;
            }
            const { start, end } = chunk.source.position;
            const label = `${JSON.stringify(chunk.text.slice(0, 40))} at ${start.offset}`;

            if (start.offset < previousEnd) violations.push(`${label}: starts before ${previousEnd}`);
            if (start.offset >= end.offset) violations.push(`${label}: empty region`);
            if (end.offset > fixture.text.length) violations.push(`${label}: ends after the source`);
            if (start.line !== lines[start.offset]) violations.push(`${label}: wrong start line`);
            if (end.line !== lines[end.offset]) violations.push(`${label}: wrong end line`);

            // The region covers the chunk: it has the first and the last word of the chunk
            const words = wordsOf(chunk.text);
            const regionWords = new Set(wordsOf(fixture.text.slice(start.offset, end.offset)));
            if (words.length > 0 && !isTable) {
              if (!regionWords.has(words[0])) violations.push(`${label}: region misses "${words[0]}"`);
              if (!regionWords.has(words[words.length - 1])) {
                violations.push(`${label}: region misses "${words[words.length - 1]}"`);
              }
            }
            previousEnd = end.offset;
          }

          expect(violations).toEqual([]);
        });
      }
    }
  });
});
