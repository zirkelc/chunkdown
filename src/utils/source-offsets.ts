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

export const WHITESPACE = /\s/;

// Shrink `[start, end)` so that it neither starts nor ends with whitespace
export const trimRange = (text: string, start: number, end: number): [number, number] => {
  while (start < end && WHITESPACE.test(text[start])) start++;
  while (end > start && WHITESPACE.test(text[end - 1])) end--;
  return [start, end];
};

// Characters of a line prefix: indentation and blockquote markers
const LINE_PREFIX = /[ \t>]/;

/**
 * The largest number of inserted and deleted tokens for which a source region
 * and its written-out text are aligned. The work and the memory of the
 * alignment grow with this number.
 */
const MAX_EDITS = 2_000;

/**
 * A run of characters that is the same in the source and in the written-out
 * text, at `source` in the source and at `text` in the written-out text.
 */
type Run = { source: number; text: number; length: number };

/**
 * The alignment of a source region with its written-out text: the runs of
 * equal characters in order. The characters between two runs are syntax that
 * the serializer changed (an escape, a list marker, a code fence, the
 * indentation of a line).
 */
export type TextAlignment = {
  runs: Array<Run>;
  sourceStart: number;
  sourceEnd: number;
  textLength: number;
};

const isWordCode = (code: number): boolean =>
  (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code >= 128;

const isBlankCode = (code: number): boolean => code === 32 || code === 9;

/**
 * The start offsets of the tokens of `text` in `[from, to)`, followed by `to`.
 * A token is a run of word characters, a run of spaces and tabs, or one other
 * character. A token also ends at each offset in `breaks`.
 */
const tokenize = (text: string, from: number, to: number, breaks?: Uint8Array): Array<number> => {
  const starts: Array<number> = [];
  let i = from;
  while (i < to) {
    starts.push(i);
    const code = text.charCodeAt(i);
    const inRun = isWordCode(code) ? isWordCode : isBlankCode(code) ? isBlankCode : undefined;
    i++;
    if (inRun) {
      while (i < to && breaks?.[i] !== 1 && inRun(text.charCodeAt(i))) i++;
    }
  }
  starts.push(to);
  return starts;
};

/**
 * The synthetic characters of a written-out text, and the offsets where a
 * token must end because a synthetic range starts or ends there.
 */
type SyntheticMask = { chars: Uint8Array; breaks: Uint8Array };

/**
 * The pairs `[source, text]` that form the longest sequence that is increasing
 * in both. `pairs` must be sorted by their text index.
 */
const increasingPairs = (pairs: Array<[number, number]>): Array<[number, number]> => {
  const tails: Array<number> = [];
  const previous = new Int32Array(pairs.length).fill(-1);
  for (let i = 0; i < pairs.length; i++) {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (pairs[tails[mid]][0] < pairs[i][0]) low = mid + 1;
      else high = mid;
    }
    if (low > 0) previous[i] = tails[low - 1];
    tails[low] = i;
  }

  const sequence: Array<[number, number]> = [];
  for (let i = tails.length > 0 ? tails[tails.length - 1] : -1; i >= 0; i = previous[i]) sequence.push(pairs[i]);
  return sequence.reverse();
};

/**
 * The number of tokens above which equal words are paired before the
 * shortest edit script runs. A shorter text is aligned by the shortest edit
 * script alone.
 */
const WORD_ANCHOR_TOKENS = 64;

/**
 * Word tokens that occur equally often in the source and in the text, paired
 * in their order of occurrence (the first with the first, the second with the
 * second), in the longest order that is increasing in both. The serializer
 * changes syntax but keeps the words, so these pairs split a long alignment
 * into short ones also when no line is unique (a list of equal items, the
 * links of one long paragraph).
 */
const wordAnchors = (
  sourceTokens: Int32Array,
  textTokens: Int32Array,
  isWord: Array<boolean>,
): Array<[number, number]> => {
  const occurrences = (tokens: Int32Array): Map<number, Array<number>> => {
    const found = new Map<number, Array<number>>();
    for (let i = 0; i < tokens.length; i++) {
      const id = tokens[i];
      if (id < 0 || !isWord[id]) continue;
      const indexes = found.get(id);
      if (indexes) indexes.push(i);
      else found.set(id, [i]);
    }
    return found;
  };
  const sourceOccurrences = occurrences(sourceTokens);
  const textOccurrences = occurrences(textTokens);

  const pairs: Array<[number, number]> = [];
  for (const [id, sourceIndexes] of sourceOccurrences) {
    const textIndexes = textOccurrences.get(id);
    if (textIndexes?.length !== sourceIndexes.length) continue;
    for (let i = 0; i < sourceIndexes.length; i++) pairs.push([sourceIndexes[i], textIndexes[i]]);
  }
  pairs.sort((p, q) => p[1] - q[1]);
  return increasingPairs(pairs);
};

