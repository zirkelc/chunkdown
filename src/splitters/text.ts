import type { Nodes, Root } from 'mdast';
import { fromMarkdown, toMarkdown } from '../markdown';
import { getContentSize } from '../size';
import {
  buildPositionMapping,
  type PositionMapping,
  plainToMarkdownPosition,
} from '../utils/plaintext-markdown-mapping';
import { AbstractNodeSplitter } from './base';

/**
 * Semantic weights for different boundary types.
 * Higher weight = stronger boundary = preferred split point.
 */
const SEMANTIC_WEIGHTS = {
  SENTENCE: 100,
  CLAUSE: 70,
  COMMA: 40,
  DASH: 30,
  FALLBACK: 10,
} as const;

/**
 * Penalties applied when a boundary falls inside a markdown element.
 * Higher penalty = less desirable split point.
 */
const MARKDOWN_PENALTIES: Record<string, number> = {
  link: 50,
  linkReference: 50,
  image: 50,
  imageReference: 50,
  inlineCode: 50,
  emphasis: 30,
  strong: 30,
  delete: 30,
};

/**
 * Represents a protected range in the text that should not be split
 * Contains the start and end positions and the type of the protected content
 */
type ProtectedRange = {
  start: number;
  end: number;
  type: string;
};

/**
 * Represents a markdown element range with associated penalty
 */
type MarkdownElementRange = {
  start: number;
  end: number;
  type: string;
  penalty: number;
};

/**
 * Text boundary with position, type, weight and score information
 */
type Boundary = {
  mdPosition: number;
  plainPosition: number;
  type: string;
  weight: number;
  score: number;
};

/**
 * Text pattern with regex for semantic boundaries
 */
type Pattern = {
  regex: RegExp;
  type: string;
  weight: number;
};

/**
 * Static patterns for semantic boundary detection.
 * Patterns are matched against plain text (without markdown formatting).
 */
const PATTERNS: Array<Pattern> = [
  /**
   * Period followed by newline (strong sentence boundary)
   * Example: "First sentence.\nSecond sentence." → splits after period
   */
  {
    regex: /\.(?=\n)/g,
    type: `period_newline`,
    weight: SEMANTIC_WEIGHTS.SENTENCE,
  },
  /**
   * Period/question/exclamation followed by whitespace+uppercase (sentence boundary)
   * Example: "Hello world. The sun is shining" → splits after "world."
   * Excludes list items like "1. Item", "a. Item", "i. Item" with negative lookbehind
   */
  {
    regex: /(?<!^\s*(?:\d+|[a-zA-Z]+|[ivxlcdmIVXLCDM]+))[.?!]+\s+(?=[A-Z])/g,
    type: `period_sentence`,
    weight: SEMANTIC_WEIGHTS.SENTENCE,
  },
  /**
   * Question marks or exclamation marks followed by space or end of string
   * Example: "Really? Yes!" → splits after "?" and "!"
   */
  {
    regex: /[?!]+(?=\s|$)/g,
    type: `question_exclamation`,
    weight: SEMANTIC_WEIGHTS.SENTENCE,
  },
  /**
   * Colon or semicolon followed by space (major clause separators)
   * Example: "Note: this is important; very important" → splits after ":" and ";"
   */
  {
    regex: /[:;](?=\s)/g,
    type: `colon_semicolon`,
    weight: SEMANTIC_WEIGHTS.CLAUSE,
  },
  /**
   * Complete bracket pairs (parentheses, square brackets, curly braces)
   * Include optional trailing sentence-ending punctuation to prevent orphaning
   * Example: "Hello (world). There" → splits after "." not after ")"
   */
  {
    regex: /\([^)]*\)[.?!]?|\[[^\]]*\][.?!]?|\{[^}]*\}[.?!]?/g,
    type: `bracket_pairs`,
    weight: SEMANTIC_WEIGHTS.CLAUSE,
  },
  /**
   * Complete quote pairs (various quote styles)
   * Example: 'He said "hello".' → splits after closing quote
   */
  {
    regex: /"[^"]*"|'[^']*'|`[^`]*`|´[^´]*´|'[^']*'|'[^']*'/g,
    type: `quote_pairs`,
    weight: SEMANTIC_WEIGHTS.CLAUSE,
  },
  /**
   * Single linebreak (line boundaries within paragraphs)
   * Example: "First line\nSecond line" → splits at linebreak
   */
  { regex: /\n/g, type: `line_break`, weight: SEMANTIC_WEIGHTS.CLAUSE },
  /**
   * Comma followed by space (minor clause separator)
   * Example: "apples, oranges, bananas" → splits after each comma
   */
  { regex: /,(?=\s)/g, type: `comma`, weight: SEMANTIC_WEIGHTS.COMMA },
  /**
   * Em dash, en dash, or hyphen surrounded by spaces
   * Example: "Paris – the city of lights – is beautiful" → splits at dashes
   */
  { regex: /\s[–—-]\s/g, type: `dashes`, weight: SEMANTIC_WEIGHTS.DASH },
  /**
   * ANY period as fallback (catches edge cases, but may split abbreviations)
   * Example: "etc." or "End" → splits at period (use with caution)
   */
  { regex: /\./g, type: `period_fallback`, weight: SEMANTIC_WEIGHTS.FALLBACK },
  /**
   * One or more whitespace characters (lowest priority word separator)
   * Example: "hello   world" → splits between words at spaces
   */
  { regex: /\s+/g, type: `whitespace`, weight: SEMANTIC_WEIGHTS.FALLBACK },
];

