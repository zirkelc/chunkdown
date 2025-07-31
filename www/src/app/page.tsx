'use client';

import React, { useState } from 'react';
import ChunkVisualizer from '../components/ChunkVisualizer';
import ASTVisualizer from '../components/ASTVisualizer';

const exampleTexts = {
  custom: `One of the most important things I didn't understand about the world when I was a child is the degree to which the returns for performance are superlinear.

Teachers and coaches implicitly told us the returns were linear. "You get out," I heard a thousand times, "what you put in." They meant well, but this is rarely true. If your product is only half as good as your competitor's, you don't get half as many customers. You get no customers, and you go out of business.

It's obviously true that the returns for performance are superlinear in business. Some think this is a flaw of capitalism, and that if we changed the rules it would stop being true. But superlinear returns for performance are a feature of the world, not an artifact of rules we've invented. We see the same pattern in fame, power, military victories, knowledge, and even benefit to humanity. In all of these, the rich get richer.`,

  technical: `# AI SDK Core

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

  blog: `# The Future of Remote Work: Lessons from the Pandemic

The COVID-19 pandemic fundamentally changed how we think about work. What started as an emergency measure became a **permanent shift** for millions of workers worldwide.

## Key Changes We've Observed

### 1. Technology Adoption
Companies that previously resisted digital transformation were forced to adapt overnight. Video conferencing, collaborative tools, and cloud-based systems became essential infrastructure.

### 2. Work-Life Balance
Remote work offered many employees better work-life balance, but it also blurred the boundaries between personal and professional time. The concept of "being always on" became a real challenge.

### 3. Geographic Freedom
*Location independence* opened new opportunities for both employees and employers:
- Access to global talent pools
- Reduced overhead costs
- Environmental benefits from reduced commuting

## Challenges and Solutions

Despite the benefits, remote work isn't without challenges:

1. **Communication gaps** - Solved through structured check-ins and better documentation
2. **Social isolation** - Addressed with virtual team building and hybrid schedules  
3. **Productivity concerns** - Managed through outcome-based performance metrics

## Looking Forward

As we move beyond the pandemic, the future likely holds a hybrid model that combines the best of both worlds. Companies that embrace flexibility while maintaining strong culture and communication will thrive in this new landscape.

The remote work revolution isn't just about where we work—it's about *how* we work, and that transformation is here to stay.`,

  academic: `# Abstract

This paper examines the impact of machine learning algorithms on natural language processing tasks, with particular focus on transformer architectures and their applications in text classification, sentiment analysis, and language generation. Our experiments demonstrate significant improvements in accuracy compared to traditional approaches.

## 1. Introduction

Natural Language Processing (NLP) has undergone rapid transformation in recent years, driven primarily by advances in deep learning and the availability of large-scale datasets. The introduction of attention mechanisms (Vaswani et al., 2017) and subsequently transformer-based models has revolutionized the field.

## 2. Related Work

### 2.1 Traditional Approaches
Early NLP systems relied heavily on rule-based methods and statistical models. Hidden Markov Models (HMMs) and Support Vector Machines (SVMs) were commonly used for tasks such as part-of-speech tagging and document classification.

### 2.2 Deep Learning Era
The adoption of neural networks, particularly Recurrent Neural Networks (RNNs) and Long Short-Term Memory (LSTM) networks, marked a significant shift in NLP methodology. However, these approaches suffered from limitations in handling long sequences and parallel processing.

## 3. Methodology

Our experimental setup consists of three primary components:

1. **Data Collection**: We collected a corpus of 100,000 documents from various domains
2. **Preprocessing**: Text normalization, tokenization, and feature extraction
3. **Model Training**: Implementation of baseline and transformer models

### 3.1 Evaluation Metrics
We employ standard evaluation metrics including precision, recall, F1-score, and accuracy. Statistical significance is tested using paired t-tests with α = 0.05.

## 4. Results and Discussion

The transformer-based models demonstrated superior performance across all evaluated tasks, with an average improvement of 15.3% in F1-score compared to traditional methods.

## References

Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., ... & Polosukhin, I. (2017). Attention is all you need. Advances in neural information processing systems, 30.`,

  code: `/**
 * TextSplitter - A utility class for splitting text into chunks
 * Supports various splitting strategies and customizable parameters
 */
class TextSplitter {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 1000;
    this.overlap = options.overlap || 100;
    this.separators = options.separators || ['\\n\\n', '\\n', ' ', ''];
  }

  /**
   * Split text into chunks using the configured strategy
   * @param {string} text - The input text to split
   * @returns {Array<string>} - Array of text chunks
   */
  splitText(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('Input must be a non-empty string');
    }

    const chunks = [];
    let currentChunk = '';
    
    // Split by paragraphs first
    const paragraphs = text.split('\\n\\n');
    
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length <= this.chunkSize) {
        currentChunk += (currentChunk ? '\\n\\n' : '') + paragraph;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        
        // Handle oversized paragraphs
        if (paragraph.length > this.chunkSize) {
          const subChunks = this._splitLongText(paragraph);
          chunks.push(...subChunks);
          currentChunk = '';
        } else {
          currentChunk = paragraph;
        }
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return this._addOverlap(chunks);
  }

  /**
   * Split text that exceeds chunk size
   * @private
   * @param {string} text - Text to split
   * @returns {Array<string>} - Split chunks
   */
  _splitLongText(text) {
    const chunks = [];
    const sentences = text.split(/(?<=[.!?])\\s+/);
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length <= this.chunkSize) {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = sentence;
      }
    }
    
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  }

  /**
   * Add overlap between chunks for better context preservation
   * @private
   * @param {Array<string>} chunks - Input chunks
   * @returns {Array<string>} - Chunks with overlap
   */
  _addOverlap(chunks) {
    if (this.overlap === 0 || chunks.length <= 1) {
      return chunks;
    }

    const overlappedChunks = [chunks[0]];
    
    for (let i = 1; i < chunks.length; i++) {
      const prevChunk = chunks[i - 1];
      const currentChunk = chunks[i];
      
      // Extract overlap from previous chunk
      const overlapText = prevChunk.slice(-this.overlap);
      const newChunk = overlapText + '\\n' + currentChunk;
      
      overlappedChunks.push(newChunk);
    }
    
    return overlappedChunks;
  }
}

