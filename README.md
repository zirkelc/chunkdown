<div align='center'>

# chunkdown 🧩
> Create chunks worth embedding

<a href="https://www.npmjs.com/package/chunkdown" alt="chunkdown"><img src="https://img.shields.io/npm/dt/chunkdown?label=chunkdown"></a> <a href="https://github.com/zirkelc/chunkdown/actions/workflows/ci.yml" alt="CI"><img src="https://img.shields.io/github/actions/workflow/status/zirkelc/chunkdown/ci.yml?branch=main"></a>


</div>

Chunkdown is a tree-based markdown text splitter that understands document structure to create semantically meaningful chunks for RAG applications. 
Unlike traditional splitters that use simple character or regex-based methods, this library analyzes markdown's hierarchical structure for optimal chunking.
Chunkdown is built around a few core ideas ~~beliefs~~ that guide its design:

#### Markdown as Hierarchical Tree

A properly structured markdown document forms a hierarchical tree where headings define sections containing various nodes (paragraphs, lists, tables, etc.). We parse markdown into an Abstract Syntax Tree (AST) and transform it into a hierarchical structure where sections contain their related content. This enables intelligent chunking that keeps semantically related information together.

<img width="1266" height="542" alt="image" src="https://github.com/user-attachments/assets/0a49589c-fae2-4955-b042-5bee770f0344" />