export class TextSplitter extends AbstractNodeSplitter {
  splitText(text: string): string[] {
    const ast = fromMarkdown(text);
    const chunks = this.splitNode(ast);
    return chunks
      .map((chunk) => toMarkdown(chunk).trim())
      .filter((chunk) => chunk.length > 0);
  }

  splitNode(node: Nodes): Nodes[] {
    const markdown = toMarkdown(node);
    /**
     * Parse the markdown text to get correct position offsets for this text.
     * The original node has offsets relative to its source document, not to this text.
     */
    const ast = fromMarkdown(markdown);
    const protectedRanges = this.extractProtectedRangesFromAST(ast);
    /**
     * Build position mapping for plain text pattern matching.
     * This enables matching on clean text without markdown formatting pollution.
     */
    const mapping = buildPositionMapping(ast, markdown);
    const boundaries = this.extractSemanticBoundaries(mapping, protectedRanges);

    const nodes: Nodes[] = [];

    for (const textChunk of this.splitRecursive(
      markdown,
      boundaries,
      protectedRanges,
    )) {
      // HACK: We use 'html' node type to preserve the markdown text as-is.
      // The chunks are already valid markdown (from toMarkdown above), so we need
      // a node type that passes through unchanged during serialization. The 'html'
      // type does exactly this - it outputs its value verbatim without escaping.
      //
      // Why not 'text' node? A 'text' node would escape markdown characters again
      // (e.g., '\[' becomes '\\['), causing double-escaping issues.
      //
      // TODO: Refactor to avoid the toMarkdown/fromMarkdown roundtrip entirely.
      // Instead of converting to markdown text, splitting, and converting back,
      // we should work with raw text content directly (e.g., using mdast-util-to-string)
      // and return proper 'text' nodes. This would require rethinking how protected
      // ranges and boundaries are calculated to work with plain text offsets rather
      // than markdown text offsets.
      const root: Root = {
        type: 'root',
        children: [{ type: 'html', value: textChunk }],
      };
      nodes.push(root);
    }

    return nodes;
  }

