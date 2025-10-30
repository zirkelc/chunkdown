# Final Refactoring Plan: Node-Type Specific Splitters

## Executive Summary

Transform the monolithic `chunkdown()` function into a flexible, class-based architecture with specialized splitters for different markdown node types. This enables better separation of concerns, easier testing, recursive splitting of nested structures, and future extensibility.

## Architecture Overview

### Class Hierarchy (6 Classes)

```
AbstractSplitter (Base)
├── MarkdownTreeSplitter (Orchestrator + Section Processing)
│   ├── uses → ListSplitter
│   ├── uses → TableSplitter
│   └── uses → BlockquoteSplitter
└── TextSplitter (Boundary-based text splitting)
```

### Key Design Principles

1. **Self-Contained Splitters**: Each node splitter is standalone - no constructor dependencies on orchestrator
2. **On-Demand Child Splitters**: Splitters create new `MarkdownTreeSplitter` instances when recursive splitting is needed
3. **Sections Are Internal**: Section processing stays inside `MarkdownTreeSplitter` as private methods (not a separate class)
4. **Real Node Types Only**: Only actual mdast node types (`list`, `table`, `blockquote`) get dedicated splitter classes

---

## Phase 1 Implementation Details

### Goal: Extract Node Logic with Zero Behavior Change

Phase 1 focuses on **mechanical extraction** of existing node processing logic into classes, integrated via a Map. This is the safest first step as it:
- Maintains 100% current behavior (no algorithm changes)
- Can be verified by existing tests passing unchanged
- Establishes the foundation for future improvements

### Step 1: Create Base Interface

**File**: `src/splitters/types.ts`

```typescript
import type { Nodes, List, Table, Blockquote } from 'mdast';
import type { ChunkdownOptions } from './splitter';

export interface NodeSplitter<T extends Nodes = Nodes> {
  split(node: T, context: SplitterContext): string[];
}

export interface SplitterContext {
  options: ChunkdownOptions;
  utils: SplitterUtils;
}

export interface SplitterUtils {
  getContentSize: (input: string | Nodes) => number;
  getRawSize: (input: string | Nodes) => number;
  isWithinAllowedSize: (contentSize: number, rawSize: number) => boolean;
  toMarkdown: (node: Nodes) => string;
  // ... other shared utilities
}
```

### Step 2: Extract ListSplitter

**File**: `src/splitters/ListSplitter.ts`

```typescript
import type { List } from 'mdast';
import type { NodeSplitter, SplitterContext } from './types';
import { toMarkdown } from '../markdown';

export class ListSplitter implements NodeSplitter<List> {
  split(list: List, context: SplitterContext): string[] {
    // ✅ Copy EXACT logic from processList() (lines 853-929)
    // No changes to algorithm, just extract into method
    const { options, utils } = context;
    const chunks: string[] = [];
    // ... rest of current processList implementation
    return chunks;
  }
}
```

### Step 3: Extract TableSplitter

**File**: `src/splitters/TableSplitter.ts`

```typescript
import type { Table } from 'mdast';
import type { NodeSplitter, SplitterContext } from './types';

export class TableSplitter implements NodeSplitter<Table> {
  split(table: Table, context: SplitterContext): string[] {
    // ✅ Copy EXACT logic from processTable() (lines 763-844)
    const { options, utils } = context;
    const chunks: string[] = [];
    // ... rest of current processTable implementation
    return chunks;
  }
}
```

### Step 4: Extract BlockquoteSplitter

**File**: `src/splitters/BlockquoteSplitter.ts`

```typescript
import type { Blockquote } from 'mdast';
import type { NodeSplitter, SplitterContext } from './types';

export class BlockquoteSplitter implements NodeSplitter<Blockquote> {
  split(blockquote: Blockquote, context: SplitterContext): string[] {
    // ✅ Copy EXACT logic from processBlockquote() (lines 937-991)
    const { options, utils } = context;
    const chunks: string[] = [];
    // ... rest of current processBlockquote implementation
    return chunks;
  }
}
```

### Step 5: Integrate into chunkdown()

**File**: `src/splitter.ts` (updated)

