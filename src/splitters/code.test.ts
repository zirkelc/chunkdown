import { describe, expect, it } from 'vitest';
import { CodeSplitter } from './code';

describe('CodeSplitter', () => {
  describe('Rules', () => {
    const text = `\`\`\`javascript
function example() {
  const message = "This is a long code block with multiple lines";
  console.log(message);
  return message;
}
\`\`\``;

    it('may split code blocks if rules are undefined', () => {
      const splitter = new CodeSplitter({
        chunkSize: 30,
        maxOverflowRatio: 1.0,
        rules: { code: undefined },
      });
      const chunks = splitter.splitText(text);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should split code blocks if rules are set to allow-split', () => {
      const splitter = new CodeSplitter({
        chunkSize: 30,
        maxOverflowRatio: 1.0,
        rules: { code: { split: { rule: 'allow-split' } } },
      });
      const chunks = splitter.splitText(text);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should not split code blocks if rules are set to never-split', () => {
      const splitter = new CodeSplitter({
        chunkSize: 30,
        maxOverflowRatio: 1.0,
        rules: { code: { split: { rule: 'never-split' } } },
      });
      const chunks = splitter.splitText(text);
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toContain('function example()');
    });

    it('should split code blocks if exceeds size limit', () => {
      const splitter = new CodeSplitter({
        chunkSize: 30,
        maxOverflowRatio: 1.0,
        rules: { code: { split: { rule: 'size-split', size: 30 } } },
      });
      const chunks = splitter.splitText(text);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should not split code blocks if does not exceed size limit', () => {
      const splitter = new CodeSplitter({
        chunkSize: 30,
        maxOverflowRatio: 1.0,
        rules: { code: { split: { rule: 'size-split', size: 500 } } },
      });
      const chunks = splitter.splitText(text);
      expect(chunks.length).toBe(1);
    });
  });
});
