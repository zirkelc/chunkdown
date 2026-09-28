/**
 * Shared helpers for the node-ts autoresearch harness: configuration, revision
 * materialisation, case loading and deterministic data helpers.
 */
import { execFileSync, execSync } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

/** One benchmark workload. */
export interface PerfCase {
  /** Stable name, used as the key in reports and in the guard file. */
  name: string;
  /**
   * Timed body. Must be deterministic and side-effect free across calls, and must not accumulate
   * state on anything that outlives one call. A listener list, a cache or a registry that grows per
   * call makes every iteration slower than the last, which the minimum hides and the paired ratio
   * cancels, so the table looks ordinary while the case measures its own history.
   *
   * It may return a promise, which the harness awaits inside the timed region. The promise has to
   * cover all of the work: a body that starts a timer, an I/O callback or an unawaited chain and
   * resolves before that work finishes times the scheduling instead, and looks very fast. An async
   * body must run a fixed batch per call, so the microtask overhead stays a constant that pairing
   * can cancel instead of a term that scales with what the change did to the number of awaits.
   */
  run: () => void | Promise<void>;
  /** Serializable sample of observable behaviour, hashed by the guard. May return a promise. */
  collect: () => unknown;
  /** Optional: create and return one retained instance, measured by the memory harness. */
  alloc?: () => unknown;
  /**
   * Optional: build the case's inputs just before it runs. Inputs of every case held alive for a
   * whole run (twice, once per revision) make each collection slower and every timing noisier, so
   * a case that needs large inputs should build them here and drop them in `teardown`.
   */
  setup?: () => void;
  /** Optional: release what `setup` built. */
  teardown?: () => void;
}

/** A cases module exports this function. It receives the module namespace of the entry point. */
export type BuildCases = (lib: any) => Array<PerfCase>;

/** Pseudo revision that means "the working tree as it is on disk". */
export const WORKTREE = "WORKTREE";

export interface HarnessConfig {
  /** Absolute repo root. */
  root: string;
  /** Entry point, relative to the repo root (for example `packages/lib/src/index.ts`). */
  entry: string;
  /** Paths archived per revision, relative to the repo root. */
  src: Array<string>;
  /** Cases module, relative to the repo root. */
  cases: string;
  /**
   * Command that turns the sources of a tree into what users load, run with the tree root as the
   * working directory. Set it whenever the shipped artifact is generated, especially when it is
   * gitignored: without it the harness would measure whatever happens to lie on disk.
   */
  build?: string | undefined;
  /**
   * Command run once per workspace, in the order of the root manifest's `workspaces` field, for
   * builds where a package needs its dependencies built first.
   */
  buildWorkspaces?: string | undefined;
  /**
   * Third-party packages that import the workspace packages by name. They are copied into the
   * tree (a symlink would resolve to its realpath and pull in the working tree again). Matched as
   * a regular expression against the directory names in the root `node_modules`.
   */
  copyDependents?: string | undefined;
  /**
   * Generates the tree's entry from a map of alias to specifier, so the cases receive one `lib`
   * whose parts all come from the same revision. Specifiers are package names or paths relative to
   * the tree root. When set, this replaces `entry` as the imported module.
   */
  entryModules?: Record<string, string> | undefined;
  /** Raw source of the generated entry, when the aliases of `entryModules` are not expressive enough. */
  entrySource?: string | undefined;
  /** Package names whose resolution must stay inside the tree. Checked once per materialisation. */
  verifyResolve?: Array<string> | undefined;
  /**
   * Case names to keep, from `--only`. A run limited to the case a change targets fits many more
   * paired iterations into the same time and drops the other cases' heap, which is what makes a
   * per-case decision possible on a busy machine.
   */
  only?: Array<string> | undefined;
}

const CONFIG_FILE = "perf.config.json";

/**
 * Reads `perf.config.json` next to the harness scripts, then applies CLI flags on top.
 * Returns the resolved config and the remaining positional arguments.
 */
