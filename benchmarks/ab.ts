/**
 * A/B benchmark between two git revisions of `src/`.
 *
 * Comparing two separate `bench:report` processes turned out to be unreliable:
 * absolute timings drift by several percent with machine state, which is the
 * same order as the changes being evaluated. This harness exports both source
 * trees, loads them into one process, and alternates A and B for every timed
 * iteration of every fixture/preset cell. Both variants therefore see the same
 * thermal state, the same background load and a comparable heap, and the
 * remaining difference is the code.
 *
 * Usage:
 *   pnpm bench:ab <revA> [revB]
 *
 * `revA` is any git revision; `revB` defaults to the working tree.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { SplitterResult } from '../src/types';
import { loadFixtures, PRESETS, presetOptions, type Preset } from './dataset';

const RUNS = 7;
const WARMUP = 2;

type Splitter = { split: (text: string) => SplitterResult };
type Factory = (options: ReturnType<typeof presetOptions>) => Splitter;

const repoRoot = join(import.meta.dirname, '..');

/**
 * Materialise `src/` at the given revision (or the working tree for `WORKTREE`)
 * into a temporary directory and import its entry point.
 */
const loadRevision = async (rev: string, dir: string): Promise<Factory> => {
  mkdirSync(dir, { recursive: true });

  if (rev === 'WORKTREE') {
    execFileSync('cp', ['-R', join(repoRoot, 'src'), dir]);
  } else {
    const archive = execFileSync('git', ['archive', rev, 'src'], { cwd: repoRoot, maxBuffer: 1 << 28 });
    execFileSync('tar', ['-x', '-C', dir], { input: archive });
  }

  const module = await import(join(dir, 'src', 'index.ts'));
  return module.chunkdown;
};

const [revA = 'HEAD', revB = 'WORKTREE'] = process.argv.slice(2);

/**
 * The exported trees live inside the repository so that Node resolves their
 * dependencies against the project's `node_modules`.
 */
const root = join(repoRoot, '.bench-ab');
rmSync(root, { recursive: true, force: true });
const factoryA = await loadRevision(revA, join(root, 'a'));
const factoryB = await loadRevision(revB, join(root, 'b'));

const fixtures = loadFixtures();

type Row = { fixture: string; preset: Preset; a: number; b: number };
const rows: Array<Row> = [];

for (const preset of PRESETS) {
  const options = presetOptions(preset);
  const a = factoryA(options);
  const b = factoryB(options);

  for (const fixture of fixtures) {
    for (let i = 0; i < WARMUP; i++) {
      a.split(fixture.text);
      b.split(fixture.text);
    }

    let bestA = Infinity;
    let bestB = Infinity;

    for (let i = 0; i < RUNS; i++) {
      /**
       * Alternate which variant runs first so neither systematically benefits
       * from a warm cache left by the other.
       */
      const aFirst = i % 2 === 0;
      const run = (splitter: Splitter): number => {
        const start = performance.now();
        splitter.split(fixture.text);
        return performance.now() - start;
      };

      if (aFirst) {
        bestA = Math.min(bestA, run(a));
        bestB = Math.min(bestB, run(b));
      } else {
        bestB = Math.min(bestB, run(b));
        bestA = Math.min(bestA, run(a));
      }
    }

    rows.push({ fixture: fixture.name, preset, a: bestA, b: bestB });
  }
}

rmSync(root, { recursive: true, force: true });

const fmt = (ms: number) => ms.toFixed(1);
const pct = (a: number, b: number) => {
  const value = ((b - a) / a) * 100;
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
};

const fixtureNames = [...new Set(rows.map((r) => r.fixture))];
const header = ['fixture', `A ${revA}`, `B ${revB}`, 'delta'];
const table: Array<Array<string>> = [];

for (const name of fixtureNames) {
  const own = rows.filter((r) => r.fixture === name);
  const a = own.reduce((sum, r) => sum + r.a, 0);
  const b = own.reduce((sum, r) => sum + r.b, 0);
  table.push([name, fmt(a), fmt(b), pct(a, b)]);
}

const totalA = rows.reduce((sum, r) => sum + r.a, 0);
const totalB = rows.reduce((sum, r) => sum + r.b, 0);
table.push(['TOTAL', fmt(totalA), fmt(totalB), pct(totalA, totalB)]);

const widths = header.map((h, i) => Math.max(h.length, ...table.map((r) => r[i].length)));
const line = (cells: Array<string>) => `| ${cells.map((c, i) => c.padEnd(widths[i])).join(' | ')} |`;

console.log(
  `\ninterleaved A/B, fastest of ${RUNS} runs per cell, milliseconds (summed over ${PRESETS.length} presets)\n`,
);
console.log(line(header));
console.log(`|${widths.map((w) => '-'.repeat(w + 2)).join('|')}|`);
for (const row of table) console.log(line(row));
console.log(`\nB is ${pct(totalA, totalB)} vs A`);
