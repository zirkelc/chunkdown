import type { Table, TableCell, TableRow } from 'mdast';
import { fromMarkdown, toMarkdown } from '../markdown';
import { getContentSize } from '../size';
import { AbstractNodeSplitter } from './base';
import { MarkdownTreeSplitter } from './tree';

export class TableSplitter extends AbstractNodeSplitter<Table> {
  splitText(text: string): Array<string> {
    const tree = fromMarkdown(text);
    const table = tree.children[0];
    if (table.type !== 'table') {
      throw new Error('Text is not a table');
    }
    const chunks = this.splitNode(table);
    return chunks.map((chunk) => toMarkdown(chunk).trim());
  }

  splitNode(table: Table): Array<Table> {
    const subTables: Array<Table> = [];

    for (const subTable of this.splitTable(table)) {
      subTables.push(subTable);
    }

    return subTables;
  }

  private *splitTable(table: Table): Generator<Table> {
    if (table.children.length === 0) return;

    // TODO ignore header row in size calculation?

    const headerRow = table.children[0];
    let subTable: Table = { ...table, children: [headerRow] };
    let subTableSize = getContentSize({ ...table, children: [headerRow] });

    // Process rows starting from index 1 (skip header)
    for (let i = 1; i < table.children.length; i++) {
      const row = table.children[i];
      const rowNode = { ...table, children: [row] };
      const rowSize = getContentSize(rowNode);

      /**
       * If the current sub-table is too large, yield it and start a new sub-table
       */
      if (subTableSize + rowSize > this.maxAllowedSize) {
        if (subTable.children.length > 1) {
          // More than just header
          yield subTable;
        }

        subTable = { ...table, children: [headerRow] };
        subTableSize = getContentSize({ ...table, children: [headerRow] });
      }

      /**
       * If the current row is too large, split it by cells and yield mini-tables
       */
      if (rowSize > this.maxAllowedSize) {
        for (const miniTable of this.splitTableRow(table, headerRow, row)) {
          yield miniTable;
        }

        subTable = { ...table, children: [headerRow] };
        subTableSize = getContentSize({ ...table, children: [headerRow] });

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

  private *splitTableRow(
    table: Table,
    headerRow: TableRow,
    row: TableRow,
  ): Generator<Table> {
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

      const miniTableSize = getContentSize(miniTable);

      /**
       * If the mini-table (single cell + header) is still too large,
       * split the cell content using the tree splitter
       */
      if (miniTableSize > this.maxAllowedSize) {
        for (const splitMiniTable of this.splitTableCell(
          table,
          headerCell,
          cell,
        )) {
          yield splitMiniTable;
        }
      } else {
        yield miniTable;
      }
    }
  }

  private *splitTableCell(
    table: Table,
    headerCell: TableCell,
    cell: TableCell,
  ): Generator<Table> {
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
    const treeSplitter = new MarkdownTreeSplitter(this.options);
    const cellChunks = treeSplitter.splitNode(cellTree);

    /**
     * Create a mini-table for each chunk, with the header cell
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
}
