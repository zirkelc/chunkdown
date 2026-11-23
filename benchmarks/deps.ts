/**
 * Benchmark chunkdown against different builds of its dependencies.
 *
 * A variant is a set of git sources. Each source is a GitHub repository and one
 * or more refs: the first ref is checked out and the other refs are merged into
 * it, so `micromark/micromark#main+pull/1/head+pull/2/head` builds `main` with two
 * pull requests on top. Every package in the source (each workspace of a
 * monorepo, or the repository root) is built and installed into a private copy
 * of chunkdown through pnpm overrides. A variant without sources gets the latest
 * registry versions inside the ranges of `package.json`.
 *
 * Usage:
 *   tsx benchmarks/deps.ts run --variants "<spec>" [--runs=15] [--out=<file.json>]
 *   tsx benchmarks/deps.ts summary <file.json>...
 *
 * Variant spec: variants are separated by `;`, a variant is `<label> = <source>...`
 * and sources are separated by spaces or commas:
 *
 *   base = micromark/micromark#main; prs = micromark/micromark#main+pull/1/head
 *
 * The first variant is the reference. A copy of the reference is always added
 * as an A/A control: its delta is the noise of the run.
 *
 * `run` measures in two child processes, one per load order (reference loaded
 * first, and reference loaded last), because the load order of module copies
 * alone moves timings by a few percent. Each child alternates all variants for
 * every fixture/preset cell and records the total time of each variant per
 * iteration. The delta of a variant is the median over iterations of its total
 * divided by the reference total in the same iteration, so slow drift of the
 * machine cancels out.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { SplitterOptions, SplitterResult } from '../src/types';
import { loadFixtures, PRESETS, presetOptions } from './dataset';

const repoRoot = join(import.meta.dirname, '..');
const CONTROL_SUFFIX = ' (A/A control)';
const WARMUP = 2;

type Source = { repo: string; refs: Array<string> };
type Variant = { label: string; sources: Array<Source> };

/** Raw result of one measuring process. */
type Measurement = {
  /** Variant labels in load order */
  order: Array<string>;
  reference: string;
  /** Total milliseconds per variant, one entry per iteration */
  totals: Array<Record<string, number>>;
  /** Milliseconds per fixture per variant, one entry per iteration */
  fixtures: Array<Record<string, Record<string, number>>>;
  /** Number of fixture/preset cells whose output differs from the reference */
  mismatches: Record<string, number>;
};

const parseVariants = (spec: string): Array<Variant> => {
  const variants = spec
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part): Variant => {
      const separator = part.indexOf('=');
      if (separator === -1) throw new Error(`Variant without label: ${part}`);
      const label = part.slice(0, separator).trim();
      const sources = part
        .slice(separator + 1)
        .split(/[\s,]+/)
        .filter((source) => source !== '')
        .map((source): Source => {
          const [repo, refs = 'HEAD'] = source.split('#');
          if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(`Invalid repository: ${repo}`);
          return { repo, refs: refs.split('+') };
        });
      return { label, sources };
    });
  if (variants.length === 0) throw new Error('No variants given');
  const labels = new Set(variants.map((variant) => variant.label));
  if (labels.size !== variants.length) throw new Error('Variant labels must be unique');
  return variants;
};

const run = (command: string, args: Array<string>, cwd: string): string =>
  execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 28 });

const tryRun = (command: string, args: Array<string>, cwd: string): string | undefined => {
  try {
    return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return undefined;
  }
};

/**
 * Resolve a ref to a commit: a local name, a remote branch, or anything the
 * remote can serve by name (such as `pull/<n>/head`).
 */
const resolveRef = (ref: string, cwd: string): string => {
  const local = tryRun('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], cwd);
  if (local) return local;
  const remote = tryRun('git', ['rev-parse', '--verify', '--quiet', `origin/${ref}^{commit}`], cwd);
  if (remote) return remote;
  run('git', ['fetch', '--quiet', 'origin', ref], cwd);
  return run('git', ['rev-parse', 'FETCH_HEAD'], cwd).trim();
};

type PackageJson = { name?: string; private?: boolean; workspaces?: Array<string> };

const readPackage = (dir: string): PackageJson => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));

