/**
 * One case per benchmark fixture, split with the `cs250-r1.0` preset: tight
 * enough that the tree and text splitters do real work on every fixture. The
 * smallest fixture repeats its body so it stays measurable.
 */
import { fnv1a, type PerfCase, rng } from './harness.mts';
import { FIXTURES } from './fixtures.mts';

const OPTIONS = { chunkSize: 250, maxOverflowRatio: 1.0 };
const REPEAT: Record<string, number> = { 'ai-sdk-overview': 4 };

export function buildCases(lib: any): Array<PerfCase> {
  return FIXTURES.map(({ name, text }) => {
    const splitter = lib.chunkdown(OPTIONS);
    const repeat = REPEAT[name] ?? 1;
    return {
      name,
      run: () => {
        for (let i = 0; i < repeat; i++) splitter.split(text);
      },
      collect: () => {
        const { chunks } = splitter.split(text);
        return { count: chunks.length, digest: fnv1a(JSON.stringify(chunks)) };
      },
    };
  });
}

/** Seeded prose: `n` words, a sentence end every 8 to 20 words, optional inline links. */
const prose = (n: number, seed: number, linkEvery = 0): string => {
  const rand = rng(seed);
  const words = ['alpha', 'beta', 'gamma', 'delta', 'photosynthesis', 'the', 'of', 'and', 'light', 'energy', 'plant'];
  const out: Array<string> = [];
  let untilStop = 8 + Math.floor(rand() * 12);
  for (let i = 0; i < n; i++) {
    let word = words[Math.floor(rand() * words.length)];
    if (linkEvery > 0 && i % linkEvery === 0) word = `[${word} ${word}](https://example.com/${i}_${word})`;
    if (--untilStop === 0) {
      word += '.';
      untilStop = 8 + Math.floor(rand() * 12);
    } else if (rand() < 0.08) word += ',';
    out.push(word);
  }
  return out.join(' ');
};

/** Input shapes for the scaling scan; `n` is roughly the number of words. */
export function buildScan(lib: any) {
  const splitter = lib.chunkdown(OPTIONS);
  const run = (input: unknown) => {
    splitter.split(input as string);
  };
  const repeat = (n: number, per: number, make: (i: number) => string, sep: string) =>
    Array.from({ length: Math.ceil(n / per) }, (_, i) => make(i)).join(sep);
  return [
    { name: 'one-paragraph', n: 500, input: (n: number) => prose(n, 1), run },
    { name: 'one-paragraph-links', n: 500, input: (n: number) => prose(n, 2, 10), run },
    { name: 'many-paragraphs', n: 500, input: (n: number) => repeat(n, 60, (i) => prose(60, i), '\n\n'), run },
    {
      name: 'many-sections',
      n: 500,
      input: (n: number) => repeat(n, 60, (i) => `${'#'.repeat(1 + (i % 3))} Title ${i}\n\n${prose(60, i)}`, '\n\n'),
      run,
    },
    { name: 'one-list', n: 500, input: (n: number) => repeat(n, 12, (i) => `- ${prose(12, i)}`, '\n'), run },
    {
      name: 'one-table',
      n: 500,
      input: (n: number) =>
        `| a | b | c |\n| - | - | - |\n${repeat(n, 12, (i) => `| ${prose(4, i)} | ${prose(4, i + 1)} | ${prose(4, i + 2)} |`, '\n')}`,
      run,
    },
    {
      name: 'one-code-block',
      n: 500,
      input: (n: number) => `\`\`\`js\n${repeat(n, 8, (i) => `const v${i} = compute(${i}, 'alpha beta');`, '\n')}\n\`\`\``,
      run,
    },
  ];
}
