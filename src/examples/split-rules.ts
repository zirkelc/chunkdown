import { MarkdownTextSplitter } from '@langchain/textsplitters';
import { chunkdown } from '../chunkdown';

const text = `Please check out the [AI SDK Core API Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core) for more details on each function.`;

const langchainSplitter = new MarkdownTextSplitter({
  chunkSize: 50,
  chunkOverlap: 0,
});
const langchainChunks = await langchainSplitter.splitText(text);
console.log(langchainChunks);
// [
//   'Please check out the [AI SDK Core API',
//   'Reference](https://ai-sdk.dev/docs/reference/ai-s',
//   'dk-core)',
//   'for more details on each function.',
// ];

// Chunkdown with link protection
console.log('\n=== Chunkdown (with link protection) ===');
const chunkdownProtected = chunkdown({
  chunkSize: 35,
  rules: {
    link: {
      // split: 'never-split',
      split: 'allow-split',
      // split: { rule: 'size-split', size: 50 }
    },
  },
});
const { chunks: chunkdownChunks } = chunkdownProtected.split(text);
console.log(chunkdownChunks);
// [
//   'Please check out the [AI SDK Core API Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core)',
//   'for more details on each function.',
// ];
