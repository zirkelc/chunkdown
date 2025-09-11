# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript library called "chunkdown" that provides an AST-based Markdown text splitter with section-aware chunking capabilities. The splitter intelligently breaks markdown text into chunks using a hierarchical approach while preserving markdown formatting and semantic relationships between content (e.g., keeping headings with their related content when possible).

## Key Architecture

### Main Components

1. **src/splitter.ts** - Core implementation containing:
   - `chunkdown()` - Factory function that creates a configured splitter instance
   - AST-based parsing using `mdast-util-from-markdown` and `mdast-util-to-markdown`
   - Section-aware chunking logic that combines related content (headings + following content)
   - Hierarchical text splitting fallback for oversized content

2. **src/ast.ts** - AST transformation utilities:
   - `createHierarchicalAST()` - Transforms flat mdast AST into hierarchical sections
   - `Section` interface representing headings with their associated content
   - Helper functions for working with hierarchical AST structures

3. **src/markdown.ts** - Markdown parsing utilities:
   - Wrapper functions around mdast utilities with GFM (GitHub Flavored Markdown) support
   - `fromMarkdown()` and `toMarkdown()` functions with GFM extensions enabled

### Core Algorithm

The splitter uses a multi-step approach:
1. Parse markdown into AST using mdast
2. Transform AST into hierarchical sections (headings contain their content)
3. Apply top-down chunking with intelligent overflow for semantic preservation
4. Fall back to hierarchical text splitting (sentences → punctuation → words) for oversized content

Key features:
- **Hierarchical Structure**: Understands document organization and heading relationships
- **Semantic Preservation**: Keeps related content together when possible
- **Soft Size Limits**: Allows controlled overflow to maintain coherence
- **Content-Type Awareness**: Makes smart decisions for code blocks, tables, lists

## Development Commands

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch

# Run a specific test file
pnpm test src/splitter.test.ts

# Run tests matching a pattern
pnpm test -- -t "Basic Functionality"

# Build the library
pnpm build

# Lint and format code
pnpm lint

# Check type definitions
pnpm types
```

## Testing Approach

The project uses Vitest for testing. Tests are organized into logical groups:
- Basic Functionality - Core splitting behavior and edge cases
- Markdown Formatting Preservation - Ensures all markdown elements are preserved correctly
- Breaking Point Behavior - Validates the hierarchical splitting logic

Test files are located alongside their implementation files:
- `src/splitter.test.ts` - Main splitter functionality tests
- `src/ast.test.ts` - AST transformation tests
- `src/markdown.test.ts` - Markdown parsing tests

When adding new features or fixing bugs, ensure corresponding tests are added to maintain coverage.

## Package Structure

The library exports multiple entry points:
- Main export: `chunkdown` function from `src/index.ts`
- Sub-exports: `./ast`, `./splitter`, `./markdown` modules can be imported directly
- Built outputs: CommonJS and ESM formats in `dist/` directory