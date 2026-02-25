import { MarkdownTextSplitter as LangChainMarkdown } from '@langchain/textsplitters';
import chalk from 'chalk';
import { fromMarkdown } from '../markdown';
import { TextSplitter } from '../splitters/text';
import type { NodeRules } from '../types';
import { buildPositionMapping } from '../utils/plaintext-markdown-mapping';

/** Chalk color functions for chunk visualization */
const colors = [chalk.cyan, chalk.yellow, chalk.green, chalk.magenta, chalk.blue];

/** Consistent colors for each splitter (not in chunk colors) */
const chunkdown = chalk.whiteBright.bold(`▸ chunkdown`);
const langchain = chalk.red.bold(`▸ langchain`);

/**
 * Create visual representation of where splits occur.
 * Finds actual chunk positions in the original markdown by searching for each chunk.
 * Each chunk is colored differently, with dim `|` separators.
 */
function visualizeSplits(markdown: string, chunks: Array<string>): string {
  /** Find chunk boundaries */
  const boundaries: Array<{ start: number; end: number }> = [];
  let searchStart = 0;

  for (const chunk of chunks) {
    const idx = markdown.indexOf(chunk, searchStart);
    if (idx !== -1) {
      boundaries.push({ start: idx, end: idx + chunk.length });
      searchStart = idx + chunk.length;
    }
  }

  /** Build colored output */
  let result = ``;
  for (let i = 0; i < boundaries.length; i++) {
    const { start, end } = boundaries[i];
    const color = colors[i % colors.length];
    const chunkText = markdown.slice(start, end);

    result += color(chunkText);

    if (i < boundaries.length - 1) {
      result += chalk.dim(`|`);
    }
  }

  return result;
}

type Example = {
  name: string;
  text: string;
  chunkSize: number;
  rules?: Partial<NodeRules>;
};

