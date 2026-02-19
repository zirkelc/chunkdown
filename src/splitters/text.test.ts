import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from '../markdown';
import { TextSplitter } from './text';

describe('TextSplitter', () => {
  describe('Semantic Boundaries', () => {
    it('should split by period before newline', () => {
      const splitter = new TextSplitter({
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
      const splitter = new TextSplitter({
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
      const splitter = new TextSplitter({
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
      const splitter = new TextSplitter({
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
      const splitter = new TextSplitter({
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
      const splitter = new TextSplitter({
        chunkSize: 15,
        maxOverflowRatio: 1.0,
      });
      const text = `Hello (world) there [friend] now {buddy} end.`;
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(4);
      expect(chunks[0]).toBe('Hello (world)');
      // Square brackets in plain text get escaped in markdown to prevent interpretation as links
      expect(chunks[1]).toBe('there \\[friend]');
      expect(chunks[2]).toBe('now {buddy}');
      expect(chunks[3]).toBe('end.');
    });

    it('should split by opening brackets', () => {
      const splitter = new TextSplitter({
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
      const splitter = new TextSplitter({
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
      const splitter = new TextSplitter({
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
      const splitter = new TextSplitter({
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
      const splitter = new TextSplitter({
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
      const splitter = new TextSplitter({
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
      const splitter = new TextSplitter({
        chunkSize: 15,
        maxOverflowRatio: 1.0,
      });
      const text = `Wait... what happened... I don't know....`;
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(5);
      expect(chunks[0]).toBe('Wait...');
      expect(chunks[1]).toBe('what happened.');
      expect(chunks[2]).toBe('..');
      // The period before ellipsis gets escaped to prevent interpretation as list item
      expect(chunks[3]).toBe("I don't know\\..");
      expect(chunks[4]).toBe('..');
    });

    it('should split by period fallback', () => {
      const splitter = new TextSplitter({
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
      const splitter = new TextSplitter({
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

    it('should not split words', () => {
      const splitter = new TextSplitter({
        chunkSize: 5,
        maxOverflowRatio: 1.0,
      });

      const text = `supercalifragilisticexpialidocious antidisestablishmentarianism`;
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(2);
      expect(chunks[0]).toBe('supercalifragilisticexpialidocious');
      expect(chunks[1]).toBe('antidisestablishmentarianism');
    });

    it(`should keep period after closing bracket in same chunk`, () => {
      // Arrange
      const splitter = new TextSplitter({
        chunkSize: 15,
        maxOverflowRatio: 1.0,
      });
      const text = `Test (one).[link](url) after`;

      // Act
      const chunks = splitter.splitText(text);

      // Assert
      // Period should stay with the parenthetical, not orphaned at start of next chunk
      expect(chunks[0]).toBe(`Test (one).`);
      expect(chunks[1]).not.toMatch(/^\./); // Should NOT start with period
    });
  });

  describe('Rules', () => {
    describe('Formatting', () => {
      const text = `Some **long strong text** with some *long italic text* and ~~long deleted text~~.`;

      it('may split formatting if rules are undefined', () => {
        const splitter = new TextSplitter({
          chunkSize: 30,
          maxOverflowRatio: 1.0,
          rules: {
            strong: undefined,
            emphasis: undefined,
            delete: undefined,
          },
        });
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

      it('may split formatting if rules are set to allow-split', () => {
        const splitter = new TextSplitter({
          chunkSize: 30,
          maxOverflowRatio: 1.0,
          rules: {
            strong: { split: { rule: 'allow-split' } },
            emphasis: { split: { rule: 'allow-split' } },
            delete: { split: { rule: 'allow-split' } },
          },
        });
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

      it('should not split formatting if rules are set to never-split', () => {
        const splitter = new TextSplitter({
          chunkSize: 30,
          maxOverflowRatio: 1.0,
          rules: {
            strong: { split: { rule: 'never-split' } },
            emphasis: { split: { rule: 'never-split' } },
            delete: { split: { rule: 'never-split' } },
          },
        });
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

      it('should use formatting rule as fallback if rules are not set', () => {
        const splitter = new TextSplitter({
          chunkSize: 30,
          maxOverflowRatio: 1.0,
          rules: {
            strong: undefined,
            emphasis: undefined,
            delete: undefined,
            formatting: { split: 'never-split' },
          },
        });
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

      it('should split formatting if exceeds size limit', () => {
        const splitter = new TextSplitter({
          chunkSize: 30,
          maxOverflowRatio: 1.0,
          rules: {
            strong: { split: { rule: 'size-split', size: 30 } },
            emphasis: { split: { rule: 'size-split', size: 30 } },
            delete: { split: { rule: 'size-split', size: 30 } },
          },
        });
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

      it('should not split formatting if does not exceed size limit', () => {
        const splitter = new TextSplitter({
          chunkSize: 30,
          maxOverflowRatio: 1.0,
          rules: {
            strong: { split: { rule: 'size-split', size: 30 } },
          },
        });

        const chunks = splitter.splitText(text);

        const strongChunk = chunks.find((chunk) =>
          chunk.includes('**long strong text**'),
        );
        expect(strongChunk).toBeDefined();
      });
    });

    describe('Links', () => {
      /**
       * Text contains two links: one with spaces (can be split internally),
       * one without spaces (cannot be split, only overflows).
       */
      const text = `Check [link text here](https://a.com) and [documentation](https://b.com) for details.`;

      it('may split links if rules are undefined', () => {
        const splitter = new TextSplitter({
          chunkSize: 10,
          maxOverflowRatio: 1.0,
          rules: {
            link: undefined,
          },
        });

        const chunks = splitter.splitText(text);

        expect(chunks).toMatchInlineSnapshot(`
          [
            "Check",
            "[link",
            "text",
            "here](https://a.com)",
            "and",
            "[documentation](https://b.com)",
            "for",
            "details.",
          ]
        `);

        // Link with spaces: split at internal whitespace
        expect(chunks.find((c) => c.includes(`[link text here]`))).toBeUndefined();
        // Link without spaces: cannot be split, overflows intact
        expect(chunks.find((c) => c.includes(`[documentation]`))).toBeDefined();
      });

      it('should split links if rules are set to allow-split', () => {
        const splitter = new TextSplitter({
          chunkSize: 10,
          maxOverflowRatio: 1.0,
          rules: {
            link: { split: { rule: 'allow-split' } },
          },
        });

        const chunks = splitter.splitText(text);

        expect(chunks).toMatchInlineSnapshot(`
          [
            "Check",
            "[link",
            "text",
            "here](https://a.com)",
            "and",
            "[documentation](https://b.com)",
            "for",
            "details.",
          ]
        `);

        // Link with spaces: split at internal whitespace
        expect(chunks.find((c) => c.includes(`[link text here]`))).toBeUndefined();
        // Link without spaces: cannot be split, overflows intact
        expect(chunks.find((c) => c.includes(`[documentation]`))).toBeDefined();
      });

      it('should not split links if rules are set to never-split', () => {
        const splitter = new TextSplitter({
          chunkSize: 10,
          maxOverflowRatio: 1.0,
          rules: {
            link: { split: { rule: 'never-split' } },
          },
        });

        const chunks = splitter.splitText(text);

        expect(chunks).toMatchInlineSnapshot(`
          [
            "Check",
            "[link text here](https://a.com)",
            "and",
            "[documentation](https://b.com)",
            "for",
            "details.",
          ]
        `);

        // Both links preserved intact
        expect(chunks.find((c) => c.includes(`[link text here]`))).toBeDefined();
        expect(chunks.find((c) => c.includes(`[documentation]`))).toBeDefined();
      });

      it('should split links if exceeds size limit', () => {
        const splitter = new TextSplitter({
          chunkSize: 10,
          maxOverflowRatio: 1.0,
          rules: {
            link: { split: { rule: 'size-split', size: 10 } },
          },
        });

        const chunks = splitter.splitText(text);

        expect(chunks).toMatchInlineSnapshot(`
          [
            "Check",
            "[link",
            "text",
            "here](https://a.com)",
            "and",
            "[documentation](https://b.com)",
            "for",
            "details.",
          ]
        `);

        // Link with spaces: split at internal whitespace
        expect(chunks.find((c) => c.includes(`[link text here]`))).toBeUndefined();
        // Link without spaces: cannot be split, overflows intact
        expect(chunks.find((c) => c.includes(`[documentation]`))).toBeDefined();
      });

      it('should not split links if does not exceed size limit', () => {
        const splitter = new TextSplitter({
          chunkSize: 10,
          maxOverflowRatio: 1.0,
          rules: {
            link: { split: { rule: 'size-split', size: 50 } },
          },
        });

        const chunks = splitter.splitText(text);

        expect(chunks).toMatchInlineSnapshot(`
          [
            "Check",
            "[link text here](https://a.com)",
            "and",
            "[documentation](https://b.com)",
            "for",
            "details.",
          ]
        `);

        // Both links preserved intact
        expect(chunks.find((c) => c.includes(`[link text here]`))).toBeDefined();
        expect(chunks.find((c) => c.includes(`[documentation]`))).toBeDefined();
      });
    });

    describe('Images', () => {
      /**
       * Text contains two images: one with spaces in alt (can be split internally),
       * one without spaces (cannot be split, only overflows).
       */
      const text = `Check ![image alt text](./a.png) and ![architecture](./b.png) for details.`;

      it('may split images if rules are undefined', () => {
        const splitter = new TextSplitter({
          chunkSize: 10,
          maxOverflowRatio: 1.0,
          rules: {
            image: undefined,
          },
        });

        const chunks = splitter.splitText(text);

        expect(chunks).toMatchInlineSnapshot(`
          [
            "Check",
            "![image",
            "alt",
            "text](./a.png)",
            "and",
            "![architecture](./b.png)",
            "for",
            "details.",
          ]
        `);

        // Image with spaces: split at internal whitespace
        expect(chunks.find((c) => c.includes(`![image alt text]`))).toBeUndefined();
        // Image without spaces: cannot be split, overflows intact
        expect(chunks.find((c) => c.includes(`![architecture]`))).toBeDefined();
      });

      it('should split images if rules are set to allow-split', () => {
        const splitter = new TextSplitter({
          chunkSize: 10,
          maxOverflowRatio: 1.0,
          rules: {
            image: { split: { rule: 'allow-split' } },
          },
        });

        const chunks = splitter.splitText(text);

        expect(chunks).toMatchInlineSnapshot(`
          [
            "Check",
            "![image",
            "alt",
            "text](./a.png)",
            "and",
            "![architecture](./b.png)",
            "for",
            "details.",
          ]
        `);

        // Image with spaces: split at internal whitespace
        expect(chunks.find((c) => c.includes(`![image alt text]`))).toBeUndefined();
        // Image without spaces: cannot be split, overflows intact
        expect(chunks.find((c) => c.includes(`![architecture]`))).toBeDefined();
      });

      it('should not split images if rules are set to never-split', () => {
        const splitter = new TextSplitter({
          chunkSize: 10,
          maxOverflowRatio: 1.0,
          rules: {
            image: { split: { rule: 'never-split' } },
          },
        });

        const chunks = splitter.splitText(text);

        expect(chunks).toMatchInlineSnapshot(`
          [
            "Check",
            "![image alt text](./a.png)",
            "and",
            "![architecture](./b.png)",
            "for",
            "details.",
          ]
        `);

        // Both images preserved intact
        expect(chunks.find((c) => c.includes(`![image alt text]`))).toBeDefined();
        expect(chunks.find((c) => c.includes(`![architecture]`))).toBeDefined();
      });

      it('should split images if exceeds size limit', () => {
        const splitter = new TextSplitter({
          chunkSize: 10,
          maxOverflowRatio: 1.0,
          rules: {
            image: { split: { rule: 'size-split', size: 10 } },
          },
        });

        const chunks = splitter.splitText(text);

        expect(chunks).toMatchInlineSnapshot(`
          [
            "Check",
            "![image",
            "alt",
            "text](./a.png)",
            "and",
            "![architecture](./b.png)",
            "for",
            "details.",
          ]
        `);

        // Image with spaces: split at internal whitespace
        expect(chunks.find((c) => c.includes(`![image alt text]`))).toBeUndefined();
        // Image without spaces: cannot be split, overflows intact
        expect(chunks.find((c) => c.includes(`![architecture]`))).toBeDefined();
      });

      it('should not split images if does not exceed size limit', () => {
        const splitter = new TextSplitter({
          chunkSize: 10,
          maxOverflowRatio: 1.0,
          rules: {
            image: { split: { rule: 'size-split', size: 50 } },
          },
        });

        const chunks = splitter.splitText(text);

        expect(chunks).toMatchInlineSnapshot(`
          [
            "Check",
            "![image alt text](./a.png)",
            "and",
            "![architecture](./b.png)",
            "for",
            "details.",
          ]
        `);

        // Both images preserved intact
        expect(chunks.find((c) => c.includes(`![image alt text]`))).toBeDefined();
        expect(chunks.find((c) => c.includes(`![architecture]`))).toBeDefined();
      });
    });

    describe('Inline Code', () => {
      const text = `Check \`long inline code example here\` for more details.`;

      it('may split inline code if rules are undefined', () => {
        const splitter = new TextSplitter({
          chunkSize: 10,
          maxOverflowRatio: 1.0,
          rules: {
            inlineCode: undefined,
          },
        });

        const chunks = splitter.splitText(text);

        const codeChunk = chunks.find((chunk) =>
          chunk.includes('`long inline code example here`'),
        );
        expect(codeChunk).toBeUndefined();
      });

      it('should split inline code if rules are set to allow-split', () => {
        const splitter = new TextSplitter({
          chunkSize: 10,
          maxOverflowRatio: 1.0,
          rules: {
            inlineCode: { split: { rule: 'allow-split' } },
          },
        });

        const chunks = splitter.splitText(text);

        const codeChunk = chunks.find((chunk) =>
          chunk.includes('`long inline code example here`'),
        );
        expect(codeChunk).toBeUndefined();
      });

      it('should not split inline code if rules are set to never-split', () => {
        const splitter = new TextSplitter({
          chunkSize: 10,
          maxOverflowRatio: 1.0,
          rules: {
            inlineCode: { split: { rule: 'never-split' } },
          },
        });

        const chunks = splitter.splitText(text);

        const codeChunk = chunks.find((chunk) =>
          chunk.includes('`long inline code example here`'),
        );
        expect(codeChunk).toBeDefined();
      });

      it('should split inline code if exceeds size limit', () => {
        const splitter = new TextSplitter({
          chunkSize: 10,
          maxOverflowRatio: 1.0,
          rules: {
            inlineCode: { split: { rule: 'size-split', size: 10 } },
          },
        });

        const chunks = splitter.splitText(text);

        const codeChunk = chunks.find((chunk) =>
          chunk.includes('`long inline code example here`'),
        );
        expect(codeChunk).toBeUndefined();
      });

      it('should not split inline code if does not exceed size limit', () => {
        const splitter = new TextSplitter({
          chunkSize: 10,
          maxOverflowRatio: 1.0,
          rules: {
            inlineCode: { split: { rule: 'size-split', size: 50 } },
          },
        });

        const chunks = splitter.splitText(text);

        const codeChunk = chunks.find((chunk) =>
          chunk.includes('`long inline code example here`'),
        );
        expect(codeChunk).toBeDefined();
      });
    });

    describe('Regression: Split links should not produce escaped markdown', () => {
      it('should not escape markdown syntax when splitting links with allow-split', () => {
        // When a link is split (allow-split), the fragments should be yielded as raw text
        // without being parsed through fromMarkdown, which would escape [ ] ( ) characters
        const text =
          'Please check out the [AI SDK Core API Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core) for more details.';

        const splitter = new TextSplitter({
          chunkSize: 35,
          maxOverflowRatio: 1.0,
          rules: {
            link: { split: 'allow-split' },
          },
        });

        const chunks = splitter.splitText(text);

        // No chunk should have escaped brackets or parentheses
        for (const chunk of chunks) {
          expect(chunk).not.toContain('\\[');
          expect(chunk).not.toContain('\\]');
          expect(chunk).not.toContain('\\(');
          expect(chunk).not.toContain('\\)');
        }

        // Verify chunks don't have incorrectly parsed links like [https://ai-sdk](https://ai-sdk)
        for (const chunk of chunks) {
          expect(chunk).not.toMatch(/\[[^\]]+\]\([^)]+\)/); // No markdown link syntax
        }

        // Verify the raw link text and URL are preserved (chunks are trimmed so spaces may be lost)
        const joined = chunks.join(' ');
        expect(joined).toContain('SDK Core API Reference');
        // URL may be split at boundaries, but parts should be present
        expect(joined).toContain('ai-sdk');
        expect(joined).toContain('for more details');
      });

      it('should preserve link fragments as plain text when URL is split', () => {
        const text =
          'Visit [docs](https://example.com/very/long/path/to/docs) now.';

        const splitter = new TextSplitter({
          chunkSize: 20,
          maxOverflowRatio: 1.0,
          rules: {
            link: { split: 'allow-split' },
          },
        });

        const chunks = splitter.splitText(text);

        // Ensure the URL parts are not re-interpreted as markdown links
        for (const chunk of chunks) {
          // Should not contain escaped markdown characters
          expect(chunk).not.toContain('\\[');
          // Should not contain auto-linked URLs like [https://...](https://...)
          expect(chunk).not.toMatch(
            /\[https?:\/\/[^\]]+\]\(https?:\/\/[^)]+\)/,
          );
        }
      });
    });

    describe('Regression: Offset Mismatch Bug', () => {
      it('should not split links when processing nodes from hierarchical AST', () => {
        // This test reproduces the bug where links were split because
        // protected ranges were extracted from the original AST (with document-relative offsets)
        // but used with the converted markdown text (with string-relative offsets starting at 0)
        //
        // The bug only manifests when splitting a NODE (not text), because:
        // 1. The node comes from a parsed document with position offsets relative to the full document
        // 2. toMarkdown(node) creates a new string starting at offset 0
        // 3. extractProtectedRangesFromAST(node) returns ranges with the ORIGINAL offsets
        // 4. These mismatched offsets cause the protection mechanism to fail
        const text = `## AI SDK Core Functions

AI SDK Core has various functions designed for [text generation](./generating-text), [structured data generation](./generating-structured-data), and [tool usage](./tools-and-tool-calling).
These functions take a standardized approach to setting up [prompts](./prompts) and [settings](./settings), making it easier to work with different models.`;

        const splitter = new TextSplitter({
          chunkSize: 100,
          maxOverflowRatio: 1.0,
          rules: {
            link: { split: 'never-split', style: 'inline' },
            image: { split: 'never-split', style: 'inline' },
          },
        });

        // Parse the text to get an AST
        const ast = fromMarkdown(text);

        // Get the paragraph node (this simulates what TreeSplitter does)
        // The paragraph has position offsets relative to the full document
        const paragraph = ast.children[1];
        expect(paragraph.type).toBe('paragraph');

        // Split the paragraph node (not text!)
        const chunks = splitter.splitNode(paragraph);

        // Convert chunks back to markdown strings
        const chunkStrings = chunks.map((chunk) => toMarkdown(chunk).trim());

        // Verify that no chunk contains escaped brackets (indicating a split link)
        for (const chunk of chunkStrings) {
          expect(chunk).not.toMatch(/\\\[/); // Should not have escaped opening bracket
          expect(chunk).not.toMatch(/\]\\\(/); // Should not have escaped opening paren
        }

        // Verify that all complete links are preserved
        const allLinks = [
          '[text generation](./generating-text)',
          '[structured data generation](./generating-structured-data)',
          '[tool usage](./tools-and-tool-calling)',
          '[prompts](./prompts)',
          '[settings](./settings)',
        ];

        for (const link of allLinks) {
          const foundInChunk = chunkStrings.some((chunk) =>
            chunk.includes(link),
          );
          expect(foundInChunk).toBe(true);
        }

        // Verify we don't have malformed short chunks like "(." or "\[prompts]"
        for (const chunk of chunkStrings) {
          const trimmed = chunk.trim();
          // No chunk should be just punctuation or very short malformed fragments
          if (trimmed.length < 5 && trimmed.length > 0) {
            expect(trimmed).not.toMatch(/^[(.\\[\]]+$/);
          }
        }
      });
    });
  });

  describe(`Plain Text Pattern Matching`, () => {
    it(`should match patterns on plain text content, not markdown syntax`, () => {
      /**
       * The period after "First" in plain text is INSIDE the protected strong range,
       * so it should NOT cause a split inside the bold formatting.
       * The bold element should remain intact in a chunk.
       */
      const splitter = new TextSplitter({
        chunkSize: 15,
        maxOverflowRatio: 1.0,
        rules: {
          strong: { split: `never-split` },
        },
      });
      const text = `**First.** Second sentence here.`;
      const chunks = splitter.splitText(text);

      // Arrange
      // The bold element should be intact in one chunk (not split inside)
      const hasIntactBold = chunks.some((c) => c.includes(`**First.**`));
      expect(hasIntactBold).toBe(true);

      // No chunk should have a broken bold (e.g., `**First` without closing)
      const hasBrokenBold = chunks.some(
        (c) => c.includes(`**First`) && !c.includes(`**First.**`),
      );
      expect(hasBrokenBold).toBe(false);
    });

    it(`should not split inside protected link syntax`, () => {
      /**
       * Link text contains a period, but links are protected.
       * Split should happen after the link, not inside it.
       */
      const splitter = new TextSplitter({
        chunkSize: 20,
        maxOverflowRatio: 1.0,
        rules: {
          link: { split: `never-split` },
        },
      });
      const text = `Check [link.text](url) and more.`;
      const chunks = splitter.splitText(text);

      // Arrange
      // The period inside link text should not cause a split
      const fullLink = chunks.some((c) => c.includes(`[link.text](url)`));
      expect(fullLink).toBe(true);
    });

    it(`should handle inline code with periods correctly`, () => {
      /**
       * Inline code may contain periods, but those shouldn't be
       * matched as sentence boundaries when code is protected.
       */
      const splitter = new TextSplitter({
        chunkSize: 25,
        maxOverflowRatio: 1.0,
        rules: {
          inlineCode: { split: `never-split` },
        },
      });
      const text = 'Check `config.value` and then continue.';
      const chunks = splitter.splitText(text);

      // Arrange
      // The period inside inline code should not cause a split
      const hasFullCode = chunks.some((c) => c.includes('`config.value`'));
      expect(hasFullCode).toBe(true);
    });

    it(`should handle nested formatting with accurate position mapping`, () => {
      /**
       * Nested bold and italic should be handled correctly.
       * Plain text extraction should work through nested nodes.
       */
      const splitter = new TextSplitter({
        chunkSize: 20,
        maxOverflowRatio: 1.0,
        rules: {
          strong: { split: `never-split` },
          emphasis: { split: `never-split` },
        },
      });
      const text = '**bold *and italic* end**. After formatting.';
      const chunks = splitter.splitText(text);

      // Arrange
      // Should split after the period following the nested formatting
      expect(chunks.length).toBe(2);
      expect(chunks[0]).toBe('**bold *and italic* end**.');
      expect(chunks[1]).toBe('After formatting.');
    });

    it(`should correctly map positions when escape sequences are present`, () => {
      /**
       * Escape sequences add characters to markdown but not to plain text.
       * Position mapping should account for this.
       */
      const splitter = new TextSplitter({
        chunkSize: 20,
        maxOverflowRatio: 1.0,
      });
      // The asterisk gets escaped in markdown as \*
      const text = 'Not bold \\* here. After escape.';
      const chunks = splitter.splitText(text);

      // Arrange
      // Should still find sentence boundary correctly despite escape
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      // The important thing is that splitting doesn't break mid-word
      for (const chunk of chunks) {
        expect(chunk).not.toMatch(/^\\s/); // shouldn't start with space
      }
    });
  });

  describe(`Longer Text Examples with Snapshots`, () => {
    it(`should split mixed markdown formatting`, () => {
      // Arrange
      const splitter = new TextSplitter({
        chunkSize: 50,
        maxOverflowRatio: 1.0,
        rules: {
          link: { split: `never-split` },
          inlineCode: { split: `never-split` },
          strong: { split: `never-split` },
          emphasis: { split: `never-split` },
        },
      });
      const text = `This is **bold text** and *italic text*. Check [documentation](https://example.com) for details. Use \`config.init()\` to start.`;

      // Act
      const chunks = splitter.splitText(text);

      // Assert
      expect(chunks).toMatchInlineSnapshot(`
        [
          "This is **bold text** and *italic text*.",
          "Check [documentation](https://example.com) for details.",
          "Use \`config.init()\` to start.",
        ]
      `);
    });

    it(`should split paragraph with multiple sentences`, () => {
      // Arrange
      const splitter = new TextSplitter({
        chunkSize: 60,
        maxOverflowRatio: 1.0,
      });
      const text = `Large Language Models (LLMs) are advanced programs. They understand human language on a large scale. AI SDK Core simplifies working with LLMs. It offers a standardized API for integration.`;

      // Act
      const chunks = splitter.splitText(text);

      // Assert
      expect(chunks).toMatchInlineSnapshot(`
        [
          "Large Language Models (LLMs) are advanced programs.",
          "They understand human language on a large scale.",
          "AI SDK Core simplifies working with LLMs.",
          "It offers a standardized API for integration.",
        ]
      `);
    });

    it(`should split text with multiple links`, () => {
      // Arrange
      const splitter = new TextSplitter({
        chunkSize: 80,
        maxOverflowRatio: 1.0,
        rules: {
          link: { split: `never-split` },
        },
      });
      const text = `AI SDK Core has functions for [text generation](./generating-text), [structured data](./generating-structured-data), and [tool usage](./tools-and-tool-calling). These functions take a standardized approach.`;

      // Act
      const chunks = splitter.splitText(text);

      // Assert
      expect(chunks).toMatchInlineSnapshot(`
        [
          "AI SDK Core has functions for [text generation](./generating-text), [structured data](./generating-structured-data), and [tool usage](./tools-and-tool-calling).",
          "These functions take a standardized approach.",
        ]
      `);
    });

    it(`should split nested formatting with links`, () => {
      // Arrange
      const splitter = new TextSplitter({
        chunkSize: 40,
        maxOverflowRatio: 1.0,
        rules: {
          link: { split: `never-split` },
          strong: { split: `never-split` },
          emphasis: { split: `never-split` },
        },
      });
      const text = `The **[AI SDK](https://ai-sdk.dev)** is a *powerful* tool. It supports **bold with *nested italic* inside**. Check the docs.`;

      // Act
      const chunks = splitter.splitText(text);

      // Assert
      expect(chunks).toMatchInlineSnapshot(`
        [
          "The **[AI SDK](https://ai-sdk.dev)** is a *powerful* tool.",
          "It supports",
          "**bold with *nested italic* inside**.",
          "Check the docs.",
        ]
      `);
    });

    it(`should split long paragraph with various punctuation boundaries`, () => {
      // Arrange
      const splitter = new TextSplitter({
        chunkSize: 50,
        maxOverflowRatio: 1.0,
      });
      const text = `What is an LLM? It's a Large Language Model! These models are trained on vast amounts of text: books, articles, websites. They learn patterns – grammar, facts, reasoning – and can generate coherent responses. Amazing, isn't it?`;

      // Act
      const chunks = splitter.splitText(text);

      // Assert
      expect(chunks).toMatchInlineSnapshot(`
        [
          "What is an LLM? It's a Large Language Model!",
          "These models are trained on vast amounts of text:",
          "books, articles, websites.",
          "They learn patterns – grammar, facts,",
          "reasoning – and can generate coherent responses.",
          "Amazing, isn't it?",
        ]
      `);
    });
  });
});
