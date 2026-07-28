/**
 * Deterministic benchmark reporter.
 *
 * Runs every fixture through every preset `RUNS` times and reports the fastest
 * wall time. Unlike the vitest `bench` suite this always does the same amount
 * of work, which makes two runs directly comparable.
 *
 * The estimator is the minimum, not the mean or median. The work is CPU-bound
 * and deterministic, so every source of variance (scheduling, GC, thermal
 * throttling) can only add time. Medians tracked background load closely enough
 * that a 2% swing between identical runs was normal, which is the same order as
 * the changes being evaluated; minimums are stable to well under 1%.
 *
 * Usage:
 *   pnpm bench:report                    # print table
 *   pnpm bench:report --save <file>      # print table and write JSON
 *   pnpm bench:report --compare <file>   # print table with delta vs. saved JSON
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { chunkdown } from '../src/index';
import { loadFixtures, PRESETS, presetOptions } from './dataset';

const RUNS = 9;
const WARMUP = 2;

type Measurement = {
  fixture: string;
  preset: string;
  bytes: number;
  /** Fastest observed wall time across `RUNS` timed iterations */
  minMs: number;
  chunks: number;
};

type Report = {
  runs: number;
  measurements: Array<Measurement>;
  totalMs: number;
};

const arg = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
};

const measure = (): Report => {
  const fixtures = loadFixtures();
  const measurements: Array<Measurement> = [];

  for (const preset of PRESETS) {
    const splitter = chunkdown(presetOptions(preset));

    for (const fixture of fixtures) {
      for (let i = 0; i < WARMUP; i++) splitter.split(fixture.text);

      const samples: Array<number> = [];
      let chunks = 0;
      for (let i = 0; i < RUNS; i++) {
        const start = performance.now();
        chunks = splitter.split(fixture.text).chunks.length;
        samples.push(performance.now() - start);
      }

      measurements.push({
        fixture: fixture.name,
        preset: preset.id,
        bytes: fixture.bytes,
        minMs: Math.min(...samples),
        chunks,
      });
    }
  }

  const totalMs = measurements.reduce((sum, m) => sum + m.minMs, 0);
  return { runs: RUNS, measurements, totalMs };
};

const fmt = (ms: number): string => ms.toFixed(1);

const delta = (current: number, base: number): string => {
  const pct = ((current - base) / base) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
};

const report = measure();

const baselinePath = arg('--compare');
const baseline: Report | undefined =
  baselinePath && existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : undefined;

const baseByKey = new Map<string, Measurement>();
for (const m of baseline?.measurements ?? []) baseByKey.set(`${m.fixture}|${m.preset}`, m);

/**
 * Per-fixture table: one row per fixture, one column per preset.
 */
const fixtureNames = [...new Set(report.measurements.map((m) => m.fixture))];
const byKey = new Map(report.measurements.map((m) => [`${m.fixture}|${m.preset}`, m]));

const header = ['fixture', 'KB', ...PRESETS.map((p) => p.id), 'total'];
const rows: Array<Array<string>> = [];

for (const fixture of fixtureNames) {
  const cells = PRESETS.map((p) => fmt(byKey.get(`${fixture}|${p.id}`)!.minMs));
  const total = PRESETS.reduce((sum, p) => sum + byKey.get(`${fixture}|${p.id}`)!.minMs, 0);
  const bytes = byKey.get(`${fixture}|${PRESETS[0].id}`)!.bytes;
  const totalCell = baseline
    ? `${fmt(total)} (${delta(
        total,
        PRESETS.reduce((sum, p) => sum + (baseByKey.get(`${fixture}|${p.id}`)?.minMs ?? 0), 0),
      )})`
    : fmt(total);
  rows.push([fixture, (bytes / 1024).toFixed(1), ...cells, totalCell]);
}

const presetTotals = PRESETS.map((p) =>
  fmt(report.measurements.filter((m) => m.preset === p.id).reduce((sum, m) => sum + m.minMs, 0)),
);
rows.push([
  'TOTAL',
  (report.measurements.filter((m) => m.preset === PRESETS[0].id).reduce((s, m) => s + m.bytes, 0) / 1024).toFixed(1),
  ...presetTotals,
  baseline ? `${fmt(report.totalMs)} (${delta(report.totalMs, baseline.totalMs)})` : fmt(report.totalMs),
]);

const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
const line = (cells: Array<string>) => `| ${cells.map((c, i) => c.padEnd(widths[i])).join(' | ')} |`;

console.log(`\nfastest of ${RUNS} runs, milliseconds\n`);
console.log(line(header));
console.log(`|${widths.map((w) => '-'.repeat(w + 2)).join('|')}|`);
for (const row of rows) console.log(line(row));

console.log(`\nTotal: ${fmt(report.totalMs)}ms${baseline ? ` (baseline ${fmt(baseline.totalMs)}ms)` : ''}`);

const savePath = arg('--save');
if (savePath) {
  mkdirSync(dirname(savePath), { recursive: true });
  writeFileSync(savePath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Saved to ${savePath}`);
}