  /**
   * Extract protected ranges from markdown AST nodes
   * Uses mdast position information to identify constructs that should never be split
   *
   * @param ast - Parsed mdast AST with position information
   * @returns Array of protected ranges that must stay together
   */
  protected extractProtectedRangesFromAST(ast: Nodes): ProtectedRange[] {
    const ranges: ProtectedRange[] = [];

    /**
     * Recursively traverse AST nodes to find inline constructs that need protection
     */
    const traverse = (node: Nodes): void => {
      /**
       * Only protect nodes that have position information
       */
      if (
        node.position?.start?.offset === undefined ||
        node.position?.end?.offset === undefined
      ) {
        /**
         * Still traverse children even if this node lacks position info
         */
        if ('children' in node && Array.isArray(node.children)) {
          node.children.forEach(traverse);
        }
        return;
      }

      const start = node.position.start.offset;
      const end = node.position.end.offset;

      /**
       * Protect inline markdown constructs that should never be split
       */
      switch (node.type) {
        case 'link':
        case 'linkReference':
        case 'image':
        case 'imageReference':
        case 'inlineCode':
        case 'emphasis':
        case 'strong':
        case 'delete':
        case 'heading':
          if (!this.canSplitNode(node)) {
            ranges.push({ start, end, type: node.type });
          }
          break;
      }

      /**
       * Recursively traverse children
       */
      if ('children' in node && Array.isArray(node.children)) {
        node.children.forEach(traverse);
      }
    };

    // Start traversal from the root
    traverse(ast);

    /**
     * Sort by start position and merge only truly overlapping ranges
     */
    const sortedRanges = ranges.sort((a, b) => a.start - b.start);
    const mergedRanges: ProtectedRange[] = [];

    for (const range of sortedRanges) {
      const lastMerged = mergedRanges[mergedRanges.length - 1];

      if (lastMerged && range.start < lastMerged.end) {
        /**
         * Only merge truly overlapping ranges (not adjacent ones)
         */
        lastMerged.end = Math.max(lastMerged.end, range.end);
        lastMerged.type = `${lastMerged.type}+${range.type}`;
      } else {
        /**
         * Non-overlapping range - add it as separate range
         */
        mergedRanges.push(range);
      }
    }

    return mergedRanges;
  }

  /**
   * Adjust protected ranges for a substring operation
   * When working with substrings, the protected ranges need to be recalculated
   *
   * @param protectedRanges - Original protected ranges
   * @param substringStart - Start position of the substring in the original text
   * @param substringEnd - End position of the substring in the original text
   * @returns Adjusted protected ranges for the substring
   */
  protected adjustProtectedRangesForSubstring(
    protectedRanges: ProtectedRange[],
    substringStart: number,
    substringEnd: number,
  ): ProtectedRange[] {
    const adjustedRanges: ProtectedRange[] = [];

    for (const range of protectedRanges) {
      /**
       * Only include ranges that intersect with the substring
       */
      if (range.end > substringStart && range.start < substringEnd) {
        /**
         * Adjust the range positions relative to the substring
         */
        const adjustedRange = {
          start: Math.max(0, range.start - substringStart),
          end: Math.min(
            substringEnd - substringStart,
            range.end - substringStart,
          ),
          type: range.type,
        };

        /**
         * Only include valid ranges (where start < end)
         */
        if (adjustedRange.start < adjustedRange.end) {
          adjustedRanges.push(adjustedRange);
        }
      }
    }

    return adjustedRanges;
  }

  /**
   * Extract markdown element ranges with associated penalties for scoring.
   * These ranges influence boundary scores - splitting inside formatting is penalized.
   */
  protected extractMarkdownElementRanges(ast: Nodes): MarkdownElementRange[] {
    const ranges: MarkdownElementRange[] = [];

    const traverse = (node: Nodes): void => {
      if (
        node.position?.start?.offset === undefined ||
        node.position?.end?.offset === undefined
      ) {
        if (`children` in node && Array.isArray(node.children)) {
          node.children.forEach(traverse);
        }
        return;
      }

      const penalty = MARKDOWN_PENALTIES[node.type];
      if (penalty !== undefined) {
        ranges.push({
          start: node.position.start.offset,
          end: node.position.end.offset,
          type: node.type,
          penalty,
        });
      }

      if (`children` in node && Array.isArray(node.children)) {
        node.children.forEach(traverse);
      }
    };

    traverse(ast);
    return ranges.sort((a, b) => a.start - b.start);
  }

  /**
   * Score a boundary based on its weight and any markdown element penalties.
   * Returns weight minus the maximum penalty from overlapping elements.
   */
  protected scoreBoundary(
    position: number,
    weight: number,
    elementRanges: MarkdownElementRange[],
  ): number {
    let maxPenalty = 0;
    for (const range of elementRanges) {
      if (position > range.start && position < range.end) {
        maxPenalty = Math.max(maxPenalty, range.penalty);
      }
    }
    return weight - maxPenalty;
  }