/** Directories of the publishable packages in a checked-out source. */
const packageDirs = (checkout: string): Array<string> => {
  const root = readPackage(checkout);
  if (!root.workspaces) return [checkout];
  return root.workspaces
    .flatMap((pattern) => {
      if (!pattern.endsWith('/*')) return [join(checkout, pattern)];
      const parent = join(checkout, pattern.slice(0, -2));
      return readdirSync(parent).map((name) => join(parent, name));
    })
    .filter((dir) => existsSync(join(dir, 'package.json')))
    .filter((dir) => !readPackage(dir).private);
};

/**
 * Check out and build a source, then copy its packages into `target`.
 * Returns the package names with their copied directories.
 */
const buildSource = (source: Source, work: string, target: string): Record<string, string> => {
  const checkout = join(work, 'repos', source.repo.replace('/', '__'));
  if (!existsSync(checkout)) {
    mkdirSync(join(work, 'repos'), { recursive: true });
    run('git', ['clone', '--quiet', '--filter=blob:none', `https://github.com/${source.repo}.git`, checkout], work);
  }

  const [first, ...rest] = source.refs.map((ref) => resolveRef(ref, checkout));
  run('git', ['checkout', '--quiet', '--force', '--detach', first], checkout);
  run('git', ['clean', '--quiet', '-fdx', '--exclude=node_modules'], checkout);
  if (rest.length > 0) {
    run(
      'git',
      ['-c', 'user.name=bench', '-c', 'user.email=bench@localhost', 'merge', '--quiet', '--no-edit', ...rest],
      checkout,
    );
  }

  // Install on every build: the refs can add workspaces or dependencies.
  run('npm', ['install', '--silent', '--ignore-scripts', '--no-audit', '--no-fund'], checkout);
  const workspaces = readPackage(checkout).workspaces !== undefined;
  run(
    'npm',
    workspaces ? ['run', 'build', '--workspaces', '--if-present'] : ['run', 'build', '--if-present'],
    checkout,
  );

  const packages: Record<string, string> = {};
  for (const dir of packageDirs(checkout)) {
    const name = readPackage(dir).name;
    if (!name) continue;
    const copy = join(target, name.replace('/', '__'));
    cpSync(dir, copy, {
      recursive: true,
      filter: (path) => !/[/\\](node_modules|\.git|test)([/\\]|$)/.test(path.slice(dir.length)),
    });
    packages[name] = copy;
  }
  return packages;
};

/**
 * Create a private copy of chunkdown whose dependencies resolve to the built
 * packages of the variant.
 */
const buildVariant = ({ variant, dir, work }: { variant: Variant; dir: string; work: string }): string => {
  const overrides: Record<string, string> = {};
  for (const source of variant.sources) {
    Object.assign(overrides, buildSource(source, work, join(dir, 'packages')));
  }

  const { dependencies } = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  const fileOverrides = Object.fromEntries(Object.entries(overrides).map(([name, path]) => [name, `file:${path}`]));
  cpSync(join(repoRoot, 'src'), join(dir, 'src'), { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'chunkdown-bench-variant', private: true, type: 'module', dependencies }, null, 2),
  );
  // An own workspace file makes the copy its own pnpm root, outside of any parent workspace.
  const workspace = {
    packages: ['.'],
    packageImportMethod: 'copy',
    overrides: fileOverrides,
  };
  // JSON is valid YAML, so no YAML library is needed.
  writeFileSync(join(dir, 'pnpm-workspace.yaml'), `${JSON.stringify(workspace, null, 2)}\n`);
  run('pnpm', ['install', '--silent'], dir);
  return dir;
};

type Splitter = { split: (text: string) => SplitterResult };
type Factory = (options: SplitterOptions) => Splitter;

