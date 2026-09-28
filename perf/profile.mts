/**
 * CPU profile of the cases against the working tree, aggregated per function.
 *
 *   node --import tsx perf/profile.mts [case,case,...] [--seconds 4] [--top 30]
 *   node --import tsx perf/profile.mts --by-area          self time by path prefix
 *   node --import tsx perf/profile.mts --lines src/parse.js:120   line view of an anonymous function
 *
 * Profiles in-process through the inspector, writes the raw profile to `.perf-prof/` in the
 * repo root (open it in Chrome DevTools if needed), and prints self and total time per
 * function. Frames from `node_modules` and Node internals are dropped: loader frames are an
 * artefact of running through a TypeScript loader.
 *
 * Self time above total time for a frame means V8 inlined it into its caller. The two numbers are
 * then attributed to different frames and the line-level view inside that function is not evidence:
 * one campaign spent an experiment on a statement that a profile called hot and that no longer
 * existed as a separate frame.
 */
import * as fs from "node:fs";
import { Session } from "node:inspector/promises";
import * as path from "node:path";
import { WORKTREE, loadCases, loadConfig, materialise } from "./harness.mts";

const HARNESS_DIR = import.meta.dirname;
const { config, positionals, values } = loadConfig(HARNESS_DIR, process.argv.slice(2), {
  seconds: { type: "string" },
  top: { type: "string" },
  deps: { type: "boolean" },
  callers: { type: "string" },
  lines: { type: "string" },
  "by-area": { type: "boolean" },
  depth: { type: "string" },
});
/** Dependency frames matter when the library hands its hot loops to them (parser, selector engine). */
const DEPS = Boolean(values.deps);
const SECONDS = Number(values.seconds ?? 4);
const TOP = Number(values.top ?? 30);

/** A positional case list is the older spelling of `--only`; both end up in the same filter. */
if (positionals[0] && !config.only) config.only = positionals[0].split(",");
const selected = await loadCases(config, materialise(config, WORKTREE, "profile"));

for (const c of selected) c.setup?.();
/** Warm up before sampling so the profile shows optimized code, not the interpreter. */
for (const c of selected) for (let i = 0; i < 10; i++) await c.run();

const session = new Session();
session.connect();
await session.post("Profiler.enable");
await session.post("Profiler.setSamplingInterval", { interval: 100 });
await session.post("Profiler.start");
const start = Date.now();
while (Date.now() - start < SECONDS * 1_000) {
  for (const c of selected) await c.run();
}
const { profile } = (await session.post("Profiler.stop")) as { profile: any };
session.disconnect();
for (const c of selected) c.teardown?.();

const outDir = path.join(config.root, ".perf-prof");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `profile-${Date.now()}.cpuprofile`);
fs.writeFileSync(outFile, JSON.stringify(profile));

interface ProfileNode {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  children?: Array<number>;
}
const nodes: Array<ProfileNode> = profile.nodes;
const byId = new Map<number, ProfileNode>(nodes.map((n) => [n.id, n]));
const parent = new Map<number, number>();
for (const n of nodes) for (const c of n.children ?? []) parent.set(c, n.id);

const selfTime = new Map<number, number>();
const samples: Array<number> = profile.samples;
const deltas: Array<number> = profile.timeDeltas;
for (let i = 0; i < samples.length; i++) selfTime.set(samples[i], (selfTime.get(samples[i]) ?? 0) + (deltas[i] ?? 0));

const totalTime = new Map<number, number>();
for (const [id, t] of selfTime) {
  let cur: number | undefined = id;
  while (cur !== undefined) {
    totalTime.set(cur, (totalTime.get(cur) ?? 0) + t);
    cur = parent.get(cur);
  }
}

const rootUrl = `file://${config.root}/`;

/**
 * Trees live under `node_modules/.perf-trees`, so that prefix has to go before anything decides
 * whether a frame belongs to a dependency. Every consumer uses this, not just the label: counting
 * raw URLs reported 86% of samples as dependencies on a workload whose real share was about 35%.
 */
