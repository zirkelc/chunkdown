import { toMarkdown } from 'mdast-util-to-markdown';
import { describe, expect, it } from 'vitest';
import { chunkdown, defaultBreakpoints, getContentSize } from './splitter';

interface CustomMatchers<R = unknown> {
  toBeLessThanContentSize: (
    expectedContentSize: number,
    maxOverflowRatio?: number,
  ) => R;
}

declare module 'vitest' {
  interface Matchers<T = any> extends CustomMatchers<T> {}
}

expect.extend({
  toBeLessThanContentSize(
    received: string,
    expectedContentSize: number,
    maxOverflowRatio: number = 1.0,
  ) {
    const maxAllowedSize = expectedContentSize * maxOverflowRatio;
    const actualContentSize = getContentSize(received);
    const pass = actualContentSize < maxAllowedSize;
    return {
      message: () =>
        `expected content to be less than ${expectedContentSize}, but got ${actualContentSize}`,
      pass,
    };
  },
});

const THEMATIC_BREAK = toMarkdown({ type: 'thematicBreak' }).trim();

describe('getContentSize', () => {
  it('should measure plain text correctly', () => {
    expect(getContentSize('Hello world')).toBe(11);
    expect(getContentSize('')).toBe(0);
    expect(getContentSize('A')).toBe(1);
  });

  it('should ignore markdown formatting', () => {
    expect(getContentSize('**Hello** *world*')).toBe(11);
    expect(getContentSize('`Hello` world')).toBe(11);
    expect(getContentSize('[Hello](http://example.com) world')).toBe(11);
    expect(getContentSize('# Hello world')).toBe(11);
    expect(getContentSize('***`Hello`*** [world](https://example.com)')).toBe(
      11,
    );
  });
});

