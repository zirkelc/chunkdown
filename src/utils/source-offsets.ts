/**
 * Whether a character code is ASCII punctuation, the set a backslash escapes.
 */
const isAsciiPunctuation = (code: number): boolean =>
  (code >= 33 && code <= 47) ||
  (code >= 58 && code <= 64) ||
  (code >= 91 && code <= 96) ||
  (code >= 123 && code <= 126);

/**
 * Offset edits between a source slice and its serialization: `at` is a slice
 * index where a backslash was inserted or removed, `shift` the total change in
 * length up to and including that edit.
 */
export type OffsetEdits = Array<{ at: number; shift: number }>;

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
export const alignWithSource = (
  source: string,
  start: number,
  end: number,
  markdown: string,
): OffsetEdits | undefined => {
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
export const mapOffset = (offset: number, edits: OffsetEdits): number => {
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
 * Map an offset in the serialization back to the source slice, the inverse of
 * `mapOffset`. An offset on an inserted backslash or on the character after it
 * maps to that character in the source. An offset after a removed backslash
 * maps to the backslash, so the source range keeps it.
 *
 * The serialization offset of an edit is its slice index plus the shift
 * before it. These offsets increase with the edits, so the first edit at or
 * after the offset is found by binary search.
 */
export const unmapOffset = (offset: number, edits: OffsetEdits): number => {
  const shiftBefore = (index: number): number => (index === 0 ? 0 : edits[index - 1].shift);

  let low = 0;
  let high = edits.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (edits[mid].at + shiftBefore(mid) < offset) low = mid + 1;
    else high = mid;
  }

  /**
   * The offset is on the character after a backslash that the previous edit
   * inserted
   */
  if (low > 0) {
    const previous = edits[low - 1];
    const inserted = previous.shift > shiftBefore(low - 1);
    if (inserted && offset === previous.at + shiftBefore(low - 1) + 1) return previous.at;
  }

  return offset - shiftBefore(low);
};

export const WHITESPACE = /\s/;

/**
 * Shrink `[start, end)` so that it neither starts nor ends with whitespace.
 */
export const trimRange = (text: string, start: number, end: number): [number, number] => {
  while (start < end && WHITESPACE.test(text[start])) start++;
  while (end > start && WHITESPACE.test(text[end - 1])) end--;
  return [start, end];
};
