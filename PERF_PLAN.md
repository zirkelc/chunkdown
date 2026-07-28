# chunkdown performance plan

Branch: `zirkelc/perf-fable-5`. Baseline commit: `30daad0`.

## Baseline

`pnpm bench:report --save benchmarks/results/baseline.json` (fastest of 9, ms):

| fixture | total |
| --- | --- |
| ai-sdk-overview | 15.1 |
| ai-sdk-prompts | 80.1 |
| ai-sdk-tools | 316.0 |
| flat-photosynthesis-small | 153.7 |
| flat-photosynthesis | 665.8 |
| rust-book-ownership | 166.1 |
| spec-commonmark | 1004.1 |
| spec-gfm | 1067.2 |
| wikipedia-berlin | 953.4 |
| wikipedia-markdown | 77.4 |
| wikipedia-python | 375.5 |
| wikipedia-transformer | 392.3 |
| **TOTAL** | **5266.5** |

All 359 tests pass, incl. 96 output snapshots.

## Profile (baseline)

`node --cpu-prof` over all fixtures × presets × 3 rounds (18.7s total, `split()` inclusive 17.0s):

- markdown.ts `fromMarkdown`/`toMarkdown` inclusive: **78.7%**. Micromark tokenizer + compile dominates self time.
- `TextSplitter.splitNode` inclusive 47%; inside it `splitRecursive` 31%, and `size.ts` (i.e. `getContentSize(string)` → full `fromMarkdown` parse) 30%. Each binary split re-parses both halves once.
- Per-parse fixed overhead is real: `combine-extensions` 580ms self (rebuilding `gfm()` per call), `TextDecoder` construction 302ms, gfm-autolink-literal find-and-replace transform + its regexes ~900ms self.
- `toMarkdown`: `safe`/`safeBound` ~1.1s self.
- GC ~1s (5.4%).

## Rules recap

- Judge only via `pnpm bench:ab HEAD~1`, twice; keep only if both runs ≥ +0.75% (B faster ⇒ negative delta; "clears bar" = improvement ≥ 0.75%).
- 96 snapshots must not move. Commit before benchmarking. Discards via `git reset --hard HEAD~1`, hash recorded in TSV.

## Candidates

1. **E1 Hoist extension construction in markdown.ts.** `gfm()`, `gfmFromMarkdown()`, `gfmToMarkdown({tablePipeAlign: false})` and the options objects are rebuilt on every parse/serialize call; hoist to module constants. Extensions are stateless config (unified reuses processors the same way). Low risk, behaviour-identical, also *removes* per-call work. Est 3-8%.
2. **E2 Cache `getContentSize(node)` in a WeakMap.** Leaf nodes are re-measured at every tree level (`getSectionSize` recursion, `mergeSiblingSections`, `splitSection`). Node text content is never mutated after preprocessing (only `data` and reassembly into new parents). Adds one invariant; contained in size.ts. Est 1-3%.
3. **E3 `splitRecursive`: linear first-max scan instead of map+sort.** Selection today = first element (stable sort) with max combinedScore; a linear scan taking strictly-greater max reproduces it exactly, drops an O(B log B) sort + array alloc per recursion. Behaviour-identical. Est 0.5-2%.
4. **E4 Size-only parse without the autolink-literal transform.** `getContentSize(string)` only needs `toString(ast)`; the gfm autolink find-and-replace transform rewrites text nodes into link nodes with identical text (toString-neutral) and burns ~5% of total in regexes. Use a `fromMarkdown` variant for sizing with that mdast transform stripped. Medium risk (must be exactly toString-neutral; snapshots verify). Est 1-3%.
5. **E5 Bypass `toMarkdown` for text-splitter passthrough chunks.** Text splitter yields `root { children: [html] }`; toMarkdown emits html value verbatim. Short-circuit in `chunkdown.split` to `value.trim()`. Est 0.5-2%.
6. **E6 `scoreBoundary`: binary search over merged sorted ranges** instead of full scan per boundary. Est <1%, only matters on range-heavy nodes.
7. **E7 Blockquote splitter: measure `block` directly** instead of allocating a wrapper blockquote per block (toString-identical). Simplification; perf-neutral acceptable.
8. **E8 Avoid re-allocating adjusted ranges/boundaries per recursion** (pass offsets instead). More invasive; only if stuck.
9. **E9 (risky, behaviour-sensitive) Use mapping-derived plain sizes in `splitRecursive`** instead of re-parsing halves. Would remove the single largest cost, but plain length ≠ toString length at cut points (gap whitespace, exposed markers). Expect snapshot movement; only try if a provably-exact variant emerges.

