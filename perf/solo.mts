/**
 * Standalone timing of one case, one revision per process.
 *
 *   node --import tsx --expose-gc perf/solo.mts <rev|WORKTREE> <case> [--iters 25]
 *   node --import tsx --expose-gc perf/solo.mts <revA> <revB> <case> [--pairs 8] [--iters 100]
 *
 * The A/B harness loads two revisions into one process, which is what makes it precise, but the
 * library's own objects are then polymorphic in shared code. That can produce a stable, repeatable
 * delta on a case whose code neither revision changed, and it can inflate a real one: one campaign
 * measured the same change at -69% paired, -54% focused and -32% standalone, each step removing
 * another part of the co-residency effect.
 *
 * So this is two things. The first form confirms a suspicious per-case row. The second form
 * alternates whole processes A, B, A, B and prints the delta of each pair: that is the number a PR
 * reports, because it is the one a maintainer reproduces.
 *
 * A number from the second form is not reportable on its own. Run the same command with the base
 * twice (`solo.mts base base <case>`) and report that control next to it. Process-to-process spread
 * differs by a factor of twenty between cases on one machine: one case resolved a 32% effect with a
 * control of +-1.5%, another could not resolve 9% with a control of +-33%. When the control covers
 * the effect, the effect is not resolvable this way, and the focused paired number is what the PR
 * reports, named as such.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { WORKTREE, failFromChild, loadCases, loadConfig, materialise, timeNs } from "./harness.mts";

const HARNESS_DIR = import.meta.dirname;
const { config, positionals, values } = loadConfig(HARNESS_DIR, process.argv.slice(2), {
  iters: { type: "string" },
  pairs: { type: "string" },
  "target-ms": { type: "string" },
  child: { type: "boolean" },
});
/**
 * The pairs form produces a claim, so it defaults to an order of magnitude more work than the
 * confirmation form: at 4 pairs of 25 iterations, allocation-heavy cases gave medians of -51% and
 * +0.2% where 8 pairs of 100 gave -15% and -14%, reproducibly. Thirty seconds for a number that
 * goes in front of a maintainer is the right price.
 */
const PAIRS = Number(values.pairs ?? 8);
const ITERS = Number(values.iters ?? (positionals.length >= 3 ? 100 : 25));

const gc: () => void = (globalThis as { gc?: () => void }).gc ?? (() => {});

/**
 * Each timed iteration repeats the body until it takes about this long, as `ab.mts` does. Timing a
 * single short body measures the timer and the scheduler: in one repository, 10 of 12 case bodies
 * took 0.04 to 0.98 ms, and the minimum of such timings is not a number to put in a PR.
 */
const TARGET_NS = Number(values["target-ms"] ?? 2) * 1_000_000;

/** Minimum ms of one body, for one revision, in this process. */
async function measure(rev: string, name: string): Promise<number> {
  const cases = await loadCases(config, materialise(config, rev, "solo"), "solo");
  const perfCase = cases.find((c) => c.name === name);
  if (!perfCase) throw new Error(`No case ${name}. Known: ${cases.map((c) => c.name).join(", ")}`);

  perfCase.setup?.();
  let probe = Number.POSITIVE_INFINITY;
  for (let w = 0; w < 10; w++) probe = Math.min(probe, await timeNs(perfCase.run));
  const reps = Math.max(1, Math.round(TARGET_NS / probe));
  const runBatch = async () => {
    for (let r = 0; r < reps; r++) await perfCase.run();
  };
  for (let w = 0; w < 3; w++) await runBatch();

  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ITERS; i++) {
    gc();
    min = Math.min(min, await timeNs(runBatch));
  }
  perfCase.teardown?.();
  return min / reps / 1_000_000;
}