export function loadConfig(
  harnessDir: string,
  argv: Array<string>,
  extraOptions: Record<string, { type: "string" | "boolean"; multiple?: boolean }> = {}
): { config: HarnessConfig; positionals: Array<string>; values: Record<string, any> } {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      entry: { type: "string" },
      src: { type: "string", multiple: true },
      cases: { type: "string" },
      only: { type: "string" },
      ...extraOptions,
    },
  });

  const configPath = path.join(harnessDir, CONFIG_FILE);
  const fileConfig = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};

  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: harnessDir }).toString().trim();
  const entry = (values.entry as string | undefined) ?? fileConfig.entry;
  const src = (values.src as Array<string> | undefined) ?? fileConfig.src;
  const cases = (values.cases as string | undefined) ?? fileConfig.cases ?? path.relative(root, path.join(harnessDir, "cases.mts"));

  if (!entry || !src?.length) {
    throw new Error(`Set "entry" and "src" in ${configPath} or pass --entry and --src.`);
  }
  return {
    config: {
      root,
      entry,
      src,
      cases,
      build: fileConfig.build,
      buildWorkspaces: fileConfig.buildWorkspaces,
      copyDependents: fileConfig.copyDependents,
      entryModules: fileConfig.entryModules,
      entrySource: fileConfig.entrySource,
      verifyResolve: fileConfig.verifyResolve,
      only: (values.only as string | undefined)?.split(",").map((n) => n.trim()),
    },
    positionals,
    values,
  };
}

/**
 * Trees live under `node_modules/.perf-trees` when that directory exists. Everything in a repo
 * already ignores `node_modules`: formatters, linters, type checkers and test globs. `.git/info/
 * exclude` only hides a directory from git, which is not the same thing and was not enough.
 */
function treesDir(config: HarnessConfig): string {
  const inNodeModules = path.join(config.root, "node_modules");
  const base = fs.existsSync(inNodeModules) ? inNodeModules : config.root;
  return path.join(base, ".perf-trees");
}

/**
 * The paths a tree needs: the configured sources, plus the `package.json` of every directory above
 * them. Those manifests decide module type, exports and dependencies, so a tree without them loads
 * ESM sources as CommonJS and resolution behaves unlike the real package.
 */
function treePaths(config: HarnessConfig): Array<string> {
  const manifests = new Set<string>();
  for (const src of config.src) {
    let rel: string = src;
    while (rel && rel !== "." && rel !== path.sep) {
      const candidate = path.join(rel, "package.json");
      if (fs.existsSync(path.join(config.root, candidate))) manifests.add(candidate);
      rel = path.dirname(rel);
    }
  }
  if (fs.existsSync(path.join(config.root, "package.json"))) manifests.add("package.json");
  return [...config.src, ...manifests];
}

/** Content hash of the working tree's tracked and untracked source files. */
function worktreeKey(config: HarnessConfig): string {
  const listed = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "--", ...treePaths(config)], {
    cwd: config.root,
    maxBuffer: 1 << 28,
  })
    .toString()
    .split("\n")
    .filter(Boolean)
    .sort();
  const hash = crypto.createHash("sha1");
  for (const rel of listed) {
    hash.update(rel);
    hash.update("\0");
    try {
      hash.update(fs.readFileSync(path.join(config.root, rel)));
    } catch {
      /* deleted between listing and reading */
    }
  }
  return `wt-${hash.digest("hex").slice(0, 16)}`;
}

/**
 * Materialises `rev` into its own directory and returns the absolute entry path inside it.
 *
 * One directory per slot, so a revision compared with itself still gives two real copies. The
 * working tree is materialised too whenever a build is configured, and keyed by the content of its
 * sources: an unchanged tree reuses its build, any edit produces a new one, and no side can fall
 * back to a stale artifact on disk.
 */