/** Child process: load the variants in the given order and measure them. */
const measure = async (input: {
  dirs: Record<string, string>;
  order: Array<string>;
  reference: string;
  runs: number;
}): Promise<Measurement> => {
  const factories = new Map<string, Factory>();
  for (const label of input.order) {
    const module = await import(join(input.dirs[label], 'src', 'index.ts'));
    factories.set(label, module.chunkdown);
  }

  const fixtures = loadFixtures();
  const cells = PRESETS.flatMap((preset) => {
    const splitters = new Map(input.order.map((label) => [label, factories.get(label)!(presetOptions(preset))]));
    return fixtures.map((fixture) => ({ fixture, splitters }));
  });

  const mismatches: Record<string, number> = Object.fromEntries(input.order.map((label) => [label, 0]));
  for (const { fixture, splitters } of cells) {
    const expected = splitters.get(input.reference)!.split(fixture.text);
    for (const label of input.order) {
      if (!isDeepStrictEqual(splitters.get(label)!.split(fixture.text), expected)) mismatches[label]++;
    }
  }

  for (let i = 0; i < WARMUP; i++) {
    for (const { fixture, splitters } of cells) for (const splitter of splitters.values()) splitter.split(fixture.text);
  }

  const totals: Measurement['totals'] = [];
  const perFixture: Measurement['fixtures'] = [];
  for (let iteration = 0; iteration < input.runs; iteration++) {
    const total: Record<string, number> = Object.fromEntries(input.order.map((label) => [label, 0]));
    const byFixture: Record<string, Record<string, number>> = {};
    cells.forEach(({ fixture, splitters }, cellIndex) => {
      byFixture[fixture.name] ??= Object.fromEntries(input.order.map((label) => [label, 0]));
      // Rotate which variant runs first so that none of them always gets the warmest cache.
      const offset = (iteration + cellIndex) % input.order.length;
      for (let k = 0; k < input.order.length; k++) {
        const label = input.order[(k + offset) % input.order.length];
        const start = performance.now();
        splitters.get(label)!.split(fixture.text);
        const elapsed = performance.now() - start;
        total[label] += elapsed;
        byFixture[fixture.name][label] += elapsed;
      }
    });
    totals.push(total);
    perFixture.push(byFixture);
  }

  return { order: input.order, reference: input.reference, totals, fixtures: perFixture, mismatches };
};

const median = (values: Array<number>): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const geomean = (values: Array<number>): number =>
  Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length);

/** Median ratio of a variant to the reference over the iterations of one measurement. */
const ratio = (measurement: Measurement, label: string, fixture?: string): number =>
  median(
    measurement.totals.map((total, i) =>
      fixture
        ? measurement.fixtures[i][fixture][label] / measurement.fixtures[i][fixture][measurement.reference]
        : total[label] / total[measurement.reference],
    ),
  );

/**
 * Combine measurements. A sample is one machine: the geometric mean of its
 * load orders, so the load order bias cancels out. Measurements are grouped by
 * file, and each file holds the measurements of one machine.
 */
