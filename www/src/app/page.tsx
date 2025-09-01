'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import ASTVisualizer from '../components/ASTVisualizer';
import ChunkVisualizer from '../components/ChunkVisualizer';

const exampleTexts = {
  aiSdk: `# AI SDK Core

Large Language Models (LLMs) are advanced programs that can understand, create, and engage with human language on a large scale.
They are trained on vast amounts of written material to recognize patterns in language and predict what might come next in a given piece of text.

AI SDK Core **simplifies working with LLMs by offering a standardized way of integrating them into your app** - so you can focus on building great AI applications for your users, not waste time on technical details.

For example, here’s how you can generate text with various models using the AI SDK:

<PreviewSwitchProviders />

## AI SDK Core Functions

AI SDK Core has various functions designed for [text generation](./generating-text), [structured data generation](./generating-structured-data), and [tool usage](./tools-and-tool-calling).
These functions take a standardized approach to setting up [prompts](./prompts) and [settings](./settings), making it easier to work with different models.

- [\`generateText\`](/docs/ai-sdk-core/generating-text): Generates text and [tool calls](./tools-and-tool-calling).
  This function is ideal for non-interactive use cases such as automation tasks where you need to write text (e.g. drafting email or summarizing web pages) and for agents that use tools.
- [\`streamText\`](/docs/ai-sdk-core/generating-text): Stream text and tool calls.
  You can use the \`streamText\` function for interactive use cases such as [chat bots](/docs/ai-sdk-ui/chatbot) and [content streaming](/docs/ai-sdk-ui/completion).
- [\`generateObject\`](/docs/ai-sdk-core/generating-structured-data): Generates a typed, structured object that matches a [Zod](https://zod.dev/) schema.
  You can use this function to force the language model to return structured data, e.g. for information extraction, synthetic data generation, or classification tasks.
- [\`streamObject\`](/docs/ai-sdk-core/generating-structured-data): Stream a structured object that matches a Zod schema.
  You can use this function to [stream generated UIs](/docs/ai-sdk-ui/object-generation).

## API Reference

Please check out the [AI SDK Core API Reference](/docs/reference/ai-sdk-core) for more details on each function.`,

  lama: `The **llama** ([/ˈlɑːmə/](https://en.wikipedia.org/wiki/Help:IPA/English "Help:IPA/English"); Spanish pronunciation: [\[ˈʎama\]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish") or [\[ˈʝama\]](https://en.wikipedia.org/wiki/Help:IPA/Spanish "Help:IPA/Spanish")) (_**Lama glama**_) is a domesticated [South American](https://en.wikipedia.org/wiki/South_America "South America") [camelid](https://en.wikipedia.org/wiki/Camelid "Camelid"), widely used as a [meat](https://en.wikipedia.org/wiki/List_of_meat_animals "List of meat animals") and [pack animal](https://en.wikipedia.org/wiki/Pack_animal "Pack animal") by [Andean cultures](https://en.wikipedia.org/wiki/Inca_empire "Inca empire") since the [pre-Columbian era](https://en.wikipedia.org/wiki/Pre-Columbian_era "Pre-Columbian era").

Llamas are social animals and live with others as a [herd](https://en.wikipedia.org/wiki/Herd "Herd"). Their [wool](https://en.wikipedia.org/wiki/Wool "Wool") is soft and contains only a small amount of [lanolin](https://en.wikipedia.org/wiki/Lanolin "Lanolin").[\[2\]](https://en.wikipedia.org/wiki/Llama#cite_note-2) Llamas can learn simple tasks after a few repetitions. When using a pack, they can carry about 25 to 30% of their body weight for 8 to 13 [km](https://en.wikipedia.org/wiki/Kilometre "Kilometre") (5–8 [miles](https://en.wikipedia.org/wiki/Mile "Mile")).[\[3\]](https://en.wikipedia.org/wiki/Llama#cite_note-OK_State-3) The name _llama_ (also historically spelled "lama" or "glama") was adopted by [European settlers](https://en.wikipedia.org/wiki/European_colonization_of_the_Americas "European colonization of the Americas") from [native Peruvians](https://en.wikipedia.org/wiki/Indigenous_people_in_Peru "Indigenous people in Peru").[\[4\]](https://en.wikipedia.org/wiki/Llama#cite_note-4)`,

  markdown: `# Markdown Showcase

This document demonstrates all markdown elements and their various syntax flavors.

## Headings

# H1 Heading
## H2 Heading
### H3 Heading
#### H4 Heading
##### H5 Heading
###### H6 Heading

Alternative H1 (Setext)
=======================

Alternative H2 (Setext)
-----------------------

## Text Formatting

**Bold text with asterisks** and __bold text with underscores__

*Italic text with asterisks* and _italic text with underscores_

***Bold and italic*** and ___bold and italic___

~~Strikethrough text~~

\`Inline code\` with backticks

## Lists

### Unordered Lists (3 variants)

- Item 1 with dash
- Item 2 with dash
  - Nested item
  - Another nested item

* Item 1 with asterisk
* Item 2 with asterisk
  * Nested item
  * Another nested item

+ Item 1 with plus
+ Item 2 with plus
  + Nested item
  + Another nested item

### Ordered Lists

1. First item
2. Second item
   1. Nested ordered item
   2. Another nested item
3. Third item

### Task Lists (GFM)

- [x] Completed task
- [ ] Incomplete task
- [x] Another completed task

## Links and Images

[Regular link](https://example.com)

[Link with title](https://example.com "This is a title")

<https://autolink.com>

![Image alt text](https://via.placeholder.com/150 "Image title")

![Image without title](https://via.placeholder.com/100)

Reference-style [link][1] and [another link][reference].

[1]: https://example.com
[reference]: https://example.com "Reference with title"

## Code Blocks

### Fenced Code Blocks

\`\`\`javascript
function hello() {
  console.log("Hello, world!");
  return true;
}
\`\`\`

\`\`\`python
def hello():
    print("Hello, world!")
    return True
\`\`\`

\`\`\`
Code block without language
\`\`\`

### Indented Code Blocks

    function indentedCode() {
        return "This is indented code";
    }

## Tables (GFM)

| Left Aligned | Center Aligned | Right Aligned |
|:-------------|:--------------:|--------------:|
| Cell 1       | Cell 2         | Cell 3        |
| Long cell    | Short          | 123           |

| Command | Description |
| --- | --- |
| git status | Show working tree status |
| git diff | Show changes between commits |

## Blockquotes

> Simple blockquote
>
> Multiple lines in blockquote

> ### Blockquote with heading
>
> **Bold text** in blockquote
>
> 1. Ordered list in blockquote
> 2. Another item

> Nested blockquotes
>
> > This is nested
> >
> > > And this is deeply nested

## Horizontal Rules (3 variants)

---

***

___

## Line Breaks

Line with two spaces at end
Creates a line break

Line with backslash\\
Also creates a line break

## HTML Elements

<div>Raw HTML div</div>

<strong>HTML strong tag</strong>

<em>HTML emphasis tag</em>

<!-- HTML comment -->

## Escape Characters

\\* Not italic \\*

\\_ Not italic \\_

\\# Not a heading

\\[Not a link\\](not-a-url)

## Special Characters and Entities

&copy; &amp; &lt; &gt; &quot; &#39;

## Mixed Complex Examples

This paragraph contains **bold**, *italic*, ~~strikethrough~~, and \`inline code\`. It also has a [link](https://example.com) and an ![image](https://via.placeholder.com/16).

### Complex List Example

1. First item with **bold text**
   - Nested unordered item with *italic*
   - Another nested item with \`code\`
   - [ ] Task item in nested list
   - [x] Completed task
2. Second item with [link](https://example.com)
   \`\`\`javascript
   // Code block in list item
   const example = true;
   \`\`\`
3. Third item with blockquote:
   > This is a blockquote inside a list item
   > with multiple lines

### Table with Complex Content

| Element | Syntax Variants | Example |
|---------|----------------|---------|
| Bold | \`**text**\` or \`__text__\` | **bold** and __bold__ |
| Italic | \`*text*\` or \`_text_\` | *italic* and _italic_ |
| Code | \`\\\`text\\\`\` | \`code\` |
| Link | \`[text](url)\` | [example](https://example.com) |

## Edge Cases

Empty lines:



Multiple spaces:     (5 spaces)

Trailing spaces:

Mixed formatting: ***Really*** important **and *nested* formatting**

Autolinks: https://example.com and email@example.com

Footnotes (if supported):
Here's a sentence with a footnote[^1].

[^1]: This is the footnote content.

---

*This document showcases most markdown elements and syntax variations.*`,
};

