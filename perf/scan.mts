/**
 * Scaling scan: times each input shape at three sizes against one revision.
 *
 *   node perf/scan.mts [rev=WORKTREE] [--factor 4] [--reps 5] [--min-ms 20]
 *
 * Linear work costs about `factor` times more at `factor` times the input. A ratio well above that
 * marks a superlinear path, which the A/B suite cannot see: on the input sizes a benchmark uses, a
 * quadratic resolver is invisible, and on long input it costs five to seventeen times. Profile
 * every shape the scan flags and look for mid-array `splice`, `shift`, `unshift` or `indexOf`
 * inside a loop over the same array.
 *
 * Two rules keep the flags honest, both learned from a scan that cried wolf. Each shape's base size
 * grows until its body takes at least `--min-ms`, because a 5 ms base makes noise look like
 * curvature. And the scan measures n, 4n and 16n, flagging only when **both** steps exceed the
 * factor: one bad step is noise, two in a row is a shape.
 *
 * Size is not only input length. The second shape to try is **N operations against one long-lived
 * object**: a listener list, a cache, a registry, a header collection that a pipeline appends to.
 * Those grow with the life of an object rather than with the size of an input, so no input-length
 * shape reaches them, and a duplicate check that walks the list turns a loop into O(n²). One
 * campaign found exactly that, with step ratios of 17x and 24x.
 *
 * The cases module exports `buildScan(lib)`: shapes that take a size and return an input.
 */
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { WORKTREE, loadConfig, materialise, timeNs } from "./harness.mts";

/** One input shape, parameterised by size. */
export interface ScanShape {
  name: string;
  /** Builds an input of roughly `n` units (characters, elements, nodes: whatever the domain uses). */
  input: (n: number) => unknown;
  /** Runs the library over one input. */
  run: (input: unknown) => void | Promise<void>;
  /** Starting size. The scan grows it until the body is long enough to time, then scales from there. */
  n?: number;
}

const HARNESS_DIR = import.meta.dirname;
const { config, positionals, values } = loadConfig(HARNESS_DIR, process.argv.slice(2), {
  factor: { type: "string" },
  reps: { type: "string" },
  "min-ms": { type: "string" },
});
const FACTOR = Number(values.factor ?? 4);
const REPS = Number(values.reps ?? 5);
const MIN_MS = Number(values["min-ms"] ?? 20);
const rev = positionals[0] ?? WORKTREE;

const lib = await import(pathToFileURL(materialise(config, rev, "scan")).href);
const casesModule = await import(pathToFileURL(path.join(config.root, config.cases)).href);
if (typeof casesModule.buildScan !== "function") {
  throw new Error(`${config.cases} must export buildScan(lib) to run a scaling scan.`);
}
const shapes: Array<ScanShape> = casesModule.buildScan(lib);

async function best(shape: ScanShape, input: unknown): Promise<number> {
  await shape.run(input);
  let min = Number.POSITIVE_INFINITY;
  for (let r = 0; r < REPS; r++) min = Math.min(min, await timeNs(() => shape.run(input)));
  return min / 1_000_000;
}

console.log(`scaling scan @ ${rev} (n, ${FACTOR}n, ${FACTOR ** 2}n; min of ${REPS}; base grown to >= ${MIN_MS} ms)`);
console.log(
  `${"shape".padEnd(24)}${"n".padStart(10)}${"t(n)".padStart(9)}${`t(${FACTOR}n)`.padStart(10)}${`t(${FACTOR ** 2}n)`.padStart(11)}${"step1".padStart(8)}${"step2".padStart(8)}`
);

for (const shape of shapes) {
  /** Grow the base until the body is long enough that noise cannot pass for curvature. */
  let n = shape.n ?? 1_000;
  let base = await best(shape, shape.input(n));
  for (let grow = 0; base < MIN_MS && grow < 8; grow++) {
    n *= 2;
    base = await best(shape, shape.input(n));
  }

  const mid = await best(shape, shape.input(n * FACTOR));
  const large = await best(shape, shape.input(n * FACTOR * FACTOR));
  const step1 = mid / base;
  const step2 = large / mid;
  /**
   * Both steps must exceed the factor by a margin: one is noise, two in a row is a shape. Two
   * margins, because n log n with cache effects lands just above the lower one: a sort over a
   * million keys measured 5.85 and 6.86 against a factor of 4. Above 1.8x is worth an experiment,
   * between 1.4x and 1.8x is worth a profile before anyone calls it a finding.
   */
  const exceeds = (margin: number) => step1 > FACTOR * margin && step2 > FACTOR * margin;
  const superlinear = exceeds(1.8);
  const borderline = !superlinear && exceeds(1.4);
  const note = base < MIN_MS
    ? "  (base still short, treat with care)"
    : superlinear
      ? "  <- superlinear"
      : borderline
        ? "  <- borderline (n log n looks like this; profile before calling it a finding)"
        : "";
  console.log(
    `${shape.name.padEnd(24)}${String(n).padStart(10)}${base.toFixed(1).padStart(9)}${mid.toFixed(1).padStart(10)}${large.toFixed(1).padStart(11)}${step1.toFixed(2).padStart(8)}${step2.toFixed(2).padStart(8)}${note}`
  );
}