## Experiment log

(chronological; details per experiment appended as they run)

### E1 — keep — `418d751` — hoist extension construction (-5.3% / -4.8%)

`gfm()`, `gfmFromMarkdown()`, `gfmToMarkdown()` and both options objects moved to
module constants in markdown.ts. Every fixture improved (-4.2% to -8.3%); the
smaller/parse-heavy fixtures gained most, as expected since per-parse fixed
overhead dominates small parses. Tests green.

### E2 — discard — `a517259` — WeakMap cache for `getContentSize(node)` (+0.1%)

No win: `toString` on nodes is cheap (the expensive path is the string→parse
path), and WeakMap get/set overhead cancels what little it saves. Discarded.

### E3 — keep — `4e37f70` — linear first-max scan in `splitRecursive` (-0.8% / -0.6%)

Replaces `.map().sort()[0]` with a single pass keeping the first
strictly-highest combined score (identical selection; V8 sort is stable).
Second run (-0.6%) missed the 0.75% bar, but the bar gates complexity-adding
changes; this one removes a sort and per-boundary object allocations and both
runs were improvements, so kept under the simplicity clause.

### E4 — keep — `acd2997` — sizing parse skips autolink-literal transform (-3.4% / -3.2%)

`getContentSize(string)` now parses via a variant of the from-markdown options
with `transforms: []`. Verified in mdast-util-gfm-autolink-literal source that
the transform's replacements always carry text children equal to the matched
text (toString-neutral), and that no other gfm sub-extension defines
transforms. Flat/prose fixtures gained most (-4 to -6%).

### E5 — discard — `76b794a` — verbatim emit for single-html-node chunks (-0.8% / -0.4%)

Second run under the bar and the change adds a special-case branch, so the bar
applies. Discarded.

### Re-profile after E1+E4

Sizing parses in `splitRecursive` remain the largest reducible bucket (4.4s of
17.0s = 26%). New top candidate E10: exact fast-path sizer for plain prose
strings (no markdown construct characters) computing toString-equivalent
length line-by-line (strip line-leading/trailing spaces, +1 per soft break,
+0 per hard break, nothing between paragraphs), gated by a conservative
bail-out scan; validated empirically against the parser over fixture
substrings before committing.

### E10 — keep — `efe6572` — fast-path sizer for plain prose (-6.7% / -6.6%)

Exact line-by-line sizing with conservative bails (construct characters,
dash/ordered-marker line starts, 4+ space paragraph openings). 0 mismatches on
26k corpus samples + synthetic edges. Complexity weighed against a 6.6% win:
kept.

### E11 — discard — `4d7e128` — identity mapping for single-line prose in text splitter (-0.1%)

Gate (no construct chars, no autolink candidates, single line) verified sound
(5858 fixture blocks, 0 failures) but almost never fires for *oversized* nodes:
long paragraphs nearly always contain a link or formatting. No win, added
invariant — discarded.

### E13 — keep — `54d077f` — link-aware fast sizing (-9.4% / -9.2%)

Most sizing strings bail from the E10 fast path only because of inline links
(wiki URLs contain `_&#=`). Strip well-formed `[label](dest "title")` /
`![alt](dest)` via regex (label contributes, syntax+dest+title contribute 0),
two-stage bail-out (structural chars on original, formatting chars after
stripping), line-blank and trim bookkeeping against the original lines. Bail on
any leftover bracket, empty-after-strip lines, paren titles, reference-style
candidates.

Result: biggest win of the run. Link-bearing prose (all wikipedia-derived
fixtures, including the flat ones) now sizes without parsing:
flat-photosynthesis -25%, wikipedia-berlin -20%. 0 mismatches on 26k corpus
samples incl. 33 link-focused synthetic edges. Spec fixtures unchanged
(code-block dominated).

### E14 — keep — `971ad6f` — fast mapping+ranges for simple lines (-3.4% / -3.2%)