function withoutTreePrefix(url: string): string {
  const inTree = url.match(/node_modules\/\.perf-trees\/[^/]+\//);
  return inTree ? url.slice(url.indexOf(inTree[0]) + inTree[0].length) : url;
}

function isDependency(url: string): boolean {
  return withoutTreePrefix(url).includes("node_modules/");
}

function label(n: ProfileNode): string | null {
  const { url, functionName, lineNumber } = n.callFrame;
  const classified = withoutTreePrefix(url);
  if (url.startsWith("node:") || (classified.includes("node_modules/") && !DEPS)) return null;
  if (!url && (!functionName || ["(program)", "(idle)", "(root)"].includes(functionName))) return null;
  const file = classified.includes("node_modules/")
    ? classified.slice(classified.lastIndexOf("node_modules/") + "node_modules/".length)
    : classified.startsWith(rootUrl)
      ? classified.slice(rootUrl.length)
      : classified.replace(/^file:\/\//, "");
  return `${functionName || "(anonymous)"} ${file}${file ? `:${lineNumber + 1}` : ""}`;
}

const aggSelf = new Map<string, number>();
const aggTotal = new Map<string, number>();
for (const n of nodes) {
  const l = label(n);
  if (!l) continue;
  aggSelf.set(l, (aggSelf.get(l) ?? 0) + (selfTime.get(n.id) ?? 0));
  /** Recursive frames would count twice in total time; keep the largest per label. */
  aggTotal.set(l, Math.max(aggTotal.get(l) ?? 0, totalTime.get(n.id) ?? 0));
}

const grand = [...selfTime.values()].reduce((a, b) => a + b, 0);
function print(title: string, m: Map<string, number>): void {
  console.log(`\n== ${title} ==`);
  for (const [l, t] of [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP)) {
    console.log(`${((t / grand) * 100).toFixed(1).padStart(6)}%  ${(t / 1_000).toFixed(1).padStart(8)}ms  ${l}`);
  }
}
console.log(`profiled ${selected.map((c) => c.name).join(", ")} for ${SECONDS}s -> ${path.relative(config.root, outFile)}`);

/** A library that hands its hot loops to a dependency spends most of its time in frames that are
 * hidden by default, so say how much is hidden instead of letting it be found by luck. */
if (!DEPS) {
  let depTime = 0;
  for (const n of nodes) {
    if (isDependency(n.callFrame.url)) depTime += selfTime.get(n.id) ?? 0;
  }
  const share = (depTime / grand) * 100;
  if (share >= 1) console.log(`dependencies: ${share.toFixed(0)}% of samples are hidden, re-run with --deps to see them`);
}

print("self time", aggSelf);
print("total time", aggTotal);

/**
 * Self time by path prefix. It answers the question every campaign asks once and by hand: how much
 * of this profile is my instrument rather than the library. A case driven through a mock, a fixture
 * loader or a test double is only trustworthy when that share is small, and "small" has to be a
 * number.
 */
if (values["by-area"]) {
  const DEPTH = Number(values.depth ?? 2);
  const byArea = new Map<string, number>();
  for (const n of nodes) {
    const t = selfTime.get(n.id) ?? 0;
    if (t === 0) continue;
    const url = n.callFrame.url;
    const classified = withoutTreePrefix(url);
    let area: string;
    /** Frames without a file are a third of some profiles, and "(vm)" is not an answer to
     * anything. The collector's share in particular is the signal that sends a campaign looking
     * for allocations, so keep the labels the profile itself gives. */
    if (!url) area = n.callFrame.functionName || "(anonymous native)";
    else if (url.startsWith("node:")) area = "node:";
    else if (classified.includes("node_modules/")) {
      const rest = classified.slice(classified.lastIndexOf("node_modules/") + "node_modules/".length);
      area = `node_modules/${rest.startsWith("@") ? rest.split("/").slice(0, 2).join("/") : rest.split("/")[0]}/`;
    } else {
      const rel = classified.startsWith(rootUrl) ? classified.slice(rootUrl.length) : classified.replace(/^file:\/\//, "");
      /** `--depth` directory levels. Two separates `lib/web/` from `lib/core/`; a campaign working
       * inside one of them needs three, or its four areas merge into one line. A root-level file
       * lands under its directory, not under its own name. */
      const dir = rel.split("/").slice(0, -1);
      area = dir.length === 0 ? "(root)" : `${dir.slice(0, DEPTH).join("/")}/`;
    }
    byArea.set(area, (byArea.get(area) ?? 0) + t);
  }
  /**
   * V8's own labels for frames without a file are worth their own rows: the collector's share is the
   * allocation signal a campaign acts on, and `runMicrotasks` is where an async workload's scheduling
   * sits. The individual builtins below them (`parse`, `now`, `latin1Slice`) are a long tail that
   * pushes the useful rows off the screen, so collapse the small ones and keep any that is large
   * enough to be worth a look on its own.
   */
  const total = [...byArea.values()].reduce((a, b) => a + b, 0);
  const grouped = new Map<string, number>();
  for (const [area, t] of byArea) {
    const isFile = area.includes("/") || area.endsWith(":");
    const keep = isFile || area.startsWith("(") || t / total >= 0.02;
    grouped.set(keep ? area : "(native)", (grouped.get(keep ? area : "(native)") ?? 0) + t);
  }
  print(`self time by area (depth ${DEPTH})`, grouped);
}

/**
 * The top-function view finds a hot function and says nothing about which of its callers or which
 * of its statements to change, which is the actual decision. These two views answer that.
 *
 * A frame can be selected by function name, or as `file:line` for the anonymous functions that name
 * selection cannot reach (converters, callbacks, arrow functions in a table).
 */
const focus = (values.callers ?? values.lines) as string | undefined;
if (focus) {
  const atLine = focus.match(/^(.*):(\d+)$/);
  const matches = atLine
    ? (n: ProfileNode) => withoutTreePrefix(n.callFrame.url).endsWith(atLine[1]) && n.callFrame.lineNumber + 1 === Number(atLine[2])
    : (n: ProfileNode) => n.callFrame.functionName === focus;
  if (values.callers) {
    const byCaller = new Map<string, number>();
    for (const n of nodes.filter(matches)) {
      const up = parent.get(n.id);
      const caller = up === undefined ? "(root)" : (label(byId.get(up)!) ?? byId.get(up)!.callFrame.functionName);
      byCaller.set(caller, (byCaller.get(caller) ?? 0) + (selfTime.get(n.id) ?? 0));
    }
    print(`self time of ${focus} by caller`, byCaller);
  }
  if (values.lines) {
    const byLine = new Map<string, number>();
    for (const n of nodes.filter(matches)) {
      for (const tick of (n as any).positionTicks ?? []) {
        const key = `${label(n) ?? focus} line ${tick.line}`;
        byLine.set(key, (byLine.get(key) ?? 0) + tick.ticks);
      }
    }
    if (byLine.size === 0) {
      console.log(`\nno line ticks for ${focus}: is the name spelled as it appears above? An anonymous function is selected as file:line.`);
    } else {
      /** Ticks are counts, not microseconds: print them as counts and as a share of this
       * function's own ticks, or every line reads as 0.0 ms and the ranking says nothing. */
      const total = [...byLine.values()].reduce((a, b) => a + b, 0);
      console.log(`\n== ticks of ${focus} by line (${total} ticks total) ==`);
      for (const [key, ticks] of [...byLine.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP)) {
        console.log(`${((ticks / total) * 100).toFixed(1).padStart(6)}%  ${String(ticks).padStart(8)} ticks  ${key}`);
      }
    }
  }
}