const examples: Array<Example> = [
  {
    name: `Period after link`,
    text: `Check [API docs](https://api.example.com/v1). Next sentence here.`,
    chunkSize: 30,
  },
  {
    name: `Period inside brackets then link`,
    text: `Data (5–8 items).[See docs](https://example.com) for details.`,
    chunkSize: 25,
  },
  {
    name: `Multiple formatting with punctuation`,
    text: `The **config.json** file is important. Use \`api.call()\` for requests.`,
    chunkSize: 35,
  },
  {
    name: `URL with periods and colons`,
    text: `Visit [site](https://api.example.com:8080/v1.0/users). It works.`,
    chunkSize: 30,
  },
  {
    name: `Colon after link`,
    text: `See [documentation](https://docs.example.com): it explains everything.`,
    chunkSize: 40,
  },
  {
    name: `Question in URL vs real question`,
    text: `Check [search](https://example.com?q=test). Does it work?`,
    chunkSize: 30,
  },
  {
    name: `Bold with period inside`,
    text: `This is **important.** The next part follows.`,
    chunkSize: 25,
  },
  {
    name: `Italic with exclamation`,
    text: `This is *amazing!* You should try it.`,
    chunkSize: 20,
  },
  {
    name: `Bold-italic with question`,
    text: `Is this ***correct?*** Let me check.`,
    chunkSize: 22,
  },
  {
    name: `Inline code with period`,
    text: `Run \`npm.install\` first. Then continue.`,
    chunkSize: 22,
  },
  {
    name: `Multiple bold sections`,
    text: `The **first.** And **second.** Done.`,
    chunkSize: 18,
  },
  {
    name: `Nested formatting with period`,
    text: `Check **the *docs.*** Then proceed.`,
    chunkSize: 20,
  },
  {
    name: `LLM paragraph excerpt`,
    text: `Large Language Models (**LLMs**) are *neural networks*. The [transformer architecture](https://arxiv.org/abs/1706.03762) uses ***self-attention***. Models train on **billions of tokens**; the objective: predict next word.`,
    chunkSize: 50,
  },
  {
    name: `Technical documentation with mixed formatting`,
    text: `The **config.json** file contains *critical settings*. Set \`debug: true\` for verbose output. See [documentation](https://docs.example.com/config) for details. Warning: **never** commit secrets! Use \`process.env.API_KEY\` instead. The *recommended* approach: store in \`.env\` files.`,
    chunkSize: 60,
  },
  {
    name: `Multiple sentences with links and formatting`,
    text: `AI SDK Core **simplifies working with LLMs**. It offers a [standardized API](https://ai-sdk.dev/docs/api). The \`generateText\` function handles *text generation*. Use \`streamText\` for **real-time** responses. Check the [examples](https://github.com/ai-sdk/examples) repository. Questions? Visit our [Discord](https://discord.gg/ai-sdk).`,
    chunkSize: 70,
  },
  {
    name: `Nested formatting with punctuation throughout`,
    text: `This is **very *important* information.** Don't ignore it! The ***critical*** point: always validate input. Here's why: **security matters.** See \`validateInput()\` for details. Is this ***absolutely*** necessary? Yes!`,
    chunkSize: 50,
  },
  {
    name: `Long paragraph with inline code and links`,
    text: `First, install the package with \`npm install ai-sdk\`. Then import \`generateText\` from the library. Configure your [API key](https://platform.openai.com/api-keys) in the environment. Call \`generateText({ model: "gpt-4" })\` to start. The response includes \`text\`, \`usage\`, and \`finishReason\`. For streaming, use \`streamText()\` instead. See [streaming docs](https://ai-sdk.dev/streaming).`,
    chunkSize: 80,
  },
  {
    name: `Dense formatting - many bold and italic sections`,
    text: `The **first** step is *crucial*. Then the **second** becomes *important*. After that, the **third** is *essential*. Finally, the **fourth** proves *vital*. Each **phase** requires *attention*. Don't skip **any** of these *steps*!`,
    chunkSize: 45,
  },
  {
    name: `Wikipedia-style with citations`,
    text: `The **llama** ([/ˈlɑːmə/](https://en.wikipedia.org/wiki/Help:IPA)) is a *domesticated* South American camelid.[[1]](https://example.com/ref1) It has been used as a **pack animal** for centuries.[[2]](https://example.com/ref2) The species (*Lama glama*) belongs to the family **Camelidae**.[[3]](https://example.com/ref3)`,
    chunkSize: 80,
  },
  {
    name: `Code tutorial with explanations`,
    text: `Start by creating a **new file** called \`index.ts\`. Import the *required* modules: \`import { chunkdown } from 'chunkdown'\`. Create a **splitter instance**: \`const splitter = chunkdown({ chunkSize: 500 })\`. Now call \`splitter.split(text)\` on your **markdown content**. The result contains *chunks* with breadcrumbs. Each chunk has \`text\` and \`breadcrumbs\` properties.`,
    chunkSize: 70,
  },
  {
    name: `Link text with period (e.g. domain name)`,
    text: `Visit [example.com](https://example.com) for more info. Then check it.`,
    chunkSize: 25,
  },
  {
    name: `Link text with multiple periods`,
    text: `See [docs.api.example.com](https://docs.api.example.com) for the API reference.`,
    chunkSize: 30,
  },
  {
    name: `Link with sentence-like text`,
    text: `Read [Chapter 1. Introduction](https://book.com/ch1) first. Then continue.`,
    chunkSize: 35,
  },
  {
    name: `Link with question in text`,
    text: `Check [Is this correct?](https://example.com/faq) for answers. More here.`,
    chunkSize: 30,
  },
  {
    name: `Link with exclamation in text`,
    text: `See [Warning! Important info](https://example.com/warn) now. Don't skip.`,
    chunkSize: 35,
  },
  {
    name: `Link with colon in text`,
    text: `Read [Note: this matters](https://example.com/note) carefully. Very important.`,
    chunkSize: 30,
  },
  {
    name: `Multiple links with periods in text`,
    text: `Visit [site.one](https://one.com) and [site.two](https://two.com) and [site.three](https://three.com) for details.`,
    chunkSize: 40,
  },
  {
    name: `Link with period (PROTECTED)`,
    text: `Visit [example.com](https://example.com) for more info. Then check it.`,
    chunkSize: 25,
    rules: { link: { split: `never-split` } },
  },
];