Revives the E11 idea with link support: for single-line prose plus well-formed
inline links, construct the position mapping (identity text segments, label
segments with node spans) and penalized ranges (per-link, penalty derived from
the split rules) directly, skipping `fromMarkdown` + `buildPositionMapping` in
`TextSplitter.splitNode`. Verified by deep-comparing fast vs parse path on 88k
(block × rule-set) combinations — 34.6k fast-path hits, 0 differences. Prose
fixtures -8 to -11%; spec fixtures neutral.

### E15 — keep — `2ad8d41` — fast mapping for code nodes in text splitter (-0.9% / -1.0%)

A code node's serialization is one code block: ranges empty (code carries no
markdown penalty; protected code bails to the parse path), one segment over
the value starting after the fence line, guarded by a verbatim `startsWith`
check. 4.5k fixture code-node comparisons across rule sets, 0 differences.
Code-heavy docs gained (ai-sdk-prompts -10%).

### E16 (next) — fast sizing for unclosed-fence code strings

`splitRecursive` sizes first-halves of code blocks: "```info\ncontent…" with
no closing fence. If the info string and content contain no backtick, the
parse yields one code node; toString length = content minus one trailing
newline. Bail on anything else (backticks cover early-closing fences).

Result: kept, `a55c10d`, -0.8% / -0.8% (ai-sdk-prompts -9.6%).

### E17 — keep — `1fd39c7` — multi-line fast line analysis (-1.3% / -0.9%)

Spec fixtures hard-wrap their paragraphs, so the single-line gate of E14 never
fired there. Extended to whole paragraphs: bail on blank lines, spaces
adjacent to newlines (stripped whitespace / hard breaks / charMaps), and
per-line dash / ordered-marker starts (setext underline, list interruption).
Contiguous text across soft breaks is one text node, hence one identity
segment — confirmed by the deep-compare harness (38.6k fast-path hits over
88k combinations, 0 differences).

### E22 — discard — `54fb87f` — lazy reuse of child TreeSplitter instances (+0.2%)

Per-item construction of a TreeSplitter (with its five sub-splitters) is not
measurable. Discarded.

### E18 — keep — `eb5fbb3` — inline-code-aware fast sizing (-3.2% / -3.1%)

Isolated single-backtick spans are replaced by length-preserving `x`
placeholders (value length after the space-stripping rule) before the link
pass, hiding characters that legitimately do not format inside code (`&*<_`)
and preventing false constructs across span boundaries. Specs finally moved
(-4.2%), ai-sdk -6 to -10%, rust-book -10%.

### E19 — keep — `a5dd2ba` — inline code in fast line analysis (-2.0% / -1.9%)

Left-to-right scanner mirroring parser precedence (whichever of the next code
span or link starts first wins; probed and confirmed against the parser).
Code spans produce a value segment (offset replicated via the same `indexOf`
the mapper uses) and an `inlineCode` penalty range. 132k comparisons, 0
differences.

### E20 — discard — `597639b` — balanced parens in fast link dests (-0.1%)

Correct (verified) but no measurable effect; paren-dest links are rarer in
the corpus than expected. Discarded as a complexity-add with no win.

### E21 — keep — `fa927bc` — asterisk emphasis in fast sizing (-2.8% / -3.0%)

Strict scanner: runs of 1–2 asterisks alternating pure-opener / pure-closer
with equal lengths; pure roles avoid delimiter-stack ambiguity, and 1+1 / 2+2
pairs can never trip the rule of three. wikipedia-transformer -7.5%, berlin
-5.6%, flat fixtures -4 to -7%.

### E23 — keep — `6a289df` — asterisk emphasis in fast line analysis (-1.8% / -1.9%)

Same gate in the mapping scanner (where flanking context is the original
line, so it is exact), plain inner content only; emits a wrapped segment and
a strong/emphasis penalty range with the formatting-rule fallback. 176k
comparisons, 0 differences. transformer -6.4%.

### E24 — keep — `154d913` — backslash escapes in fast sizing (-3.5% / -3.2%)

Combined escape+code-span left-to-right pass (each can neutralize the other).
Escaped punctuation → one placeholder char; literal backslashes kept; hard
breaks bail. Flat fixtures -8/-9%, wikipedia -6/-7%.

### E25 — discard — `680865c` — escapes in fast line analysis (+1.2% / +0.1%)

First version regressed by running a per-character regex on every text run;
after fixing with a no-backslash fast path it was still neutral. Adds charMap
replication, escape-parity edge cases, dest-escape bails — too much invariant
surface for zero measured win. Discarded.

