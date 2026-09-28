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
  WORD_PUNCT: 5,
  CHARACTER: 1,
} as const;

/**
 * Upper bound of the balance bonus: a perfectly even split (ratio 0.5)
 * scores the full bonus. The recursive scan's early exit relies on this cap,
 * so the bonus formula is expressed in terms of it.
 */
const MAX_BALANCE_BONUS = 20;

/**
 * Punctuation characters used as preferred split points inside words
 * (e.g. URLs, paths, kebab/snake identifiers).
 */
const WORD_PUNCT_CHARS = /[-/._:]/;

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
  penalty: number;
};

/**
 * Text boundary with position, weight and score information
 */
type Boundary = {
  mdPosition: number;
  plainPosition: number;
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

/**
 * Block node types that parse back to the same subtree when serialized
 * standalone. A bare phrasing node (e.g. `text`) would parse as a paragraph.
 */
const REPARSE_STABLE_TYPES = new Set(['paragraph', 'heading', 'code', 'html']);

/**
 * Types that resolve against definitions elsewhere in the document.
 */
const CONTEXT_DEPENDENT_TYPES = new Set(['linkReference', 'imageReference', 'footnoteReference', 'definition']);

/**
 * Whether a character code is ASCII punctuation, the set a backslash escapes.
 */
const isAsciiPunctuation = (code: number): boolean =>
  (code >= 33 && code <= 47) || (code >= 58 && code <= 64) || (code >= 91 && code <= 96) || (code >= 123 && code <= 126);

/**
 * Offset edits between a source slice and its serialization: `at` is a slice
 * index where a backslash was inserted or removed, `shift` the total change in
 * length up to and including that edit.
 */
type OffsetEdits = Array<{ at: number; shift: number }>;

/**
 * Align a node's source text `[start, end)` with its serialization (without
 * the final line ending), allowing only differences that parse to the same
 * tree: a backslash the serializer inserted or removed before ASCII
 * punctuation (both spellings unescape to the same character), and a `_`
 * emphasis marker written as `*`. A run of `*` must come entirely from `_` or
 * entirely from `*`, because a rewritten run next to an original one would
 * merge into a single run and pair differently. Returns the offset edits, or
 * undefined when the texts differ in any other way.
 */
const alignWithSource = (source: string, start: number, end: number, markdown: string): OffsetEdits | undefined => {
  const edits: OffsetEdits = [];
  const markdownEnd = markdown.length - 1;
  let i = start;
  let j = 0;
  let shift = 0;
  /**
   * Whether the current run of `*` was rewritten from `_`, or undefined outside a run
   */
  let runRewritten: boolean | undefined;

  while (i < end && j < markdownEnd) {
    const sourceChar = source.charCodeAt(i);
    const char = markdown.charCodeAt(j);
    const rewritten = char === 42 /* * */ && sourceChar === 95; /* _ */

    if (char === sourceChar || rewritten) {
      if (char === 42 /* * */) {
        if (runRewritten === undefined) runRewritten = rewritten;
        else if (runRewritten !== rewritten) return undefined;
      } else {
        runRewritten = undefined;
      }
      i++;
      j++;
    } else if (char === 92 /* \ */ && markdown.charCodeAt(j + 1) === sourceChar && isAsciiPunctuation(sourceChar)) {
      edits.push({ at: i - start, shift: ++shift });
      runRewritten = undefined;
      j++;
    } else if (sourceChar === 92 /* \ */ && source.charCodeAt(i + 1) === char && isAsciiPunctuation(char)) {
      edits.push({ at: i - start, shift: --shift });
      runRewritten = undefined;
      i++;
    } else {
      return undefined;
    }
  }

  return i === end && j === markdownEnd ? edits : undefined;
};

/**
 * Map an offset relative to the source slice to the serialization: it moves by
 * every edit before it. An edit at the offset itself belongs to the text that
 * starts there, so it does not move the offset.
 */
const mapOffset = (offset: number, edits: OffsetEdits): number => {
  let low = 0;
  let high = edits.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (edits[mid].at < offset) low = mid + 1;
    else high = mid;
  }
  return low === 0 ? offset : offset + edits[low - 1].shift;
};

/**
 * Copy a subtree with every position offset moved from the source document to
 * the serialization, which starts at `start` and differs by `edits`. Only
 * offsets are kept, since nothing downstream reads lines or columns. Returns
 * undefined when the subtree contains a context-dependent node or a node
 * without offsets.
 */