/**
 * Align the tokens `[x0, x1)` of the source with the tokens `[y0, y1)` of the
 * text by a shortest edit script (Myers), and report the runs of equal tokens
 * in order. Returns false when the two differ in more than `MAX_EDITS` tokens.
 */
const diffTokens = (
  sourceTokens: Int32Array,
  x0: number,
  x1: number,
  textTokens: Int32Array,
  y0: number,
  y1: number,
  addRun: (x: number, y: number, length: number) => void,
): boolean => {
  // Equal tokens at the start and at the end need no search
  let prefix = 0;
  while (x0 + prefix < x1 && y0 + prefix < y1 && sourceTokens[x0 + prefix] === textTokens[y0 + prefix]) prefix++;
  if (prefix > 0) addRun(x0, y0, prefix);
  x0 += prefix;
  y0 += prefix;
  let suffix = 0;
  while (x0 < x1 - suffix && y0 < y1 - suffix && sourceTokens[x1 - 1 - suffix] === textTokens[y1 - 1 - suffix]) {
    suffix++;
  }
  x1 -= suffix;
  y1 -= suffix;

  const n = x1 - x0;
  const m = y1 - y0;
  const max = Math.min(n + m, MAX_EDITS);
  // Each token that one side has more than the other is an edit
  if (Math.abs(n - m) > max) return false;

  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Array<Int32Array> = [];
  let distance = -1;

  search: for (let d = 0; d <= max; d++) {
    // The furthest points of the previous step, for the diagonals `-d - 1` to `d + 1`
    trace.push(v.slice(offset - d - 1, offset + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x =
        k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && sourceTokens[x0 + x] === textTokens[y0 + y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        distance = d;
        break search;
      }
    }
  }
  if (distance < 0) return false;

  // Walk the steps back from the end and collect the runs of equal tokens
  const found: Array<[number, number, number]> = [];
  let x = n;
  let y = m;
  for (let d = distance; d > 0; d--) {
    const previous = trace[d];
    const at = (k: number): number => previous[k + d + 1];
    const k = x - y;
    const down = k === -d || (k !== d && at(k - 1) < at(k + 1));
    const previousK = down ? k + 1 : k - 1;
    const previousX = at(previousK);
    const runX = down ? previousX : previousX + 1;
    if (x > runX) found.push([runX, runX - k, x - runX]);
    x = previousX;
    y = previousX - previousK;
  }
  if (x > 0) found.push([0, 0, x]);

  for (let i = found.length - 1; i >= 0; i--) addRun(x0 + found[i][0], y0 + found[i][1], found[i][2]);
  if (suffix > 0) addRun(x1, y1, suffix);
  return true;
};

/**
 * Align the source `[sourceFrom, sourceTo)` with the text `[textFrom, textTo)`
 * over their tokens, and add the runs of equal characters to `runs` in order.
 * A long part is first split at paired words, and each piece is aligned by a
 * shortest edit script. Synthetic tokens never match. Returns false when a
 * piece differs in more than `MAX_EDITS` tokens.
 */
const alignTokens = (
  source: string,
  sourceFrom: number,
  sourceTo: number,
  text: string,
  textFrom: number,
  textTo: number,
  mask: SyntheticMask | undefined,
  runs: Array<Run>,
): boolean => {
  const sourceStarts = tokenize(source, sourceFrom, sourceTo);
  const textStarts = tokenize(text, textFrom, textTo, mask?.breaks);

  /**
   * Equal tokens get equal ids, and a synthetic token gets an id of its own.
   * A `_` gets the id of `*`, because the serializer writes emphasis with `*`.
   */
  const ids = new Map<string, number>();
  const isWord: Array<boolean> = [];
  const toIds = (value: string, starts: Array<number>, synthetic?: Uint8Array): Int32Array => {
    const tokens = new Int32Array(starts.length - 1);
    for (let i = 0; i < tokens.length; i++) {
      if (synthetic?.[starts[i]] === 1) {
        tokens[i] = -1 - i;
        continue;
      }
      const slice = value.slice(starts[i], starts[i + 1]);
      const token = slice === '_' ? '*' : slice;
      let id = ids.get(token);
      if (id === undefined) {
        id = ids.size;
        ids.set(token, id);
        isWord.push(isWordCode(token.charCodeAt(0)));
      }
      tokens[i] = id;
    }
    return tokens;
  };
  const sourceTokens = toIds(source, sourceStarts);
  const textTokens = toIds(text, textStarts, mask?.chars);
  const n = sourceTokens.length;
  const m = textTokens.length;

  // Add a run of equal tokens, and join it to the previous run when they touch
  const addRun = (x: number, y: number, length: number): void => {
    const sourceOffset = sourceStarts[x];
    const textOffset = textStarts[y];
    const runLength = sourceStarts[x + length] - sourceOffset;
    const last = runs[runs.length - 1];
    if (last && last.source + last.length === sourceOffset && last.text + last.length === textOffset) {
      last.length += runLength;
    } else {
      runs.push({ source: sourceOffset, text: textOffset, length: runLength });
    }
  };

  const anchors = n + m > WORD_ANCHOR_TOKENS ? wordAnchors(sourceTokens, textTokens, isWord) : [];
  let x = 0;
  let y = 0;
  for (const [anchorX, anchorY] of anchors) {
    if (!diffTokens(sourceTokens, x, anchorX, textTokens, y, anchorY, addRun)) return false;
    addRun(anchorX, anchorY, 1);
    x = anchorX + 1;
    y = anchorY + 1;
  }
  return diffTokens(sourceTokens, x, n, textTokens, y, m, addRun);
};

/**
 * The end of the list item marker (`-`, `*`, `+`, `1.` or `1)`) at `start`,
 * or `start` when there is no marker. A marker is followed by a space, a tab
 * or the end of the line.
 */
const listMarkerEnd = (value: string, start: number, lineEnd: number): number => {
  let end = start;
  const code = value.charCodeAt(start);
  if (code === 45 /* - */ || code === 42 /* * */ || code === 43 /* + */) {
    end = start + 1;
  } else {
    while (end < lineEnd && end - start < 9 && value.charCodeAt(end) >= 48 && value.charCodeAt(end) <= 57) end++;
    const delimiter = value.charCodeAt(end);
    if (end === start || (delimiter !== 46 /* . */ && delimiter !== 41) /* ) */) return start;
    end++;
  }
  if (end < lineEnd && !WHITESPACE.test(value[end])) return start;
  return end;
};

/**
 * The content of each line of `[from, to)` as a `[start, end)` pair: the line
 * without its line prefix (indentation, blockquote markers and list item
 * markers), its trailing spaces and its line ending. The serializer can
 * change all of these, for example when it writes a code block of a list item
 * without the indentation of the item, `*` for `-`, or `\n` for `\r\n`.
 * Lines without content are left out.
 */
const lineContents = (value: string, from: number, to: number): Array<[number, number]> => {
  const contents: Array<[number, number]> = [];
  let lineStart = from;
  while (lineStart < to) {
    let lineEnd = value.indexOf('\n', lineStart);
    if (lineEnd < 0 || lineEnd >= to) lineEnd = to;

    let contentStart = lineStart;
    for (;;) {
      while (contentStart < lineEnd && LINE_PREFIX.test(value[contentStart])) contentStart++;
      const markerEnd = listMarkerEnd(value, contentStart, lineEnd);
      if (markerEnd === contentStart) break;
      contentStart = markerEnd;
    }
    let contentEnd = lineEnd;
    while (contentEnd > contentStart && WHITESPACE.test(value[contentEnd - 1])) contentEnd--;
    if (contentEnd > contentStart) contents.push([contentStart, contentEnd]);

    lineStart = lineEnd + 1;
  }
  return contents;
};

/**
 * Line contents that are equal in the source and in the text and occur only
 * once in each, in an order that is increasing in both (the longest such
 * sequence, as in a patience diff). They split a long alignment into short
 * ones. A line with a synthetic character is never an anchor.
 */
const lineAnchors = (
  source: string,
  sourceFrom: number,
  sourceTo: number,
  text: string,
  textFrom: number,
  textTo: number,
  mask: SyntheticMask | undefined,
): Array<{ source: [number, number]; text: [number, number] }> => {
  const sourceLines = lineContents(source, sourceFrom, sourceTo);
  const textLines = lineContents(text, textFrom, textTo);

  // For each line content: the number of times it occurs in the source and in the text, and its last index
  const counts = new Map<string, { source: number; text: number; sourceIndex: number; textIndex: number }>();
  const entry = (line: string) => {
    let found = counts.get(line);
    if (found === undefined) {
      found = { source: 0, text: 0, sourceIndex: -1, textIndex: -1 };
      counts.set(line, found);
    }
    return found;
  };
  sourceLines.forEach(([lineStart, lineEnd], index) => {
    const found = entry(source.slice(lineStart, lineEnd));
    found.source++;
    found.sourceIndex = index;
  });
  textLines.forEach(([lineStart, lineEnd], index) => {
    if (mask?.chars.subarray(lineStart, lineEnd).includes(1)) return;
    const found = entry(text.slice(lineStart, lineEnd));
    found.text++;
    found.textIndex = index;
  });

  // The unique pairs in the order of the text, and their longest run that is increasing in the source
  const pairs: Array<[number, number]> = [];
  for (const found of counts.values()) {
    if (found.source === 1 && found.text === 1) pairs.push([found.sourceIndex, found.textIndex]);
  }
  pairs.sort((p, q) => p[1] - q[1]);

  return increasingPairs(pairs).map(([sourceIndex, textIndex]) => ({
    source: sourceLines[sourceIndex],
    text: textLines[textIndex],
  }));
};

/**
 * Align the source region `[start, end)` with its written-out text. The
 * written-out text has the same content in the same order, so the alignment
 * keeps all content and marks only syntax as changed. Equal lines that occur
 * once in both texts are anchors. The parts between them are split again at
 * paired words, and each piece is aligned by a shortest edit script over its
 * tokens. Equal tokens are equal strings, so the characters in them map
 * exactly. The `synthetic` ranges of the written-out text are not in the
 * source region (for example a repeated table header), so they never match
 * the source. Returns undefined when a piece differs in more than
 * `MAX_EDITS` tokens.
 */
export const alignText = (
  source: string,
  start: number,
  end: number,
  text: string,
  synthetic: Array<[number, number]> = [],
): TextAlignment | undefined => {
  const textLength = text.length;

  let mask: SyntheticMask | undefined;
  if (synthetic.length > 0) {
    mask = { chars: new Uint8Array(textLength), breaks: new Uint8Array(textLength + 1) };
    for (const [from, to] of synthetic) {
      mask.chars.fill(1, from, to);
      mask.breaks[from] = 1;
      mask.breaks[to] = 1;
    }
  }
  const same = (sourceIndex: number, textIndex: number): boolean =>
    source.charCodeAt(sourceIndex) === text.charCodeAt(textIndex) && mask?.chars[textIndex] !== 1;

  let prefix = 0;
  while (start + prefix < end && prefix < textLength && same(start + prefix, prefix)) {
    prefix++;
  }
  let suffix = 0;
  while (
    start + prefix + suffix < end &&
    prefix + suffix < textLength &&
    same(end - 1 - suffix, textLength - 1 - suffix)
  ) {
    suffix++;
  }

  const runs: Array<Run> = [];
  if (prefix > 0) runs.push({ source: start, text: 0, length: prefix });

  let sourceFrom = start + prefix;
  let textFrom = prefix;
  const sourceTo = end - suffix;
  const textTo = textLength - suffix;
  for (const anchor of lineAnchors(source, sourceFrom, sourceTo, text, textFrom, textTo, mask)) {
    if (!alignTokens(source, sourceFrom, anchor.source[0], text, textFrom, anchor.text[0], mask, runs))
      return undefined;
    runs.push({ source: anchor.source[0], text: anchor.text[0], length: anchor.source[1] - anchor.source[0] });
    [, sourceFrom] = anchor.source;
    [, textFrom] = anchor.text;
  }
  if (!alignTokens(source, sourceFrom, sourceTo, text, textFrom, textTo, mask, runs)) return undefined;

  if (suffix > 0) runs.push({ source: end - suffix, text: textLength - suffix, length: suffix });

  return { runs, sourceStart: start, sourceEnd: end, textLength };
};

/**
 * The index of the first run that ends after `offset` in the written-out
 * text, or the number of runs when there is none.
 */
const runAfter = (runs: Array<Run>, offset: number): number => {
  let low = 0;
  let high = runs.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (runs[mid].text + runs[mid].length <= offset) low = mid + 1;
    else high = mid;
  }
  return low;
};

