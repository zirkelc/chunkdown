import type {
  Blockquote,
  Code,
  Delete,
  Emphasis,
  Heading,
  Image,
  InlineCode,
  Link,
  List,
  Nodes,
  Parent,
  Root,
  Strong,
  Table,
  Text,
} from 'mdast';

type Formatting = Strong | Emphasis | Delete;

/**
 * Mapping of node type names to their corresponding mdast node types.
 */
type NodeTypes = {
  link: Link;
  image: Image;
  strong: Strong;
  emphasis: Emphasis;
  delete: Delete;
  formatting: Formatting;
  list: List;
  table: Table;
  blockquote: Blockquote;
  code: Code;
  inlineCode: InlineCode;
  heading: Heading;
  /**
   * Words are runs of non-whitespace characters inside text. There is no mdast
   * `Word` node, but the rule controls whether the text splitter is allowed to
   * break inside a word. Mapped to `Text` for type compatibility only.
   */
  word: Text;
};

/**
 * Link style options
 * - 'inline': Convert reference-style links to inline links
 * - 'preserve': Keep original style
 */
export type LinkStyle = 'inline' | 'preserve';

/**
 * Image style options
 * - 'inline': Convert reference-style images to inline images
 * - 'preserve': Keep original style
 */
export type ImageStyle = 'inline' | 'preserve';

export type SplitterOptions = {
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
   * If undefined or less than 1.0, defaults to 1.0.
   */
  maxOverflowRatio?: number;
  /**
   * Optional maximum raw markdown length (characters) for embedding model compatibility.
   * If set, chunks will be further split when their raw markdown exceeds this limit.
   * Useful for embedding models with character limits (e.g., 7000 for OpenAI text-embedding-3-large).
   * Must be a positive integer (1 or greater), otherwise the constructor throws an error.
   * If undefined, defaults to chunkSize * maxOverflowRatio * 4 for reasonable safety.
   */
  maxRawSize?: number;
  /**
   * Optional rules for nodes.
   * Can be configured for specific node types.
   */
  rules?: Partial<NodeRules>;
};

/**
 * Context provided to transform functions
 */
export type TransformContext = {
  /**
   * Parent node containing this node
   */
  parent?: Parent;
  /**
   * Index of this node in parent's children
   */
  index?: number;
  /**
   * Root node of the entire tree
   */
  root: Root;
};

/**
 * Transform function for a specific node type.
 * Returns:
 * - Modified node to replace the original
 * - null to remove the node
 * - undefined to keep the node unchanged
 */
export type NodeTransform<NODE extends Nodes> = (node: NODE, context: TransformContext) => NODE | null | undefined;

/**
 * Node-specific rules
 */
export type NodeRules = {
  [K in keyof NodeTypes]?: NodeRule<NodeTypes[K] extends Nodes ? NodeTypes[K] : never>;
};

/**
 * Node-specific rule
 */
export type NodeRule<NODE extends Nodes> = NODE extends Link
  ? {
      /**
       * Split rule
       * - 'never-split': Never split the node
       * - 'allow-split': Allow splitting the node
       * - 'size-split': Split the node if its content size exceeds a certain limit
       */
      split?: SplitRule<NODE>;
      /**
       * Normalize links
       * - 'inline': Convert reference-style links to inline links
       * - 'preserve': Keep original style
       * - undefined: Keep original style
       */
      style?: LinkStyle;
      /**
       * Transform function to modify or filter link nodes
       */
      transform?: NodeTransform<NODE>;
    }
  : NODE extends Image
    ? {
        /**
         * Split rule
         * - 'never-split': Never split the node
         * - 'allow-split': Allow splitting the node
         * - 'size-split': Split the node if its content size exceeds a certain limit
         */
        split?: SplitRule<NODE>;
        /**
         * Normalize images
         * - 'inline': Convert reference-style images to inline images
         * - 'preserve': Keep original style
         * - undefined: Keep original style
         */
        style?: ImageStyle;
        /**
         * Transform function to modify or filter image nodes
         */
        transform?: NodeTransform<NODE>;
      }
    : {
        /**
         * Split rule
         * - 'never-split': Never split the node
         * - 'allow-split': Allow splitting the node
         * - 'size-split': Split the node if its content size exceeds a certain limit
         */
        split?: SplitRule<NODE>;
        /**
         * Transform function to modify or filter nodes
         */
        transform?: NodeTransform<NODE>;
      };

/**
 * Complex splitting rules
 */
export type ComplexSplitRules = {
  [K in keyof NodeTypes]?: ComplexSplitRule<NodeTypes[K] extends Nodes ? NodeTypes[K] : never>;
};

/**
 * Rule for splitting.
 * Can be a simple string or a complex object.
 */
export type SplitRule<NODE extends Nodes> = SimpleSplitRule | ComplexSplitRule<NODE>;

/**
 * Simple splitting rule.
 */
export type SimpleSplitRule = 'never-split' | 'allow-split';

/**
 * Complex splitting rule.
 */
