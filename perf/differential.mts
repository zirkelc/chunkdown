/**
 * Differential test between two revisions, on inputs the guard does not cover.
 *
 *   node perf/differential.mts [revA=HEAD] [revB=WORKTREE] [--count 50000] [--seed 1]
 *
 * The guard proves behaviour on the benchmark's inputs. A rewrite of a parser, a resolver or any
 * other path whose risky inputs are long or unusual needs more than that: this runs both revisions
 * over generated and hand-picked inputs and compares their output exactly.
 *
 * Each revision runs in its own process. That is not a detail: libraries commonly keep state on
 * `globalThis` (a config, a registry, a symbol cache), and in one process the instance that loads
 * last wins for both, so a behaviour difference disappears. The timing harness can afford to share
 * a process because both sides then share the same state; a behaviour comparison cannot.
 *
 * The cases module exports `buildDifferential(lib)`: the inputs to try and how to describe a result.
 */
import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { WORKTREE, failFromChild, fnv1a, loadConfig, materialise, rng } from "./harness.mts";

export interface DifferentialSuite {
  /** Hand-picked edge cases: empty, padded, CR and CRLF, nesting, anything a fix could break. */
  fixed: Array<string>;
  /** Builds one random input from a seeded generator, so a failure is reproducible by its seed. */
  random: (rand: () => number) => string;
  /**
   * Everything observable about one result: rendered output, and the structural view as well when
   * the library exposes one (tokens, events, a tree). A difference in structure with identical
   * output is still a behaviour change.
   */
  describe: (input: string) => unknown;
  /**
   * Named checks whose input is not a string: an object with symbol keys, a proxy, a getter that
   * records the order it is read in, two values derived from one source. Each returns everything
   * observable about what it did, like `describe`.
   *
   * This is where a change that stops copying something is caught. The recipe: derive a value from
   * a source, mutate the source, report the derived value; then derive again, mutate the derived
   * value, report the source. A shared structure shows up in one of the two directions, and a guard
   * over ordinary inputs sees neither.
   */
  scenarios?: Record<string, () => unknown>;
}

const HARNESS_DIR = import.meta.dirname;
const { config, positionals, values } = loadConfig(HARNESS_DIR, process.argv.slice(2), {
  count: { type: "string" },
  seed: { type: "string" },
  child: { type: "boolean" },
  dump: { type: "string" },
});
const COUNT = Number(values.count ?? 50_000);
const SEED = Number(values.seed ?? 1);

async function suiteFor(entry: string): Promise<DifferentialSuite> {
  const lib = await import(pathToFileURL(entry).href);
  const casesModule = await import(pathToFileURL(path.join(config.root, config.cases)).href);
  if (typeof casesModule.buildDifferential !== "function") {
    throw new Error(`${config.cases} must export buildDifferential(lib) to run a differential test.`);
  }
  return casesModule.buildDifferential(lib);
}

/**
 * One unit of comparison: a named scenario, or a string input. Scenarios come first and keep their
 * own list, so a scenario name can never collide with an input and the random inputs stay
 * reproducible by index.
 */
type Item = { scenario: string } | { input: string };

/** Items are generated from the seed, so both processes see the same ones in the same order. */
function itemsOf(suite: DifferentialSuite): Array<Item> {
  const rand = rng(SEED);
  return [
    ...Object.keys(suite.scenarios ?? {}).map((scenario) => ({ scenario })),
    ...suite.fixed.map((input) => ({ input })),
    ...Array.from({ length: COUNT }, () => ({ input: suite.random(rand) })),
  ];
}

function describeSafely(suite: DifferentialSuite, item: Item): unknown {
  try {
    return "scenario" in item ? suite.scenarios![item.scenario]() : suite.describe(item.input);
  } catch (error) {
    return { __threw: String(error) };
  }
}

if (values.child) {
  const suite = await suiteFor(positionals[0]);
  const items = itemsOf(suite);
  const dump = values.dump === undefined ? undefined : Number(values.dump);
  if (dump !== undefined) {
    console.log(JSON.stringify({ item: items[dump], result: describeSafely(suite, items[dump]) }));
  } else {
    console.log(JSON.stringify(items.map((item) => fnv1a(JSON.stringify(describeSafely(suite, item))))));
  }
} else {
  const revA = positionals[0] ?? "HEAD";
  const revB = positionals[1] ?? WORKTREE;
  const entryA = materialise(config, revA, "diff-a");
  const entryB = materialise(config, revB, "diff-b");
  const self = fileURLToPath(import.meta.url);

  const run = (entry: string, extra: Array<string> = []): any => {
    const res = spawnSync(
      process.execPath,
      [
        ...process.execArgv,
        self,
        "--child",
        "--count",
        String(COUNT),
        "--seed",
        String(SEED),
        "--entry",
        config.entry,
        "--cases",
        config.cases,
        ...config.src.flatMap((s) => ["--src", s]),
        ...extra,
        entry,
      ],
      { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }
    );
    if (res.status !== 0) failFromChild(res.stderr ?? "");
    const lines = res.stdout.trim().split("\n");
    return JSON.parse(lines[lines.length - 1]);
  };

  const hashesA: Array<string> = run(entryA);
  const hashesB: Array<string> = run(entryB);
  const index = hashesA.findIndex((h, i) => h !== hashesB[i]);

  if (index === -1) {
    console.log(`identical on ${hashesA.length} items (scenarios + fixed + ${COUNT} random, seed ${SEED})`);
  } else {
    const a = run(entryA, ["--dump", String(index)]);
    const b = run(entryB, ["--dump", String(index)]);
    console.error(`DIFFERENT at item ${index}`);
    console.error(`item: ${JSON.stringify(a.item)}`);
    console.error(`${revA}: ${JSON.stringify(a.result)}`);
    console.error(`${revB}: ${JSON.stringify(b.result)}`);
    process.exit(1);
  }
}
