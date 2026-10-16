import type { Nodes, Parent, Root, Table } from 'mdast';
import { fromMarkdown } from './markdown';
import type { ChunkPoint } from './types';
import { trimRange } from './utils/source-offsets';

type Position = NonNullable<Nodes['position']>;

/**
 * The children of a parsed parent node when the split started.
 */
type SourceChildren = {
  children: Parent['children'];
  length: number;
};

/**
 * Parsed parent nodes keyed by their position object. Splitters copy a parent
 * with a spread (`{ ...list, children }`) when they keep only some of its
 * children, and a copy shares the position object of its original. The key
 * finds the original children of such a copy, so the copy's own position is
 * only used where it starts or ends with the same child as the original.
 */
export type SourceNodes = WeakMap<Position, SourceChildren>;

/**
 * Record the children of every parsed parent node. Must run after the tree is
 * preprocessed and before it is split.
 */
export const recordSourceNodes = (root: Root): SourceNodes => {
  const nodes: SourceNodes = new WeakMap();

  const visit = (parent: Parent): void => {
    for (const child of parent.children) {
      if (!('children' in child)) continue;
      if (child.position) {
        nodes.set(child.position, { children: child.children, length: child.children.length });
      }
      visit(child);
    }
  };
  visit(root);

  return nodes;
};

/**
 * The smallest start and the largest end offset of the source nodes in a
 * subtree, or undefined when the subtree has no source node.
 *
 * - A node marked as synthetic is skipped with its subtree.
 * - A leaf counts with its own position.
 * - A parsed parent with all its children counts with its own position, so
 *   its syntax (a list marker, the `#` of a heading) is part of the range.
 * - Any other parent (a root, a section, a copy with only some children)
 *   counts with the range of its children. The own position of a copy is used
 *   only for the side where its children start where the original first child
 *   starts, or end where the original last child ends (also when that child
 *   is itself cut into parts).
 */
export const sourceRange = (node: Nodes, sourceNodes: SourceNodes): [number, number] | undefined => {
  if (node.data?.synthetic) return undefined;

  const start = node.position?.start?.offset;
  const end = node.position?.end?.offset;

  if (!('children' in node)) {
    return start !== undefined && end !== undefined ? [start, end] : undefined;
  }

  const { children } = node;
  const original = node.type !== 'root' && node.position ? sourceNodes.get(node.position) : undefined;
  const hasOffsets = original !== undefined && start !== undefined && end !== undefined;

  if (hasOffsets && original.children === children && original.length === children.length) {
    return [start, end];
  }

  let range: [number, number] | undefined;
  for (const child of children) {
    const childRange = sourceRange(child, sourceNodes);
    if (childRange === undefined) continue;
    if (range === undefined) {
      range = childRange;
    } else {
      range[0] = Math.min(range[0], childRange[0]);
      range[1] = Math.max(range[1], childRange[1]);
    }
  }

  if (hasOffsets && range !== undefined) {
    const firstStart = original.children[0]?.position?.start?.offset;
    const lastEnd = original.children[original.length - 1]?.position?.end?.offset;
    if (range[0] === firstStart) range[0] = start;
    if (range[1] === lastEnd) range[1] = end;
  }

  return range;
};

/**
 * The source range of a chunk: the range of its source nodes without
 * whitespace at the ends (a table cell includes the spaces before the next
 * pipe). Undefined when the chunk has no source node.
 */
export const chunkRange = (node: Nodes, sourceNodes: SourceNodes, text: string): [number, number] | undefined => {
  const range = sourceRange(node, sourceNodes);
  if (range === undefined) return undefined;

  const [start, end] = trimRange(text, range[0], range[1]);
  return start < end ? [start, end] : undefined;
};

const collectTables = (node: Nodes, tables: Array<Table> = []): Array<Table> => {
  if (node.type === 'table') tables.push(node);
  else if ('children' in node) for (const child of node.children) collectTables(child, tables);
  return tables;
};

/**
 * The ranges of the written-out text of a chunk that come from synthetic
 * table rows. The text is parsed again, and its tables are paired in order
 * with the tables of the chunk. A synthetic header row covers its line and
 * the delimiter line after it. Undefined when the tables cannot be paired.
 */
export const syntheticRanges = (node: Nodes, markdown: string): Array<[number, number]> | undefined => {
  const tables = collectTables(node);
  if (!tables.some((table) => table.children.some((row) => row.data?.synthetic))) return [];

  const parsed = collectTables(fromMarkdown(markdown));
  if (parsed.length !== tables.length) return undefined;

  const ranges: Array<[number, number]> = [];
  for (let t = 0; t < tables.length; t++) {
    const rows = tables[t].children;
    const parsedRows = parsed[t].children;
    if (parsedRows.length !== rows.length) return undefined;

    for (let i = 0; i < rows.length; i++) {
      if (!rows[i].data?.synthetic) continue;
      const start = parsedRows[i].position?.start.offset;
      // A header row ends where the next row starts, so the delimiter line is included
      const end =
        i > 0
          ? parsedRows[i].position?.end.offset
          : parsedRows[1]
            ? parsedRows[1].position?.start.offset
            : parsed[t].position?.end.offset;
      if (start === undefined || end === undefined) return undefined;
      ranges.push([start, end]);
    }
  }
  return ranges;
};

/**
 * Offsets where the lines of a text start. A line ends at `\n`, `\r\n` or a
 * `\r` that is not followed by `\n`, as in mdast.
 */
export const lineStarts = (text: string): Array<number> => {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 10 /* \n */ || (code === 13 /* \r */ && text.charCodeAt(i + 1) !== 10)) {
      starts.push(i + 1);
    }
  }
  return starts;
};

/**
 * Convert an offset to a point with its 1-based line. `shift` is added to the
 * offset of the point, after the line is found.
 */
export const toPoint = (offset: number, starts: Array<number>, shift = 0): ChunkPoint => {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >>> 1;
    if (starts[mid] <= offset) low = mid;
    else high = mid - 1;
  }
  return { line: low + 1, offset: offset + shift };
};
