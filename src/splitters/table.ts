import type { Nodes, Root, Table, TableCell, TableRow } from 'mdast';
import { fromMarkdown, toMarkdown } from '../markdown';
import { getContentSize } from '../size';
import type { ComplexSplitRule, SplitterOptions } from '../types';
import { AbstractNodeSplitter } from './base';
import { TreeSplitter } from './tree';

/**
 * Whether a chunk of the table was emitted, which then showed the original
 * header row
 */
type HeaderState = { shown: boolean };

/**
 * Remove the whitespace at the ends of the content of a split cell. A part of
 * a cut cell keeps the whitespace at the cut and the final line ending of the
 * cut text, and a line ending in a cell breaks the table row. Nodes that are
 * empty after the trim are removed.
 */
const trimCellContent = (children: TableCell['children']): TableCell['children'] => {
  const trimmed = [...children];

  const trim = (index: number, side: 'start' | 'end'): void => {
    const node = trimmed[index];
    if (node.type !== 'text' && node.type !== 'html') return;
    const value = side === 'start' ? node.value.trimStart() : node.value.trimEnd();
    trimmed[index] = { ...node, value };
  };

  while (trimmed.length > 0) {
    trim(0, 'start');
    const first = trimmed[0];
    if ((first.type !== 'text' && first.type !== 'html') || first.value.length > 0) break;
    trimmed.shift();
  }

  while (trimmed.length > 0) {
    trim(trimmed.length - 1, 'end');
    const last = trimmed[trimmed.length - 1];
    if ((last.type !== 'text' && last.type !== 'html') || last.value.length > 0) break;
    trimmed.pop();
  }

  return trimmed;
};

/**
 * Table splitter
 */
export class TableSplitter extends AbstractNodeSplitter<Table> {
  private splitRule: ComplexSplitRule<Table> | undefined;

  constructor(options: SplitterOptions) {
    super(options);

    this.splitRule = this.splitRules.table;
  }

  splitText(text: string): Array<string> {
    const tree = fromMarkdown(text);
    const table = tree.children[0];
    if (table.type !== 'table') {
      throw new Error('Text is not a table');
    }
    const chunks = this.splitNode(table);
    return chunks.map((chunk) => toMarkdown(chunk).trim());
  }

  splitNode(table: Table): Array<Nodes> {
    const nodes: Array<Nodes> = [];

    for (const node of this.splitTable(table)) {
      nodes.push(node);
    }

    return nodes;
  }

  private *splitTable(table: Table): Generator<Nodes> {
    if (!this.canSplitNode(table)) {
      yield table;
      return;
    }

    if (table.children.length === 0) return;

    const headerRow = table.children[0];
    /**
     * Sub-tables after the first one repeat the header row, which is not at
     * that place in the source. The first table chunk keeps the original
     * header row, also when it is a mini-table of a row split into cells.
     */
    const repeatedHeaderRow: TableRow = { ...headerRow, data: { ...headerRow.data, synthetic: true } };
    const header: HeaderState = { shown: false };
    let subTable: Table = { ...table, children: [headerRow] };
    let subTableSize = 0; // Ignore header row in size calculation

    // Process rows starting from index 1 (skip header)
    for (let i = 1; i < table.children.length; i++) {
      const row = table.children[i];
      const rowSize = getContentSize(row);

      /**
       * If the current sub-table is too large, yield it and start a new sub-table
       */
      if (subTableSize + rowSize > this.maxAllowedSize) {
        if (subTable.children.length > 1) {
          // More than just header
          yield subTable;
          header.shown = true;
        }

        subTable = { ...table, children: [header.shown ? repeatedHeaderRow : headerRow] };
        subTableSize = 0;
      }

      /**
       * If the current row is too large, split it by cells and yield mini-tables
       */
      if (rowSize > this.maxAllowedSize) {
        for (const node of this.splitTableRow(table, headerRow, row, header)) {
          yield node;
        }

        subTable = { ...table, children: [header.shown ? repeatedHeaderRow : headerRow] };
        subTableSize = 0;

        continue;
      }

      /**
       * If the current row fits, add it to the sub-table
       */
      subTable.children.push(row);
      subTableSize += rowSize;
    }

    /**
     * If there are any remaining rows in the sub-table, yield it
     */
    if (subTable.children.length > 1) {
      // More than just header
      yield subTable;
    }
  }

