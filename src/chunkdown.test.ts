import { describe, expect, it } from 'vitest';
import { chunkdown } from './chunkdown';
import { getContentSize } from './size';

describe('chunkdown', () => {
  describe('Sizing', () => {
    const longUrl = `https://example.com/${'x'.repeat(100)}`;
    const text = `Text [link1](${longUrl}) and [link2](${longUrl}) here.`;

    it('should use content size for splitting', () => {
      const splitter = chunkdown({
        chunkSize: 50,
        maxOverflowRatio: 1.0,
      });

      const { chunks } = splitter.split(text);

      expect(chunks.length).toBe(1);
      expect(getContentSize(chunks[0].text)).toBe(26);
    });

    it('should enforce raw size limit if defined', () => {
      const maxRawSize = 150;
      const splitter = chunkdown({
        chunkSize: 50,
        maxOverflowRatio: 1.0,
        maxRawSize,
      });

      const { chunks } = splitter.split(text);

      expect(chunks.length).toBe(2);

      const link1Chunk = chunks.find((chunk) => chunk.text.includes('link1'));
      const link2Chunk = chunks.find((chunk) => chunk.text.includes('link2'));

      expect(link1Chunk).toBeDefined();
      expect(link2Chunk).toBeDefined();

      chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeLessThanOrEqual(maxRawSize);
      });
    });
  });

  describe('Breadcrumbs', () => {
    /**
     * Breadcrumb behavior:
     * - Breadcrumbs contain ONLY ancestor headings (not the section's own heading if it's in the chunk)
     * - If chunk contains a heading → breadcrumbs = ancestors of that heading
     * - If chunk is content-only (split from its heading) → breadcrumbs = ancestors + section heading
     */

    it('should return empty breadcrumbs when heading is in chunk (top-level)', () => {
      const splitter = chunkdown({
        chunkSize: 50,
        maxOverflowRatio: 1.0,
      });

      const text = `# Main Section

Some content here.`;

      const { chunks } = splitter.split(text);

      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toContain('# Main Section');
      // Heading is in chunk → breadcrumbs are empty (no ancestors for H1)
      expect(chunks[0].breadcrumbs.length).toBe(0);
    });

    it('should return empty breadcrumbs for orphaned content and heading chunks', () => {
      const splitter = chunkdown({
        chunkSize: 100,
        maxOverflowRatio: 1.0,
      });

      const text = `Some intro text before any heading.

# First Heading

Content under heading.`;

      const { chunks } = splitter.split(text);

      expect(chunks.length).toBe(2);

      // First chunk (orphaned content) should have empty breadcrumbs
      expect(chunks[0].breadcrumbs).toEqual([]);

      // Second chunk contains "# First Heading" → breadcrumbs are empty (no ancestors for H1)
      expect(chunks[1].breadcrumbs).toEqual([]);
    });

    it('should return ancestor breadcrumbs when heading is in chunk (nested)', () => {
      const splitter = chunkdown({
        chunkSize: 20,
        maxOverflowRatio: 1.0,
      });

      const text = `# Level 1

## Level 2

### Level 3

Deep content here.`;

      const { chunks } = splitter.split(text);

      // Find chunk with Level 3 heading
      const level3Chunk = chunks.find((c) => c.text.includes('### Level 3'));

      expect(level3Chunk).toBeDefined();
      // Heading is in chunk → breadcrumbs are ancestors only: Level 1, Level 2
      expect(level3Chunk?.breadcrumbs.length).toBe(2);
      expect(level3Chunk?.breadcrumbs[0]).toEqual({
        text: 'Level 1',
        depth: 1,
      });
      expect(level3Chunk?.breadcrumbs[1]).toEqual({
        text: 'Level 2',
        depth: 2,
      });
    });

    it('should include section heading in breadcrumbs when content is split from heading', () => {
      const splitter = chunkdown({
        chunkSize: 50,
        maxOverflowRatio: 1.0,
      });

      const text = `# Section

First paragraph that exceeds the chunk size limit.

Second paragraph that also exceeds the limit.`;

      const { chunks } = splitter.split(text);

      expect(chunks.length).toBe(3);

      // First chunk has heading only → empty breadcrumbs
      expect(chunks[0].text).toBe('# Section');
      expect(chunks[0].breadcrumbs.length).toBe(0);

      // Remaining chunks are content-only → include section heading in breadcrumbs
      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].breadcrumbs.length).toBe(1);
        expect(chunks[i].breadcrumbs[0].text).toBe('Section');
        expect(chunks[i].breadcrumbs[0].depth).toBe(1);
      }
    });
  });

  describe('Whitespaces', () => {
    it('should handle empty input', () => {
      const splitter = chunkdown({
        chunkSize: 50,
        maxOverflowRatio: 1.0,
      });
      expect(splitter.split('').chunks).toEqual([]);
      expect(splitter.split(' ').chunks).toEqual([]);
      expect(splitter.split(' ').chunks).toEqual([]);
      expect(splitter.split('   \n\t   ').chunks).toEqual([]);
    });

    it('should handle unicode non-breaking whitespace', () => {
      const splitter = chunkdown({
        chunkSize: 10,
        maxOverflowRatio: 1.0,
      });
      // Text with non-breaking space (U+00A0) between paragraphs
      const text = `First paragraph.




Second paragraph.`;

      const { chunks } = splitter.split(text);

      expect(chunks.length).toBe(4);
      const emptyChunks = chunks.filter((chunk) => chunk.text.trim() === '');
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

      const { chunks } = splitter.split(text);

      expect(chunks.length).toBe(3);
      expect(chunks[0].text).toBe('First sentence.');
      expect(chunks[1].text).toBe('Second sentence.');
      expect(chunks[2].text).toBe('Third sentence.');
    });
  });

  describe('Overflow Control', () => {
    it('should set overflow ratio to 1.0 if less than 1.0', () => {
      const splitter = chunkdown({
        chunkSize: 100,
        maxOverflowRatio: 0.5,
      });

      expect(splitter.maxOverflowRatio).toBe(1.0);
    });

    it('should keep the overflow ratio if greater than 1.0', () => {
      const splitter = chunkdown({
        chunkSize: 100,
        maxOverflowRatio: 1.5,
      });

      expect(splitter.maxOverflowRatio).toBe(1.5);
    });

    it('should allow overflow within allowed ratio to preserve meaning', () => {
      const splitter = chunkdown({
        chunkSize: 20,
        maxOverflowRatio: 1.5,
      });
      const text = `This text is thirty char long. This text is thirty char long.`; // 61 chars
      const { chunks } = splitter.split(text);

      /**
       * New scoring system finds optimal split at sentence boundary.
       * Two equal 30-char chunks instead of three smaller ones.
       */
      expect(chunks.length).toBe(2);
      chunks.forEach((chunk) => {
        expect(getContentSize(chunk.text)).toBeLessThanOrEqual(30); // Within 1.5x limit
      });
    });

    it('should split if overflow not allowed', () => {
      const splitter = chunkdown({
        chunkSize: 20,
        maxOverflowRatio: 1.0,
      });
      const text = `This text is thirty char long. This text is thirty char long.`;
      const { chunks } = splitter.split(text);

      expect(chunks.length).toBe(4);
      chunks.forEach((chunk) => {
        expect(getContentSize(chunk.text)).toBeLessThanOrEqual(20);
      });
    });
  });

  describe('Default Rules', () => {
    describe('Split', () => {
      it('should not split links by default', () => {
        const splitter = chunkdown({
          chunkSize: 100,
          maxOverflowRatio: 1.0,
        });
        const url = `https://example.com/${'x'.repeat(100)}`;
        const text = `Check [documentation](${url}) for more details.`;
        const { chunks } = splitter.split(text);

        expect(chunks.length).toBe(1);
        expect(chunks[0].text).toBe(`Check [documentation](${url}) for more details.`);
      });

      it('should split links if they exceed raw size limit', () => {
        const splitter = chunkdown({
          chunkSize: 100,
          maxOverflowRatio: 1.0,
          maxRawSize: 20,
        });
        const url = `https://example.com/${'x'.repeat(100)}`;
        const text = `Check [documentation](${url}) for more details.`;
        const { chunks } = splitter.split(text);

        expect(chunks.length).toBe(9);
        expect(chunks.map((c) => c.text)).toEqual([
          'Check [documentation',
          '](https://example.co',
          'm/xxxxxxxxxxxxxxxxxx',
          'xxxxxxxxxxxxxxxxxxxx',
          'xxxxxxxxxxxxxxxxxxxx',
          'xxxxxxxxxxxxxxxxxxxx',
          'xxxxxxxxxxxxxxxxxxxx',
          'xx) for more details',
          '.',
        ]);
      });

      it('should not split images by default', () => {
        const splitter = chunkdown({
          chunkSize: 100,
          maxOverflowRatio: 1.0,
        });
        const url = `./architecture-${'x'.repeat(100)}.png`;
        const text = `Check ![architecture](${url}) for more details.`;
        const { chunks } = splitter.split(text);

        expect(chunks.length).toBe(1);
        expect(chunks[0].text).toBe(`Check ![architecture](${url}) for more details.`);
      });

      it('should split images if they exceed raw size limit', () => {
        const splitter = chunkdown({
          chunkSize: 100,
          maxOverflowRatio: 1.0,
          maxRawSize: 20,
        });
        const url = `./architecture-${'x'.repeat(100)}.png`;
        const text = `Check ![architecture](${url}) for more details.`;

        const { chunks } = splitter.split(text);

        expect(chunks.length).toBe(8);
        expect(chunks.map((c) => c.text)).toEqual([
          'Check ![architecture',
          '](./architecture-xxx',
          'xxxxxxxxxxxxxxxxxxxx',
          'xxxxxxxxxxxxxxxxxxxx',
          'xxxxxxxxxxxxxxxxxxxx',
          'xxxxxxxxxxxxxxxxxxxx',
          'xxxxxxxxxxxxxxxxx.pn',
          'g) for more details.',
        ]);
      });

      it('should never split words by default', () => {
        const splitter = chunkdown({
          chunkSize: 20,
          maxOverflowRatio: 1.0,
        });
        const text = `supercalifragilisticexpialidocious antidisestablishmentarianism`;
        const { chunks } = splitter.split(text);
        expect(chunks.length).toBe(2);
        expect(chunks[0].text).toBe('supercalifragilisticexpialidocious');
        expect(chunks[1].text).toBe('antidisestablishmentarianism');
      });

      it('should only split words if they exceed raw size limit', () => {
        const splitter = chunkdown({
          chunkSize: 20,
          maxOverflowRatio: 1.0,
          maxRawSize: 20, // Small limit to force splitting
        });

        const text = `supercalifragilisticexpialidocious antidisestablishmentarianism`;
        const { chunks } = splitter.split(text);

        expect(chunks.length).toBe(4);
        expect(chunks[0].text).toBe('supercalifragilistic');
        expect(chunks[1].text).toBe('expialidocious');
        expect(chunks[2].text).toBe('antidisestablishment');
        expect(chunks[3].text).toBe('arianism');

        chunks.forEach((chunk) => {
          expect(chunk.text.length).toBeLessThanOrEqual(20);
        });
      });
    });

    describe('Normalization', () => {
      it('should normalize reference-style links to inline by default', () => {
        const text = 'Check [this link][ref].\n\n[ref]: https://example.com';
        const splitter = chunkdown({ chunkSize: 100, maxOverflowRatio: 2 });
        const { chunks } = splitter.split(text);

        expect(chunks[0].text).toContain('[this link](https://example.com)');
        expect(chunks[0].text).not.toContain('[ref]:');
        expect(chunks.map((c) => c.text).join('\n\n')).not.toContain('[ref]:');
      });

      it('should normalize reference-style images to inline by default', () => {
        const text = 'See ![image][img].\n\n[img]: /path/to/image.png';
        const splitter = chunkdown({ chunkSize: 100, maxOverflowRatio: 1 });
        const { chunks } = splitter.split(text);

        expect(chunks[0].text).toContain('![image](/path/to/image.png)');
        expect(chunks[0].text).not.toContain('[img]:');
        expect(chunks.map((c) => c.text).join('\n\n')).not.toContain('[img]:');
      });
    });

    describe('Block Content', () => {
      it('should handle list content', () => {
        const splitter = chunkdown({
          chunkSize: 50,
          maxOverflowRatio: 1.0,
        });
        const text = `This is a paragraph before the list.

- First item
- Second item
- Third item

This is a paragraph after the list.`;

        const { chunks } = splitter.split(text);

        expect(chunks.map((c) => c.text)).toEqual([
          'This is a paragraph before the list.',
          '* First item\n* Second item\n* Third item',
          'This is a paragraph after the list.',
        ]);
      });

      it('should handle table content', () => {
        const splitter = chunkdown({
          chunkSize: 50,
          maxOverflowRatio: 1.0,
        });
        const text = `This is a paragraph before the table.

| Column 1 | Column 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |

This is a paragraph after the table.`;

        const { chunks } = splitter.split(text);

        expect(chunks.map((c) => c.text)).toEqual([
          'This is a paragraph before the table.',
          '| Column 1 | Column 2 |\n| - | - |\n| Cell 1 | Cell 2 |',
          'This is a paragraph after the table.',
        ]);
      });

      it('should handle blockquote content', () => {
        const splitter = chunkdown({
          chunkSize: 50,
          maxOverflowRatio: 1.0,
        });
        const text = `This is a paragraph before the blockquote.

> This is a blockquote
> with multiple lines

This is a paragraph after the blockquote.`;

        const { chunks } = splitter.split(text);

        expect(chunks.map((c) => c.text)).toEqual([
          'This is a paragraph before the blockquote.',
          '> This is a blockquote\n> with multiple lines',
          'This is a paragraph after the blockquote.',
        ]);
      });

      it('should handle code block content', () => {
        const splitter = chunkdown({
          chunkSize: 50,
          maxOverflowRatio: 1.0,
        });
        const text = `This is a paragraph before the code block.

\`\`\`javascript
function hello() {
  console.log("Hello");
}
\`\`\`

This is a paragraph after the code block.`;

        const { chunks } = splitter.split(text);

        expect(chunks.map((c) => c.text)).toEqual([
          'This is a paragraph before the code block.',
          '```javascript\nfunction hello() {\n  console.log("Hello");\n}\n```',
          'This is a paragraph after the code block.',
        ]);
      });

      it('should handle horizontal rule content', () => {
        const splitter = chunkdown({
          chunkSize: 50,
          maxOverflowRatio: 1.0,
        });
        const text = `This is a paragraph before the rule.

---

This is a paragraph after the rule.`;

        const { chunks } = splitter.split(text);

        expect(chunks.map((c) => c.text)).toEqual([
          'This is a paragraph before the rule.\n\n***',
          'This is a paragraph after the rule.',
        ]);
      });

      it('should handle HTML block content', () => {
        const splitter = chunkdown({
          chunkSize: 50,
          maxOverflowRatio: 1.0,
        });
        const text = `This is a paragraph before the HTML.

<div class="example">
  <p>HTML content</p>
</div>

This is a paragraph after the HTML.`;

        const { chunks } = splitter.split(text);

        expect(chunks.map((c) => c.text)).toEqual([
          'This is a paragraph before the HTML.',
          '<div class="example">\n  <p>HTML content</p>\n</div>',
          'This is a paragraph after the HTML.',
        ]);
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
          const { chunks } = splitter.split(text);

          expect(chunks.map((c) => c.text)).toMatchInlineSnapshot(`
            [
              "# AI SDK Core",
              "Large Language Models (LLMs) are advanced programs that can understand, create, and engage with human language on a large scale.",
              "They are trained on vast amounts of written material to recognize patterns in language and predict what might come next in a given piece of text.",
              "AI SDK Core **simplifies working with LLMs by offering a standardized way of integrating them into your app** -",
              "so you can focus on building great AI applications for your users, not waste time on technical details.",
              "For example, here's how you can generate text with various models using the AI SDK:

            <PreviewSwitchProviders />",
              "## AI SDK Core Functions",
              "AI SDK Core has various functions designed for [text generation](./generating-text), [structured data generation](./generating-structured-data), and [tool usage](./tools-and-tool-calling).",
              "These functions take a standardized approach to setting up [prompts](./prompts) and [settings](./settings), making it easier to work with different models.",
              "* [\`generateText\`](/docs/ai-sdk-core/generating-text): Generates text and [tool calls](./tools-and-tool-calling).",
              "This function is ideal for non-interactive use cases such as automation tasks where you need to write text (e.g. drafting email or summarizing web pages) and for agents that use tools.",
              "* [\`streamText\`](/docs/ai-sdk-core/generating-text): Stream text and tool calls.
              You can use the \`streamText\` function for interactive use cases such as [chat bots](/docs/ai-sdk-ui/chatbot) and [content streaming](/docs/ai-sdk-ui/completion).",
              "* [\`generateObject\`](/docs/ai-sdk-core/generating-structured-data): Generates a typed, structured object that matches a [Zod](https://zod.dev/) schema.",
              "You can use this function to force the language model to return structured data, e.g. for information extraction, synthetic data generation, or classification tasks.",
              "* [\`streamObject\`](/docs/ai-sdk-core/generating-structured-data): Stream a structured object that matches a Zod schema.
              You can use this function to [stream generated UIs](/docs/ai-sdk-ui/object-generation).",
              "## API Reference

            Please check out the [AI SDK Core API Reference](/docs/reference/ai-sdk-core) for more details on each function.",
            ]
          `);

          // Verify overflow stays within bounds
          chunks.forEach((chunk) => {
            expect(getContentSize(chunk.text)).toBeLessThanOrEqual(300); // 200 * 1.5
          });

          // Verify links and images are never broken
          chunks.forEach((chunk) => {
            const brackets = (chunk.text.match(/[[\]]/g) || []).length;
            const backticks = (chunk.text.match(/`/g) || []).length;

            if (brackets > 0) expect(brackets % 2).toBe(0);
            if (backticks > 0) expect(backticks % 2).toBe(0);
          });
        });

        it('should split with 1.5x overflow ratio', () => {
          const splitter = chunkdown({
            chunkSize: 200,
            maxOverflowRatio: 1.5,
          });
          const { chunks } = splitter.split(text);

          expect(chunks.map((c) => c.text)).toMatchInlineSnapshot(`
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
            expect(getContentSize(chunk.text)).toBeLessThanOrEqual(300); // 200 * 1.5
          });

          // Verify links and images are never broken
          chunks.forEach((chunk) => {
            const brackets = (chunk.text.match(/[[\]]/g) || []).length;

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
          const { chunks } = splitter.split(text);

          expect(chunks.map((c) => c.text)).toMatchInlineSnapshot(`
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

            [https://autolink.com](https://autolink.com)

            ![Image alt text](https://via.placeholder.com/150 "Image title")

            ![Image without title](https://via.placeholder.com/100)

            Reference-style [link](https://example.com) and [another link](https://example.com "Reference with title").",
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
            | :- | :-: | -: |
            | Cell 1 | Cell 2 | Cell 3 |
            | Long cell | Short | 123 |

            | Command | Description |
            | - | - |
            | git status | Show working tree status |
            | git diff | Show changes between commits |",
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
              "## Horizontal Rules (3 variants)

            ***",
              "***

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

            | Element | Syntax Variants | Example |
            | - | - | - |
            | Bold | \`**text**\` or \`__text__\` | **bold** and **bold** |
            | Italic | \`*text*\` or \`_text_\` | *italic* and *italic* |
            | Code | \`\\\`text\\\`\\\` | \`code\` |
            | Link | \`[text](url)\` | [example](https://example.com) |",
              "## Edge Cases

            Empty lines:

            Multiple spaces:     (5 spaces)

            Trailing spaces:

            Mixed formatting: ***Really*** important **and *nested* formatting**

            Autolinks: [https://example.com](https://example.com) and [email@example.com](mailto:email@example.com)",
              "Footnotes (if supported):
            Here's a sentence with a footnote[^1].

            [^1]: This is the footnote content.

            ***",
              "*This document showcases most markdown elements and syntax variations.*",
            ]
          `);

          // Verify overflow stays within bounds
          chunks.forEach((chunk) => {
            expect(getContentSize(chunk.text)).toBeLessThanOrEqual(300); // 200 * 1.5
          });

          // Verify links and images are never broken
          chunks.forEach((chunk) => {
            const brackets = (chunk.text.match(/[[\]]/g) || []).length;

            if (brackets > 0) expect(brackets % 2).toBe(0);
          });
        });

        it('should split with 1.5x overflow ratio', () => {
          const splitter = chunkdown({
            chunkSize: 200,
            maxOverflowRatio: 1.5,
          });
          const { chunks } = splitter.split(text);

          expect(chunks.map((c) => c.text)).toMatchInlineSnapshot(`
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

            [https://autolink.com](https://autolink.com)

            ![Image alt text](https://via.placeholder.com/150 "Image title")

            ![Image without title](https://via.placeholder.com/100)

            Reference-style [link](https://example.com) and [another link](https://example.com "Reference with title").",
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
            | :- | :-: | -: |
            | Cell 1 | Cell 2 | Cell 3 |
            | Long cell | Short | 123 |

            | Command | Description |
            | - | - |
            | git status | Show working tree status |
            | git diff | Show changes between commits |",
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

            ## Horizontal Rules (3 variants)

            ***",
              "***

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

            | Element | Syntax Variants | Example |
            | - | - | - |
            | Bold | \`**text**\` or \`__text__\` | **bold** and **bold** |
            | Italic | \`*text*\` or \`_text_\` | *italic* and *italic* |
            | Code | \`\\\`text\\\`\\\` | \`code\` |
            | Link | \`[text](url)\` | [example](https://example.com) |",
              "## Edge Cases

            Empty lines:

            Multiple spaces:     (5 spaces)

            Trailing spaces:

            Mixed formatting: ***Really*** important **and *nested* formatting**

            Autolinks: [https://example.com](https://example.com) and [email@example.com](mailto:email@example.com)

            Footnotes (if supported):
            Here's a sentence with a footnote[^1].

            [^1]: This is the footnote content.

            ***",
              "*This document showcases most markdown elements and syntax variations.*",
            ]
          `);

          // Verify overflow stays within bounds
          chunks.forEach((chunk) => {
            expect(getContentSize(chunk.text)).toBeLessThanOrEqual(300); // 200 * 1.5
          });

          // Verify links and images are never broken
          chunks.forEach((chunk) => {
            const brackets = (chunk.text.match(/[[\]]/g) || []).length;

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
          const { chunks } = splitter.split(text);

          expect(chunks.map((c) => c.text)).toMatchInlineSnapshot(`
            [
              "The **llama** ([/ˈlɑːmə/](https://en.wikipedia.org/wiki/Help:IPA/English "Help:IPA/English"); Spanish pronunciation: [\\[ˈʎama\\]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish") or [\\[ˈʝama\\]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish")) (***Lama glama***)",
              "is a domesticated [South American](https://en.wikipedia.org/wiki/South_America "South America") [camelid](https://en.wikipedia.org/wiki/Camelid "Camelid"), widely used as a [meat](https://en.wikipedia.org/wiki/List_of_meat_animals "List of meat animals") and [pack animal](https://en.wikipedia.org/wiki/Pack_animal "Pack animal") by [Andean cultures](https://en.wikipedia.org/wiki/Inca_empire "Inca empire") since the [pre-Columbian era](https://en.wikipedia.org/wiki/Pre-Columbian_era "Pre-Columbian era").",
              "Llamas are social animals and live with others as a [herd](https://en.wikipedia.org/wiki/Herd "Herd"). Their [wool](https://en.wikipedia.org/wiki/Wool "Wool") is soft and contains only a small amount of [lanolin](https://en.wikipedia.org/wiki/Lanolin "Lanolin").[\\[2\\]](https://en.wikipedia.org/wiki/Llama#cite_note-2) Llamas can learn simple tasks after a few repetitions.",
              "When using a pack, they can carry about 25 to 30% of their body weight for 8 to 13 [km](https://en.wikipedia.org/wiki/Kilometre "Kilometre") (5–8 [miles](https://en.wikipedia.org/wiki/Mile "Mile")).",
              "[\\[3\\]](https://en.wikipedia.org/wiki/Llama#cite_note-OK_State-3) The name *llama* (also historically spelled "lama" or "glama") was adopted by [European settlers](https://en.wikipedia.org/wiki/European_colonization_of_the_Americas "European colonization of the Americas") from [native Peruvians](https://en.wikipedia.org/wiki/Indigenous_people_in_Peru "Indigenous people in Peru").[\\[4\\]](https://en.wikipedia.org/wiki/Llama#cite_note-4)",
            ]
          `);

          // Verify overflow stays within bounds
          chunks.forEach((chunk) => {
            expect(getContentSize(chunk.text)).toBeLessThanOrEqual(chunkSize * maxOverflowRatio);
          });

          // Verify links and images are never broken
          chunks.forEach((chunk) => {
            const brackets = (chunk.text.match(/[[\]]/g) || []).length;

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
          const { chunks } = splitter.split(text);

          expect(chunks.map((c) => c.text)).toMatchInlineSnapshot(`
            [
              "The **llama** ([/ˈlɑːmə/](https://en.wikipedia.org/wiki/Help:IPA/English "Help:IPA/English"); Spanish pronunciation: [\\[ˈʎama\\]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish") or [\\[ˈʝama\\]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish")) (***Lama glama***) is a domesticated [South American](https://en.wikipedia.org/wiki/South_America "South America") [camelid](https://en.wikipedia.org/wiki/Camelid "Camelid"), widely used as a [meat](https://en.wikipedia.org/wiki/List_of_meat_animals "List of meat animals") and [pack animal](https://en.wikipedia.org/wiki/Pack_animal "Pack animal") by [Andean cultures](https://en.wikipedia.org/wiki/Inca_empire "Inca empire") since the [pre-Columbian era](https://en.wikipedia.org/wiki/Pre-Columbian_era "Pre-Columbian era").",
              "Llamas are social animals and live with others as a [herd](https://en.wikipedia.org/wiki/Herd "Herd"). Their [wool](https://en.wikipedia.org/wiki/Wool "Wool") is soft and contains only a small amount of [lanolin](https://en.wikipedia.org/wiki/Lanolin "Lanolin").[\\[2\\]](https://en.wikipedia.org/wiki/Llama#cite_note-2) Llamas can learn simple tasks after a few repetitions.",
              "When using a pack, they can carry about 25 to 30% of their body weight for 8 to 13 [km](https://en.wikipedia.org/wiki/Kilometre "Kilometre") (5–8 [miles](https://en.wikipedia.org/wiki/Mile "Mile")).[\\[3\\]](https://en.wikipedia.org/wiki/Llama#cite_note-OK_State-3) The name *llama* (also historically spelled "lama" or "glama") was adopted by [European settlers](https://en.wikipedia.org/wiki/European_colonization_of_the_Americas "European colonization of the Americas") from [native Peruvians](https://en.wikipedia.org/wiki/Indigenous_people_in_Peru "Indigenous people in Peru").[\\[4\\]](https://en.wikipedia.org/wiki/Llama#cite_note-4)",
            ]
          `);

          // Verify overflow stays within bounds
          chunks.forEach((chunk) => {
            expect(getContentSize(chunk.text)).toBeLessThanOrEqual(chunkSize * maxOverflowRatio);
          });

          // Verify links and images are never broken
          chunks.forEach((chunk) => {
            const brackets = (chunk.text.match(/[[\]]/g) || []).length;

            if (brackets > 0) expect(brackets % 2).toBe(0);
          });
        });
      });
    });
  });
});
