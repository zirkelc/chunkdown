import type { Node } from 'mdast';
import { fromMarkdown, toMarkdown } from './markdown';
import { splitByMaxRawSize } from './size';
import { MarkdownTreeSplitter } from './splitters/tree';

// TODO add option to merge sections: parent-children, siblings, orphaned sections (root-level section without parents)
// maybe only if chunk.size < options.chunkSize * 0.5
export type ChunkdownOptions = {
  /**
   * Preferred chunk size.
   * Content size will be calculated using the actual text content without markdown formatting characters.
   * That means the raw text length of each chunk will be usually greater than the `chunkSize`.
   */
  chunkSize: number;
  /**
   * Maximum overflow ratio for preserving semantic units.
   * - 1.0 = strict size limits, no overflow allowed
   * - >1.0 = allow overflow to preserve semantic coherence
   * For example, 1.5 means allow chunks up to 50% larger than chunkSize
   * to keep semantic units (sections, lists, code blocks) together.
   */
  maxOverflowRatio: number;
  /**
   * Optional maximum raw markdown length (characters) for embedding model compatibility.
   * If set, chunks will be further split when their raw markdown exceeds this limit.
   * Useful for embedding models with character limits (e.g., 7000 for OpenAI text-embedding-3-large).
   * If undefined, defaults to chunkSize * maxOverflowRatio * 4 for reasonable safety.
   */
  maxRawSize?: number;
  /**
   * Optional breakpoints for controlling when specific node types can be split.
   * If not provided, uses the exported `breakpoints` defaults.
   * If provided, completely replaces all defaults (merge manually if needed).
   * If maxSize is not set or is 0, the node type has no special protection and can always be split.
   *
   * @example Replace all defaults with custom breakpoints
   * ```typescript
   * {
   *   link: { maxSize: 100 },
   *   emphasis: { maxSize: 50 },
   * }
   * ```
   *
   * @example Merge with defaults to override specific breakpoints
   * ```typescript
   * import { breakpoints } from 'chunkdown';
   *
   * {
   *   ...breakpoints,
   *   link: { maxSize: 100 },
   *   emphasis: { maxSize: 50 },
   * }
   * ```
   */
  breakpoints?: Partial<Breakpoints>;
};

export type Breakpoints = {
  [node: Node['type']]: Breakpoint;
};

export type Breakpoint = {
  maxSize?: number;
  // TODO breakmode and onBreak callback for custom behavior
  // breakMode?: 'keep' | 'clean' | 'extend';
  // onBreak?: (node: Node) => Array<Node>;
};

/**
 * Default breakpoints for protecting markdown constructs based on content length.
 * Constructs shorter than these values will be protected from splitting.
 *
 * Note: Finite maxSize values are automatically capped at maxAllowedSize (chunkSize * maxOverflowRatio).
 * Use Infinity to protect constructs regardless of chunk size.
 *
 * @example Protect constructs with finite limits (auto-capped)
 * ```typescript
 * chunkdown({
 *   chunkSize: 500,
 *   maxOverflowRatio: 1.5,
 *   breakpoints: {
 *     ...defaultBreakpoints,
 *     strong: { maxSize: 50 },  // Protected up to min(50, 750)
 *   }
 * });
 * ```
 *
 * @example Protect constructs regardless of size
 * ```typescript
 * chunkdown({
 *   chunkSize: 100,
 *   breakpoints: {
 *     ...defaultBreakpoints,
 *     link: { maxSize: Infinity },  // Never split links
 *   }
 * });
 * ```
 */
export const defaultBreakpoints: Breakpoints = {
  link: { maxSize: Infinity },
  image: { maxSize: Infinity },
};

export const chunkdown = (options: ChunkdownOptions) => {
  const breakpoints = options.breakpoints ?? defaultBreakpoints;
  const splitter = new MarkdownTreeSplitter({
    ...options,
    breakpoints,
  });

  return {
    splitText: (text: string) => {
      const ast = fromMarkdown(text);
      const chunks = splitter
        .splitNode(ast)
        .map((node) => toMarkdown(node).trim())
        .filter((chunk) => chunk.length > 0);

      // Apply maxRawSize as final safety check if defined
      if (options.maxRawSize !== undefined) {
        return Array.from(splitByMaxRawSize(chunks, options.maxRawSize));
      }

      return chunks;
    },
  };
};