(async () => {
  console.log(`\n${'='.repeat(80)}`);
  console.log(chalk.bold(`COMPARING CHUNKDOWN vs LANGCHAIN TEXT SPLITTER`));
  console.log(`${'='.repeat(80)}\n`);

  let diffCount = 0;

  for (let exampleIdx = 0; exampleIdx < examples.length; exampleIdx++) {
    const example = examples[exampleIdx];
    const chunkdownSplitter = new TextSplitter({
      chunkSize: example.chunkSize,
      maxOverflowRatio: 1.0,
      rules: example.rules,
    });

    const langchainSplitter = new LangChainMarkdown({
      chunkSize: example.chunkSize,
      chunkOverlap: 0,
    });

    const chunkdownChunks = chunkdownSplitter.splitText(example.text);
    const langchainChunks = await langchainSplitter.splitText(example.text);

    const isDifferent = JSON.stringify(chunkdownChunks) !== JSON.stringify(langchainChunks);

    if (isDifferent) diffCount++;

    /** Build position mapping for plain text extraction */
    const ast = fromMarkdown(example.text);
    const mapping = buildPositionMapping(ast, example.text);

    console.log(`${'─'.repeat(80)}`);
    console.log(`${chalk.bold(`#${exampleIdx} ${example.name}`)} ${chalk.dim(`(chunkSize: ${example.chunkSize})`)}`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`${chalk.dim(`Markdown (${example.text.length}):`)} ${example.text}`);
    console.log(`${chalk.dim(`Plain (${mapping.plain.length}):`)} ${mapping.plain}`);
    console.log(``);

    /** Show visual splits */
    console.log(chalk.dim(`Splits:`));
    console.log(`  ${chunkdown} ${visualizeSplits(example.text, chunkdownChunks)}`);
    console.log(`  ${langchain} ${visualizeSplits(example.text, langchainChunks)}`);
    console.log(``);

    /** Show chunks */
    console.log(chalk.dim(`Chunks:`));
    console.log(`  ${chunkdown} ${chalk.dim(`(${chunkdownChunks.length})`)}`);
    for (let i = 0; i < chunkdownChunks.length; i++) {
      const color = colors[i % colors.length];
      console.log(`    ${color(`[${i}] ${chunkdownChunks[i]}`)}`);
    }
    console.log(``);
    console.log(`  ${langchain} ${chalk.dim(`(${langchainChunks.length})`)}`);
    for (let i = 0; i < langchainChunks.length; i++) {
      const color = colors[i % colors.length];
      console.log(`    ${color(`[${i}] ${langchainChunks[i]}`)}`);
    }

    /** Show segment mapping */
    console.log(``);
    console.log(chalk.dim(`Mapping:`));
    for (const segment of mapping.segments) {
      const plainSlice = mapping.plain.slice(segment.plainStart, segment.plainEnd);
      /** Use node boundaries if available, otherwise fall back to md boundaries */
      const elementStart = segment.nodeStart ?? segment.mdStart;
      const elementEnd = segment.nodeEnd ?? segment.mdEnd;
      const mdElement = example.text.slice(elementStart, elementEnd);
      console.log(
        `  ${chalk.dim(`[${segment.plainStart}-${segment.plainEnd}]`)} ${plainSlice} ${chalk.dim(`→ [${elementStart}-${elementEnd}]`)} ${mdElement}`,
      );
    }

    console.log(``);
  }

  console.log(`${'='.repeat(80)}`);
  console.log(chalk.bold(`SUMMARY`));
  console.log(`${'='.repeat(80)}`);

  console.log(`\n${chalk.dim(`Total examples:`)} ${examples.length}`);
  console.log(
    `${chunkdown} vs ${langchain}: ${chalk.bold(diffCount)} different, ${chalk.bold(examples.length - diffCount)} same`,
  );
  console.log(``);
})();
