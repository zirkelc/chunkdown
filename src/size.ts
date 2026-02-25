import type { Nodes } from 'mdast';
import { isSection, type Section } from './ast';
import { fromMarkdown, toMarkdown, toString } from './markdown';

/**
 * Calculate the content size of markdown content or AST node
 * Uses the actual text content without markdown formatting characters
 *
 * @param input - The markdown text or AST node to measure
 * @returns The size of the actual text content (without formatting)
 */
export const getContentSize = (input: string | Nodes): number => {
  if (!input) return 0;

  // If input is a string, parse it first
  if (typeof input === 'string') {
    const ast = fromMarkdown(input);
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