export function materialise(config: HarnessConfig, rev: string, slot: string): string {
  /** The working tree can be used as it lies only when nothing has to be produced for a tree: no
   * build, and no generated entry, which exists only inside a materialised tree. */
  const produces = Boolean(config.build || config.buildWorkspaces || config.entryModules || config.entrySource);
  if (rev === WORKTREE && !produces) return entryPath(config, config.root);

  const revKey =
    rev === WORKTREE
      ? worktreeKey(config)
      : execFileSync("git", ["rev-parse", `${rev}^{commit}`], { cwd: config.root }).toString().trim();
  /** Config that shapes a tree belongs in its key, or changing that config silently reuses a tree
   * built under the old one. */
  const shape = crypto
    .createHash("sha1")
    .update(JSON.stringify([treePaths(config), config.build, config.buildWorkspaces, config.copyDependents, config.entryModules, config.entrySource]))
    .digest("hex")
    .slice(0, 8);
  const key = revKey;
  const dir = path.join(treesDir(config), `${revKey}-${shape}-${slot}`);

  if (!fs.existsSync(dir)) {
    const tmp = `${dir}.tmp-${process.pid}`;
    fs.mkdirSync(tmp, { recursive: true });
    if (rev === WORKTREE) {
      copyWorktree(config, tmp);
    } else {
      const tar = execFileSync("git", ["archive", "--format=tar", key, "--", ...treePaths(config)], {
        cwd: config.root,
        maxBuffer: 1 << 30,
      });
      execFileSync("tar", ["-x", "-C", tmp], { input: tar });
    }
    const workspaceNames: Set<string> = linkWorkspacePackages(config, tmp);
    copyDependents(config, tmp, workspaceNames);
    linkNodeModules(config, tmp);
    /** The build runs first: a generated entry may point at a file the build produces. */
    runBuild(config, tmp);
    writeGeneratedEntry(config, tmp);
    fs.renameSync(tmp, dir);
  }
  verifyResolution(config, dir, workspaceNamesIn(dir));
  return entryPath(config, dir);
}

function entryPath(config: HarnessConfig, treeDir: string): string {
  return path.join(treeDir, config.entryModules ? "perf-entry.mjs" : config.entry);
}

/** Copies the working tree's source files, tracked and untracked, ignoring what git ignores. */
function copyWorktree(config: HarnessConfig, treeDir: string): void {
  const listed = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "--", ...treePaths(config)], {
    cwd: config.root,
    maxBuffer: 1 << 28,
  })
    .toString()
    .split("\n")
    .filter(Boolean);
  for (const rel of listed) {
    const target = path.join(treeDir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(config.root, rel), target);
  }
}

/** Every package inside the tree becomes resolvable by name from within the tree. */
function linkWorkspacePackages(config: HarnessConfig, treeDir: string): Set<string> {
  const modulesDir = path.join(treeDir, "node_modules");
  const names = new Set<string>();
  for (const src of config.src) {
    for (const pkgDir of findPackages(path.join(treeDir, src))) {
      let name: string;
      try {
        name = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8")).name;
      } catch {
        continue;
      }
      if (!name) continue;
      names.add(name);
      const link = path.join(modulesDir, name);
      if (fs.existsSync(link)) continue;
      fs.mkdirSync(path.dirname(link), { recursive: true });
      fs.symlinkSync(path.relative(path.dirname(link), pkgDir), link, "dir");
    }
  }
  return names;
}

function findPackages(dir: string): Array<string> {
  /** A `src` entry can be a single file (a root `index.js`, an entry module), which holds no package. */
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  const found: Array<string> = [];
  if (fs.existsSync(path.join(dir, "package.json"))) found.push(dir);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== "node_modules") {
      found.push(...findPackages(path.join(dir, entry.name)));
    }
  }
  return found;
}

/**
 * Third-party packages that import the workspace packages by name need a real copy in the tree.
 * A symlink resolves to its realpath in the root `node_modules`, and from there the package would
 * import the working tree's code again, which puts one revision on both sides of the comparison.
 */
function rootManifest(config: HarnessConfig, name: string): any | undefined {
  try {
    return JSON.parse(fs.readFileSync(path.join(config.root, "node_modules", name, "package.json"), "utf8"));
  } catch {
    return undefined;
  }
}