```typescript
import { ListSplitter } from './splitters/ListSplitter';
import { TableSplitter } from './splitters/TableSplitter';
import { BlockquoteSplitter } from './splitters/BlockquoteSplitter';
import type { SplitterContext, NodeSplitter } from './splitters/types';

export const chunkdown = (options: ChunkdownOptions) => {
  // Initialize node splitters registry
  const nodeSplitters = new Map<string, NodeSplitter>([
    ['list', new ListSplitter()],
    ['table', new TableSplitter()],
    ['blockquote', new BlockquoteSplitter()],
  ]);

  // Create context with utilities
  const context: SplitterContext = {
    options,
    utils: {
      getContentSize,
      getRawSize,
      isWithinAllowedSize,
      toMarkdown,
      // ... other utilities
    },
  };

  const processSection = (section: Section): string[] => {
    // ... existing logic ...
    
    for (const node of immediateContent) {
      // ✅ Use splitter from map instead of inline logic
      const splitter = nodeSplitters.get(node.type);
      if (splitter) {
        const nodeChunks = splitter.split(node, context);
        chunks.push(...nodeChunks);
      } else {
        // Fallback for other node types
        const nodeMarkdown = toMarkdown(node);
        // ... existing fallback logic
      }
    }
    
    return chunks;
  };

  // ... rest of existing implementation
};
```

### Success Criteria for Phase 1

1. ✅ All existing tests pass without modification
2. ✅ No behavior changes (100% identical output)
3. ✅ Three splitter classes created and integrated
4. ✅ Map-based dispatch working
5. ✅ Code is more modular but functionally identical

**This phase is complete when**: Tests pass and the code is structured for future improvements without any functional changes.

---

## Class Specifications

### 1. AbstractSplitter (Base Class)

**File**: `src/splitters/AbstractSplitter.ts`

**Purpose**: Provide shared functionality and contract for all splitters

```typescript
export abstract class AbstractSplitter<TNode extends Nodes = Nodes> {
  protected options: ChunkdownOptions;
  protected maxAllowedSize: number;
  protected maxRawSize: number;
  protected breakpoints: Breakpoints;

  constructor(options: ChunkdownOptions) {
    this.options = options;
    this.maxAllowedSize = options.chunkSize * options.maxOverflowRatio;
    this.maxRawSize = options.maxRawSize ?? this.maxAllowedSize * 4;
    this.breakpoints = options.breakpoints ?? defaultBreakpoints;
  }

  abstract split(node: TNode): string[];

  protected isWithinAllowedSize(contentSize: number, rawSize: number): boolean;
  protected getContentSize(input: string | Nodes): number;
  protected getRawSize(input: string | Nodes): number;
  protected isWithinBreakpoint(node: Nodes): boolean;
  protected toMarkdown(node: Nodes): string;
}
```

---

### 2. MarkdownTreeSplitter (Orchestrator)

**File**: `src/splitters/MarkdownTreeSplitter.ts`

**Purpose**: Main splitter that delegates to specialized splitters and handles section processing internally

```typescript
export class MarkdownTreeSplitter extends AbstractSplitter {
  private nodeSplitters: Map<string, AbstractSplitter<any>>;
  private textSplitter: TextSplitter;

  constructor(
    options: ChunkdownOptions,
    customSplitters?: Map<string, AbstractSplitter<any>>
  ) {
    super(options);
    
    this.textSplitter = new TextSplitter(options);
    
    // Register node-type splitters (self-contained, no dependencies)
    this.nodeSplitters = customSplitters ?? new Map([
      ['list', new ListSplitter(options)],
      ['table', new TableSplitter(options)],
      ['blockquote', new BlockquoteSplitter(options)],
    ]);
  }

  // ===== PUBLIC API =====
  
  splitText(text: string): string[] {
    if (!text || !text.trim()) return [];
    
    const tree = fromMarkdown(text);
    const hierarchicalAST = createHierarchicalAST(tree);
    const chunks = this.processHierarchicalAST(hierarchicalAST);
    
    return chunks.map(c => c.trim()).filter(c => c.length > 0);
  }

  split(node: Nodes): string[] {
    const splitter = this.nodeSplitters.get(node.type);
    if (splitter) return splitter.split(node);
    
    // Default: try as single chunk, fall back to text splitting
    const markdown = this.toMarkdown(node);
    const contentSize = this.getContentSize(markdown);
    
    if (this.isWithinAllowedSize(contentSize, markdown.length)) {
      return [markdown];
    }
    
    return this.textSplitter.split(markdown);
  }

  // ===== SECTION PROCESSING (PRIVATE - INTERNAL ALGORITHM) =====
  
  private processHierarchicalAST(hierarchicalAST: HierarchicalRoot): string[];
  private processHierarchicalSection(section: Section): string[];
  private processSection(section: Section): string[];
  private breakDownSection(section: Section): string[];
  private mergeParentWithDescendants(parent: Section | null, nested: Section[]): string[];
  private mergeSiblingSections(sections: Section[]): string[];
  private getSectionSize(section: Section): number;
  private convertSectionToMarkdown(section: Section): string;
}
```

