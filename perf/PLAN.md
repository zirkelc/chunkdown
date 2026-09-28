# Performance campaign 2: chunkdown (perf-campaign-2)

Budget: 10 experiments. Metric: time. Focus: whole library.
Base: `8b8f367` (main, v3.5.0). Harness commit: `e15d01c`.

## Repo

Markdown splitter for RAG: `fromMarkdown` (micromark + gfm) → preprocess (reference
normalisation) → hierarchical tree splitter (sections, lists, tables, blockquotes, code) →
text splitter for oversized leaves (serialize, re-parse, boundary scoring, recursive split
with content sizing) → `toMarkdown` per chunk. pnpm, vitest (375 tests, ~9 s), oxlint,
tsdown. CI runs `lint:ci`, `build`, `test`, and a PR A/B benchmark comment
(`benchmarks/ab.ts`).

Existing benchmark: `benchmarks/` with 12 real fixtures (870 KB) × 8 presets; vitest bench,
`bench:report` (fastest of 9) and `bench:ab` (interleaved, total only). Lower is better.
`benchmarks/output.test.ts` pins 96 chunk-count + digest snapshots (fixture × preset);
`benchmarks/fast-paths.test.ts` pins sizer equivalence with the parser.

## Maintainers

Sole maintainer is the user (zirkelc). Principle from the previous campaign
(`PERF_PLAN.md`, "Post-run decision 2026-07-29"): **complexity per percent**. The mapping
fast path in the text splitter (~280 lines for ~9%) was removed afterwards; the sizing
fast paths (~26%) stayed, locked by an equivalence test. So: prefer small, obviously
behaviour-identical changes; any new fast path needs a large win and an equivalence test.

Prior art (do not repeat): node-size caches (E2, D4), breadcrumb text cache (D14), lazy
child splitters (E22), verbatim html emit (E5, E5R, S1: always -0.4…-0.7%), direct code
serialization (R2), length-only node measurement (D11), mapping fast paths (removed).

## Harness

`perf/` = skill node-ts runtime. Cases (`perf/cases.mts`): one per fixture at preset
`cs250-r1.0`; fixtures above 64 KB cut into parts at heading / blank-line boundaries
(21 cases, 6 to 35 ms per body). Guard: `perf/guard.mts` (count + digest per case) plus
the 96 output snapshots in the test suite. Gates: `sh perf/gates.sh [--full]`.

Canaries: 10 ms busy loop in `TableSplitter.splitNode` moved only the table-bearing
fixtures (+23…+65%), all others within noise. Output canary (collapse double spaces in
chunk text) failed the guard and 79/96 snapshots.

## Calibration (identical code, `ab.mts HEAD HEAD --iters 12`, ~80 s per run)

Machine: shared, 10 cores, load average 13 to 21 throughout. Probe threshold kept at 2%;
typical before-probe 1.3 to 1.8%. 6 runs made: run 0 cold + BUSY after (35%/12.7%), two
more BUSY after (35.4%, 7.1%) → invalid. 3 valid runs:

TOTAL deltas: +0.13%, -0.13%, -0.37%   → noise floor ~0.5%
GEOMEAN deltas: +0.25%, -0.04%, -0.26% → noise floor ~0.5%

