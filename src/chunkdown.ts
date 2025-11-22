import type { Nodes, Root } from 'mdast';
import { fromMarkdown, preprocessMarkdown, toMarkdown } from './markdown';
import { splitByMaxRawSize } from './size';
import type { NodeSplitter } from './splitters/interface';
import { TreeSplitter } from './splitters/tree';
import type { NodeRules, SplitterOptions } from './types';

/**
 * Default node rules:
 * - Links
 *   - Never split
 *   - Normalize to inline style
 * - Images
 *   - Never split
 *   - Normalize to inline style
 */
export const defaultNodeRules: NodeRules = {
  link: {
    split: 'never-split',
    style: 'inline',
  },
  image: {
    split: 'never-split',
    style: 'inline',
  },
};

class Chunkdown implements NodeSplitter<Root> {
  private options: SplitterOptions;
  private splitter: TreeSplitter;

  constructor(options: SplitterOptions) {
    this.options = options;
    this.splitter = new TreeSplitter(this.options);
  }

  get chunkSize(): number {
    return this.options.chunkSize;
  }

  get maxOverflowRatio(): number {
    return this.options.maxOverflowRatio;
  }

  get maxRawSize(): number | undefined {
    return this.options.maxRawSize;
  }

  splitText(text: string): string[] {
    const root = fromMarkdown(text);

    const chunks = this.splitNode(root)
      .map((node) => toMarkdown(node).trim())
      .filter((chunk) => chunk.length > 0);

    if (this.options.maxRawSize !== undefined) {
      return Array.from(splitByMaxRawSize(chunks, this.options.maxRawSize));
    }

    return chunks;
  }

  splitNode(root: Root): Array<Nodes> {
    const preparedRoot = preprocessMarkdown(root, this.options);
    return this.splitter.splitNode(preparedRoot);
  }
}

/**
 * Create a new Chunkdown instance.
 * Applies default node rules if no custom rules are provided.
 */
export const chunkdown = (options: SplitterOptions) => {
  const rules = options.rules ?? defaultNodeRules;
  const splitter = new Chunkdown({
    ...options,
    rules,
  });

  return splitter;
};