**Why sections are internal:**
- Sections are synthetic (created by `createHierarchicalAST()`, not in mdast spec)
- Section processing IS the core splitting algorithm
- Avoids circular dependencies
- Better encapsulation - sections are implementation detail

---

### 3. ListSplitter

**File**: `src/splitters/ListSplitter.ts`

**Purpose**: Split lists while preserving structure and numbering

```typescript
export class ListSplitter extends AbstractSplitter<List> {
  constructor(options: ChunkdownOptions) {
    super(options); // No dependencies!
  }

  split(list: List): string[] {
    const chunks: string[] = [];
    let firstItemIndex = 0;
    let currentItems: ListItem[] = [];

    for (const item of list.children) {
      const itemSize = this.getContentSize({ ...list, children: [item] });

      if (itemSize > this.options.chunkSize) {
        // Finalize current chunk
        this.createChunk(list, currentItems, firstItemIndex, chunks);
        currentItems = [];

        if (this.isWithinAllowedSize(itemSize, ...)) {
          // Item fits with overflow
          chunks.push(this.toMarkdown({ ...list, children: [item] }));
        } else {
          // Item too large - split recursively
          chunks.push(...this.splitListItem(item, list, firstItemIndex));
        }
        firstItemIndex += 1;
        continue;
      }

      // Try adding to current chunk
      const testItems = [...currentItems, item];
      if (!this.canFitItems(list, testItems)) {
        this.createChunk(list, currentItems, firstItemIndex, chunks);
        currentItems = [item];
        continue;
      }

      currentItems.push(item);
    }

    this.createChunk(list, currentItems, firstItemIndex, chunks);
    return chunks;
  }

  private splitListItem(item: ListItem, parentList: List, itemIndex: number): string[] {
    const itemContent = item.children.map(c => this.toMarkdown(c)).join('');
    
    // ✅ Create child splitter on-demand for recursive splitting
    const childSplitter = new MarkdownTreeSplitter(this.options);
    const contentChunks = childSplitter.splitText(itemContent);

    // Wrap each chunk back into list item format
    return contentChunks.map(chunk => {
      const itemWrapper: List = {
        ...parentList,
        children: [{
          type: 'listItem',
          spread: item.spread,
          checked: item.checked,
          children: fromMarkdown(chunk).children as any,
        }],
      };
      
      if (itemWrapper.ordered) {
        itemWrapper.start = (parentList.start || 1) + itemIndex;
      }
      
      return this.toMarkdown(itemWrapper);
    });
  }
}
```

---

### 4. TableSplitter

**File**: `src/splitters/TableSplitter.ts`

**Purpose**: Split tables by rows, optionally preserving headers

```typescript
export class TableSplitter extends AbstractSplitter<Table> {
  constructor(options: ChunkdownOptions) {
    super(options); // No dependencies!
  }

  split(table: Table): string[] {
    const chunks: string[] = [];
    const headerRow = table.children[0];
    const preserveHeaders = this.options.experimental?.preserveTableHeaders ?? false;
    let currentRows: TableRow[] = [];
    
    const startIndex = preserveHeaders ? 1 : 0;

    for (let i = startIndex; i < table.children.length; i++) {
      const row = table.children[i];
      const rowSize = this.getContentSize({ ...table, children: [row] });

      if (rowSize > this.options.chunkSize) {
        this.createChunk(table, currentRows, headerRow, preserveHeaders, chunks);
        currentRows = [];

        if (this.isWithinAllowedSize(rowSize, ...)) {
          this.createChunk(table, [row], headerRow, preserveHeaders, chunks);
        } else {
          // Row too large - split by cells recursively
          chunks.push(...this.splitTableRow(row, table));
        }
        continue;
      }

      // Try adding row to current chunk
      const testRows = [...currentRows, row];
      if (!this.canFitRows(table, testRows, headerRow, preserveHeaders)) {
        this.createChunk(table, currentRows, headerRow, preserveHeaders, chunks);
        currentRows = [row];
        continue;
      }

      currentRows.push(row);
    }

    this.createChunk(table, currentRows, headerRow, preserveHeaders, chunks);
    return chunks;
  }

  private splitTableRow(row: TableRow, parentTable: Table): string[] {
    const chunks: string[] = [];
    
    for (const cell of row.children) {
      const cellContent = this.toMarkdown(cell);
      
      // ✅ Create child splitter for recursive cell processing
      const childSplitter = new MarkdownTreeSplitter(this.options);
      const cellChunks = childSplitter.splitText(cellContent);
      
      // Wrap each chunk as a single-cell table row
      cellChunks.forEach(chunk => {
        const cellRow: TableRow = {
          type: 'tableRow',
          children: [{
            type: 'tableCell',
            children: fromMarkdown(chunk).children as any,
          }],
        };
        chunks.push(this.toMarkdown(cellRow));
      });
    }
    
    return chunks;
  }
}
```

