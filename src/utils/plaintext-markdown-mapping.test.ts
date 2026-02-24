import { describe, expect, test } from 'vitest';

import { fromMarkdown } from '../markdown';
import {
  buildPositionMapping,
  type PositionMapping,
  plainToMarkdownPosition,
} from './plaintext-markdown-mapping';

describe(`buildPositionMapping`, () => {
  describe(`text nodes`, () => {
    test(`extracts plain text from simple text nodes`, () => {
      // Arrange
      const markdown = `Hello world`;
      const ast = fromMarkdown(markdown);

      // Act
      const mapping = buildPositionMapping(ast, markdown);

      // Assert
      expect(mapping).toMatchInlineSnapshot(`
        {
          "markdown": "Hello world",
          "plain": "Hello world",
          "segments": [
            {
              "mdEnd": 11,
              "mdStart": 0,
              "nodeEnd": undefined,
              "nodeStart": undefined,
              "plainEnd": 11,
              "plainStart": 0,
            },
          ],
        }
      `);
    });

    test(`extracts plain text from multiple paragraphs`, () => {
      // Arrange
      const markdown = `First paragraph.\n\nSecond paragraph.`;
      const ast = fromMarkdown(markdown);

      // Act
      const mapping = buildPositionMapping(ast, markdown);

      // Assert
      expect(mapping).toMatchInlineSnapshot(`
        {
          "markdown": "First paragraph.

        Second paragraph.",
          "plain": "First paragraph.

        Second paragraph.",
          "segments": [
            {
              "mdEnd": 16,
              "mdStart": 0,
              "nodeEnd": undefined,
              "nodeStart": undefined,
              "plainEnd": 16,
              "plainStart": 0,
            },
            {
              "mdEnd": 18,
              "mdStart": 16,
              "plainEnd": 18,
              "plainStart": 16,
            },
            {
              "mdEnd": 35,
              "mdStart": 18,
              "nodeEnd": undefined,
              "nodeStart": undefined,
              "plainEnd": 35,
              "plainStart": 18,
            },
          ],
        }
      `);
    });
  });

  describe(`inline code`, () => {
    test(`extracts code content without backticks`, () => {
      // Arrange
      const markdown = `Use \`console.log\` for debugging`;
      const ast = fromMarkdown(markdown);

      // Act
      const mapping = buildPositionMapping(ast, markdown);

      // Assert
      expect(mapping).toMatchInlineSnapshot(`
        {
          "markdown": "Use \`console.log\` for debugging",
          "plain": "Use console.log for debugging",
          "segments": [
            {
              "mdEnd": 4,
              "mdStart": 0,
              "nodeEnd": undefined,
              "nodeStart": undefined,
              "plainEnd": 4,
              "plainStart": 0,
            },
            {
              "mdEnd": 16,
              "mdStart": 5,
              "nodeEnd": 17,
              "nodeStart": 4,
              "plainEnd": 15,
              "plainStart": 4,
            },
            {
              "mdEnd": 31,
              "mdStart": 17,
              "nodeEnd": undefined,
              "nodeStart": undefined,
              "plainEnd": 29,
              "plainStart": 15,
            },
          ],
        }
      `);
    });

    test(`handles double backtick inline code`, () => {
      // Arrange
      const markdown = `Use \`\`code with \` backtick\`\` here`;
      const ast = fromMarkdown(markdown);

      // Act
      const mapping = buildPositionMapping(ast, markdown);

      // Assert
      expect(mapping).toMatchInlineSnapshot(`
        {
          "markdown": "Use \`\`code with \` backtick\`\` here",
          "plain": "Use code with \` backtick here",
          "segments": [
            {
              "mdEnd": 4,
              "mdStart": 0,
              "nodeEnd": undefined,
              "nodeStart": undefined,
              "plainEnd": 4,
              "plainStart": 0,
            },
            {
              "mdEnd": 26,
              "mdStart": 6,
              "nodeEnd": 28,
              "nodeStart": 4,
              "plainEnd": 24,
              "plainStart": 4,
            },
            {
              "mdEnd": 33,
              "mdStart": 28,
              "nodeEnd": undefined,
              "nodeStart": undefined,
              "plainEnd": 29,
              "plainStart": 24,
            },
          ],
        }
      `);
    });
  });

  describe(`code blocks`, () => {
    test(`extracts code content without fences`, () => {
      // Arrange
      const markdown = `\`\`\`js\nconst x = 1;\n\`\`\``;
      const ast = fromMarkdown(markdown);

      // Act
      const mapping = buildPositionMapping(ast, markdown);

      // Assert
      expect(mapping).toMatchInlineSnapshot(`
        {
          "markdown": "\`\`\`js
        const x = 1;
        \`\`\`",
          "plain": "const x = 1;",
          "segments": [
            {
              "mdEnd": 18,
              "mdStart": 6,
              "plainEnd": 12,
              "plainStart": 0,
            },
          ],
        }
      `);
    });

    test(`handles code block without language identifier`, () => {
      // Arrange
      const markdown = `\`\`\`\ncode here\n\`\`\``;
      const ast = fromMarkdown(markdown);

      // Act
      const mapping = buildPositionMapping(ast, markdown);

      // Assert
      expect(mapping).toMatchInlineSnapshot(`
        {
          "markdown": "\`\`\`
        code here
        \`\`\`",
          "plain": "code here",
          "segments": [
            {
              "mdEnd": 13,
              "mdStart": 4,
              "plainEnd": 9,
              "plainStart": 0,
            },
          ],
        }
      `);
    });
  });

  describe(`image alt text`, () => {
    test(`extracts alt text from images`, () => {
      // Arrange
      const markdown = `![Alt text](image.png)`;
      const ast = fromMarkdown(markdown);

      // Act
      const mapping = buildPositionMapping(ast, markdown);

      // Assert
      expect(mapping).toMatchInlineSnapshot(`
        {
          "markdown": "![Alt text](image.png)",
          "plain": "Alt text",
          "segments": [
            {
              "mdEnd": 10,
              "mdStart": 2,
              "nodeEnd": 22,
              "nodeStart": 0,
              "plainEnd": 8,
              "plainStart": 0,
            },
          ],
        }
      `);
    });

    test(`handles images without alt text`, () => {
      // Arrange
      const markdown = `![](image.png)`;
      const ast = fromMarkdown(markdown);

      // Act
      const mapping = buildPositionMapping(ast, markdown);

      // Assert
      expect(mapping).toMatchInlineSnapshot(`
        {
          "markdown": "![](image.png)",
          "plain": "",
          "segments": [],
        }
      `);
    });
  });

  describe(`escape sequences`, () => {
    test(`handles escaped characters with charMap`, () => {
      // Arrange
      const markdown = `Hello \\*world\\*`;
      const ast = fromMarkdown(markdown);

      // Act
      const mapping = buildPositionMapping(ast, markdown);

      // Assert
      expect(mapping).toMatchInlineSnapshot(`
        {
          "markdown": "Hello \\*world\\*",
          "plain": "Hello *world*",
          "segments": [
            {
              "charMap": [
                0,
                1,
                2,
                3,
                4,
                5,
                7,
                8,
                9,
                10,
                11,
                12,
                14,
              ],
              "mdEnd": 15,
              "mdStart": 0,
              "nodeEnd": undefined,
              "nodeStart": undefined,
              "plainEnd": 13,
              "plainStart": 0,
            },
          ],
        }
      `);
    });

    test(`builds charMap for multiple escapes`, () => {
      // Arrange
      const markdown = `\\[text\\]`;
      const ast = fromMarkdown(markdown);

      // Act
      const mapping = buildPositionMapping(ast, markdown);

      // Assert
      expect(mapping).toMatchInlineSnapshot(`
        {
          "markdown": "\\[text\\]",
          "plain": "[text]",
          "segments": [
            {
              "charMap": [
                1,
                2,
                3,
                4,
                5,
                7,
              ],
              "mdEnd": 8,
              "mdStart": 0,
              "nodeEnd": undefined,
              "nodeStart": undefined,
              "plainEnd": 6,
              "plainStart": 0,
            },
          ],
        }
      `);
    });
  });

  describe(`nested formatting (nodeEnd tracking)`, () => {
    test(`tracks nodeEnd for emphasis`, () => {
      // Arrange
      const markdown = `*italic text*`;
      const ast = fromMarkdown(markdown);

      // Act
      const mapping = buildPositionMapping(ast, markdown);

      // Assert
      expect(mapping).toMatchInlineSnapshot(`
        {
          "markdown": "*italic text*",
          "plain": "italic text",
          "segments": [
            {
              "mdEnd": 12,
              "mdStart": 1,
              "nodeEnd": 13,
              "nodeStart": 0,
              "plainEnd": 11,
              "plainStart": 0,
            },
          ],
        }
      `);
    });

    test(`tracks nodeEnd for strong`, () => {
      // Arrange
      const markdown = `**bold text**`;
      const ast = fromMarkdown(markdown);

      // Act
      const mapping = buildPositionMapping(ast, markdown);

      // Assert
      expect(mapping).toMatchInlineSnapshot(`
        {
          "markdown": "**bold text**",
          "plain": "bold text",
          "segments": [
            {
              "mdEnd": 11,
              "mdStart": 2,
              "nodeEnd": 13,
              "nodeStart": 0,
              "plainEnd": 9,
              "plainStart": 0,
            },
          ],
        }
      `);
    });

    test(`tracks nodeEnd for links`, () => {
      // Arrange
      const markdown = `[link text](url)`;
      const ast = fromMarkdown(markdown);

      // Act
      const mapping = buildPositionMapping(ast, markdown);

      // Assert
      expect(mapping).toMatchInlineSnapshot(`
        {
          "markdown": "[link text](url)",
          "plain": "link text",
          "segments": [
            {
              "mdEnd": 10,
              "mdStart": 1,
              "nodeEnd": 16,
              "nodeStart": 0,
              "plainEnd": 9,
              "plainStart": 0,
            },
          ],
        }
      `);
    });

    test(`uses max nodeEnd for nested formatting`, () => {
      // Arrange
      const markdown = `**[bold link](url)**`;
      const ast = fromMarkdown(markdown);

      // Act
      const mapping = buildPositionMapping(ast, markdown);

      // Assert
      expect(mapping).toMatchInlineSnapshot(`
        {
          "markdown": "**[bold link](url)**",
          "plain": "bold link",
          "segments": [
            {
              "mdEnd": 12,
              "mdStart": 3,
              "nodeEnd": 20,
              "nodeStart": 0,
              "plainEnd": 9,
              "plainStart": 0,
            },
          ],
        }
      `);
    });
  });

  describe(`hard breaks`, () => {
    test(`preserves hard break (two spaces + newline) as newline in plain text`, () => {
      // Arrange - two trailing spaces create a hard break
      const markdown = `Line one  \nLine two`;
      const ast = fromMarkdown(markdown);

      // Act
      const mapping = buildPositionMapping(ast, markdown);

      // Assert - hard break becomes "\n" in plain text
      expect(mapping.plain).toBe(`Line one\nLine two`);
      expect(mapping.segments.length).toBe(3);
      // First text node
      expect(mapping.segments[0]).toEqual({
        mdStart: 0,
        mdEnd: 8,
        plainStart: 0,
        plainEnd: 8,
        nodeEnd: undefined,
      });
      // Hard break node (maps "  \n" in markdown to "\n" in plain)
      expect(mapping.segments[1]).toEqual({
        mdStart: 8,
        mdEnd: 11,
        plainStart: 8,
        plainEnd: 9,
      });
      // Second text node
      expect(mapping.segments[2]).toEqual({
        mdStart: 11,
        mdEnd: 19,
        plainStart: 9,
        plainEnd: 17,
        nodeEnd: undefined,
      });
    });

    test(`preserves hard break (backslash + newline) as newline in plain text`, () => {
      // Arrange - backslash before newline creates a hard break
      const markdown = `Line one\\\nLine two`;
      const ast = fromMarkdown(markdown);

      // Act
      const mapping = buildPositionMapping(ast, markdown);

      // Assert - hard break becomes "\n" in plain text
      expect(mapping.plain).toBe(`Line one\nLine two`);
      expect(mapping.segments.length).toBe(3);
      // First text node
      expect(mapping.segments[0]).toEqual({
        mdStart: 0,
        mdEnd: 8,
        plainStart: 0,
        plainEnd: 8,
        nodeEnd: undefined,
      });
      // Hard break node (maps "\\\n" in markdown to "\n" in plain)
      expect(mapping.segments[1]).toEqual({
        mdStart: 8,
        mdEnd: 10,
        plainStart: 8,
        plainEnd: 9,
      });
      // Second text node
      expect(mapping.segments[2]).toEqual({
        mdStart: 10,
        mdEnd: 18,
        plainStart: 9,
        plainEnd: 17,
        nodeEnd: undefined,
      });
    });
  });
});

