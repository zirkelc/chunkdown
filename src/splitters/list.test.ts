import { f } from 'f-strings';
import { describe, expect, it } from 'vitest';
import { ListSplitter } from './list';

describe('ListSplitter', () => {
  it('should keep lists together if possible', () => {
    const splitter = new ListSplitter({
      chunkSize: 50,
      maxOverflowRatio: 1.0,
    });
    const text = f`
- First list item
- Second list item
- Third list item`;

    const chunks = splitter.splitText(text);

    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe(
      `* First list item\n* Second list item\n* Third list item`,
    );
  });

  it('should split list by items', () => {
    const splitter = new ListSplitter({
      chunkSize: 40,
      maxOverflowRatio: 1.0,
    });
    const text = `
- First list item. Some more content
- Second list item. Some more content
- Third list item. Some more content`;

    const chunks = splitter.splitText(text);

    expect(chunks.length).toBe(3);
    expect(chunks[0]).toBe('* First list item. Some more content');
    expect(chunks[1]).toBe('* Second list item. Some more content');
    expect(chunks[2]).toBe('* Third list item. Some more content');
  });

  it('should preserve ordered list numbering when splitting', () => {
    const splitter = new ListSplitter({
      chunkSize: 50,
      maxOverflowRatio: 1.0,
    });
    const text = f`
1. First step with some content
2. Second step with some content
3. Third step with some content
4. Fourth step with some content
5. Fifth step with some content
6. Sixth step with some content
`;
    const chunks = splitter.splitText(text);

    // Find the chunks containing ordered list items
    const listChunks = chunks.filter((chunk) => /^\d+\./.test(chunk.trim()));

    expect(listChunks.length).toBe(6);
    for (let i = 1; i < listChunks.length; i++) {
      expect(listChunks[i]).toMatch(new RegExp(`^[${i + 1}].`));
    }
  });

  it('should preserve ordered list numbering with long items that get split', () => {
    const splitter = new ListSplitter({
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
    const expectedNumbers = [1, 2, 3, 4, 4, 5, 6, 7, 8, 9];

    expect(allListNumbers).toEqual(expectedNumbers);

    // Verify that we have exactly 9 list items
    expect(allListNumbers.length).toBe(10);

    // Additional verification: ensure no numbering resets to 1 after the first item
    const numbersAfterFirst = allListNumbers.slice(1);
    expect(numbersAfterFirst).not.toContain(1);
  });
});
