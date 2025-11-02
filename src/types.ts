import type {
  Blockquote,
  Delete,
  Emphasis,
  Image,
  Link,
  List,
  Node,
  Nodes,
  Strong,
  Table,
} from 'mdast';

type Formatting = Strong | Emphasis | Delete;

type NodeRuleMap = {
  link: Link;
  image: Image;
  strong: Strong;
  emphasis: Emphasis;
  delete: Delete;
  formatting: Formatting;
  list: List;
  table: Table;
  blockquote: Blockquote;
};

/**
 * Node-specific splitting rules configuration
 */
// export type NodeRules = {
//   // // TODO: Implement strategies for link, image, and formatting nodes
//   // link?: NodeRule<Link>;
//   // image?: NodeRule<Image>;
//   // strong?: NodeRule<Strong>;
//   // emphasis?: NodeRule<Emphasis>;
//   // delete?: NodeRule<Delete>;
//   // formatting?: NodeRule<Formatting>;

//   // // Supported in v1
//   // list?: NodeRule<List>;
//   // table?: NodeRule<Table>;
// };

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
   */
  maxOverflowRatio: number;
  /**
   * Optional maximum raw markdown length (characters) for embedding model compatibility.
   * If set, chunks will be further split when their raw markdown exceeds this limit.
   * Useful for embedding models with character limits (e.g., 7000 for OpenAI text-embedding-3-large).
   * If undefined, defaults to chunkSize * maxOverflowRatio * 4 for reasonable safety.
   */
  maxRawSize?: number;

  rules?: Partial<NodeRules>;
};

export type NodeRules = {
  [K in keyof NodeRuleMap]?: NodeRule<
    NodeRuleMap[K] extends Nodes ? NodeRuleMap[K] : never
  >;
};

/**
 * Per-node splitting rule - generic for all node types
 */
export type NodeRule<NODE extends Nodes> = {
  split?: SplitRule<NODE>;
};

export type ComplexSplitRules = {
  [K in keyof NodeRuleMap]?: ComplexSplitRule<
    NodeRuleMap[K] extends Nodes ? NodeRuleMap[K] : never
  >;
};

// export type ComplexSplitRules = {
//   [K in keyof NodeRules]?: NonNullable<NodeRules[K]> extends NodeRule<
//     infer N extends Node
//   >
//     ? ComplexSplitRule<N>
//     : never;
// };

/**
 * Splitting rule - can be simple string or complex object
 */
export type SplitRule<NODE extends Nodes> =
  | SimpleSplitRule
  | ComplexSplitRule<NODE>;

/**
 * Simple splitting rules (shorthand)
 */
export type SimpleSplitRule = 'never-split' | 'allow-split';

/**
 * Complex splitting rules - conditional based on node type
 * Only Table and List nodes support strategies in v1
 */
export type ComplexSplitRule<NODE extends Nodes> =
  | NeverSplitRule<NODE>
  | AllowSplitRule<NODE>
  | SizeSplitRule<NODE>;

type NeverSplitRule<NODE extends Nodes> = NODE extends Table | List
  ? {
      rule: 'never-split';
    }
  : {
      rule: 'never-split';
    };

type AllowSplitRule<NODE extends Nodes> = NODE extends Table | List
  ? {
      rule: 'allow-split';
      // strategy?: SplitStrategy<NODE>;
    }
  : {
      rule: 'allow-split';
    };

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

// TODO: Implement these strategies in future versions
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
 * Default rules
 */
export const defaultNodeRules: NodeRules = {
  link: { split: 'never-split' },
  image: { split: 'never-split' },
  table: {
    split: {
      rule: 'allow-split',
      // strategy: 'extend-table-header',
    },
  },
  list: {
    split: {
      rule: 'allow-split',
      // strategy: 'extend-list-metadata',
    },
  },
};