### E26 — discard — `74d759f` — nested + underscore emphasis in fast sizer (+0.2%)

Stack-based nesting plus pure-role underscore pairs (intraword-literal
underscore support was dropped during design: processed-string neighbors
differ from original neighbors at construct edges, which would mis-classify
flanking). No measurable win. Discarded.

### E5R — discard — `c8e028a` — verbatim html chunk emit, retest (-0.6%)

Still under the bar even on the faster base. Discarded.

## Diversification round (after 3 consecutive non-kept)

Fresh profile: split() 10.8s of 12.0s; initial parse ≈ 46%, final
serialization (safe/safeBound) ≈ 1.0s self, tree+text splitters 3.0s
(roundtrips for still-bailing nodes ~1.5s, sizing parses ~1.0s), GC 0.8s,
preprocess 0.25s. New candidates, each in a different part of the pipeline
than the last three attempts:

1. **D4 — tree splitter**: WeakMap memo for `getSectionSize(section)`.
   Sections keep identity across the repeated measurements in `splitTree`,
   the merge loop and `mergeSiblingSections`; caching removes O(depth)
   re-traversals of the same subtrees. (E2 cached only leaf nodes, where
   toString is cheap; this caches the recursive walk.)
2. **D2' — splitRecursive**: stop cloning boundary/range arrays per
   recursion level (thread md/plain offsets instead of rewriting objects);
   targets GC and per-level O(B) work.
3. **D1 — preprocessing**: hand-rolled definition/reference walk instead of
   two `unist-util-visit` passes (~123ms incl).
4. **D11 — size.ts node path**: length-only text measurement (sum value/alt
   lengths recursively) instead of building the full `toString` string and
   taking `.length`.
5. **D14 — output loop**: cache breadcrumb `toString(heading)` per split call
   (headings repeat across many chunks).

Round 1 results: D4 discard (-0.4%), **D2' keep** (-0.2%/-0.4%, removes dead
`ranges` threading + two adjust helpers; simplicity clause), **D1 keep**
(-1.1%/-1.5%), D11 discard (-0.4%), D14 discard (+0.4%), D65 (relaxed fence
sizer) discard (+0.3%). Streak of 3 non-kept (D11, D14, D65) → round 2.

## Diversification round 2

Attribution profile (sample stacks classified parse/serialize × nearest src
caller): initial document parse 53%, final chunk serialization 11.5%, text
splitter node serialization 6.6%, text splitter re-parses 7.2%, sizing parses
6.3%, GC/other 8%. Candidates:

1. **R2 — text splitter**: serialize code nodes directly (fence char/length
   from longest backtick run, info string checks) instead of `toMarkdown`,
   verified corpus-wide against the real serializer.
2. **R3 — output loop**: reuse the same fast code serialization for
   single-code-node chunks in `chunkdown.split`.
3. **R16 — blockquote splitter**: measure block content directly instead of
   allocating a wrapper blockquote per block (toString-identical;
   simplification).
4. **R14 — sizer**: `~~strikethrough~~` support in the fast sizer.
5. **R5 — sizer**: allocation-free single-pass counting in `sizePlainProse`
   (currently builds processed strings only to take lengths).

Round 2 results: R2 discard (-0.3%), **R16 keep** (neutral, removes wrapper
alloc; simplicity clause), R17 intraword underscores discard (+0.6%), **R18
keep** (-2.2%/-3.1%, literal brackets in sizer; spec-gfm -6.6%), R20 literal
brackets in mapping discard (-0.3%), R14 tilde sizer discard (-0.2%).
Streak of 3 (R17, R20, R14) → round 3.

## Diversification round 3

Profile: initial parse 53%, final serialization 12.5%, text-splitter
parse/serialize 6.9%/6.0%, sizing parses 4.6%, GC 7.3%. Candidates:

1. **S1 — output loop**: combined fast emit — verbatim value for html-only
   roots plus direct serialization for single-code-node chunks (E5R and R2
   each just missed the bar alone; same loop, one experiment).
2. **S2 — sizer internals**: allocation-free single-pass counting.
3. **S3 — boundary machinery**: avoid one object per regex match.
4. **S4 — mapping**: heading fast path (`#{1,6} ` prefix).
5. **S5 — mapping**: strikethrough support.