Per-case spread of medians across the 3 valid runs (max - min): 0.9% (spec-commonmark#1)
to 11.6% (flat-photosynthesis-small); most cases 2 to 5%. Per-case decisions therefore need
focused runs with a focused control. Drift warnings appeared on a different case in every
run (machine bursts), not on a stable case.

**Keep bar: TOTAL and GEOMEAN both improve by ≥ 1.0% (2x floor), in two valid runs.**

Budget: ~80 s per run; 10 experiments × 2.5 ≈ 35 min of measurement plus quiet waits.

## Scaling scan (`scan.mts`, chunkSize 250, n / 4n / 16n words)

| shape | t(n) ms | t(4n) | t(16n) | steps | verdict |
|---|---|---|---|---|---|
| one-paragraph (16k words) | 36 | 159 | 1009 | 4.4, 6.4 | ~linear (split phase 11→25→118 ms) |
| one-paragraph-links | 22 | 241 | 1052 | 10.8, 4.4 | one bad step, noise |
| many-paragraphs | 54 | 143 | 579 | 2.6, 4.1 | linear |
| many-sections | 23 | 78 | 320 | 3.4, 4.1 | linear |
| one-list | 38 | 181 | 1318 | 4.8, 7.3 | parse-dominated, ~linear in chunkdown |
| one-table | 26 | 301 | 4101 | 11.7, 13.6 | **superlinear, in the gfm table parser** (parse 36 → 306 → 3310 ms; split 1 → 3 → 11 ms) |
| one-code-block | 35 | 196 | 945 | 5.7, 4.8 | ~linear |

The only superlinear path is upstream (`micromark-extension-gfm-table@2.1.1`, latest).
Decision item, not an experiment.

## Baseline profile (all cases, 6 s)

By area: micromark + subtokenize + other parser packages ≈ 70%, `mdast-util-to-markdown`
17% (`safe` 9.7% + `safeBound` 4.6% self), GC 3.8%, chunkdown's own code < 5%.

Call-site accounting (one pass over the 21 cases, 693 ms):

| call | calls | share | avg bytes |
|---|---|---|---|
| initial parse (`Chunkdown.split`) | 21 | 43.5% | 42,434 |
| text splitter re-parse | 704 | 18.6% | 624 |
| final chunk serialize | 3,947 | 8.7% | 207 |
| text splitter serialize | 704 | 8.4% | 624 |
| sizing fallback parse (`getContentSize`) | 321 | 5.5% | 287 |

Fixed cost per call: parse 19 µs, paragraph serialize 15 µs, html-only root serialize 0.6 µs
(this is why the earlier "verbatim html emit" never cleared its bar; not repeated).

Sizing fallbacks are almost all fragments from inside code blocks (the code splitter
delegates to the text splitter, and each half is sized as Markdown). A code-aware size
would move chunk boundaries → decision item.

## Candidates

1. **Text splitter reuses the source subtree** when the node's serialization equals its source
   slice: 56% of text-splitter nodes (51% of bytes) qualify; the re-parse equals the shifted
   subtree in all of them except bare `text` nodes. Est. ~9%.
2. Final chunk serialization of tree chunks whose serialization equals the source slice:
   still needs `toMarkdown` to know; no gain without a proof. Parked.
3. `getSectionSize` recomputation (D4, D11 near misses in campaign 1): ceiling ~1%.
4. Parse fixed cost (19 µs × ~1,000 small parses ≈ 3%): lives in micromark `parse()` and
   `compile()`; no public API to reuse the combined constructs. Parked.

## Gates

| gate | command | runs here? | notes |
|---|---|---|---|
| guard | `pnpm exec tsx perf/guard.mts` | yes | 1.5 s |
| tests | `pnpm exec vitest run` | yes | 375 tests, ~9 s, incl. 96 snapshots |
| lint | `pnpm lint:ci` | yes | |
| build, typecheck | `--full` | yes | |
| format | `--full`, changed `src/` files only | yes | base already fails repo-wide `format:ci` on 5 files (not a CI gate) |

## Experiment notes

### E1: keep, `0a45fbc` (test `c8742ce`): text splitter reuses the source subtree

`TextSplitter.splitNode` serialized every oversized node and parsed the result again, only to
get offsets relative to the serialized text. When the serialization is exactly the node's
source slice plus a final newline, that parse gives back the node's own subtree with every
offset moved by the slice start. The splitter now copies the subtree with shifted offsets
instead. Guards: block types only (`paragraph`, `heading`, `code`, `html`; a bare `text`
node re-parses as a paragraph), no reference or definition nodes in the subtree (they
resolve against the rest of the document), every node must carry offsets, and the source
is withheld while transform rules are configured (a transform can leave stale positions).
The source reaches the splitters through the options object that all splitters of one
chunkdown instance share, set only during `split()`.

Verification: differential over 12 fixtures × 8 presets × 4 rule sets, 9,792 reuses, 0
differences against the real parse; equivalence test over every node of the corpus, which
fails when the type guard is removed.

Result: TOTAL -8.57% / -8.51%, GEOMEAN -9.51% / -9.63% (one earlier run -8.37% / -9.23%
invalid, BUSY after). Every case improved, the code-heavy spec parts least. ~60 lines incl.
comments.

**Invariant to name in the PR:** positions of parsed nodes are not rewritten between the
parse and the text splitter, except by transforms (guarded).

### E2: `_` emphasis markers rewritten to `*`

Of the remaining misses, 344 (27% of miss bytes) differ from the source only because the
serializer writes `*` for `_` emphasis. Same length, same offsets; all 344 re-parse to the
original subtree. Risk: a rewritten run next to an original `*` run merges into one run
and pairs differently. Guard: every run of `*` comes entirely from `_` or entirely from `*`.
Without the guard, 4 synthetic edge cases (`_a_*b*`, `*a*_b_`, `__a__**b**`, `**_a_**`)
produce wrong trees; with it, none do. Differential: 11,168 reuses, 0 differences.

Result: TOTAL -1.78% / -2.66%, GEOMEAN -1.76% / -2.63%, both valid. Keep, `47b7628`.

### E3: map offsets across backslash escapes the serializer changed

81% of the remaining miss bytes differ only by escapes: the serializer inserts `\` before
`(`/`)` in URLs and `[` in text, and drops needless escapes like `\-`. The alignment walks
both texts, records each inserted or removed backslash, and maps every node offset by the
edits before it (an edit at the offset itself belongs to the text starting there). Extra
guard: an edit must precede ASCII punctuation, so both spellings unescape to the same
character. That guard is defensive: removing it fails no test, because the serializer
never produces such a pair. An off-by-one in the mapping fails the corpus test.
Differential: 15,016 reuses over 4 rule sets, 0 differences; reuse now covers 86% of
text-splitter nodes. Cost: +72 lines net in `text.ts` (the alignment replaces E2's
`matchesSource`).

Result: TOTAL -7.69% / -7.19%, GEOMEAN -7.26% / -6.75%, both valid. Keep, `fda4f50`.

### E4: discard (near miss), `d78e1a6`: container prefixes on continuation lines

Removing list indentation and `>` markers at line starts covered 53% of the remaining
miss bytes (281 nodes, 0 differences). But the text-splitter parse left after E3 is only
~2% of the time, so the ceiling was ~1%. Measured TOTAL -0.69%, GEOMEAN -0.47%; spec
parts -1 to -4% with every band over 0. Under the bar, +10 lines: discarded. Not re-tested
focused.

## Re-profile after E3 and candidate review

Call sites (one pass, cs250): initial parse 56%, final chunk serialization 10%, text-splitter
serialization 9%, sizing fallback parse 6% (code fragments), text-splitter parse 2%.
Allocation sampling (collected objects included): ~1 GB per pass, 83% inside the parse and
serialize calls, chunkdown's own code < 3%.

Candidates rejected by their ceiling, without spending an experiment:

- `extractSemanticBoundaries` / `scoreBoundary`: at most ~2% in total; `scoreBoundary` loops
  over ~4 ranges per call, so even 2x there stays < 0.3%.
- Parse fixed cost (19 µs per call; `combineExtensions` is 2.6% of all allocations): only
  ~380 small parses remain, < 1%; no public API to reuse the combined constructs.
- Final and text-splitter serialization (19%): the output is serializer text by definition,
  and nothing short of serializing tells what the serializer writes.
- `getSectionSize` memo, breadcrumb cache, verbatim html emit: tried in campaign 1 (D4, D14,
  E5/S1), all under their bar; html-only root serialization costs 0.6 µs.

## Decision items (behaviour changes, not attempted as keeps)

1. **Size code-block fragments as code.** The code splitter delegates to the text splitter,
   which sizes each half of a code block by parsing it as Markdown. A fragment's indentation,
   `*`, `_`, `<tags>`, `#` and so on then count as Markdown syntax, so code chunks are sized
   too small and come out larger than the limit. Prototype (4 lines: use the mapping's plain
   offsets for code nodes, which are exactly the code characters): 27 of 96 snapshot cells
   change, +119 chunks (+0.4%), code chunks above 1.3x the limit drop from 76 to 66.
   Timing, one valid A/B vs `fda4f50`: TOTAL -3.87%, GEOMEAN -4.58%; ai-sdk-tools -29.8%,
   ai-sdk-prompts -28.5%, rust-book -17.2%. Needs a snapshot update, so it is the
   maintainer's call.
2. **Quadratic gfm table parsing (upstream).** `micromark-extension-gfm-table@2.1.1` (latest):
   a 3-column table parses in 36 / 306 / 3,310 ms at 28 KB / 111 KB / 445 KB. chunkdown's own
   table splitting stays linear (1 / 3 / 11 ms). Worth an upstream issue with the scan shape.

## Final summary

Budget: 10 experiments, 4 spent (3 kept, 1 near miss). The loop stopped early because every
remaining chunkdown-owned candidate has a measured ceiling below the 1% bar (see the
candidate review), and the largest remaining lever changes output (decision item 1).

Kept (all in the text splitter, one idea extended three times):

| commit | change | TOTAL (2 runs) | GEOMEAN (2 runs) |
|---|---|---|---|
| `0a45fbc` + test `c8742ce` | E1 reuse source subtree when serialization = source slice | -8.57% / -8.51% | -9.51% / -9.63% |
| `47b7628` | E2 also when `_` emphasis markers were written as `*` | -1.78% / -2.66% | -1.76% / -2.63% |
| `fda4f50` | E3 also across inserted/removed backslash escapes (offset map) | -7.69% / -7.19% | -7.26% / -6.75% |

Rejected: E4 container prefixes (`d78e1a6`, -0.69%, under the bar for +10 lines).

Cost: `src/` +181 / -4 lines (text.ts +157, most of it doc comments), plus ~120 lines of
equivalence tests in `benchmarks/fast-paths.test.ts`. `dist/index.js` 76.7 KB unminified.
Invariant the change relies on: node positions are not rewritten between the parse and the
text splitter, except by transforms, for which the source is withheld.

Cumulative, `b82593f` (pre-loop, same `src/` as main) vs HEAD, full suite, two valid runs:
**TOTAL -18.30% / -18.56%, GEOMEAN -18.22% / -18.77%**; every case improved, from -5%
(spec-commonmark#2, band over 0) to -31% (wikipedia-berlin#2). Identical-code control in
the same session: -0.24% / -0.13%, inside the calibrated floor. This table is a full-suite
run and carries the full-suite noise; it shows the shape, not per-case claims.

External cross-check, the repo's own `pnpm bench:ab 8b8f367 HEAD` (12 fixtures × 8
presets, fastest of 7): **-14.6% total** at `fda4f50`; every fixture -8.1% (spec-gfm) to
-24.6% (flat-photosynthesis). Smaller than the harness figure because the larger presets
send less through the text splitter.

Allocations: parse and serialize calls are 83% of ~1 GB allocated per pass; E1 to E3 remove
~90% of the text splitter's re-parses, which were the largest allocation site chunkdown
controls. Not measured as a separate metric.

Left worth trying: decision item 1 (code sizing, -3.9% more and fewer oversized code
chunks, needs a snapshot update); upstream table parser issue.