const tabs = [
  {
    id: 'aiSdk',
    label: 'AI SDK Core',
    description: 'API documentation',
  },
  { id: 'lama', label: 'Llama', description: 'Markdown content about llamas' },
  { id: 'markdown', label: 'Markdown', description: 'Markdown content' },
];

// Helper functions for URL state
const encodeText = (text: string) => {
  try {
    return btoa(unescape(encodeURIComponent(text)));
  } catch {
    return '';
  }
};

const decodeText = (encoded: string) => {
  try {
    return decodeURIComponent(escape(atob(encoded)));
  } catch {
    return '';
  }
};

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] =
    useState<keyof typeof exampleTexts>('aiSdk');
  const [texts, setTexts] = useState(exampleTexts);
  const [customChunkSize, setCustomChunkSize] = useState(200);
  const [langchainChunkSize, setLangchainChunkSize] = useState(200);
  const [syncChunkSizes, setSyncChunkSizes] = useState(true);
  const [astCollapsed, setAstCollapsed] = useState(false);
  const [maxOverflowRatio, setMaxOverflowRatio] = useState(1.5);
  const [langchainSplitterType, setLangchainSplitterType] = useState<
    'markdown' | 'character' | 'sentence'
  >('markdown');
  const [isInitialized, setIsInitialized] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    visible: boolean;
  }>({ message: '', visible: false });

  // Debounce timer for text updates
  const [textUpdateTimer, setTextUpdateTimer] = useState<NodeJS.Timeout | null>(
    null,
  );

  // Load state from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    // Load tab first
    const tab = params.get('tab');
    if (tab && tabs.some((t) => t.id === tab)) {
      setActiveTab(tab as keyof typeof exampleTexts);
    }

    // Load text and apply to current tab
    const encodedText = params.get('text');
    if (encodedText) {
      const decodedText = decodeText(encodedText);
      if (decodedText) {
        const currentTab = (tab || 'aiSdk') as keyof typeof exampleTexts;
        setTexts((prev) => ({ ...prev, [currentTab]: decodedText }));
      }
    }

    // Load chunk sizes
    const customSize = params.get('customSize');
    if (customSize) {
      const size = parseInt(customSize, 10);
      if (!isNaN(size) && size >= 1 && size <= 2000) {
        setCustomChunkSize(size);
      }
    }

    const langchainSize = params.get('langchainSize');
    if (langchainSize) {
      const size = parseInt(langchainSize, 10);
      if (!isNaN(size) && size >= 1 && size <= 2000) {
        setLangchainChunkSize(size);
      }
    }

    // Load AST collapsed state
    const collapsed = params.get('astCollapsed');
    setAstCollapsed(collapsed === 'true');

    // Load max overflow ratio
    const overflow = params.get('maxOverflow');
    if (overflow) {
      const ratio = parseFloat(overflow);
      if (!isNaN(ratio) && ratio >= 1.0 && ratio <= 3.0) {
        setMaxOverflowRatio(ratio);
      }
    }

    // Load LangChain splitter type
    const langchainType = params.get('langchainType');
    if (
      langchainType &&
      ['markdown', 'character', 'sentence'].includes(langchainType)
    ) {
      setLangchainSplitterType(
        langchainType as 'markdown' | 'character' | 'sentence',
      );
    }

    // Load sync state
    const syncDisabled = params.get('syncDisabled');
    setSyncChunkSizes(syncDisabled !== 'true');

    setIsInitialized(true);
  }, [searchParams]);

  // Update URL when state changes
  const updateURL = useCallback(() => {
    if (!isInitialized) return;

    const params = new URLSearchParams();

    // Always encode the current active text
    const currentText = texts[activeTab];
    if (currentText) {
      params.set('text', encodeText(currentText));
    }

    // Store the tab
    params.set('tab', activeTab);

    if (customChunkSize !== 200) {
      params.set('customSize', customChunkSize.toString());
    }

    if (langchainChunkSize !== 200) {
      params.set('langchainSize', langchainChunkSize.toString());
    }

    if (astCollapsed) {
      params.set('astCollapsed', 'true');
    }

    if (maxOverflowRatio !== 1.5) {
      params.set('maxOverflow', maxOverflowRatio.toString());
    }

    if (langchainSplitterType !== 'markdown') {
      params.set('langchainType', langchainSplitterType);
    }

    if (!syncChunkSizes) {
      params.set('syncDisabled', 'true');
    }

    const newUrl = params.toString() ? `?${params.toString()}` : '/';
    router.replace(newUrl, { scroll: false });
  }, [
    activeTab,
    texts,
    customChunkSize,
    langchainChunkSize,
    syncChunkSizes,
    astCollapsed,
    maxOverflowRatio,
    langchainSplitterType,
    isInitialized,
    router,
  ]);

  // Update URL when state changes (with debouncing for text)
  useEffect(() => {
    if (!isInitialized) return;

    // Always debounce text updates
    const timer = setTimeout(() => {
      updateURL();
    }, 500);

    setTextUpdateTimer((prevTimer) => {
      if (prevTimer) {
        clearTimeout(prevTimer);
      }
      return timer;
    });

    return () => {
      clearTimeout(timer);
    };
  }, [isInitialized, updateURL]);

  const updateText = (tabId: keyof typeof exampleTexts, newText: string) => {
    setTexts((prev) => ({ ...prev, [tabId]: newText }));
  };

  // Handle chunk size changes - breaks sync when values differ
  const handleCustomChunkSizeChange = (value: number) => {
    setCustomChunkSize(value);
    if (syncChunkSizes) {
      setLangchainChunkSize(value);
    } else {
      // Break sync if values become different
      if (value !== langchainChunkSize) {
        setSyncChunkSizes(false);
      }
    }
  };

  const handleLangchainChunkSizeChange = (value: number) => {
    setLangchainChunkSize(value);
    if (syncChunkSizes) {
      setCustomChunkSize(value);
    } else {
      // Break sync if values become different
      if (value !== customChunkSize) {
        setSyncChunkSizes(false);
      }
    }
  };

  // Toggle sync function - enables sync (averaging values) or disables it
  const handleSync = () => {
    if (!syncChunkSizes) {
      // Enable sync - average the two values
      const avgValue = Math.round((customChunkSize + langchainChunkSize) / 2);
      setCustomChunkSize(avgValue);
      setLangchainChunkSize(avgValue);
      setSyncChunkSizes(true);
    } else {
      // Disable sync - switch to override mode
      setSyncChunkSizes(false);
    }
  };

  const activeText = texts[activeTab];

  // Share functionality
  const handleShare = async () => {
    try {
      const currentUrl = window.location.href;
      await navigator.clipboard.writeText(currentUrl);

      setToast({ message: 'URL copied to clipboard!', visible: true });

      // Hide toast after 3 seconds
      setTimeout(() => {
        setToast({ message: '', visible: false });
      }, 3000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
      setToast({ message: 'Failed to copy URL', visible: true });

      setTimeout(() => {
        setToast({ message: '', visible: false });
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 font-mono">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8 relative">
          <h1 className="text-4xl font-bold mb-2 text-black">
            Chunk Visualizer
          </h1>
          <p className="text-black">
            Visual comparison of chunks created by{' '}
            <a
              href="https://www.npmjs.com/package/chunkdown"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline font-mono"
            >
              chunkdown
            </a>{' '}
            and LangChain's{' '}
            <a
              href="https://www.npmjs.com/package/@langchain/textsplitters"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline font-mono"
            >
              @langchain/textsplitters
            </a>{' '}
            library
          </p>

          {/* Share Button */}
          <button
            onClick={handleShare}
            type="button"
            title="Copy shareable URL to clipboard"
            className="absolute top-0 right-0 flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
              />
            </svg>
            <span className="text-sm font-medium">Share</span>
          </button>
        </div>

        {/* Input Section with AST Visualization */}
        <div className="mb-8">
          {/* Tab Navigation */}
          <div className="flex space-x-1 mb-4 bg-white p-1 rounded-lg border">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() =>
                  setActiveTab(tab.id as keyof typeof exampleTexts)
                }
                className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-500 text-white'
                    : 'text-black hover:bg-gray-100'
                }`}
                title={tab.description}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Two column layout: Textarea and AST */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Textarea */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="text-input"
                  className="text-sm font-bold text-black"
                >
                  Input Text
                </label>
              </div>
              <textarea
                id="text-input"
                value={activeText}
                onChange={(e) => updateText(activeTab, e.target.value)}
                className="w-full h-[500px] p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm text-black"
                placeholder="Enter your text here..."
              />
            </div>

            {/* AST Visualization */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="ast-view-mode"
                    className="text-sm font-bold text-black"
                  >
                    Markdown AST
                  </label>
                  <button
                    onClick={() => setAstCollapsed(!astCollapsed)}
                    type="button"
                    title={astCollapsed ? 'Expand tree' : 'Collapse tree'}
                    className="w-4 h-4 text-gray-500 hover:text-gray-700 flex items-center justify-center"
                  >
                    {astCollapsed ? '+' : '−'}
                  </button>
                </div>
              </div>
              <div className="h-[500px]">
                <ASTVisualizer
                  text={activeText}
                  collapseAll={astCollapsed}
                  onCollapseAllChange={setAstCollapsed}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Controls Section */}
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative">
            {/* Sync control positioned between the sliders */}
            <div className="absolute left-1/2 transform -translate-x-1/2 top-[65px] lg:block hidden z-10">
              {/* Sync Button */}
              <button
                onClick={handleSync}
                type="button"
                title={
                  syncChunkSizes
                    ? 'Click to unsync chunk sizes'
                    : 'Click to sync chunk sizes'
                }
                className={`mx-3 p-1.5 rounded-full transition-all duration-200 ${
                  syncChunkSizes
                    ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-md'
                    : 'bg-white text-gray-400 hover:text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </button>
            </div>

            {/* Left Controls */}
            <div>
              <h3 className="text-lg font-bold mb-3 text-black">chunkdown</h3>
              <div className="mb-4">
                {/* Chunk Size Control */}
                <div className="mb-3">
                  <label
                    htmlFor="chunk-size-custom"
                    className="block text-sm font-medium mb-1 text-black"
                  >
                    Chunk Size: {customChunkSize}
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      id="chunk-size-custom"
                      type="range"
                      min="1"
                      max="2000"
                      value={customChunkSize}
                      onChange={(e) =>
                        handleCustomChunkSizeChange(Number(e.target.value))
                      }
                      className={`flex-1 h-2 rounded-lg appearance-none cursor-pointer slider transition-colors duration-200 ${
                        syncChunkSizes ? 'bg-blue-100' : 'bg-gray-200'
                      }`}
                    />
                    <input
                      type="number"
                      min="1"
                      max="2000"
                      value={customChunkSize}
                      onChange={(e) =>
                        handleCustomChunkSizeChange(Number(e.target.value))
                      }
                      className="w-16 px-1 py-1 border border-gray-300 rounded text-xs text-black bg-white"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-black">
                    <span>1</span>
                    <span>2000</span>
                  </div>
                </div>

                {/* Max Overflow Ratio Control */}
                <div className="mb-3">
                  <label
                    htmlFor="max-overflow-custom"
                    className="block text-sm font-medium mb-1 text-black"
                  >
                    Max Overflow Ratio: {maxOverflowRatio}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="max-overflow-custom"
                      type="range"
                      min="1.0"
                      max="3.0"
                      step="0.1"
                      value={maxOverflowRatio}
                      onChange={(e) =>
                        setMaxOverflowRatio(Number(e.target.value))
                      }
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <input
                      type="number"
                      min="1.0"
                      max="3.0"
                      step="0.1"
                      value={maxOverflowRatio}
                      onChange={(e) =>
                        setMaxOverflowRatio(Number(e.target.value))
                      }
                      className="w-16 px-1 py-1 border border-gray-300 rounded text-xs text-black bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Controls */}
            <div>
              <h3 className="text-lg font-bold mb-3 text-black">
                @langchain/textsplitters
              </h3>
              <div className="mb-4">
                {/* Chunk Size Control */}
                <div className="mb-3">
                  <label
                    htmlFor="chunk-size-langchain"
                    className="block text-sm font-medium mb-1 text-black"
                  >
                    Chunk Size: {langchainChunkSize}
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      id="chunk-size-langchain"
                      type="range"
                      min="1"
                      max="2000"
                      value={langchainChunkSize}
                      onChange={(e) =>
                        handleLangchainChunkSizeChange(Number(e.target.value))
                      }
                      className={`flex-1 h-2 rounded-lg appearance-none cursor-pointer slider transition-colors duration-200 ${
                        syncChunkSizes ? 'bg-blue-100' : 'bg-gray-200'
                      }`}
                    />
                    <input
                      type="number"
                      min="1"
                      max="2000"
                      value={langchainChunkSize}
                      onChange={(e) =>
                        handleLangchainChunkSizeChange(Number(e.target.value))
                      }
                      className="w-16 px-1 py-1 border border-gray-300 rounded text-xs text-black bg-white"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-black">
                    <span>1</span>
                    <span>2000</span>
                  </div>
                </div>

                {/* LangChain Splitter Type Selection */}
                <div className="mb-3">
                  <label
                    htmlFor="langchain-type"
                    className="block text-sm font-medium mb-1 text-black"
                  >
                    Splitter Type
                  </label>
                  <select
                    id="langchain-type"
                    value={langchainSplitterType}
                    onChange={(e) =>
                      setLangchainSplitterType(
                        e.target.value as 'markdown' | 'character' | 'sentence',
                      )
                    }
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-black bg-white"
                  >
                    <option value="markdown">Markdown</option>
                    <option value="character">Character</option>
                    <option value="sentence">Sentence</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Visualization Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ChunkVisualizer
            text={activeText}
            chunkSize={customChunkSize}
            splitterType="markdown"
            maxOverflowRatio={maxOverflowRatio}
          />
          <ChunkVisualizer
            text={activeText}
            chunkSize={langchainChunkSize}
            splitterType="langchain-markdown"
            langchainSplitterType={langchainSplitterType}
          />
        </div>

        {/* Toast Notification */}
        {toast.visible && (
          <div className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-300 ease-in-out">
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 py-8 font-mono">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-2 text-black">
                Chunk Visualizer
              </h1>
              <p className="text-black">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
