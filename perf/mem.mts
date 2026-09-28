/**
 * Retained memory per instance for two git revisions, for cases that define `alloc()`.
 *
 *   node --import tsx perf/mem.mts [revA=HEAD] [revB=WORKTREE] [--count 100000] [--repeats 3]
 *
 * Each measurement runs in a fresh child process with `--expose-gc`: warm up, collect,
 * retain `count` instances, collect again, and divide the heap delta by `count`. This counts
 * allocations instead of time, so it is stable to a fraction of a byte and needs no pairing.
 * The median of `repeats` children is reported per side.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { WORKTREE, loadCases, loadConfig, materialise } from "./harness.mts";

const HARNESS_DIR = import.meta.dirname;
const { config, positionals, values } = loadConfig(HARNESS_DIR, process.argv.slice(2), {
  count: { type: "string" },
  repeats: { type: "string" },
  child: { type: "boolean" },
});

const COUNT = Number(values.count ?? 100_000);
const REPEATS = Number(values.repeats ?? 3);

type Result = Record<string, number>;

async function measure(entry: string): Promise<Result> {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (!gc) throw new Error("Run the child with --expose-gc.");
  const cases = (await loadCases(config, entry, "mem")).filter((c) => c.alloc);
  const out: Result = {};
  for (const c of cases) {
    const alloc = c.alloc!;
    c.setup?.();
    /** Warm up lazily installed machinery so one-time costs are not counted per instance. */
    for (let i = 0; i < 1_000; i++) alloc();
    gc();
    gc();
    const before = process.memoryUsage().heapUsed;
    const retained: Array<unknown> = new Array(COUNT);
    for (let i = 0; i < COUNT; i++) retained[i] = alloc();
    gc();
    gc();
    out[c.name] = (process.memoryUsage().heapUsed - before) / COUNT;
    retained.length = 0;
    c.teardown?.();
  }
  return out;
}

function child(entry: string): Result {
  const self = fileURLToPath(import.meta.url);
  const res = spawnSync(
    process.execPath,
    ["--expose-gc", ...process.execArgv, self, "--child", "--count", String(COUNT), "--entry", config.entry, "--cases", config.cases, ...config.src.flatMap((s) => ["--src", s]), entry],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }
  );
  if (res.status !== 0) throw new Error(`child failed:\n${res.stderr}`);
  const lines = res.stdout.trim().split("\n");
  return JSON.parse(lines[lines.length - 1]);
}

function median(xs: Array<number>): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

if (values.child) {
  console.log(JSON.stringify(await measure(positionals[0])));
} else {
  const revA = positionals[0] ?? "HEAD";
  const revB = positionals[1] ?? WORKTREE;
  const entryA = materialise(config, revA, "a");
  const entryB = materialise(config, revB, "b");

  const runsA: Array<Result> = [];
  const runsB: Array<Result> = [];
  for (let r = 0; r < REPEATS; r++) {
    runsA.push(child(entryA));
    runsB.push(child(entryB));
  }

  const names = Object.keys(runsA[0]);
  if (names.length === 0) {
    console.log("No case defines alloc(). Add alloc() to the cases that construct instances.");
    process.exit(0);
  }
  console.log(`A = ${revA}, B = ${revB} (bytes retained per instance, median of ${REPEATS}, ${COUNT} instances)`);
  console.log(`${"case".padEnd(26)}${"A".padStart(10)}${"B".padStart(10)}${"delta B".padStart(10)}${"delta".padStart(9)}`);
  for (const name of names) {
    const a = median(runsA.map((r) => r[name]));
    const b = median(runsB.map((r) => r[name]));
    const pct = ((b - a) / a) * 100;
    console.log(`${name.padEnd(26)}${a.toFixed(1).padStart(10)}${b.toFixed(1).padStart(10)}${(b - a).toFixed(1).padStart(10)}${`${pct.toFixed(2)}%`.padStart(9)}`);
  }
}
