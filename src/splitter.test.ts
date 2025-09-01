import { toMarkdown } from 'mdast-util-to-markdown';
import { toString } from 'mdast-util-to-string';
import { describe, expect, it } from 'vitest';
import { chunkdown, getContentSize } from './splitter';

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
  describe('Content Size', () => {
    it('should use content size for splitting', () => {
      const splitter = chunkdown({
        chunkSize: 25,
        maxOverflowRatio: 1.0,
      });

      const text = `**Bold text** and *italic text*`;
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(1);
      expect(getContentSize(chunks[0])).toBe(25);
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
    it('should never split links', () => {
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

    it('should never split images', () => {
      const splitter = chunkdown({
        chunkSize: 10,
        maxOverflowRatio: 1.0,
      });
      const text = `See ![logo](./logo.png) for the brand.`;
      const chunks = splitter.splitText(text);

      const imageChunk = chunks.find((chunk) =>
        chunk.includes('![logo](./logo.png)'),
      );
      expect(imageChunk).toBe('![logo](./logo.png)');
    });

    it('should never split words', () => {
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

    it('should not split inline code if below breakpoint', () => {
      const splitter = chunkdown({
        chunkSize: 50,
        maxOverflowRatio: 1.0,
      });
      const text = `Use \`const splitter = new MarkdownSplitter();\` for chunking.`;
      const chunks = splitter.splitText(text);

      const codeChunk = chunks.find((chunk) =>
        chunk.includes('`const splitter = new MarkdownSplitter();`'),
      );
      expect(codeChunk).toBe('`const splitter = new MarkdownSplitter();`');
    });

    it('should not split formatting if below breakpoint', () => {
      const splitter = chunkdown({
        chunkSize: 30,
        maxOverflowRatio: 1.0,
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

      expect(strongChunk).toBe('**long strong text**');
      expect(italicChunk).toBe('*long italic text*');
      expect(deletedChunk).toBe('~~long deleted text~~');
    });

    it('should split formatting if above breakpoint', () => {
      const splitter = chunkdown({
        chunkSize: 30,
        maxOverflowRatio: 1.0,
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
  });

  describe('Progressive Splitting', () => {
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

    it('should split by sentences (.?!)', () => {
      const splitter = chunkdown({
        chunkSize: 30,
        maxOverflowRatio: 1.0,
      });
      const text = `First sentence. Second sentence. First sentence? Second sentence? First sentence! Second sentence!`;
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(6);
      expect(chunks[0]).toBe('First sentence.');
      expect(chunks[1]).toBe('Second sentence.');
      expect(chunks[2]).toBe('First sentence?');
      expect(chunks[3]).toBe('Second sentence?');
      expect(chunks[4]).toBe('First sentence!');
      expect(chunks[5]).toBe('Second sentence!');
    });

    it('should split by sub-sentences (,;)', () => {
      const splitter = chunkdown({
        chunkSize: 30,
        maxOverflowRatio: 1.0,
      });
      const text = `First sentence, Second sentence. First sentence; Second sentence.`;
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(4);
      expect(chunks[0]).toBe('First sentence,');
      expect(chunks[1]).toBe('Second sentence.');
      expect(chunks[2]).toBe('First sentence;');
      expect(chunks[3]).toBe('Second sentence.');
    });

    it('should split by words', () => {
      const splitter = chunkdown({
        chunkSize: 1,
        maxOverflowRatio: 1.0,
      });
      const text = `First sentence. Second sentence.`;
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(4);
      expect(chunks[0]).toBe('First');
      expect(chunks[1]).toBe('sentence.');
      expect(chunks[2]).toBe('Second');
      expect(chunks[3]).toBe('sentence.');
    });

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

    it('should keep tables together if possible', () => {
      const splitter = chunkdown({
        chunkSize: 50,
        maxOverflowRatio: 1.0,
      });
      const text = `Start of table.

| Column 1 | Column 2 |
|----------|----------|
| Row 1    | Data 1   |
| Row 2    | Data 2   |

End of table.`;
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(3);
      expect(chunks[0]).toBe('Start of table.');
      expect(chunks[1]).toBe(
        '| Column 1 | Column 2 |\n| -------- | -------- |\n| Row 1    | Data 1   |\n| Row 2    | Data 2   |',
      );
      expect(chunks[2]).toBe('End of table.');
    });

    it('should split table by rows', () => {
      const splitter = chunkdown({
        chunkSize: 15,
        maxOverflowRatio: 1.0,
      });
      const text = `Start of table.

| Col1 | Col2 |
|------|------|
| A1 | B1 |
| A2 | B2 |
| A3 | B3 |

End of table.`;
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(4);
      expect(chunks[0]).toBe('Start of table.');
      expect(chunks[1]).toBe(
        '| Col1 | Col2 |\n| ---- | ---- |\n| A1   | B1   |',
      );
      expect(chunks[2]).toBe('| A2 | B2 |\n| -- | -- |\n| A3 | B3 |');
      expect(chunks[3]).toBe('End of table.');
    });

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
            "* [\`generateText\`](/docs/ai-sdk-core/generating-text): Generates text and [tool calls](./tools-and-tool-calling). This function is ideal for non-interactive use cases such as automation tasks where you need to write text (e. g.",
            "drafting email or summarizing web pages) and for agents that use tools.",
            "* [\`streamText\`](/docs/ai-sdk-core/generating-text): Stream text and tool calls.
            You can use the \`streamText\` function for interactive use cases such as [chat bots](/docs/ai-sdk-ui/chatbot) and [content streaming](/docs/ai-sdk-ui/completion).",
            "* [\`generateObject\`](/docs/ai-sdk-core/generating-structured-data): Generates a typed, structured object that matches a [Zod](https://zod.dev/) schema. You can use this function to force the language model to return structured data, e. g.",
            "for information extraction, synthetic data generation, or classification tasks.",
            "* [\`streamObject\`](/docs/ai-sdk-core/generating-structured-data): Stream a structured object that matches a Zod schema.
            You can use this function to [stream generated UIs](/docs/ai-sdk-ui/object-generation).",
            "## API Reference

          Please check out the [AI SDK Core API Reference](/docs/reference/ai-sdk-core) for more details on each function.",
          ]
        `);

        // Verify no chunk exceeds strict limit
        chunks.forEach((chunk) => {
          expect(getContentSize(chunk)).toBeLessThanOrEqual(200);
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
            "# Alternative H1 (Setext)",
            "## Alternative H2 (Setext)",
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
          3. Third item",
            "### Task Lists (GFM)

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
            "## Code Blocks",
            "### Fenced Code Blocks

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
            "1. Third item with blockquote:
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
            "# Alternative H1 (Setext)",
            "## Alternative H2 (Setext)",
            "## Text Formatting

          **Bold text with asterisks** and **bold text with underscores**

          *Italic text with asterisks* and *italic text with underscores*

          ***Bold and italic*** and ***bold and italic***

          ~~Strikethrough text~~

          \`Inline code\` with backticks",
            "## Lists",
            "### Unordered Lists (3 variants)

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
          3. Third item",
            "### Task Lists (GFM)

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
        const splitter = chunkdown({
          chunkSize: 200,
          maxOverflowRatio: 1.0,
        });
        const chunks = splitter.splitText(text);

        expect(chunks).toMatchInlineSnapshot(`
          [
            "The **llama** ([/ˈlɑːmə/](https://en.wikipedia.org/wiki/Help:IPA/English "Help:IPA/English"); Spanish pronunciation: [\\[ˈʎama\\]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish") or [\\[ˈʝama\\]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish")) (***Lama glama***) is a domesticated [South American](https://en.wikipedia.org/wiki/South_America "South America") [camelid](https://en.wikipedia.org/wiki/Camelid "Camelid"),",
            "widely used as a [meat](https://en.wikipedia.org/wiki/List_of_meat_animals "List of meat animals") and [pack animal](https://en.wikipedia.org/wiki/Pack_animal "Pack animal") by [Andean cultures](https://en.wikipedia.org/wiki/Inca_empire "Inca empire") since the [pre-Columbian era](https://en.wikipedia.org/wiki/Pre-Columbian_era "Pre-Columbian era").",
            "Llamas are social animals and live with others as a [herd](https://en.wikipedia.org/wiki/Herd "Herd"). Their [wool](https://en.wikipedia.org/wiki/Wool "Wool") is soft and contains only a small amount of [lanolin](https://en.wikipedia.org/wiki/Lanolin "Lanolin"). [\\[2\\]](https://en.wikipedia.org/wiki/Llama#cite_note-2) Llamas can learn simple tasks after a few repetitions.",
            "When using a pack, they can carry about 25 to 30% of their body weight for 8 to 13 [km](https://en.wikipedia.org/wiki/Kilometre "Kilometre") (5–8 [miles](https://en.wikipedia.org/wiki/Mile "Mile")).",
            "[\\[3\\]](https://en.wikipedia.org/wiki/Llama#cite_note-OK_State-3) The name *llama* (also historically spelled "lama" or "glama") was adopted by [European settlers](https://en.wikipedia.org/wiki/European_colonization_of_the_Americas "European colonization of the Americas") from [native Peruvians](https://en.wikipedia.org/wiki/Indigenous_people_in_Peru "Indigenous people in Peru"). [\\[4\\]](https://en.wikipedia.org/wiki/Llama#cite_note-4)",
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
            "The **llama** ([/ˈlɑːmə/](https://en.wikipedia.org/wiki/Help:IPA/English "Help:IPA/English"); Spanish pronunciation: [\\[ˈʎama\\]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish") or [\\[ˈʝama\\]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish")) (***Lama glama***) is a domesticated [South American](https://en.wikipedia.org/wiki/South_America "South America") [camelid](https://en.wikipedia.org/wiki/Camelid "Camelid"), widely used as a [meat](https://en.wikipedia.org/wiki/List_of_meat_animals "List of meat animals") and [pack animal](https://en.wikipedia.org/wiki/Pack_animal "Pack animal") by [Andean cultures](https://en.wikipedia.org/wiki/Inca_empire "Inca empire") since the [pre-Columbian era](https://en.wikipedia.org/wiki/Pre-Columbian_era "Pre-Columbian era").",
            "Llamas are social animals and live with others as a [herd](https://en.wikipedia.org/wiki/Herd "Herd"). Their [wool](https://en.wikipedia.org/wiki/Wool "Wool") is soft and contains only a small amount of [lanolin](https://en.wikipedia.org/wiki/Lanolin "Lanolin"). [\\[2\\]](https://en.wikipedia.org/wiki/Llama#cite_note-2) Llamas can learn simple tasks after a few repetitions.",
            "When using a pack, they can carry about 25 to 30% of their body weight for 8 to 13 [km](https://en.wikipedia.org/wiki/Kilometre "Kilometre") (5–8 [miles](https://en.wikipedia.org/wiki/Mile "Mile")). [\\[3\\]](https://en.wikipedia.org/wiki/Llama#cite_note-OK_State-3) The name *llama* (also historically spelled "lama" or "glama") was adopted by [European settlers](https://en.wikipedia.org/wiki/European_colonization_of_the_Americas "European colonization of the Americas") from [native Peruvians](https://en.wikipedia.org/wiki/Indigenous_people_in_Peru "Indigenous people in Peru"). [\\[4\\]](https://en.wikipedia.org/wiki/Llama#cite_note-4)",
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
  });
});