function childMeasure(rev: string, name: string): number {
  const self = fileURLToPath(import.meta.url);
  const res = spawnSync(
    process.execPath,
    [
      ...process.execArgv,
      "--expose-gc",
      self,
      "--child",
      "--iters",
      String(ITERS),
      "--target-ms",
      String(TARGET_NS / 1_000_000),
      "--entry",
      config.entry,
      "--cases",
      config.cases,
      ...config.src.flatMap((s) => ["--src", s]),
      rev,
      name,
    ],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }
  );
  if (res.status !== 0) failFromChild(res.stderr ?? "");
  const lines = res.stdout.trim().split("\n");
  return Number(lines[lines.length - 1]);
}

if (values.child) {
  console.log(await measure(positionals[0], positionals[1]));
} else if (positionals.length >= 3) {
  const [revA, revB, name] = positionals;
  /** Materialise both trees here, so no child pays for a copy inside its own measurement. Without
   * this the first pair reported a 22% difference between two identical revisions. */
  const entryA = materialise(config, revA, "solo");
  materialise(config, revB, "solo");
  /** Check the name before printing a table header for a run that cannot happen. */
  const known = (await loadCases(config, entryA, "solo")).map((c) => c.name);
  if (!known.includes(name)) throw new Error(`No case ${name}. Known: ${known.join(", ")}`);
  console.log(`${name}: ${revA} vs ${revB}, ${PAIRS} alternating process pairs, min ms of ${ITERS} iterations each`);
  console.log(`${"pair".padEnd(6)}${"A".padStart(10)}${"B".padStart(10)}${"delta".padStart(9)}`);
  const deltas: Array<number> = [];
  const timesA: Array<number> = [];
  const timesB: Array<number> = [];
  for (let p = 0; p < PAIRS; p++) {
    /** Alternate which revision starts, so a machine that drifts through the sequence does not
     * hand the same side the better half of it. */
    let a: number;
    let b: number;
    if (p % 2 === 0) {
      a = childMeasure(revA, name);
      b = childMeasure(revB, name);
    } else {
      b = childMeasure(revB, name);
      a = childMeasure(revA, name);
    }
    const delta = (b / a - 1) * 100;
    deltas.push(delta);
    timesA.push(a);
    timesB.push(b);
    console.log(`${String(p + 1).padEnd(6)}${a.toFixed(4).padStart(10)}${b.toFixed(4).padStart(10)}${`${delta.toFixed(2)}%`.padStart(9)}`);
  }
  deltas.sort((x, y) => x - y);
  const mid = deltas.length % 2 ? deltas[deltas.length >> 1] : (deltas[deltas.length / 2 - 1] + deltas[deltas.length / 2]) / 2;
  console.log(`median ${mid.toFixed(2)}%, pair range ${deltas[0].toFixed(2)}% to ${deltas[deltas.length - 1].toFixed(2)}%`);
  /** Each revision's own spread across processes says whether this case can be measured this way at
   * all: the same revision measuring 2.6 to 3.4 ms from process to process is the answer to any
   * median computed from it. */
  const spread = (xs: Array<number>) => `${Math.min(...xs).toFixed(4)}..${Math.max(...xs).toFixed(4)} ms`;
  console.log(`${revA} across processes: ${spread(timesA)}`);
  console.log(`${revB} across processes: ${spread(timesB)}`);
  if (revA !== revB) {
    console.log(`control: run "solo.mts ${revA} ${revA} ${name} --pairs ${PAIRS} --iters ${ITERS}" and report it next to this number.`);
    console.log("If the control's range covers the effect, this case is not resolvable standalone: report the focused paired number instead.");
  }
} else {
  const rev = positionals[0] ?? WORKTREE;
  const name = positionals[1];
  if (!name) throw new Error("Usage: solo.mts <rev|WORKTREE> <case>   or   solo.mts <revA> <revB> <case>");
  const min = await measure(rev, name);
  console.log(`${name} @ ${rev}: min ${min.toFixed(4)} ms per body, ${ITERS} iterations`);
}
