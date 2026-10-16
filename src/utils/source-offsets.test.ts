import { describe, expect, it } from 'vitest';
import { alignText, toSourceRange } from './source-offsets';

/**
 * The source text of the part `[start, end)` of the written-out text, or
 * undefined when the part has no text from the source. Fails when there is
 * no alignment.
 */
const regionOf = (
  source: string,
  text: string,
  start: number,
  end: number,
  synthetic?: Array<[number, number]>,
): string | undefined => {
  const alignment = alignText(source, 0, source.length, text, synthetic);
  if (alignment === undefined) throw new Error('No alignment');
  const range = toSourceRange(alignment, source, start, end);
  return range ? source.slice(range[0], range[1]) : undefined;
};

describe('alignText', () => {
  it('should map parts of equal text exactly', () => {
    // Arrange
    const source = 'Some text here.';

    // Act
    const regions = [regionOf(source, source, 0, 4), regionOf(source, source, 5, 9), regionOf(source, source, 10, 15)];

    // Assert
    expect(regions).toEqual(['Some', 'text', 'here.']);
  });

  it('should map a part with an inserted escape backslash to the character it escapes', () => {
    // Arrange
    const source = 'See [note] here.';
    const text = 'See \\[note] here.';

    // Act
    const regions = [regionOf(source, text, 0, 4), regionOf(source, text, 4, 11), regionOf(source, text, 12, 17)];

    // Assert
    expect(regions).toEqual(['See', '[note]', 'here.']);
  });

  it('should map an emphasis marker written as `*` to the `_` in the source', () => {
    // Arrange
    const source = 'Some _very_ long text.';
    const text = 'Some *very* long text.';

    // Act
    const regions = [regionOf(source, text, 5, 11), regionOf(source, text, 12, 22)];

    // Assert
    expect(regions).toEqual(['_very_', 'long text.']);
  });

  it('should map an emphasis marker written as `*` to the `_` in the source when other syntax changes too', () => {
    // Arrange
    const source = '- Some _very_ long text.';
    const text = '* Some *very* long text.';

    // Act
    const regions = [regionOf(source, text, 0, 6), regionOf(source, text, 7, 13)];

    // Assert
    expect(regions).toEqual(['- Some', '_very_']);
  });

  it('should map a part after a removed escape backslash to its own text', () => {
    // Arrange
    const source = 'Version 1\\.5 here.';
    const text = 'Version 1.5 here.';

    // Act
    const regions = [regionOf(source, text, 0, 9), regionOf(source, text, 9, 17)];

    // Assert
    expect(regions).toEqual(['Version 1', '.5 here.']);
  });

  it('should give no region to a part that contains only inserted syntax', () => {
    // Arrange
    const source = '    python run.py';
    const text = '```\npython run.py\n```';

    // Act
    const regions = [regionOf(source, text, 0, 3), regionOf(source, text, 4, 17), regionOf(source, text, 18, 21)];

    // Assert
    expect(regions).toEqual([undefined, 'python run.py', undefined]);
  });

  it('should never match synthetic text', () => {
    // Arrange
    const source = 'alpha beta';
    const text = 'beta\nalpha beta';

    // Act
    const regions = [regionOf(source, text, 0, 4, [[0, 5]]), regionOf(source, text, 5, 15, [[0, 5]])];

    // Assert
    expect(regions).toEqual([undefined, 'alpha beta']);
  });

  it('should leave changed syntax between two parts out of both regions', () => {
    // Arrange
    const source = '> one two\n> three four';
    const text = 'one two\nthree four';

    // Act
    const regions = [regionOf(source, text, 0, 7), regionOf(source, text, 8, 18)];

    // Assert
    expect(regions).toEqual(['> one two', 'three four']);
  });

  it('should align a long code block that loses the indentation of its list item', () => {
    // Arrange
    const lines = Array.from({ length: 3_000 }, (_, i) => `const value${i} = ${i};`);
    const source = lines.map((line) => `  ${line}`).join('\n');
    const text = lines.join('\n');
    const lastLine = text.lastIndexOf('const');

    // Act
    const regions = [regionOf(source, text, lastLine, text.length), regionOf(source, text, lastLine + 5, text.length)];

    // Assert
    expect(regions).toEqual(['const value2999 = 2999;', 'value2999 = 2999;']);
  });

  it('should align a long list whose item markers change', () => {
    // Arrange
    const items = Array.from({ length: 3_000 }, (_, i) => `item number ${i}`);
    const source = items.map((item) => `- ${item}`).join('\n');
    const text = items.map((item) => `* ${item}`).join('\n');

    // Act
    const region = regionOf(source, text, text.lastIndexOf('item'), text.length);

    // Assert
    expect(region).toBe('item number 2999');
  });

  it('should align a long ordered list whose item numbers change', () => {
    // Arrange
    const items = Array.from({ length: 3_000 }, (_, i) => `item number ${i}`);
    const source = items.map((item) => `1) ${item}`).join('\n');
    const text = items.map((item, i) => `${i + 1}. ${item}`).join('\n');

    // Act
    const region = regionOf(source, text, text.lastIndexOf('item'), text.length);

    // Assert
    expect(region).toBe('item number 2999');
  });

  it('should align a long list of equal items whose markers change', () => {
    // Arrange
    const source = Array(3_000).fill('- todo').join('\n');
    const text = Array(3_000).fill('* todo').join('\n');

    // Act
    const region = regionOf(source, text, text.length - 4, text.length);

    // Assert
    expect(region).toBe('todo');
  });

  it('should align a long text whose line endings change from CRLF to LF', () => {
    // Arrange
    const lines = Array.from({ length: 3_000 }, (_, i) => `Line number ${i} of the text.`);
    const source = lines.join('\r\n');
    const text = lines.join('\n');
    const lastLine = text.lastIndexOf('Line');

    // Act
    const region = regionOf(source, text, lastLine, lastLine + 4);

    // Assert
    expect(region).toBe('Line');
  });
});