const mapOffsets = (node: Nodes, start: number, edits: OffsetEdits): Nodes | undefined => {
  if (CONTEXT_DEPENDENT_TYPES.has(node.type)) return undefined;
  const nodeStart = node.position?.start?.offset;
  const nodeEnd = node.position?.end?.offset;
  if (nodeStart === undefined || nodeEnd === undefined) return undefined;

  const copy = { ...node } as Nodes & { children?: Array<Nodes> };
  delete copy.data;
  copy.position = {
    start: { line: 0, column: 0, offset: mapOffset(nodeStart - start, edits) },
    end: { line: 0, column: 0, offset: mapOffset(nodeEnd - start, edits) },
  };
  if ('children' in node) {
    const children: Array<Nodes> = [];
    for (const child of node.children) {
      const mapped = mapOffsets(child, start, edits);
      if (mapped === undefined) return undefined;
      children.push(mapped);
    }
    copy.children = children;
  }
  return copy;
};

export class TextSplitter extends AbstractNodeSplitter {
  splitText(text: string): string[] {
    const ast = fromMarkdown(text);
    const chunks = this.splitNode(ast);
    return chunks.map((chunk) => toMarkdown(chunk).trim()).filter((chunk) => chunk.length > 0);
  }

  splitNode(node: Nodes): Nodes[] {
    const markdown = toMarkdown(node);
    /**
     * Parse the markdown text to get correct position offsets for this text.
     * The original node has offsets relative to its source document, not to this text.
     */
    const ast = this.sourceTree(node, markdown) ?? fromMarkdown(markdown);
    const ranges = this.extractPenalizedRanges(ast);
    /**
     * Build position mapping for plain text pattern matching.
     * This enables matching on clean text without markdown formatting pollution.
     */
    const mapping = buildPositionMapping(ast, markdown);
    const boundaries = this.extractSemanticBoundaries(mapping, ranges);

    const nodes: Nodes[] = [];

    const totalPlainLength = mapping.plain.length;

    for (const textChunk of this.splitRecursive(markdown, boundaries, 0, markdown.length, 0, totalPlainLength, Infinity)) {
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
   * Parsing a block node's serialization gives back the node's own subtree
   * when the serialization differs from the node's slice of the source
   * document only in ways that do not change the parse (see the alignment
   * above), with offsets relative to the serialization. In that case the
   * subtree is reused with mapped offsets instead of being parsed again.
   * Reference nodes resolve against definitions elsewhere in the document, so
   * subtrees that contain them are parsed.
   */
  protected sourceTree(node: Nodes, markdown: string): Root | undefined {
    const { source } = this.options;
    const start = node.position?.start?.offset;
    const end = node.position?.end?.offset;
    if (source === undefined || start === undefined || end === undefined) return undefined;
    if (!REPARSE_STABLE_TYPES.has(node.type)) return undefined;
    if (markdown.charCodeAt(markdown.length - 1) !== 10 /* \n */) return undefined;

    const edits = alignWithSource(source, start, end, markdown);
    if (edits === undefined) return undefined;

    const mapped = mapOffsets(node, start, edits);
    if (mapped === undefined) return undefined;

    return {
      type: 'root',
      children: [mapped as Root['children'][number]],
      position: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: markdown.length } },
    };
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
      if (node.position?.start?.offset === undefined || node.position?.end?.offset === undefined) {
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
        ranges.push({ start, end, penalty: Infinity });
      } else {
        const penalty = MARKDOWN_PENALTIES[node.type];
        if (penalty !== undefined) {
          ranges.push({ start, end, penalty });
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
   * Score a boundary based on its weight and any penalized range penalties.
   * Returns weight minus the maximum penalty from overlapping ranges.
   * A score of -Infinity means the boundary is protected and should not be used.
   */
  protected scoreBoundary(position: number, weight: number, ranges: PenalizedRange[]): number {
    let maxPenalty = 0;
    for (const range of ranges) {
      if (position > range.start && position < range.end) {
        maxPenalty = Math.max(maxPenalty, range.penalty);
      }
    }
    return weight - maxPenalty;
  }

  /**
   * Calculate a balance bonus (0 to the cap) based on how evenly a split
   * divides the text. Perfectly balanced splits get maximum bonus.
   */
  protected calculateBalanceBonus(firstSize: number, secondSize: number): number {
    const total = firstSize + secondSize;
    if (total === 0) return 0;
    const ratio = Math.min(firstSize, secondSize) / total;
    return Math.round(ratio * 2 * MAX_BALANCE_BONUS);
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
  protected extractSemanticBoundaries(mapping: PositionMapping, ranges: PenalizedRange[]): Boundary[] {
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
            weight: pattern.weight,
            score,
          });
        }
      }
    }

