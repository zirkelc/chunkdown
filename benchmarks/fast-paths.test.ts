import { describe, expect, it } from 'vitest';
import { fromMarkdown, toString } from '../src/markdown';
import { getContentSize } from '../src/size';
import { loadFixtures } from './dataset';

/**
 * The sizing fast paths mirror parser behaviour for simple markdown shapes
 * instead of parsing. These tests prove that equivalence over the benchmark
 * corpus and a list of adversarial synthetic edges: every input a fast path
 * accepts must produce exactly what the parse path produces. Inputs a fast
 * path bails on are covered by construction (the fallback IS the parse), so
 * comparing the public result covers both.
 */

const fixtures = loadFixtures();

/**
 * Deterministic PRNG so the sampled substrings are stable across runs
 */
const createRandom = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
};

describe('fast-path parser equivalence', () => {
  it('should size corpus substrings exactly like the parser', () => {
    // Arrange
    const random = createRandom(42);
    const samples: Array<string> = [];
    for (const fixture of fixtures) {
      for (const block of fixture.text.split(/\n{2,}/).slice(0, 250)) {
        samples.push(block);
      }
      for (let i = 0; i < 200; i++) {
        const start = Math.floor(random() * fixture.text.length);
        const length = Math.floor(random() * random() * 4_000) + 1;
        samples.push(fixture.text.slice(start, start + length));
      }
    }

    // Act
    const mismatches: Array<{ input: string; actual: number; expected: number }> = [];
    for (const sample of samples) {
      const actual = getContentSize(sample);
      const expected = toString(fromMarkdown(sample)).length;
      if (actual !== expected) {
        mismatches.push({ input: sample.slice(0, 120), actual, expected });
      }
    }

    // Assert
    expect(mismatches).toEqual([]);
  }, 30_000);

  it('should size synthetic edge cases exactly like the parser', () => {
    // Arrange
    const samples = [
      // line structure: breaks, indents, blank lines
      'a  \nb',
      'a \nb',
      'one\n\ntwo',
      '   three spaces lead\nnext',
      '    four spaces lead',
      'para\n        deep continuation',
      'text\n1990. year start',
      'a\n- list?',
      'ends with spaces   ',
      '\n\n\n',
      'a\nb\nc  \nd\n\ne',
      // inline links
      'a [link](https://en.wikipedia.org/wiki/Python_(x)) b',
      'a [link](https://x.org/a_b#frag?q=1&r=2) b',
      'see [text [inner](u) tail',
      '[a](b) and [c](d "title") end',
      "[a](b 'title') end",
      '[a](b (paren title)) end',
      '[](x)',
      'x\n[](y)\nz',
      '![alt text](img.png) caption',
      'wow![img](u) precedence',
      '[label with spaces  ](u) end',
      '[ref][id] style',
      '[def]: https://x.org',
      '[a][b](c)',
      '[a [b](c)',
      '[a](b]c) weird dest',
      '[a]( b) leading space dest',
      '1. [link](u) list-ish',
      'a@b.com email',
      'see www.example.com site',
      // code spans and fences
      'use `code` here',
      'use ` spaced ` here',
      'use ` ` single space',
      'double ``code`` span',
      '`[x](y)` code hides link',
      '[a `b](u)` c](v)',
      '[`code`](https://x.org) in label',
      'code with `a&amp;b` entity',
      'dest with [a](u`v`w) backticks',
      'span `across\nlines` bails',
      'a`',
      '`a``b`',
      '```js\nconst a = 1;',
      '```js\nline1\nline2\n',
      '``` info string\ncontent\n',
      '````js\nnested ``` fence\n',
      '```js\nwith `backtick`\n',
      // emphasis
      'a **bold** b',
      'a *ital* b',
      'a ** b ** spaced',
      'intra**word**bold',
      'a ***triple*** b',
      'unclosed **run',
      'mismatch **a* b',
      'a *b**c* d',
      'strong **with [l](u) link** inside',
      'em *a\nacross lines* b',
      'dot.**after** punct',
      '**a**.',
      '5*3*2 math',
      'x, **a`c`**. y',
      // escapes
      'escaped \\* asterisk',
      'formula W\\_Q times W\\_K done',
      'escaped \\[bracket\\] pair',
      'literal \\a backslash before letter',
      'trailing backslash \\',
      'escaped backtick \\` here',
      'code with `a\\*b` backslash inside',
      '`a\\`b` tricky span',
      'escaped \\\\ backslash pair',
      'escaped dot 1\\. not a list',
      '\\- not a dash line',
      'label [a\\.b](u) escapes',
      'dest [a](u\\)b) escaped paren',
      // literal brackets
      'literal [update] bracket',
      'stray ] closing',
      'arr[0] and arr[1] indexing',
      '![alt-like] no paren',
      '[^foot] must bail',
      '[a [b](c)](d) nested must bail',
      'empty [] brackets',
      'mix \\* and `code` and [l](u) and **b**',
    ];

    // Act
    const mismatches: Array<{ input: string; actual: number; expected: number }> = [];
    for (const sample of samples) {
      const actual = getContentSize(sample);
      const expected = toString(fromMarkdown(sample)).length;
      if (actual !== expected) {
        mismatches.push({ input: sample, actual, expected });
      }
    }

    // Assert
    expect(mismatches).toEqual([]);
  });

});
