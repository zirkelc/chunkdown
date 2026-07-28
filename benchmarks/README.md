# Benchmarks

| command                                                | purpose                                             |
| ------------------------------------------------------ | --------------------------------------------------- |
| `pnpm bench`                                           | vitest benchmark suite                              |
| `pnpm bench:report [--save <file>] [--compare <file>]` | absolute timings, fastest of 9 runs                 |
| `pnpm bench:ab <revA> [revB]`                          | interleaved A/B between two git revisions of `src/` |
| `pnpm vitest run benchmarks/output.test.ts`            | output-stability snapshots                          |

Every fixture runs under 8 presets: `chunkSize` 100 / 250 / 500 / 1000 crossed with
`maxOverflowRatio` 1.0 / 1.5.

## Judging a change

Use `bench:ab`, not two `bench:report` runs. Absolute timings drift several
percent with machine state, which is larger than most individual changes.
`bench:ab` exports both revisions of `src/` into one process and alternates them
for every timed iteration of every fixture/preset cell, swapping which one runs
first each time, so both see the same conditions. On identical code it reads
about -0.3%; treat anything under ~0.5% as noise.

`benchmarks/output.test.ts` reduces every fixture/preset combination to a chunk
count plus a digest of the chunk texts and breadcrumbs. A performance change must
leave all 96 snapshots untouched — if they move, it changed behaviour.

## Dataset

`fixtures/` holds 12 real-world markdown documents (~870 KB) chosen to vary in
length and structure. Each file records where it came from in its frontmatter.

| fixture                     | KB    | headings    | other                          |
| --------------------------- | ----- | ----------- | ------------------------------ |
| `ai-sdk-overview`           | 2.2   | 3, depth 2  | —                              |
| `wikipedia-markdown`        | 13.4  | 9, depth 3  | 6 table rows                   |
| `ai-sdk-prompts`            | 17.1  | 26, depth 5 | 21 code blocks                 |
| `flat-photosynthesis-small` | 19.7  | **none**    | flat prose                     |
| `rust-book-ownership`       | 26.1  | 12, depth 3 | 15 code blocks                 |
| `ai-sdk-tools`              | 52.5  | 49, depth 4 | 39 code blocks, 9 table rows   |
| `wikipedia-python`          | 59.0  | 24, depth 3 | 18 table rows, list-heavy      |
| `wikipedia-transformer`     | 61.6  | 44, depth 4 | formula-heavy prose            |
| `flat-photosynthesis`       | 81.0  | **none**    | flat prose                     |
| `wikipedia-berlin`          | 126.0 | 50, depth 3 | 99 table rows                  |
| `spec-commonmark`           | 201.3 | 74, depth 6 | 713 code blocks                |
| `spec-gfm`                  | 211.7 | 80, depth 6 | 730 code blocks, 25 table rows |

Sources: the CommonMark and GFM specifications, four Wikipedia articles, three
AI SDK documentation pages, and one chapter of the Rust Book. The two `flat-*`
fixtures are derived from the Wikipedia "Photosynthesis" article by removing
every heading, which produces a document with no structure for the tree splitter
to use and forces everything through the text splitter.

Wikipedia articles were converted from the Wikimedia REST HTML API and stripped
of page furniture: infoboxes, navboxes, hatnotes, sidebars, image figures,
citation markers, and the See also / References / External links sections. Wiki
links were rewritten to absolute URLs. The Rust Book chapter was converted from
the published HTML, because the repository sources use mdbook include directives
in place of the actual code.

> `fixtures/**` is excluded from oxfmt and oxlint in `.oxfmtrc.json` and
> `.oxlintrc.json`. The formatter rewrites fenced code blocks inside markdown
> files, which silently changes the dataset and moves every chunk count. Keep
> those ignore patterns.