---

### 5. BlockquoteSplitter

**File**: `src/splitters/BlockquoteSplitter.ts`

**Purpose**: Split blockquotes while preserving formatting

```typescript
export class BlockquoteSplitter extends AbstractSplitter<Blockquote> {
  constructor(options: ChunkdownOptions) {
    super(options); // No dependencies!
  }

  split(blockquote: Blockquote): string[] {
    const chunks: string[] = [];
    let currentBlocks: RootContent[] = [];

    for (const block of blockquote.children) {
      const blockSize = this.getContentSize({ ...blockquote, children: [block] });

      if (blockSize > this.options.chunkSize) {
        this.createChunk(blockquote, currentBlocks, chunks);
        currentBlocks = [];

        if (this.isWithinAllowedSize(blockSize, ...)) {
          this.createChunk(blockquote, [block], chunks);
        } else {
          // Block too large - split recursively
          const blockMarkdown = this.toMarkdown(block);
          
          // ✅ Create child splitter for recursive processing
          const childSplitter = new MarkdownTreeSplitter(this.options);
          const blockChunks = childSplitter.splitText(blockMarkdown);
          
          // Wrap chunks back in blockquote
          for (const chunk of blockChunks) {
            const wrappedChunk = this.toMarkdown({
              ...blockquote,
              children: fromMarkdown(chunk).children as any,
            });
            chunks.push(wrappedChunk);
          }
        }
        continue;
      }

      // Try adding to current chunk
      const testBlocks = [...currentBlocks, block];
      if (!this.canFitBlocks(blockquote, testBlocks)) {
        this.createChunk(blockquote, currentBlocks, chunks);
        currentBlocks = [block];
        continue;
      }

      currentBlocks.push(block);
    }

    this.createChunk(blockquote, currentBlocks, chunks);
    return chunks;
  }
}
```

---

### 6. TextSplitter

**File**: `src/splitters/TextSplitter.ts`

**Purpose**: Handle text-level splitting with hierarchical boundary detection

```typescript
export class TextSplitter extends AbstractSplitter<string> {
  private boundaryPatterns: Array<{regex: RegExp; type: string; priority: number}>;

  constructor(options: ChunkdownOptions) {
    super(options);
    this.boundaryPatterns = this.initializeBoundaryPatterns();
  }

  split(text: string): string[] {
    const ast = fromMarkdown(text);
    const protectedRanges = this.extractProtectedRangesFromAST(ast);
    const boundaries = this.extractSemanticBoundaries(text, protectedRanges);
    
    return this.splitRecursive(text, boundaries, protectedRanges);
  }

  private initializeBoundaryPatterns(): Array<{...}>;
  private extractProtectedRangesFromAST(ast: Nodes): ProtectedRange[];
  private extractSemanticBoundaries(text: string, ranges: ProtectedRange[]): Boundary[];
  private splitRecursive(text: string, boundaries: Boundary[], ranges: ProtectedRange[]): string[];
}
```

---

## File Structure

