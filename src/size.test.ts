import { describe, expect, it } from 'vitest';
import { createHierarchicalAST } from './ast';
import { fromMarkdown } from './markdown';
import { getContentSize, getRawSize, getSectionSize, splitByMaxRawSize } from './size';

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
    expect(getContentSize('***`Hello`*** [world](https://example.com)')).toBe(11);
  });

  it('should measure AST node content', () => {
    const ast = fromMarkdown('**Hello** world');
    expect(getContentSize(ast)).toBe(11);
  });

  it('should handle empty AST node', () => {
    const ast = fromMarkdown('');
    expect(getContentSize(ast)).toBe(0);
  });

  /**
   * String inputs with simple shapes are sized by fast paths that mirror the
   * parser's toString semantics without parsing. Each expected value below is
   * the exact parser result; benchmarks/fast-paths.test.ts additionally proves
   * fast-path/parser equivalence over the whole benchmark corpus.
   */
  describe('sizing fast paths', () => {
    it('should size plain prose', () => {
      expect(getContentSize('hello world')).toBe(11);
      expect(getContentSize('Hello, world. This is plain prose with punctuation!')).toBe(51);
      /** leading/trailing spaces on a line are trimmed by the parser */
      expect(getContentSize('  leading and trailing  ')).toBe(20);
    });

    it('should size multi-line prose', () => {
      /** soft break keeps the newline */
      expect(getContentSize('line one\nline two')).toBe(17);
      /** hard break (two trailing spaces) contributes nothing */
      expect(getContentSize('a  \nb')).toBe(2);
      /** blank line separates paragraphs, sized without the separator */
      expect(getContentSize('one\n\ntwo')).toBe(6);
    });

    it('should size inline links by their label only', () => {
      expect(getContentSize('a [link](https://example.com/some/long/path) b')).toBe(8);
      expect(getContentSize('[a](b) and [c](d "title") end')).toBe(11);
      /** images contribute their alt text */
      expect(getContentSize('![alt](img.png) caption')).toBe(11);
    });

    it('should size code spans by their content', () => {
      expect(getContentSize('use `code` here')).toBe(13);
      /** one leading and trailing space inside a span is stripped */
      expect(getContentSize('use ` spaced ` here')).toBe(15);
      expect(getContentSize('double ``code`` span')).toBe(16);
    });

    it('should size emphasis by its content', () => {
      expect(getContentSize('a **bold** and *italic* b')).toBe(19);
      expect(getContentSize('intra**word**bold')).toBe(13);
    });

    it('should size backslash escapes as the escaped character', () => {
      expect(getContentSize('escaped \\* asterisk')).toBe(18);
      expect(getContentSize('formula W\\_Q times W\\_K done')).toBe(26);
      expect(getContentSize('escaped dot 1\\. not a list')).toBe(25);
    });

    it('should size code fences by their body', () => {
      expect(getContentSize('```js\nconst a = 1;\n```')).toBe(12);
      expect(getContentSize('```\nline1\nline2\n```')).toBe(11);
      /** unclosed fence: everything after the opening line is content */
      expect(getContentSize('```js\nunclosed fence')).toBe(14);
    });

    it('should size literal brackets as text', () => {
      expect(getContentSize('literal [update] bracket')).toBe(24);
      expect(getContentSize('arr[0] and arr[1] indexing')).toBe(26);
    });

    it('should match the parser on inputs the fast paths bail on', () => {
      /** footnote references and html force the parse fallback */
      expect(getContentSize('[^foot] must bail to parser')).toBe(27);
      expect(getContentSize('<div>html bails</div>')).toBe(21);
      /** list-like line starts are ambiguous, so the fast path defers */
      expect(getContentSize('text\n1990. year start')).toBe(21);
    });
  });
});

describe('getRawSize', () => {
  it('should measure raw string length', () => {
    expect(getRawSize('Hello world')).toBe(11);
    expect(getRawSize('')).toBe(0);
  });

  it('should include markdown formatting in size', () => {
    expect(getRawSize('**Hello** world')).toBe(15);
    expect(getRawSize('# Hello')).toBe(7);
  });

  it('should measure AST node raw size from position', () => {
    const ast = fromMarkdown('**Hello** world');
    expect(getRawSize(ast)).toBe(15);
  });

  it('should fallback to toMarkdown when no position data', () => {
    const ast = fromMarkdown('Hello');
    // Remove position data
    delete ast.position;
    // toMarkdown adds a newline, so it's 6 instead of 5
    expect(getRawSize(ast)).toBe(6);
  });
});

describe('getSectionSize', () => {
  it('should measure section with heading and content', () => {
    const ast = fromMarkdown('# Title\n\nContent here.');
    const hierarchical = createHierarchicalAST(ast);
    const section = hierarchical.children[0];

    // "Title" (5) + "Content here." (13) = 18
    expect(getSectionSize(section)).toBe(18);
  });

  it('should measure orphaned section without heading', () => {
    const ast = fromMarkdown('Just text.\n\nMore text.');
    const hierarchical = createHierarchicalAST(ast);
    const section = hierarchical.children[0];

    // "Just text." (10) + "More text." (10) = 20
    expect(getSectionSize(section)).toBe(20);
  });

  it('should recursively measure nested sections', () => {
    const ast = fromMarkdown('# Main\n\nContent.\n\n## Sub\n\nMore.');
    const hierarchical = createHierarchicalAST(ast);
    const section = hierarchical.children[0];

    // "Main" (4) + "Content." (8) + "Sub" (3) + "More." (5) = 20
    expect(getSectionSize(section)).toBe(20);
  });

  it('should handle empty section', () => {
    const ast = fromMarkdown('# Empty\n\n# Next');
    const hierarchical = createHierarchicalAST(ast);
    const section = hierarchical.children[0];

    // Just "Empty" (5)
    expect(getSectionSize(section)).toBe(5);
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
