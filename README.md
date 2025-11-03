<div align='center'>

# chunkdown 🧩
> Create chunks worth embedding

<a href="https://www.npmjs.com/package/chunkdown" alt="chunkdown"><img src="https://img.shields.io/npm/dt/chunkdown?label=chunkdown"></a> <a href="https://github.com/zirkelc/chunkdown/actions/workflows/ci.yml" alt="CI"><img src="https://img.shields.io/github/actions/workflow/status/zirkelc/chunkdown/ci.yml?branch=main"></a>


</div>

Chunkdown is a tree-based markdown text splitter that understands document structure to create semantically meaningful chunks for RAG applications. 
Unlike traditional splitters that use simple character or regex-based methods, this library leverages markdown's hierarchical structure for optimal chunking.
Chunkdown is built around a few core ~~beliefs~~ ideas that guide its design:

#### Markdown as Hierarchical Tree

A properly structured markdown document forms a hierarchical tree where headings define sections containing various nodes (paragraphs, lists, tables, etc.). We parse markdown into an Abstract Syntax Tree (AST) and transform it into a hierarchical structure where sections contain their related content. This enables intelligent chunking that keeps semantically related information together.

<img width="1266" height="542" alt="image" src="https://github.com/user-attachments/assets/0a49589c-fae2-4955-b042-5bee770f0344" />

