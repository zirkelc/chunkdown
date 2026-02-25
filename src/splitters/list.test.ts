import { describe, expect, it } from 'vitest';
import { ListSplitter } from './list';

describe('ListSplitter', () => {
  const list = `
- First list item. Some more content
- Second list item. Some more content
- Third list item. Some more content`;

  const nestedList = `
1. First item
   - Sub-item A
   - Sub-item B
2. Second item
   1. Nested ordered item 1
   2. Nested ordered item 2
3. Third item
   - Another sub-item
     - Deeply nested item`;

  it('should not split lists if they fit', () => {
    const splitter = new ListSplitter({
      chunkSize: 120,
      maxOverflowRatio: 1.0,
    });

    const chunks = splitter.splitText(list);

    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe(
      `* First list item. Some more content\n* Second list item. Some more content\n* Third list item. Some more content`,
    );
  });

  it('should split list by items', () => {
    const splitter = new ListSplitter({
      chunkSize: 40,
      maxOverflowRatio: 1.0,
    });

    const chunks = splitter.splitText(list);

    expect(chunks.length).toBe(3);
    expect(chunks[0]).toBe('* First list item. Some more content');
    expect(chunks[1]).toBe('* Second list item. Some more content');
    expect(chunks[2]).toBe('* Third list item. Some more content');
  });

  it('should split list by items further if items are too large', () => {
    const splitter = new ListSplitter({
      chunkSize: 30,
      maxOverflowRatio: 1.0,
    });

    const chunks = splitter.splitText(list);

    expect(chunks.length).toBe(6);
    expect(chunks[0]).toBe('* First list item.');
    expect(chunks[1]).toBe('Some more content');
    expect(chunks[2]).toBe('* Second list item.');
    expect(chunks[3]).toBe('Some more content');
    expect(chunks[4]).toBe('* Third list item.');
    expect(chunks[5]).toBe('Some more content');
  });

  it('should preserve ordered list numbering', () => {
    const splitter = new ListSplitter({
      chunkSize: 200,
      maxOverflowRatio: 1.5,
    });

    const orderedList = `1. First item with very long content. This item contains substantial text that will exceed the chunk size limit and force the splitter to break it into multiple chunks, which can cause numbering issues if not handled correctly.

2. Second item with moderate content. This item has enough content to potentially cause issues but should fit in a single chunk.

3. Third item with short content.

4. Fourth item with extremely long content that will definitely be split. This is a very detailed item that contains multiple sentences with comprehensive explanations and examples. It includes technical details, step-by-step instructions, and various formatting elements that make it substantially longer than the configured chunk size, ensuring it will be split across multiple chunks during processing.

5. Fifth item with another very long section. Similar to item 4, this contains extensive content that will cause the text splitter to break it into multiple chunks, testing whether the ordered list numbering is preserved correctly across these splits.

6. Sixth item with normal content.

7. Seventh item with more long content. This item also has substantial text that will likely exceed the chunk size and test the numbering preservation functionality in various scenarios.

8. Eighth item is short.

9. Ninth and final item.`;

    const chunks = splitter.splitText(orderedList);

    // Extract all list item numbers from all chunks (not just those that start chunks)
    const allListNumbers = chunks.flatMap((chunk) => {
      const matches = chunk.matchAll(/^(\d+)\./gm);
      return Array.from(matches).map((match) => Number.parseInt(match[1], 10));
    });

    // Should preserve sequential numbering: 1, 2, 3, 4, 5, 6, 7, 8, 9
    const expectedNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(allListNumbers).toEqual(expectedNumbers);
  });

  it('should handle nested lists with mixed ordered and unordered items', () => {
    const splitter = new ListSplitter({
      chunkSize: 200,
      maxOverflowRatio: 1.0,
    });

    const chunks = splitter.splitText(nestedList);

    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe(
      '1. First item\n   * Sub-item A\n   * Sub-item B\n2. Second item\n   1. Nested ordered item 1\n   2. Nested ordered item 2\n3. Third item\n   * Another sub-item\n     * Deeply nested item',
    );
  });

  it('should split nested lists by top-level items when needed', () => {
    const splitter = new ListSplitter({
      chunkSize: 60,
      maxOverflowRatio: 1.0,
    });

    const chunks = splitter.splitText(nestedList);

    expect(chunks.length).toBe(3);
    expect(chunks[0]).toBe('1. First item\n   * Sub-item A\n   * Sub-item B');
    expect(chunks[1]).toBe('2. Second item\n   1. Nested ordered item 1\n   2. Nested ordered item 2');
    expect(chunks[2]).toBe('3. Third item\n   * Another sub-item\n     * Deeply nested item');
  });

  describe('Rules', () => {
    it('should split lists if rules are undefined', () => {
      const splitter = new ListSplitter({
        chunkSize: 40,
        maxOverflowRatio: 1.0,
        rules: { list: undefined },
      });
      const chunks = splitter.splitText(list);

      expect(chunks.length).toBe(3);
      expect(chunks[0]).toBe('* First list item. Some more content');
      expect(chunks[1]).toBe('* Second list item. Some more content');
      expect(chunks[2]).toBe('* Third list item. Some more content');
    });

    it('should split lists if rules are set to allow-split', () => {
      const splitter = new ListSplitter({
        chunkSize: 40,
        maxOverflowRatio: 1.0,
        rules: { list: { split: { rule: 'allow-split' } } },
      });
      const chunks = splitter.splitText(list);

      expect(chunks.length).toBe(3);
      expect(chunks[0]).toBe('* First list item. Some more content');
      expect(chunks[1]).toBe('* Second list item. Some more content');
      expect(chunks[2]).toBe('* Third list item. Some more content');
    });

    it('should not split lists if rules are set to never-split', () => {
      const splitter = new ListSplitter({
        chunkSize: 40,
        maxOverflowRatio: 1.0,
        rules: { list: { split: { rule: 'never-split' } } },
      });

      const chunks = splitter.splitText(list);

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toBe(
        '* First list item. Some more content\n* Second list item. Some more content\n* Third list item. Some more content',
      );
    });

    it('should split lists if exceeds size limit', () => {
      const splitter = new ListSplitter({
        chunkSize: 40,
        maxOverflowRatio: 1.0,
        rules: { list: { split: { rule: 'size-split', size: 30 } } },
      });
      const chunks = splitter.splitText(list);

      expect(chunks.length).toBe(3);
      expect(chunks[0]).toBe('* First list item. Some more content');
      expect(chunks[1]).toBe('* Second list item. Some more content');
      expect(chunks[2]).toBe('* Third list item. Some more content');
    });

    it('should not split lists if does not exceed size limit', () => {
      const splitter = new ListSplitter({
        chunkSize: 40,
        maxOverflowRatio: 1.0,
        rules: { list: { split: { rule: 'size-split', size: 120 } } },
      });
      const chunks = splitter.splitText(list);

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toBe(
        '* First list item. Some more content\n* Second list item. Some more content\n* Third list item. Some more content',
      );
    });
  });
});
