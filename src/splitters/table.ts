import type { Nodes, Root, Table, TableCell, TableRow } from 'mdast';
import { fromMarkdown, toMarkdown } from '../markdown';
import { getContentSize } from '../size';
import type { ComplexSplitRule, SplitterOptions } from '../types';
import { AbstractNodeSplitter } from './base';
import { TreeSplitter } from './tree';

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
        }

        subTable = { ...table, children: [headerRow] };
        subTableSize = 0;
      }

      /**
       * If the current row is too large, split it by cells and yield mini-tables
       */
      if (rowSize > this.maxAllowedSize) {
        for (const node of this.splitTableRow(table, headerRow, row)) {
          yield node;
        }

        subTable = { ...table, children: [headerRow] };
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

  private *splitTableRow(table: Table, headerRow: TableRow, row: TableRow): Generator<Nodes> {
    /**
     * Create mini-tables for each cell, pairing it with its corresponding header cell
     */
    for (let cellIndex = 0; cellIndex < row.children.length; cellIndex++) {
      const cell = row.children[cellIndex];
      const headerCell = headerRow.children[cellIndex];

      /**
       * Create a mini-table with one column: header cell + data cell
       */
      const miniHeaderRow: TableRow = {
        type: 'tableRow',
        children: [headerCell],
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
        for (const node of this.splitTableCell(table, headerCell, cell)) {
          yield node;
        }
      } else {
        yield miniTable;
      }
    }
  }

  private *splitTableCell(table: Table, headerCell: TableCell, cell: TableCell): Generator<Nodes> {
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
      if (!('children' in chunk) || chunk.children.length === 0) {
        continue;
      }

      const miniHeaderRow: TableRow = {
        type: 'tableRow',
        children: [headerCell],
      };

      const splitCell: TableCell = {
        ...cell,
        children: chunk.children as TableCell['children'],
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