describe('createMarkdownSplitter', () => {
  describe('Size', () => {
    const longUrl = `https://example.com/${'x'.repeat(100)}`;
    const text = `Text [link1](${longUrl}) and [link2](${longUrl}) here.`;

    it('should use content size for splitting', () => {
      const splitter = chunkdown({
        chunkSize: 50,
        maxOverflowRatio: 1.0,
      });

      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(1);
      expect(getContentSize(chunks[0])).toBe(26);
    });

    it.skip('should use raw size exceeds limit even if content size is fine', () => {
      const maxRawSize = 150;
      const splitter = chunkdown({
        chunkSize: 50,
        maxOverflowRatio: 1.0,
        maxRawSize,
      });

      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(2);

      const link1Chunk = chunks.find((chunk) => chunk.includes('link1'));
      const link2Chunk = chunks.find((chunk) => chunk.includes('link2'));

      expect(link1Chunk).toBeDefined();
      expect(link2Chunk).toBeDefined();

      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(maxRawSize);
      });
    });
  });

  describe('Whitespace Handling', () => {
    it('should handle empty input', () => {
      const splitter = chunkdown({
        chunkSize: 50,
        maxOverflowRatio: 1.0,
      });
      expect(splitter.splitText('')).toEqual([]);
      expect(splitter.splitText(' ')).toEqual([]);
      expect(splitter.splitText(' ')).toEqual([]);
      expect(splitter.splitText('   \n\t   ')).toEqual([]);
    });

    it('should handle unicode non-breaking whitespace', () => {
      const splitter = chunkdown({
        chunkSize: 10,
        maxOverflowRatio: 1.0,
      });
      // Text with non-breaking space (U+00A0) between paragraphs
      const text = `First paragraph.



Second paragraph.`;

      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(4);
      const emptyChunks = chunks.filter((chunk) => chunk.trim() === '');
      expect(emptyChunks.length).toBe(0);
    });

    it('should trim leading and trailing whitespace in chunks', () => {
      const splitter = chunkdown({
        chunkSize: 30,
        maxOverflowRatio: 1.0,
      });

      const text = `
First sentence.

  Second sentence.

Third sentence.
  `;

      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(3);
      expect(chunks[0]).toBe('First sentence.');
      expect(chunks[1]).toBe('Second sentence.');
      expect(chunks[2]).toBe('Third sentence.');
    });
  });

  describe('Overflow Control', () => {
    it('should allow overflow within allowed ratio to preserve meaning', () => {
      const splitter = chunkdown({
        chunkSize: 20,
        maxOverflowRatio: 1.5,
      });
      const text = `This text is thirty char long. This text is thirty char long.`; // 61 chars
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(2);
      chunks.forEach((chunk) => {
        expect(getContentSize(chunk)).toBeLessThanOrEqual(30); // Within 1.5x limit
      });
    });

    it('should split if overflow not allowed', () => {
      const splitter = chunkdown({
        chunkSize: 20,
        maxOverflowRatio: 1.0,
      });
      const text = `This text is thirty char long. This text is thirty char long.`;
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(4);
      chunks.forEach((chunk) => {
        expect(getContentSize(chunk)).toBeLessThanOrEqual(20);
      });
    });
  });

  describe('Protected Constructs', () => {
    describe('Links', () => {
      it('should not split links', () => {
        const splitter = chunkdown({
          chunkSize: 10,
          maxOverflowRatio: 1.0,
        });
        const text = `Check [documentation](https://example.com) for more details.`;
        const chunks = splitter.splitText(text);

        const linkChunk = chunks.find((chunk) =>
          chunk.includes('[documentation](https://example.com)'),
        );
        expect(linkChunk).toBe('[documentation](https://example.com)');
      });

      it.skip('should only split links if they exceed raw size limit', () => {
        const splitter = chunkdown({
          chunkSize: 100,
          maxOverflowRatio: 1.5,
          maxRawSize: 200, // Small limit to force splitting
        });

        // Create a link that exceeds the raw size limit
        const longUrl = `https://example.com/${'x'.repeat(300)}`;
        const text = `Text with [huge link](${longUrl}) more text.`;

        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(5);

        const prefixChunk = chunks.find((chunk) => chunk.includes('Text with'));
        expect(prefixChunk).toBeDefined();

        const suffixChunk = chunks.find((chunk) =>
          chunk.includes('more text.'),
        );
        expect(suffixChunk).toBeDefined();

        const linkDescriptionChunk = chunks.find((chunk) =>
          chunk.includes('[huge link]'),
        );
        expect(linkDescriptionChunk).toBeDefined();

        chunks.forEach((chunk) => {
          expect(chunk.length).toBeLessThanOrEqual(200);
        });
      });
    });

    describe('Images', () => {
      it('should not split images', () => {
        const chunkSize = 10;
        const splitter = chunkdown({
          chunkSize,
          maxOverflowRatio: 1.0,
        });
        const text = `See ![logo](./logo.png) for the brand.`;
        const chunks = splitter.splitText(text);

        const imageChunk = chunks.find((chunk) =>
          chunk.includes('![logo](./logo.png)'),
        );
        expect(imageChunk).toBeDefined();
      });

      it.skip('should only split images if they exceed raw size limit', () => {
        const splitter = chunkdown({
          chunkSize: 100,
          maxOverflowRatio: 1.5,
          maxRawSize: 200, // Small limit to force splitting
        });

        // Create a link that exceeds the raw size limit
        const longUrl = `https://example.com/${'x'.repeat(300)}`;
        const text = `Text with ![huge image](${longUrl}) more text.`;

        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(5);

        const prefixChunk = chunks.find((chunk) => chunk.includes('Text with'));
        expect(prefixChunk).toBeDefined();

        const suffixChunk = chunks.find((chunk) =>
          chunk.includes('more text.'),
        );
        expect(suffixChunk).toBeDefined();

        const imageDescriptionChunk = chunks.find((chunk) =>
          chunk.includes('![huge image]'),
        );
        expect(imageDescriptionChunk).toBeDefined();

        chunks.forEach((chunk) => {
          expect(chunk.length).toBeLessThanOrEqual(200);
        });
      });
    });

    describe('Words', () => {
      it('should not split words', () => {
        const splitter = chunkdown({
          chunkSize: 5,
          maxOverflowRatio: 1.0,
        });

        const text = `supercalifragilisticexpialidocious antidisestablishmentarianism`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(2);
        expect(chunks[0]).toBe('supercalifragilisticexpialidocious');
        expect(chunks[1]).toBe('antidisestablishmentarianism');
      });

      it('should only split words if they exceed raw size limit', () => {
        const splitter = chunkdown({
          chunkSize: 5,
          maxOverflowRatio: 1.0,
          maxRawSize: 20, // Small limit to force splitting
        });

        const text = `supercalifragilisticexpialidocious antidisestablishmentarianism`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(4);
        expect(chunks[0]).toBe('supercalifragilistic');
        expect(chunks[1]).toBe('expialidocious');
        expect(chunks[2]).toBe('antidisestablishmen');
        expect(chunks[3]).toBe('tarianism');

        chunks.forEach((chunk) => {
          expect(chunk.length).toBeLessThanOrEqual(20);
        });
      });
    });

    describe('Formatting', () => {
      it('may split formatting when breakpoints are not set', () => {
        const chunkSize = 30;
        const splitter = chunkdown({
          chunkSize,
          maxOverflowRatio: 1.0,
          breakpoints: undefined,
        });
        const text = `Some **long strong text** with some *long italic text* and ~~long deleted text~~.`;
        const chunks = splitter.splitText(text);

        const strongChunk = chunks.find((chunk) =>
          chunk.includes('**long strong text**'),
        );
        const italicChunk = chunks.find((chunk) =>
          chunk.includes('*long italic text*'),
        );
        const deletedChunk = chunks.find((chunk) =>
          chunk.includes('~~long deleted text~~'),
        );

        expect([strongChunk, italicChunk, deletedChunk]).toContain(undefined);
      });

      it('should not split formatting when breakpoints are explicitly set', () => {
        const chunkSize = 30;
        const splitter = chunkdown({
          chunkSize,
          maxOverflowRatio: 1.0,
          breakpoints: {
            strong: { maxSize: 30 },
            emphasis: { maxSize: 30 },
            delete: { maxSize: 30 },
          },
        });
        const text = `Some **long strong text** with some *long italic text* and ~~long deleted text~~.`;
        const chunks = splitter.splitText(text);

        const strongChunk = chunks.find((chunk) =>
          chunk.includes('**long strong text**'),
        );
        const italicChunk = chunks.find((chunk) =>
          chunk.includes('*long italic text*'),
        );
        const deletedChunk = chunks.find((chunk) =>
          chunk.includes('~~long deleted text~~'),
        );

        expect(strongChunk).toBeDefined();
        expect(italicChunk).toBeDefined();
        expect(deletedChunk).toBeDefined();
      });

      it('should split formatting if above breakpoint', () => {
        const splitter = chunkdown({
          chunkSize: 30,
          maxOverflowRatio: 1.0,
          breakpoints: {
            strong: { maxSize: 30 },
            emphasis: { maxSize: 30 },
            delete: { maxSize: 30 },
          },
        });
        const text = `Some **very very very long strong text** with some *very very very long italic text* and ~~very very very long deleted text~~.`;
        const chunks = splitter.splitText(text);

        const strongChunk = chunks.find((chunk) =>
          chunk.includes('**very very very long strong text**'),
        );
        const italicChunk = chunks.find((chunk) =>
          chunk.includes('*very very very long italic text*'),
        );
        const deletedChunk = chunks.find((chunk) =>
          chunk.includes('~~very very very long deleted text~~'),
        );

        expect(strongChunk).toBeUndefined();
        expect(italicChunk).toBeUndefined();
        expect(deletedChunk).toBeUndefined();
      });

      it.skip('should split formatting if exceeds raw size limit', () => {
        const chunkSize = 30;
        const splitter = chunkdown({
          chunkSize,
          maxOverflowRatio: 1.0,
          maxRawSize: 10, // Small limit to force splitting
        });
        const text = `Some **long strong text** with some *long italic text* and ~~long deleted text~~.`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(12);

        const strongChunk = chunks.find((chunk) => chunk.includes('**long'));
        const italicChunk = chunks.find((chunk) => chunk.includes('*long'));
        const deletedChunk = chunks.find((chunk) => chunk.includes('~~long'));

        expect(strongChunk).toBeDefined();
        expect(italicChunk).toBeDefined();
        expect(deletedChunk).toBeDefined();

        chunks.forEach((chunk) => {
          expect(chunk.length).toBeLessThanOrEqual(15);
        });
      });
    });

    describe('Custom Breakpoints', () => {
      it('should allow custom breakpoint configuration', () => {
        const splitter = chunkdown({
          chunkSize: 30,
          maxOverflowRatio: 1.0,
          breakpoints: {
            link: { maxSize: 50 },
          },
        });
        const text = `Check out [this link](https://example.com) for more info.`;
        const chunks = splitter.splitText(text);

        const linkChunk = chunks.find((chunk) =>
          chunk.includes('[this link](https://example.com)'),
        );
        expect(linkChunk).toBeDefined();
      });

      it('should cap finite breakpoints at maxAllowedSize', () => {
        const splitter = chunkdown({
          chunkSize: 30,
          maxOverflowRatio: 1.0,
          breakpoints: {
            ...defaultBreakpoints,
            strong: { maxSize: 100 },
          },
        });
        const text = `Some **very very very long strong text** here.`;
        const chunks = splitter.splitText(text);

        // maxSize: 100 gets capped to maxAllowedSize: 30
        // "very very very long strong text" is 32 chars, exceeds 30
        const strongChunk = chunks.find((chunk) =>
          chunk.includes('**very very very long strong text**'),
        );
        expect(strongChunk).toBeUndefined();
      });

      it('should use Infinity to protect regardless of chunk size', () => {
        const splitter = chunkdown({
          chunkSize: 10,
          maxOverflowRatio: 1.0,
          breakpoints: {
            ...defaultBreakpoints,
            link: { maxSize: Infinity },
          },
        });
        const text = `Check [documentation](https://example.com) for details.`;
        const chunks = splitter.splitText(text);

        // Link should be protected with Infinity even though it exceeds chunk size
        const linkChunk = chunks.find((chunk) =>
          chunk.includes('[documentation](https://example.com)'),
        );
        expect(linkChunk).toBe('[documentation](https://example.com)');
      });

      it('should allow merging custom breakpoints with defaults', () => {
        const splitter = chunkdown({
          chunkSize: 50,
          maxOverflowRatio: 1.0,
          breakpoints: {
            ...defaultBreakpoints,
            link: { maxSize: 100 },
            inlineCode: { maxSize: 100 },
          },
        });
        const text = `Use \`const splitter = new MarkdownSplitter();\` for chunking in your projects.`;
        const chunks = splitter.splitText(text);

        const codeChunk = chunks.find((chunk) =>
          chunk.includes('`const splitter = new MarkdownSplitter();`'),
        );
        expect(codeChunk).toBeDefined();
      });
    });
  });

  describe('Progressive Splitting', () => {
    describe('Hierarchical Boundaries', () => {
      it('should split at thematic breaks', () => {
        const splitter = chunkdown({
          chunkSize: 100,
          maxOverflowRatio: 1.0,
        });
        const text = `# Section 1

First sentence. Second sentence.

---

# Section 2

First sentence. Second sentence.`;

        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(3);
        expect(chunks[0].startsWith('# Section 1')).toBe(true);
        expect(chunks[1]).toBe(THEMATIC_BREAK);
        expect(chunks[2].startsWith('# Section 2')).toBe(true);
      });

      it('should split by sections', () => {
        const splitter = chunkdown({
          chunkSize: 100,
          maxOverflowRatio: 1.0,
        });
        const text = `# Section 1

First sentence. Second sentence.

## Sub-section 1.1

First sentence. Second sentence.

# Section 2

First sentence. Second sentence.

## Sub-section 2.1

First sentence. Second sentence.`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(2);
        expect(chunks[0]).toBe(`# Section 1

First sentence. Second sentence.

## Sub-section 1.1

First sentence. Second sentence.`);
        expect(chunks[1]).toBe(`# Section 2

First sentence. Second sentence.

## Sub-section 2.1

First sentence. Second sentence.`);
      });

      it('should split by sub-sections', () => {
        const splitter = chunkdown({
          chunkSize: 80,
          maxOverflowRatio: 1.0,
        });
        const text = `# Section 1

First sentence. Second sentence.

## Sub-section 1.1

First sentence. Second sentence.

# Section 2

First sentence. Second sentence.

## Sub-section 2.1

First sentence. Second sentence.`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(4);
        expect(chunks[0]).toBe(`# Section 1

First sentence. Second sentence.`);
        expect(chunks[1]).toBe(`## Sub-section 1.1

First sentence. Second sentence.`);
        expect(chunks[2]).toBe(`# Section 2

First sentence. Second sentence.`);
        expect(chunks[3]).toBe(`## Sub-section 2.1

First sentence. Second sentence.`);
      });

      it('should split by paragraph', () => {
        const splitter = chunkdown({
          chunkSize: 60,
          maxOverflowRatio: 1.0,
        });
        const text = `First sentence. Second sentence.

First sentence. Second sentence.

First sentence. Second sentence.`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(3);
        expect(chunks[0]).toBe('First sentence. Second sentence.');
        expect(chunks[1]).toBe('First sentence. Second sentence.');
        expect(chunks[2]).toBe('First sentence. Second sentence.');
      });
    });

    describe('Sentence Boundaries', () => {
      it('should split by period before newline', () => {
        const splitter = chunkdown({
          chunkSize: 20,
          maxOverflowRatio: 1.0,
        });
        const text = `First sentence.\nSecond sentence.\nThird sentence.`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(3);
        expect(chunks[0]).toBe('First sentence.');
        expect(chunks[1]).toBe('Second sentence.');
        expect(chunks[2]).toBe('Third sentence.');
      });

      it('should split by period before uppercase', () => {
        const splitter = chunkdown({
          chunkSize: 25,
          maxOverflowRatio: 1.0,
        });
        const text = `Hello world. The sun is shining. Today is nice.`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(3);
        expect(chunks[0]).toBe('Hello world.');
        expect(chunks[1]).toBe('The sun is shining.');
        expect(chunks[2]).toBe('Today is nice.');
      });

      it('should split by question and exclamation marks', () => {
        const splitter = chunkdown({
          chunkSize: 15,
          maxOverflowRatio: 1.0,
        });
        const text = `Really? Yes! Maybe?? Absolutely!!!`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(3);
        expect(chunks[0]).toBe('Really?');
        expect(chunks[1]).toBe('Yes! Maybe??');
        expect(chunks[2]).toBe('Absolutely!!!');
      });

      it('should split by safe periods avoiding abbreviations', () => {
        const splitter = chunkdown({
          chunkSize: 25,
          maxOverflowRatio: 1.0,
        });
        const text = `This is e.g. example. This is proper sentence. End.`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(3);
        expect(chunks[0]).toBe('This is e.g. example.');
        expect(chunks[1]).toBe('This is proper sentence.');
        expect(chunks[2]).toBe('End.');
      });

      it('should split by colons and semicolons', () => {
        const splitter = chunkdown({
          chunkSize: 15,
          maxOverflowRatio: 1.0,
        });
        const text = `Note: this is important; very important: indeed.`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(5);
        expect(chunks[0]).toBe('Note:');
        expect(chunks[1]).toBe('this');
        expect(chunks[2]).toBe('is important;');
        expect(chunks[3]).toBe('very important:');
        expect(chunks[4]).toBe('indeed.');
      });

      it('should split by closing brackets', () => {
        const splitter = chunkdown({
          chunkSize: 15,
          maxOverflowRatio: 1.0,
        });
        const text = `Hello (world) there [friend] now {buddy} end.`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(4);
        expect(chunks[0]).toBe('Hello (world)');
        expect(chunks[1]).toBe('there \\[friend]');
        expect(chunks[2]).toBe('now {buddy}');
        expect(chunks[3]).toBe('end.');
      });

      it('should split by opening brackets', () => {
        const splitter = chunkdown({
          chunkSize: 15,
          maxOverflowRatio: 1.0,
        });
        const text = `First (second) and (third) done.`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(3);
        expect(chunks[0]).toBe('First (second)');
        expect(chunks[1]).toBe('and (third)');
        expect(chunks[2]).toBe('done.');
      });

      it('should split by closing quotes', () => {
        const splitter = chunkdown({
          chunkSize: 20,
          maxOverflowRatio: 1.0,
        });
        const text = `He said "hello" there and 'goodbye' now.`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(3);
        expect(chunks[0]).toBe('He said "hello"');
        expect(chunks[1]).toBe("there and 'goodbye'");
        expect(chunks[2]).toBe('now.');
      });

      it('should split by opening quotes', () => {
        const splitter = chunkdown({
          chunkSize: 15,
          maxOverflowRatio: 1.0,
        });
        const text = `First "second" and "third" done.`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(3);
        expect(chunks[0]).toBe('First "second"');
        expect(chunks[1]).toBe('and "third"');
        expect(chunks[2]).toBe('done.');
      });

      it('should split by line breaks', () => {
        const splitter = chunkdown({
          chunkSize: 15,
          maxOverflowRatio: 1.0,
        });
        const text = `First line\nSecond line\nThird line`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(3);
        expect(chunks[0]).toBe('First line');
        expect(chunks[1]).toBe('Second line');
        expect(chunks[2]).toBe('Third line');
      });

      it('should split by commas', () => {
        const splitter = chunkdown({
          chunkSize: 20,
          maxOverflowRatio: 1.0,
        });
        const text = `First point, second point, third point, fourth point`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(4);
        expect(chunks[0]).toBe('First point,');
        expect(chunks[1]).toBe('second point,');
        expect(chunks[2]).toBe('third point,');
        expect(chunks[3]).toBe('fourth point');
      });

      it('should split by dashes', () => {
        const splitter = chunkdown({
          chunkSize: 15,
          maxOverflowRatio: 1.0,
        });
        const text = `Paris – the city of lights – is beautiful — really beautiful - very nice.`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(7);
        expect(chunks[0]).toBe('Paris –');
        expect(chunks[1]).toBe('the city');
        expect(chunks[2]).toBe('of lights –');
        expect(chunks[3]).toBe('is beautiful —');
        expect(chunks[4]).toBe('really');
        expect(chunks[5]).toBe('beautiful -');
        expect(chunks[6]).toBe('very nice.');
      });

      it('should split by ellipsis', () => {
        const splitter = chunkdown({
          chunkSize: 15,
          maxOverflowRatio: 1.0,
        });
        const text = `Wait... what happened... I don't know....`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(5);
        expect(chunks[0]).toBe('Wait...');
        expect(chunks[1]).toBe('what happened.');
        expect(chunks[2]).toBe('..');
        expect(chunks[3]).toBe("I don't know\\..");
        expect(chunks[4]).toBe('..');
      });

      it('should split by period fallback', () => {
        const splitter = chunkdown({
          chunkSize: 5,
          maxOverflowRatio: 1.0,
        });
        const text = `etc. End`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(2);
        expect(chunks[0]).toBe('etc.');
        expect(chunks[1]).toBe('End');
      });

      it('should split by whitespace as final fallback', () => {
        const splitter = chunkdown({
          chunkSize: 1,
          maxOverflowRatio: 1.0,
        });
        const text = `word1 word2 word3`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(3);
        expect(chunks[0]).toBe('word1');
        expect(chunks[1]).toBe('word2');
        expect(chunks[2]).toBe('word3');
      });
    });

    describe.skip('Lists', () => {
      it('should keep lists together if possible', () => {
        const splitter = chunkdown({
          chunkSize: 50,
          maxOverflowRatio: 1.0,
        });
        const text = `Start of list.

- First list item
- Second list item
- Third list item

End of list.`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(3);
        expect(chunks[0]).toBe('Start of list.');
        expect(chunks[1]).toBe(
          '* First list item\n* Second list item\n* Third list item',
        );
        expect(chunks[2]).toBe('End of list.');
      });

      it('should split list by items', () => {
        const splitter = chunkdown({
          chunkSize: 40,
          maxOverflowRatio: 1.0,
        });
        const text = `Start of list.

- First list item. Some more content
- Second list item. Some more content
- Third list item. Some more content

End of list.`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(5);
        expect(chunks[0]).toBe('Start of list.');
        expect(chunks[1]).toBe('* First list item. Some more content');
        expect(chunks[2]).toBe('* Second list item. Some more content');
        expect(chunks[3]).toBe('* Third list item. Some more content');
        expect(chunks[4]).toBe('End of list.');
      });

      it('should preserve ordered list numbering when splitting', () => {
        const splitter = chunkdown({
          chunkSize: 50,
          maxOverflowRatio: 1.0,
        });
        const text = `Instructions:

1. First step with some content
2. Second step with some content
3. Third step with some content
4. Fourth step with some content
5. Fifth step with some content
6. Sixth step with some content

End of instructions.`;
        const chunks = splitter.splitText(text);

        // Find the chunks containing ordered list items
        const listChunks = chunks.filter((chunk) =>
          /^\d+\./.test(chunk.trim()),
        );

        expect(listChunks.length).toBe(6);
        for (let i = 1; i < listChunks.length; i++) {
          expect(listChunks[i]).toMatch(new RegExp(`^[${i + 1}].`));
        }
      });

      it('should preserve ordered list numbering with long items that get split', () => {
        const splitter = chunkdown({
          chunkSize: 200,
          maxOverflowRatio: 1.5,
        });
        const text = `1. **First item with very long content.** This item contains substantial text that will exceed the chunk size limit and force the splitter to break it into multiple chunks, which can cause numbering issues if not handled correctly.

2. **Second item with moderate content.** This item has enough content to potentially cause issues but should fit in a single chunk.

3. **Third item with short content.**

4. **Fourth item with extremely long content that will definitely be split.** This is a very detailed item that contains multiple sentences with comprehensive explanations and examples. It includes technical details, step-by-step instructions, and various formatting elements that make it substantially longer than the configured chunk size, ensuring it will be split across multiple chunks during processing.

5. **Fifth item with another very long section.** Similar to item 4, this contains extensive content that will cause the text splitter to break it into multiple chunks, testing whether the ordered list numbering is preserved correctly across these splits.

6. **Sixth item with normal content.**

7. **Seventh item with more long content.** This item also has substantial text that will likely exceed the chunk size and test the numbering preservation functionality in various scenarios.

8. **Eighth item is short.**

9. **Ninth and final item.**`;

        const chunks = splitter.splitText(text);

        // Extract all list item numbers from all chunks (not just those that start chunks)
        const allListNumbers: number[] = [];
        chunks.forEach((chunk) => {
          const matches = chunk.matchAll(/^(\d+)\./gm);
          for (const match of matches) {
            allListNumbers.push(Number.parseInt(match[1], 10));
          }
        });

        // Should preserve sequential numbering: 1, 2, 3, 4, 5, 6, 7, 8, 9
        const expectedNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];

        expect(allListNumbers).toEqual(expectedNumbers);

        // Verify that we have exactly 9 list items
        expect(allListNumbers.length).toBe(9);

        // Additional verification: ensure no numbering resets to 1 after the first item
        const numbersAfterFirst = allListNumbers.slice(1);
        expect(numbersAfterFirst).not.toContain(1);
      });
    });

    describe.skip('Tables', () => {
      it('should keep tables together if possible', () => {
        const splitter = chunkdown({
          chunkSize: 60,
          maxOverflowRatio: 1.0,
        });
        const text = `Start of table.

| Col A   | Col B   |
|---------|---------|
| Row A1  | Row B1  |
| Row A2  | Row B2  |
| Row A3  | Row B3  |
| Row A4  | Row B4  |

End of table.`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(3);
        expect(chunks).toEqual([
          'Start of table.',
          `| Col A  | Col B  |
| ------ | ------ |
| Row A1 | Row B1 |
| Row A2 | Row B2 |
| Row A3 | Row B3 |
| Row A4 | Row B4 |`,
          'End of table.',
        ]);
      });

      it('should split table by rows', () => {
        const splitter = chunkdown({
          chunkSize: 15,
          maxOverflowRatio: 1.0,
        });
        const text = `Start of table.

| Col A   | Col B   |
|---------|---------|
| Row A1  | Row B1  |
| Row A2  | Row B2  |
| Row A3  | Row B3  |
| Row A4  | Row B4  |

End of table.`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(6);
        expect(chunks).toEqual([
          'Start of table.',
          `| Col A | Col B |
| ----- | ----- |`,
          '| Row A1 | Row B1 |',
          '| Row A2 | Row B2 |',
          '| Row A3 | Row B3 |',
          '| Row A4 | Row B4 |',
          'End of table.',
        ]);
      });

      it('should prepend table header if preserveTableHeaders is true', () => {
        const splitter = chunkdown({
          chunkSize: 15,
          maxOverflowRatio: 1.0,
          experimental: { preserveTableHeaders: true },
        });
        const text = `Start of table.

| Col A   | Col B   |
|---------|---------|
| Row A1  | Row B1  |
| Row A2  | Row B2  |
| Row A3  | Row B3  |
| Row A4  | Row B4  |

End of table.`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(6);
        expect(chunks).toEqual([
          'Start of table.',
          `| Col A  | Col B  |
| ------ | ------ |
| Row A1 | Row B1 |`,
          `| Col A  | Col B  |
| ------ | ------ |
| Row A2 | Row B2 |`,
          `| Col A  | Col B  |
| ------ | ------ |
| Row A3 | Row B3 |`,
          `| Col A  | Col B  |
| ------ | ------ |
| Row A4 | Row B4 |`,
          'End of table.',
        ]);
      });
    });

    describe('Blockquotes', () => {
      it('should keep blockquotes together if possible', () => {
        const splitter = chunkdown({
          chunkSize: 90,
          maxOverflowRatio: 1.0,
        });
        const text = `Start of blockquote

> This is a blockquote with two paragraphs.
>
> This is the second paragraph in the blockquote.

End of blockquote.`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(3);
        expect(chunks[0]).toBe('Start of blockquote');
        expect(chunks[1]).toBe(
          '> This is a blockquote with two paragraphs.\n>\n> This is the second paragraph in the blockquote.',
        );
        expect(chunks[2]).toBe('End of blockquote.');
      });

      it('should split large blockquotes by paragraphs', () => {
        const splitter = chunkdown({
          chunkSize: 35,
          maxOverflowRatio: 1.0,
        });
        const text = `Start of blockquote

> Short blockquote paragraph.
>
> Another short paragraph.
>
> Third short paragraph.

End of blockquote.`;
        const chunks = splitter.splitText(text);

        expect(chunks.length).toBe(5);
        expect(chunks[0]).toBe('Start of blockquote');
        expect(chunks[1]).toBe('> Short blockquote paragraph.');
        expect(chunks[2]).toBe('> Another short paragraph.');
        expect(chunks[3]).toBe('> Third short paragraph.');
        expect(chunks[4]).toBe('End of blockquote.');
      });
    });
  });

  describe('Section Merging', () => {
    describe('Parent-Descendant Merging', () => {
      it('should merge parent section with child sections when they fit together', () => {
        const splitter = chunkdown({
          chunkSize: 1000,
          maxOverflowRatio: 1.5,
        });

        const text = `## Main Section

This is the main section with some introductory content that explains what this section is about.

### Child Section 1

This is the first child section with moderate content that should fit with the parent.

### Child Section 2

This is the second child section with some additional content.

### Child Section 3

This is the third child section with final content for this group.

## Another Main Section

This section should be separate since it's a sibling of the first main section.`;

        const chunks = splitter.splitText(text);

        // Main Section + children, Another Main Section
        expect(chunks.length).toBe(2);

        // First chunk should contain parent and multiple children
        expect(chunks[0]).toContain('## Main Section');
        expect(chunks[0]).toContain('### Child Section 1');
        expect(chunks[0]).toContain('### Child Section 2');
        expect(chunks[0]).toContain('### Child Section 3');

        // Second chunk should contain the other main section
        expect(chunks[1]).toContain('## Another Main Section');

        // Should stay within allowed size
        chunks.forEach((chunk) => {
          expect(getContentSize(chunk)).toBeLessThanOrEqual(1500); // 1000 * 1.5
        });
      });

      it('should not merge if combined size exceeds maxAllowedSize', () => {
        const splitter = chunkdown({
          chunkSize: 200,
          maxOverflowRatio: 1.2, // Only 240 chars allowed
        });

        const text = `## Main Section

This is a longer main section with substantial introductory content that explains what this section is about in great detail with many words and explanations.

### Child Section 1

This child section also has substantial content that would make the combined size exceed the maximum allowed size when merged with the parent section.

### Child Section 2

Another child section with content.`;

        const chunks = splitter.splitText(text);

        // Should create 2 chunks due to size constraints
        expect(chunks.length).toBe(2);
        expect(chunks[0]).toContain('## Main Section');
        expect(chunks[1]).toContain('### Child Section 1');

        // No chunk should exceed the allowed size
        chunks.forEach((chunk) => {
          expect(getContentSize(chunk)).toBeLessThanOrEqual(240); // 200 * 1.2
        });
      });
    });

    describe('Sibling Section Merging', () => {
      it('should merge sibling sections when parent is too large to merge', () => {
        const splitter = chunkdown({
          chunkSize: 300,
          maxOverflowRatio: 1.5, // 450 chars allowed
        });

        const text = `# Large Parent Section

This is a large parent section with substantial content that takes up significant space. It contains multiple sentences with detailed explanations and examples. This content is designed to be large enough that it cannot merge with its child sections due to size constraints. The parent section alone should be close to or exceed the base chunk size to prevent parent-child merging but allow sibling merging of the children.

## First Child Section

Short content for first child.

## Second Child Section

Short content for second child.

## Third Child Section

Short content for third child.`;

        const chunks = splitter.splitText(text);

        // Should create 2 chunks: large parent separate, siblings merged
        expect(chunks.length).toBe(2);

        // First chunk should be the large parent alone
        expect(chunks[0]).toContain('# Large Parent Section');
        expect(chunks[0]).not.toContain('## First Child Section');

        // Second chunk should contain merged siblings
        expect(chunks[1]).toContain('## First Child Section');
        expect(chunks[1]).toContain('## Second Child Section');
        expect(chunks[1]).toContain('## Third Child Section');

        // All chunks should stay within allowed size
        chunks.forEach((chunk) => {
          expect(getContentSize(chunk)).toBeLessThanOrEqual(450); // 300 * 1.5
        });
      });

      it('should merge some siblings but not others based on size constraints', () => {
        const splitter = chunkdown({
          chunkSize: 150,
          maxOverflowRatio: 1.3, // 195 chars allowed
        });

        // Create scenario where parent can't merge with children,
        // and siblings have mixed sizes preventing complete merging
        const text = `# Parent Section

This is a parent section with substantial content that is designed to be large enough to prevent merging with any child sections. The parent section contains multiple detailed sentences with comprehensive explanations and examples that ensure its size exceeds the merge threshold when combined with any child section.

## Small Sibling A

Short content A.

## Small Sibling B

Short content B.

## Large Sibling Section

This is a much larger sibling section with substantial content that contains multiple sentences and detailed explanations that make it too large to merge with the small siblings.

## Small Sibling C

Short content C.`;

        const chunks = splitter.splitText(text);

        // Parent gets split due to size, siblings show selective merging behavior
        // Small siblings A+B merge together, large sibling separate, small sibling C separate
        expect(chunks.length).toBe(7);

        // Key behavior to test: Small siblings A+B merged, but sibling C separate
        // Find the chunk containing small siblings A and B (merged together)
        const siblingABChunk = chunks.find(
          (chunk) =>
            chunk.includes('## Small Sibling A') &&
            chunk.includes('## Small Sibling B'),
        );
        expect(siblingABChunk).toBeDefined();
        expect(siblingABChunk).not.toContain('## Large Sibling Section');
        expect(siblingABChunk).not.toContain('## Small Sibling C');

        // Large sibling should be in separate chunk(s)
        const largeSiblingChunks = chunks.filter((chunk) =>
          chunk.includes('## Large Sibling Section'),
        );
        expect(largeSiblingChunks.length).toBeDefined();
        expect(largeSiblingChunks).not.toContain('## Small Sibling A');
        expect(largeSiblingChunks).not.toContain('## Small Sibling B');
        expect(largeSiblingChunks).not.toContain('## Small Sibling C');

        // Small sibling C should be alone
        const siblingCChunk = chunks.find((chunk) =>
          chunk.includes('## Small Sibling C'),
        );
        expect(siblingCChunk).toBeDefined();
        expect(siblingCChunk).not.toContain('## Small Sibling A');
        expect(siblingCChunk).not.toContain('## Small Sibling B');
        expect(siblingCChunk).not.toContain('## Large Sibling Section');

        // Verify size constraints
        chunks.forEach((chunk) => {
          expect(getContentSize(chunk)).toBeLessThanOrEqual(195);
        });
      });

      it('should handle orphaned sections (limitation: currently processed individually)', () => {
        const splitter = chunkdown({
          chunkSize: 100,
          maxOverflowRatio: 1.5, // 150 chars allowed
        });

        // Test pure sibling sections without a hierarchical parent
        // Note: Current implementation treats these as individual sections
        // This could be improved in future versions to merge orphaned siblings
        const text = `## Section Alpha

Short content A.

## Section Beta

Short content B.

## Section Gamma

Short content C.`;

        const chunks = splitter.splitText(text);

        // Currently creates 3 separate chunks (limitation of current implementation)
        expect(chunks.length).toBe(3);

        // Each chunk should contain one section
        expect(chunks[0]).toContain('## Section Alpha');
        expect(chunks[1]).toContain('## Section Beta');
        expect(chunks[2]).toContain('## Section Gamma');

        // Verify size constraints
        chunks.forEach((chunk) => {
          expect(getContentSize(chunk)).toBeLessThanOrEqual(150);
        });
      });
    });
  });

  describe('Examples', () => {
    describe('AI SDK Core Documentation', () => {
      const text = `# AI SDK Core

Large Language Models (LLMs) are advanced programs that can understand, create, and engage with human language on a large scale.
They are trained on vast amounts of written material to recognize patterns in language and predict what might come next in a given piece of text.

AI SDK Core **simplifies working with LLMs by offering a standardized way of integrating them into your app** - so you can focus on building great AI applications for your users, not waste time on technical details.

For example, here's how you can generate text with various models using the AI SDK:

<PreviewSwitchProviders />

## AI SDK Core Functions

AI SDK Core has various functions designed for [text generation](./generating-text), [structured data generation](./generating-structured-data), and [tool usage](./tools-and-tool-calling).
These functions take a standardized approach to setting up [prompts](./prompts) and [settings](./settings), making it easier to work with different models.

- [\`generateText\`](/docs/ai-sdk-core/generating-text): Generates text and [tool calls](./tools-and-tool-calling).
  This function is ideal for non-interactive use cases such as automation tasks where you need to write text (e.g. drafting email or summarizing web pages) and for agents that use tools.
- [\`streamText\`](/docs/ai-sdk-core/generating-text): Stream text and tool calls.
  You can use the \`streamText\` function for interactive use cases such as [chat bots](/docs/ai-sdk-ui/chatbot) and [content streaming](/docs/ai-sdk-ui/completion).
- [\`generateObject\`](/docs/ai-sdk-core/generating-structured-data): Generates a typed, structured object that matches a [Zod](https://zod.dev/) schema.
  You can use this function to force the language model to return structured data, e.g. for information extraction, synthetic data generation, or classification tasks.
- [\`streamObject\`](/docs/ai-sdk-core/generating-structured-data): Stream a structured object that matches a Zod schema.
  You can use this function to [stream generated UIs](/docs/ai-sdk-ui/object-generation).

## API Reference

Please check out the [AI SDK Core API Reference](/docs/reference/ai-sdk-core) for more details on each function.`;

      it('should split with strict 200 chunk size', () => {
        const splitter = chunkdown({
          chunkSize: 200,
          maxOverflowRatio: 1.0,
        });
        const chunks = splitter.splitText(text);

        expect(chunks).toMatchInlineSnapshot(`
          [
            "# AI SDK Core",
            "Large Language Models (LLMs) are advanced programs that can understand, create, and engage with human language on a large scale.",
            "They are trained on vast amounts of written material to recognize patterns in language and predict what might come next in a given piece of text.",
            "AI SDK Core **simplifies working with LLMs by offering a standardized way of integrating them into your app** - so you can focus on building great AI applications for your users,",
            "not waste time on technical details.",
            "For example, here's how you can generate text with various models using the AI SDK:

          <PreviewSwitchProviders />",
            "## AI SDK Core Functions",
            "AI SDK Core has various functions designed for [text generation](./generating-text), [structured data generation](./generating-structured-data), and [tool usage](./tools-and-tool-calling).",
            "These functions take a standardized approach to setting up [prompts](./prompts) and [settings](./settings), making it easier to work with different models.",
            "* [\`generateText\`](/docs/ai-sdk-core/generating-text): Generates text and [tool calls](./tools-and-tool-calling).",
            "* This function is ideal for non-interactive use cases such as automation tasks where you need to write text (e.g. drafting email or summarizing web pages) and for agents that use tools.",
            "* [\`streamText\`](/docs/ai-sdk-core/generating-text): Stream text and tool calls.
            You can use the \`streamText\` function for interactive use cases such as [chat bots](/docs/ai-sdk-ui/chatbot) and [content streaming](/docs/ai-sdk-ui/completion).",
            "* [\`generateObject\`](/docs/ai-sdk-core/generating-structured-data): Generates a typed, structured object that matches a [Zod](https://zod.dev/) schema.",
            "* You can use this function to force the language model to return structured data, e.g. for information extraction, synthetic data generation, or classification tasks.",
            "* [\`streamObject\`](/docs/ai-sdk-core/generating-structured-data): Stream a structured object that matches a Zod schema.
            You can use this function to [stream generated UIs](/docs/ai-sdk-ui/object-generation).",
            "## API Reference

          Please check out the [AI SDK Core API Reference](/docs/reference/ai-sdk-core) for more details on each function.",
          ]
        `);

        // Verify overflow stays within bounds
        chunks.forEach((chunk) => {
          expect(getContentSize(chunk)).toBeLessThanOrEqual(300); // 200 * 1.5
        });

        // Verify links and images are never broken
        chunks.forEach((chunk) => {
          const brackets = (chunk.match(/[[\]]/g) || []).length;
          const backticks = (chunk.match(/`/g) || []).length;

          if (brackets > 0) expect(brackets % 2).toBe(0);
          if (backticks > 0) expect(backticks % 2).toBe(0);
        });
      });

      it('should split with 1.5x overflow ratio', () => {
        const splitter = chunkdown({
          chunkSize: 200,
          maxOverflowRatio: 1.5,
        });
        const chunks = splitter.splitText(text);

        expect(chunks).toMatchInlineSnapshot(`
          [
            "# AI SDK Core

          Large Language Models (LLMs) are advanced programs that can understand, create, and engage with human language on a large scale.
          They are trained on vast amounts of written material to recognize patterns in language and predict what might come next in a given piece of text.",
            "AI SDK Core **simplifies working with LLMs by offering a standardized way of integrating them into your app** - so you can focus on building great AI applications for your users, not waste time on technical details.

          For example, here's how you can generate text with various models using the AI SDK:",
            "<PreviewSwitchProviders />",
            "## AI SDK Core Functions

          AI SDK Core has various functions designed for [text generation](./generating-text), [structured data generation](./generating-structured-data), and [tool usage](./tools-and-tool-calling).
          These functions take a standardized approach to setting up [prompts](./prompts) and [settings](./settings), making it easier to work with different models.",
            "* [\`generateText\`](/docs/ai-sdk-core/generating-text): Generates text and [tool calls](./tools-and-tool-calling).
            This function is ideal for non-interactive use cases such as automation tasks where you need to write text (e.g. drafting email or summarizing web pages) and for agents that use tools.",
            "* [\`streamText\`](/docs/ai-sdk-core/generating-text): Stream text and tool calls.
            You can use the \`streamText\` function for interactive use cases such as [chat bots](/docs/ai-sdk-ui/chatbot) and [content streaming](/docs/ai-sdk-ui/completion).",
            "* [\`generateObject\`](/docs/ai-sdk-core/generating-structured-data): Generates a typed, structured object that matches a [Zod](https://zod.dev/) schema.
            You can use this function to force the language model to return structured data, e.g. for information extraction, synthetic data generation, or classification tasks.",
            "* [\`streamObject\`](/docs/ai-sdk-core/generating-structured-data): Stream a structured object that matches a Zod schema.
            You can use this function to [stream generated UIs](/docs/ai-sdk-ui/object-generation).",
            "## API Reference

          Please check out the [AI SDK Core API Reference](/docs/reference/ai-sdk-core) for more details on each function.",
          ]
        `);

        // Verify overflow stays within bounds
        chunks.forEach((chunk) => {
          expect(getContentSize(chunk)).toBeLessThanOrEqual(300); // 200 * 1.5
        });

        // Verify links and images are never broken
        chunks.forEach((chunk) => {
          const brackets = (chunk.match(/[[\]]/g) || []).length;

          if (brackets > 0) expect(brackets % 2).toBe(0);
        });
      });
    });

    describe('Markdown', () => {
      const text = `# Markdown Showcase

This document demonstrates all markdown elements and their various syntax flavors.

## Headings

# H1 Heading
## H2 Heading
### H3 Heading
#### H4 Heading
##### H5 Heading
###### H6 Heading

Alternative H1 (Setext)
=======================

Alternative H2 (Setext)
-----------------------

## Text Formatting

**Bold text with asterisks** and __bold text with underscores__

*Italic text with asterisks* and _italic text with underscores_

***Bold and italic*** and ___bold and italic___

~~Strikethrough text~~

\`Inline code\` with backticks

## Lists

### Unordered Lists (3 variants)

- Item 1 with dash
- Item 2 with dash
  - Nested item
  - Another nested item

* Item 1 with asterisk
* Item 2 with asterisk
  * Nested item
  * Another nested item

+ Item 1 with plus
+ Item 2 with plus
  + Nested item
  + Another nested item

### Ordered Lists

1. First item
2. Second item
   1. Nested ordered item
   2. Another nested item
3. Third item

### Task Lists (GFM)

- [x] Completed task
- [ ] Incomplete task
- [x] Another completed task

## Links and Images

[Regular link](https://example.com)

[Link with title](https://example.com "This is a title")

<https://autolink.com>

![Image alt text](https://via.placeholder.com/150 "Image title")

![Image without title](https://via.placeholder.com/100)

Reference-style [link][1] and [another link][reference].

[1]: https://example.com
[reference]: https://example.com "Reference with title"

## Code Blocks

### Fenced Code Blocks

\`\`\`javascript
function hello() {
  console.log("Hello, world!");
  return true;
}
\`\`\`

\`\`\`python
def hello():
    print("Hello, world!")
    return True
\`\`\`

\`\`\`
Code block without language
\`\`\`

### Indented Code Blocks

    function indentedCode() {
        return "This is indented code";
    }

## Tables (GFM)

| Left Aligned | Center Aligned | Right Aligned |
|:-------------|:--------------:|--------------:|
| Cell 1       | Cell 2         | Cell 3        |
| Long cell    | Short          | 123           |

| Command | Description |
| --- | --- |
| git status | Show working tree status |
| git diff | Show changes between commits |

## Blockquotes

> Simple blockquote
>
> Multiple lines in blockquote

> ### Blockquote with heading
>
> **Bold text** in blockquote
>
> 1. Ordered list in blockquote
> 2. Another item

> Nested blockquotes
>
> > This is nested
> >
> > > And this is deeply nested

## Horizontal Rules (3 variants)

---

***

___

## Line Breaks

Line with two spaces at end
Creates a line break

Line with backslash\\
Also creates a line break

## HTML Elements

<div>Raw HTML div</div>

<strong>HTML strong tag</strong>

<em>HTML emphasis tag</em>

<!-- HTML comment -->

## Escape Characters

\\* Not italic \\*

\\_ Not italic \\_

\\# Not a heading

\\[Not a link\\](not-a-url)

## Special Characters and Entities

&copy; &amp; &lt; &gt; &quot; &#39;

## Mixed Complex Examples

This paragraph contains **bold**, *italic*, ~~strikethrough~~, and \`inline code\`. It also has a [link](https://example.com) and an ![image](https://via.placeholder.com/16).

### Complex List Example

1. First item with **bold text**
   - Nested unordered item with *italic*
   - Another nested item with \`code\`
   - [ ] Task item in nested list
   - [x] Completed task
2. Second item with [link](https://example.com)
   \`\`\`javascript
   // Code block in list item
   const example = true;
   \`\`\`
3. Third item with blockquote:
   > This is a blockquote inside a list item
   > with multiple lines

### Table with Complex Content

| Element | Syntax Variants | Example |
|---------|----------------|---------|
| Bold | \`**text**\` or \`__text__\` | **bold** and __bold__ |
| Italic | \`*text*\` or \`_text_\` | *italic* and _italic_ |
| Code | \`\\\`text\\\`\` | \`code\` |
| Link | \`[text](url)\` | [example](https://example.com) |

## Edge Cases

Empty lines:



Multiple spaces:     (5 spaces)

Trailing spaces:

Mixed formatting: ***Really*** important **and *nested* formatting**

Autolinks: https://example.com and email@example.com

Footnotes (if supported):
Here's a sentence with a footnote[^1].

[^1]: This is the footnote content.

---

*This document showcases most markdown elements and syntax variations.*`;

      it('should split with strict 200 chunk size', () => {
        const splitter = chunkdown({
          chunkSize: 200,
          maxOverflowRatio: 1.0,
        });
        const chunks = splitter.splitText(text);

        expect(chunks).toMatchInlineSnapshot(`
          [
            "# Markdown Showcase

          This document demonstrates all markdown elements and their various syntax flavors.

          ## Headings",
            "# H1 Heading

          ## H2 Heading

          ### H3 Heading

          #### H4 Heading

          ##### H5 Heading

          ###### H6 Heading",
            "# Alternative H1 (Setext)

          ## Alternative H2 (Setext)",
            "## Text Formatting

          **Bold text with asterisks** and **bold text with underscores**

          *Italic text with asterisks* and *italic text with underscores*

          ***Bold and italic*** and ***bold and italic***

          ~~Strikethrough text~~",
            "\`Inline code\` with backticks",
            "## Lists",
            "### Unordered Lists (3 variants)

          * Item 1 with dash
          * Item 2 with dash
            * Nested item
            * Another nested item

          - Item 1 with asterisk
          - Item 2 with asterisk
            * Nested item
            * Another nested item",
            "* Item 1 with plus
          * Item 2 with plus
            * Nested item
            * Another nested item",
            "### Ordered Lists

          1. First item
          2. Second item
             1. Nested ordered item
             2. Another nested item
          3. Third item

          ### Task Lists (GFM)

          * [x] Completed task
          * [ ] Incomplete task
          * [x] Another completed task",
            "## Links and Images

          [Regular link](https://example.com)

          [Link with title](https://example.com "This is a title")

          <https://autolink.com>

          ![Image alt text](https://via.placeholder.com/150 "Image title")

          ![Image without title](https://via.placeholder.com/100)

          Reference-style [link][1] and [another link][reference].

          [1]: https://example.com

          [reference]: https://example.com "Reference with title"",
            "## Code Blocks

          ### Fenced Code Blocks

          \`\`\`javascript
          function hello() {
            console.log("Hello, world!");
            return true;
          }
          \`\`\`

          \`\`\`python
          def hello():
              print("Hello, world!")
              return True
          \`\`\`

          \`\`\`
          Code block without language
          \`\`\`",
            "### Indented Code Blocks

          \`\`\`
          function indentedCode() {
              return "This is indented code";
          }
          \`\`\`",
            "## Tables (GFM)

          | Left Aligned | Center Aligned | Right Aligned |
          | :----------- | :------------: | ------------: |
          | Cell 1       |     Cell 2     |        Cell 3 |
          | Long cell    |      Short     |           123 |

          | Command    | Description                  |
          | ---------- | ---------------------------- |
          | git status | Show working tree status     |
          | git diff   | Show changes between commits |",
            "## Blockquotes

          > Simple blockquote
          >
          > Multiple lines in blockquote

          > ### Blockquote with heading
          >
          > **Bold text** in blockquote
          >
          > 1. Ordered list in blockquote
          > 2. Another item

          > Nested blockquotes
          >
          > > This is nested
          > >
          > > > And this is deeply nested",
            "## Horizontal Rules (3 variants)",
            "***

          ***

          ***",
            "## Line Breaks

          Line with two spaces at end
          Creates a line break

          Line with backslash\\
          Also creates a line break",
            "## HTML Elements

          <div>Raw HTML div</div>

          <strong>HTML strong tag</strong>

          <em>HTML emphasis tag</em>

          <!-- HTML comment -->",
            "## Escape Characters

          \\* Not italic \\*

          \\_ Not italic \\_

          \\# Not a heading

          \\[Not a link]\\(not-a-url)",
            "## Special Characters and Entities

          © & < > " '",
            "## Mixed Complex Examples

          This paragraph contains **bold**, *italic*, ~~strikethrough~~, and \`inline code\`. It also has a [link](https://example.com) and an ![image](https://via.placeholder.com/16).",
            "### Complex List Example",
            "1. First item with **bold text**
             * Nested unordered item with *italic*
             * Another nested item with \`code\`
             * [ ] Task item in nested list
             * [x] Completed task
          2. Second item with [link](https://example.com)
             \`\`\`javascript
             // Code block in list item
             const example = true;
             \`\`\`",
            "3. Third item with blockquote:
             > This is a blockquote inside a list item
             > with multiple lines",
            "### Table with Complex Content

          | Element | Syntax Variants          | Example                        |
          | ------- | ------------------------ | ------------------------------ |
          | Bold    | \`**text**\` or \`__text__\` | **bold** and **bold**          |
          | Italic  | \`*text*\` or \`_text_\`     | *italic* and *italic*          |
          | Code    | \`\\\`text\\\`\\\`              | \`code\`                         |
          | Link    | \`[text](url)\`            | [example](https://example.com) |",
            "## Edge Cases

          Empty lines:

          Multiple spaces:     (5 spaces)

          Trailing spaces:

          Mixed formatting: ***Really*** important **and *nested* formatting**

          Autolinks: <https://example.com> and <email@example.com>",
            "Footnotes (if supported):
          Here's a sentence with a footnote[^1].

          [^1]: This is the footnote content.",
            "***

          *This document showcases most markdown elements and syntax variations.*",
          ]
        `);

        // Verify overflow stays within bounds
        chunks.forEach((chunk) => {
          expect(getContentSize(chunk)).toBeLessThanOrEqual(300); // 200 * 1.5
        });

        // Verify links and images are never broken
        chunks.forEach((chunk) => {
          const brackets = (chunk.match(/[[\]]/g) || []).length;

          if (brackets > 0) expect(brackets % 2).toBe(0);
        });
      });

      it('should split with 1.5x overflow ratio', () => {
        const splitter = chunkdown({
          chunkSize: 200,
          maxOverflowRatio: 1.5,
        });
        const chunks = splitter.splitText(text);

        expect(chunks).toMatchInlineSnapshot(`
          [
            "# Markdown Showcase

          This document demonstrates all markdown elements and their various syntax flavors.

          ## Headings",
            "# H1 Heading

          ## H2 Heading

          ### H3 Heading

          #### H4 Heading

          ##### H5 Heading

          ###### H6 Heading",
            "# Alternative H1 (Setext)

          ## Alternative H2 (Setext)

          ## Text Formatting

          **Bold text with asterisks** and **bold text with underscores**

          *Italic text with asterisks* and *italic text with underscores*

          ***Bold and italic*** and ***bold and italic***

          ~~Strikethrough text~~

          \`Inline code\` with backticks",
            "## Lists

          ### Unordered Lists (3 variants)

          * Item 1 with dash
          * Item 2 with dash
            * Nested item
            * Another nested item

          - Item 1 with asterisk
          - Item 2 with asterisk
            * Nested item
            * Another nested item

          * Item 1 with plus
          * Item 2 with plus
            * Nested item
            * Another nested item",
            "### Ordered Lists

          1. First item
          2. Second item
             1. Nested ordered item
             2. Another nested item
          3. Third item

          ### Task Lists (GFM)

          * [x] Completed task
          * [ ] Incomplete task
          * [x] Another completed task",
            "## Links and Images

          [Regular link](https://example.com)

          [Link with title](https://example.com "This is a title")

          <https://autolink.com>

          ![Image alt text](https://via.placeholder.com/150 "Image title")

          ![Image without title](https://via.placeholder.com/100)

          Reference-style [link][1] and [another link][reference].

          [1]: https://example.com

          [reference]: https://example.com "Reference with title"",
            "## Code Blocks

          ### Fenced Code Blocks

          \`\`\`javascript
          function hello() {
            console.log("Hello, world!");
            return true;
          }
          \`\`\`

          \`\`\`python
          def hello():
              print("Hello, world!")
              return True
          \`\`\`

          \`\`\`
          Code block without language
          \`\`\`

          ### Indented Code Blocks

          \`\`\`
          function indentedCode() {
              return "This is indented code";
          }
          \`\`\`",
            "## Tables (GFM)

          | Left Aligned | Center Aligned | Right Aligned |
          | :----------- | :------------: | ------------: |
          | Cell 1       |     Cell 2     |        Cell 3 |
          | Long cell    |      Short     |           123 |

          | Command    | Description                  |
          | ---------- | ---------------------------- |
          | git status | Show working tree status     |
          | git diff   | Show changes between commits |",
            "## Blockquotes

          > Simple blockquote
          >
          > Multiple lines in blockquote

          > ### Blockquote with heading
          >
          > **Bold text** in blockquote
          >
          > 1. Ordered list in blockquote
          > 2. Another item

          > Nested blockquotes
          >
          > > This is nested
          > >
          > > > And this is deeply nested

          ## Horizontal Rules (3 variants)",
            "***

          ***

          ***",
            "## Line Breaks

          Line with two spaces at end
          Creates a line break

          Line with backslash\\
          Also creates a line break",
            "## HTML Elements

          <div>Raw HTML div</div>

          <strong>HTML strong tag</strong>

          <em>HTML emphasis tag</em>

          <!-- HTML comment -->",
            "## Escape Characters

          \\* Not italic \\*

          \\_ Not italic \\_

          \\# Not a heading

          \\[Not a link]\\(not-a-url)",
            "## Special Characters and Entities

          © & < > " '",
            "## Mixed Complex Examples

          This paragraph contains **bold**, *italic*, ~~strikethrough~~, and \`inline code\`. It also has a [link](https://example.com) and an ![image](https://via.placeholder.com/16).",
            "### Complex List Example

          1. First item with **bold text**
             * Nested unordered item with *italic*
             * Another nested item with \`code\`
             * [ ] Task item in nested list
             * [x] Completed task
          2. Second item with [link](https://example.com)
             \`\`\`javascript
             // Code block in list item
             const example = true;
             \`\`\`
          3. Third item with blockquote:
             > This is a blockquote inside a list item
             > with multiple lines",
            "### Table with Complex Content

          | Element | Syntax Variants          | Example                        |
          | ------- | ------------------------ | ------------------------------ |
          | Bold    | \`**text**\` or \`__text__\` | **bold** and **bold**          |
          | Italic  | \`*text*\` or \`_text_\`     | *italic* and *italic*          |
          | Code    | \`\\\`text\\\`\\\`              | \`code\`                         |
          | Link    | \`[text](url)\`            | [example](https://example.com) |",
            "## Edge Cases

          Empty lines:

          Multiple spaces:     (5 spaces)

          Trailing spaces:

          Mixed formatting: ***Really*** important **and *nested* formatting**

          Autolinks: <https://example.com> and <email@example.com>

          Footnotes (if supported):
          Here's a sentence with a footnote[^1].

          [^1]: This is the footnote content.",
            "***

          *This document showcases most markdown elements and syntax variations.*",
          ]
        `);

        // Verify overflow stays within bounds
        chunks.forEach((chunk) => {
          expect(getContentSize(chunk)).toBeLessThanOrEqual(300); // 200 * 1.5
        });

        // Verify links and images are never broken
        chunks.forEach((chunk) => {
          const brackets = (chunk.match(/[[\]]/g) || []).length;

          if (brackets > 0) expect(brackets % 2).toBe(0);
        });
      });
    });

    describe('Llama Wikipedia', () => {
      const text = `The **llama** ([/ˈlɑːmə/](https://en.wikipedia.org/wiki/Help:IPA/English "Help:IPA/English"); Spanish pronunciation: [[ˈʎama]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish") or [[ˈʝama]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish")) (_**Lama glama**_) is a domesticated [South American](https://en.wikipedia.org/wiki/South_America "South America") [camelid](https://en.wikipedia.org/wiki/Camelid "Camelid"), widely used as a [meat](https://en.wikipedia.org/wiki/List_of_meat_animals "List of meat animals") and [pack animal](https://en.wikipedia.org/wiki/Pack_animal "Pack animal") by [Andean cultures](https://en.wikipedia.org/wiki/Inca_empire "Inca empire") since the [pre-Columbian era](https://en.wikipedia.org/wiki/Pre-Columbian_era "Pre-Columbian era").

Llamas are social animals and live with others as a [herd](https://en.wikipedia.org/wiki/Herd "Herd"). Their [wool](https://en.wikipedia.org/wiki/Wool "Wool") is soft and contains only a small amount of [lanolin](https://en.wikipedia.org/wiki/Lanolin "Lanolin").[[2]](https://en.wikipedia.org/wiki/Llama#cite_note-2) Llamas can learn simple tasks after a few repetitions. When using a pack, they can carry about 25 to 30% of their body weight for 8 to 13 [km](https://en.wikipedia.org/wiki/Kilometre "Kilometre") (5–8 [miles](https://en.wikipedia.org/wiki/Mile "Mile")).[[3]](https://en.wikipedia.org/wiki/Llama#cite_note-OK_State-3) The name _llama_ (also historically spelled "lama" or "glama") was adopted by [European settlers](https://en.wikipedia.org/wiki/European_colonization_of_the_Americas "European colonization of the Americas") from [native Peruvians](https://en.wikipedia.org/wiki/Indigenous_people_in_Peru "Indigenous people in Peru").[[4]](https://en.wikipedia.org/wiki/Llama#cite_note-4)`;

      it('should split with strict 200 chunk size', () => {
        const chunkSize = 200;
        const maxOverflowRatio = 1.0;
        const splitter = chunkdown({
          chunkSize,
          maxOverflowRatio,
        });
        const chunks = splitter.splitText(text);

        expect(chunks).toMatchInlineSnapshot(`
          [
            "The **llama** ([/ˈlɑːmə/](https://en.wikipedia.org/wiki/Help:IPA/English "Help:IPA/English"); Spanish pronunciation:",
            "[\\[ˈʎama\\]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish") or [\\[ˈʝama\\]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish")) (***Lama glama***) is a domesticated [South American](https://en.wikipedia.org/wiki/South_America "South America") [camelid](https://en.wikipedia.org/wiki/Camelid "Camelid"), widely used as a [meat](https://en.wikipedia.org/wiki/List_of_meat_animals "List of meat animals") and [pack animal](https://en.wikipedia.org/wiki/Pack_animal "Pack animal") by [Andean cultures](https://en.wikipedia.org/wiki/Inca_empire "Inca empire") since the [pre-Columbian era](https://en.wikipedia.org/wiki/Pre-Columbian_era "Pre-Columbian era").",
            "Llamas are social animals and live with others as a [herd](https://en.wikipedia.org/wiki/Herd "Herd"). Their [wool](https://en.wikipedia.org/wiki/Wool "Wool") is soft and contains only a small amount of [lanolin](https://en.wikipedia.org/wiki/Lanolin "Lanolin").[\\[2\\]](https://en.wikipedia.org/wiki/Llama#cite_note-2) Llamas can learn simple tasks after a few repetitions.",
            "When using a pack, they can carry about 25 to 30% of their body weight for 8 to 13 [km](https://en.wikipedia.org/wiki/Kilometre "Kilometre") (5–8 [miles](https://en.wikipedia.org/wiki/Mile "Mile")).",
            "[\\[3\\]](https://en.wikipedia.org/wiki/Llama#cite_note-OK_State-3) The name *llama* (also historically spelled "lama" or "glama") was adopted by [European settlers](https://en.wikipedia.org/wiki/European_colonization_of_the_Americas "European colonization of the Americas") from [native Peruvians](https://en.wikipedia.org/wiki/Indigenous_people_in_Peru "Indigenous people in Peru").[\\[4\\]](https://en.wikipedia.org/wiki/Llama#cite_note-4)",
          ]
        `);

        // Verify overflow stays within bounds
        chunks.forEach((chunk) => {
          expect(chunk).toBeLessThanContentSize(chunkSize, maxOverflowRatio); // 200 * 1.5
        });

        // Verify links and images are never broken
        chunks.forEach((chunk) => {
          const brackets = (chunk.match(/[[\]]/g) || []).length;

          if (brackets > 0) expect(brackets % 2).toBe(0);
        });
      });

      it('should split with 1.5x overflow ratio', () => {
        const chunkSize = 200;
        const maxOverflowRatio = 1.5;
        const splitter = chunkdown({
          chunkSize,
          maxOverflowRatio,
        });
        const chunks = splitter.splitText(text);

        expect(chunks).toMatchInlineSnapshot(`
          [
            "The **llama** ([/ˈlɑːmə/](https://en.wikipedia.org/wiki/Help:IPA/English "Help:IPA/English"); Spanish pronunciation: [\\[ˈʎama\\]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish") or [\\[ˈʝama\\]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish")) (***Lama glama***) is a domesticated [South American](https://en.wikipedia.org/wiki/South_America "South America") [camelid](https://en.wikipedia.org/wiki/Camelid "Camelid"), widely used as a [meat](https://en.wikipedia.org/wiki/List_of_meat_animals "List of meat animals") and [pack animal](https://en.wikipedia.org/wiki/Pack_animal "Pack animal") by [Andean cultures](https://en.wikipedia.org/wiki/Inca_empire "Inca empire") since the [pre-Columbian era](https://en.wikipedia.org/wiki/Pre-Columbian_era "Pre-Columbian era").",
            "Llamas are social animals and live with others as a [herd](https://en.wikipedia.org/wiki/Herd "Herd"). Their [wool](https://en.wikipedia.org/wiki/Wool "Wool") is soft and contains only a small amount of [lanolin](https://en.wikipedia.org/wiki/Lanolin "Lanolin").[\\[2\\]](https://en.wikipedia.org/wiki/Llama#cite_note-2) Llamas can learn simple tasks after a few repetitions.",
            "When using a pack, they can carry about 25 to 30% of their body weight for 8 to 13 [km](https://en.wikipedia.org/wiki/Kilometre "Kilometre") (5–8 [miles](https://en.wikipedia.org/wiki/Mile "Mile")).[\\[3\\]](https://en.wikipedia.org/wiki/Llama#cite_note-OK_State-3) The name *llama* (also historically spelled "lama" or "glama") was adopted by [European settlers](https://en.wikipedia.org/wiki/European_colonization_of_the_Americas "European colonization of the Americas") from [native Peruvians](https://en.wikipedia.org/wiki/Indigenous_people_in_Peru "Indigenous people in Peru").[\\[4\\]](https://en.wikipedia.org/wiki/Llama#cite_note-4)",
          ]
        `);

        // Verify overflow stays within bounds
        chunks.forEach((chunk) => {
          expect(chunk).toBeLessThanContentSize(chunkSize, maxOverflowRatio); // 200 * 1.5
        });

        // Verify links and images are never broken
        chunks.forEach((chunk) => {
          const brackets = (chunk.match(/[[\]]/g) || []).length;

          if (brackets > 0) expect(brackets % 2).toBe(0);
        });
      });
    });
  });
});
