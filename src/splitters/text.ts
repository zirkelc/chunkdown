import type { Code, Image, InlineCode, Nodes, Root, Text } from 'mdast';
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
 * Represents a segment mapping plain text positions to markdown positions
 */
type PositionSegment = {
  /** Start position in plain text (inclusive) */
  plainStart: number;
  /** End position in plain text (exclusive) */
  plainEnd: number;
  /** Start position in markdown (inclusive) */
  mdStart: number;
  /** End position in markdown (exclusive) */
  mdEnd: number;
  /**
   * Character-level offset map for segments with escape sequences.
   * Maps plain text offset (within segment) to markdown offset (within segment).
   * Only present when markdown length differs from plain text length.
   * charMap[i] gives the markdown offset for plain text offset i.
   */
  charMap?: Array<number>;
};

/**
 * Mapping between plain text and markdown with position segments
 */
type PositionMapping = {
  /** Extracted plain text content */
  plainText: string;
  /** Original markdown text */
  markdown: string;
  /** Segments mapping plain text positions to markdown positions */
  segments: Array<PositionSegment>;
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

/**
 * Build a position mapping from AST to enable pattern matching on plain text
 * while preserving the ability to map back to markdown positions.
 *
 * Walks the AST depth-first and extracts text content from:
 * - `text` nodes: direct value mapping
 * - `inlineCode` nodes: value without backticks
 * - `image` nodes: alt text
 */
function buildPositionMapping(ast: Nodes, markdown: string): PositionMapping {
  const segments: Array<PositionSegment> = [];
  const plainTextParts: Array<string> = [];
  let plainOffset = 0;

  const traverse = (node: Nodes): void => {
    /**
     * Skip nodes without position information
     */
    if (
      node.position?.start?.offset === undefined ||
      node.position?.end?.offset === undefined
    ) {
      if (`children` in node && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child);
        }
      }
      return;
    }

    switch (node.type) {
      case `text`: {
        const textNode = node as Text;
        const text = textNode.value;
        const mdStart = node.position.start.offset;
        const mdEnd = node.position.end.offset;
        const mdSlice = markdown.slice(mdStart, mdEnd);

        const segment: PositionSegment = {
          plainStart: plainOffset,
          plainEnd: plainOffset + text.length,
          mdStart,
          mdEnd,
        };

        /**
         * If markdown length differs from text length, escape sequences are present.
         * Build a character map for accurate position mapping.
         */
        if (mdSlice.length !== text.length) {
          const charMap: Array<number> = [];
          let mdOffset = 0;
          let plainIdx = 0;

          while (plainIdx < text.length && mdOffset < mdSlice.length) {
            /**
             * Check for escape sequence (backslash followed by the expected char)
             */
            if (
              mdSlice[mdOffset] === `\\` &&
              mdOffset + 1 < mdSlice.length &&
              mdSlice[mdOffset + 1] === text[plainIdx]
            ) {
              /**
               * Skip the backslash, map to the character after it
               */
              charMap.push(mdOffset + 1);
              mdOffset += 2;
              plainIdx += 1;
            } else if (mdSlice[mdOffset] === text[plainIdx]) {
              charMap.push(mdOffset);
              mdOffset += 1;
              plainIdx += 1;
            } else {
              /**
               * Unexpected mismatch - skip markdown character
               */
              mdOffset += 1;
            }
          }

          segment.charMap = charMap;
        }

        segments.push(segment);
        plainTextParts.push(text);
        plainOffset += text.length;
        break;
      }

      case `inlineCode`: {
        /**
         * Inline code needs special handling because the content is stored as a `value`
         * property, and we need to skip the backtick syntax (`` ` `` or ``` `` ```).
         * The backticks are markdown syntax, not content.
         *
         * mdast representation:
         * - inlineCode: { type: 'inlineCode', value: 'code' }  ← no children, value property
         */
        const codeNode = node as InlineCode;
        const text = codeNode.value;
        const mdStart = node.position.start.offset;
        const mdEnd = node.position.end.offset;

        /**
         * Find where the code content starts by looking for the text in the markdown slice.
         * Handles both single and multiple backticks (` or `` or ```).
         */
        const markdownSlice = markdown.slice(mdStart, mdEnd);
        const codeStartOffset = markdownSlice.indexOf(text);

        if (codeStartOffset >= 0) {
          segments.push({
            plainStart: plainOffset,
            plainEnd: plainOffset + text.length,
            mdStart: mdStart + codeStartOffset,
            mdEnd: mdStart + codeStartOffset + text.length,
          });

          plainTextParts.push(text);
          plainOffset += text.length;
        }
        break;
      }

      case `code`: {
        /**
         * Code blocks need special handling because the content is stored as a `value`
         * property, and we need to skip the fence syntax (``` or ~~~) and language identifier.
         * Only the code content itself is plain text.
         *
         * mdast representation:
         * - code: { type: 'code', lang: 'js', value: 'const x = 1;' }  ← no children, value property
         */
        const codeNode = node as Code;
        const text = codeNode.value;
        const mdStart = node.position.start.offset;
        const mdEnd = node.position.end.offset;

        /**
         * Find where the code content starts in the markdown.
         * Code blocks have format: ```lang\ncode\n```
         * We need to find the first newline after the opening fence.
         */
        const markdownSlice = markdown.slice(mdStart, mdEnd);
        const firstNewline = markdownSlice.indexOf(`\n`);

        if (firstNewline >= 0 && text.length > 0) {
          const codeStartOffset = firstNewline + 1;

          segments.push({
            plainStart: plainOffset,
            plainEnd: plainOffset + text.length,
            mdStart: mdStart + codeStartOffset,
            mdEnd: mdStart + codeStartOffset + text.length,
          });

          plainTextParts.push(text);
          plainOffset += text.length;
        }
        break;
      }

      case `image`: {
        /**
         * Images need special handling because alt text is stored as a property,
         * not as child nodes. In contrast, links store their text as child `text`
         * nodes which are handled automatically through recursion in the default case.
         *
         * mdast representation:
         * - image: { type: 'image', alt: 'text', url: '...' }  ← property
         * - link:  { type: 'link', url: '...', children: [{ type: 'text', value: 'text' }] }  ← children
         */
        const imageNode = node as Image;
        const text = imageNode.alt || ``;

        if (text) {
          const mdStart = node.position.start.offset;
          /**
           * Alt text starts after `![` (2 characters)
           */
          segments.push({
            plainStart: plainOffset,
            plainEnd: plainOffset + text.length,
            mdStart: mdStart + 2,
            mdEnd: mdStart + 2 + text.length,
          });

          plainTextParts.push(text);
          plainOffset += text.length;
        }
        break;
      }

      default:
        /**
         * Recurse into children for container nodes
         */
        if (`children` in node && Array.isArray(node.children)) {
          for (const child of node.children) {
            traverse(child);
          }
        }
    }
  };

  traverse(ast);

  return {
    plainText: plainTextParts.join(``),
    markdown,
    segments,
  };
}

