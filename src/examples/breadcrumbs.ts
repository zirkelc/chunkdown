import { chunkdown } from 'chunkdown';

const text = `
Large Language Models (LLMs) are advanced programs that understand and generate human language.

# AI SDK Core

The AI SDK simplifies working with LLMs by offering a standardized API.

## Text Generation

Generate text using various models.

### Structured Output

Use generateObject to get typed responses matching a schema.
`;

const splitter = chunkdown({ chunkSize: 100 });
const { chunks } = splitter.split(text);

console.dir(chunks, { depth: null });