[Hierarchical Markdown Abstract Syntax Tree](https://chunkdown.zirkelc.dev/?text=IyBBSSBTREsgQ29yZQoKTGFyZ2UgTGFuZ3VhZ2UgTW9kZWxzIChMTE1zKSBhcmUgYWR2YW5jZWQgcHJvZ3JhbXMgdGhhdCBjYW4gdW5kZXJzdGFuZCwgY3JlYXRlLCBhbmQgZW5nYWdlIHdpdGggaHVtYW4gbGFuZ3VhZ2Ugb24gYSBsYXJnZSBzY2FsZS4KVGhleSBhcmUgdHJhaW5lZCBvbiB2YXN0IGFtb3VudHMgb2Ygd3JpdHRlbiBtYXRlcmlhbCB0byByZWNvZ25pemUgcGF0dGVybnMgaW4gbGFuZ3VhZ2UgYW5kIHByZWRpY3Qgd2hhdCBtaWdodCBjb21lIG5leHQgaW4gYSBnaXZlbiBwaWVjZSBvZiB0ZXh0LgoKQUkgU0RLIENvcmUgKipzaW1wbGlmaWVzIHdvcmtpbmcgd2l0aCBMTE1zIGJ5IG9mZmVyaW5nIGEgc3RhbmRhcmRpemVkIHdheSBvZiBpbnRlZ3JhdGluZyB0aGVtIGludG8geW91ciBhcHAqKiAtIHNvIHlvdSBjYW4gZm9jdXMgb24gYnVpbGRpbmcgZ3JlYXQgQUkgYXBwbGljYXRpb25zIGZvciB5b3VyIHVzZXJzLCBub3Qgd2FzdGUgdGltZSBvbiBhaVNkayBkZXRhaWxzLgoKRm9yIGV4YW1wbGUsIGhlcmXigJlzIGhvdyB5b3UgY2FuIGdlbmVyYXRlIHRleHQgd2l0aCB2YXJpb3VzIG1vZGVscyB1c2luZyB0aGUgQUkgU0RLOgoKPFByZXZpZXdTd2l0Y2hQcm92aWRlcnMgLz4KCiMjIEFJIFNESyBDb3JlIEZ1bmN0aW9ucwoKQUkgU0RLIENvcmUgaGFzIHZhcmlvdXMgZnVuY3Rpb25zIGRlc2lnbmVkIGZvciBbdGV4dCBnZW5lcmF0aW9uXSguL2dlbmVyYXRpbmctdGV4dCksIFtzdHJ1Y3R1cmVkIGRhdGEgZ2VuZXJhdGlvbl0oLi9nZW5lcmF0aW5nLXN0cnVjdHVyZWQtZGF0YSksIGFuZCBbdG9vbCB1c2FnZV0oLi90b29scy1hbmQtdG9vbC1jYWxsaW5nKS4KVGhlc2UgZnVuY3Rpb25zIHRha2UgYSBzdGFuZGFyZGl6ZWQgYXBwcm9hY2ggdG8gc2V0dGluZyB1cCBbcHJvbXB0c10oLi9wcm9tcHRzKSBhbmQgW3NldHRpbmdzXSguL3NldHRpbmdzKSwgbWFraW5nIGl0IGVhc2llciB0byB3b3JrIHdpdGggZGlmZmVyZW50IG1vZGVscy4KCi0gW2BnZW5lcmF0ZVRleHRgXSgvZG9jcy9haS1zZGstY29yZS9nZW5lcmF0aW5nLXRleHQpOiBHZW5lcmF0ZXMgdGV4dCBhbmQgW3Rvb2wgY2FsbHNdKC4vdG9vbHMtYW5kLXRvb2wtY2FsbGluZykuCiAgVGhpcyBmdW5jdGlvbiBpcyBpZGVhbCBmb3Igbm9uLWludGVyYWN0aXZlIHVzZSBjYXNlcyBzdWNoIGFzIGF1dG9tYXRpb24gdGFza3Mgd2hlcmUgeW91IG5lZWQgdG8gd3JpdGUgdGV4dCAoZS5nLiBkcmFmdGluZyBlbWFpbCBvciBzdW1tYXJpemluZyB3ZWIgcGFnZXMpIGFuZCBmb3IgYWdlbnRzIHRoYXQgdXNlIHRvb2xzLgotIFtgc3RyZWFtVGV4dGBdKC9kb2NzL2FpLXNkay1jb3JlL2dlbmVyYXRpbmctdGV4dCk6IFN0cmVhbSB0ZXh0IGFuZCB0b29sIGNhbGxzLgogIFlvdSBjYW4gdXNlIHRoZSBgc3RyZWFtVGV4dGAgZnVuY3Rpb24gZm9yIGludGVyYWN0aXZlIHVzZSBjYXNlcyBzdWNoIGFzIFtjaGF0IGJvdHNdKC9kb2NzL2FpLXNkay11aS9jaGF0Ym90KSBhbmQgW2NvbnRlbnQgc3RyZWFtaW5nXSgvZG9jcy9haS1zZGstdWkvY29tcGxldGlvbikuCi0gW2BnZW5lcmF0ZU9iamVjdGBdKC9kb2NzL2FpLXNkay1jb3JlL2dlbmVyYXRpbmctc3RydWN0dXJlZC1kYXRhKTogR2VuZXJhdGVzIGEgdHlwZWQsIHN0cnVjdHVyZWQgb2JqZWN0IHRoYXQgbWF0Y2hlcyBhIFtab2RdKGh0dHBzOi8vem9kLmRldi8pIHNjaGVtYS4KICBZb3UgY2FuIHVzZSB0aGlzIGZ1bmN0aW9uIHRvIGZvcmNlIHRoZSBsYW5ndWFnZSBtb2RlbCB0byByZXR1cm4gc3RydWN0dXJlZCBkYXRhLCBlLmcuIGZvciBpbmZvcm1hdGlvbiBleHRyYWN0aW9uLCBzeW50aGV0aWMgZGF0YSBnZW5lcmF0aW9uLCBvciBjbGFzc2lmaWNhdGlvbiB0YXNrcy4KLSBbYHN0cmVhbU9iamVjdGBdKC9kb2NzL2FpLXNkay1jb3JlL2dlbmVyYXRpbmctc3RydWN0dXJlZC1kYXRhKTogU3RyZWFtIGEgc3RydWN0dXJlZCBvYmplY3QgdGhhdCBtYXRjaGVzIGEgWm9kIHNjaGVtYS4KICBZb3UgY2FuIHVzZSB0aGlzIGZ1bmN0aW9uIHRvIFtzdHJlYW0gZ2VuZXJhdGVkIFVJc10oL2RvY3MvYWktc2RrLXVpL29iamVjdC1nZW5lcmF0aW9uKS4KCiMjIEFQSSBSZWZlcmVuY2UKClBsZWFzZSBjaGVjayBvdXQgdGhlIFtBSSBTREsgQ29yZSBBUEkgUmVmZXJlbmNlXSgvZG9jcy9yZWZlcmVuY2UvYWktc2RrLWNvcmUpIGZvciBtb3JlIGRldGFpbHMgb24gZWFjaCBmdW5jdGlvbi4%3D&tab=aiSdk)

#### Content Length vs. Markdown Length

Markdown uses additional characters for formatting (`**bold**`, `*italic*`, `[link](https://example.com)`, etc.) that increase the total character count without necessarily changing the semantic meaning. When calculating chunk size, we count actual text content rather than raw markdown characters. This ensures consistent semantic density across chunks regardless of formatting.

> [!NOTE]
> In a future version, it will be possible to opt-out of this behavior and use raw markdown length to calculate the chunk size.

For example, the following text from [Wikipedia](https://en.wikipedia.org/wiki/Llama) has 804 raw characters, however, what the user actually sees rendered on the screen are only 202 characters:

<pre>
The **llama** ([/ˈlɑːmə/](https://en.wikipedia.org/wiki/Help:IPA/English "Help:IPA/English"); Spanish pronunciation: [\[ˈʎama\]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish") or [\[ˈʝama\]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish")) (***Lama glama***) is a domesticated [South American](https://en.wikipedia.org/wiki/South_America "South America") [camelid](https://en.wikipedia.org/wiki/Camelid "Camelid"), widely used as a [meat](https://en.wikipedia.org/wiki/List_of_meat_animals "List of meat animals") and [pack animal](https://en.wikipedia.org/wiki/Pack_animal "Pack animal") by [Andean cultures](https://en.wikipedia.org/wiki/Inca_empire "Inca empire") since the [pre-Columbian era](https://en.wikipedia.org/wiki/Pre-Columbian_era "Pre-Columbian era").
</pre>

<img width="1259" height="408" alt="image" src="https://github.com/user-attachments/assets/a9cad8b2-88da-4907-aaa3-ea999046f5a6" />

[Comparison of chunk size 100: Chunkdown (left) / LangChain Markdown Splitter (right)](https://chunkdown.zirkelc.dev/?text=VGhlICoqbGxhbWEqKiAoWy%2FLiGzJkcuQbcmZL10oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSGVscDpJUEEvRW5nbGlzaCAiSGVscDpJUEEvRW5nbGlzaCIpOyBTcGFuaXNoIHByb251bmNpYXRpb246IFtcW8uIyo5hbWFcXV0oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSGVscDpJUEEvU3BhbmlzaCAiSGVscDpJUEEvU3BhbmlzaCIpIG9yIFtcW8uIyp1hbWFcXV0oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSGVscDpJUEEvU3BhbmlzaCAiSGVscDpJUEEvU3BhbmlzaCIpKSAoKioqTGFtYSBnbGFtYSoqKikgaXMgYSBkb21lc3RpY2F0ZWQgW1NvdXRoIEFtZXJpY2FuXShodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9Tb3V0aF9BbWVyaWNhICJTb3V0aCBBbWVyaWNhIikgW2NhbWVsaWRdKGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0NhbWVsaWQgIkNhbWVsaWQiKSwgd2lkZWx5IHVzZWQgYXMgYSBbbWVhdF0oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvTGlzdF9vZl9tZWF0X2FuaW1hbHMgIkxpc3Qgb2YgbWVhdCBhbmltYWxzIikgYW5kIFtwYWNrIGFuaW1hbF0oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvUGFja19hbmltYWwgIlBhY2sgYW5pbWFsIikgYnkgW0FuZGVhbiBjdWx0dXJlc10oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSW5jYV9lbXBpcmUgIkluY2EgZW1waXJlIikgc2luY2UgdGhlIFtwcmUtQ29sdW1iaWFuIGVyYV0oaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvUHJlLUNvbHVtYmlhbl9lcmEgIlByZS1Db2x1bWJpYW4gZXJhIiku&tab=lama&customSize=100&langchainSize=100&maxOverflow=1)

#### Words as Atomic Unit

Words are the smallest meaningful unit of information for embedding purposes. While tokenizers may split words further, for practical RAG applications, breaking words mid-way creates meaningless chunks. Therefore, words are treated as indivisible atoms that cannot be split.

<img width="1263" height="274" alt="image" src="https://github.com/user-attachments/assets/b6099a7b-3120-461e-b014-2af5056f36cc" />

[Comparison of chunk size 1: Chunkdown (left) / LangChain Markdown Splitter (right)](https://chunkdown.zirkelc.dev/?text=TGFyZ2UgTGFuZ3VhZ2UgTW9kZWxzIChMTE1zKSBhcmUgYWR2YW5jZWQgcHJvZ3JhbXMgdGhhdCBjYW4gdW5kZXJzdGFuZCwgY3JlYXRlLCBhbmQgZW5nYWdlIHdpdGggaHVtYW4gbGFuZ3VhZ2Ugb24gYSBsYXJnZSBzY2FsZS4KVGhleSBhcmUgdHJhaW5lZCBvbiB2YXN0IGFtb3VudHMgb2Ygd3JpdHRlbiBtYXRlcmlhbCB0byByZWNvZ25pemUgcGF0dGVybnMgaW4gbGFuZ3VhZ2UgYW5kIHByZWRpY3Qgd2hhdCBtaWdodCBjb21lIG5leHQgaW4gYSBnaXZlbiBwaWVjZSBvZiB0ZXh0Lg%3D%3D&tab=aiSdk&customSize=1&langchainSize=1&maxOverflow=1)

#### Never Break Semantics

Semantic elements like links, images, inline code, and certain formatting elements should ideally always remain intact. Breaking a long link like `[structured data generation](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)` into `[structured` and `data generation](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data` destroys meaning. The splitter preserves these constructs and splits around them.

<img width="1261" height="214" alt="image" src="https://github.com/user-attachments/assets/c940d483-18b1-4cdf-9bfe-f758daf22456" />

[Comparison of chunk size 100: Chunkdown (left) / LangChain Markdown Splitter (right)](https://chunkdown.zirkelc.dev/?text=QUkgU0RLIENvcmUgaGFzIHZhcmlvdXMgZnVuY3Rpb25zIGRlc2lnbmVkIGZvciBbdGV4dCBnZW5lcmF0aW9uXSguL2dlbmVyYXRpbmctdGV4dCksIFtzdHJ1Y3R1cmVkIGRhdGEgZ2VuZXJhdGlvbl0oLi9nZW5lcmF0aW5nLXN0cnVjdHVyZWQtZGF0YSksIGFuZCBbdG9vbCB1c2FnZV0oLi90b29scy1hbmQtdG9vbC1jYWxsaW5nKS4KVGhlc2UgZnVuY3Rpb25zIHRha2UgYSBzdGFuZGFyZGl6ZWQgYXBwcm9hY2ggdG8gc2V0dGluZyB1cCBbcHJvbXB0c10oLi9wcm9tcHRzKSBhbmQgW3NldHRpbmdzXSguL3NldHRpbmdzKSwgbWFraW5nIGl0IGVhc2llciB0byB3b3JrIHdpdGggZGlmZmVyZW50IG1vZGVscy4%3D&tab=aiSdk&customSize=100&langchainSize=100&maxOverflow=1)

#### Allow Controlled Overflow

Preserving a complete semantic unit like a section, paragraph, sentence, etc., is often more important than adhering to a strict chunk size. The splitter allows a controlled overflow (via `maxOverflowRatio`) of the chunk size if it avoids splitting a complete unit, e.g. a list item.

<img width="1263" height="482" alt="image" src="https://github.com/user-attachments/assets/e16d23db-7bd8-443a-99a2-30839f216058" />

[Comparison of chunk size 200 with 1.5x overflow ratio: Chunkdown (left) / LangChain Markdown Splitter (right)](https://chunkdown.zirkelc.dev/?text=LSBbYGdlbmVyYXRlVGV4dGBdKC9kb2NzL2FpLXNkay1jb3JlL2dlbmVyYXRpbmctdGV4dCk6IEdlbmVyYXRlcyB0ZXh0IGFuZCBbdG9vbCBjYWxsc10oLi90b29scy1hbmQtdG9vbC1jYWxsaW5nKS4KICBUaGlzIGZ1bmN0aW9uIGlzIGlkZWFsIGZvciBub24taW50ZXJhY3RpdmUgdXNlIGNhc2VzIHN1Y2ggYXMgYXV0b21hdGlvbiB0YXNrcyB3aGVyZSB5b3UgbmVlZCB0byB3cml0ZSB0ZXh0IChlLmcuIGRyYWZ0aW5nIGVtYWlsIG9yIHN1bW1hcml6aW5nIHdlYiBwYWdlcykgYW5kIGZvciBhZ2VudHMgdGhhdCB1c2UgdG9vbHMuCi0gW2BzdHJlYW1UZXh0YF0oL2RvY3MvYWktc2RrLWNvcmUvZ2VuZXJhdGluZy10ZXh0KTogU3RyZWFtIHRleHQgYW5kIHRvb2wgY2FsbHMuCiAgWW91IGNhbiB1c2UgdGhlIGBzdHJlYW1UZXh0YCBmdW5jdGlvbiBmb3IgaW50ZXJhY3RpdmUgdXNlIGNhc2VzIHN1Y2ggYXMgW2NoYXQgYm90c10oL2RvY3MvYWktc2RrLXVpL2NoYXRib3QpIGFuZCBbY29udGVudCBzdHJlYW1pbmddKC9kb2NzL2FpLXNkay11aS9jb21wbGV0aW9uKS4KLSBbYGdlbmVyYXRlT2JqZWN0YF0oL2RvY3MvYWktc2RrLWNvcmUvZ2VuZXJhdGluZy1zdHJ1Y3R1cmVkLWRhdGEpOiBHZW5lcmF0ZXMgYSB0eXBlZCwgc3RydWN0dXJlZCBvYmplY3QgdGhhdCBtYXRjaGVzIGEgW1pvZF0oaHR0cHM6Ly96b2QuZGV2Lykgc2NoZW1hLgogIFlvdSBjYW4gdXNlIHRoaXMgZnVuY3Rpb24gdG8gZm9yY2UgdGhlIGxhbmd1YWdlIG1vZGVsIHRvIHJldHVybiBzdHJ1Y3R1cmVkIGRhdGEsIGUuZy4gZm9yIGluZm9ybWF0aW9uIGV4dHJhY3Rpb24sIHN5bnRoZXRpYyBkYXRhIGdlbmVyYXRpb24sIG9yIGNsYXNzaWZpY2F0aW9uIHRhc2tzLgotIFtgc3RyZWFtT2JqZWN0YF0oL2RvY3MvYWktc2RrLWNvcmUvZ2VuZXJhdGluZy1zdHJ1Y3R1cmVkLWRhdGEpOiBTdHJlYW0gYSBzdHJ1Y3R1cmVkIG9iamVjdCB0aGF0IG1hdGNoZXMgYSBab2Qgc2NoZW1hLgogIFlvdSBjYW4gdXNlIHRoaXMgZnVuY3Rpb24gdG8gW3N0cmVhbSBnZW5lcmF0ZWQgVUlzXSgvZG9jcy9haS1zZGstdWkvb2JqZWN0LWdlbmVyYXRpb24pLg%3D%3D&tab=aiSdk)


### Installation

```bash
npm install chunkdown
pnpm add chunkdown
bun add chunkdown
yarn add chunkdown
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

By default, links and images are never split to avoid breaking their semantic meaning. This keeps them together even if they exceed the chunk size.

```typescript
import { chunkdown } from 'chunkdown';

const text = `Please check out the [AI SDK Core API Reference](/docs/reference/ai-sdk-core) for more details on each function.`;

// Default: never split links and images
const splitter = chunkdown({
  chunkSize: 50,
});

const chunks = splitter.splitText(text);
// chunks[0]: "Please check out the [AI SDK Core API Reference](/docs/reference/ai-sdk-core)"
// chunks[1]: "for more details on each function."
```

#### Formatting

Formatting elements like **bold**, *italic*, and ~~strikethrough~~ can be configured to stay together or allow splitting. By default, they can be split.

```typescript
import { chunkdown } from 'chunkdown';

const text = `This is **a very long bold text that contains many words and exceeds the chunk size** in the middle.`;

// Default: allow splitting formatting
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

const chunksNeverSplit = splitter.splitText(text);
// chunks[0]: "This is"
// chunks[1]: "**a very long bold text that contains many words and exceeds the chunk size**"
// chunks[2]: "in the middle."
```

#### Markdown Normalization

Chunkdown normalizes markdown to consistent representations during parsing. This ensures uniform output regardless of input style variations.

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

#### Tables

When a table is split into multiple chunks, Chunkdown automatically preserves context by including the header row in each chunk. This ensures that data rows don't lose their meaning when separated from the original header.

> [!NOTE]
> The header row size is not counted when calculating chunk sizes. Only data row content is measured against the `chunkSize` limit.

```typescript
import { chunkdown } from 'chunkdown';

const splitter = chunkdown({
  chunkSize: 20,
  maxOverflowRatio: 1.0
});

const text = `
| Name     | Age | Country |
|----------|-----|---------|
| Alice    | 30  | USA     |
| Bob      | 25  | UK      |
| Charlie  | 35  | Canada  |
| David    | 40  | France  |
`;

const chunks = splitter.splitText(text);
// chunks[0]: 
// | Name  | Age | Country |
// | ----- | --- | ------- |
// | Alice | 30  | USA     |
// | Bob  | 25  | UK       |

// chunks[1]:
// | Name | Age | Country    |
// | ---- | --- | ---------- |
// | Charlie | 35  | Canada  |
// | David   | 40  | France  |
```

## API Reference

### `chunkdown(options: ChunkdownOptions)`

Creates a new markdown splitter instance.

#### Returns

An object with the following method:
- `splitText(text: string): string[]`: Splits the input markdown text into chunks

#### Options

##### `chunkSize: number` 

The target content size for each chunk, counting only content characters, not raw markdown.

##### `maxOverflowRatio?: number` (optional)

The maximum overflow ratio for preserving semantic units:
- `1.0`: strict chunk size, no overflow allowed
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

**Split rules:**

Each node type can have a `split` rule:

- `'never-split' | { rule: 'never-split' }`: Never split this element, regardless of size
- `'allow-split' | { rule: 'allow-split' }`: Allow splitting this element if it exceeds the chunk size
- `{ rule: 'size-split', size: number }`: Only split this element if its content size exceeds the specified size

**Examples:**

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
```

**Default rules:**

By default, links and images are set to never split to preserve semantic meaning:

```typescript
const defaultNodeRules: NodeRules = {
  link: { split: 'never-split' },
  image: { split: 'never-split' },
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

The chunk visualizer hosted at [chunkdown.zirkelc.dev](https://chunkdown.zirkelc.dev/) provides an interactive way to see how text is split into chunks:

<img width="1272" height="2167" alt="image" src="https://github.com/user-attachments/assets/84294851-0abe-4f23-acdd-9450af756b62" />

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

### Normalize Links and Images

Links and images can be inline or reference style:

```markdown
Inline style:
![alt text](image.jpg)
[link text](http://example.com)

Reference style:
![alt text][1]
[link text][2]

[1]: image.jpg
[2]: http://example.com
```

When splitting, the reference definitions can end up in a different chunk than the link/image usage, breaking the reference.
The splitter could normalize all links/images to inline style to preserve meaning.

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

### Remove Extra Long URLs

If a link's or image's URL is very long (e.g. > 2048 chars), it usually means it contains some kind of state. For example, an image could be have [data URL](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/data) of a base64 encoded image:

```markdown 
![alt text](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAoAAAAHgCAYAAAD0...)
```

This will create many useless chunks without any meaningful content.
The splitter could detect such URLs and remove them from the chunk, keeping only the alt text or link text.