[Hierarchical Markdown Abstract Syntax Tree](https://chunkdown.zirkelc.dev/?text=IyBBSSBTREsgQ29yZQoKTGFyZ2UgTGFuZ3VhZ2UgTW9kZWxzIChMTE1zKSBhcmUgYWR2YW5jZWQgcHJvZ3JhbXMgdGhhdCBjYW4gdW5kZXJzdGFuZCwgY3JlYXRlLCBhbmQgZW5nYWdlIHdpdGggaHVtYW4gbGFuZ3VhZ2Ugb24gYSBsYXJnZSBzY2FsZS4KVGhleSBhcmUgdHJhaW5lZCBvbiB2YXN0IGFtb3VudHMgb2Ygd3JpdHRlbiBtYXRlcmlhbCB0byByZWNvZ25pemUgcGF0dGVybnMgaW4gbGFuZ3VhZ2UgYW5kIHByZWRpY3Qgd2hhdCBtaWdodCBjb21lIG5leHQgaW4gYSBnaXZlbiBwaWVjZSBvZiB0ZXh0LgoKQUkgU0RLIENvcmUgKipzaW1wbGlmaWVzIHdvcmtpbmcgd2l0aCBMTE1zIGJ5IG9mZmVyaW5nIGEgc3RhbmRhcmRpemVkIHdheSBvZiBpbnRlZ3JhdGluZyB0aGVtIGludG8geW91ciBhcHAqKiAtIHNvIHlvdSBjYW4gZm9jdXMgb24gYnVpbGRpbmcgZ3JlYXQgQUkgYXBwbGljYXRpb25zIGZvciB5b3VyIHVzZXJzLCBub3Qgd2FzdGUgdGltZSBvbiBhaVNkayBkZXRhaWxzLgoKRm9yIGV4YW1wbGUsIGhlcmXigJlzIGhvdyB5b3UgY2FuIGdlbmVyYXRlIHRleHQgd2l0aCB2YXJpb3VzIG1vZGVscyB1c2luZyB0aGUgQUkgU0RLOgoKPFByZXZpZXdTd2l0Y2hQcm92aWRlcnMgLz4KCiMjIEFJIFNESyBDb3JlIEZ1bmN0aW9ucwoKQUkgU0RLIENvcmUgaGFzIHZhcmlvdXMgZnVuY3Rpb25zIGRlc2lnbmVkIGZvciBbdGV4dCBnZW5lcmF0aW9uXSguL2dlbmVyYXRpbmctdGV4dCksIFtzdHJ1Y3R1cmVkIGRhdGEgZ2VuZXJhdGlvbl0oLi9nZW5lcmF0aW5nLXN0cnVjdHVyZWQtZGF0YSksIGFuZCBbdG9vbCB1c2FnZV0oLi90b29scy1hbmQtdG9vbC1jYWxsaW5nKS4KVGhlc2UgZnVuY3Rpb25zIHRha2UgYSBzdGFuZGFyZGl6ZWQgYXBwcm9hY2ggdG8gc2V0dGluZyB1cCBbcHJvbXB0c10oLi9wcm9tcHRzKSBhbmQgW3NldHRpbmdzXSguL3NldHRpbmdzKSwgbWFraW5nIGl0IGVhc2llciB0byB3b3JrIHdpdGggZGlmZmVyZW50IG1vZGVscy4KCi0gW2BnZW5lcmF0ZVRleHRgXSgvZG9jcy9haS1zZGstY29yZS9nZW5lcmF0aW5nLXRleHQpOiBHZW5lcmF0ZXMgdGV4dCBhbmQgW3Rvb2wgY2FsbHNdKC4vdG9vbHMtYW5kLXRvb2wtY2FsbGluZykuCiAgVGhpcyBmdW5jdGlvbiBpcyBpZGVhbCBmb3Igbm9uLWludGVyYWN0aXZlIHVzZSBjYXNlcyBzdWNoIGFzIGF1dG9tYXRpb24gdGFza3Mgd2hlcmUgeW91IG5lZWQgdG8gd3JpdGUgdGV4dCAoZS5nLiBkcmFmdGluZyBlbWFpbCBvciBzdW1tYXJpemluZyB3ZWIgcGFnZXMpIGFuZCBmb3IgYWdlbnRzIHRoYXQgdXNlIHRvb2xzLgotIFtgc3RyZWFtVGV4dGBdKC9kb2NzL2FpLXNkay1jb3JlL2dlbmVyYXRpbmctdGV4dCk6IFN0cmVhbSB0ZXh0IGFuZCB0b29sIGNhbGxzLgogIFlvdSBjYW4gdXNlIHRoZSBgc3RyZWFtVGV4dGAgZnVuY3Rpb24gZm9yIGludGVyYWN0aXZlIHVzZSBjYXNlcyBzdWNoIGFzIFtjaGF0IGJvdHNdKC9kb2NzL2FpLXNkay11aS9jaGF0Ym90KSBhbmQgW2NvbnRlbnQgc3RyZWFtaW5nXSgvZG9jcy9haS1zZGstdWkvY29tcGxldGlvbikuCi0gW2BnZW5lcmF0ZU9iamVjdGBdKC9kb2NzL2FpLXNkay1jb3JlL2dlbmVyYXRpbmctc3RydWN0dXJlZC1kYXRhKTogR2VuZXJhdGVzIGEgdHlwZWQsIHN0cnVjdHVyZWQgb2JqZWN0IHRoYXQgbWF0Y2hlcyBhIFtab2RdKGh0dHBzOi8vem9kLmRldi8pIHNjaGVtYS4KICBZb3UgY2FuIHVzZSB0aGlzIGZ1bmN0aW9uIHRvIGZvcmNlIHRoZSBsYW5ndWFnZSBtb2RlbCB0byByZXR1cm4gc3RydWN0dXJlZCBkYXRhLCBlLmcuIGZvciBpbmZvcm1hdGlvbiBleHRyYWN0aW9uLCBzeW50aGV0aWMgZGF0YSBnZW5lcmF0aW9uLCBvciBjbGFzc2lmaWNhdGlvbiB0YXNrcy4KLSBbYHN0cmVhbU9iamVjdGBdKC9kb2NzL2FpLXNkay1jb3JlL2dlbmVyYXRpbmctc3RydWN0dXJlZC1kYXRhKTogU3RyZWFtIGEgc3RydWN0dXJlZCBvYmplY3QgdGhhdCBtYXRjaGVzIGEgWm9kIHNjaGVtYS4KICBZb3UgY2FuIHVzZSB0aGlzIGZ1bmN0aW9uIHRvIFtzdHJlYW0gZ2VuZXJhdGVkIFVJc10oL2RvY3MvYWktc2RrLXVpL29iamVjdC1nZW5lcmF0aW9uKS4KCiMjIEFQSSBSZWZlcmVuY2UKClBsZWFzZSBjaGVjayBvdXQgdGhlIFtBSSBTREsgQ29yZSBBUEkgUmVmZXJlbmNlXSgvZG9jcy9yZWZlcmVuY2UvYWktc2RrLWNvcmUpIGZvciBtb3JlIGRldGFpbHMgb24gZWFjaCBmdW5jdGlvbi4%3D&tab=aiSdk)

#### Content Length vs. Markdown Length

Markdown uses additional characters for formatting (`**bold**`, `*italic*`, `[link](https://example.com)`, etc.) that increase the total character count without necessarily changing the semantic meaning. When calculating chunk size, we count actual text content rather than raw markdown characters. This ensures consistent semantic density across chunks regardless of formatting.

For example, the following text from [Wikipedia](https://en.wikipedia.org/wiki/Llama) has 804 raw characters, however, what the user actually sees are only 202 characters:

<pre>
The **llama** ([/ˈlɑːmə/](https://en.wikipedia.org/wiki/Help:IPA/English "Help:IPA/English"); Spanish pronunciation: [\[ˈʎama\]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish") or [\[ˈʝama\]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish")) (***Lama glama***) is a domesticated [South American](https://en.wikipedia.org/wiki/South_America "South America") [camelid](https://en.wikipedia.org/wiki/Camelid "Camelid"), widely used as a [meat](https://en.wikipedia.org/wiki/List_of_meat_animals "List of meat animals") and [pack animal](https://en.wikipedia.org/wiki/Pack_animal "Pack animal") by [Andean cultures](https://en.wikipedia.org/wiki/Inca_empire "Inca empire") since the [pre-Columbian era](https://en.wikipedia.org/wiki/Pre-Columbian_era "Pre-Columbian era").
</pre>

<img width="1260" height="392" alt="image" src="https://github.com/user-attachments/assets/cfe6754c-39bb-4954-8f9b-aadda35ef2d3" />

[Comparison of chunk size 200: Chunkdown (left) / LangChain Markdown Splitter (right)](https://chunkdown.zirkelc.dev/?text=VGhlICoqbGxhbWEqKiAoWy%2FLiGzJkcuQbcmZL10oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSGVscDpJUEEvRW5nbGlzaCAiSGVscDpJUEEvRW5nbGlzaCIpOyBTcGFuaXNoIHByb251bmNpYXRpb246IFtcW8uIyo5hbWFcXV0oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSGVscDpJUEEvU3BhbmlzaCAiSGVscDpJUEEvU3BhbmlzaCIpIG9yIFtcW8uIyp1hbWFcXV0oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSGVscDpJUEEvU3BhbmlzaCAiSGVscDpJUEEvU3BhbmlzaCIpKSAoKioqTGFtYSBnbGFtYSoqKikgaXMgYSBkb21lc3RpY2F0ZWQgW1NvdXRoIEFtZXJpY2FuXShodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9Tb3V0aF9BbWVyaWNhICJTb3V0aCBBbWVyaWNhIikgW2NhbWVsaWRdKGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0NhbWVsaWQgIkNhbWVsaWQiKSwgd2lkZWx5IHVzZWQgYXMgYSBbbWVhdF0oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvTGlzdF9vZl9tZWF0X2FuaW1hbHMgIkxpc3Qgb2YgbWVhdCBhbmltYWxzIikgYW5kIFtwYWNrIGFuaW1hbF0oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvUGFja19hbmltYWwgIlBhY2sgYW5pbWFsIikgYnkgW0FuZGVhbiBjdWx0dXJlc10oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSW5jYV9lbXBpcmUgIkluY2EgZW1waXJlIikgc2luY2UgdGhlIFtwcmUtQ29sdW1iaWFuIGVyYV0oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvUHJlLUNvbHVtYmlhbl9lcmEgIlByZS1Db2x1bWJpYW4gZXJhIiku&tab=lama&maxOverflow=1)

#### Words as Atomic Unit

Words are the smallest meaningful unit of information for embedding purposes. While tokenizers may split words further, for practical RAG applications, breaking words mid-way creates meaningless chunks. Therefore, words are treated as indivisible atoms that cannot be split.

<img width="1263" height="282" alt="image" src="https://github.com/user-attachments/assets/65d00092-7bf4-4a15-94a9-7c80078e59eb" />

[Comparison of chunk size 1: Chunkdown (left) / LangChain Markdown Splitter (right)](https://chunkdown.zirkelc.dev/?text=TGFyZ2UgTGFuZ3VhZ2UgTW9kZWxzIChMTE1zKSBhcmUgYWR2YW5jZWQgcHJvZ3JhbXMgdGhhdCBjYW4gdW5kZXJzdGFuZCwgY3JlYXRlLCBhbmQgZW5nYWdlIHdpdGggaHVtYW4gbGFuZ3VhZ2Ugb24gYSBsYXJnZSBzY2FsZS4KVGhleSBhcmUgdHJhaW5lZCBvbiB2YXN0IGFtb3VudHMgb2Ygd3JpdHRlbiBtYXRlcmlhbCB0byByZWNvZ25pemUgcGF0dGVybnMgaW4gbGFuZ3VhZ2UgYW5kIHByZWRpY3Qgd2hhdCBtaWdodCBjb21lIG5leHQgaW4gYSBnaXZlbiBwaWVjZSBvZiB0ZXh0Lg%3D%3D&tab=aiSdk&customSize=1&langchainSize=1&maxOverflow=1)

#### Never Break Semantics

Semantic elements like links, images, inline code, and certain formatting elements should ideally always remain intact. Breaking a long link like `[structured data generation](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)` into `[structured` and `data generation]([./generating-structured-data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data` destroys meaning. The splitter preserves these constructs and splits around them.

<img width="1265" height="222" alt="image" src="https://github.com/user-attachments/assets/46a1eba7-9970-4f2d-9048-ed3f2db011ea" />

[Comparison of chunk size 100: Chunkdown (left) / LangChain Markdown Splitter (right)](https://chunkdown.zirkelc.dev/?text=QUkgU0RLIENvcmUgaGFzIHZhcmlvdXMgZnVuY3Rpb25zIGRlc2lnbmVkIGZvciBbdGV4dCBnZW5lcmF0aW9uXSguL2dlbmVyYXRpbmctdGV4dCksIFtzdHJ1Y3R1cmVkIGRhdGEgZ2VuZXJhdGlvbl0oLi9nZW5lcmF0aW5nLXN0cnVjdHVyZWQtZGF0YSksIGFuZCBbdG9vbCB1c2FnZV0oLi90b29scy1hbmQtdG9vbC1jYWxsaW5nKS4KVGhlc2UgZnVuY3Rpb25zIHRha2UgYSBzdGFuZGFyZGl6ZWQgYXBwcm9hY2ggdG8gc2V0dGluZyB1cCBbcHJvbXB0c10oLi9wcm9tcHRzKSBhbmQgW3NldHRpbmdzXSguL3NldHRpbmdzKSwgbWFraW5nIGl0IGVhc2llciB0byB3b3JrIHdpdGggZGlmZmVyZW50IG1vZGVscy4%3D&tab=aiSdk&customSize=100&langchainSize=100&maxOverflow=1)

#### Allow Controlled Overflow

Preserving a complete semantic unit like a section, paragraph, sentence, etc., is often more important than adhering to a strict chunk size. The splitter allows a controlled overflow (via `maxOverflowRatio`) of the chunk size if it avoids splitting a complete unit, e.g. a list item.

<img width="1266" height="481" alt="image" src="https://github.com/user-attachments/assets/e3feeaa1-eb57-42d1-b53a-480fc725ead3" />

[Comparison of chunk size 200 with 1.5x overflow ratio: Chunkdown (left) / LangChain Markdown Splitter (right)](https://chunkdown.zirkelc.dev/?text=LSBbYGdlbmVyYXRlVGV4dGBdKC9kb2NzL2FpLXNkay1jb3JlL2dlbmVyYXRpbmctdGV4dCk6IEdlbmVyYXRlcyB0ZXh0IGFuZCBbdG9vbCBjYWxsc10oLi90b29scy1hbmQtdG9vbC1jYWxsaW5nKS4KICBUaGlzIGZ1bmN0aW9uIGlzIGlkZWFsIGZvciBub24taW50ZXJhY3RpdmUgdXNlIGNhc2VzIHN1Y2ggYXMgYXV0b21hdGlvbiB0YXNrcyB3aGVyZSB5b3UgbmVlZCB0byB3cml0ZSB0ZXh0IChlLmcuIGRyYWZ0aW5nIGVtYWlsIG9yIHN1bW1hcml6aW5nIHdlYiBwYWdlcykgYW5kIGZvciBhZ2VudHMgdGhhdCB1c2UgdG9vbHMuCi0gW2BzdHJlYW1UZXh0YF0oL2RvY3MvYWktc2RrLWNvcmUvZ2VuZXJhdGluZy10ZXh0KTogU3RyZWFtIHRleHQgYW5kIHRvb2wgY2FsbHMuCiAgWW91IGNhbiB1c2UgdGhlIGBzdHJlYW1UZXh0YCBmdW5jdGlvbiBmb3IgaW50ZXJhY3RpdmUgdXNlIGNhc2VzIHN1Y2ggYXMgW2NoYXQgYm90c10oL2RvY3MvYWktc2RrLXVpL2NoYXRib3QpIGFuZCBbY29udGVudCBzdHJlYW1pbmddKC9kb2NzL2FpLXNkay11aS9jb21wbGV0aW9uKS4KLSBbYGdlbmVyYXRlT2JqZWN0YF0oL2RvY3MvYWktc2RrLWNvcmUvZ2VuZXJhdGluZy1zdHJ1Y3R1cmVkLWRhdGEpOiBHZW5lcmF0ZXMgYSB0eXBlZCwgc3RydWN0dXJlZCBvYmplY3QgdGhhdCBtYXRjaGVzIGEgW1pvZF0oaHR0cHM6Ly96b2QuZGV2Lykgc2NoZW1hLgogIFlvdSBjYW4gdXNlIHRoaXMgZnVuY3Rpb24gdG8gZm9yY2UgdGhlIGxhbmd1YWdlIG1vZGVsIHRvIHJldHVybiBzdHJ1Y3R1cmVkIGRhdGEsIGUuZy4gZm9yIGluZm9ybWF0aW9uIGV4dHJhY3Rpb24sIHN5bnRoZXRpYyBkYXRhIGdlbmVyYXRpb24sIG9yIGNsYXNzaWZpY2F0aW9uIHRhc2tzLgotIFtgc3RyZWFtT2JqZWN0YF0oL2RvY3MvYWktc2RrLWNvcmUvZ2VuZXJhdGluZy1zdHJ1Y3R1cmVkLWRhdGEpOiBTdHJlYW0gYSBzdHJ1Y3R1cmVkIG9iamVjdCB0aGF0IG1hdGNoZXMgYSBab2Qgc2NoZW1hLgogIFlvdSBjYW4gdXNlIHRoaXMgZnVuY3Rpb24gdG8gW3N0cmVhbSBnZW5lcmF0ZWQgVUlzXSgvZG9jcy9haS1zZGstdWkvb2JqZWN0LWdlbmVyYXRpb24pLg%3D%3D&tab=aiSdk)

## How It Works

Chunkdown employs a sophisticated multi-layered approach that combines AST-based parsing with hierarchical processing to create semantically meaningful chunks while preserving markdown formatting.

### Algorithm Overview

Chunkdown uses a **hierarchical divide-and-conquer approach** that respects document structure:

1. **Structure Recognition**: Parse markdown into a tree where headings organize their related content into logical sections
2. **Smart Chunking**: Keep complete sections together when possible, intelligently merge related sections to maximize space utilization  
3. **Graceful Degradation**: When sections are too large, progressively break them down using semantic boundaries (sentences, then phrases, then words)
4. **Format Preservation**: Protect meaningful constructs like links and code from being split, maintaining markdown integrity throughout

### Step-by-Step Process

#### 1. AST Parsing and Hierarchical Transformation
- Parse markdown using `mdast-util-from-markdown` with GitHub Flavored Markdown support
- Transform flat AST into hierarchical sections using `createHierarchicalAST()`
- **Key insight**: Headings become containers that hold their related content and nested subsections
- Content size calculated from actual text content, not raw markdown characters

#### 2. Top-Down Section Processing
- **Size evaluation**: Check if entire sections fit within `maxAllowedSize` (chunkSize × maxOverflowRatio)
- **Keep together**: Sections within limits are preserved as single chunks to maintain semantic coherence
- **Break down intelligently**: Large sections are decomposed using multiple optimization strategies

#### 3. Hierarchical Optimization Strategies

**Parent-Child Merging**:
- Attempt to merge parent section (heading + immediate content) with child sections
- Find consecutive children that fit together with parent within size limits
- Create merged sections while preserving hierarchical relationships

**Sibling Section Merging**:
- Group consecutive sibling sections at the same depth level
- Create "orphaned sections" (no heading, depth 0) to combine related siblings
- Maximize chunk utilization while respecting semantic boundaries

**Content Grouping**:
- Within sections, group content items to maximize chunk space utilization
- Use `flushCurrentItems()` pattern to accumulate content until size limits are reached
- Handle both regular sections (with headings) and orphaned sections (content-only)

#### 4. Container-Specific Processing

**Lists**: 
- Process items individually while preserving list structure
- Maintain correct numbering for ordered lists using `start` attribute
- Group items when they fit within size limits

**Tables**:
- Keep table headers with data rows when possible 
- Handle header-separator combinations for proper table formatting
- Split by rows when table is too large

**Blockquotes**:
- Treat as containers with recursive item processing
- Preserve quote formatting across chunks

#### 5. Text-Level Fallback Mechanism

When hierarchical processing cannot reduce content to acceptable sizes:

**Protected Range Extraction**:
- Re-parse content to extract position information for inline constructs
- Protect links, images, inline code, emphasis, and other formatting from mid-construct splits
- Create `ProtectedRange` objects that define no-split zones

**Priority-Based Boundary Detection**:
- Extract semantic boundaries with priority hierarchy (lower number = higher priority):
  - Periods before newlines (priority 0)
  - Periods before uppercase letters (priority 1) 
  - Question/exclamation marks (priority 2)
  - Safe periods (not abbreviations) (priority 3)
  - Colons and semicolons (priority 4)
  - Brackets and quotes (priority 5-8)
  - Line breaks, commas, dashes (priority 9-12)
  - Whitespace (priority 13, lowest)

**Recursive Boundary Splitting**:
- Try boundaries in priority order (highest priority first)
- Find optimal split position using middle-point strategy
- Recursively process both parts with remaining lower-priority boundaries
- Ensure forward progress by creating smaller parts than original

### Key Features in Action

**Content-Based Sizing**: Uses `toString()` to extract plain text from AST nodes, ensuring consistent semantic density regardless of markdown complexity.

**Controlled Overflow**: Allows chunks to exceed `chunkSize` up to `maxAllowedSize` to preserve complete semantic units like paragraphs or list items.

**Semantic Preservation**: Multi-level protection system prevents breaking meaningful constructs, from document structure (sections) down to inline elements (links, code spans).

**Structure Awareness**: Understands markdown document hierarchy and makes intelligent decisions about what content belongs together based on heading relationships.

## Usage

> [!NOTE]
> The markdown is parsed using [mdast-util-from-markdown](https://github.com/syntax-tree/mdast-util-from-markdown) and transformed back into a string using [mdast-util-to-markdown](https://github.com/syntax-tree/mdast-util-to-markdown). 
> These steps perform a normalization of certain markdown constructs which have multiple representations, for example it converts `__bold__` to `**bold**` and `- list item` to `* list item`, but the semantic meaning remains unchanged.

### Installation

```bash
npm install chunkdown
```

### Example

```typescript
import { chunkdown } from 'chunkdown';

const splitter = chunkdown({
  chunkSize: 500,        // Target chunk size based on content length
  maxOverflowRatio: 1.5  // Allow up to 50% overflow
});

const text = `
# AI SDK Core

Large Language Models (LLMs) are advanced programs that can understand, create, and engage with human language on a large scale.
They are trained on vast amounts of written material to recognize patterns in language and predict what might come next in a given piece of text.

AI SDK Core **simplifies working with LLMs by offering a standardized way of integrating them into your app** - so you can focus on building great AI applications for your users, not waste time on technical details.

For example, here’s how you can generate text with various models using the AI SDK:

<PreviewSwitchProviders />

## AI SDK Core Functions

AI SDK Core has various functions designed for [text generation](./generating-text), [structured data generation](./generating-structured-data), and [tool usage](./tools-and-tool-calling).
These functions take a standardized approach to setting up [prompts](./prompts) and [settings](./settings), making it easier to work with different models.

- [`generateText`](/docs/ai-sdk-core/generating-text): Generates text and [tool calls](./tools-and-tool-calling).
  This function is ideal for non-interactive use cases such as automation tasks where you need to write text (e.g. drafting email or summarizing web pages) and for agents that use tools.
- [`streamText`](/docs/ai-sdk-core/generating-text): Stream text and tool calls.
  You can use the `streamText` function for interactive use cases such as [chat bots](/docs/ai-sdk-ui/chatbot) and [content streaming](/docs/ai-sdk-ui/completion).
- [`generateObject`](/docs/ai-sdk-core/generating-structured-data): Generates a typed, structured object that matches a [Zod](https://zod.dev/) schema.
  You can use this function to force the language model to return structured data, e.g. for information extraction, synthetic data generation, or classification tasks.
- [`streamObject`](/docs/ai-sdk-core/generating-structured-data): Stream a structured object that matches a Zod schema.
  You can use this function to [stream generated UIs](/docs/ai-sdk-ui/object-generation).

## API Reference

Please check out the [AI SDK Core API Reference](/docs/reference/ai-sdk-core) for more details on each function.
`;

const chunks = splitter.splitText(text);
```

## API Reference

### `chunkdown(options: ChunkdownOptions)`

Creates a new markdown splitter instance.

#### Options

- `chunkSize: number`: The target size for each chunk in content characters, not raw markdown.
- `maxOverflowRatio: number`: The maximum overflow ratio for preserving semantic units. 
  - `1.0`: strict chunk size, no overflow allowed
  - `>1.0`: allow overflow of up to `chunkSize * maxOverflowRatio`

#### Returns

An object with the following method:
- `splitText(text: string): string[]`: Splits the input markdown text into chunks

## Visualization

The chunk visualizer hosted at [chunkdown.zirkelc.dev](https://chunkdown.zirkelc.dev/) provides an interactive way to see how text is split into chunks:

<img width="1272" height="2167" alt="image" src="https://github.com/user-attachments/assets/84294851-0abe-4f23-acdd-9450af756b62" />

## Future Improvements

### Configurable Breakpoints
Currently, certain elements have hardcoded protection breakpoints. Future versions will allow configuring when elements can be split:

```typescript
chunkdown({
  chunkSize: 500,
  maxOverflowRatio: 1.5,
  breakpoints: {
    link: 100,      // Split links over 100 chars
    emphasis: 50,   // Split emphasis over 50 chars
    heading: 150    // Split headings over 150 chars
  }
});
```

### Clean Formatting on Split
When forced to split semantic elements across chunks, the formatting loses its meaning:

```markdown
**This is a very long bold text that might be split into two chunks**
```

This text has a content size of 65 chars and could be split into two chunks.
The `**bold**` formatting could be either kept, removed or extended:

```markdown
Keep formatting:
- **This is a very long bold text that
- might be split into two chunks**

Remove formatting:
- This is a very long bold text that
- might be split into two chunks

Extend formatting:
- **This is a very long bold text that**
- **might be split into two chunks**
```

### Improve Table Chunks
When splitting tables, ensure that each chunk retains its header and is properly formatted:

```markdown
| Header 1 | Header 2 |
|----------|----------|
| Row 1   | Row 1   |
| Row 2   | Row 2   |
```

This table could be split into three chunks for the header and each data row..
Since the data rows have no relationship to the header, they lose some of their meaning. 
To improve the semantic meaning of each row, the header could be removed as standalone chunk and instead be added to each data row:

```markdown
Chunk 1:

| Header 1 | Header 2 |
|----------|----------|
| Row 1   | Row 1   |

Chunk 2:

| Header 1 | Header 2 |
|----------|----------|
| Row 2   | Row 2   |
```

