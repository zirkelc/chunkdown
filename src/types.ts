import type {
  Blockquote,
  Delete,
  Emphasis,
  Image,
  Link,
  List,
  Nodes,
  Parent,
  Root,
  Strong,
  Table,
} from 'mdast';

type Formatting = Strong | Emphasis | Delete;

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

  /**
   * Optional rules for splitting nodes.
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
export type NodeTransform<NODE extends Nodes> = (
  node: NODE,
  context: TransformContext,
) => NODE | null | undefined;

/**
 * Node-specific rules
 */
export type NodeRules = {
  [K in keyof NodeRuleMap]?: NodeRule<
    NodeRuleMap[K] extends Nodes ? NodeRuleMap[K] : never
  >;
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
  [K in keyof NodeRuleMap]?: ComplexSplitRule<
    NodeRuleMap[K] extends Nodes ? NodeRuleMap[K] : never
  >;
};

/**
 * Rule for splitting.
 * Can be a simple string or a complex object.
 */
export type SplitRule<NODE extends Nodes> =
  | SimpleSplitRule
  | ComplexSplitRule<NODE>;

/**
 * Simple splitting rule.
 */
export type SimpleSplitRule = 'never-split' | 'allow-split';

/**
 * Complex splitting rule.
 */
export type ComplexSplitRule<NODE extends Nodes> =
  | NeverSplitRule<NODE>
  | AllowSplitRule<NODE>
  | SizeSplitRule<NODE>;

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
