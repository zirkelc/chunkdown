import type { Code, Image, InlineCode, Nodes, Text } from 'mdast';

/**
 * Represents a segment mapping plain text positions to markdown positions
 */
export type PositionSegment = {
  /** Start position in plain text (inclusive) */
  plainStart: number;
  /** End position in plain text (exclusive) */
  plainEnd: number;
  /** Start position in markdown (inclusive) */
  mdStart: number;
  /** End position in markdown (exclusive) */
  mdEnd: number;
  /**
   * End position of the parent node in markdown (inclusive of closing syntax).
   * Used to skip over closing syntax markers when mapping boundaries.
   * Only present for segments inside formatting nodes (emphasis, strong, etc.).
   */
  nodeEnd?: number;
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
export type PositionMapping = {
  /** Extracted plain text content */
  plain: string;
  /** Original markdown text */
  markdown: string;
  /** Segments mapping plain text positions to markdown positions */
  segments: Array<PositionSegment>;
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
export function buildPositionMapping(
  ast: Nodes,
  markdown: string,
): PositionMapping {
  const segments: Array<PositionSegment> = [];
  const plainTextParts: Array<string> = [];
  let plainOffset = 0;
  let lastMdEnd = 0;

  /**
   * Node types that wrap content with syntax markers and need nodeEnd tracking.
   * - Formatting: *, **, ~~ (emphasis, strong, delete)
   * - Links: [text](url) - text content is followed by ](url)
   */
  const wrappingTypes = new Set([`emphasis`, `strong`, `delete`, `link`]);

  /**
   * Add gap content (whitespace/newlines between AST nodes) to plain text.
   * This preserves paragraph breaks and other inter-node whitespace.
   * Only adds gaps that are pure whitespace - skips markdown syntax markers.
   */
  const addGapIfNeeded = (currentMdStart: number): void => {
    if (currentMdStart > lastMdEnd) {
      const gapContent = markdown.slice(lastMdEnd, currentMdStart);
      /**
       * Only add gaps that are pure whitespace (newlines, spaces).
       * Skip gaps that are syntax markers (**, *, [, ```, etc.).
       */
      if (/^\s+$/.test(gapContent)) {
        plainTextParts.push(gapContent);
        segments.push({
          plainStart: plainOffset,
          plainEnd: plainOffset + gapContent.length,
          mdStart: lastMdEnd,
          mdEnd: currentMdStart,
        });
        plainOffset += gapContent.length;
      }
    }
  };

  /**
   * @param node - Current node to process
   * @param parentNodeEnd - End position of parent formatting node (for closing syntax)
   */
  const traverse = (node: Nodes, parentNodeEnd?: number): void => {
    /**
     * Skip nodes without position information
     */
    if (
      node.position?.start?.offset === undefined ||
      node.position?.end?.offset === undefined
    ) {
      if (`children` in node && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child, parentNodeEnd);
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

        addGapIfNeeded(mdStart);

        const segment: PositionSegment = {
          plainStart: plainOffset,
          plainEnd: plainOffset + text.length,
          mdStart,
          mdEnd,
          nodeEnd: parentNodeEnd,
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
        lastMdEnd = mdEnd;
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

        addGapIfNeeded(mdStart);

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
        lastMdEnd = mdEnd;
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

        addGapIfNeeded(mdStart);

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
        lastMdEnd = mdEnd;
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
        const mdStart = node.position.start.offset;
        const mdEnd = node.position.end.offset;

        addGapIfNeeded(mdStart);

        if (text) {
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
        lastMdEnd = mdEnd;
        break;
      }

      case `break`: {
        /**
         * Hard line breaks (two trailing spaces + newline or backslash + newline)
         * are represented as `break` nodes. We preserve them as "\n" in plain text.
         */
        const mdStart = node.position.start.offset;
        const mdEnd = node.position.end.offset;

        addGapIfNeeded(mdStart);

        segments.push({
          plainStart: plainOffset,
          plainEnd: plainOffset + 1,
          mdStart,
          mdEnd,
        });
        plainTextParts.push(`\n`);
        plainOffset += 1;
        lastMdEnd = mdEnd;
        break;
      }

      default:
        /**
         * Recurse into children for container nodes.
         * For wrapping nodes (formatting + links), pass their end position
         * so child text nodes know about the closing syntax markers.
         *
         * For nested nodes (e.g., ***bold-italic*** or **[link](url)**),
         * use the MAX of current and parent nodeEnd to skip ALL closing syntax.
         */
        if (`children` in node && Array.isArray(node.children)) {
          const currentEnd = wrappingTypes.has(node.type)
            ? node.position.end.offset
            : undefined;
          const nodeEnd =
            currentEnd !== undefined
              ? Math.max(currentEnd, parentNodeEnd ?? 0)
              : parentNodeEnd;
          for (const child of node.children) {
            traverse(child, nodeEnd);
          }
        }
    }
  };

  traverse(ast);

  return {
    plain: plainTextParts.join(``),
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
export function plainToMarkdownPosition(
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
     *
     * If the segment has a nodeEnd (from a parent formatting node), use that
     * to skip over closing syntax markers (e.g., * or ** or ~~).
     */
    if (plainPos === segment.plainEnd) {
      if (segment.nodeEnd !== undefined && segment.nodeEnd > segment.mdEnd) {
        return segment.nodeEnd;
      }
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
        const prevSegment = segments[mid - 1];
        if (prevSegment.nodeEnd !== undefined && prevSegment.nodeEnd > prevSegment.mdEnd) {
          return prevSegment.nodeEnd;
        }
        return prevSegment.mdEnd;
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
  if (prevSegment.nodeEnd !== undefined && prevSegment.nodeEnd > prevSegment.mdEnd) {
    return prevSegment.nodeEnd;
  }
  return prevSegment.mdEnd;
}
