import type { Nodes } from 'mdast';
import { isSection, type Section } from './ast';
import { fromMarkdownForSizing, toMarkdown, toString } from './markdown';

/**
 * Characters (and CR/tab) whose presence means the text may parse as
 * something other than plain paragraphs, so the fast sizer must not be used.
 * Conservative by design: any hit falls back to a real parse.
 */
const NOT_PLAIN_PROSE = /[\\`*_[\]<>#~|&+=\t\r]/;

/**
 * Compute the plain-text content size of markdown that consists only of plain
 * paragraphs, without parsing. Returns undefined when the text might contain
 * any other construct.
 *
 * Mirrors what parsing and text extraction would produce for such input:
 * every line loses its leading and trailing spaces, consecutive lines of a
 * paragraph are joined by a newline unless the previous line ends in a hard
 * break (two or more trailing spaces, which contributes nothing), and
 * paragraph boundaries contribute nothing.
 */
const sizePlainProse = (text: string): number | undefined => {
  if (NOT_PLAIN_PROSE.test(text)) return undefined;

  let size = 0;
  let previousLineBlank = true;
  let pendingJunction = 0;

  let lineStart = 0;
  const length = text.length;

  while (lineStart <= length) {
    let lineEnd = text.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = length;

    /**
     * Strip leading and trailing spaces of this line
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

      size += pendingJunction + (contentEnd - contentStart);

      /**
       * Junction to a potential next line: a soft break contributes one
       * newline character, a hard break (two or more trailing spaces)
       * contributes nothing.
       */
      const trailingSpaces = lineEnd - contentEnd;
      pendingJunction = trailingSpaces >= 2 ? 0 : 1;
      previousLineBlank = false;
    }

    lineStart = lineEnd + 1;
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
    const proseSize = sizePlainProse(input);
    if (proseSize !== undefined) return proseSize;

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