/**
 * Map the part `[start, end)` of the written-out text to its source region,
 * without whitespace at its ends. Undefined when the part has no text from
 * the source (it contains only syntax that the serializer inserted).
 *
 * The start and the end of the text map to the start and the end of the
 * source region, so the first part includes the syntax before its text (a
 * list or blockquote marker). An offset in a run of equal text maps exactly.
 * Otherwise the start of a part moves forward to the next equal text, and
 * the end of a part moves back to the previous equal text. So changed syntax
 * between two parts (for example the blockquote markers of a line) is in
 * neither region, and the regions of two parts never overlap.
 */
export const toSourceRange = (
  alignment: TextAlignment,
  source: string,
  start: number,
  end: number,
): [number, number] | undefined => {
  const { runs, sourceStart, sourceEnd, textLength } = alignment;

  let from = sourceStart;
  if (start > 0) {
    const run = runs[runAfter(runs, start)];
    if (run === undefined) from = sourceEnd;
    else from = run.source + Math.max(0, start - run.text);
  }

  let to = sourceEnd;
  if (end < textLength) {
    const index = runAfter(runs, end - 1);
    const run = runs[index];
    if (run !== undefined && run.text < end) to = run.source + (end - run.text);
    else if (index > 0) to = runs[index - 1].source + runs[index - 1].length;
    else to = sourceStart;
  }

  [from, to] = trimRange(source, from, to);
  return from < to ? [from, to] : undefined;
};
