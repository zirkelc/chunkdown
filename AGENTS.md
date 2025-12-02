# AGENTS.md

## Commands
- `pnpm test` - Run all tests
- `pnpm test src/ast.test.ts` - Run single test file
- `pnpm test -- -t "pattern"` - Run tests matching pattern
- `pnpm build` - Build with tsdown
- `pnpm lint` - Lint and format with Biome

## Code Style (Biome enforced)
- Single quotes, semicolons always, trailing commas
- 2-space indentation, LF line endings
- Arrow parens always: `(x) => x`
- Use `import type { X }` for type-only imports
- Named exports preferred over default exports

## Naming Conventions
- Types/Interfaces: PascalCase (`Section`, `SplitterOptions`)
- Functions/variables: camelCase (`splitText`, `defaultNodeRules`)
- Test files: `*.test.ts` co-located with source

## Patterns
- Type guards: `const isX = (node: Node): node is X => { ... }`
- Early returns for edge cases, minimal exceptions
- JSDoc comments for public APIs
- Generator functions for streaming: `*splitTree(): Generator<...>`
