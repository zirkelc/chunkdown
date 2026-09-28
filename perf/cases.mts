/**
 * One case per benchmark fixture, split with the `cs250-r1.0` preset: tight
 * enough that the tree and text splitters do real work on every fixture. The
 * smallest fixture repeats its body so it stays measurable.
 */
import { fnv1a, type PerfCase } from './harness.mts';
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