  /**
   * Calculate a balance bonus (0-20) based on how evenly a split divides the text.
   * Perfectly balanced splits get maximum bonus.
   */
  protected calculateBalanceBonus(
    firstSize: number,
    secondSize: number,
  ): number {
    const total = firstSize + secondSize;
    if (total === 0) return 0;
    const ratio = Math.min(firstSize, secondSize) / total;
    return Math.round(ratio * 40);
  }

  /**
   * Find all semantic boundaries using plain text pattern matching.
   * Patterns are matched against the plain text (without markdown formatting),
   * then positions are mapped back to markdown coordinates.
   *
   * This approach avoids formatting characters (`**`, `[](...)`) from polluting
   * natural language boundary detection.
   *
   * @param mapping - Position mapping from plain text to markdown
   * @param protectedRanges - Ranges in markdown coordinates that should not be split
   * @returns Array of boundaries in markdown coordinates, sorted by score descending
   */
  protected extractSemanticBoundaries(
    mapping: PositionMapping,
    protectedRanges: ProtectedRange[],
  ): Boundary[] {
    const boundaries: Boundary[] = [];
    const { plain } = mapping;

    /**
     * Extract markdown element ranges for scoring
     */
    const ast = fromMarkdown(mapping.markdown);
    const elementRanges = this.extractMarkdownElementRanges(ast);

    /**
     * Find all semantic boundaries for each pattern on plain text
     */
    for (const pattern of PATTERNS) {
      /**
       * Reset lastIndex to ensure the regex starts from the beginning.
       * This is important because the regex objects are reused across calls.
       */
      pattern.regex.lastIndex = 0;

      let match: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: regex.exec assignment in while condition
      while ((match = pattern.regex.exec(plain)) !== null) {
        /**
         * Position in plain text (after the match)
         */
        const plainPosition = match.index + match[0].length;

        /**
         * Map the plain text position to markdown position
         */
        const mdPosition = plainToMarkdownPosition(plainPosition, mapping);

        /**
         * Check if the markdown position is within a protected range
         */
        const isProtected = this.isPositionProtected(
          mdPosition,
          protectedRanges,
        );

        /**
         * Only add boundary if not protected
         */
        if (!isProtected) {
          const score = this.scoreBoundary(
            mdPosition,
            pattern.weight,
            elementRanges,
          );
          boundaries.push({
            mdPosition: mdPosition,
            plainPosition,
            type: pattern.type,
            weight: pattern.weight,
            score,
          });
        }
      }
    }

    /**
     * Sort by score (descending), then by position (ascending).
     * Higher scores are preferred split points.
     */
    return boundaries.sort((a, b) =>
      a.score !== b.score ? b.score - a.score : a.mdPosition - b.mdPosition,
    );
  }

  /**
   * Check if a position falls within any protected range using binary search
   * Protected ranges are sorted by start position, so we can use binary search
   *
   * @param position - Position to check
   * @param protectedRanges - Sorted array of protected ranges
   * @returns True if position is within any protected range
   */
  private isPositionProtected(
    position: number,
    protectedRanges: ProtectedRange[],
  ): boolean {
    /**
     * For small arrays, linear search is faster
     */
    if (protectedRanges.length < 10) {
      return protectedRanges.some(
        (range) => position > range.start && position < range.end,
      );
    }

    /**
     * Binary search for larger arrays
     */
    let left = 0;
    let right = protectedRanges.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const range = protectedRanges[mid];

      if (position > range.start && position < range.end) {
        return true;
      }

      if (position <= range.start) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    return false;
  }

  /**
   * Adjust boundary positions for a substring operation
   * @param boundaries - Original boundaries
   * @param substringStart - Start position of substring in original text
   * @param substringEnd - End position of substring in original text
   * @returns Boundaries adjusted for the substring
   */
  protected adjustBoundariesForSubstring(
    boundaries: Boundary[],
    substringStart: number,
    substringEnd: number,
  ): Boundary[] {
    return boundaries
      .filter(
        (b) => b.mdPosition > substringStart && b.mdPosition <= substringEnd,
      )
      .map((b) => ({ ...b, position: b.mdPosition - substringStart }));
  }