```
src/
├── splitters/
│   ├── index.ts                    # Export all splitters
│   ├── types.ts                    # Shared types (Boundary, ProtectedRange, etc.)
│   ├── utils.ts                    # Shared utility functions
│   │
│   ├── AbstractSplitter.ts         # Base class (~120 lines)
│   ├── MarkdownTreeSplitter.ts     # Orchestrator + sections (~500 lines)
│   ├── TextSplitter.ts             # Text splitting (~300 lines)
│   ├── ListSplitter.ts             # List handling (~150 lines)
│   ├── TableSplitter.ts            # Table handling (~120 lines)
│   └── BlockquoteSplitter.ts       # Blockquote handling (~100 lines)
│
├── splitter.ts                     # chunkdown() factory + legacy exports
├── ast.ts                          # Unchanged
├── markdown.ts                     # Unchanged
└── index.ts                        # Main exports

tests/
└── splitters/
    ├── ListSplitter.test.ts
    ├── TableSplitter.test.ts
    ├── BlockquoteSplitter.test.ts
    ├── TextSplitter.test.ts
    └── MarkdownTreeSplitter.test.ts
```

---

## Migration Strategy

### Phase 1: Create Node-Type Splitter Classes (3-4 days)

**Goal**: Extract node-specific logic into classes and integrate via Map, with NO functional changes

1. **Create base interface** (`src/splitters/types.ts`):
   ```typescript
   export interface NodeSplitter<T extends Nodes = Nodes> {
     split(node: T, context: SplitterContext): string[];
   }
   
   export interface SplitterContext {
     options: ChunkdownOptions;
     utils: SplitterUtils;
   }
   ```

2. **Create three node splitter classes** with **exact current logic**:
   - `ListSplitter` - Extract `processList()` logic (lines 853-929) unchanged
   - `TableSplitter` - Extract `processTable()` logic (lines 763-844) unchanged
   - `BlockquoteSplitter` - Extract `processBlockquote()` logic (lines 937-991) unchanged

3. **Integrate into chunkdown() via Map**:
   ```typescript
   const nodeSplitters = new Map<string, NodeSplitter>([
     ['list', new ListSplitter()],
     ['table', new TableSplitter()],
     ['blockquote', new BlockquoteSplitter()],
   ]);
   
   // Use in processSection():
   const splitter = nodeSplitters.get(node.type);
   if (splitter) {
     return splitter.split(node, context);
   }
   ```

4. **Verify no behavior changes**:
   - Run full test suite - all tests must pass unchanged
   - No new functionality added in this phase
   - Focus on mechanical extraction only

**Deliverable**: Three working splitter classes integrated into existing function via Map

---

### Phase 2: Extract Shared Utilities (2-3 days)

1. Create `src/splitters/utils.ts` with shared functions:
   - `getContentSize()`, `getRawSize()`, `getSectionSize()`
   - Move utility functions used by multiple splitters
2. Create `src/splitters/types.ts` with shared types:
   - `Boundary`, `ProtectedRange`, `Breakpoints`, etc.
3. Update all splitter classes to use shared utilities
4. Ensure tests still pass

---

### Phase 3: Create AbstractSplitter Base Class (2-3 days)

1. Design `AbstractSplitter` to hold common functionality:
   - Options, maxAllowedSize, maxRawSize, breakpoints
   - Shared methods: `isWithinAllowedSize()`, `getContentSize()`, etc.
2. Refactor three node splitters to extend `AbstractSplitter`
3. Write unit tests for base class
4. Verify all integration tests still pass

---

### Phase 4: Extract TextSplitter (2-3 days)

1. Extract text splitting logic from current lines 1181-1416
2. Create `TextSplitter` class extending `AbstractSplitter`
3. Make standalone with comprehensive tests
4. Integrate into main function

---

### Phase 5: Create MarkdownTreeSplitter Orchestrator (3-4 days)

1. Create `MarkdownTreeSplitter` class structure with public API
2. **Move section processing as PRIVATE methods** (lines 400-755, 999-1063)
3. Wire up node splitters via registry Map
4. Wire up TextSplitter for fallback
5. Migrate `chunkdown()` factory to use new orchestrator

---

### Phase 6: Add Recursive Splitting (3-4 days)

1. Update `ListSplitter` to create child splitters for oversized items
2. Update `TableSplitter` to recursively split oversized rows/cells
3. Update `BlockquoteSplitter` to handle nested content recursively
4. Add comprehensive tests for deeply nested structures
5. Test combinations (lists in tables, tables in blockquotes, etc.)

---

### Phase 7: Final Integration & Testing (1-2 days)

1. Ensure all existing tests pass
2. Add integration tests for complex scenarios
3. Update exports to include new classes
4. Update documentation

**Total Estimate**: 16-23 days

---

## Backward Compatibility

### Public API (No Breaking Changes)