    /**
     * If the `word` rule allows in-word splitting, emit additional boundaries
     * inside oversized tokens. Punctuation positions get a small bonus over
     * pure character positions so URLs/paths split at separators first.
     *
     * Eligibility per word length (`L`):
     *  - `allow-split`: any word (`L > 0`) gets WORD_PUNCT; CHARACTER added
     *    when `L > maxAllowedSize` (only case char-level fallback is needed).
     *  - `size-split { size: N }`: words with `L > N` get WORD_PUNCT;
     *    CHARACTER added when `L > max(N, maxAllowedSize)`.
     *  - `never-split` / unset: skipped entirely.
     */
    const wordRule = this.splitRules.word;
    if (wordRule && (wordRule.rule === 'allow-split' || wordRule.rule === 'size-split')) {
      const punctThreshold = wordRule.rule === 'size-split' ? wordRule.size : 0;
      const charThreshold = Math.max(punctThreshold, this.maxAllowedSize);

      const wordRegex = /\S+/g;
      let wordMatch: RegExpExecArray | null;
      while ((wordMatch = wordRegex.exec(plain)) !== null) {
        const word = wordMatch[0];
        if (word.length <= punctThreshold) continue;

        const wordStart = wordMatch.index;
        const allowChar = word.length > charThreshold;

        for (let i = 1; i < word.length; i++) {
          const isPunct = WORD_PUNCT_CHARS.test(word[i - 1]);

          /**
           * Skip pure character positions when char-level splitting is not
           * required for this word (i.e. the word fits without it).
           */
          if (!isPunct && !allowChar) continue;

          const weight = isPunct ? SEMANTIC_WEIGHTS.WORD_PUNCT : SEMANTIC_WEIGHTS.CHARACTER;
          const plainPosition = wordStart + i;
          const mdPosition = plainToMarkdownPosition(plainPosition, mapping);
          const score = this.scoreBoundary(mdPosition, weight, ranges);
          if (!Number.isFinite(score)) continue;

          boundaries.push({
            mdPosition,
            plainPosition,
            weight,
            score,
          });
        }
      }
    }

    /**
     * Sort by score (descending), then by position (ascending).
     * Higher scores are preferred split points.
     */
    return boundaries.sort((a, b) => (a.score !== b.score ? b.score - a.score : a.mdPosition - b.mdPosition));
  }

  /**
   * Recursively split text using boundary scoring system.
   * Uses pre-computed plain text positions for O(1) balance bonus calculation
   * per boundary, then computes exact content sizes only for the selected boundary.
   * This avoids expensive markdown re-parsing for every candidate.
   *
   * Boundaries stay in whole-text coordinates throughout the recursion; each
   * level works on a window `[mdStart, mdEnd)` with `plainStart` as its plain
   * text origin, and `maxWeight` caps the boundary strength to those at most
   * as strong as the ancestors' selections.
   */
  private *splitRecursive(
    text: string,
    boundaries: Boundary[],
    mdStart: number,
    mdEnd: number,
    plainStart: number,
    totalPlainLength: number,
    maxWeight: number,
  ): Generator<string> {
    /**
     * Fast path: use pre-computed plain text length to skip parsing
     */
    if (totalPlainLength <= this.maxAllowedSize) {
      yield text.substring(mdStart, mdEnd);
      return;
    }

    /**
     * Evaluate the boundaries inside this window with a combined score
     * including balance bonus, keeping the first strictly-highest one (the
     * list is sorted by score descending, then position; this matches what
     * a stable sort by combined score would put first). The balance bonus
     * is capped, so the scan can stop as soon as no later boundary can beat
     * the current best.
     */
    let boundary: Boundary | undefined;
    let bestScore = -Infinity;
    for (const b of boundaries) {
      if (b.score + MAX_BALANCE_BONUS <= bestScore) break;
      if (b.weight > maxWeight || b.mdPosition <= mdStart || b.mdPosition >= mdEnd) continue;
      const firstSize = b.plainPosition - plainStart;
      const balanceBonus = this.calculateBalanceBonus(firstSize, totalPlainLength - firstSize);
      const combinedScore = b.score + balanceBonus;
      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        boundary = b;
      }
    }

    /**
     * If no boundary is available, yield as single chunk (protected)
     */
    if (boundary === undefined) {
      yield text.substring(mdStart, mdEnd);
      return;
    }

    /**
     * Compute exact sizes for the selected boundary via getContentSize
     */
    const position = boundary.mdPosition;
    const firstPart = text.substring(mdStart, position);
    const secondPart = text.substring(position, mdEnd);
    const firstPartSize = getContentSize(firstPart);
    const secondPartSize = getContentSize(secondPart);

    /**
     * Recursive calls only use boundaries at most as strong as the selected
     * one, which prevents weaker boundaries from splitting before stronger
     * ones deeper down
     */
    if (firstPartSize <= this.maxAllowedSize) {
      yield firstPart;
    } else {
      yield* this.splitRecursive(text, boundaries, mdStart, position, plainStart, firstPartSize, boundary.weight);
    }

    if (secondPartSize <= this.maxAllowedSize) {
      yield secondPart;
    } else {
      yield* this.splitRecursive(
        text,
        boundaries,
        position,
        mdEnd,
        boundary.plainPosition,
        secondPartSize,
        boundary.weight,
      );
    }
  }
}