  /**
   * Recursively split text using boundary scoring system.
   * Evaluates all boundaries with combined score (semantic + balance bonus),
   * selects the best one, then filters remaining boundaries by weight.
   *
   * @param text - The text to split
   * @param boundaries - Available boundaries sorted by score descending
   * @param protectedRanges - Pre-computed protected ranges from AST
   * @param originalOffset - Offset of this text in the original document
   * @returns Generator yielding text chunks
   */
  private *splitRecursive(
    text: string,
    boundaries: Boundary[],
    protectedRanges: ProtectedRange[],
    originalOffset: number = 0,
  ): Generator<string> {
    const textSize = getContentSize(text);

    /**
     * Text fits within limits
     */
    if (textSize <= this.maxAllowedSize) {
      yield text;
      return;
    }

    /**
     * If no boundaries available, yield as single chunk (protected)
     */
    if (boundaries.length === 0) {
      yield text;
      return;
    }

    /**
     * Get valid boundaries within current text bounds
     */
    const validBoundaries = boundaries.filter(
      (b) => b.mdPosition > 0 && b.mdPosition < text.length,
    );

    if (validBoundaries.length === 0) {
      yield text;
      return;
    }

    /**
     * Evaluate all boundaries with combined score including balance bonus
     */
    const scoredBoundaries = validBoundaries
      .map((b) => {
        const firstPart = text.substring(0, b.mdPosition);
        const secondPart = text.substring(b.mdPosition);
        const firstPartSize = getContentSize(firstPart);
        const secondPartSize = getContentSize(secondPart);
        const balanceBonus = this.calculateBalanceBonus(
          firstPartSize,
          secondPartSize,
        );
        const combinedScore = b.score + balanceBonus;
        const bothWithinLimits =
          firstPartSize <= this.maxAllowedSize &&
          secondPartSize <= this.maxAllowedSize;

        return {
          boundary: b,
          position: b.mdPosition,
          firstPart,
          secondPart,
          firstPartSize,
          secondPartSize,
          combinedScore,
          bothWithinLimits,
        };
      })
      .sort((a, b) => b.combinedScore - a.combinedScore);

    /**
     * Select the best boundary
     */
    const selected = scoredBoundaries[0];
    const {
      boundary,
      position,
      firstPart,
      secondPart,
      firstPartSize,
      secondPartSize,
    } = selected;

    /**
     * Filter remaining boundaries to only those with weight <= selected weight
     * This prevents using weaker boundaries in recursive calls
     */
    const lowerWeightBoundaries = boundaries.filter(
      (b) => b.weight <= boundary.weight,
    );

    /**
     * Calculate actual positions for boundary adjustments
     */
    const firstPartActualStart = 0;
    const firstPartActualEnd = position;
    const secondPartActualStart = position;
    const secondPartActualEnd = text.length;

    /**
     * Recursively process first part if needed
     */
    if (firstPartSize <= this.maxAllowedSize) {
      yield firstPart;
    } else {
      const firstPartRanges = this.adjustProtectedRangesForSubstring(
        protectedRanges,
        originalOffset,
        originalOffset + position,
      );
      const firstPartBoundaries = this.adjustBoundariesForSubstring(
        lowerWeightBoundaries,
        firstPartActualStart,
        firstPartActualEnd,
      );
      yield* this.splitRecursive(
        firstPart,
        firstPartBoundaries,
        firstPartRanges,
        originalOffset,
      );
    }

    /**
     * Recursively process second part if needed
     */
    if (secondPartSize <= this.maxAllowedSize) {
      yield secondPart;
    } else {
      const secondPartRanges = this.adjustProtectedRangesForSubstring(
        protectedRanges,
        originalOffset + position,
        originalOffset + text.length,
      );
      const secondPartBoundaries = this.adjustBoundariesForSubstring(
        lowerWeightBoundaries,
        secondPartActualStart,
        secondPartActualEnd,
      );
      yield* this.splitRecursive(
        secondPart,
        secondPartBoundaries,
        secondPartRanges,
        originalOffset + secondPartActualStart,
      );
    }
  }
}