/**
 * Map a position in plain text to the corresponding position in markdown.
 * Uses binary search to find the segment containing the position.
 *
 * For segments with escape sequences (where markdown length differs from plain text length),
 * uses a pre-built character map for accurate position mapping.
 */
function plainToMarkdownPosition(
  plainPos: number,
  mapping: PositionMapping,
): number {
  const { segments } = mapping;

  if (segments.length === 0) {
    return plainPos;
  }

  /**
   * Binary search for the segment containing or nearest to plainPos
   */
  let left = 0;
  let right = segments.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const segment = segments[mid];

    /**
     * Position is exactly at segment end - prefer this over "within next segment"
     * This handles boundaries correctly when a position is at a segment boundary
     * (e.g., after "." but before "[" in markdown like "text.[link](url)")
     */
    if (plainPos === segment.plainEnd) {
      return segment.mdEnd;
    }

    /**
     * Position is within this segment (strictly inside, not at boundaries)
     */
    if (plainPos > segment.plainStart && plainPos < segment.plainEnd) {
      const offsetInPlain = plainPos - segment.plainStart;

      /**
       * If character map exists (escape sequences), use it for accurate mapping.
       * Otherwise, use direct 1:1 mapping.
       */
      if (segment.charMap && offsetInPlain < segment.charMap.length) {
        return segment.mdStart + segment.charMap[offsetInPlain];
      }
      return segment.mdStart + offsetInPlain;
    }

    /**
     * Position is exactly at segment start - check if previous segment ends here
     * If so, prefer the previous segment's end (for boundary semantics)
     */
    if (plainPos === segment.plainStart) {
      if (mid > 0 && segments[mid - 1].plainEnd === plainPos) {
        return segments[mid - 1].mdEnd;
      }
      return segment.mdStart;
    }

    if (plainPos < segment.plainStart) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  /**
   * Position falls in a gap between segments or outside all segments.
   * Map to the nearest segment boundary.
   */
  if (left >= segments.length) {
    /**
     * Position is after all segments - map to end of last segment
     */
    const lastSegment = segments[segments.length - 1];
    const overflow = plainPos - lastSegment.plainEnd;
    return lastSegment.mdEnd + overflow;
  }

  if (right < 0) {
    /**
     * Position is before all segments - map relative to first segment
     */
    const firstSegment = segments[0];
    const underflow = firstSegment.plainStart - plainPos;
    return Math.max(0, firstSegment.mdStart - underflow);
  }

  /**
   * Position is in a gap between segments[right] and segments[left].
   * Map to the end of the previous segment (segments[right]).
   */
  const prevSegment = segments[right];
  return prevSegment.mdEnd;
}

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
      // Include optional trailing sentence-ending punctuation to prevent orphaning
      // Example: "Hello (world). There" → splits after "." not after ")"
      {
        regex: /\([^)]*\)[.?!]?|\[[^\]]*\][.?!]?|\{[^}]*\}[.?!]?/g,
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
   * Find all semantic boundaries using plain text pattern matching.
   * Patterns are matched against the plain text (without markdown formatting),
   * then positions are mapped back to markdown coordinates.
   *
   * This approach avoids formatting characters (`**`, `[](...)`) from polluting
   * natural language boundary detection.
   *
   * @param mapping - Position mapping from plain text to markdown
   * @param protectedRanges - Ranges in markdown coordinates that should not be split
   * @returns Array of boundaries in markdown coordinates, sorted by priority then position
   */
  protected extractSemanticBoundaries(
    mapping: PositionMapping,
    protectedRanges: ProtectedRange[],
  ): Boundary[] {
    const boundaries: Boundary[] = [];
    const { plainText } = mapping;

    /**
     * Find all semantic boundaries for each pattern on plain text
     */
    for (const pattern of this.patterns) {
      /**
       * Reset lastIndex to ensure the regex starts from the beginning.
       * This is important because the regex objects are reused across calls.
       */
      pattern.regex.lastIndex = 0;

      let match: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: regex.exec assignment in while condition
      while ((match = pattern.regex.exec(plainText)) !== null) {
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
          boundaries.push({
            position: mdPosition,
            type: pattern.type,
            priority: pattern.priority,
          });
        }
      }
    }

    /**
     * Sort by priority (ascending), then by position (ascending).
     * This gives us the highest priority boundaries first, in positional order.
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
