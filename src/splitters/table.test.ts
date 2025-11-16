import { describe, expect, it } from 'vitest';
import { TableSplitter } from './table';

describe('TableSplitter', () => {
  const text = `| Col A   | Col B   |
|---------|---------|
| Row A1  | Row B1  |
| Row A2  | Row B2  |
| Row A3  | Row B3  |
| Row A4  | Row B4  |`;

  it('should not split tables if they fit', () => {
    const splitter = new TableSplitter({
      chunkSize: 60,
      maxOverflowRatio: 1.0,
    });

    const chunks = splitter.splitText(text);

    expect(chunks.length).toBe(1);
    expect(chunks).toEqual([
      `| Col A | Col B |
| - | - |
| Row A1 | Row B1 |
| Row A2 | Row B2 |
| Row A3 | Row B3 |
| Row A4 | Row B4 |`,
    ]);
  });

  it('should split tables', () => {
    const splitter = new TableSplitter({
      chunkSize: 30,
      maxOverflowRatio: 1.0,
    });

    const chunks = splitter.splitText(text);

    expect(chunks.length).toBe(2);
    expect(chunks).toEqual([
      `| Col A | Col B |
| - | - |
| Row A1 | Row B1 |
| Row A2 | Row B2 |`,
      `| Col A | Col B |
| - | - |
| Row A3 | Row B3 |
| Row A4 | Row B4 |`,
    ]);
  });

  it('should split table by rows', () => {
    const splitter = new TableSplitter({
      chunkSize: 15,
      maxOverflowRatio: 1.0,
    });

    const chunks = splitter.splitText(text);

    expect(chunks.length).toBe(4);
    expect(chunks).toEqual([
      `| Col A | Col B |
| - | - |
| Row A1 | Row B1 |`,
      `| Col A | Col B |
| - | - |
| Row A2 | Row B2 |`,
      `| Col A | Col B |
| - | - |
| Row A3 | Row B3 |`,
      `| Col A | Col B |
| - | - |
| Row A4 | Row B4 |`,
    ]);
  });

  describe('Rules', () => {
    it('should split tables if rules are undefined', () => {
      const splitter = new TableSplitter({
        chunkSize: 30,
        maxOverflowRatio: 1.0,
        rules: { table: undefined },
      });
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(2);
      expect(chunks).toEqual([
        `| Col A | Col B |
| - | - |
| Row A1 | Row B1 |
| Row A2 | Row B2 |`,
        `| Col A | Col B |
| - | - |
| Row A3 | Row B3 |
| Row A4 | Row B4 |`,
      ]);
    });

    it('should split tables if rules are set to allow-split', () => {
      const splitter = new TableSplitter({
        chunkSize: 30,
        maxOverflowRatio: 1.0,
        rules: { table: { split: { rule: 'allow-split' } } },
      });
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(2);
      expect(chunks).toEqual([
        `| Col A | Col B |
| - | - |
| Row A1 | Row B1 |
| Row A2 | Row B2 |`,
        `| Col A | Col B |
| - | - |
| Row A3 | Row B3 |
| Row A4 | Row B4 |`,
      ]);
    });

    it('should not split tables if rules are set to never-split', () => {
      const splitter = new TableSplitter({
        chunkSize: 30,
        maxOverflowRatio: 1.0,
        rules: { table: { split: { rule: 'never-split' } } },
      });

      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toBe(
        `| Col A | Col B |
| - | - |
| Row A1 | Row B1 |
| Row A2 | Row B2 |
| Row A3 | Row B3 |
| Row A4 | Row B4 |`,
      );
    });

    it('should split tables if exceeds size limit', () => {
      const splitter = new TableSplitter({
        chunkSize: 30,
        maxOverflowRatio: 1.0,
        rules: { table: { split: { rule: 'size-split', size: 30 } } },
      });
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(2);
      expect(chunks).toEqual([
        `| Col A | Col B |
| - | - |
| Row A1 | Row B1 |
| Row A2 | Row B2 |`,
        `| Col A | Col B |
| - | - |
| Row A3 | Row B3 |
| Row A4 | Row B4 |`,
      ]);
    });

    it('should not split tables if does not exceed size limit', () => {
      const splitter = new TableSplitter({
        chunkSize: 30,
        maxOverflowRatio: 1.0,
        rules: { table: { split: { rule: 'size-split', size: 120 } } },
      });
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(1);
      expect(chunks).toEqual([
        `| Col A | Col B |
| - | - |
| Row A1 | Row B1 |
| Row A2 | Row B2 |
| Row A3 | Row B3 |
| Row A4 | Row B4 |`,
      ]);
    });
  });
});
