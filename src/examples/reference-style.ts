import { chunkdown } from '../chunkdown';
import { fromMarkdown } from '../markdown';

const text = `
# Introduction

Markdown supports two types of links: [inline](https://example.com/docs "Title") and [reference][1].

# Conclusion

Reference links are defined at the end of the document.

[1]: https://example.com/docs "Documentation"
`;

const splitterPreserve = chunkdown({
  chunkSize: 100,
  maxOverflowRatio: 1,
  rules: { link: { style: 'preserve' } },
});

const chunksPreserve = splitterPreserve.splitText(text);
// [
//   '# Introduction\n\nMarkdown supports two types of links: [inline](https://example.com/docs) and [reference][1].',
//   '# Conclusion\n\nReference links are defined at the end of the document.\n\n[1]: https://example.com/docs "Documentation"',
// ];

const splitterInline = chunkdown({
  chunkSize: 100,
  maxOverflowRatio: 1,
  rules: { link: { style: 'inline' } },
});

const chunksInline = splitterInline.splitText(text);
// [
//   '# Introduction\n\nMarkdown supports two types of links: [inline](https://example.com/docs) and [reference](https://example.com/docs "Documentation").',
//   '# Conclusion\n\nReference links are defined at the end of the document.',
// ];

const ast = fromMarkdown(text);
console.dir(ast, { depth: null });
