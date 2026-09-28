import type { Heading, Nodes, Root } from 'mdast';
import { fromMarkdown, preprocessMarkdown, toMarkdown, toString } from './markdown';
import { splitTextByMaxRawSize } from './size';
import type { SharedSplitterOptions } from './splitters/base';
import type { NodeSplitter } from './splitters/interface';
import { TreeSplitter } from './splitters/tree';
import type { Breadcrumb, Chunk, NodeRules, SplitterOptions, SplitterResult } from './types';

/**
 * Default node rules:
 * - Links
 *   - Never split
 *   - Normalize to inline style
 * - Images
 *   - Never split
 *   - Normalize to inline style
 * - Words
 *   - Never split (treat words as atomic units)
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
  word: {
    split: 'never-split',
  },
};

class Chunkdown implements NodeSplitter<Root> {
  private options: SharedSplitterOptions;
  private splitter: TreeSplitter;
  private hasTransforms: boolean;

  constructor(options: SplitterOptions) {
    this.options = {
      ...options,
      maxOverflowRatio: Math.max(1.0, options.maxOverflowRatio ?? 1.0),
    };
    this.splitter = new TreeSplitter(this.options);
    this.hasTransforms = Object.values(this.options.rules ?? {}).some((rule) => rule?.transform !== undefined);
  }

  get chunkSize(): number {
    return this.options.chunkSize;
  }

  get maxOverflowRatio(): number {
    return this.options.maxOverflowRatio ?? 1.0;
  }

  get maxRawSize(): number | undefined {
    return this.options.maxRawSize;
  }

  /**
   * Split markdown text into chunks with metadata.
   *
   * @param text - The markdown text to split
   * @returns SplitResult containing chunks with text and breadcrumbs
   */
  split(text: string): SplitterResult {
    const root = fromMarkdown(text);
    const preparedRoot = preprocessMarkdown(root, this.options);

    /**
     * Splitters may reuse source subtrees whose text matches the source. A
     * transform can leave nodes whose text matches while their structure or
     * positions no longer do, so the source is withheld when transforms run.
     */
    let nodes: Array<Nodes>;
    this.options.source = this.hasTransforms ? undefined : text;
    try {
      nodes = this.splitter.splitNode(preparedRoot);
    } finally {
      this.options.source = undefined;
    }

    const chunks: Chunk[] = [];

    for (const node of nodes) {
      const markdown = toMarkdown(node).trim();
      if (markdown.length === 0) continue;

      const headings = node.data?.breadcrumbs ?? [];
      const breadcrumbs: Breadcrumb[] = headings.map((h) => ({
        text: toString(h),
        depth: h.depth,
      }));

      if (this.options.maxRawSize !== undefined && markdown.length > this.options.maxRawSize) {
        for (const part of splitTextByMaxRawSize(markdown, this.options.maxRawSize)) {
          chunks.push({ text: part, breadcrumbs });
        }
      } else {
        chunks.push({ text: markdown, breadcrumbs });
      }
    }

    return { chunks };
  }

  /**
   * @deprecated Use `split()` instead
   */
  splitText(text: string): string[] {
    return this.split(text).chunks.map((c) => c.text);
  }

  /**
   * @deprecated Use `split()` instead
   */
  splitNode(root: Root): Array<Nodes> {
    return this.split(toMarkdown(root)).chunks.map((c) => fromMarkdown(c.text));
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