const summarize = (samples: Array<Array<Measurement>>): string => {
  const first = samples[0][0];
  const reference = first.reference;
  const labels = first.order.includes(reference)
    ? [reference, ...first.order.filter((label) => label !== reference)]
    : first.order;
  const others = labels.filter((label) => label !== reference);
  const fixtures = Object.keys(first.fixtures[0]);

  const sampleRatio = (sample: Array<Measurement>, label: string, fixture?: string) =>
    geomean(sample.map((measurement) => ratio(measurement, label, fixture)));
  const pct = (value: number) => {
    const delta = (value - 1) * 100;
    return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
  };

  const control = others.find((label) => label.endsWith(CONTROL_SUFFIX));
  const noise = control
    ? Math.max(0.5, ...samples.map((sample) => Math.abs((sampleRatio(sample, control) - 1) * 100)))
    : 0.5;

  const iterations = first.totals.length;
  const lines = [
    `Reference: **${reference}**. ${samples.length} machine(s), ${samples[0].length} load orders each, ${iterations} iterations per process.`,
    `Delta per machine: median over iterations of variant total / reference total, geometric mean over load orders. Noise floor: ${noise.toFixed(1)}% (largest A/A control delta, at least 0.5%).`,
    '',
    '| variant | median delta | range over machines | per machine | output differs |',
    '|---|---|---|---|---|',
  ];

  for (const label of others) {
    const values = samples.map((sample) => sampleRatio(sample, label));
    const mid = median(values);
    const differs = Math.max(...samples.flat().map((measurement) => measurement.mismatches[label]));
    let verdict = '⚪';
    if (label !== control) {
      if (mid < 1 - noise / 100 && Math.max(...values) < 1) verdict = '🟢';
      else if (mid > 1 + noise / 100 && Math.min(...values) > 1) verdict = '🔴';
    }
    lines.push(
      `| ${verdict} ${label} | **${pct(mid)}** | ${pct(Math.min(...values))} … ${pct(Math.max(...values))} | ${values.map(pct).join(', ')} | ${differs === 0 ? 'no' : `**${differs} cells**`} |`,
    );
  }

  lines.push('', '<details><summary>Median delta per fixture</summary>', '');
  lines.push(`| fixture | ${others.join(' | ')} |`, `|---|${others.map(() => '---').join('|')}|`);
  for (const fixture of fixtures) {
    const cells = others.map((label) => pct(median(samples.map((sample) => sampleRatio(sample, label, fixture)))));
    lines.push(`| ${fixture} | ${cells.join(' | ')} |`);
  }
  lines.push(
    '',
    '</details>',
    '',
    '🟢 faster or 🔴 slower: the median is outside the noise floor and every machine agrees on the sign.',
  );
  return lines.join('\n');
};

const option = (args: Array<string>, name: string): string | undefined => {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};

const [command, ...args] = process.argv.slice(2);

if (command === 'measure') {
  const input = JSON.parse(readFileSync(args[0], 'utf8'));
  writeFileSync(args[1], JSON.stringify(await measure(input)));
} else if (command === 'run') {
  const spec = option(args, 'variants');
  if (!spec) throw new Error('Missing --variants');
  const runs = Number(option(args, 'runs') ?? 15);
  const work = option(args, 'work') ?? join(tmpdir(), 'chunkdown-bench-deps');
  const out = option(args, 'out') ?? join(work, 'result.json');

  const variants = parseVariants(spec);
  rmSync(join(work, 'variants'), { recursive: true, force: true });
  const dirs: Record<string, string> = {};
  // Directory names come from the index, because labels can hold any character.
  variants.forEach((variant, index) => {
    console.error(`Building ${variant.label}`);
    dirs[variant.label] = buildVariant({ variant, dir: join(work, 'variants', `v${index}`), work });
  });
  const reference = variants[0].label;
  const control = `${reference}${CONTROL_SUFFIX}`;
  dirs[control] = join(work, 'variants', 'control');
  cpSync(dirs[reference], dirs[control], { recursive: true, verbatimSymlinks: true });

  const labels = [...variants.map((variant) => variant.label), control];
  const measurements: Array<Measurement> = [];
  for (const order of [labels, [...labels].reverse()]) {
    console.error(`Measuring, load order: ${order.join(', ')}`);
    const inputFile = join(work, 'measure-input.json');
    const outputFile = join(work, 'measure-output.json');
    writeFileSync(inputFile, JSON.stringify({ dirs, order, reference, runs }));
    execFileSync(process.execPath, ['--import', 'tsx', import.meta.filename, 'measure', inputFile, outputFile], {
      cwd: repoRoot,
      stdio: 'inherit',
    });
    measurements.push(JSON.parse(readFileSync(outputFile, 'utf8')));
  }

  mkdirSync(join(out, '..'), { recursive: true });
  writeFileSync(out, JSON.stringify(measurements));
  console.log(summarize([measurements]));
} else if (command === 'summary') {
  if (args.length === 0) throw new Error('Missing result files');
  const samples = args.map((file): Array<Measurement> => JSON.parse(readFileSync(file, 'utf8')));
  console.log(summarize(samples));
} else {
  console.error('Usage: deps.ts run --variants "<spec>" [--runs=15] [--out=<file>] | deps.ts summary <file>...');
  process.exit(2);
}