  private *splitTableRow(table: Table, headerRow: TableRow, row: TableRow, header: HeaderState): Generator<Nodes> {
    /**
     * Create mini-tables for each cell, pairing it with its corresponding header cell
     */
    for (let cellIndex = 0; cellIndex < row.children.length; cellIndex++) {
      const cell = row.children[cellIndex];
      /**
       * GFM keeps cells beyond the header width in the row.
       * Such cells have no header cell, so pair them with an empty header cell.
       */
      const headerCell: TableCell = headerRow.children[cellIndex] ?? { type: 'tableCell', children: [] };

      /**
       * Create a mini-table with one column: header cell + data cell
       */
      const miniHeaderRow: TableRow = {
        type: 'tableRow',
        children: [headerCell],
        data: { synthetic: header.shown },
      };

      const miniDataRow: TableRow = {
        type: 'tableRow',
        children: [cell],
      };

      const miniTable: Table = {
        ...table,
        children: [miniHeaderRow, miniDataRow],
      };

      // Ignore header row in size calculation
      const miniTableSize = getContentSize(miniDataRow);

      /**
       * If the mini-table (single cell + header) is still too large,
       * split the cell content using the tree splitter
       */
      if (miniTableSize > this.maxAllowedSize) {
        for (const node of this.splitTableCell(table, headerCell, cell, header)) {
          yield node;
        }
      } else {
        yield miniTable;
        header.shown = true;
      }
    }
  }

  private *splitTableCell(table: Table, headerCell: TableCell, cell: TableCell, header: HeaderState): Generator<Nodes> {
    /**
     * Convert the cell content to a tree structure
     */
    const cellTree = {
      type: 'root' as const,
      children: cell.children,
    };

    /**
     * Split the cell content using the tree splitter
     */
    const treeSplitter = new TreeSplitter(this.options);
    const cellChunks = treeSplitter.splitNode(cellTree);

    /**
     * Create a mini-table for each chunk with the header cell
     */
    for (const chunk of cellChunks) {
      if (!('children' in chunk)) {
        continue;
      }

      const children = trimCellContent(chunk.children as TableCell['children']);
      if (children.length === 0) {
        continue;
      }

      const miniHeaderRow: TableRow = {
        type: 'tableRow',
        children: [headerCell],
        data: { synthetic: header.shown },
      };

      const splitCell: TableCell = {
        ...cell,
        children,
      };

      const miniDataRow: TableRow = {
        type: 'tableRow',
        children: [splitCell],
      };

      const miniTable: Table = {
        ...table,
        children: [miniHeaderRow, miniDataRow],
      };

      yield miniTable;
      header.shown = true;
    }
  }

  /**
   * Helper method to wrap or unwrap a table based on the split strategy
   * If strategy is 'extend-table-header', keep the table structure
   * Otherwise, unwrap to Root with only the data rows (skip header for non-first chunks)
   */
  // private wrapOrUnwrapTable(table: Table, isFirstChunk: boolean): Nodes {
  //   const shouldExtendHeader =
  //     'strategy' in this.splitRule &&
  //     this.splitRule.strategy === 'extend-table-header';

  //   if (shouldExtendHeader) {
  //     return table;
  //   } else {
  //     // For first chunk: keep the header row
  //     // For subsequent chunks: unwrap and return only data rows
  //     if (isFirstChunk) {
  //       return table;
  //     } else {
  //       // Unwrap: return Root with data rows only (skip header)
  //       const dataRows = table.children.slice(1);
  //       return {
  //         type: 'root',
  //         children: dataRows,
  //       } as Root;
  //     }
  //   }
  // }
}
