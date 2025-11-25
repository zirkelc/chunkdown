import type { Nodes } from 'mdast';
import { fromMarkdown, toMarkdown } from '../markdown';
import { getContentSize } from '../size';
import type { SplitterOptions } from '../types';
import { AbstractNodeSplitter } from './base';

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
 * Text boundary with position, type, and priority information
 */
type Boundary = {
  position: number;
  type: string;
  priority: number;
};

/**
 * Text pattern with regex for semantic boundaries
 */
type Pattern = {
  regex: RegExp;
  type: string;
  priority: number;
};

export class TextSplitter extends AbstractNodeSplitter {
  private patterns: Array<Pattern>;

  constructor(options: SplitterOptions) {
    super(options);

    let priority = 0;
    this.patterns = [
      // Period followed by newline (very strong sentence boundary)
      // Example: "First sentence.\nSecond sentence." → splits after period
      {
        regex: /\.(?=\n)/g,
        type: 'period_before_newline',
        priority: priority++,
      },
      // Period followed by whitespace and uppercase letter (strong sentence boundary)
      // Example: "Hello world. The sun is shining" → splits after "world."
      // Excludes list items like "1. Item", "a. Item", "i. Item" with negative lookbehind
      {
        regex: /(?<!^\s*(?:\d+|[a-zA-Z]+|[ivxlcdmIVXLCDM]+))\.\s+(?=[A-Z])/g,
        type: 'period_before_uppercase',
        priority: priority++,
      },

      // Question marks or exclamation marks followed by space or end of string
      // Example: "Really? Yes!" → splits after "?" and "!"
      {
        regex: /[?!]+(?=\s|$)/g,
        type: 'question_exclamation',
        priority: priority++,
      },

      // Period NOT followed by lowercase, another period, or digit (avoids abbreviations)
      // Example: "End." but NOT "e.g. example" or "U.S.A." or "3.14"
      // Excludes list items like "1. Item", "a. Item", "i. Item" with negative lookbehind
      {
        regex:
          /(?<!^\s*(?:\d+|[a-zA-Z]+|[ivxlcdmIVXLCDM]+))\.(?!\s*[a-z])(?!\s*\.)(?!\s*\d)/g,
        type: 'period_safe',
        priority: priority++,
      },

      // Colon or semicolon followed by space (major clause separators)
      // Example: "Note: this is important; very important" → splits after ":" and ";"
      { regex: /[:;](?=\s)/g, type: 'colon_semicolon', priority: priority++ },

      // Complete bracket pairs (parentheses, square brackets, curly braces)
      // Example: "Hello (world) there" → splits after ")" regardless of what follows
      {
        regex: /\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g,
        type: 'bracket_pairs',
        priority: priority++,
      },

      // Complete quote pairs (various quote styles)
      // Example: 'He said "hello".' → splits after closing quote regardless of what follows
      {
        regex: /"[^"]*"|'[^']*'|`[^`]*`|´[^´]*´|'[^']*'|'[^']*'/g,
        type: 'quote_pairs',
        priority: priority++,
      },

      // Single linebreak (line boundaries within paragraphs)
      // Example: "First line\nSecond line" → splits at linebreak
      { regex: /\n/g, type: 'line_break', priority: priority++ },

      // Comma followed by space (minor clause separator)
      // Example: "apples, oranges, bananas" → splits after each comma
      { regex: /,(?=\s)/g, type: 'comma', priority: priority++ },

      // Em dash, en dash, or hyphen surrounded by spaces
      // Example: "Paris – the city of lights – is beautiful" → splits at dashes
      { regex: /\s[–—-]\s/g, type: 'dashes', priority: priority++ },

      // Ellipsis (three or more consecutive periods)
      // Example: "Wait... what happened..." → splits at "..."
      { regex: /\.{3,}/g, type: 'ellipsis', priority: priority++ },

      // ANY period as fallback (catches edge cases, but may split abbreviations)
      // Example: "etc." or "End" → splits at period (use with caution)
      { regex: /\./g, type: 'period_fallback', priority: priority++ },

      // One or more whitespace characters (lowest priority word separator)
      // Example: "hello   world" → splits between words at spaces
      { regex: /\s+/g, type: 'whitespace', priority: priority++ },
    ];
  }

  splitText(text: string): string[] {
    const ast = fromMarkdown(text);
    const chunks = this.splitNode(ast);
    return chunks
      .map((chunk) => toMarkdown(chunk).trim())
      .filter((chunk) => chunk.length > 0);
  }

  splitNode(node: Nodes): Nodes[] {
    const text = toMarkdown(node);
    // Parse the markdown text to get correct position offsets for this text
    // the original node has offsets relative to its source document, not to this text
    const ast = fromMarkdown(text);
    const protectedRanges = this.extractProtectedRangesFromAST(ast);
    const boundaries = this.extractSemanticBoundaries(text, protectedRanges);

    const nodes: Nodes[] = [];

    for (const textChunk of this.splitRecursive(
      text,
      boundaries,
      protectedRanges,
    )) {
      nodes.push(fromMarkdown(textChunk));
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
        !node.position?.start?.offset ||
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
   * Find all semantic boundaries with text-based pattern matching
   * Since structural boundaries are handled by hierarchical AST processing,
   * this function only identifies semantic text boundaries for fine-grained splitting
   *
   * @param text - The text to analyze
   * @param protectedRanges - Ranges that should not be split
   * @returns Array of boundaries sorted by priority (desc), then position (asc)
   */
  protected extractSemanticBoundaries(
    text: string,
    protectedRanges: ProtectedRange[],
  ): Boundary[] {
    const boundaries: Boundary[] = [];

    /**
     * Find all semantic boundaries for each pattern
     */
    for (const pattern of this.patterns) {
      /**
       * Reset lastIndex to ensure the regex starts from the beginning
       * This is important because the regex objects are reused across calls
       */
      pattern.regex.lastIndex = 0;

      let match: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: regex.exec assignment in while condition
      while ((match = pattern.regex.exec(text)) !== null) {
        const position = match.index + match[0].length;

        /**
         * Check if boundary is within a protected range using binary search
         */
        const isProtected = this.isPositionProtected(position, protectedRanges);

        /**
         * Only add boundary if not protected
         */
        if (!isProtected) {
          boundaries.push({
            position,
            type: pattern.type,
            priority: pattern.priority,
          });
        }
      }
    }

    /**
     * Sort by priority (ascending), then by position (ascending)
     * This gives us the highest priority boundaries first, in positional order
     */
    return boundaries.sort((a, b) =>
      a.priority !== b.priority
        ? a.priority - b.priority
        : a.position - b.position,
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
      .filter((b) => b.position > substringStart && b.position <= substringEnd)
      .map((b) => ({ ...b, position: b.position - substringStart }));
  }

  /**
   * Recursively split text using boundary priority hierarchy
   * Iterates through distinct priority levels (each semantic boundary type has unique priority)
   * Each recursive call uses only boundaries with lower or equal priority than current level
   *
   * @param text - The text to split
   * @param boundaries - Available boundaries sorted by priority desc, position asc
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

    for (const boundary of boundaries) {
      /**
       * Get all boundaries at this priority level (should be same type)
       */
      const currentBoundaries = boundaries.filter(
        (b) => b.priority === boundary.priority,
      );

      /**
       * Get positions within current text bounds (exclude start and end positions)
       */
      const validPositions = currentBoundaries
        .map((b) => b.position)
        .filter((pos) => pos > 0 && pos < text.length)
        .sort((a, b) => a - b);

      if (validPositions.length === 0) continue;

      /**
       * Generalized boundary selection strategy:
       * Length=1 => [0], Length=2 => [0,1], Length=3 => [1], Length=4 => [1,2], etc.
       */
      const mid = Math.floor(validPositions.length / 2);
      const middlePositions =
        validPositions.length % 2 === 1
          ? [mid] // Odd length: try exact middle
          : [mid - 1, mid]; // Even length: try both middle positions

      /**
       * Evaluate all middle position candidates to find the best one
       */
      const positionCandidates = middlePositions
        .map((index) => {
          const position = validPositions[index];
          const firstPart = text.substring(0, position);
          const secondPart = text.substring(position);
          const firstPartSize = getContentSize(firstPart);
          const secondPartSize = getContentSize(secondPart);
          const bothWithinLimits =
            firstPartSize <= this.maxAllowedSize &&
            secondPartSize <= this.maxAllowedSize;
          const distance = Math.abs(firstPartSize - secondPartSize);

          return {
            position,
            firstPart,
            secondPart,
            firstPartSize,
            secondPartSize,
            bothWithinLimits,
            distance,
          };
        })
        .sort((a, b) => {
          /**
           * Primary: bothWithinLimits
           */
          if (a.bothWithinLimits && !b.bothWithinLimits) return -1;
          if (!a.bothWithinLimits && b.bothWithinLimits) return 1;

          /**
           * Secondary: distance (smaller is better)
           */
          return a.distance - b.distance;
        });

      /**
       * Pick the best candidate from the position candidates
       */
      const { position, firstPart, secondPart, firstPartSize, secondPartSize } =
        positionCandidates[0];

      /**
       * Calculate actual positions for boundary adjustments
       */
      const firstPartActualStart = 0;
      const firstPartActualEnd = position;
      const secondPartActualStart = position;
      const secondPartActualEnd = text.length;

      /**
       * Priority is ascending, so lower or equal priority boundaries for next level
       */
      const lowerPriorityBoundaries = boundaries.filter(
        (b) => b.priority >= boundary.priority,
      );

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
          lowerPriorityBoundaries,
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
          lowerPriorityBoundaries,
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

      /**
       * Return after yielding chunks from this valid split
       */
      return;
    }

    /**
     * Yield text as single chunk
     */
    yield text;
  }
}
