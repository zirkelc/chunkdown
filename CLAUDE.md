# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript library that provides an AST-based Markdown text splitter with section-aware chunking capabilities. The splitter intelligently breaks markdown text into chunks using a hierarchical approach while preserving markdown formatting and semantic relationships between content (e.g., keeping headings with their related content when possible).

## Key Architecture

### Main Components

1. **text-splitter.ts** - Core implementation containing:
   - `createMarkdownSplitter()` - Factory function that creates a configured splitter instance
   - AST-based parsing using `mdast-util-from-markdown` and `mdast-util-to-markdown`
   - Section-aware chunking logic that combines related content (headings + following content)
   - Hierarchical text splitting fallback for oversized content

2. **text-splitter.test.ts** - Comprehensive test suite using Vitest that validates:
   - Basic functionality and chunk size limits
   - Markdown formatting preservation
   - Breaking point behavior at different levels (paragraphs, sentences, punctuation, words)

### Core Algorithm

The splitter uses a multi-step approach:
1. Parse markdown into AST using mdast
2. Split at natural boundaries (headings, paragraphs, code blocks, etc.)
3. Apply section-aware chunking to combine related content when it fits
4. Fall back to hierarchical text splitting (sentences → punctuation → words) for oversized content

## Development Commands

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch

# Run a specific test file
pnpm test src/text-splitter.test.ts

# Run tests matching a pattern
pnpm test -- -t "Basic Functionality"
```

## Testing Approach

The project uses Vitest for testing. Tests are organized into logical groups:
- Basic Functionality - Core splitting behavior and edge cases
- Markdown Formatting Preservation - Ensures all markdown elements are preserved correctly
- Breaking Point Behavior - Validates the hierarchical splitting logic

When adding new features or fixing bugs, ensure corresponding tests are added to maintain coverage.