```typescript
// Current API - remains unchanged
export const chunkdown = (options: ChunkdownOptions) => {
  const treeSplitter = new MarkdownTreeSplitter(options);
  return {
    splitText: (text: string) => treeSplitter.splitText(text)
  };
};

// Utility functions - remain exported
export { getContentSize, getRawSize, defaultBreakpoints };
```

### New Public API (Additive)

```typescript
// Export new classes for advanced usage
export {
  MarkdownTreeSplitter,
  ListSplitter,
  TableSplitter,
  BlockquoteSplitter,
  TextSplitter,
  AbstractSplitter,
} from './splitters';
```

---

## Benefits

### 1. Separation of Concerns
- Each splitter has single responsibility
- Clear boundaries between different splitting strategies
- Section processing cleanly separated as internal algorithm

### 2. Testability
- Each splitter can be tested in isolation
- No mocking required (splitters are self-contained)
- Easier to write targeted unit tests

### 3. Extensibility
- Users can create custom splitters by extending `AbstractSplitter`
- Can override default splitters via constructor
- Future node types easy to add (e.g., `CodeSplitter`)

### 4. Recursive Splitting
- Child splitters enable proper recursive handling
- Nested list items split correctly
- Table cells can be processed independently
- Blockquote content handled recursively

### 5. Performance
- No performance degradation (same algorithms)
- Splitter creation is lightweight
- Recursive splitting only happens for oversized content (rare)

---

## Key Design Decisions

### Q1: Why are splitters self-contained (no orchestrator dependency)?

**Decision**: Each splitter creates child `MarkdownTreeSplitter` instances on-demand

**Reasoning**:
- Enables true standalone usage
- No circular dependencies
- Simpler testing (no mocking needed)
- Clear separation of concerns

### Q2: Why are sections internal to MarkdownTreeSplitter?

**Decision**: Section processing stays as private methods in orchestrator

**Reasoning**:
- Sections are synthetic (not real mdast nodes)
- Section processing IS the core algorithm
- Avoids circular dependency issues
- Better encapsulation
- Cleaner public API (only real node types customizable)

### Q3: When should a node type get its own splitter class?

**Criteria**:
- It's a real mdast node type (in markdown specification)
- It has specific semantic meaning (lists, tables, blockquotes)
- It benefits from specialized splitting logic
- Users might want to customize its behavior

**Not applicable to**:
- Synthetic types like `section`
- Core algorithm components
- Structural organizing principles

---

## Future Enhancements

### Custom Splitters

```typescript
class CodeBlockSplitter extends AbstractSplitter<Code> {
  split(node: Code): string[] {
    // Custom logic for splitting code blocks by functions/classes
  }
}

const customSplitters = new Map([
  ['code', new CodeBlockSplitter(options)],
  ['paragraph', new ParagraphSplitter(options)],
]);

const splitter = new MarkdownTreeSplitter(options, customSplitters);
```

### Plugin System (Future)

```typescript
interface SplitterPlugin {
  nodeType: string;
  splitter: AbstractSplitter;
}

const plugins: SplitterPlugin[] = [
  { nodeType: 'math', splitter: new MathSplitter(options) },
  { nodeType: 'diagram', splitter: new DiagramSplitter(options) },
];

const splitter = chunkdown({ ...options, plugins });
```

---

## Risks and Mitigations

### Risk 1: Circular Dependencies
**Mitigation**: Self-contained splitters create child instances on-demand (no constructor dependencies)

### Risk 2: Breaking Changes
**Mitigation**: Keep `chunkdown()` factory function unchanged, add new exports as additive API

### Risk 3: Performance Regression
**Mitigation**: Run benchmarks before/after, profile critical paths. Child splitter creation is lightweight.

### Risk 4: Test Coverage Gaps
**Mitigation**: Maintain existing integration tests, add comprehensive unit tests for each splitter

---

## Conclusion

This refactoring provides a clean, extensible architecture while maintaining 100% backward compatibility. The class-based approach enables:

- ✅ Better testing through isolated, self-contained splitters
- ✅ Clearer separation of concerns (6 focused classes vs 1 monolithic function)
- ✅ Recursive splitting of nested structures
- ✅ Easy extensibility for custom node types
- ✅ No circular dependencies
- ✅ Simpler mental model (node types vs structural algorithm)

The migration can be done incrementally with controlled risk, and the final result will be significantly easier to maintain, test, and extend.
