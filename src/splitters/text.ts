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
 * Characters (and CR/tab) that can change how a line tokenizes at a
 * structural level (escapes, autolinks/html, line semantics).
 */
const NOT_SIMPLE_STRUCTURE = /[\\<\t\r]/;

/**
 * Content that cannot appear in the plain-text parts of a simple line:
 * formatting and block markers, backticks and brackets outside well-formed
 * constructs, character references, and autolink-literal candidates (which
 * would become link nodes with their own penalties and segments).
 */
const SIMPLE_TEXT_BAIL = /[*_~>#|&+=[\]`]|@|:\/\/|www\./i;

/**
 * A well-formed inline link or image on a single line: a label without
 * brackets, backticks, carets or newlines, a destination without
 * parentheses, spaces or newlines, and an optional quoted title.
 */
const INLINE_LINK = /(!?)\[([^[\]^\n`]*)\]\(([^() \n]*)(?: +(?:"[^"\n]*"|'[^'\n]*'))?\)/g;

/**
 * Unicode punctuation and symbols, the classes emphasis flanking rules treat
 * as punctuation.
 */
const PUNCTUATION = /[\p{P}\p{S}]/u;

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
    return chunks.map((chunk) => toMarkdown(chunk).trim()).filter((chunk) => chunk.length > 0);
  }

  splitNode(node: Nodes): Nodes[] {
    const markdown = toMarkdown(node);

    let ranges: PenalizedRange[];
    let mapping: PositionMapping;

    const simple = this.analyzeCodeNode(node, markdown) ?? this.analyzeSimpleLine(markdown);
    if (simple !== undefined) {
      ({ ranges, mapping } = simple);
    } else {
      /**
       * Parse the markdown text to get correct position offsets for this text.
       * The original node has offsets relative to its source document, not to this text.
       */
      const ast = fromMarkdown(markdown);
      ranges = this.extractPenalizedRanges(ast);
      /**
       * Build position mapping for plain text pattern matching.
       * This enables matching on clean text without markdown formatting pollution.
       */
      mapping = buildPositionMapping(ast, markdown);
    }

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
   * Analyze a serialized code block, producing the same penalized ranges and
   * position mapping a re-parse would, without parsing. The serialization of
   * a code node is a single code block again: no penalized ranges (code has
   * no markdown penalty, and a protected code node bails to the parse path
   * to keep its protection range exact), and one segment covering the code
   * value, which starts right after the first line (the opening fence).
   */
  protected analyzeCodeNode(
    node: Nodes,
    markdown: string,
  ): { ranges: PenalizedRange[]; mapping: PositionMapping } | undefined {
    if (node.type !== 'code') return undefined;
    if (!this.canSplitNode(node)) return undefined;

    const value = node.value;
    const firstNewline = markdown.indexOf('\n');

    const segments: PositionMapping['segments'] = [];
    if (firstNewline >= 0 && value.length > 0) {
      const codeStart = firstNewline + 1;

      /**
       * The serialized fence must contain the value verbatim at this offset;
       * anything else (e.g. an indented layout) falls back to the parse.
       */
      if (markdown.startsWith(value, codeStart)) {
        segments.push({
          plainStart: 0,
          plainEnd: value.length,
          mdStart: codeStart,
          mdEnd: codeStart + value.length,
        });
      } else {
        return undefined;
      }
    }

    return {
      ranges: [],
      mapping: { plain: segments.length > 0 ? value : '', markdown, segments },
    };
  }

  /**
   * Analyze serialized markdown that is a single paragraph of plain prose
   * plus well-formed inline links or images, producing the same penalized
   * ranges and position mapping a parse would, without parsing. Returns
   * undefined whenever the text might contain anything else.
   *
   * Such a paragraph parses to text nodes and link/image nodes: contiguous
   * text (including soft line breaks) maps one-to-one as a single segment, a
   * link contributes one segment for its label (carrying the enclosing node
   * span) and one penalized range over the whole link, and empty labels
   * contribute no segment. Spaces adjacent to a newline are bailed on
   * because line-edge whitespace is stripped or turned into hard breaks by
   * the parser; blank lines would end the paragraph.
   */
  protected analyzeSimpleLine(markdown: string): { ranges: PenalizedRange[]; mapping: PositionMapping } | undefined {
    if (NOT_SIMPLE_STRUCTURE.test(markdown)) return undefined;

    const line = markdown.endsWith('\n') ? markdown.slice(0, -1) : markdown;
    if (line.length === 0) return undefined;

    /**
     * Spaces or newlines at the paragraph or line edges change what the
     * parser extracts (stripped whitespace, hard breaks, paragraph ends)
     */
    const first = line.charCodeAt(0);
    const last = line.charCodeAt(line.length - 1);
    if (first === 32 || first === 10 || last === 32 || last === 10) return undefined;
    if (line.includes(' \n') || line.includes('\n ') || line.includes('\n\n')) return undefined;

    /**
     * A line whose content starts with a dash or an ordered-list marker
     * could open a list, thematic break or setext underline, or interrupt
     * the paragraph.
     */
    let lineStart = 0;
    while (lineStart !== -1 && lineStart < line.length) {
      const start = line.charCodeAt(lineStart);
      if (start === 45 /* - */) return undefined;
      if (start >= 48 && start <= 57 /* 0-9 */) {
        let digitEnd = lineStart;
        while (digitEnd < line.length) {
          const code = line.charCodeAt(digitEnd);
          if (code < 48 || code > 57) break;
          digitEnd++;
        }
        const afterDigits = line.charCodeAt(digitEnd);
        if (afterDigits === 46 /* . */ || afterDigits === 41 /* ) */) return undefined;
      }
      const nextNewline = line.indexOf('\n', lineStart);
      lineStart = nextNewline === -1 ? -1 : nextNewline + 1;
    }

    const ranges: PenalizedRange[] = [];
    const segments: PositionMapping['segments'] = [];
    const plainParts: string[] = [];
    let plainOffset = 0;
    let lastEnd = 0;

    /**
     * Emit the plain-text run before a construct (or the final tail)
     */
    const flushText = (until: number): boolean => {
      const text = line.slice(lastEnd, until);
      if (SIMPLE_TEXT_BAIL.test(text)) return false;
      if (text.length > 0) {
        segments.push({
          plainStart: plainOffset,
          plainEnd: plainOffset + text.length,
          mdStart: lastEnd,
          mdEnd: until,
        });
        plainParts.push(text);
        plainOffset += text.length;
      }
      return true;
    };

    /**
     * Scan constructs left to right, mirroring parser precedence: whichever
     * of the next code span, emphasis run or link starts first wins. Link
     * matches never contain backticks in their label, so a match starting
     * before the next backtick is a real link even when its destination or
     * title holds literal backticks.
     */
    INLINE_LINK.lastIndex = 0;
    let linkMatch: RegExpExecArray | null = INLINE_LINK.exec(line);

    while (true) {
      const nextBacktick = line.indexOf('`', lastEnd);
      const nextAsterisk = line.indexOf('*', lastEnd);

      /**
       * Refresh a stale link match that starts inside consumed text
       */
      if (linkMatch !== null && linkMatch.index < lastEnd) {
        INLINE_LINK.lastIndex = lastEnd;
        linkMatch = INLINE_LINK.exec(line);
      }

      const linkPosition = linkMatch === null ? -1 : linkMatch.index;
      const codeFirst =
        nextBacktick !== -1 &&
        (linkPosition === -1 || nextBacktick < linkPosition) &&
        (nextAsterisk === -1 || nextBacktick < nextAsterisk);
      const emphasisFirst =
        !codeFirst && nextAsterisk !== -1 && (linkPosition === -1 || nextAsterisk < linkPosition);

      if (emphasisFirst) {
        /**
         * Asterisk emphasis with plain inner content: a pure opener run of
         * one or two asterisks (boundary before, content after — such a run
         * cannot also close), matched by a pure closer run of the same
         * length. Equal-length pairs sum to 2 or 4, so the rule-of-three
         * pairing restriction never applies. Anything else bails.
         */
        const open = nextAsterisk;
        let openEnd = open;
        while (openEnd < line.length && line.charCodeAt(openEnd) === 42 /* * */) openEnd++;
        const markerLength = openEnd - open;
        if (markerLength > 2) return undefined;

        const before = open === 0 ? undefined : line[open - 1];
        const afterOpen = openEnd >= line.length ? undefined : line[openEnd];
        const beforeIsBoundary = before === undefined || before === ' ' || before === '\n' || PUNCTUATION.test(before);
        const afterOpenIsBoundary =
          afterOpen === undefined || afterOpen === ' ' || afterOpen === '\n' || PUNCTUATION.test(afterOpen);
        if (!beforeIsBoundary || afterOpenIsBoundary) return undefined;

        const close = line.indexOf('*', openEnd);
        if (close === -1) return undefined;
        let closeEnd = close;
        while (closeEnd < line.length && line.charCodeAt(closeEnd) === 42 /* * */) closeEnd++;
        if (closeEnd - close !== markerLength) return undefined;

        const beforeClose = line[close - 1];
        const afterClose = closeEnd >= line.length ? undefined : line[closeEnd];
        const beforeCloseIsBoundary =
          beforeClose === ' ' || beforeClose === '\n' || PUNCTUATION.test(beforeClose);
        const afterCloseIsBoundary =
          afterClose === undefined || afterClose === ' ' || afterClose === '\n' || PUNCTUATION.test(afterClose);
        if (beforeCloseIsBoundary || !afterCloseIsBoundary) return undefined;

        const inner = line.slice(openEnd, close);
        if (SIMPLE_TEXT_BAIL.test(inner)) return undefined;

        if (!flushText(open)) return undefined;

        segments.push({
          plainStart: plainOffset,
          plainEnd: plainOffset + inner.length,
          mdStart: openEnd,
          mdEnd: close,
          nodeStart: open,
          nodeEnd: closeEnd,
        });
        plainParts.push(inner);
        plainOffset += inner.length;

        const type = markerLength === 2 ? 'strong' : 'emphasis';
        ranges.push({
          start: open,
          end: closeEnd,
          penalty: this.inlineNodePenalty(type, inner.length),
        });

        lastEnd = closeEnd;
        continue;
      }

      if (codeFirst) {
        /**
         * Single-backtick code span: double or unmatched backticks and spans
         * with line endings are not mirrored exactly, so they bail
         */
        const open = nextBacktick;
        if (line.charCodeAt(open + 1) === 96 /* ` */) return undefined;
        const close = line.indexOf('`', open + 1);
        if (close === -1) return undefined;
        if (line.charCodeAt(close + 1) === 96 /* ` */) return undefined;

        const content = line.slice(open + 1, close);
        if (content.includes('\n')) return undefined;

        let value = content;
        if (content.charCodeAt(0) === 32 && content.charCodeAt(content.length - 1) === 32 && content.trim().length > 0) {
          value = content.slice(1, -1);
        }

        if (!flushText(open)) return undefined;

        const nodeEnd = close + 1;
        const valueOffset = line.slice(open, nodeEnd).indexOf(value);
        segments.push({
          plainStart: plainOffset,
          plainEnd: plainOffset + value.length,
          mdStart: open + valueOffset,
          mdEnd: open + valueOffset + value.length,
          nodeStart: open,
          nodeEnd,
        });
        plainParts.push(value);
        plainOffset += value.length;

        ranges.push({
          start: open,
          end: nodeEnd,
          penalty: this.inlineNodePenalty('inlineCode', value.length),
        });

        lastEnd = nodeEnd;
        continue;
      }

      if (linkMatch === null) break;

      const match = linkMatch;
      if (!flushText(match.index)) return undefined;

      const isImage = match[1].length > 0;
      const label = match[2];
      if (SIMPLE_TEXT_BAIL.test(label)) return undefined;

      const nodeStart = match.index;
      const nodeEnd = match.index + match[0].length;
      const labelStart = nodeStart + (isImage ? 2 : 1);

      if (label.length > 0) {
        segments.push({
          plainStart: plainOffset,
          plainEnd: plainOffset + label.length,
          mdStart: labelStart,
          mdEnd: labelStart + label.length,
          nodeStart,
          nodeEnd,
        });
        plainParts.push(label);
        plainOffset += label.length;
      }

      const type = isImage ? 'image' : 'link';
      ranges.push({ start: nodeStart, end: nodeEnd, penalty: this.inlineNodePenalty(type, label.length) });

      lastEnd = nodeEnd;
      INLINE_LINK.lastIndex = lastEnd;
      linkMatch = INLINE_LINK.exec(line);
    }

    if (!flushText(line.length)) return undefined;

    return {
      ranges,
      mapping: { plain: plainParts.join(''), markdown, segments },
    };
  }

  /**
   * Penalty a link, image, inline code or formatting range would receive
   * from range extraction: infinite when its split rule protects it at this
   * content size, the regular markdown penalty otherwise. Formatting nodes
   * fall back to the shared formatting rule.
   */
  private inlineNodePenalty(type: 'link' | 'image' | 'inlineCode' | 'strong' | 'emphasis', contentSize: number): number {
    let rule = this.splitRules[type];
    if (!rule && (type === 'strong' || type === 'emphasis')) {
      rule = this.splitRules.formatting;
    }
    if (rule) {
      if (rule.rule === 'never-split') return Infinity;
      if (rule.rule === 'size-split' && contentSize <= rule.size) return Infinity;
    }
    return MARKDOWN_PENALTIES[type];
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
   * Calculate a balance bonus (0-20) based on how evenly a split divides the text.
   * Perfectly balanced splits get maximum bonus.
   */
  protected calculateBalanceBonus(firstSize: number, secondSize: number): number {
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
     * never exceeds 20, so the scan can stop as soon as no later boundary
     * can beat the current best.
     */
    let boundary: Boundary | undefined;
    let bestScore = -Infinity;
    for (const b of boundaries) {
      if (b.score + 20 <= bestScore) break;
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