function listRootPackages(config: HarnessConfig): Array<string> {
  const rootModules = path.join(config.root, "node_modules");
  if (!fs.existsSync(rootModules)) return [];
  const names: Array<string> = [];
  for (const entry of fs.readdirSync(rootModules, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name.startsWith("@")) {
      for (const scoped of fs.readdirSync(path.join(rootModules, entry.name))) names.push(`${entry.name}/${scoped}`);
    } else {
      names.push(entry.name);
    }
  }
  return names;
}

/**
 * Decides which third-party packages must be copied into the tree.
 *
 * A package needs a copy when it depends on a workspace package, and also when it depends on a
 * package that needs one: otherwise it resolves that dependency from the repo root and pulls the
 * working tree's code back in behind the harness. The answer is therefore a fixpoint over the
 * dependency closure of the entry, not a list someone remembers to write. Getting it wrong is the
 * worst defect available here, because both sides then run the same code and the numbers look
 * ordinary. `copyDependents` stays as a manual addition for cases the closure cannot see.
 */
function dependentsToCopy(config: HarnessConfig, workspaceNames: Set<string>): Set<string> {
  const closure = new Set<string>();
  const queue = Object.values(config.entryModules ?? {}).filter((spec) => !spec.startsWith(".") && !spec.startsWith("/"));
  while (queue.length) {
    const name = queue.pop()!;
    if (closure.has(name) || workspaceNames.has(name)) continue;
    const manifest = rootManifest(config, name);
    if (!manifest) continue;
    closure.add(name);
    queue.push(...Object.keys(manifest.dependencies ?? {}));
  }

  const copy = new Set<string>();
  for (let changed = true; changed; ) {
    changed = false;
    for (const name of closure) {
      if (copy.has(name)) continue;
      const deps = Object.keys(rootManifest(config, name)?.dependencies ?? {});
      if (deps.some((dep) => workspaceNames.has(dep) || copy.has(dep))) {
        copy.add(name);
        changed = true;
      }
    }
  }

  if (config.copyDependents) {
    const pattern = new RegExp(config.copyDependents);
    for (const name of listRootPackages(config)) if (pattern.test(name)) copy.add(name);
  }
  return copy;
}

