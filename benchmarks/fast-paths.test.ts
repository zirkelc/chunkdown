import type { Code, Nodes } from 'mdast';
import { describe, expect, it } from 'vitest';
import { buildPositionMapping } from '../src/utils/plaintext-markdown-mapping';
import { fromMarkdown, fromMarkdownForSizing, toMarkdown, toString } from '../src/markdown';
import { getContentSize } from '../src/size';
import { TextSplitter } from '../src/splitters/text';
import { defaultNodeRules } from '../src/chunkdown';
import type { SplitterOptions } from '../src/types';
import { loadFixtures } from './dataset';

/**
 * The sizing and mapping fast paths mirror parser behaviour for simple
 * markdown shapes instead of parsing. These tests prove that equivalence over
 * the benchmark corpus and a list of adversarial synthetic edges: every input
 * a fast path accepts must produce exactly what the parse path produces.
 * Inputs a fast path bails on are covered by construction (the fallback IS
 * the parse), so only accepted inputs are compared.
 */

/**
 * Exposes the protected fast-path analyzers and their parse-path equivalents
 */
class Probe extends TextSplitter {
  analyzeLine(markdown: string) {
    return this.analyzeSimpleLine(markdown);
  }

  analyzeCode(node: Nodes, markdown: string) {
    return this.analyzeCodeNode(node, markdown);
  }

  parsePath(markdown: string) {
    const ast = fromMarkdown(markdown);
    return {
      ranges: this.extractPenalizedRanges(ast),
      mapping: buildPositionMapping(ast, markdown),
    };
  }
}

const probes: Array<Probe> = [
  new Probe({ chunkSize: 100, rules: defaultNodeRules }),
  new Probe({
    chunkSize: 100,
    rules: {
      link: { split: 'allow-split' },
      image: { split: { rule: 'size-split', size: 3 } },
      inlineCode: { split: { rule: 'size-split', size: 4 } },
      formatting: { split: 'never-split' },
    },
  } as SplitterOptions),
];

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

const collectNodes = (node: Nodes, out: Array<Nodes>): void => {
  out.push(node);
  if ('children' in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      collectNodes(child as Nodes, out);
    }
  }
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
      const expected = toString(fromMarkdownForSizing(sample)).length;
      if (actual !== expected) {
        mismatches.push({ input: sample.slice(0, 120), actual, expected });
      }
    }

    // Assert
    expect(mismatches).toEqual([]);
  });

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
      const expected = toString(fromMarkdownForSizing(sample)).length;
      if (actual !== expected) {
        mismatches.push({ input: sample, actual, expected });
      }
    }

    // Assert
    expect(mismatches).toEqual([]);
  });

  it('should analyze corpus blocks exactly like the parse path', () => {
    // Arrange
    const blocks: Array<string> = [];
    for (const fixture of fixtures) {
      for (const child of fromMarkdown(fixture.text).children.slice(0, 300)) {
        blocks.push(toMarkdown(child));
      }
    }

    // Act
    let accepted = 0;
    const mismatches: Array<{ input: string; probe: number }> = [];
    for (const markdown of blocks) {
      for (const [index, probe] of probes.entries()) {
        const fast = probe.analyzeLine(markdown);
        if (fast === undefined) continue;
        accepted++;
        const real = probe.parsePath(markdown);
        try {
          expect(fast).toEqual(real);
        } catch {
          mismatches.push({ input: markdown.slice(0, 120), probe: index });
        }
      }
    }

    // Assert
    expect(mismatches).toEqual([]);
    expect(accepted).toBeGreaterThan(1_000);
  });

  it('should analyze synthetic edge lines exactly like the parse path', () => {
    // Arrange
    const lines = [
      'plain prose sentence. And more.\n',
      'wrapped prose line one\nline two continues\nline three.\n',
      'a [x](https://x.org/a_b#f?q=1&r=2) and [y](u2 "t") end\n',
      'adjacent [a](1)[b](2) links\n',
      '![img](u) caption\n',
      '![](u) empty alt\n',
      '[](u) empty label then text\n',
      '[ spaced label ](u) end\n',
      'use `code` here\n',
      'use ` spaced ` here\n',
      'code then [link](u) then `code`\n',
      '`[x](y)` code before link syntax\n',
      'dest [a](u`v`w) backticks\n',
      'wrapped `code`\nnext line `more`\n',
      'a **bold** b\n',
      'a *ital* b\n',
      'em *a\nacross lines* b\n',
      'dot.**after** punct\n',
      '(**paren**) context\n',
      '**a**, b\n',
      '**bold** then [link](u) then `code`\n',
      '*a* mid **b** mixed lengths\n',
    ];

    // Act
    let accepted = 0;
    const mismatches: Array<{ input: string; probe: number }> = [];
    for (const line of lines) {
      for (const [index, probe] of probes.entries()) {
        const fast = probe.analyzeLine(line);
        if (fast === undefined) continue;
        accepted++;
        const real = probe.parsePath(line);
        try {
          expect(fast).toEqual(real);
        } catch {
          mismatches.push({ input: line, probe: index });
        }
      }
    }

    // Assert
    expect(mismatches).toEqual([]);
    // Every synthetic line here is a shape the fast path is meant to accept
    expect(accepted).toBe(lines.length * probes.length);
  });

  it('should analyze corpus code nodes exactly like the parse path', () => {
    // Arrange
    const codeProbes: Array<Probe> = [
      probes[0],
      new Probe({ chunkSize: 100, rules: { code: { split: { rule: 'size-split', size: 50 } } } } as SplitterOptions),
    ];
    const codeNodes: Array<Code> = [];
    for (const fixture of fixtures) {
      const nodes: Array<Nodes> = [];
      collectNodes(fromMarkdown(fixture.text), nodes);
      for (const node of nodes) {
        if (node.type === 'code') codeNodes.push(node);
      }
    }

    // Act
    let accepted = 0;
    const mismatches: Array<{ input: string; probe: number }> = [];
    for (const node of codeNodes) {
      const markdown = toMarkdown(node);
      for (const [index, probe] of codeProbes.entries()) {
        const fast = probe.analyzeCode(node, markdown);
        if (fast === undefined) continue;
        accepted++;
        const real = probe.parsePath(markdown);
        try {
          expect(fast).toEqual(real);
        } catch {
          mismatches.push({ input: markdown.slice(0, 120), probe: index });
        }
      }
    }

    // Assert
    expect(mismatches).toEqual([]);
    expect(accepted).toBeGreaterThan(1_000);
  });
});
