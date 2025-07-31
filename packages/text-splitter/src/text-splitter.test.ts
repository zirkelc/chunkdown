import { describe, expect, it } from 'vitest';
import { createMarkdownSplitter } from './text-splitter';

describe('createMarkdownSplitter', () => {
  describe('Basic Functionality', () => {
    it('should return single chunk for text that fits within chunk size', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 100 });
      const text = 'This is a test text that needs to be split into smaller chunks for processing.';

      const chunks = splitter.splitText(text);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });

    it('should respect chunk size limits and split long text', () => {
      const chunkSize = 50;
      const splitter = createMarkdownSplitter({ chunkSize });
      const longText =
        'This is a very long text that will definitely exceed the chunk size limit and should be split into multiple chunks automatically by the markdown text splitter functionality.';

      const chunks = splitter.splitText(longText);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        // Some chunks might slightly exceed due to markdown splitting behavior
        expect(chunk.length).toBeLessThanOrEqual(chunkSize * 1.5);
      });
    });

    it('should handle empty text', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 100 });
      const text = '';

      const chunks = splitter.splitText(text);

      expect(chunks).toEqual([]);
    });

    it('should handle text with only whitespace', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 100 });
      const text = '   \n\n   ';

      const chunks = splitter.splitText(text);

      expect(chunks).toEqual([]);
    });

    it('should split paragraphs into separate chunks', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 200 });
      const text = 'Short chunk 1.\n\nShort chunk 2.\n\nShort chunk 3.';

      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(3);
      expect(chunks).toContain('Short chunk 1.');
      expect(chunks).toContain('Short chunk 2.');
      expect(chunks).toContain('Short chunk 3.');
    });
  });

  describe('Markdown Formatting Preservation', () => {
    it('should preserve complex inline markdown formatting', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 200 });
      const text = 'This has **bold**, *italic*, `inline code`, ~~strikethrough~~, and [links](https://example.com).';

      const chunks = splitter.splitText(text);

      expect(chunks[0]).toContain('**bold**');
      expect(chunks[0]).toContain('*italic*');
      expect(chunks[0]).toContain('`inline code`');
      expect(chunks[0]).toContain('~~strikethrough~~');
      expect(chunks[0]).toContain('[links](https://example.com)');
    });

    it('should preserve nested markdown formatting', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 200 });
      const text = 'This has ***bold italic***, **bold with `code`**, and *italic with [link](https://example.com)*.';

      const chunks = splitter.splitText(text);

      expect(chunks[0]).toContain('***bold italic***');
      expect(chunks[0]).toContain('**bold with `code`**');
      expect(chunks[0]).toContain('*italic with [link](https://example.com)*');
    });

    it('should preserve image formatting', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 200 });
      const text = 'Here is an image: ![Alt text](https://example.com/image.png "Title")';

      const chunks = splitter.splitText(text);

      expect(chunks[0]).toContain('![Alt text](https://example.com/image.png "Title")');
    });

    it('should preserve heading levels correctly', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 100 });
      const text = '# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6';

      const chunks = splitter.splitText(text);

      // With hierarchical processing, headings are combined into a single chunk
      // since the text content is short and fits within the limit
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toContain('# H1');
      expect(chunks[0]).toContain('## H2');
      expect(chunks[0]).toContain('### H3');
      expect(chunks[0]).toContain('#### H4');
      expect(chunks[0]).toContain('##### H5');
      expect(chunks[0]).toContain('###### H6');
    });

    it('should preserve code blocks with language', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 200 });
      const text = '```javascript\nconst x = 1;\nconsole.log(x);\n```';

      const chunks = splitter.splitText(text);

      expect(chunks[0]).toContain('```javascript');
      expect(chunks[0]).toContain('const x = 1;');
      expect(chunks[0]).toContain('console.log(x);');
      expect(chunks[0]).toContain('```');
    });

    it('should preserve code blocks without language', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 200 });
      const text = '```\nPlain code block\nwith multiple lines\n```';

      const chunks = splitter.splitText(text);

      expect(chunks[0]).toContain('```');
      expect(chunks[0]).toContain('Plain code block');
      expect(chunks[0]).toContain('with multiple lines');
    });

    it('should preserve blockquotes', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 200 });
      const text = '> This is a blockquote\n> with multiple lines\n> and **formatting**';

      const chunks = splitter.splitText(text);

      // mdast-util-to-markdown may convert blockquotes differently
      expect(chunks[0]).toContain('This is a blockquote');
      expect(chunks[0]).toContain('with multiple lines');
      expect(chunks[0]).toContain('**formatting**');
    });

    it('should preserve ordered lists', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 200 });
      const text = '1. First item\n2. Second item with **bold**\n3. Third item';

      const chunks = splitter.splitText(text);

      // List items should be preserved as separate chunks or combined appropriately
      const allText = chunks.join('\n');
      // mdast-util-to-markdown may convert ordered lists to unordered
      expect(allText).toContain('First item');
      expect(allText).toContain('Second item with **bold**');
      expect(allText).toContain('Third item');
    });

    it('should preserve unordered lists', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 200 });
      const text = '- First item\n- Second item with `code`\n- Third item';

      const chunks = splitter.splitText(text);

      const allText = chunks.join('\n');
      // mdast-util-to-markdown may use * instead of -
      expect(allText).toContain('First item');
      expect(allText).toContain('Second item with `code`');
      expect(allText).toContain('Third item');
    });

    it('should preserve nested lists', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 300 });
      const text = '- Parent item\n  - Nested item 1\n  - Nested item 2\n- Another parent';

      const chunks = splitter.splitText(text);

      const allText = chunks.join('\n');
      // mdast-util-to-markdown may use * instead of -
      expect(allText).toContain('Parent item');
      expect(allText).toContain('Nested item 1');
      expect(allText).toContain('Nested item 2');
      expect(allText).toContain('Another parent');
    });

    it('should preserve horizontal rules', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 100 });
      const text = 'Before rule\n\n---\n\nAfter rule';

      const chunks = splitter.splitText(text);

      expect(chunks).toContain('Before rule');
      // mdast-util-to-markdown may use *** instead of ---
      expect(chunks.some((chunk) => chunk.includes('***') || chunk.includes('---'))).toBe(true);
      expect(chunks).toContain('After rule');
    });

    it('should preserve tables', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 300 });
      const text = '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |\n| Cell 3   | Cell 4   |';

      const chunks = splitter.splitText(text);

      const allText = chunks.join('\n');
      expect(allText).toContain('| Header 1 | Header 2 |');
      expect(allText).toContain('|----------|----------|');
      expect(allText).toContain('| Cell 1   | Cell 2   |');
    });
  });

  describe('Breaking Point Behavior', () => {
    it('should split at paragraph boundaries first', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 50 });
      const text =
        'First paragraph with some content.\n\nSecond paragraph with different content.\n\nThird paragraph here.';

      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(3);
      // Each paragraph should be in separate chunks or split appropriately
      expect(chunks[0]).toBe('First paragraph with some content.');
      expect(chunks[1]).toBe('Second paragraph with different content.');
      expect(chunks[2]).toBe('Third paragraph here.');
    });

    it('should combine headings with their content when it fits', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 100 });
      const text = '# Main Title\n\nSome content under the title.\n\n## Subtitle\n\nMore content here.';

      const chunks = splitter.splitText(text);

      // With hierarchical processing, the entire document forms a cohesive unit
      // and should be kept together since text content fits within chunk size
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toContain('# Main Title');
      expect(chunks[0]).toContain('Some content under the title');
      expect(chunks[0]).toContain('## Subtitle');
      expect(chunks[0]).toContain('More content here');
    });

    it('should split at sentence boundaries when paragraphs are too long', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 60 });
      const text =
        'This is the first sentence. This is the second sentence. This is the third sentence that should be split.';

      const chunks = splitter.splitText(text);

      expect(chunks.length).toBeGreaterThan(1);
      // Should split at sentence boundaries
      expect(chunks.some((chunk) => chunk.includes('first sentence.'))).toBe(true);
      expect(chunks.some((chunk) => chunk.includes('second sentence.'))).toBe(true);
    });

    it('should split at punctuation when sentences are too long', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 30 });
      const text =
        'This is a very long sentence with commas, semicolons; and colons: that should be split at punctuation marks.';

      const chunks = splitter.splitText(text);

      expect(chunks.length).toBeGreaterThan(1);
      // Should split at punctuation marks
      const allText = chunks.join(' ');
      // Check for punctuation marks (may be formatted with spaces)
      expect(allText).toContain('commas');
      expect(allText).toContain('semicolons');
      expect(allText).toContain('colons');
    });

    it('should prioritize list item boundaries over sentence boundaries', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 200, maxOverflowRatio: 1.5 });
      const listText = `- [\`generateObject\`](/docs/ai-sdk-core/generating-structured-data): Generates a typed, structured object that matches a [Zod](https://zod.dev/) schema.
  You can use this function to force the language model to return structured data, e.g. for information extraction, synthetic data generation, or classification tasks.
- [\`streamObject\`](/docs/ai-sdk-core/generating-structured-data): Stream a structured object that matches a Zod schema.
  You can use this function to [stream generated UIs](/docs/ai-sdk-ui/object-generation).`;

      const chunks = splitter.splitText(listText);

      expect(chunks.length).toBe(2);
      
      // First chunk should contain the entire first list item including "e.g."
      expect(chunks[0]).toContain('generateObject');
      expect(chunks[0]).toContain('e.g. for information extraction');
      expect(chunks[0]).toContain('classification tasks');
      
      // Second chunk should start with the second list item
      expect(chunks[1]).toContain('streamObject');
      expect(chunks[1]).toContain('stream generated UIs');
      
      // Verify that "e.g." is not split (no space inserted)
      expect(chunks[0]).toContain('e.g.');
      expect(chunks[0]).not.toContain('e. g.');
      
      // Verify split happens at structural boundary, not at "e.g." 
      expect(chunks[0]).not.toMatch(/e\.g\.\s*$/); // Should not end with "e.g."
    });

    it('should prioritize headings over list items in structural hierarchy', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 150, maxOverflowRatio: 1.2 });
      const mixedText = `## Overview
This section provides an overview of the main concepts.

- First item in the list that is quite long and contains important information about the topic.
- Second item that continues with more details.

## Usage
This section explains how to use the features.`;

      const chunks = splitter.splitText(mixedText);

      // Should prefer splitting at headings over list items
      // First chunk should contain the overview section
      expect(chunks[0]).toContain('## Overview');
      expect(chunks[0]).toContain('This section provides an overview');
      
      // Should split at the "## Usage" heading rather than within the list
      const usageChunk = chunks.find(chunk => chunk.includes('## Usage'));
      expect(usageChunk).toBeDefined();
      expect(usageChunk).toContain('This section explains how to use');
      
      // Verify that list items stay together when possible
      const listChunk = chunks.find(chunk => chunk.includes('First item in the list'));
      expect(listChunk).toBeDefined();
      if (listChunk) {
        // If the list fits, it should be together; if not, it should split cleanly
        expect(listChunk).toMatch(/[*-] First item.*\n[*-] Second item|^[*-] First item/);
      }
    });

    it('should never split structural boundaries that conflict with protected ranges', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 200, maxOverflowRatio: 1.5 });
      
      // This text has a structural boundary (list item) at position 320
      // But there's a link starting at position 322, so the boundary should be rejected
      const conflictingText = `* [\`generateObject\`](/docs/ai-sdk-core/generating-structured-data): Generates a typed, structured object that matches a [Zod](https://zod.dev/) schema.
  You can use this function to force the language model to return structured data, e.g. for information extraction, synthetic data generation, or classification tasks.
* [\`streamObject\`](/docs/ai-sdk-core/generating-structured-data): Stream a structured object that matches a Zod schema.
  You can use this function to [stream generated UIs](/docs/ai-sdk-ui/object-generation).`;

      const chunks = splitter.splitText(conflictingText);

      // Verify that all URLs are intact (not split)
      const allText = chunks.join(' ');
      const completeLinks = allText.match(/\[[^\]]+\]\([^)]+\)/g) || [];
      
      // Should find all 4 complete links
      expect(completeLinks.length).toBe(4);
      expect(completeLinks).toContain('[`generateObject`](/docs/ai-sdk-core/generating-structured-data)');
      expect(completeLinks).toContain('[`streamObject`](/docs/ai-sdk-core/generating-structured-data)');
      expect(completeLinks).toContain('[Zod](https://zod.dev/)');
      expect(completeLinks).toContain('[stream generated UIs](/docs/ai-sdk-ui/object-generation)');
      
      // Verify no chunk contains broken URLs
      chunks.forEach(chunk => {
        // Should not contain incomplete URLs
        expect(chunk).not.toMatch(/\]\([^)]*$/); // Link starts but doesn't close
        expect(chunk).not.toMatch(/^[^[]*\)/);   // Link closes but doesn't start
        
        // Should not contain the specific broken URL from the regression
        expect(chunk).not.toMatch(/generating-struct[^u]/); // "generating-struct" without "ured-data"
      });
    });

    it('should split at word boundaries as last resort', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 25 });
      const text =
        'Supercalifragilisticexpialidocious word that needs to be split at word boundaries when everything else fails';

      const chunks = splitter.splitText(text);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(40); // Allow some flexibility
      });
    });

    it('should preserve code block integrity', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 150 }); // Increased to fit the code block
      const text =
        'Some text before.\n\n```javascript\nfunction example() {\n  console.log("This is a longer code block");\n  return true;\n}\n```\n\nSome text after.';

      const chunks = splitter.splitText(text);

      // Code block should not be split in the middle
      const codeChunk = chunks.find((chunk) => chunk.includes('```javascript'));
      expect(codeChunk).toBeDefined();
      expect(codeChunk).toContain('function example()');
      expect(codeChunk).toContain('console');
      expect(codeChunk).toContain('return true;');
    });

    it('should handle mixed content with various breaking points', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 100 });
      const text = `# Title

This is a paragraph with **bold** text.

## Subtitle

- List item 1
- List item 2

\`\`\`
code block
\`\`\`

Final paragraph.`;

      const chunks = splitter.splitText(text);

      // With hierarchical processing, the entire document stays together 
      // as the semantic text content fits within the chunk size
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toContain('# Title');
      expect(chunks[0]).toContain('**bold**');
      expect(chunks[0]).toContain('## Subtitle');
      expect(chunks[0]).toContain('List item');
      expect(chunks[0]).toContain('```');
      expect(chunks[0]).toContain('Final paragraph');
    });

    it('should handle empty paragraphs and whitespace correctly', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 100 });
      const text = 'First paragraph.\n\n\n\nSecond paragraph after empty lines.\n\n   \n\nThird paragraph.';

      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(3);
      expect(chunks).toContain('First paragraph.');
      expect(chunks).toContain('Second paragraph after empty lines.');
      expect(chunks).toContain('Third paragraph.');
    });
  });

  describe('Hierarchical Chunking with Soft Limits', () => {
    it('should preserve complete sections when they fit within target size', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 150 });
      
      const text = '# Main Section\n\nThis is the main content.\n\n## Subsection\n\nThis is subsection content.';
      const chunks = splitter.splitText(text);
      
      // Should keep the entire document as one chunk since it fits
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toContain('# Main Section');
      expect(chunks[0]).toContain('## Subsection');
    });

    it('should allow controlled overflow to preserve semantic units', () => {
      const splitter = createMarkdownSplitter({ 
        chunkSize: 60, 
        maxOverflowRatio: 1.5 
      });
      
      const text = '# Important Section\n\nThis stays together.';
      const chunks = splitter.splitText(text);
      
      // Should allow overflow to keep section together
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toContain('# Important Section');
      expect(chunks[0]).toContain('stays together');
    });

    it('should break down large sections intelligently', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 60 });
      
      const text = `# Large Section

This is a lot of content that will exceed the chunk size limit and needs to be broken down.

## Subsection

This subsection also has significant content that may need separate treatment.

### Deep Section

Even deeper content here.`;
      
      const chunks = splitter.splitText(text);
      
      // Should break down but maintain heading relationships
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.some(chunk => chunk.includes('# Large Section'))).toBe(true);
      expect(chunks.some(chunk => chunk.includes('## Subsection'))).toBe(true);
    });

    it('should prioritize different content types for overflow decisions', () => {
      const splitter = createMarkdownSplitter({ 
        chunkSize: 100, 
        maxOverflowRatio: 1.3 
      });
      
      const codeText = `# Code Section

\`\`\`javascript
function example() {
  return true;
}
\`\`\``;
      
      const chunks = splitter.splitText(codeText);
      
      // Should keep code block with its heading despite size
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toContain('# Code Section');
      expect(chunks[0]).toContain('```javascript');
    });

    it('should handle mixed content types correctly', () => {
      const splitter = createMarkdownSplitter({ 
        chunkSize: 100, 
        maxOverflowRatio: 1.2 
      });
      
      const text = `# API Guide

## Authentication

Use bearer tokens:

\`\`\`bash
curl -H "Authorization: Bearer token"
\`\`\`

## Endpoints

- GET /users
- POST /users

| Endpoint | Method | Description |
|----------|--------|-------------|
| /users   | GET    | List users  |`;
      
      const chunks = splitter.splitText(text);
      
      // Should intelligently group related content
      expect(chunks.length).toBeGreaterThan(1);
      
      // Code blocks should stay with their sections
      const authChunk = chunks.find(chunk => chunk.includes('## Authentication'));
      expect(authChunk).toContain('```bash');
      
      // Tables should be preserved
      const endpointsChunk = chunks.find(chunk => chunk.includes('| Endpoint |'));
      expect(endpointsChunk).toBeDefined();
    });

    it('should fall back to text splitting for oversized content', () => {
      const splitter = createMarkdownSplitter({ 
        chunkSize: 30, 
        maxOverflowRatio: 1.1 
      });
      
      const text = `# Long Section

This is an extremely long paragraph that definitely exceeds the chunk size and cannot be preserved as a single unit even with overflow allowances, so it should fall back to text-based splitting.`;
      
      const chunks = splitter.splitText(text);
      
      // Should split the long paragraph while keeping heading separate
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0]).toContain('# Long Section');
    });

    it('should handle simple text without hierarchical structure', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 60 });
      
      const simpleText = 'Simple paragraph text that should behave the same way.';
      
      const chunks = splitter.splitText(simpleText);
      
      // Simple text should be handled as a single chunk when it fits
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(simpleText);
    });
  });

  describe('Markdown Construct Preservation', () => {
    it('should never split links across chunks', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 30 });
      
      // This text is long and has a link that could easily be split
      const textWithLink = 'This is a long sentence with a [tool usage](./tools-and-tool-calling) link that should stay together.';
      const chunks = splitter.splitText(textWithLink);
      
      
      // Find which chunk contains the link
      const linkChunk = chunks.find(chunk => chunk.includes('[tool usage](./tools-and-tool-calling)'));
      expect(linkChunk).toBeDefined();
      
      // Ensure no chunk has partial link syntax
      chunks.forEach(chunk => {
        // Should not have dangling [ or ] without their pair
        const openBrackets = (chunk.match(/\[/g) || []).length;
        const closeBrackets = (chunk.match(/\]/g) || []).length;
        const openParens = (chunk.match(/\(/g) || []).length;
        const closeParens = (chunk.match(/\)/g) || []).length;
        
        // Either no brackets/parens, or balanced pairs
        if (openBrackets > 0 || closeBrackets > 0) {
          expect(openBrackets).toBe(closeBrackets);
        }
        if (openParens > 0 || closeParens > 0) {
          expect(openParens).toBe(closeParens);
        }
      });
    });

    it('should not create tiny sentence fragments', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 50 });
      
      // Text that would create tiny fragments without proper handling
      const text = 'This is a sentence that is quite long. And here is another sentence that should be combined to avoid tiny fragments at the end.';
      const chunks = splitter.splitText(text);
      
      // Check that no chunk is too small (less than 20% of chunk size)
      const minAcceptableSize = 10; // 20% of 50
      chunks.forEach(chunk => {
        expect(chunk.length).toBeGreaterThanOrEqual(minAcceptableSize);
      });
    });

    it('should keep sentences together when they fit within overflow ratio', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 200, maxOverflowRatio: 1.5 });
      
      // This sentence is 215 chars raw (211 semantic) - should fit in 200 * 1.5 = 300 max
      const longSentence = 'AI SDK Core **simplifies working with LLMs by offering a standardized way of integrating them into your app** - so you can focus on building great AI applications for your users, not waste time on technical details.';
      const chunks = splitter.splitText(longSentence);
      
      // Should be one chunk since it's within overflow allowance
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(longSentence);
    });

    it('should preserve links in complex markdown from user example', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 150 });
      
      // Exact text from user's screenshot
      const text = `AI SDK Core has various functions designed for [text generation](./generating-text), [structured data generation](./generating-structured-data), and [tool usage](./tools-and-tool-calling). These functions take a standardized approach to setting up [prompts](./prompts) and [settings](./settings), making it easier to work with different models.`;
      
      const chunks = splitter.splitText(text);
      
      // Count how many complete links we have across all chunks
      let totalCompleteLinks = 0;
      chunks.forEach(chunk => {
        const linkMatches = chunk.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
        totalCompleteLinks += linkMatches.length;
      });
      
      // Should have all 5 links intact
      expect(totalCompleteLinks).toBe(5);
      
      // No chunk should have partial link syntax
      chunks.forEach(chunk => {
        // Check for incomplete link patterns
        expect(chunk).not.toMatch(/\[[^\]]*$/); // [ without closing ]
        expect(chunk).not.toMatch(/^\][^(]*\(/); // ] at start followed by (
        expect(chunk).not.toMatch(/\]\s*$/); // ] at end without (
        expect(chunk).not.toMatch(/^\s*\(/); // ( at start without preceding ]
      });
    });

    it('should never split images across chunks', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 25 });
      
      const textWithImage = 'Here is an ![image description](https://example.com/very/long/image/path.png) in the text.';
      const chunks = splitter.splitText(textWithImage);
      
      // Find which chunk contains the image
      const imageChunk = chunks.find(chunk => chunk.includes('![image description](https://example.com/very/long/image/path.png)'));
      expect(imageChunk).toBeDefined();
      
      // Ensure no chunk has partial image syntax
      chunks.forEach(chunk => {
        // Check for dangling image syntax
        expect(chunk).not.toMatch(/!\[([^\]]*)\]$/); // ![text] at end without url
        expect(chunk).not.toMatch(/^\([^)]*\)/); // (url) at start without preceding text
      });
    });

    it('should preserve inline code blocks', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 20 });
      
      const textWithCode = 'Use the `generateText` function for text generation and `streamText` for streaming.';
      const chunks = splitter.splitText(textWithCode);
      
      // Ensure inline code is never split
      chunks.forEach(chunk => {
        const backticks = (chunk.match(/`/g) || []).length;
        // Backticks should be even (opening and closing pairs)
        expect(backticks % 2).toBe(0);
      });
    });

    it('should handle multiple links in same text', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 40 });
      
      const textWithMultipleLinks = 'Check [docs](./docs) and [examples](./examples) and [api](./api-reference) for more info.';
      const chunks = splitter.splitText(textWithMultipleLinks);
      
      // Count total links across all chunks
      let totalLinks = 0;
      chunks.forEach(chunk => {
        const linkMatches = chunk.match(/\[([^\]]*)\]\(([^)]*)\)/g) || [];
        totalLinks += linkMatches.length;
        
        // Each chunk should have complete links only
        linkMatches.forEach(link => {
          expect(link).toMatch(/^\[([^\]]*)\]\(([^)]*)\)$/);
        });
      });
      
      // Should preserve all 3 links
      expect(totalLinks).toBe(3);
    });

    it('should handle mixed markdown constructs', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 50 });
      
      const complexText = 'See the `API` docs at [documentation](./docs) and ![icon](./icon.png) for the **overview**.';
      const chunks = splitter.splitText(complexText);
      
      // Verify all constructs are preserved
      let hasInlineCode = false;
      let hasLink = false;
      let hasImage = false;
      
      chunks.forEach(chunk => {
        if (chunk.includes('`API`')) hasInlineCode = true;
        if (chunk.includes('[documentation](./docs)')) hasLink = true;
        if (chunk.includes('![icon](./icon.png)')) hasImage = true;
        
        // Verify construct integrity
        const backticks = (chunk.match(/`/g) || []).length;
        expect(backticks % 2).toBe(0);
        
        const brackets = (chunk.match(/\[/g) || []).length;
        const closeBrackets = (chunk.match(/\]/g) || []).length;
        if (brackets > 0) expect(brackets).toBe(closeBrackets);
      });
      
      expect(hasInlineCode).toBe(true);
      expect(hasLink).toBe(true);
      expect(hasImage).toBe(true);
    });

    it('should handle reference-style links', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 30 });
      
      const refLinkText = 'Check the [documentation][docs] and [examples][ex] for more information.';
      const chunks = splitter.splitText(refLinkText);
      
      // Ensure reference links stay together
      chunks.forEach(chunk => {
        const refLinks = chunk.match(/\[([^\]]*)\]\[([^\]]*)\]/g) || [];
        refLinks.forEach(link => {
          expect(link).toMatch(/^\[([^\]]*)\]\[([^\]]*)\]$/);
        });
      });
    });

    it('should handle edge case with very long single link', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 20 });
      
      // Link longer than chunk size
      const longLinkText = 'Visit [this very long link description](https://example.com/very/long/url/path/that/exceeds/chunk/size) please.';
      const chunks = splitter.splitText(longLinkText);
      
      // Link should stay together even if it exceeds chunk size
      const linkChunk = chunks.find(chunk => 
        chunk.includes('[this very long link description](https://example.com/very/long/url/path/that/exceeds/chunk/size)')
      );
      expect(linkChunk).toBeDefined();
      
      // No partial links should exist
      chunks.forEach(chunk => {
        if (chunk.includes('[') || chunk.includes(']')) {
          expect(chunk).toMatch(/\[([^\]]*)\]\(([^)]*)\)/);
        }
      });
    });
  });

  describe('Semantic Text Length Calculations', () => {
    it('should use actual text content length for splitting, not formatted markdown length', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 20 });
      
      // This markdown has 35 chars but only 11 chars of actual text ("Hello world")
      const text = '# Hello **world**';
      
      const chunks = splitter.splitText(text);
      
      // Should not split because actual text content is only 11 characters
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('# Hello **world**');
    });

    it('should split based on text content when markdown formatting makes raw length exceed limit', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 50 });
      
      // Raw markdown: ~100 chars, but actual text content is much shorter
      const text = '## This is a [very long link](https://example.com/very/long/url/path) with **bold** text';
      
      const chunks = splitter.splitText(text);
      
      // Should not split because text content "This is a very long link with bold text" is < 50 chars
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toContain('[very long link](https://example.com/very/long/url/path)');
    });

    it('should combine heading with content based on semantic length', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 40 });
      
      // Raw markdown for combined would be > 40 chars, but text content is ~35 chars
      const text = '### Heading with **formatting**\n\nShort content.';
      
      const chunks = splitter.splitText(text);
      
      // Should combine because text "Heading with formatting\n\nShort content." is ~35 chars
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toContain('### Heading with **formatting**');
      expect(chunks[0]).toContain('Short content.');
    });

    it('should handle complex markdown with images and links correctly', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 40 });
      
      const text = 'Here is an ![image](https://example.com/very/long/image/url.png) and [link](https://example.com).';
      
      const chunks = splitter.splitText(text);
      
      // Text content is "Here is an image and link." which is < 40 chars
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });

    it('should split long text content regardless of minimal markdown formatting', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 30 });
      
      // Minimal formatting but long text content
      const text = 'This is a very long sentence that has minimal markdown formatting but exceeds the chunk size limit.';
      
      const chunks = splitter.splitText(text);
      
      // Should split because actual text content is > 30 chars
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        // Each chunk's text content should be <= 30 (with some flexibility for word boundaries)
        const plainText = chunk.replace(/[*_`~\[\]()#]/g, '');
        expect(plainText.length).toBeLessThanOrEqual(45); // Allow some flexibility
      });
    });

    it('should handle code blocks with semantic length', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 50 });
      
      const text = '```javascript\nfunction example() {\n  return "Hello";\n}\n```';
      
      const chunks = splitter.splitText(text);
      
      // Text content is the code inside, which should fit in 50 chars
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toContain('```javascript');
      expect(chunks[0]).toContain('function example()');
    });

    it('should handle lists with semantic length calculations', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 40 });
      
      const text = '- First **item** with [link](https://example.com)\n- Second *item*\n- Third item';
      
      const chunks = splitter.splitText(text);
      
      // Text content: "First item with link\nSecond item\nThird item"
      // Should evaluate based on actual text, not markdown length
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      chunks.forEach(chunk => {
        expect(chunk).toMatch(/^[-*]/m); // Should preserve list formatting
      });
    });

    it('should handle edge case with only formatting characters', () => {
      const splitter = createMarkdownSplitter({ chunkSize: 10 });
      
      // Edge cases with minimal text content
      const text1 = '****'; // Empty bold
      const text2 = '[](https://example.com)'; // Empty link
      const text3 = '![](https://example.com/image.png)'; // Image without alt text
      
      const chunks1 = splitter.splitText(text1);
      const chunks2 = splitter.splitText(text2);
      const chunks3 = splitter.splitText(text3);
      
      // These should not cause errors and should handle gracefully
      expect(chunks1).toBeDefined();
      expect(chunks2).toBeDefined();
      expect(chunks3).toBeDefined();
    });
  });

  describe('Examples', () => {
    it('should handle examples from the user', () => {
      const text = `# AI SDK Core

Large Language Models (LLMs) are advanced programs that can understand, create, and engage with human language on a large scale.
They are trained on vast amounts of written material to recognize patterns in language and predict what might come next in a given piece of text.

AI SDK Core **simplifies working with LLMs by offering a standardized way of integrating them into your app** - so you can focus on building great AI applications for your users, not waste time on technical details.

For example, here’s how you can generate text with various models using the AI SDK:

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

Please check out the [AI SDK Core API Reference](/docs/reference/ai-sdk-core) for more details on each function.`

      const splitter = createMarkdownSplitter({ chunkSize: 200, maxOverflowRatio: 1.5 });
      const chunks = splitter.splitText(text);
      
      // Should create multiple chunks but preserve all links
      expect(chunks.length).toBeGreaterThan(1);
      
      // Check that no links are broken
      chunks.forEach((chunk) => {
        // Should not have partial link syntax
        expect(chunk).not.toMatch(/\[[^\]]*$/); // [ without closing ]
        expect(chunk).not.toMatch(/^\]/); // ] at start
        expect(chunk).not.toMatch(/\]\s*$/); // ] at end without (
        expect(chunk).not.toMatch(/^\s*\(/); // ( at start without ]
        
        // Should not break URLs with spaces
        expect(chunk).not.toMatch(/\.\s+\//); // dot space slash
      });
      
      // Count total links across all chunks
      let totalLinks = 0;
      chunks.forEach(chunk => {
        const links = chunk.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
        totalLinks += links.length;
      });
      
      // Should preserve all links in the document (at least 13, could be more)
      expect(totalLinks).toBeGreaterThanOrEqual(13);
    });
  });
});
