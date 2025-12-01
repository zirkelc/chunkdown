<div align='center'>

# chunkdown 🧩
> Create chunks worth embedding

<a href="https://www.npmjs.com/package/chunkdown" alt="chunkdown"><img src="https://img.shields.io/npm/dt/chunkdown?label=chunkdown"></a> <a href="https://github.com/zirkelc/chunkdown/actions/workflows/ci.yml" alt="CI"><img src="https://img.shields.io/github/actions/workflow/status/zirkelc/chunkdown/ci.yml?branch=main"></a>


</div>

Chunkdown is a tree-based markdown text splitter to create semantically meaningful chunks for RAG applications. 
Unlike traditional splitters that use simple character or regex-based methods, this library leverages markdown's hierarchical structure for optimal chunking.
Chunkdown is built around a few core ideas that guide its design:

#### Markdown as Hierarchical Tree

A properly structured markdown document forms a hierarchical tree where headings define sections containing various nodes (paragraphs, lists, tables, etc.). We parse markdown into an Abstract Syntax Tree (AST) and transform it into a hierarchical structure where sections contain their related content. This enables intelligent chunking that keeps semantically related information together.

<img width="1426" height="672" alt="image" src="https://github.com/user-attachments/assets/8cb5a8fd-9898-467a-b826-b164471b4efa" />

