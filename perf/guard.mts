/**
 * Characterisation guard: hashes the observable behaviour of every case and compares it with the
 * recorded expectations.
 *
 *   node --import tsx perf/guard.mts             check the working tree, exit 1 on any difference
 *   node --import tsx perf/guard.mts --update    record expectations (once, before the first experiment)
 *   node --import tsx perf/guard.mts main --update    add the cases you added, recorded against the base
 *
 * Once the expectation file exists, `--update` can only **add** keys. An existing key whose hash
 * changed makes it fail, whichever revision it was computed from. That is the rule "never update the
 * guard to make a change pass", enforced rather than remembered; re-recording everything means
 * deleting the file, which is a visible act.
 *
 * The third form is the campaign rule for a case added mid-campaign: its expectation has to come
 * from the base revision, not from the working tree that the new case was written against. Run it
 * without `--only`, even though only one case is new. Recomputing the others against the base costs
 * one pass and is the check that nobody moved an existing case while adding the new one, which is
 * the way a guard quietly stops guarding.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { WORKTREE, fnv1a, loadCases, loadConfig, materialise } from "./harness.mts";

const HARNESS_DIR = import.meta.dirname;
const { config, positionals, values } = loadConfig(HARNESS_DIR, process.argv.slice(2), {
  update: { type: "boolean" },
  expected: { type: "string" },
});

const rev = positionals[0] ?? WORKTREE;
const expectedPath = path.resolve((values.expected as string | undefined) ?? path.join(HARNESS_DIR, "guard-expected.json"));
const cases = await loadCases(config, materialise(config, rev, "guard"));

/** Error objects serialize to `{}`, so capture their observable parts explicitly. */
function replacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return `${value}n`;
  if (value instanceof Error) return { name: value.name, message: value.message, ...(value as any) };
  if (value instanceof Map) return { __map: [...value.entries()] };
  if (value instanceof Set) return { __set: [...value.values()] };
  return value;
}

type Samples = Record<string, { hash: string; bytes: number }>;

async function sampleAll(): Promise<Samples> {
  const out: Samples = {};
  for (const c of cases) {
    let sample: unknown;
    try {
      c.setup?.();
      sample = await c.collect();
    } catch (error) {
      sample = { __threw: replacer("", error) };
    } finally {
      c.teardown?.();
    }
    const json = JSON.stringify(sample, replacer);
    out[c.name] = { hash: fnv1a(json), bytes: json.length };
  }
  return out;
}

const actual = await sampleAll();

if (values.update) {
  /**
   * Sample a second time and refuse to record anything that differs. A case that samples a random
   * value, a timestamp, an address or an input its own body mutated would otherwise be written into
   * the expectations, and the guard would fail at random for the rest of the campaign, which teaches
   * the reader to ignore it. For output that must contain randomness, sample the deterministic part
   * and add a verdict that the rest is self-consistent (a frame decodes back to its payload).
   *
   * Both samples run in this process, so a value drawn once per process (a seed, a key created at
   * module load) is stable here and unstable between runs. This check does not cover that.
   */
  const second = await sampleAll();
  const unstable = Object.keys(actual).filter((name) => actual[name].hash !== second[name]?.hash);
  if (unstable.length > 0) {
    console.error(`not recorded: ${unstable.join(", ")} gave a different sample on a second run against unchanged code.`);
    console.error("A case samples randomness, a timestamp, or an input that its own body mutates. Sample the deterministic part plus a round-trip verdict.");
    process.exit(1);
  }

  const existing: Samples = fs.existsSync(expectedPath) ? JSON.parse(fs.readFileSync(expectedPath, "utf8")) : {};
  const changed = Object.keys(actual).filter((name) => existing[name] && existing[name].hash !== actual[name].hash);
  if (changed.length > 0) {
    for (const name of changed) {
      console.error(`MISMATCH ${name}: recorded ${JSON.stringify(existing[name])}, now ${JSON.stringify(actual[name])}`);
    }
    /**
     * Never suggest deleting the file here. After the first keep, re-recording everything captures
     * the changed code, including the cases that were recorded against the base, which is the one
     * failure the merge-only rule exists to prevent, and this is the moment someone is annoyed
     * enough to do it. The two real causes have two different fixes.
     */
    console.error(`--update adds cases, it never rewrites one.`);
    console.error(`If you changed this case's collect(), remove its key from ${path.relative(process.cwd(), expectedPath)} and record it from the base: guard.mts <base> --update`);
    console.error(`If you changed the library, it changed behaviour @ ${rev}: discard the change.`);
    process.exit(1);
  }

  const added = Object.keys(actual).filter((name) => !existing[name]);
  const merged = { ...existing, ...actual };
  fs.writeFileSync(expectedPath, `${JSON.stringify(merged, null, 2)}\n`);
  console.log(
    `wrote ${path.relative(process.cwd(), expectedPath)} @ ${rev}: ${Object.keys(merged).length} cases, ${added.length} added${added.length ? ` (${added.join(", ")})` : ""}`
  );
  process.exit(0);
}

if (!fs.existsSync(expectedPath)) {
  console.error(`No expectations at ${expectedPath}. Run once with --update before the first experiment.`);
  process.exit(2);
}

const expected: Samples = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
/** A filtered run can only speak about the cases it loaded; an unfiltered one must also catch a
 * case that disappeared from the module. */
const names = config.only ? new Set(config.only) : new Set([...Object.keys(expected), ...Object.keys(actual)]);
let failed = false;
for (const name of names) {
  const e = expected[name];
  const a = actual[name];
  if (!e || !a || e.hash !== a.hash || e.bytes !== a.bytes) {
    failed = true;
    console.error(`MISMATCH ${name}: expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`);
  }
}
if (failed) {
  console.error("guard FAILED: observable behaviour changed");
  process.exit(1);
}
console.log(`guard OK (${names.size} cases @ ${rev})`);
