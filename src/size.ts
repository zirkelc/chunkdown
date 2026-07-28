import type { Nodes } from 'mdast';
import { isSection, type Section } from './ast';
import { fromMarkdownForSizing, toMarkdown, toString } from './markdown';

/**
 * Characters that can change line semantics, so the fast sizer must not be
 * used at all when any of them is present.
 * Conservative by design: any hit falls back to a real parse.
 */
const NOT_PLAIN_PROSE = /[\t\r]/;

/**
 * ASCII punctuation, the set of characters a backslash escapes.
 */
const ASCII_PUNCTUATION = /[!-/:-@[-`{-~]/;

/**
 * Characters that can open non-paragraph blocks, inline formatting,
 * autolinks or html. Checked after code spans and inline links are removed,
 * so characters inside code content, link destinations and titles (common in
 * URLs) cannot cause a bail-out — anything that survives the removal
 * genuinely sits in plain text.
 */
const NOT_PLAIN_PROSE_AFTER_LINKS = /[*_[\]<>#~|&+=`]/;

/**
 * Replace every backslash escape and every isolated single-backtick code
 * span with placeholders of their text-content length, so later passes see
 * neither the syntax nor the content characters. The two are handled in one
 * left-to-right pass because each can neutralize the other: an escaped
 * backtick is literal, and a backslash inside a code span is content.
 * Returns undefined for anything this cannot mirror exactly (hard breaks,
 * double or unmatched backticks, spans with line endings).
 *
 * An escaped ASCII punctuation character contributes one character, a
 * backslash before anything else is itself literal, and code span content
 * contributes its raw characters, minus one leading and one trailing space
 * when it has both but is not all spaces.
 */
const replaceEscapesAndCodeSpans = (text: string): string | undefined => {
  let result = '';
  let position = 0;

  while (true) {
    const nextBackslash = text.indexOf('\\', position);
    const nextBacktick = text.indexOf('`', position);

    if (nextBackslash !== -1 && (nextBacktick === -1 || nextBackslash < nextBacktick)) {
      const escaped = text[nextBackslash + 1];
      if (escaped === undefined) {
        /**
         * A trailing backslash is literal
         */
        return result + text.slice(position);
      }
      if (escaped === '\n') return undefined;

      result += text.slice(position, nextBackslash) + 'x';
      position = nextBackslash + (ASCII_PUNCTUATION.test(escaped) ? 2 : 1);
      continue;
    }

    const open = nextBacktick;
    if (open === -1) return result + text.slice(position);
    if (text.charCodeAt(open + 1) === 96 /* ` */) return undefined;

    const close = text.indexOf('`', open + 1);
    if (close === -1) return undefined;
    if (text.charCodeAt(close + 1) === 96 /* ` */) return undefined;

    const content = text.slice(open + 1, close);
    if (content.includes('\n')) return undefined;

    let valueLength = content.length;
    if (content.charCodeAt(0) === 32 && content.charCodeAt(content.length - 1) === 32 && content.trim().length > 0) {
      valueLength -= 2;
    }

    result += text.slice(position, open) + 'x'.repeat(valueLength);
    position = close + 1;
  }
};

/**
 * A well-formed inline link or image on a single line: a label without
 * brackets, carets or newlines, a destination without parentheses, spaces or
 * newlines, and an optional quoted title. Only the label is text content;
 * anything more complex is left in place and caught by the bracket check.
 */
const INLINE_LINK = /!?\[([^[\]^\n]*)\]\(([^() \n]*)(?: +(?:"[^"\n]*"|'[^'\n]*'))?\)/g;

/**
 * Unicode punctuation and symbols, the classes emphasis flanking rules treat
 * as punctuation.
 */
const PUNCTUATION = /[\p{P}\p{S}]/u;

/**
 * Remove asterisk emphasis markers whose interpretation is unambiguous.
 * Returns undefined for any asterisk usage this cannot mirror exactly.
 *
 * Only runs of one or two asterisks are accepted, strictly alternating
 * between a pure opener (preceded by start, whitespace or punctuation and
 * followed by content — such a run cannot also close) and a pure closer of
 * the same length (preceded by content and followed by end, whitespace or
 * punctuation). Equal-length pairs sum to 2 or 4, so the rule-of-three
 * pairing restriction never applies, and the markers simply vanish from the
 * extracted text.
 */
const removeEmphasis = (text: string): string | undefined => {
  let result = '';
  let position = 0;
  let openLength = 0;

  while (true) {
    const runStart = text.indexOf('*', position);
    if (runStart === -1) break;

    let runEnd = runStart;
    while (runEnd < text.length && text.charCodeAt(runEnd) === 42 /* * */) runEnd++;
    const runLength = runEnd - runStart;
    if (runLength > 2) return undefined;

    const previous = runStart === 0 ? undefined : text[runStart - 1];
    const next = runEnd >= text.length ? undefined : text[runEnd];

    const previousIsBoundary = previous === undefined || previous === ' ' || previous === '\n' || PUNCTUATION.test(previous);
    const nextIsBoundary = next === undefined || next === ' ' || next === '\n' || PUNCTUATION.test(next);

    if (openLength === 0) {
      /**
       * Expecting an opener: boundary before, content after
       */
      if (!previousIsBoundary || nextIsBoundary) return undefined;
      openLength = runLength;
    } else {
      /**
       * Expecting the matching closer: content before, boundary after
       */
      if (previousIsBoundary || !nextIsBoundary || runLength !== openLength) return undefined;
      openLength = 0;
    }

    result += text.slice(position, runStart);
    position = runEnd;
  }

  if (openLength !== 0) return undefined;
  return result + text.slice(position);
};

/**
 * Compute the plain-text content size of markdown that is a single
 * backtick-fenced code block, without parsing. Returns undefined when the
 * text might be anything else.
 *
 * Recursive splitting frequently measures the leading part of a code block:
 * an opening fence with no closing fence. When no other backtick appears
 * (which also rules out an early closing fence) and line endings are plain,
 * the parse yields one code node whose value is everything after the fence
 * line minus a single trailing line ending.
 */
const sizeCodeFence = (text: string): number | undefined => {
  if (!text.startsWith('```')) return undefined;
  if (text.indexOf('`', 3) !== -1) return undefined;
  if (text.includes('\r')) return undefined;

  const firstNewline = text.indexOf('\n');
  if (firstNewline === -1) return 0;

  const contentLength = text.length - firstNewline - 1;
  if (contentLength > 0 && text.charCodeAt(text.length - 1) === 10 /* \n */) {
    return contentLength - 1;
  }
  return contentLength;
};

/**
 * Compute the plain-text content size of markdown that consists only of plain
 * paragraphs and well-formed inline links, without parsing. Returns undefined
 * when the text might contain any other construct.
 *
 * Mirrors what parsing and text extraction would produce for such input:
 * code span syntax contributes its content, inline link syntax contributes
 * only its label text, every line loses its leading and trailing spaces,
 * consecutive lines of a paragraph are joined by a newline unless the
 * previous line ends in a hard break (two or more trailing spaces, which
 * contributes nothing), and paragraph boundaries contribute nothing.
 *
 * Code spans are removed before links so that backticks inside labels and
 * brackets inside code cannot form constructs the parser would not see.
 * Neither removal spans lines, so all texts have the same lines; leading and
 * trailing spaces are measured on the original line (its prefix and suffix
 * are shared with the processed line, and spaces inside a label are content,
 * not line whitespace).
 */
const sizePlainProse = (text: string): number | undefined => {
  if (NOT_PLAIN_PROSE.test(text)) return undefined;

  let processed = text;
  if (processed.includes('`') || processed.includes('\\')) {
    const withoutCode = replaceEscapesAndCodeSpans(processed);
    if (withoutCode === undefined) return undefined;
    processed = withoutCode;
  }
  if (processed.includes('[')) {
    processed = processed.replace(INLINE_LINK, '$1');
  }
  if (processed.includes('*')) {
    const withoutEmphasis = removeEmphasis(processed);
    if (withoutEmphasis === undefined) return undefined;
    processed = withoutEmphasis;
  }
  if (NOT_PLAIN_PROSE_AFTER_LINKS.test(processed)) return undefined;

  let size = 0;
  let previousLineBlank = true;
  let pendingJunction = 0;

  let lineStart = 0;
  let processedLineStart = 0;
  const length = text.length;

  while (lineStart <= length) {
    let lineEnd = text.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = length;
    let processedLineEnd = processed.indexOf('\n', processedLineStart);
    if (processedLineEnd === -1) processedLineEnd = processed.length;

    /**
     * Measure leading and trailing spaces on the original line
     */
    let contentStart = lineStart;
    while (contentStart < lineEnd && text.charCodeAt(contentStart) === 32) contentStart++;
    let contentEnd = lineEnd;
    while (contentEnd > contentStart && text.charCodeAt(contentEnd - 1) === 32) contentEnd--;

    if (contentStart === contentEnd) {
      /**
       * Blank line: paragraph boundary, drops any pending junction
       */
      previousLineBlank = true;
      pendingJunction = 0;
    } else {
      const leadingSpaces = contentStart - lineStart;
      const trailingSpaces = lineEnd - contentEnd;

      /**
       * A paragraph-opening line with 4+ leading spaces would be indented
       * code (continuation lines may be indented arbitrarily).
       */
      if (previousLineBlank && leadingSpaces >= 4) return undefined;

      /**
       * A line whose content starts with a dash or an ordered-list marker
       * could open a list, thematic break or setext underline, or interrupt
       * the paragraph.
       */
      const first = text.charCodeAt(contentStart);
      if (first === 45 /* - */) return undefined;
      if (first >= 48 && first <= 57 /* 0-9 */) {
        let digitEnd = contentStart;
        while (digitEnd < contentEnd) {
          const code = text.charCodeAt(digitEnd);
          if (code < 48 || code > 57) break;
          digitEnd++;
        }
        const afterDigits = text.charCodeAt(digitEnd);
        if (afterDigits === 46 /* . */ || afterDigits === 41 /* ) */) return undefined;
      }

      /**
       * A line whose content disappears entirely with its link syntax (e.g.
       * only links with empty labels) would look like a paragraph break here
       * while the parser still sees a content line.
       */
      const lineSize = processedLineEnd - processedLineStart - leadingSpaces - trailingSpaces;
      if (lineSize <= 0) return undefined;

      size += pendingJunction + lineSize;

      /**
       * Junction to a potential next line: a soft break contributes one
       * newline character, a hard break (two or more trailing spaces)
       * contributes nothing.
       */
      pendingJunction = trailingSpaces >= 2 ? 0 : 1;
      previousLineBlank = false;
    }

    lineStart = lineEnd + 1;
    processedLineStart = processedLineEnd + 1;
  }

  return size;
};

/**
 * Calculate the content size of markdown content or AST node
 * Uses the actual text content without markdown formatting characters
 *
 * @param input - The markdown text or AST node to measure
 * @returns The size of the actual text content (without formatting)
 */
export const getContentSize = (input: string | Nodes): number => {
  if (!input) return 0;

  // If input is a string, size it directly when possible, else parse it first
  if (typeof input === 'string') {
    const fastSize = sizeCodeFence(input) ?? sizePlainProse(input);
    if (fastSize !== undefined) return fastSize;

    const ast = fromMarkdownForSizing(input);
    return getContentSize(ast);
  }

  // If input is already an AST node, extract text directly
  const plainText = toString(input);
  return plainText.length;
};

export const getRawSize = (input: string | Nodes): number => {
  if (!input) return 0;

  // If input is a string, return its length directly
  if (typeof input === 'string') {
    return input.length;
  }

  // If input is an AST node, use the position to calculate raw size
  if (input.position?.start?.offset !== undefined && input.position?.end?.offset !== undefined) {
    return input.position.end.offset - input.position.start.offset;
  }

  // Fallback: convert AST back to markdown and measure length
  const markdown = toMarkdown(input);
  return markdown.length;
};

export const getSectionSize = (section: Section): number => {
  let totalLength = 0;

  // Get heading text length if it exists (not a orphaned section)
  if (section.heading) {
    totalLength = getContentSize(section.heading);
  }

  // Add length of all children (content and nested sections)
  for (const child of section.children) {
    if (isSection(child)) {
      // Recursively calculate nested section size
      totalLength += getSectionSize(child);
    } else {
      // Get text length directly from child node
      totalLength += getContentSize(child);
    }
  }

  return totalLength;
};

/**
 * Split a single text by maxRawSize limit as a hard constraint on raw markdown length
 * Splits text that exceeds the limit, preferring whitespace boundaries
 *
 * @param text - The text to split
 * @param maxRawSize - Maximum raw character length per chunk
 * @returns Generator yielding chunks with no chunk exceeding maxRawSize
 */
export function* splitTextByMaxRawSize(text: string, maxRawSize: number): Generator<string> {
  let remaining = text;

  while (remaining.length > maxRawSize) {
    let splitPos = maxRawSize;
    let foundWhitespace = false;

    // Search backwards from maxRawSize for any whitespace
    // Only search in the last 20% to avoid creating very small chunks
    for (let i = maxRawSize - 1; i >= Math.floor(maxRawSize * 0.8); i--) {
      if (/\s/.test(remaining[i])) {
        splitPos = i;
        foundWhitespace = true;
        break;
      }
    }

    // Extract chunk - don't trim yet to preserve original position
    const splitChunk = remaining.substring(0, splitPos);

    // Move to remaining text, skipping whitespace if we split at whitespace
    remaining = foundWhitespace ? remaining.substring(splitPos).trim() : remaining.substring(splitPos);

    // Trim and yield the chunk if not empty
    const trimmedChunk = splitChunk.trim();
    if (trimmedChunk.length > 0) {
      yield trimmedChunk;
    }
  }

  if (remaining.length > 0) {
    yield remaining;
  }
}

/**
 * Split chunks by maxRawSize limit as a hard constraint on raw markdown length
 * Splits chunks that exceed the limit, preferring whitespace boundaries
 *
 * @deprecated Use splitTextByMaxRawSize for single strings
 * @param chunks - Array of markdown chunks
 * @param maxRawSize - Maximum raw character length per chunk
 * @returns Generator yielding chunks with no chunk exceeding maxRawSize
 */
export function* splitByMaxRawSize(chunks: string[], maxRawSize: number): Generator<string> {
  for (const chunk of chunks) {
    if (chunk.length <= maxRawSize) {
      yield chunk;
    } else {
      yield* splitTextByMaxRawSize(chunk, maxRawSize);
    }
  }
}
