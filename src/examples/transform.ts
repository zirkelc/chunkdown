import { chunkdown } from '../chunkdown';

/**
 * To improve the quality of your chunks, it's important to remove elements that only increase the character count of your chunks but don't contribute any meaningful content.
 * Typical examples are tracking pixels, base64-encoded data URLs or other extremely long URLs
 *
 * Chunkdown provides transforms to modify or filter nodes during preprocessing.
 */

const text = `# Documentation

![architecture](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAoAAAAHgCAYAAAD0...)

Check out our [comprehensive documentation](https://example.com/docs/getting-started/installation/requirements/nodejs-version) for installation instructions.

Visit the [API reference](https://api.example.com/v1) for detailed endpoint information.

![](https://tracking.example.com/pixel/12345.gif)`;

const splitter = chunkdown({
  chunkSize: 200,
  maxOverflowRatio: 1.5,
  rules: {
    link: {
      transform(node) {
        // Truncate URLs longer than 1000 characters
        if (node.url.length > 1000)
          return {
            ...node,
            url: node.url.substring(0, 1000) + '...',
          };

        return undefined; // Keep unchanged
      },
    },
    image: {
      transform(node) {
        // Remove data URLs
        if (node.url.startsWith('data:')) return null;

        // Remove images without alt text
        if (!node.alt) return null;

        return undefined; // Keep unchanged
      },
    },
  },
});

const { chunks } = splitter.split(text);
// chunks:
// # Documentation
//
// Check out our [comprehensive documentation](https://example.com/docs/getting-started/installation/requirements/nodejs-version) for installation instructions.
//
// Visit the [API reference](https://api.example.com/v1) for detailed endpoint information.

console.log(chunks);
