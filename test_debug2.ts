import { ListSplitter } from './src/splitters/list';

const text = `1. **First item with very long content.** This item contains substantial text that will exceed the chunk size limit and force the splitter to break it into multiple chunks, which can cause numbering issues if not handled correctly.

2. **Second item with moderate content.** This item has enough content to potentially cause issues but should fit in a single chunk.

3. **Third item with short content.**

4. **Fourth item with extremely long content that will definitely be split.** This is a very detailed item that contains multiple sentences with comprehensive explanations and examples. It includes technical details, step-by-step instructions, and various formatting elements that make it substantially longer than the configured chunk size, ensuring it will be split across multiple chunks during processing.

5. **Fifth item with another very long section.** Similar to item 4, this contains extensive content that will cause the text splitter to break it into multiple chunks, testing whether the ordered list numbering is preserved correctly across these splits.

6. **Sixth item with normal content.**

7. **Seventh item with more long content.** This item also has substantial text that will likely exceed the chunk size and test the numbering preservation functionality in various scenarios.

8. **Eighth item is short.**

9. **Ninth and final item.**`;

const splitter = new ListSplitter({
  chunkSize: 200,
  maxOverflowRatio: 1.5,
});

const chunks = splitter.splitText(text);
console.log('Chunks:', chunks.length);
chunks.forEach((chunk, i) => {
  console.log(`\n=== Chunk ${i + 1} ===`);
  console.log(chunk);
});

// Extract all list item numbers from all chunks
const allListNumbers: number[] = [];
chunks.forEach((chunk) => {
  const matches = chunk.matchAll(/^(\d+)\./gm);
  for (const match of matches) {
    allListNumbers.push(Number.parseInt(match[1], 10));
  }
});

console.log('\n=== List Numbers Found ===');
console.log(allListNumbers);
console.log('Expected: [1, 2, 3, 4, 5, 6, 7, 8, 9]');
