import type { Heading, Nodes, Root } from 'mdast';
import { fromMarkdown, preprocessMarkdown, toMarkdown, toString } from './markdown';
import { chunkRange, lineStarts, recordSourceNodes, toPoint } from './position';
import { splitRangesByMaxRawSize } from './size';
import type { SharedSplitterOptions } from './splitters/base';
import type { NodeSplitter } from './splitters/interface';
import { TreeSplitter } from './splitters/tree';
import type { Breadcrumb, Chunk, ChunkPosition, NodeRules, SplitterOptions, SplitterResult } from './types';
import { alignWithSource, unmapOffset } from './utils/source-offsets';

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
    if (options.maxRawSize !== undefined && (!Number.isInteger(options.maxRawSize) || options.maxRawSize < 1)) {
      throw new Error(`maxRawSize must be a positive integer, got ${options.maxRawSize}`);
    }

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
   * @returns SplitResult containing chunks with text, breadcrumbs and source positions
   */
  split(text: string): SplitterResult {
    /**
     * The parser drops a leading byte order mark and counts its offsets
     * without it. All offsets are computed against the text without it, and
     * the positions of the chunks are moved back by its length at the end.
     */
    const bom = text.charCodeAt(0) === 0xfeff ? 1 : 0;
    const document = bom ? text.slice(bom) : text;

    const root = fromMarkdown(text);
    const preparedRoot = preprocessMarkdown(root, this.options);
    const sourceNodes = recordSourceNodes(preparedRoot);

    /**
     * Splitters may reuse source subtrees whose text matches the source. A
     * transform can leave nodes whose text matches while their structure or
     * positions no longer do, so the reuse is off when transforms run.
     */
    let nodes: Array<Nodes>;
    this.options.document = document;
    this.options.reuseSourceTrees = !this.hasTransforms;
    try {
      nodes = this.splitter.splitNode(preparedRoot);
    } finally {
      this.options.document = undefined;
      this.options.reuseSourceTrees = undefined;
    }

    const starts = lineStarts(document);
    const toPosition = (start: number, end: number): ChunkPosition => ({
      start: toPoint(start, starts, bom),
      end: toPoint(end, starts, bom),
    });

    const chunks: Chunk[] = [];

    for (const node of nodes) {
      const markdown = toMarkdown(node).trim();
      if (markdown.length === 0) continue;

      const headings = node.data?.breadcrumbs ?? [];
      const breadcrumbs: Breadcrumb[] = headings.map((h) => ({
        text: toString(h),
        depth: h.depth,
      }));

      const range = chunkRange(node, sourceNodes, document);

      if (this.options.maxRawSize !== undefined && markdown.length > this.options.maxRawSize) {
        /**
         * The parts are cut from the written-out text. Their source offsets
         * are only known when that text is the source region with at most
         * escapes changed.
         */
        const edits = range ? alignWithSource(document, range[0], range[1], `${markdown}\n`) : undefined;
        for (const [start, end] of splitRangesByMaxRawSize(markdown, this.options.maxRawSize)) {
          const chunk: Chunk = { text: markdown.slice(start, end), breadcrumbs };
          if (range && edits) {
            chunk.source = {
              position: toPosition(range[0] + unmapOffset(start, edits), range[0] + unmapOffset(end, edits)),
            };
          }
          chunks.push(chunk);
        }
      } else {
        const chunk: Chunk = { text: markdown, breadcrumbs };
        if (range) chunk.source = { position: toPosition(range[0], range[1]) };
        chunks.push(chunk);
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