Round 3 results: S1 discard (-0.7%, just under the bar), **S3' keep**
(drop write-only `Boundary.type`; neutral, dead-code removal), **S6 keep**
(drop write-only `PenalizedRange.type` and its merge-label concatenation;
neutral, dead-code removal), S5 discard (+0.1%). S2 was assessed and not
attempted: an allocation-free rewrite of the verified sizing pipeline risks
its exactness for an estimated ≤1%. S4 targets 6 blocks / 3KB across the
whole corpus — no measurable ceiling.

## Final result

`pnpm bench:report --compare baseline` after the last kept commit:
**3415.5ms vs 5266.5ms baseline = -35.1%**, every fixture improved
(spec-gfm -21.9% … flat-photosynthesis-small -52.6%). All 359 tests and all
96 output snapshots unchanged throughout; every kept change was verified
behaviour-identical (deep-compare harnesses over the corpus: sizing 31k+
samples, mapping 177k block×rule combinations, plus targeted synthetic edge
cases per feature).

### Kept (20 commits, chronological)

1. `418d751` E1 — build gfm parser/serializer extensions once (-5%)
2. `4e37f70` E3 — linear first-max boundary selection (simplification)
3. `acd2997` E4 — sizing parse skips autolink-literal transform (-3.3%)
4. `efe6572` E10 — fast sizer for plain prose (-6.6%)
5. `54d077f` E13 — fast sizer handles inline links (-9.3%)
6. `971ad6f` E14 — fast mapping+ranges for simple lines (-3.3%)
7. `2ad8d41` E15 — fast mapping for code nodes (-1.0%)
8. `a55c10d` E16 — fast sizer for unclosed code fences (-0.8%)
9. `1fd39c7` E17 — multi-line fast line analysis (-1.1%)
10. `eb5fbb3` E18 — inline code in fast sizer (-3.1%)
11. `a5dd2ba` E19 — inline code in fast line analysis (-2.0%)
12. `fa927bc` E21 — asterisk emphasis in fast sizer (-2.9%)
13. `6a289df` E23 — asterisk emphasis in fast line analysis (-1.9%)
14. `154d913` E24 — backslash escapes in fast sizer (-3.3%)
15. `ad884f4` D2' — window-based split recursion, dead ranges threading removed (neutral, -100 lines)
16. `02cc62f` D1 — flow-only walk for definition collection (-1.3%)
17. `4be4596` R16 — direct blockquote block measurement (neutral, simplification)
18. `aae7799` R18 — literal brackets in fast sizer (-2.7%)
19. `5d964e9` S3' — drop dead Boundary.type (neutral, dead code)
20. `9041ce9` S6 — drop dead PenalizedRange.type (neutral, dead code)

### Rejected (see experiments.tsv for hashes)

Node-level size caches (E2, D4), identity-mapping without link support (E11),
verbatim single-html emit (E5, E5R, S1 — persistently -0.4…-0.7%, always just
under the bar), balanced-paren dests (E20), escapes in the mapping analyzer
(E25 — neutral even after fixing a per-char regex regression), nested +
underscore emphasis in the sizer (E26), lazy child-splitter reuse (E22),
length-only node measurement (D11), breadcrumb text cache (D14), relaxed
fence sizer (D65), direct code serialization in the text splitter (R2),
intraword-underscore placeholders (R17), literal brackets in the mapping
analyzer (R20), tilde strikethrough in sizer and mapping (R14, S5).

### Where the remaining time goes

Attribution profiling after the final commit: ~53% initial full-document
parse, ~12.5% final per-chunk serialization, ~13% parse/serialize of nodes
too complex for the fast paths, ~7% GC, ~3% chunkdown's own logic. The first
two are fidelity-locked: the parse needs full gfm with positions, and chunk
text is normalized serializer output by definition.

### Left worth trying / needs a decision

- **Autolink-literal transform in the main parse** (~3% potential): the
  mdast transform re-scans every text node with expensive regexes although
  the micromark syntax extension already catches most autolinks. Dropping it
  changes parse fidelity for edge-case autolinks, likely without moving any
  snapshot — a behaviour decision, not a perf experiment.
- S1-style fast chunk emit repeatedly measured -0.4…-0.7%; if the bar were
  0.5% it would be in.
- An allocation-free single-pass sizer (S2) might recover ~1% at the cost of
  rewriting the most delicate verified logic.
- The E9 idea (mapping-derived sizes instead of re-parsing halves in
  `splitRecursive`) remains the only large lever, and it is genuinely
  behaviour-changing.
