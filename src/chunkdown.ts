import type { Nodes, Root } from 'mdast';
import { fromMarkdown, toMarkdown } from './markdown';
import { splitByMaxRawSize } from './size';
import type { NodeSplitter } from './splitters/interface';
import { TreeSplitter } from './splitters/tree';
import type { NodeRules, SplitterOptions } from './types';

/**
 * Default rules for splitting nodes.
 * Links and images are never split by default.
 */
export const defaultNodeRules: NodeRules = {
  link: { split: 'never-split' },
  image: { split: 'never-split' },
};

class Chunkdown implements NodeSplitter<Root> {
  private options: SplitterOptions;
  private splitter: TreeSplitter;

  constructor(options: SplitterOptions) {
    this.options = options;
    this.splitter = new TreeSplitter(this.options);
  }

  splitText(text: string): string[] {
    const ast = fromMarkdown(text);
    const chunks = this.splitter
      .splitNode(ast)
      .map((node) => toMarkdown(node).trim())
      .filter((chunk) => chunk.length > 0);

    if (this.options.maxRawSize !== undefined) {
      return Array.from(splitByMaxRawSize(chunks, this.options.maxRawSize));
    }

    return chunks;
  }

  splitNode(node: Root): Array<Nodes> {
    return this.splitter.splitNode(node);
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
