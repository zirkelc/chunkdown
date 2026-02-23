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
 * Represents a range in the text with an associated penalty for splitting.
 * Protected ranges use `penalty: Infinity` to prevent splitting entirely.
 */
type PenalizedRange = {
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
    const ranges = this.extractPenalizedRanges(ast);
    /**
     * Build position mapping for plain text pattern matching.
     * This enables matching on clean text without markdown formatting pollution.
     */
    const mapping = buildPositionMapping(ast, markdown);
    const boundaries = this.extractSemanticBoundaries(mapping, ranges);

    const nodes: Nodes[] = [];

    for (const textChunk of this.splitRecursive(markdown, boundaries, ranges)) {
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
   * Extract penalized ranges from markdown AST nodes.
   * Uses mdast position information to identify constructs with split penalties.
   * Protected ranges (that should never be split) use `penalty: Infinity`.
   *
   * @param ast - Parsed mdast AST with position information
   * @returns Array of penalized ranges, merged and sorted by start position
   */
  protected extractPenalizedRanges(ast: Nodes): PenalizedRange[] {
    const ranges: PenalizedRange[] = [];

    /**
     * Recursively traverse AST nodes to find constructs with split penalties
     */
    const traverse = (node: Nodes): void => {
      /**
       * Only process nodes that have position information
       */
      if (
        node.position?.start?.offset === undefined ||
        node.position?.end?.offset === undefined
      ) {
        /**
         * Still traverse children even if this node lacks position info
         */
        if (`children` in node && Array.isArray(node.children)) {
          node.children.forEach(traverse);
        }
        return;
      }

      const start = node.position.start.offset;
      const end = node.position.end.offset;

      /**
       * Protected range (via rules) receive penalty: Infinity to exclude from splits.
       * Otherwise, apply penalties for markdown constructs based on type.
       * Using else-if ensures exactly one range per node (no duplicates).
       */
      if (!this.canSplitNode(node)) {
        ranges.push({ start, end, type: node.type, penalty: Infinity });
      } else {
        const penalty = MARKDOWN_PENALTIES[node.type];
        if (penalty !== undefined) {
          ranges.push({ start, end, type: node.type, penalty });
        }
      }

      /**
       * Recursively traverse children
       */
      if (`children` in node && Array.isArray(node.children)) {
        node.children.forEach(traverse);
      }
    };

    /**
     * Start traversal from the root
     */
    traverse(ast);

    /**
     * Merge overlapping ranges, using max penalty
     */
    if (ranges.length === 0) return [];

    const sorted = ranges.sort((a, b) => a.start - b.start);
    const merged: PenalizedRange[] = [];

    for (const range of sorted) {
      const last = merged[merged.length - 1];
      if (last && range.start < last.end) {
        /**
         * Overlapping range - extend and take max penalty
         */
        last.end = Math.max(last.end, range.end);
        last.penalty = Math.max(last.penalty, range.penalty);
        last.type = `${last.type}+${range.type}`;
      } else {
        /**
         * Non-overlapping range - add as new entry
         */
        merged.push({ ...range });
      }
    }

    return merged;
  }

  /**
   * Adjust penalized ranges for a substring operation.
   * When working with substrings, the ranges need to be recalculated.
   *
   * @param ranges - Original penalized ranges
   * @param substringStart - Start position of the substring in the original text
   * @param substringEnd - End position of the substring in the original text
   * @returns Adjusted penalized ranges for the substring
   */
  protected adjustRangesForSubstring(
    ranges: PenalizedRange[],
    substringStart: number,
    substringEnd: number,
  ): PenalizedRange[] {
    const adjustedRanges: PenalizedRange[] = [];

    for (const range of ranges) {
      /**
       * Only include ranges that intersect with the substring
       */
      if (range.end > substringStart && range.start < substringEnd) {
        /**
         * Adjust the range positions relative to the substring
         */
        const adjustedRange: PenalizedRange = {
          start: Math.max(0, range.start - substringStart),
          end: Math.min(
            substringEnd - substringStart,
            range.end - substringStart,
          ),
          type: range.type,
          penalty: range.penalty,
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
   * Score a boundary based on its weight and any penalized range penalties.
   * Returns weight minus the maximum penalty from overlapping ranges.
   * A score of -Infinity means the boundary is protected and should not be used.
   */
  protected scoreBoundary(
    position: number,
    weight: number,
    ranges: PenalizedRange[],
  ): number {
    let maxPenalty = 0;
    for (const range of ranges) {
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
   * Boundaries inside protected ranges (penalty: Infinity) are filtered out
   * via scoring — they receive score -Infinity and are excluded.
   *
   * @param mapping - Position mapping from plain text to markdown
   * @param ranges - Penalized ranges in markdown coordinates
   * @returns Array of boundaries in markdown coordinates, sorted by score descending
   */
  protected extractSemanticBoundaries(
    mapping: PositionMapping,
    ranges: PenalizedRange[],
  ): Boundary[] {
    const boundaries: Boundary[] = [];
    const { plain } = mapping;

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
         * Score the boundary — protected ranges yield -Infinity score
         */
        const score = this.scoreBoundary(mdPosition, pattern.weight, ranges);

        /**
         * Only add boundary if score is finite (not protected)
         */
        if (Number.isFinite(score)) {
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
      .map((b) => ({ ...b, mdPosition: b.mdPosition - substringStart }));
  }

  /**
   * Recursively split text using boundary scoring system.
   * Evaluates all boundaries with combined score (semantic + balance bonus),
   * selects the best one, then filters remaining boundaries by weight.
   *
   * @param text - The text to split
   * @param boundaries - Available boundaries sorted by score descending
   * @param ranges - Pre-computed penalized ranges from AST
   * @param originalOffset - Offset of this text in the original document
   * @returns Generator yielding text chunks
   */
  private *splitRecursive(
    text: string,
    boundaries: Boundary[],
    ranges: PenalizedRange[],
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
      const firstPartRanges = this.adjustRangesForSubstring(
        ranges,
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
      const secondPartRanges = this.adjustRangesForSubstring(
        ranges,
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
