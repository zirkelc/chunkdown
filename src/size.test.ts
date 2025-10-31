import { describe, expect, it } from 'vitest';
import { getContentSize, splitByMaxRawSize } from './size';

describe('getContentSize', () => {
  it('should measure plain text correctly', () => {
    expect(getContentSize('Hello world')).toBe(11);
    expect(getContentSize('')).toBe(0);
    expect(getContentSize('A')).toBe(1);
  });

  it('should ignore markdown formatting', () => {
    expect(getContentSize('**Hello** *world*')).toBe(11);
    expect(getContentSize('`Hello` world')).toBe(11);
    expect(getContentSize('[Hello](http://example.com) world')).toBe(11);
    expect(getContentSize('# Hello world')).toBe(11);
    expect(getContentSize('***`Hello`*** [world](https://example.com)')).toBe(
      11,
    );
  });
});

describe('splitByMaxRawSize', () => {
  it('should not split chunks that fit within maxRawSize', () => {
    const chunks = ['short', 'tiny', 'small'];
    const result = Array.from(splitByMaxRawSize(chunks, 10));

    expect(result).toEqual(['short', 'tiny', 'small']);
  });

  it('should split chunks that exceed maxRawSize', () => {
    const chunks = ['This is a very long chunk that needs to be split'];
    const result = Array.from(splitByMaxRawSize(chunks, 20));

    expect(result.length).toBe(3);
    expect(result[0]).toBe('This is a very long');
    expect(result[1]).toBe('chunk that needs to');
    expect(result[2]).toBe('be split');
  });

  it('should handle empty chunks', () => {
    const chunks = ['', 'hello', ''];
    const result = Array.from(splitByMaxRawSize(chunks, 10));

    // Empty chunks that fit within maxRawSize are yielded as-is
    expect(result).toEqual(['', 'hello', '']);
  });

  it('should handle empty array', () => {
    const chunks: string[] = [];
    const result = Array.from(splitByMaxRawSize(chunks, 10));

    expect(result).toEqual([]);
  });

  it('should handle chunks exactly at maxRawSize', () => {
    const chunks = ['exactly20characters!'];
    const result = Array.from(splitByMaxRawSize(chunks, 20));

    expect(result).toEqual(['exactly20characters!']);
  });

  it('should handle very small maxRawSize', () => {
    const chunks = ['hello world'];
    const result = Array.from(splitByMaxRawSize(chunks, 3));

    expect(result.length).toBe(4);
    expect(result[0]).toBe('hel');
    expect(result[1]).toBe('lo');
    expect(result[2]).toBe('wor');
    expect(result[3]).toBe('ld');
  });

  it('should handle very large maxRawSize', () => {
    const chunks = ['small text'];
    const result = Array.from(splitByMaxRawSize(chunks, 1000));

    expect(result).toEqual(['small text']);
  });

  it('should handle multiple chunks with varying sizes', () => {
    const chunks = [
      'short',
      'this is a much longer chunk that will need splitting',
      'medium length',
      'anotherlongchunkthatneedshandling',
    ];
    const result = Array.from(splitByMaxRawSize(chunks, 25));

    expect(result.length).toBe(7);
    expect(result[0]).toBe('short');
    expect(result[1]).toBe('this is a much longer');
    expect(result[2]).toBe('chunk that will need');
    expect(result[3]).toBe('splitting');
    expect(result[4]).toBe('medium length');
    expect(result[5]).toBe('anotherlongchunkthatneeds');
    expect(result[6]).toBe('handling');
  });

  it('should prefer to split at whitespace boundaries', () => {
    const chunks = ['This is a test with some words'];
    const result = Array.from(splitByMaxRawSize(chunks, 15));

    expect(result.length).toBe(2);
    expect(result[0]).toBe('This is a test');
    expect(result[1]).toBe('with some words');
  });

  it('should handle different types of whitespace', () => {
    const chunks = ['This\thas\ttabs\nand\nnewlines\rand\rcarriage returns'];
    const result = Array.from(splitByMaxRawSize(chunks, 20));

    expect(result.length).toBe(3);
    expect(result[0]).toBe('This\thas\ttabs\nand');
    expect(result[1]).toBe('newlines\rand\rcarriag');
    expect(result[2]).toBe('e returns');
  });

  it('should trim chunks after splitting at whitespace', () => {
    const chunks = ['word1 word2 word3 word4'];
    const result = Array.from(splitByMaxRawSize(chunks, 12));

    expect(result.length).toBe(2);
    expect(result[0]).toBe('word1 word2');
    expect(result[1]).toBe('word3 word4');
  });

  it('should only search in last 20% of range for whitespace', () => {
    // Create a string with whitespace early but not in the last 20%
    const text = 'word1 word2 averylongwordthatexceeds';
    const chunks = [text];
    const result = Array.from(splitByMaxRawSize(chunks, 20));

    // Since there's no whitespace in the last 20% (positions 16-20),
    // it should hard-split at position 20
    expect(result.length).toBe(2);
    expect(result[0]).toBe('word1 word2 averylon');
    expect(result[1]).toBe('gwordthatexceeds');
  });

  it('should use whitespace in last 20% if available', () => {
    // Create a string with whitespace in the last 20% of the search range
    // Text needs to exceed maxRawSize to trigger splitting
    const text = 'verylongword short extra';
    const chunks = [text];
    const result = Array.from(splitByMaxRawSize(chunks, 20));

    // Should split at the space after 'short' (position 18), which is in the last 20%
    expect(result.length).toBe(2);
    expect(result[0]).toBe('verylongword short');
    expect(result[1]).toBe('extra');
  });

  it('should hard-split when no whitespace is available', () => {
    const chunks = ['verylongwordwithoutanyspaces'];
    const result = Array.from(splitByMaxRawSize(chunks, 10));

    expect(result.length).toBe(3);
    expect(result[0]).toBe('verylongwo');
    expect(result[1]).toBe('rdwithouta');
    expect(result[2]).toBe('nyspaces');
  });

  it('should hard-split at maxRawSize exactly when no whitespace in range', () => {
    const chunks = ['supercalifragilisticexpialidocious'];
    const result = Array.from(splitByMaxRawSize(chunks, 20));

    expect(result.length).toBe(2);
    expect(result[0]).toBe('supercalifragilistic');
    expect(result[1]).toBe('expialidocious');
  });

  it('should handle mix of whitespace and no-whitespace scenarios', () => {
    const chunks = ['short verylongwordwithoutspaces another'];
    const result = Array.from(splitByMaxRawSize(chunks, 15));

    expect(result.length).toBe(3);
    expect(result[0]).toBe('short verylongw');
    expect(result[1]).toBe('ordwithoutspace');
    expect(result[2]).toBe('s another');
  });
});