export type ComplexSplitRule<NODE extends Nodes> = NeverSplitRule<NODE> | AllowSplitRule<NODE> | SizeSplitRule<NODE>;

/**
 * Never split a node.
 */
type NeverSplitRule<NODE extends Nodes> = NODE extends Table | List
  ? {
      rule: 'never-split';
    }
  : {
      rule: 'never-split';
    };

/**
 * Allow splitting a node.
 */
type AllowSplitRule<NODE extends Nodes> = NODE extends Table | List
  ? {
      rule: 'allow-split';
      // strategy?: SplitStrategy<NODE>;
    }
  : {
      rule: 'allow-split';
    };

/**
 * Split a node if its content size exceeds a certain limit.
 */
type SizeSplitRule<NODE extends Nodes> = NODE extends Table | List
  ? {
      rule: 'size-split';
      size: number;
      // strategy?: SplitStrategy<NODE>;
    }
  : {
      rule: 'size-split';
      size: number;
    };

// TODO: Implement these rules and strategies in future versions
// type CustomSplitRule<NODE extends Node> = {
//   rule: 'custom';
//   strategy: CustomSplitStrategyFn;
// };

/**
 * Split strategy - only defined for Table and List in v1
 */
// export type SplitStrategy<NODE extends Node> = NODE extends Table
//   ? TableSplitStrategy
//   : NODE extends List
//     ? ListSplitStrategy
//     : never;

/**
 * Strategies for table nodes
 */
// export type TableSplitStrategy = 'extend-table-header'; // Include header row in each chunk

/**
 * Strategies for list nodes
 */
// export type ListSplitStrategy = 'extend-list-metadata'; // Include list metadata (ordered, start)

// /**
//  * Strategies for formatting nodes (strong, emphasis, delete)
//  */
// export type FormattingSplitStrategy =
//   | 'extend-formatting' // Add opening/closing markers (**text** -> **tex** + **t**)
//   | 'remove-formatting' // Remove broken markers (**text** -> tex + t)
//   | CustomSplitStrategyFn;
//
// /**
//  * Strategies for links
//  */
// export type LinkSplitStrategy =
//   | 'extend-link' // Keep link construct intact
//   | 'remove-link' // Remove link construct
//   | CustomSplitStrategyFn;
//
// /**
//  * Strategies for images
//  */
// export type ImageSplitStrategy =
//   | 'extend-image' // Keep image construct intact
//   | 'remove-image' // Remove image construct
//   | CustomSplitStrategyFn;

// /**
//  * Custom strategy function
//  */
// export type CustomSplitStrategyFn = (
//   original: Node,
//   chunk: Node,
//   context: SplitContext,
// ) => Node;

// export type SplitContext = {
//   parent?: Node;
//   index: number;
//   total: number;
// };

/**
 * A breadcrumb representing an ancestor heading.
 */
export interface Breadcrumb {
  /**
   * The plain text content of the heading (without # markers)
   */
  text: string;
  /**
   * The depth of the heading (1-6)
   */
  depth: number;
}

/**
 * A place in the source text, in the convention of unist points.
 */
export interface ChunkPoint {
  /**
   * Line in the source text (1-based)
   */
  line: number;
  /**
   * Character offset in the source text (0-based, UTF-16 code units like
   * `String.prototype.slice`)
   */
  offset: number;
}

/**
 * The region of the source text that a chunk came from, in the convention of
 * unist positions: `start` is the first character of the region and `end` is
 * the place after the last character, so the region is
 * `text.slice(start.offset, end.offset)`. `end.line` is the line of
 * `end.offset`. A region never ends with whitespace, so this is also the line
 * of its last character.
 */
export interface ChunkPosition {
  start: ChunkPoint;
  end: ChunkPoint;
}

/**
 * The origin of a chunk in the text passed to `split()`.
 */
export interface ChunkSource {
  /**
   * The region of the source text that the chunk came from.
   *
   * The chunk text is written out again from the syntax tree, so it can differ
   * from the source region (escapes, list markers, inline links, a repeated
   * table header). The region covers the source nodes in the chunk; nodes
   * that chunkdown inserts (the repeated header row of a split table) do not
   * count.
   */
  position: ChunkPosition;
}

/**
 * A chunk of text with its breadcrumbs.
 */
export interface Chunk {
  /**
   * The text content of the chunk
   */
  text: string;
  /**
   * Ancestor headings for hierarchical context
   */
  breadcrumbs: Breadcrumb[];
  /**
   * Where the chunk came from in the text passed to `split()`.
   *
   * Undefined when the chunk has no text from the source: a chunk of nodes
   * that a transform creates, or a part of a cut chunk that contains only
   * text that chunkdown writes (for example the repeated header row of a
   * split table, or a code fence that chunkdown adds).
   */
  source?: ChunkSource;
}

/**
 * Result of splitting markdown text.
 */
export interface SplitterResult {
  /**
   * The chunks of text
   */
  chunks: Chunk[];
}