function copyDependents(config: HarnessConfig, treeDir: string, workspaceNames: Set<string>): void {
  const rootModules = path.join(config.root, "node_modules");
  if (!fs.existsSync(rootModules)) return;
  for (const name of dependentsToCopy(config, workspaceNames)) {
    const target = path.join(treeDir, "node_modules", name);
    if (fs.existsSync(target)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(path.join(rootModules, name), target, { recursive: true, dereference: true });
  }
}

/**
 * Workspace packages often keep their own `node_modules` next to their sources. Link the ones that
 * exist between a source path and the repo root; the root `node_modules` is reached by normal
 * upward resolution.
 */
function linkNodeModules(config: HarnessConfig, treeDir: string): void {
  for (const src of config.src) {
    let rel = path.dirname(src);
    while (rel && rel !== "." && rel !== path.sep) {
      const real = path.join(config.root, rel, "node_modules");
      const link = path.join(treeDir, rel, "node_modules");
      if (fs.existsSync(real) && !fs.existsSync(link) && fs.existsSync(path.dirname(link))) {
        fs.symlinkSync(real, link, "dir");
      }
      rel = path.dirname(rel);
    }
  }
}

/**
 * Writes an entry that re-exports the library and the ecosystem pieces the cases need. Runs after
 * the build, so a specifier may point at a generated file.
 *
 * A specifier starting with `.` or `/` is a path inside the tree; anything else is a package name.
 * The decision never depends on what exists on disk, because that made the result depend on when
 * this ran. The alias `*` re-exports flat, so cases can use one `lib` without a shim.
 */
function writeGeneratedEntry(config: HarnessConfig, treeDir: string): void {
  if (config.entrySource) {
    fs.writeFileSync(path.join(treeDir, "perf-entry.mjs"), config.entrySource.endsWith("\n") ? config.entrySource : `${config.entrySource}\n`);
    return;
  }
  if (!config.entryModules) return;
  const lines = Object.entries(config.entryModules).map(([alias, specifier]) => {
    const target = specifier.startsWith("/") ? path.relative(treeDir, specifier) : specifier;
    const from = JSON.stringify(target.startsWith(".") || target.startsWith("/") ? target : target);
    return alias === "*" ? `export * from ${from};` : `export * as ${alias} from ${from};`;
  });
  fs.writeFileSync(path.join(treeDir, "perf-entry.mjs"), `${lines.join("\n")}\n`);
}

/** Runs the repo's build inside the tree, in workspace order when the build needs it. */
function runBuild(config: HarnessConfig, treeDir: string): void {
  const env = { ...process.env, PATH: `${path.join(config.root, "node_modules", ".bin")}:${process.env.PATH ?? ""}` };
  if (config.buildWorkspaces) {
    const workspaces = workspaceOrder(config, treeDir).filter((w) => fs.existsSync(path.join(treeDir, w)));
    if (workspaces.length === 0) {
      throw new Error(
        `buildWorkspaces is set but no workspace exists in the tree. Check the root manifest's "workspaces" field and that "src" covers those directories.`
      );
    }
    for (const workspace of workspaces) {
      execSync(config.buildWorkspaces, { cwd: path.join(treeDir, workspace), env, stdio: "inherit" });
    }
  }
  if (config.build) execSync(config.build, { cwd: treeDir, env, stdio: "inherit" });
}

/**
 * Workspace directories in an order a dependency-aware build can use: globs expanded, then sorted
 * so a package comes after the workspace packages it depends on. A hand-written manifest order is
 * meaningful, a glob is not, and a build that silently builds nothing is worse than one that fails.
 */
function workspaceOrder(config: HarnessConfig, treeDir: string): Array<string> {
  let patterns: Array<string> = [];
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(config.root, "package.json"), "utf8"));
    patterns = Array.isArray(manifest.workspaces) ? manifest.workspaces : (manifest.workspaces?.packages ?? []);
  } catch {
    patterns = [];
  }

  const dirs: Array<string> = [];
  for (const pattern of patterns) {
    if (!pattern.includes("*")) {
      dirs.push(pattern);
      continue;
    }
    const base = pattern.slice(0, pattern.indexOf("*")).replace(/\/$/, "");
    const baseDir = path.join(treeDir, base);
    if (!fs.existsSync(baseDir)) continue;
    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (entry.isDirectory() && fs.existsSync(path.join(baseDir, entry.name, "package.json"))) {
        dirs.push(path.posix.join(base, entry.name));
      }
    }
  }

  /** Topological sort over the dependencies that are themselves workspace packages. */
  const byName = new Map<string, string>();
  const deps = new Map<string, Array<string>>();
  for (const dir of dirs) {
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(treeDir, dir, "package.json"), "utf8"));
      if (manifest.name) byName.set(manifest.name, dir);
      deps.set(dir, Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }));
    } catch {
      deps.set(dir, []);
    }
  }
  const ordered: Array<string> = [];
  const done = new Set<string>();
  const visit = (dir: string, seen: Set<string>): void => {
    if (done.has(dir) || seen.has(dir)) return;
    seen.add(dir);
    for (const dep of deps.get(dir) ?? []) {
      const depDir = byName.get(dep);
      if (depDir && depDir !== dir) visit(depDir, seen);
    }
    done.add(dir);
    ordered.push(dir);
  };
  for (const dir of dirs) visit(dir, new Set());
  return ordered;
}

/**
 * Asserts that the configured package names resolve inside the tree. A resolution that escapes to
 * the repo root puts the working tree's code on both sides of the comparison, which produces
 * plausible numbers and no symptom, so this runs before any measurement rather than after one.
 */