describe(`plainToMarkdownPosition`, () => {
  describe(`position within segment`, () => {
    test(`maps position within a single segment`, () => {
      // Arrange
      const markdown = `Hello world`;
      const ast = fromMarkdown(markdown);
      const mapping = buildPositionMapping(ast, markdown);

      // Act
      const mdPos = plainToMarkdownPosition(3, mapping);

      // Assert
      expect(mdPos).toBe(3);
    });

    test(`maps position in middle of formatted text`, () => {
      // Arrange
      const markdown = `**bold text**`;
      const ast = fromMarkdown(markdown);
      const mapping = buildPositionMapping(ast, markdown);

      // Act - position 5 is "t" in "bold text" (plain)
      const mdPos = plainToMarkdownPosition(5, mapping);

      // Assert - should map to offset 7 in markdown (after "**bold ")
      expect(mdPos).toBe(7);
    });
  });

  describe(`segment boundaries`, () => {
    test(`maps position at segment start`, () => {
      // Arrange
      const markdown = `Hello world`;
      const ast = fromMarkdown(markdown);
      const mapping = buildPositionMapping(ast, markdown);

      // Act
      const mdPos = plainToMarkdownPosition(0, mapping);

      // Assert
      expect(mdPos).toBe(0);
    });

    test(`maps position at segment end`, () => {
      // Arrange
      const markdown = `Hello world`;
      const ast = fromMarkdown(markdown);
      const mapping = buildPositionMapping(ast, markdown);

      // Act
      const mdPos = plainToMarkdownPosition(11, mapping);

      // Assert
      expect(mdPos).toBe(11);
    });

    test(`uses nodeEnd at segment end for formatted text`, () => {
      // Arrange
      const markdown = `*italic*`;
      const ast = fromMarkdown(markdown);
      const mapping = buildPositionMapping(ast, markdown);

      // Act - position 6 is end of "italic" in plain text
      const mdPos = plainToMarkdownPosition(6, mapping);

      // Assert - should map to end of "*italic*" (nodeEnd)
      expect(mdPos).toBe(8);
    });

    test(`uses nodeEnd when binary search lands on next segment first`, () => {
      /**
       * This tests the bug where links like [[1]](url) were split between ] and (
       * because binary search landed on the next segment first, and the nodeEnd
       * check only existed in the plainPos === segment.plainEnd branch.
       */
      // Arrange
      const markdown = `Some text.[[1]](https://example.com) More text.`;
      const ast = fromMarkdown(markdown);
      const mapping = buildPositionMapping(ast, markdown);

      // Find the segment for the link text "[1]"
      // The plain text will be "Some text.[1] More text." (without link URL)
      // Position 13 is end of "[1]" in plain text (after the "]")
      const linkTextEndPos = mapping.plain.indexOf(`]`) + 1; // end of "[1]"

      // Act
      const mdPos = plainToMarkdownPosition(linkTextEndPos, mapping);

      // Assert - should map to end of the full link "[[1]](https://example.com)" not just "[[1]"
      // This ensures links don't get split between ] and (
      expect(mdPos).toBeGreaterThan(markdown.indexOf(`)`));
    });
  });

  describe(`gaps between segments`, () => {
    test(`handles position in gap between paragraphs`, () => {
      // Arrange
      const markdown = `First.\n\nSecond.`;
      const ast = fromMarkdown(markdown);
      const mapping = buildPositionMapping(ast, markdown);

      // Act - get markdown position at boundary
      // Plain text is "First.\n\nSecond." (15 chars, newlines preserved)
      // Position 6 is end of "First."
      const mdPos = plainToMarkdownPosition(6, mapping);

      // Assert - maps to end of first segment (6)
      expect(mdPos).toBe(6);
    });

    test(`maps position within gap content`, () => {
      // Arrange
      const markdown = `First.\n\nSecond.`;
      const ast = fromMarkdown(markdown);
      const mapping = buildPositionMapping(ast, markdown);

      // Act - position 7 is the first newline in the gap
      const mdPos = plainToMarkdownPosition(7, mapping);

      // Assert - maps to position 7 in markdown
      expect(mdPos).toBe(7);
    });

    test(`uses nodeEnd when position is in gap after formatted segment`, () => {
      /**
       * This tests the gap handling code path (lines 451-454) where:
       * - Binary search exits without finding an exact match
       * - Position falls between segments[right].plainEnd and segments[left].plainStart
       * - Previous segment has nodeEnd that should be used
       *
       * We manually construct a mapping to create this scenario since it's
       * hard to produce naturally from markdown parsing.
       */
      // Arrange
      const mapping: PositionMapping = {
        plain: `bold gap text`,
        markdown: `**bold** gap text`,
        segments: [
          {
            plainStart: 0,
            plainEnd: 4, // "bold"
            mdStart: 2,
            mdEnd: 6,
            nodeEnd: 8, // includes closing **
          },
          // Gap in plain text: positions 4-5 don't have a segment
          {
            plainStart: 5, // "gap text" starts at 5, leaving position 4 in a gap
            plainEnd: 13,
            mdStart: 9,
            mdEnd: 17,
          },
        ],
      };

      // Act - position 4 is in the gap between segments
      const mdPos = plainToMarkdownPosition(4, mapping);

      // Assert - should use nodeEnd (8) from previous segment, not mdEnd (6)
      expect(mdPos).toBe(8);
    });
  });

  describe(`escape sequences with charMap`, () => {
    test(`maps position correctly with escape sequences`, () => {
      // Arrange
      const markdown = `\\*star\\*`;
      const ast = fromMarkdown(markdown);
      const mapping = buildPositionMapping(ast, markdown);

      // Act - position 1 is "s" in "*star*"
      const mdPos = plainToMarkdownPosition(1, mapping);

      // Assert - should be at offset 2 (after "\*")
      expect(mdPos).toBe(2);
    });

    test(`maps end position correctly with escape sequences`, () => {
      // Arrange
      const markdown = `\\[text\\]`;
      const ast = fromMarkdown(markdown);
      const mapping = buildPositionMapping(ast, markdown);

      // Act - position 6 is end of "[text]"
      const mdPos = plainToMarkdownPosition(6, mapping);

      // Assert - should be at end of markdown (8)
      expect(mdPos).toBe(8);
    });
  });

  describe(`edge cases`, () => {
    test(`returns plainPos when no segments`, () => {
      // Arrange
      const mapping: PositionMapping = {
        plain: ``,
        markdown: ``,
        segments: [],
      };

      // Act
      const mdPos = plainToMarkdownPosition(5, mapping);

      // Assert
      expect(mdPos).toBe(5);
    });

    test(`handles position before all segments`, () => {
      // Arrange - create a mapping with segments that don't start at 0
      // by manually constructing the mapping (since markdown text nodes always start at 0)
      const mapping: PositionMapping = {
        plain: `code`,
        markdown: `   \`code\``,
        segments: [
          {
            plainStart: 0,
            plainEnd: 4,
            mdStart: 4, // after "   `"
            mdEnd: 8, // before "`"
          },
        ],
      };

      // Act - position 0 should map to mdStart
      const mdPos = plainToMarkdownPosition(0, mapping);

      // Assert - should map to start of first segment
      expect(mdPos).toBe(4);
    });

    test(`handles position after all segments`, () => {
      // Arrange
      const markdown = `Hello`;
      const ast = fromMarkdown(markdown);
      const mapping = buildPositionMapping(ast, markdown);

      // Act - position 10 is beyond plain text length (5)
      const mdPos = plainToMarkdownPosition(10, mapping);

      // Assert - should map to mdEnd + overflow
      expect(mdPos).toBe(10);
    });

    test(`prefers previous segment end at segment boundary`, () => {
      // Arrange - two adjacent text segments (from different paragraphs)
      const markdown = `First paragraph.\n\nSecond paragraph.`;
      const ast = fromMarkdown(markdown);
      const mapping = buildPositionMapping(ast, markdown);

      // First segment is "First paragraph." (16 chars)
      // Second segment is "Second paragraph." starting at plain position 16

      // Act - position 16 is at boundary
      const mdPos = plainToMarkdownPosition(16, mapping);

      // Assert - should prefer end of first segment (16 in markdown)
      expect(mdPos).toBe(16);
    });
  });
});