// Usage example
const splitter = new TextSplitter({
  chunkSize: 500,
  overlap: 50
});

const text = "Your long document text here...";
const chunks = splitter.splitText(text);

console.log(\`Split into \${chunks.length} chunks\`);
chunks.forEach((chunk, index) => {
  console.log(\`Chunk \${index + 1}: \${chunk.length} characters\`);
});`
};

const tabs = [
  { id: 'custom', label: 'Custom', description: 'Your own text' },
  { id: 'technical', label: 'Technical Docs', description: 'API documentation' },
  { id: 'blog', label: 'Blog Post', description: 'Markdown blog content' },
  { id: 'academic', label: 'Academic Paper', description: 'Research paper' },
  { id: 'code', label: 'Code', description: 'JavaScript code' }
];

export default function Home() {
  const [activeTab, setActiveTab] = useState('custom');
  const [texts, setTexts] = useState(exampleTexts);
  const [globalChunkSize, setGlobalChunkSize] = useState(200);

  const updateText = (tabId, newText) => {
    setTexts(prev => ({ ...prev, [tabId]: newText }));
  };

  const activeText = texts[activeTab];

  return (
    <div className="min-h-screen bg-gray-50 py-8 font-mono">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-black">SplitUp</h1>
          <p className="text-black">
          </p>
        </div>

        {/* Input Section with AST Visualization */}
        <div className="mb-8">
          <label className="block text-sm font-medium mb-3 text-black">
            Input Text
          </label>
          
          {/* Tab Navigation */}
          <div className="flex space-x-1 mb-4 bg-white p-1 rounded-lg border">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Textarea */}
            <div>
              <textarea
                id="text-input"
                value={activeText}
                onChange={(e) => updateText(activeTab, e.target.value)}
                className="w-full h-[500px] p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm text-black"
                placeholder="Enter your text here..."
              />
            </div>
            
            {/* AST Visualization */}
            <div className="h-[500px]">
              <ASTVisualizer text={activeText} />
            </div>
          </div>
        </div>

        {/* Global Chunk Size Control */}
        <div className="mb-8 p-4 bg-white rounded-lg border">
          <label htmlFor="global-chunk-size" className="block text-sm font-medium mb-2 text-black">
            Global Chunk Size
          </label>
          <div className="flex items-center gap-4 mb-2">
            <input
              id="global-chunk-size"
              type="range"
              min="1"
              max="2000"
              value={globalChunkSize}
              onChange={(e) => setGlobalChunkSize(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <input
              type="number"
              min="1"
              max="2000"
              value={globalChunkSize}
              onChange={(e) => setGlobalChunkSize(Number(e.target.value))}
              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-black"
            />
          </div>
          <div className="flex justify-between text-xs text-black">
            <span>1</span>
            <span>2000</span>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            This sets the chunk size for all splitters. Use individual controls below to override for specific splitters.
          </p>
        </div>

        {/* Visualization Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <ChunkVisualizer 
            text={activeText} 
            title="Custom Markdown Splitter"
            initialChunkSize={200}
            globalChunkSize={globalChunkSize}
            splitterType="markdown"
          />
          <ChunkVisualizer 
            text={activeText} 
            title="LangChain Markdown Splitter"
            initialChunkSize={200}
            globalChunkSize={globalChunkSize}
            splitterType="langchain-markdown"
          />
          <ChunkVisualizer 
            text={activeText} 
            title="Character Splitter"
            initialChunkSize={100}
            globalChunkSize={globalChunkSize}
            splitterType="character"
          />
        </div>
      </div>
    </div>
  );
}