/** Workspace package names of an existing tree: the links that point back into the tree itself. */
function workspaceNamesIn(treeDir: string): Set<string> {
  const modulesDir = path.join(treeDir, "node_modules");
  const names = new Set<string>();
  for (const name of listTreePackages(modulesDir)) {
    const entry = path.join(modulesDir, name);
    try {
      if (fs.lstatSync(entry).isSymbolicLink() && fs.realpathSync(entry).startsWith(`${treeDir}${path.sep}`)) {
        names.add(name);
      }
    } catch {
      /* broken link */
    }
  }
  return names;
}

function verifyResolution(config: HarnessConfig, treeDir: string, workspaceNames: Set<string>): void {
  if (!config.verifyResolve?.length) return;

  /**
   * Only two kinds of import have to stay inside the tree: the workspace packages, and the
   * third-party packages the closure decided to copy. Everything else is shared with the repo on
   * purpose, resolves to the root, and is not a leak. Checking every dependency instead reported
   * twenty escapes and no real one on a real monorepo, which stops a campaign before it measures
   * anything. Do not weaken this to "exists in the tree": a package that is missing from the tree
   * would then not be checked at all, which is exactly the leak this exists to find.
   */
  const mustStayInside = new Set<string>([
    ...workspaceNames,
    ...dependentsToCopy(config, workspaceNames),
    ...config.verifyResolve,
  ]);

  /**
   * Resolution is a property of the importer, not of the tree, so checking only from the tree root
   * misses the leak that matters: a copied third-party package resolving its own dependency back to
   * the repo root. Every copied package therefore gets a probe of its own, and each probe resolves
   * what that package depends on.
   */
  const probes: Array<{ dir: string; names: Array<string> }> = [{ dir: treeDir, names: config.verifyResolve }];
  const copiedRoot = path.join(treeDir, "node_modules");
  for (const name of listTreePackages(copiedRoot)) {
    const pkgDir = path.join(copiedRoot, name);
    if (fs.lstatSync(pkgDir).isSymbolicLink()) continue;
    let deps: Array<string> = [];
    try {
      deps = Object.keys(JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8")).dependencies ?? {});
    } catch {
      continue;
    }
    const checked = deps.filter((dep) => mustStayInside.has(dep));
    if (checked.length) probes.push({ dir: pkgDir, names: checked });
  }

  /** Compare real paths on both sides: a repo reached through a symlink (macOS `/tmp`, a linked
   * home, a worktree under a linked directory) resolves to a different prefix than the one the
   * harness holds, and every import inside the tree would read as an escape. */
  const treeReal = realpathOr(treeDir);
  const escaped: Array<string> = [];
  for (const { dir, names } of probes) {
    const probe = path.join(dir, "perf-resolve-check.mjs");
    fs.writeFileSync(
      probe,
      `const names = ${JSON.stringify(names)};\n` +
        `const out = {};\nfor (const n of names) { try { out[n] = import.meta.resolve(n); } catch (e) { out[n] = ""; } }\n` +
        `console.log(JSON.stringify(out));\n`
    );
    const resolved: Record<string, string> = JSON.parse(execFileSync(process.execPath, [probe], { encoding: "utf8" }));
    fs.rmSync(probe, { force: true });
    for (const [name, url] of Object.entries(resolved)) {
      if (!url) continue;
      /** Compare paths, not URLs: a directory with a space is percent-encoded in the URL. */
      const resolvedPath = realpathOr(url.startsWith("file:") ? fileURLToPath(url) : url);
      if (resolvedPath.startsWith(`${treeReal}${path.sep}`)) continue;
      /** Node built-ins never live in the tree and are not a leak. */
      if (url.startsWith("node:")) continue;
      escaped.push(`  ${name} (imported from ${path.relative(treeDir, dir) || "."}) -> ${resolvedPath}`);
    }
  }

  if (escaped.length) {
    throw new Error(`These imports resolve outside the tree, so both sides would load the same code:\n${escaped.join("\n")}`);
  }
}

function realpathOr(target: string): string {
  try {
    return fs.realpathSync(target);
  } catch {
    return target;
  }
}

/** Package names directly under a `node_modules` directory, scopes expanded. */
function listTreePackages(modulesDir: string): Array<string> {
  if (!fs.existsSync(modulesDir)) return [];
  const names: Array<string> = [];
  for (const entry of fs.readdirSync(modulesDir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name.startsWith("@")) {
      for (const scoped of fs.readdirSync(path.join(modulesDir, entry.name))) names.push(`${entry.name}/${scoped}`);
    } else {
      names.push(entry.name);
    }
  }
  return names;
}

/**
 * Imports the entry module and builds the cases against it.
 *
 * `slot` gives this side its own instance of the cases module. Without it both revisions share one
 * instance, so every case function sees two hidden-class families and can report a large, stable
 * delta for code that neither revision touched. See `references/methodology.md`.
 */
export async function loadCases(config: HarnessConfig, entryPath: string, slot?: string): Promise<Array<PerfCase>> {
  const lib = await import(pathToFileURL(entryPath).href);
  const casesUrl = pathToFileURL(path.join(config.root, config.cases)).href;
  const casesModule = await import(slot ? `${casesUrl}?slot=${slot}` : casesUrl);
  const build: BuildCases | undefined = casesModule.buildCases;
  if (typeof build !== "function") throw new Error(`${config.cases} must export buildCases(lib).`);
  const cases = build(lib);
  if (!config.only) return cases;
  /** A typo must not measure nothing quietly: name what was asked for and what exists. */
  const unknown = config.only.filter((name) => !cases.some((c) => c.name === name));
  if (unknown.length > 0) {
    throw new Error(`--only names no case: ${unknown.join(", ")}. Known: ${cases.map((c) => c.name).join(", ")}`);
  }
  return cases.filter((c) => config.only!.includes(c.name));
}

/**
 * Reports a failed child process and exits.
 *
 * A harness error (an unknown case name, a missing export, a resolution escape) carries its whole
 * message on one line, written to be read. Rethrowing it from the parent wraps that line in the
 * child's stack and the parent's, which is how a clear message becomes something to scroll past. An
 * unexpected crash keeps its full output, because there the stack is the message.
 */
export function failFromChild(stderr: string): never {
  const line = stderr.split("\n").find((l) => l.startsWith("Error:"));
  console.error(line ?? `child failed:\n${stderr}`);
  process.exit(1);
}

/**
 * Times the same pure CPU loop `repeats` times and reports the spread. The loop cannot become
 * faster than its true cost, so the spread is what the machine adds: other load, frequency changes,
 * or a scheduler that moves the process between cores of different speed. Used by `jitter.mts`
 * before a run and by `ab.mts` after one, because a run is only valid if the machine was quiet for
 * all of it, which nothing can tell you before it has finished.
 */
export function cpuProbe(repeats = 40): { min: number; p50: number; max: number; spread: number } {
  const times: Array<number> = [];
  for (let r = 0; r < repeats; r++) {
    const start = process.hrtime.bigint();
    let x = 0;
    for (let i = 0; i < 20_000_000; i++) x = (x + i * 7) % 1_000_003;
    times.push(Number(process.hrtime.bigint() - start) / 1_000_000);
  }
  times.sort((a, b) => a - b);
  const min = times[0];
  const p50 = times[times.length >> 1];
  return { min, p50, max: times[times.length - 1], spread: (p50 / min - 1) * 100 };
}

/** mulberry32 PRNG, for seeded and reproducible benchmark inputs. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** FNV-1a 32-bit hash of a string. */
export function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Wall-clock duration of `fn` in nanoseconds. A returned promise is awaited inside the timing, so
 * an async body is measured to its resolution. A synchronous body returns nothing, so it pays one
 * function return and no microtask: the await never happens.
 */
export async function timeNs(fn: () => void | Promise<void>): Promise<number> {
  const start = process.hrtime.bigint();
  const pending = fn();
  if (pending) await pending;
  return Number(process.hrtime.bigint() - start);
}