[Hierarchical Markdown Abstract Syntax Tree](https://chunks.zirkelc.dev/?text=IyBBSSBTREsgQ29yZQoKTGFyZ2UgTGFuZ3VhZ2UgTW9kZWxzIChMTE1zKSBhcmUgYWR2YW5jZWQgcHJvZ3JhbXMgdGhhdCBjYW4gdW5kZXJzdGFuZCwgY3JlYXRlLCBhbmQgZW5nYWdlIHdpdGggaHVtYW4gbGFuZ3VhZ2Ugb24gYSBsYXJnZSBzY2FsZS4KVGhleSBhcmUgdHJhaW5lZCBvbiB2YXN0IGFtb3VudHMgb2Ygd3JpdHRlbiBtYXRlcmlhbCB0byByZWNvZ25pemUgcGF0dGVybnMgaW4gbGFuZ3VhZ2UgYW5kIHByZWRpY3Qgd2hhdCBtaWdodCBjb21lIG5leHQgaW4gYSBnaXZlbiBwaWVjZSBvZiB0ZXh0LgoKQUkgU0RLIENvcmUgKipzaW1wbGlmaWVzIHdvcmtpbmcgd2l0aCBMTE1zIGJ5IG9mZmVyaW5nIGEgc3RhbmRhcmRpemVkIHdheSBvZiBpbnRlZ3JhdGluZyB0aGVtIGludG8geW91ciBhcHAqKiAtIHNvIHlvdSBjYW4gZm9jdXMgb24gYnVpbGRpbmcgZ3JlYXQgQUkgYXBwbGljYXRpb25zIGZvciB5b3VyIHVzZXJzLCBub3Qgd2FzdGUgdGltZSBvbiB0ZWNobmljYWwgZGV0YWlscy4KCkZvciBleGFtcGxlLCBoZXJlJ3MgaG93IHlvdSBjYW4gZ2VuZXJhdGUgdGV4dCB3aXRoIHZhcmlvdXMgbW9kZWxzIHVzaW5nIHRoZSBBSSBTREs6Cgo8UHJldmlld1N3aXRjaFByb3ZpZGVycyAvPgoKIyMgQUkgU0RLIENvcmUgRnVuY3Rpb25zCgpBSSBTREsgQ29yZSBoYXMgdmFyaW91cyBmdW5jdGlvbnMgZGVzaWduZWQgZm9yIFt0ZXh0IGdlbmVyYXRpb25dKC4vZ2VuZXJhdGluZy10ZXh0KSwgW3N0cnVjdHVyZWQgZGF0YSBnZW5lcmF0aW9uXSguL2dlbmVyYXRpbmctc3RydWN0dXJlZC1kYXRhKSwgYW5kIFt0b29sIHVzYWdlXSguL3Rvb2xzLWFuZC10b29sLWNhbGxpbmcpLgpUaGVzZSBmdW5jdGlvbnMgdGFrZSBhIHN0YW5kYXJkaXplZCBhcHByb2FjaCB0byBzZXR0aW5nIHVwIFtwcm9tcHRzXSguL3Byb21wdHMpIGFuZCBbc2V0dGluZ3NdKC4vc2V0dGluZ3MpLCBtYWtpbmcgaXQgZWFzaWVyIHRvIHdvcmsgd2l0aCBkaWZmZXJlbnQgbW9kZWxzLgoKLSBbYGdlbmVyYXRlVGV4dGBdKC9kb2NzL2FpLXNkay1jb3JlL2dlbmVyYXRpbmctdGV4dCk6IEdlbmVyYXRlcyB0ZXh0IGFuZCBbdG9vbCBjYWxsc10oLi90b29scy1hbmQtdG9vbC1jYWxsaW5nKS4KICBUaGlzIGZ1bmN0aW9uIGlzIGlkZWFsIGZvciBub24taW50ZXJhY3RpdmUgdXNlIGNhc2VzIHN1Y2ggYXMgYXV0b21hdGlvbiB0YXNrcyB3aGVyZSB5b3UgbmVlZCB0byB3cml0ZSB0ZXh0IChlLmcuIGRyYWZ0aW5nIGVtYWlsIG9yIHN1bW1hcml6aW5nIHdlYiBwYWdlcykgYW5kIGZvciBhZ2VudHMgdGhhdCB1c2UgdG9vbHMuCi0gW2BzdHJlYW1UZXh0YF0oL2RvY3MvYWktc2RrLWNvcmUvZ2VuZXJhdGluZy10ZXh0KTogU3RyZWFtIHRleHQgYW5kIHRvb2wgY2FsbHMuCiAgWW91IGNhbiB1c2UgdGhlIGBzdHJlYW1UZXh0YCBmdW5jdGlvbiBmb3IgaW50ZXJhY3RpdmUgdXNlIGNhc2VzIHN1Y2ggYXMgW2NoYXQgYm90c10oL2RvY3MvYWktc2RrLXVpL2NoYXRib3QpIGFuZCBbY29udGVudCBzdHJlYW1pbmddKC9kb2NzL2FpLXNkay11aS9jb21wbGV0aW9uKS4KLSBbYGdlbmVyYXRlT2JqZWN0YF0oL2RvY3MvYWktc2RrLWNvcmUvZ2VuZXJhdGluZy1zdHJ1Y3R1cmVkLWRhdGEpOiBHZW5lcmF0ZXMgYSB0eXBlZCwgc3RydWN0dXJlZCBvYmplY3QgdGhhdCBtYXRjaGVzIGEgW1pvZF0oaHR0cHM6Ly96b2QuZGV2Lykgc2NoZW1hLgogIFlvdSBjYW4gdXNlIHRoaXMgZnVuY3Rpb24gdG8gZm9yY2UgdGhlIGxhbmd1YWdlIG1vZGVsIHRvIHJldHVybiBzdHJ1Y3R1cmVkIGRhdGEsIGUuZy4gZm9yIGluZm9ybWF0aW9uIGV4dHJhY3Rpb24sIHN5bnRoZXRpYyBkYXRhIGdlbmVyYXRpb24sIG9yIGNsYXNzaWZpY2F0aW9uIHRhc2tzLgotIFtgc3RyZWFtT2JqZWN0YF0oL2RvY3MvYWktc2RrLWNvcmUvZ2VuZXJhdGluZy1zdHJ1Y3R1cmVkLWRhdGEpOiBTdHJlYW0gYSBzdHJ1Y3R1cmVkIG9iamVjdCB0aGF0IG1hdGNoZXMgYSBab2Qgc2NoZW1hLgogIFlvdSBjYW4gdXNlIHRoaXMgZnVuY3Rpb24gdG8gW3N0cmVhbSBnZW5lcmF0ZWQgVUlzXSgvZG9jcy9haS1zZGstdWkvb2JqZWN0LWdlbmVyYXRpb24pLgoKIyMgQVBJIFJlZmVyZW5jZQoKUGxlYXNlIGNoZWNrIG91dCB0aGUgW0FJIFNESyBDb3JlIEFQSSBSZWZlcmVuY2VdKC9kb2NzL3JlZmVyZW5jZS9haS1zZGstY29yZSkgZm9yIG1vcmUgZGV0YWlscyBvbiBlYWNoIGZ1bmN0aW9uLg%3D%3D)

#### Content Length vs. Markdown Length

Markdown uses additional characters for formatting (`**bold**`, `*italic*`, `[link](https://example.com)`, etc.) that increase the total character count without necessarily changing the semantic meaning. When calculating chunk size, we count actual text content rather than raw markdown characters. This ensures consistent semantic density across chunks regardless of formatting.

> [!NOTE]
> In a future version, it will be possible to opt-out of this behavior and use raw markdown length to calculate the chunk size.

For example, the following text from [Wikipedia](https://en.wikipedia.org/wiki/Llama) has 804 raw characters, however, what the user actually sees rendered on the screen are only 202 characters:

<pre>
The **llama** ([/ˈlɑːmə/](https://en.wikipedia.org/wiki/Help:IPA/English "Help:IPA/English"); Spanish pronunciation: [\[ˈʎama\]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish") or [\[ˈʝama\]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish")) (***Lama glama***) is a domesticated [South American](https://en.wikipedia.org/wiki/South_America "South America") [camelid](https://en.wikipedia.org/wiki/Camelid "Camelid"), widely used as a [meat](https://en.wikipedia.org/wiki/List_of_meat_animals "List of meat animals") and [pack animal](https://en.wikipedia.org/wiki/Pack_animal "Pack animal") by [Andean cultures](https://en.wikipedia.org/wiki/Inca_empire "Inca empire") since the [pre-Columbian era](https://en.wikipedia.org/wiki/Pre-Columbian_era "Pre-Columbian era").
</pre>

<img width="1425" height="672" alt="image" src="https://github.com/user-attachments/assets/17fb1c18-a1f5-4c14-b49d-898f93dfc21d" />

[Comparison of chunk size 100: Chunkdown (left) / LangChain Markdown Splitter (right)](https://chunks.zirkelc.dev/?text=VGhlICoqbGxhbWEqKiAoWy%2FLiGzJkcuQbcmZL10oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSGVscDpJUEEvRW5nbGlzaCAiSGVscDpJUEEvRW5nbGlzaCIpOyBTcGFuaXNoIHByb251bmNpYXRpb246IFtcW8uIyo5hbWFcXV0oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSGVscDpJUEEvU3BhbmlzaCAiSGVscDpJUEEvU3BhbmlzaCIpIG9yIFtcW8uIyp1hbWFcXV0oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSGVscDpJUEEvU3BhbmlzaCAiSGVscDpJUEEvU3BhbmlzaCIpKSAoKioqTGFtYSBnbGFtYSoqKikgaXMgYSBkb21lc3RpY2F0ZWQgW1NvdXRoIEFtZXJpY2FuXShodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9Tb3V0aF9BbWVyaWNhICJTb3V0aCBBbWVyaWNhIikgW2NhbWVsaWRdKGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0NhbWVsaWQgIkNhbWVsaWQiKSwgd2lkZWx5IHVzZWQgYXMgYSBbbWVhdF0oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvTGlzdF9vZl9tZWF0X2FuaW1hbHMgIkxpc3Qgb2YgbWVhdCBhbmltYWxzIikgYW5kIFtwYWNrIGFuaW1hbF0oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvUGFja19hbmltYWwgIlBhY2sgYW5pbWFsIikgYnkgW0FuZGVhbiBjdWx0dXJlc10oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSW5jYV9lbXBpcmUgIkluY2EgZW1waXJlIikgc2luY2UgdGhlIFtwcmUtQ29sdW1iaWFuIGVyYV0oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvUHJlLUNvbHVtYmlhbl9lcmEgIlByZS1Db2x1bWJpYW4gZXJhIiku&chunkSize=100&sectionOrder=input%2Cchunks%2Cpanel-1764331988127&maxOverflow=1&comparison=%255B%257B%2522id%2522%253A%2522panel-1764331988127%2522%252C%2522library%2522%253A%2522langchain%2522%252C%2522chunkdownAlgorithm%2522%253A%2522markdown%2522%252C%2522langchainAlgorithm%2522%253A%2522markdown%2522%252C%2522mastraAlgorithm%2522%253A%2522recursive%2522%252C%2522chunkSize%2522%253A100%252C%2522maxOverflowRatio%2522%253A1.5%257D%255D)

#### Words as Atomic Unit

Words are the smallest meaningful unit of information for embedding purposes. While tokenizers may split words further, for practical RAG applications, breaking words mid-way creates meaningless chunks. Therefore, words are treated as indivisible atoms that cannot be split.

<img width="1424" height="673" alt="image" src="https://github.com/user-attachments/assets/97ef70e8-4fa0-4d0a-961d-ed9dea80388c" />

[Comparison of chunk size 1: Chunkdown (left) / LangChain Markdown Splitter (right)](https://chunks.zirkelc.dev/?text=TGFyZ2UgTGFuZ3VhZ2UgTW9kZWxzIChMTE1zKSBhcmUgYWR2YW5jZWQgcHJvZ3JhbXMgdGhhdCBjYW4gdW5kZXJzdGFuZCwgY3JlYXRlLCBhbmQgZW5nYWdlIHdpdGggaHVtYW4gbGFuZ3VhZ2Ugb24gYSBsYXJnZSBzY2FsZS4KVGhleSBhcmUgdHJhaW5lZCBvbiB2YXN0IGFtb3VudHMgb2Ygd3JpdHRlbiBtYXRlcmlhbCB0byByZWNvZ25pemUgcGF0dGVybnMgaW4gbGFuZ3VhZ2UgYW5kIHByZWRpY3Qgd2hhdCBtaWdodCBjb21lIG5leHQgaW4gYSBnaXZlbiBwaWVjZSBvZiB0ZXh0Lg%3D%3D&chunkSize=1&sectionOrder=input%2Cchunks%2Cpanel-1764331988127&maxOverflow=1&comparison=%255B%257B%2522id%2522%253A%2522panel-1764331988127%2522%252C%2522library%2522%253A%2522langchain%2522%252C%2522chunkdownAlgorithm%2522%253A%2522markdown%2522%252C%2522langchainAlgorithm%2522%253A%2522markdown%2522%252C%2522mastraAlgorithm%2522%253A%2522recursive%2522%252C%2522chunkSize%2522%253A1%252C%2522maxOverflowRatio%2522%253A1.5%257D%255D)

#### Never Break Semantics

Semantic elements like links, images, inline code, and certain formatting elements should ideally always remain intact. Breaking a long link like `[structured data generation](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)` into `[structured` and `data generation](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data` destroys meaning. The splitter preserves these constructs and splits around them.

<img width="1427" height="283" alt="image" src="https://github.com/user-attachments/assets/6b2399f2-a8b8-48dd-a870-3caa902500a6" />

[Comparison of chunk size 100: Chunkdown (left) / LangChain Markdown Splitter (right)](https://chunks.zirkelc.dev/?text=QUkgU0RLIENvcmUgaGFzIHZhcmlvdXMgZnVuY3Rpb25zIGRlc2lnbmVkIGZvciBbdGV4dCBnZW5lcmF0aW9uXSguL2dlbmVyYXRpbmctdGV4dCksIFtzdHJ1Y3R1cmVkIGRhdGEgZ2VuZXJhdGlvbl0oLi9nZW5lcmF0aW5nLXN0cnVjdHVyZWQtZGF0YSksIGFuZCBbdG9vbCB1c2FnZV0oLi90b29scy1hbmQtdG9vbC1jYWxsaW5nKS4KVGhlc2UgZnVuY3Rpb25zIHRha2UgYSBzdGFuZGFyZGl6ZWQgYXBwcm9hY2ggdG8gc2V0dGluZyB1cCBbcHJvbXB0c10oLi9wcm9tcHRzKSBhbmQgW3NldHRpbmdzXSguL3NldHRpbmdzKSwgbWFraW5nIGl0IGVhc2llciB0byB3b3JrIHdpdGggZGlmZmVyZW50IG1vZGVscy4%3D&chunkSize=100&sectionOrder=input%2Cchunks%2Cpanel-1764331988127&maxOverflow=1&comparison=%255B%257B%2522id%2522%253A%2522panel-1764331988127%2522%252C%2522library%2522%253A%2522langchain%2522%252C%2522chunkdownAlgorithm%2522%253A%2522markdown%2522%252C%2522langchainAlgorithm%2522%253A%2522markdown%2522%252C%2522mastraAlgorithm%2522%253A%2522recursive%2522%252C%2522chunkSize%2522%253A100%252C%2522maxOverflowRatio%2522%253A1.5%257D%255D)

#### Allow Controlled Overflow

Preserving a complete semantic unit like a section, paragraph, sentence, etc., is often more important than adhering to a strict chunk size. The splitter allows a controlled overflow (via `maxOverflowRatio`) of the chunk size if it avoids splitting a complete unit, e.g. a list item.

<img width="1425" height="673" alt="image" src="https://github.com/user-attachments/assets/61ddadaa-9d05-427f-8650-17dea5af7e10" />

[Comparison of chunk size 200 with 1.5x overflow ratio: Chunkdown (left) / LangChain Markdown Splitter (right)](https://chunks.zirkelc.dev/?text=LSBbYGdlbmVyYXRlVGV4dGBdKC9kb2NzL2FpLXNkay1jb3JlL2dlbmVyYXRpbmctdGV4dCk6IEdlbmVyYXRlcyB0ZXh0IGFuZCBbdG9vbCBjYWxsc10oLi90b29scy1hbmQtdG9vbC1jYWxsaW5nKS4KICBUaGlzIGZ1bmN0aW9uIGlzIGlkZWFsIGZvciBub24taW50ZXJhY3RpdmUgdXNlIGNhc2VzIHN1Y2ggYXMgYXV0b21hdGlvbiB0YXNrcyB3aGVyZSB5b3UgbmVlZCB0byB3cml0ZSB0ZXh0IChlLmcuIGRyYWZ0aW5nIGVtYWlsIG9yIHN1bW1hcml6aW5nIHdlYiBwYWdlcykgYW5kIGZvciBhZ2VudHMgdGhhdCB1c2UgdG9vbHMuCi0gW2BzdHJlYW1UZXh0YF0oL2RvY3MvYWktc2RrLWNvcmUvZ2VuZXJhdGluZy10ZXh0KTogU3RyZWFtIHRleHQgYW5kIHRvb2wgY2FsbHMuCiAgWW91IGNhbiB1c2UgdGhlIGBzdHJlYW1UZXh0YCBmdW5jdGlvbiBmb3IgaW50ZXJhY3RpdmUgdXNlIGNhc2VzIHN1Y2ggYXMgW2NoYXQgYm90c10oL2RvY3MvYWktc2RrLXVpL2NoYXRib3QpIGFuZCBbY29udGVudCBzdHJlYW1pbmddKC9kb2NzL2FpLXNkay11aS9jb21wbGV0aW9uKS4KLSBbYGdlbmVyYXRlT2JqZWN0YF0oL2RvY3MvYWktc2RrLWNvcmUvZ2VuZXJhdGluZy1zdHJ1Y3R1cmVkLWRhdGEpOiBHZW5lcmF0ZXMgYSB0eXBlZCwgc3RydWN0dXJlZCBvYmplY3QgdGhhdCBtYXRjaGVzIGEgW1pvZF0oaHR0cHM6Ly96b2QuZGV2Lykgc2NoZW1hLgogIFlvdSBjYW4gdXNlIHRoaXMgZnVuY3Rpb24gdG8gZm9yY2UgdGhlIGxhbmd1YWdlIG1vZGVsIHRvIHJldHVybiBzdHJ1Y3R1cmVkIGRhdGEsIGUuZy4gZm9yIGluZm9ybWF0aW9uIGV4dHJhY3Rpb24sIHN5bnRoZXRpYyBkYXRhIGdlbmVyYXRpb24sIG9yIGNsYXNzaWZpY2F0aW9uIHRhc2tzLgotIFtgc3RyZWFtT2JqZWN0YF0oL2RvY3MvYWktc2RrLWNvcmUvZ2VuZXJhdGluZy1zdHJ1Y3R1cmVkLWRhdGEpOiBTdHJlYW0gYSBzdHJ1Y3R1cmVkIG9iamVjdCB0aGF0IG1hdGNoZXMgYSBab2Qgc2NoZW1hLgogIFlvdSBjYW4gdXNlIHRoaXMgZnVuY3Rpb24gdG8gW3N0cmVhbSBnZW5lcmF0ZWQgVUlzXSgvZG9jcy9haS1zZGstdWkvb2JqZWN0LWdlbmVyYXRpb24pLg%3D%3D&sectionOrder=input%2Cchunks%2Cpanel-1764331988127&comparison=%255B%257B%2522id%2522%253A%2522panel-1764331988127%2522%252C%2522library%2522%253A%2522langchain%2522%252C%2522chunkdownAlgorithm%2522%253A%2522markdown%2522%252C%2522langchainAlgorithm%2522%253A%2522markdown%2522%252C%2522mastraAlgorithm%2522%253A%2522recursive%2522%252C%2522chunkSize%2522%253A200%252C%2522maxOverflowRatio%2522%253A1.5%257D%255D)


### Installation

```bash
npm install chunkdown
#
pnpm add chunkdown
#
bun add chunkdown
```

## Usage

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

#### Links and Images

By default, links and images are never split to avoid breaking their semantic meaning. 

```typescript
import { chunkdown } from 'chunkdown';

const text = `Please check out the [AI SDK Core API Reference](/docs/reference/ai-sdk-core) for more details on each function.`;

// By default, never split links and images
const splitter = chunkdown({
  chunkSize: 50,
});

const chunks = splitter.splitText(text);
// chunks[0]: "Please check out the [AI SDK Core API Reference](/docs/reference/ai-sdk-core)"
// chunks[1]: "for more details on each function."

// Allow splitting links
const splitte = chunkdown({
  chunkSize: 50,
  rules: {
    formatting: { split: 'allow-split' }
  }
});

const chunks = splitter.splitText(text);
// chunks[0]: "Please check out the [AI SDK Core API"
// chunks[1]: "Reference](/docs/reference/ai-sdk-core) for more details on each function."
```

##### Reference-Style

By default, Chunkdown normalizes reference-style links and images to inline style. This prevents issues when reference definitions end up in different chunks than their usage.

```typescript
import { chunkdown } from 'chunkdown';

const text = `
Check out the [documentation][docs] and [API reference][api].

[docs]: https://example.com/docs
[api]: https://example.com/api
`;

// By default, normalize to inline style
const splitter = chunkdown({
  chunkSize: 100,
});

const chunks = splitter.splitText(text);
// Result:
// chunks[0]: "Check out the [documentation](https://example.com/docs) and [API reference](https://example.com/api)."

// Preserve original style
const splitter = chunkdown({
  chunkSize: 100,
  rules: {
    link: { style: 'preserve' }
  }
});

const chunks = splitter.splitText(text);
// Result:
// chunks[0]: "Check out the [documentation][docs] and [API reference][api]."
// chunks[1]: "[docs]: https://example.com/docs"
// chunks[2]: "[api]: https://example.com/api"
```

#### Formatting

Unlike links and images, formatting elements like **bold**, *italic*, and ~~strikethrough~~ will be splitted if needed.

```typescript
import { chunkdown } from 'chunkdown';

const text = `This is **a very long bold text that contains many words and exceeds the chunk size** in the middle.`;

// By default, allow splitting formatting
const splitter = chunkdown({
  chunkSize: 30,
});

const chunks = splitter.splitText(text);
// chunks[0]: "This is **a very long"
// chunks[1]: "bold text that contains many"
// chunks[2]: "words and exceeds the"
// chunks[3]: "chunk size** in the middle."

// Never split formatting
const splitte = chunkdown({
  chunkSize: 30,
  rules: {
    formatting: { split: 'never-split' }
  }
});

const chunks = splitter.splitText(text);
// chunks[0]: "This is"
// chunks[1]: "**a very long bold text that contains many words and exceeds the chunk size**"
// chunks[2]: "in the middle."
```

#### Tables

When a table is split into multiple chunks, Chunkdown automatically preserves context by including the header row in each chunk. This ensures that data rows don't lose their meaning when separated from the original header.

> [!NOTE]
> The header row size is not counted when calculating chunk sizes. Only data row content is measured against the `chunkSize` limit.

```typescript
import { chunkdown } from 'chunkdown';

const splitter = chunkdown({
  chunkSize: 100,
  maxOverflowRatio: 1.0
});

const text = `
| Name     | Age | Country | Occupation        | Email                  |
|----------|-----|---------|-------------------|------------------------|
| Alice    | 30  | USA     | Software Engineer | alice@example.com      |
| Bob      | 25  | UK      | Designer          | bob@example.com        |
| Charlie  | 35  | Canada  | Product Manager   | charlie@example.com    |
| David    | 40  | France  | Data Scientist    | david@example.com      |
`;

const chunks = splitter.splitText(text);
// chunks[0]:
// | Name | Age | Country | Occupation | Email |
// | - | - | - | - | - |
// | Alice | 30 | USA | Software Engineer | <alice@example.com> |
// | Bob | 25 | UK | Designer | <bob@example.com> |

// chunks[1]:
// | Name | Age | Country | Occupation | Email |
// | - | - | - | - | - |
// | Charlie | 35 | Canada | Product Manager | <charlie@example.com> |
// | David | 40 | France | Data Scientist | <david@example.com> |
```

Tables are serialized into markdown using the [GFM table extension](https://github.com/syntax-tree/mdast-util-gfm-table) with the `tablePipeAlign` option set to `false`. That means the table delimeter row between header row and data rows will not be filled with additional dashes and whitespaces to align the columns vertically, saving many useless characters when embedding the chunks.

#### Normalization

Certain markdown elements such as formatting and lists have multiple representations. Chunkdown normalizes these element to ensure a uniform output regardless of input style variations.

```typescript
import { chunkdown } from 'chunkdown';

const text = `
formatting:
__bold__
_italic_

---

lists:
- list item 1
- list item 2
`;

const splitter = chunkdown({
  chunkSize: 100,
});

const chunks = splitter.splitText(text);
// Markdown variations are normalized to:
// - __bold__ → **bold**
// - _italic_ → *italic*
// - "---" → "***" (thematic break)
// - list item 1 → * list item 1 (starting with "*")
```



#### Transformation

Transform functions allow you to modify or filter nodes during preprocessing. This is useful for cleaning up content before chunking, such as truncating long URLs or removing unwanted elements.

##### Truncating Long URLs

Prevent chunk bloat from excessively long URLs:

```typescript
const splitter = chunkdown({
  chunkSize: 100,
  rules: {
    link: {
      transform: (node) => {
        // Truncate URLs longer than 100 characters
        if (node.url.length > 50) {
          return {
            ...node,
            url: node.url.substring(0, 47) + '...'
          };
        }
        return undefined;
      }
    }
  }
});

const text = `Check out our [website](https://example.com/with/a/very/long/url/that/increases/the/chunk/size/significantly).`;
const chunks = splitter.splitText(text);
// chunks[0]: "Check out our [website](https://example.com/with/a/very/long/url/that/incr...)."
```

##### Removing Data URLs

[Data URLs](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/data) in images (i.e. base64-encoded images) can be extremely long and create noise in chunks without meaningful content:

```typescript
import { chunkdown } from 'chunkdown';

const text = `
# Article

![Screenshot](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAoAAAAHgCAYAAAD0...)

Check our [website](https://example.com) for more info.

![Logo](https://cdn.example.com/logo.png)
`;

const splitter = chunkdown({
  chunkSize: 500,
  rules: {
    image: {
      transform: (node) => {
        // Remove images with data URLs
        if (node.url.startsWith('data:')) {
          return null;  // Remove the entire image node
        }
        return undefined; // Keep regular images
      }
    }
  }
});

const text = `
# Article

![Screenshot](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAoAAAAHgCAYAAAD0...)

Check our [website](https://example.com) for more info.
`;
const chunks = splitter.splitText(text);
// chunks[0]: 
// # Article
//
// Check our [website](https://example.com) for more info.
```

## API Reference

### `chunkdown(options: ChunkdownOptions)`

Creates a new markdown splitter instance.

#### Returns

An object with the following methods and properties:

**Methods:**
- `splitText(text: string): string[]`: Splits the input markdown text into chunks
- `splitNode(root: Root): Array<Nodes>`: Splits a markdown AST root node into an array of AST nodes

**Properties (readonly):**
- `chunkSize: number`: The configured target chunk size
- `maxOverflowRatio: number`: The configured maximum overflow ratio
- `maxRawSize: number | undefined`: The configured maximum raw size (if set)

#### Options

##### `chunkSize: number` 

The target content size for each chunk, counting only content characters, not raw markdown.

##### `maxOverflowRatio?: number` (optional)

The maximum overflow ratio for preserving semantic units:
- `1.0`: strict chunk size, no overflow allowed (default)
- `>1.0`: allow overflow of up to `chunkSize * maxOverflowRatio`

##### `rules?: Partial<NodeRules>` (optional)

Configure splitting behavior for specific markdown node types. Rules allow fine-grained control over when and how different markdown elements can be split during chunking.

**Supported node types:**
- `link`: Link elements `[text](url)`
- `image`: Image elements `![alt](url)`
- `table`: Table elements
- `list`: List elements (ordered and unordered)
- `blockquote`: Blockquote elements
- `formatting`: Formatting elements (combines `strong`, `emphasis`, `delete`)
- `strong`: Bold text `**bold**` (overrides `formatting` if specified)
- `emphasis`: Italic text `*italic*` (overrides `formatting` if specified)
- `delete`: Strikethrough text `~~deleted~~` (overrides `formatting` if specified)

> [!NOTE]
> The `formatting` rule applies to all formatting elements (`strong`, `emphasis`, `delete`) unless you override them individually. 

##### Split 

Each node type can have a `split` rule:

- `'never-split' | { rule: 'never-split' }`: Never split this element, regardless of size
- `'allow-split' | { rule: 'allow-split' }`: Allow splitting this element if it exceeds the chunk size
- `{ rule: 'size-split', size: number }`: Only split this element if its content size exceeds the specified size

##### Style

Links and images support an additional `style` property to control reference-style normalization:

- `'inline'`: Convert reference-style to inline style
- `'preserve'`: Keep original reference style

##### Transform

Each node type can have a `transform` function to modify or filter nodes:

```typescript
type NodeTransform<T extends Nodes> = (node: T, context: TransformContext) => T | null | undefined;
```

- Return modified node: Replace the original with transformed version
- Return `null`: Remove the node from the tree
- Return `undefined`: Keep the node unchanged

The transform receives a context with parent, index, and root information. Transforms are applied during preprocessing, after reference-style normalization but before chunking.

##### Examples

```typescript
import { chunkdown, defaultNodeRules } from 'chunkdown';

// Never split links
chunkdown({
  chunkSize: 500,
  rules: {
    link: { split: 'never-split' }
  }
});

// Split lists only if they exceed 200 characters
chunkdown({
  chunkSize: 500,
  rules: {
    list: { split: { rule: 'size-split', size: 200 } }
  }
});

// Never split formatting by default, but allow splitting bold text
chunkdown({
  chunkSize: 500,
  rules: {
    formatting: { split: 'never-split' },  // Applies to strong, emphasis, delete
    strong: { split: 'allow-split' }       // Override: allow splitting bold text
  }
});

// Extend default rules
chunkdown({
  chunkSize: 500,
  rules: {
    ...defaultNodeRules,  // Include defaults for other elements
    link: { split: 'never-split' },
    table: { split: { rule: 'allow-split' } },
    list: { split: { rule: 'size-split', size: 150 } },
    blockquote: { split: { rule: 'size-split', size: 300 } }
  }
});

// Normalize links to inline-style, preserve images in reference-style
chunkdown({
  chunkSize: 500,
  rules: {
    link: { style: 'inline' },
    image: { style: 'preserve' }
  }
});

// Remove data URLs and truncate long links
chunkdown({
  chunkSize: 500,
  rules: {
    image: {
      transform: (node) => {
        // Remove images with data URLs
        if (node.url.startsWith('data:')) {
          return null;
        }
        return undefined;
      }
    },
    link: {
      transform: (node) => {
        // Truncate long URLs
        if (node.url.length > 100) {
          return { ...node, url: node.url.substring(0, 100) + '...' };
        }
        return undefined;
      }
    }
  }
});
```

**Default rules:**

By default, links and images are set to never split and normalize to inline style:

```typescript
const defaultNodeRules: NodeRules = {
  link: { 
    split: 'never-split', 
    style: 'inline' 
  },
  image: { 
    split: 'never-split', 
    style: 'inline'
  },
};
```

When you provide custom rules, they override the defaults. Use the spread operator `...defaultNodeRules` to explicitly include defaults if you want to override only specific elements.

```typescript
import { chunkdown, defaultNodeRules } from 'chunkdown';

chunkdown({
  chunkSize: 500,
  rules: {
    ...defaultNodeRules,  // Include defaults for other elements
    link: { split: 'never-split' },
    table: { split: { rule: 'allow-split' } },
    list: { split: { rule: 'size-split', size: 150 } },
    blockquote: { split: { rule: 'size-split', size: 300 } }
  }
});
```

##### `maxRawSize?: number` (optional)

The maximum raw size for each chunk, counting all characters including markdown formatting.

Certain markdown elements, such as links and images with long URLs, can have disproportionately long raw sizes compared to their actual content size.
For example, the following text has a content size of 21 but a raw size of 117 chars due to the long URL:

```markdown
This is a [link with short text](https://example.com/with/a/very/long/url/that/increases/the/raw/size/significantly).
```

This is usually not a problem, but if a text contains a lot of such elements (e.g. scraped from a website with many links and images), the resulting chunks can become very large in raw size, even if their content size is within the allowed limits.
When the text is then embedded by a model, the large raw size could exceed the model's token limit, causing errors.
For example, OpenAI's latest embedding model [`text-embedding-3-large`](https://platform.openai.com/docs/guides/embeddings#embedding-models) has a maximum limit of 8192 tokens, which roughly translates to about 32,000 characters ([rules of thumb: 1 token ≈ 4 characters](https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them)).

> [!NOTE]
> It is recommended to set this option to the upper limit of your embedding model.

The `maxRawSize` option acts as a safety net that enforces a hard limit on the total number of characters allowed in each chunk.
It is guaranteed that no chunk will exceed this limit, even if it means splitting semantic units that would otherwise be preserved.

## Visualization

The chunk visualizer hosted at [chunks.zirkelc.dev](https://chunks.zirkelc.dev/) provides an interactive way to see how text is split into chunks:

<img width="1512" height="823" alt="image" src="https://github.com/user-attachments/assets/3ab0f439-bab8-47a4-8abf-54b7a005d131" />

## Future Improvements

### Normalize Broken Markdown Formatting
Splitting markdown text into multiple chunks often breaks formatting, because the start and end delimiters end up in different chunks. This broken formatting provides no real semantic meaning but adds unnecessary noise:

```ts
import { chunkdown } from "chunkdown";

const text = `**This is a very long bold text that might be split into two chunks**`;

const splitter = chunkdown({
  chunkSize: 50,
  maxOverflowRatio: 1.0
});

const chunks = splitter.splitText(text, {
  breakMode: 'keep'
});
// Keep broken markdown:
// - **This is a very long bold text that
// - might be split into two chunks**

const chunks = splitter.splitText(text, {
  breakMode: 'remove'
});
// Remove broken markdown:
// - This is a very long bold text that
// - might be split into two chunks

const chunks = splitter.splitText(text, {
  breakMode: 'extend'
});
// Extend broken markdown:
// - **This is a very long bold text that**
// - **might be split into two chunks**
```

### Return Chunk Start and End Positions

Currently, the splitter returns the chunks as array of strings. That means the original position of each chunk in the source text is lost. 
In a typical RAG setup, the source document and each chunk is stored with it's embedding in a database. This duplicates lots of text since each chunk contains parts of the original document.

Chunkdown could return the start and end positions of each chunk in the original text, allowing to store only the original document and reference the chunk positions when needed.

```ts
const document = '...'; // original markdown document
const chunks = splitter.splitDocument(document);
// Result:
// [
//   { text: 'First chunk text...', start: 0, end: 256 },
//   { text: 'Second chunk text...', start: 257, end: 512 },
//   ...
// ]

await db.insert(documentTable).values({
  text: document
});

await db
  .insert(chunkTable)
  .values(chunks.map(chunk => ({
    start: chunk.start, // start position in original document
    end: chunk.end, // end position in original document
    text: null, // chunk text not stored separately
    embedding: await embed(chunk.text),
  })));
```


