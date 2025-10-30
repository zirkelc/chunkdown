import { f } from 'f-strings';
import { describe, expect, it } from 'vitest';
import { TableSplitter } from './table';

describe('TableSplitter', () => {
  const text = `| Col A   | Col B   |
|---------|---------|
| Row A1  | Row B1  |
| Row A2  | Row B2  |
| Row A3  | Row B3  |
| Row A4  | Row B4  |`;

  it('should keep tables together if possible', () => {
    const splitter = new TableSplitter({
      chunkSize: 60,
      maxOverflowRatio: 1.0,
    });

    const chunks = splitter.splitText(text);

    expect(chunks.length).toBe(1);
    expect(chunks).toEqual([
      `| Col A  | Col B  |
| ------ | ------ |
| Row A1 | Row B1 |
| Row A2 | Row B2 |
| Row A3 | Row B3 |
| Row A4 | Row B4 |`,
    ]);
  });

  it('should split tables', () => {
    const splitter = new TableSplitter({
      chunkSize: 45,
      maxOverflowRatio: 1.0,
    });

    const chunks = splitter.splitText(text);

    expect(chunks.length).toBe(2);
    expect(chunks).toEqual([
      `| Col A  | Col B  |
| ------ | ------ |
| Row A1 | Row B1 |
| Row A2 | Row B2 |`,
      `| Col A  | Col B  |
| ------ | ------ |
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
      `| Col A  | Col B  |
| ------ | ------ |
| Row A1 | Row B1 |`,
      `| Col A  | Col B  |
| ------ | ------ |
| Row A2 | Row B2 |`,
      `| Col A  | Col B  |
| ------ | ------ |
| Row A3 | Row B3 |`,
      `| Col A  | Col B  |
| ------ | ------ |
| Row A4 | Row B4 |`,
    ]);
  });
});
