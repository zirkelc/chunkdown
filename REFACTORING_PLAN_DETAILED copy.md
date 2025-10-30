# Detailed Refactoring Plan: Node-Type Specific Splitters

## Executive Summary

Transform the current monolithic `chunkdown()` function into a flexible, extensible architecture using specialized splitter classes for different markdown node types (tables, lists, blockquotes, etc.). This will enable:
- Better separation of concerns
- Easier testing of individual splitters
- Future extensibility for custom node-type splitting logic
- Recursive splitting of nested structures

---

## Current Architecture Analysis

### Current Structure (splitter.ts)

The `chunkdown()` function (~1445 lines) contains:
1. **Core configuration** (lines 241-341): Options, breakpoints, boundary patterns
2. **Utility functions** (lines 120-391): Size calculations, breakpoint checks
3. **Section processing** (lines 399-755): Hierarchical section handling, merging
4. **Node-type processors** (lines 419-991): `processList()`, `processTable()`, `processBlockquote()`
5. **Text splitting** (lines 1402-1416): Hierarchical text splitting with boundaries
6. **Main entry point** (lines 1424-1444): `splitText()` orchestration

### Key Observations

1. **Node-specific splitting is already isolated**: Functions like `processList()`, `processTable()`, and `processBlockquote()` are self-contained
2. **Common patterns exist**: All node processors follow similar patterns:
   - Check if content fits
   - Try to group children (items, rows, blocks)
   - Fall back to text splitting for oversized content
3. **Shared utilities needed**: `isWithinAllowedSize()`, `getContentSize()`, `getRawSize()`, boundary extraction
4. **Recursive needs**: ListItems, TableCells, and BlockQuotes can contain nested content requiring further splitting

---

## New Architecture Design

### Class Hierarchy

```
┌─────────────────────────┐
│  AbstractSplitter       │  (Abstract base class)
│  - options              │
│  - isWithinAllowedSize()│
│  - getContentSize()     │
│  - getRawSize()         │
│  + split(node): string[]│  (Abstract method)
└─────────────────────────┘
            ▲
            │
            ├─────────────────────────────────────────────────┐
            │                                                 │
┌───────────┴──────────────┐                  ┌──────────────┴────────────┐
│ MarkdownTreeSplitter     │                  │ TextSplitter              │
│ - nodeSplitters: Map     │                  │ - boundaryPatterns        │
│ + split(node): string[]  │                  │ - protectedRanges         │
│ + splitText(text): []    │                  │ + split(text): string[]   │
└──────────────────────────┘                  └───────────────────────────┘
            │
            │ delegates to
            ├─────────────────┬──────────────────┬─────────────────┐
            │                 │                  │                 │
   ┌────────┴────────┐  ┌────┴────────┐  ┌──────┴──────┐  ┌──────┴──────┐
   │  ListSplitter   │  │TableSplitter│  │Blockquote   │  │Section      │
   │                 │  │             │  │Splitter     │  │Splitter     │
   └─────────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

---

## Detailed Class Specifications

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

  /**
   * Main split method to be implemented by each concrete splitter
   * @param node - The AST node to split
   * @returns Array of markdown string chunks
   */
  abstract split(node: TNode): string[];

  /**
   * Check if content fits within allowed size limits
   */
  protected isWithinAllowedSize(contentSize: number, rawSize: number): boolean {
    if (contentSize > this.maxAllowedSize) return false;
    if (this.maxRawSize && rawSize > this.maxRawSize) return false;
    return true;
  }

  /**
   * Get content size (visible text without formatting)
   */
  protected getContentSize(input: string | Nodes): number {
    // Implementation from current splitter.ts
  }

  /**
   * Get raw markdown size
   */
  protected getRawSize(input: string | Nodes): number {
    // Implementation from current splitter.ts
  }

  /**
   * Check if node is within its protection breakpoint
   */
  protected isWithinBreakpoint(node: Nodes): boolean {
    // Implementation from current splitter.ts
  }

  /**
   * Convert node to markdown string
   */
  protected toMarkdown(node: Nodes): string {
    return toMarkdown(node);
  }
}
```

---

### 2. MarkdownTreeSplitter (Main Orchestrator)

**File**: `src/splitters/MarkdownTreeSplitter.ts`

**Purpose**: Main splitter that delegates to specialized splitters based on node type

```typescript
export class MarkdownTreeSplitter extends AbstractSplitter {
  private nodeSplitters: Map<string, AbstractSplitter<any>>;
  private sectionSplitter: SectionSplitter;
  private textSplitter: TextSplitter;

  constructor(options: ChunkdownOptions, customSplitters?: Map<string, AbstractSplitter<any>>) {
    super(options);
    
    // Initialize specialized splitters
    this.textSplitter = new TextSplitter(options);
    this.sectionSplitter = new SectionSplitter(options, this);
    
    // Default node splitters registry
    this.nodeSplitters = customSplitters ?? new Map([
      ['list', new ListSplitter(options, this)],
      ['table', new TableSplitter(options, this)],
      ['blockquote', new BlockquoteSplitter(options, this)],
    ]);
  }

  /**
   * Split a single node by delegating to appropriate splitter
   */
  split(node: Nodes): string[] {
    const splitter = this.nodeSplitters.get(node.type);
    
    if (splitter) {
      return splitter.split(node);
    }
    
    // Default behavior: try as single chunk, fall back to text splitting
    const markdown = this.toMarkdown(node);
    const contentSize = this.getContentSize(markdown);
    
    if (this.isWithinAllowedSize(contentSize, markdown.length)) {
      return [markdown];
    }
    
    return this.textSplitter.split(markdown);
  }

  /**
   * Main entry point: split markdown text
   */
  splitText(text: string): string[] {
    if (!text || !text.trim()) return [];

    // Parse markdown into AST
    const tree = fromMarkdown(text);

    // Transform to hierarchical AST
    const hierarchicalAST = createHierarchicalAST(tree);

    // Process hierarchical AST
    const chunks = this.processHierarchicalAST(hierarchicalAST);

    // Clean and return
    return chunks.map(c => c.trim()).filter(c => c.length > 0);
  }

  /**
   * Process hierarchical AST (similar to current implementation)
   */
  private processHierarchicalAST(hierarchicalAST: HierarchicalRoot): string[] {
    // Group content into sections (orphaned and regular)
    // Delegate section processing to SectionSplitter
    // Implementation similar to current lines 999-1063
  }

  /**
   * Get reference to text splitter for nested content
   */
  getTextSplitter(): TextSplitter {
    return this.textSplitter;
  }
}
```

---

### 3. ListSplitter

**File**: `src/splitters/ListSplitter.ts`

**Purpose**: Split markdown lists while preserving list structure and numbering

```typescript
export class ListSplitter extends AbstractSplitter<List> {
  private treeSplitter: MarkdownTreeSplitter;

  constructor(options: ChunkdownOptions, treeSplitter: MarkdownTreeSplitter) {
    super(options);
    this.treeSplitter = treeSplitter;
  }

  split(list: List): string[] {
    const chunks: string[] = [];
    let firstItemIndex = 0;

    const createChunk = (items: ListItem[]): void => {
      if (items.length === 0) return;

      const listChunk = { ...list, children: items };
      if (listChunk.ordered) {
        const originalStart = list.start || 1;
        listChunk.start = originalStart + firstItemIndex;
      }

      chunks.push(this.toMarkdown(listChunk));
      firstItemIndex += items.length;
    };

    let currentItems: ListItem[] = [];

    for (const item of list.children) {
      const itemNode = { ...list, children: [item] };
      const itemSize = this.getContentSize(itemNode);

      // Handle oversized items
      if (itemSize > this.options.chunkSize) {
        createChunk(currentItems);
        currentItems = [];

        if (this.isWithinAllowedSize(itemSize, this.toMarkdown(itemNode).length)) {
          if (itemNode.ordered) {
            const originalStart = list.start || 1;
            itemNode.start = originalStart + firstItemIndex;
          }
          chunks.push(this.toMarkdown(itemNode));
        } else {
          // Item too large - split nested content recursively
          chunks.push(...this.splitListItem(item, list, firstItemIndex));
        }
        firstItemIndex += 1;
        continue;
      }

      // Try adding item to current chunk
      const testItems = [...currentItems, item];
      const tempList = { ...list, children: testItems };
      const tempMarkdown = this.toMarkdown(tempList);
      const tempSize = this.getContentSize(tempList);

      if (!this.isWithinAllowedSize(tempSize, tempMarkdown.length)) {
        createChunk(currentItems);
        currentItems = [item];
        continue;
      }

      currentItems.push(item);
    }

    createChunk(currentItems);
    return chunks;
  }

  /**
   * Split a single list item's content recursively
   */
  private splitListItem(item: ListItem, parentList: List, itemIndex: number): string[] {
    // Convert ListItem children to markdown or process as tree
    const itemContent = item.children
      .map(child => this.toMarkdown(child))
      .join('');

    // Create a child MarkdownTreeSplitter to handle nested content
    const childSplitter = new MarkdownTreeSplitter(this.options);
    const contentChunks = childSplitter.splitText(itemContent);

    // Wrap each chunk back into list item format
    return contentChunks.map((chunk, idx) => {
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
        const originalStart = parentList.start || 1;
        itemWrapper.start = originalStart + itemIndex;
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
  private treeSplitter: MarkdownTreeSplitter;

  constructor(options: ChunkdownOptions, treeSplitter: MarkdownTreeSplitter) {
    super(options);
    this.treeSplitter = treeSplitter;
  }

  split(table: Table): string[] {
    const chunks: string[] = [];
    const headerRow = table.children[0];
    const preserveHeaders = this.options.experimental?.preserveTableHeaders ?? false;

    const createChunk = (rows: TableRow[]): void => {
      if (rows.length === 0) return;

      let finalRows = rows;
      if (preserveHeaders && finalRows[0] !== headerRow) {
        finalRows = [headerRow, ...rows];
      }

      if (finalRows[0] === headerRow) {
        chunks.push(this.toMarkdown({ ...table, children: finalRows }));
      } else {
        const rowsMarkdown = rows.map(row => this.toMarkdown(row)).join('');
        chunks.push(rowsMarkdown);
      }
    };

    let currentRows: TableRow[] = [];
    const startIndex = preserveHeaders ? 1 : 0;

    for (let i = startIndex; i < table.children.length; i++) {
      const row = table.children[i];
      const rowNode = { ...table, children: [row] };
      const rowSize = this.getContentSize(rowNode);

      // Handle oversized rows
      if (rowSize > this.options.chunkSize) {
        createChunk(currentRows);
        currentRows = [];

        if (this.isWithinAllowedSize(rowSize, this.toMarkdown(rowNode).length)) {
          createChunk([row]);
        } else {
          // Row too large - split by cells
          chunks.push(...this.splitTableRow(row, table));
        }
        continue;
      }

      // Try adding row
      const testRows = [...currentRows, row];
      const tempTable = { ...table, children: testRows };
      const tempMarkdown = this.toMarkdown(tempTable);
      const tempSize = this.getContentSize(tempTable);

      if (!this.isWithinAllowedSize(tempSize, tempMarkdown.length)) {
        createChunk(currentRows);
        currentRows = [row];
        continue;
      }

      currentRows.push(row);
    }

    createChunk(currentRows);
    return chunks;
  }

  /**
   * Split a single table row by processing cells
   */
  private splitTableRow(row: TableRow, parentTable: Table): string[] {
    // For now, fall back to text splitting
    // TODO: Implement cell-by-cell splitting with child splitter
    const rowMarkdown = this.toMarkdown({ ...parentTable, children: [row] });
    return this.treeSplitter.getTextSplitter().split(rowMarkdown);
  }
}
```

---

### 5. BlockquoteSplitter

**File**: `src/splitters/BlockquoteSplitter.ts`

**Purpose**: Split blockquotes while preserving blockquote formatting

```typescript
export class BlockquoteSplitter extends AbstractSplitter<Blockquote> {
  private treeSplitter: MarkdownTreeSplitter;

  constructor(options: ChunkdownOptions, treeSplitter: MarkdownTreeSplitter) {
    super(options);
    this.treeSplitter = treeSplitter;
  }

  split(blockquote: Blockquote): string[] {
    const chunks: string[] = [];

    const createChunk = (blocks: RootContent[]): void => {
      if (blocks.length === 0) return;
      chunks.push(this.toMarkdown({ ...blockquote, children: blocks }));
    };

    let currentBlocks: RootContent[] = [];

    for (const block of blockquote.children) {
      const blockNode = { ...blockquote, children: [block] };
      const blockSize = this.getContentSize(blockNode);

      if (blockSize > this.options.chunkSize) {
        createChunk(currentBlocks);
        currentBlocks = [];

        if (this.isWithinAllowedSize(blockSize, this.toMarkdown(blockNode).length)) {
          createChunk([block]);
        } else {
          // Block too large - split recursively
          const blockMarkdown = this.toMarkdown(block);
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

      const testBlocks = [...currentBlocks, block];
      const tempBlockquote = { ...blockquote, children: testBlocks };
      const tempMarkdown = this.toMarkdown(tempBlockquote);
      const tempSize = this.getContentSize(tempBlockquote);

      if (!this.isWithinAllowedSize(tempSize, tempMarkdown.length)) {
        createChunk(currentBlocks);
        currentBlocks = [block];
        continue;
      }

      currentBlocks.push(block);
    }

    createChunk(currentBlocks);
    return chunks;
  }
}
```

---

### 6. SectionSplitter

**File**: `src/splitters/SectionSplitter.ts`

**Purpose**: Handle hierarchical section processing with merging optimization

```typescript
export class SectionSplitter extends AbstractSplitter<Section> {
  private treeSplitter: MarkdownTreeSplitter;

  constructor(options: ChunkdownOptions, treeSplitter: MarkdownTreeSplitter) {
    super(options);
    this.treeSplitter = treeSplitter;
  }

  split(section: Section): string[] {
    const sectionSize = this.getSectionSize(section);
    const sectionMarkdown = this.convertSectionToMarkdown(section);

    if (this.isWithinAllowedSize(sectionSize, sectionMarkdown.length)) {
      return [sectionMarkdown];
    }

    return this.breakDownSection(section);
  }

  /**
   * Process section content with intelligent grouping
   */
  processSection(section: Section): string[] {
    // Implementation from current lines 450-531
  }

  /**
   * Break down large section intelligently
   */
  private breakDownSection(section: Section): string[] {
    // Implementation from current lines 540-574
  }

  /**
   * Merge strategies
   */
  private mergeParentWithDescendants(...): string[] {
    // Implementation from current lines 583-676
  }

  private mergeSiblingSections(...): string[] {
    // Implementation from current lines 685-755
  }

  private getSectionSize(section: Section): number {
    // Implementation from current lines 162-182
  }

  private convertSectionToMarkdown(section: Section): string {
    // Implementation from current lines 191-198
  }
}
```

---

### 7. TextSplitter

**File**: `src/splitters/TextSplitter.ts`

**Purpose**: Handle text-level splitting with hierarchical boundary detection

```typescript
export class TextSplitter extends AbstractSplitter<string> {
  private boundaryPatterns: Array<{regex: RegExp; type: string; priority: number}>;

  constructor(options: ChunkdownOptions) {
    super(options);
    this.boundaryPatterns = this.initializeBoundaryPatterns();
  }

  /**
   * Split raw text using hierarchical boundary approach
   */
  split(text: string): string[] {
    const ast = fromMarkdown(text);
    const protectedRanges = this.extractProtectedRangesFromAST(ast);
    const boundaries = this.extractSemanticBoundaries(text, protectedRanges);
    
    return this.splitRecursive(text, boundaries, protectedRanges);
  }

  private initializeBoundaryPatterns(): Array<{...}> {
    // Implementation from current lines 254-341
  }

  private extractProtectedRangesFromAST(ast: Nodes): ProtectedRange[] {
    // Implementation from current lines 1072-1140
  }

  private extractSemanticBoundaries(text: string, protectedRanges: ProtectedRange[]): Boundary[] {
    // Implementation from current lines 1190-1227
  }

  private splitRecursive(text: string, boundaries: Boundary[], protectedRanges: ProtectedRange[], originalOffset = 0): string[] {
    // Implementation from current lines 1257-1400
  }

  // Other helper methods...
}
```

---

## Migration Strategy

### Phase 1: Extract Utilities (Low Risk)

1. Create `src/splitters/utils.ts` with shared functions:
   - `getContentSize()`
   - `getRawSize()`
   - `getSectionSize()`
   - Export types: `Boundary`, `ProtectedRange`, `Breakpoints`, etc.

2. Update imports in `splitter.ts` to use utilities module

### Phase 2: Create Base Classes (Medium Risk)

1. Create `AbstractSplitter` with shared methods
2. Create `TextSplitter` by extracting text splitting logic
3. Test `TextSplitter` standalone with existing test cases

### Phase 3: Extract Node Splitters (Medium Risk)

1. Create `ListSplitter` - extract `processList()`
2. Create `TableSplitter` - extract `processTable()`
3. Create `BlockquoteSplitter` - extract `processBlockquote()`
4. Create `SectionSplitter` - extract section processing logic
5. Test each splitter standalone

### Phase 4: Create Orchestrator (High Risk)

1. Create `MarkdownTreeSplitter` class
2. Wire up all specialized splitters
3. Update `chunkdown()` factory function to instantiate and return `MarkdownTreeSplitter`
4. Run full test suite

### Phase 5: Add Recursive Splitting (High Risk)

1. Implement recursive splitting in `ListSplitter.splitListItem()`
2. Implement recursive splitting in `TableSplitter.splitTableRow()`
3. Implement recursive splitting in `BlockquoteSplitter`
4. Add tests for deeply nested structures

---

## File Structure

```
src/
├── splitters/
│   ├── AbstractSplitter.ts          # Base class with shared functionality
│   ├── MarkdownTreeSplitter.ts      # Main orchestrator
│   ├── TextSplitter.ts              # Text-level splitting
│   ├── ListSplitter.ts              # List-specific logic
│   ├── TableSplitter.ts             # Table-specific logic
│   ├── BlockquoteSplitter.ts        # Blockquote-specific logic
│   ├── SectionSplitter.ts           # Section hierarchy handling
│   ├── utils.ts                     # Shared utilities
│   ├── types.ts                     # Shared types
│   └── index.ts                     # Export all splitters
├── splitter.ts                      # Legacy exports + chunkdown() factory
├── ast.ts                           # Unchanged
├── markdown.ts                      # Unchanged
└── index.ts                         # Main exports

tests/
├── splitters/
│   ├── ListSplitter.test.ts
│   ├── TableSplitter.test.ts
│   ├── BlockquoteSplitter.test.ts
│   ├── SectionSplitter.test.ts
│   ├── TextSplitter.test.ts
│   └── MarkdownTreeSplitter.test.ts
└── splitter.test.ts                # Integration tests
```

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
  SectionSplitter,
  TextSplitter,
  AbstractSplitter,
} from './splitters';
```

---

## Benefits

### 1. Separation of Concerns
- Each splitter has single responsibility
- Easier to understand and maintain
- Clear boundaries between different splitting strategies

### 2. Testability
- Each splitter can be tested in isolation
- Easier to write targeted unit tests
- Mocking dependencies is straightforward

### 3. Extensibility
- Users can create custom splitters by extending `AbstractSplitter`
- Can override default splitters via `MarkdownTreeSplitter` constructor
- Future node types easy to add

### 4. Recursive Splitting
- Child splitters enable proper recursive handling
- Nested list items can be split correctly
- Table cells can be processed independently

### 5. Performance
- No performance degradation (same algorithms)
- Potential for optimization through splitter caching
- Lazy instantiation of splitters possible

---

## Testing Strategy

### Unit Tests for Each Splitter

```typescript
describe('ListSplitter', () => {
  it('should split list by items', () => { ... });
  it('should preserve ordered list numbering', () => { ... });
  it('should handle oversized list items recursively', () => { ... });
  it('should work standalone', () => {
    const options = { chunkSize: 100, maxOverflowRatio: 1.5 };
    const treeSplitter = new MarkdownTreeSplitter(options);
    const listSplitter = new ListSplitter(options, treeSplitter);
    
    const list: List = { /* test data */ };
    const chunks = listSplitter.split(list);
    
    expect(chunks.length).toBeGreaterThan(1);
  });
});
```

### Integration Tests

```typescript
describe('MarkdownTreeSplitter Integration', () => {
  it('should handle nested lists in tables', () => { ... });
  it('should handle tables in blockquotes', () => { ... });
  it('should maintain backward compatibility', () => { ... });
});
```

---

## Future Enhancements

### Custom Splitters

```typescript
class CodeBlockSplitter extends AbstractSplitter<Code> {
  split(node: Code): string[] {
    // Custom logic for splitting code blocks by functions/classes
  }
}

const splitter = new MarkdownTreeSplitter(options, new Map([
  ['code', new CodeBlockSplitter(options)],
]));
```

### Splitter Plugins

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

## Implementation Timeline

- **Phase 1**: 2-3 days (Extract utilities, low risk)
- **Phase 2**: 2-3 days (Create base classes)
- **Phase 3**: 4-5 days (Extract node splitters)
- **Phase 4**: 2-3 days (Create orchestrator, wire up)
- **Phase 5**: 3-4 days (Add recursive splitting, testing)

**Total Estimate**: 13-18 days

---

## Risks and Mitigations

### Risk 1: Circular Dependencies
**Mitigation**: Use dependency injection (pass treeSplitter to constructors)

### Risk 2: Breaking Changes
**Mitigation**: Keep `chunkdown()` factory function unchanged, add new exports

### Risk 3: Performance Regression
**Mitigation**: Run benchmarks before/after, profile critical paths

### Risk 4: Test Coverage Gaps
**Mitigation**: Maintain existing integration tests, add comprehensive unit tests

---

## Decision Points

### Q1: Should AbstractSplitter be abstract or interface?
**Decision**: Abstract class - provides shared implementation, not just contract

### Q2: Should splitters be stateful or stateless?
**Decision**: Stateful with options - enables caching, simpler API

### Q3: Should we use dependency injection or service locator?
**Decision**: Constructor injection - explicit dependencies, easier testing

### Q4: Should chunkdown() return class instance or object with methods?
**Decision**: Return object with methods - maintains current API, hides implementation

---

## Conclusion

This refactoring provides a clean, extensible architecture while maintaining backward compatibility. The class-based approach enables better testing, clearer separation of concerns, and recursive splitting of nested structures. The migration can be done incrementally with low risk, and the final result will be easier to maintain and extend in the future.

---

## REVISION: Stand-Alone Splitter Design

### Original Design Issue

The initial plan suggested passing `MarkdownTreeSplitter` reference via constructor:

```typescript
class ListSplitter extends AbstractSplitter<List> {
  private treeSplitter: MarkdownTreeSplitter;
  
  constructor(options: ChunkdownOptions, treeSplitter: MarkdownTreeSplitter) {
    super(options);
    this.treeSplitter = treeSplitter; // ❌ Creates dependency
  }
}
```

**Problems:**
- Creates circular dependency (MarkdownTreeSplitter → ListSplitter → MarkdownTreeSplitter)
- ListSplitter cannot be used standalone without orchestrator
- Testing requires mocking the entire tree splitter
- Violates single responsibility - splitter shouldn't know about orchestrator

### Revised Design: Self-Contained Splitters

Each splitter creates its own child `MarkdownTreeSplitter` instance when needed:

```typescript
class ListSplitter extends AbstractSplitter<List> {
  // No treeSplitter dependency!
  
  constructor(options: ChunkdownOptions) {
    super(options);
  }

  split(list: List): string[] {
    // ... main logic ...
    
    if (itemTooLarge) {
      // Create child splitter on-demand
      return this.splitListItem(item, list, index);
    }
  }

  private splitListItem(item: ListItem, parentList: List, itemIndex: number): string[] {
    const itemContent = item.children
      .map(child => this.toMarkdown(child))
      .join('');

    // ✅ Create new instance for recursive splitting
    const childSplitter = new MarkdownTreeSplitter(this.options);
    const contentChunks = childSplitter.splitText(itemContent);

    // Wrap chunks back into list item format
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

### Benefits of This Approach

1. **True Stand-Alone Usage**
   ```typescript
   // Use splitter directly without orchestrator
   const listSplitter = new ListSplitter({ chunkSize: 500, maxOverflowRatio: 1.5 });
   const chunks = listSplitter.split(myListNode);
   ```

2. **No Circular Dependencies**
   - MarkdownTreeSplitter depends on ListSplitter
   - ListSplitter depends on MarkdownTreeSplitter only at runtime (not construction)
   - Clean dependency graph

3. **Easier Testing**
   ```typescript
   describe('ListSplitter', () => {
     it('should work completely standalone', () => {
       const splitter = new ListSplitter(options);
       const list: List = createTestList();
       const chunks = splitter.split(list);
       expect(chunks.length).toBeGreaterThan(0);
       // No mocking needed!
     });
   });
   ```

4. **Simpler Construction**
   ```typescript
   // Before (with dependency injection)
   const treeSplitter = new MarkdownTreeSplitter(options);
   const listSplitter = new ListSplitter(options, treeSplitter); // Complex
   
   // After (self-contained)
   const listSplitter = new ListSplitter(options); // Simple!
   ```

### Updated Class Specifications

#### ListSplitter (Revised)

```typescript
export class ListSplitter extends AbstractSplitter<List> {
  constructor(options: ChunkdownOptions) {
    super(options);
  }

  split(list: List): string[] {
    const chunks: string[] = [];
    let firstItemIndex = 0;

    const createChunk = (items: ListItem[]): void => {
      if (items.length === 0) return;

      const listChunk = { ...list, children: items };
      if (listChunk.ordered) {
        const originalStart = list.start || 1;
        listChunk.start = originalStart + firstItemIndex;
      }

      chunks.push(this.toMarkdown(listChunk));
      firstItemIndex += items.length;
    };

    let currentItems: ListItem[] = [];

    for (const item of list.children) {
      const itemNode = { ...list, children: [item] };
      const itemSize = this.getContentSize(itemNode);

      if (itemSize > this.options.chunkSize) {
        createChunk(currentItems);
        currentItems = [];

        if (this.isWithinAllowedSize(itemSize, this.toMarkdown(itemNode).length)) {
          if (itemNode.ordered) {
            itemNode.start = (list.start || 1) + firstItemIndex;
          }
          chunks.push(this.toMarkdown(itemNode));
        } else {
          // ✅ Create child splitter on-demand for recursive splitting
          chunks.push(...this.splitListItem(item, list, firstItemIndex));
        }
        firstItemIndex += 1;
        continue;
      }

      const testItems = [...currentItems, item];
      const tempList = { ...list, children: testItems };
      const tempMarkdown = this.toMarkdown(tempList);
      const tempSize = this.getContentSize(tempList);

      if (!this.isWithinAllowedSize(tempSize, tempMarkdown.length)) {
        createChunk(currentItems);
        currentItems = [item];
        continue;
      }

      currentItems.push(item);
    }

    createChunk(currentItems);
    return chunks;
  }

  private splitListItem(item: ListItem, parentList: List, itemIndex: number): string[] {
    const itemContent = item.children
      .map(child => this.toMarkdown(child))
      .join('');

    // ✅ Create new MarkdownTreeSplitter instance for recursive processing
    const childSplitter = new MarkdownTreeSplitter(this.options);
    const contentChunks = childSplitter.splitText(itemContent);

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

#### TableSplitter (Revised)

```typescript
export class TableSplitter extends AbstractSplitter<Table> {
  constructor(options: ChunkdownOptions) {
    super(options); // No treeSplitter dependency
  }

  split(table: Table): string[] {
    // ... main logic unchanged ...

    if (rowTooLarge) {
      chunks.push(...this.splitTableRow(row, table));
    }
  }

  private splitTableRow(row: TableRow, parentTable: Table): string[] {
    // Option 1: Split by cells
    const chunks: string[] = [];
    
    for (const cell of row.children) {
      const cellContent = this.toMarkdown(cell);
      
      // ✅ Create child splitter for cell content
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

#### BlockquoteSplitter (Revised)

```typescript
export class BlockquoteSplitter extends AbstractSplitter<Blockquote> {
  constructor(options: ChunkdownOptions) {
    super(options); // No treeSplitter dependency
  }

  split(blockquote: Blockquote): string[] {
    // ... main logic ...
    
    if (blockTooLarge) {
      const blockMarkdown = this.toMarkdown(block);
      
      // ✅ Create child splitter for nested content
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
  }
}
```

#### MarkdownTreeSplitter (Revised)

```typescript
export class MarkdownTreeSplitter extends AbstractSplitter {
  private nodeSplitters: Map<string, AbstractSplitter<any>>;
  private sectionSplitter: SectionSplitter;
  private textSplitter: TextSplitter;

  constructor(
    options: ChunkdownOptions, 
    customSplitters?: Map<string, AbstractSplitter<any>>
  ) {
    super(options);
    
    // Initialize specialized splitters
    this.textSplitter = new TextSplitter(options);
    
    // ✅ SectionSplitter still needs reference for delegation pattern
    // (sections don't create child splitters, they delegate to parent)
    this.sectionSplitter = new SectionSplitter(options, this);
    
    // ✅ Node splitters are now self-contained
    this.nodeSplitters = customSplitters ?? new Map([
      ['list', new ListSplitter(options)],           // No dependency!
      ['table', new TableSplitter(options)],         // No dependency!
      ['blockquote', new BlockquoteSplitter(options)], // No dependency!
    ]);
  }

  split(node: Nodes): string[] {
    const splitter = this.nodeSplitters.get(node.type);
    
    if (splitter) {
      return splitter.split(node);
    }
    
    const markdown = this.toMarkdown(node);
    const contentSize = this.getContentSize(markdown);
    
    if (this.isWithinAllowedSize(contentSize, markdown.length)) {
      return [markdown];
    }
    
    return this.textSplitter.split(markdown);
  }

  splitText(text: string): string[] {
    if (!text || !text.trim()) return [];

    const tree = fromMarkdown(text);
    const hierarchicalAST = createHierarchicalAST(tree);
    const chunks = this.processHierarchicalAST(hierarchicalAST);

    return chunks.map(c => c.trim()).filter(c => c.length > 0);
  }

  private processHierarchicalAST(hierarchicalAST: HierarchicalRoot): string[] {
    // Delegate to section splitter for section processing
    // Section splitter uses this instance for node delegation
  }
}
```

### Special Case: SectionSplitter

**Why it still needs the reference:**

```typescript
export class SectionSplitter extends AbstractSplitter<Section> {
  private treeSplitter: MarkdownTreeSplitter;

  // ✅ Still needs reference - sections delegate to orchestrator
  constructor(options: ChunkdownOptions, treeSplitter: MarkdownTreeSplitter) {
    super(options);
    this.treeSplitter = treeSplitter;
  }

  private processNode(node: Nodes): string[] {
    // Delegate back to tree splitter for proper routing
    return this.treeSplitter.split(node);
  }
}
```

**Reasoning:**
- Sections contain arbitrary nodes (paragraphs, lists, tables, etc.)
- Need to delegate to orchestrator for proper routing
- Creating new MarkdownTreeSplitter would lose the node splitter registry
- This is a **delegation pattern**, not recursive splitting

### Performance Consideration

**Question:** Does creating new `MarkdownTreeSplitter` instances impact performance?

**Answer:** Minimal impact because:
1. Recursive splitting only happens for oversized content (rare case)
2. Constructor is lightweight (just sets options, creates splitter instances)
3. Modern JS engines optimize short-lived object allocation
4. Trade-off worth it for cleaner architecture

**If performance becomes an issue:**
```typescript
class ListSplitter extends AbstractSplitter<List> {
  private splitterCache?: MarkdownTreeSplitter;

  private getChildSplitter(): MarkdownTreeSplitter {
    if (!this.splitterCache) {
      this.splitterCache = new MarkdownTreeSplitter(this.options);
    }
    return this.splitterCache;
  }

  private splitListItem(...): string[] {
    const childSplitter = this.getChildSplitter();
    return childSplitter.splitText(itemContent);
  }
}
```

### Updated Architecture Diagram

```
┌─────────────────────────┐
│  AbstractSplitter       │
│  - options              │
│  - isWithinAllowedSize()│
│  + split(node): string[]│
└─────────────────────────┘
            ▲
            │
            ├──────────────────────────────────────┐
            │                                      │
┌───────────┴──────────────┐      ┌───────────────┴────────┐
│ MarkdownTreeSplitter     │      │ TextSplitter           │
│ - nodeSplitters: Map     │      │ - boundaryPatterns     │
│ - sectionSplitter*       │      │ + split(text): []      │
│ + split(node): string[]  │      └────────────────────────┘
│ + splitText(text): []    │
└──────────────────────────┘
            │
            │ uses (no constructor dep!)
            ├───────────────┬──────────────┬────────────────┐
            │               │              │                │
   ┌────────┴────────┐  ┌──┴──────────┐  ┌┴─────────────┐  ┌┴──────────────┐
   │  ListSplitter   │  │TableSplitter│  │Blockquote    │  │Section        │
   │                 │  │             │  │Splitter      │  │Splitter*      │
   │ Creates child   │  │Creates child│  │Creates child │  │Uses parent    │
   │ splitter on     │  │splitter on  │  │splitter on   │  │for delegation │
   │ demand          │  │demand       │  │demand        │  │(special case) │
   └─────────────────┘  └─────────────┘  └──────────────┘  └───────────────┘

* SectionSplitter is special - uses reference for delegation pattern
```

### Conclusion

**This revised design is superior because:**

✅ Each splitter is truly standalone  
✅ No circular dependencies  
✅ Easier to test (no mocking required)  
✅ Simpler construction (just pass options)  
✅ Clear separation of concerns  
✅ Recursive splitting still works perfectly  

The only exception is `SectionSplitter`, which legitimately needs a reference to the orchestrator for the delegation pattern (not recursive splitting).

---

## FINAL REVISION: Sections Are Internal to MarkdownTreeSplitter

### Critical Architectural Decision

After further analysis, **sections should NOT be a separate splitter class**. They should be internal private methods of `MarkdownTreeSplitter`.

### Why Sections Are Different

**Sections vs Node-Type Splitters:**

| Aspect | Node Splitters (List, Table, etc.) | Sections |
|--------|-------------------------------------|----------|
| **Type** | Real mdast node types | Synthetic type we created |
| **Origin** | Part of markdown specification | Created by `createHierarchicalAST()` |
| **Purpose** | Content with specific semantics | Structural organization |
| **User Override** | Yes - custom behavior makes sense | No - core algorithm |
| **Dependency** | Self-contained | Needs orchestrator reference |

**Real mdast node types (extractable to splitters):**
- `list` - Has specific markdown syntax, contains list items
- `table` - Has specific markdown syntax, contains rows
- `blockquote` - Has specific markdown syntax, wraps content
- `code` - Has specific markdown syntax, contains code

**Sections (part of tree structure):**
- `section` - Synthetic node created from headings (not in mdast spec)
- Represents document hierarchy (the organizing principle)
- Used to organize chunking strategy (not content to be split)
- IS the core algorithm (not a pluggable handler)

### Evidence from Code

From `ast.ts`:
```typescript
export interface Section extends Node {
  type: 'section';  // ← Custom type, NOT in mdast specification
  depth: number;
  heading: Heading | undefined;
  children: (RootContent | Section)[];
}
```

From `splitter.ts`:
```typescript
// Section processing IS the core algorithm
const processHierarchicalAST = (hierarchicalAST: HierarchicalRoot): string[] => {
  for (const child of hierarchicalAST.children) {
    if (isSection(child)) {
      const sectionChunks = processHierarchicalSection(child);
      chunks.push(...sectionChunks);
    }
  }
}
```

The entire splitting strategy is built around sections. MarkdownTreeSplitter **IS** the hierarchical section processor.

### Updated Architecture

#### Before (7 classes, with SectionSplitter)
```
AbstractSplitter
├── MarkdownTreeSplitter
│   ├── uses → ListSplitter
│   ├── uses → TableSplitter
│   ├── uses → BlockquoteSplitter
│   └── uses → SectionSplitter ❌ (needs reference back - circular!)
└── TextSplitter
```

#### After (6 classes, sections internal)
```
AbstractSplitter
├── MarkdownTreeSplitter (includes section processing)
│   ├── PUBLIC: splitText(), split()
│   ├── PRIVATE: processHierarchicalAST()
│   ├── PRIVATE: processHierarchicalSection()
│   ├── PRIVATE: processSection()
│   ├── PRIVATE: breakDownSection()
│   ├── PRIVATE: mergeParentWithDescendants()
│   ├── PRIVATE: mergeSiblingSections()
│   │
│   ├── uses → ListSplitter ✅
│   ├── uses → TableSplitter ✅
│   └── uses → BlockquoteSplitter ✅
└── TextSplitter
```

### Revised MarkdownTreeSplitter

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
    
    // ✅ Only real mdast node types in registry
    this.nodeSplitters = customSplitters ?? new Map([
      ['list', new ListSplitter(options)],
      ['table', new TableSplitter(options)],
      ['blockquote', new BlockquoteSplitter(options)],
      // NO 'section' - it's not a node type, it's the algorithm!
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
    
    const markdown = this.toMarkdown(node);
    const contentSize = this.getContentSize(markdown);
    
    if (this.isWithinAllowedSize(contentSize, markdown.length)) {
      return [markdown];
    }
    
    return this.textSplitter.split(markdown);
  }

  // ===== SECTION PROCESSING (PRIVATE - CORE ALGORITHM) =====
  
  private processHierarchicalAST(hierarchicalAST: HierarchicalRoot): string[] {
    const chunks: string[] = [];
    const groupedChildren: (Section | RootContent)[] = [];
    let currentOrphanedContent: RootContent[] = [];

    for (const child of hierarchicalAST.children) {
      if (isSection(child)) {
        if (currentOrphanedContent.length > 0) {
          const orphanedSection: Section = {
            type: 'section',
            depth: 0,
            heading: undefined,
            children: currentOrphanedContent,
          };
          groupedChildren.push(orphanedSection);
          currentOrphanedContent = [];
        }
        groupedChildren.push(child);
      } else {
        currentOrphanedContent.push(child);
      }
    }

    if (currentOrphanedContent.length > 0) {
      const orphanedSection: Section = {
        type: 'section',
        depth: 0,
        heading: undefined,
        children: currentOrphanedContent,
      };
      groupedChildren.push(orphanedSection);
    }

    for (const child of groupedChildren) {
      if (isSection(child)) {
        const sectionChunks = this.processHierarchicalSection(child);
        chunks.push(...sectionChunks);
      } else {
        const contentMarkdown = toMarkdown(child);
        chunks.push(contentMarkdown);
      }
    }

    return chunks;
  }

  private processHierarchicalSection(section: Section): string[] {
    const sectionSize = this.getSectionSize(section);
    const sectionMarkdown = this.convertSectionToMarkdown(section);

    if (this.isWithinAllowedSize(sectionSize, sectionMarkdown.length)) {
      return [sectionMarkdown];
    }

    return this.breakDownSection(section);
  }

  private processSection(section: Section): string[] {
    // Implementation from current lines 450-531
    // Groups immediate content, delegates nodes to this.split()
  }

  private breakDownSection(section: Section): string[] {
    // Implementation from current lines 540-574
    // Separates immediate content from nested sections
  }

  private mergeParentWithDescendants(
    parentSection: Section | null,
    nestedSections: Section[]
  ): string[] {
    // Implementation from current lines 583-676
    // Optimization for merging parent with children
  }

  private mergeSiblingSections(sections: Section[]): string[] {
    // Implementation from current lines 685-755
    // Optimization for merging siblings
  }

  private getSectionSize(section: Section): number {
    // Implementation from current lines 162-182
  }

  private convertSectionToMarkdown(section: Section): string {
    // Implementation from current lines 191-198
  }
}
```

### Benefits of This Approach

1. **Conceptual Clarity**
   - Clear distinction between "tree structure" (sections) and "content nodes" (list, table, etc.)
   - Sections are the organizing principle, not a node type

2. **No Circular References**
   - SectionSplitter needed MarkdownTreeSplitter reference
   - This was a code smell indicating wrong abstraction level

3. **Simpler API**
   ```typescript
   // Users only register REAL node type splitters
   const customSplitters = new Map([
     ['list', new MyListSplitter(options)],
     ['table', new MyTableSplitter(options)],
     ['code', new CodeBlockSplitter(options)],
     // No 'section' - it's not exposed!
   ]);
   
   const splitter = new MarkdownTreeSplitter(options, customSplitters);
   ```

4. **Better Cohesion**
   - All hierarchical processing logic in one place
   - Section merging strategies are tightly coupled to tree algorithm
   - Easier to understand: "MarkdownTreeSplitter processes the hierarchical tree"

5. **Proper Encapsulation**
   - Section processing is internal implementation detail
   - Users work with content node types, not structural organization

### Updated Class Count: 6 Classes

1. **AbstractSplitter** - Base class with shared utilities
2. **MarkdownTreeSplitter** - Orchestrator + section processing (internal)
3. **ListSplitter** - Handles mdast `list` nodes
4. **TableSplitter** - Handles mdast `table` nodes
5. **BlockquoteSplitter** - Handles mdast `blockquote` nodes
6. **TextSplitter** - Text-level boundary splitting

**Removed:** SectionSplitter (now internal to MarkdownTreeSplitter)

### Updated File Structure

```
src/
├── splitters/
│   ├── index.ts                    # Export all splitters
│   ├── types.ts                    # Shared types
│   ├── utils.ts                    # Shared utilities
│   │
│   ├── AbstractSplitter.ts         # Base class (120 lines)
│   ├── MarkdownTreeSplitter.ts     # Orchestrator + sections (500 lines)
│   ├── TextSplitter.ts             # Text splitting (300 lines)
│   ├── ListSplitter.ts             # List handling (150 lines)
│   ├── TableSplitter.ts            # Table handling (120 lines)
│   └── BlockquoteSplitter.ts       # Blockquote handling (100 lines)
│   # NO SectionSplitter.ts - sections are internal!
│
├── splitter.ts                     # chunkdown() factory + legacy exports
├── ast.ts                          # Unchanged
├── markdown.ts                     # Unchanged
└── index.ts                        # Main exports
```

### Updated Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    AbstractSplitter                         │
│                    (Base Class)                             │
│                                                             │
│  - options: ChunkdownOptions                                │
│  - maxAllowedSize: number                                   │
│  + abstract split(node): string[]                           │
│  # isWithinAllowedSize(): boolean                           │
│  # getContentSize(): number                                 │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
         ┌────────────────────┴───────────────────────┐
         │                                            │
┌────────┴─────────────────────────────┐   ┌─────────┴─────────────┐
│   MarkdownTreeSplitter               │   │   TextSplitter        │
│   (Orchestrator + Sections)          │   │                       │
│                                      │   │ - boundaryPatterns    │
│ - nodeSplitters: Map                 │   │                       │
│ - textSplitter: TextSplitter         │   │ + split(text): []     │
│                                      │   └───────────────────────┘
│ PUBLIC API:                          │
│ + splitText(text): string[]          │
│ + split(node): string[]              │
│                                      │
│ SECTION PROCESSING (PRIVATE):        │
│ - processHierarchicalAST()           │
│ - processHierarchicalSection()       │
│ - processSection()                   │
│ - breakDownSection()                 │
│ - mergeParentWithDescendants()       │
│ - mergeSiblingSections()             │
│ - getSectionSize()                   │
│ - convertSectionToMarkdown()         │
└──────────────────────────────────────┘
                │
                │ uses (runtime, no constructor dep)
                │
    ┌───────────┼───────────────┬──────────────────┐
    │           │               │                  │
┌───┴────────┐ ┌┴────────────┐ ┌┴───────────────┐  │
│List        │ │Table        │ │Blockquote      │  │
│Splitter    │ │Splitter     │ │Splitter        │  │
│            │ │             │ │                │  │
│Creates     │ │Creates      │ │Creates         │  │
│child       │ │child        │ │child           │  │
│splitter    │ │splitter     │ │splitter        │  │
│on-demand   │ │on-demand    │ │on-demand       │  │
└────────────┘ └─────────────┘ └────────────────┘  │
                                                    │
                                    ┌───────────────┘
                                    │
                          Future extensibility:
                          CodeSplitter, ParagraphSplitter, etc.
```

### Updated Migration Strategy

#### Phase 1: Extract Utilities (2-3 days)
- Create `src/splitters/utils.ts` with shared functions
- Create `src/splitters/types.ts` with shared types
- Update imports in `splitter.ts`

#### Phase 2: Create Base Class (2-3 days)
- Implement `AbstractSplitter`
- Write unit tests

#### Phase 3: Extract TextSplitter (2-3 days)
- Extract text splitting logic (lines 1181-1416)
- Make standalone with own tests

#### Phase 4: Create MarkdownTreeSplitter Shell (2-3 days)
- Create class structure
- **Move section processing as PRIVATE methods** (lines 400-755, 999-1063)
- Wire up with TextSplitter

#### Phase 5: Extract Node Splitters (4-5 days)
- Create ListSplitter from `processList()` (lines 853-929)
- Create TableSplitter from `processTable()` (lines 763-844)
- Create BlockquoteSplitter from `processBlockquote()` (lines 937-991)
- **NO SectionSplitter** - sections stay internal
- Add standalone tests for each

#### Phase 6: Add Recursive Splitting (3-4 days)
- Implement `splitListItem()` in ListSplitter
- Implement `splitTableRow()` in TableSplitter
- Implement recursive blockquote handling
- Test deeply nested structures

#### Phase 7: Update Factory & Tests (1-2 days)
- Update `chunkdown()` to use new classes
- Ensure all existing tests pass
- Add integration tests

**Total: 16-23 days**

### Conclusion

**Sections should be internal to MarkdownTreeSplitter because:**

1. ✅ Sections are synthetic (not mdast standard nodes)
2. ✅ Sections represent structure, not content
3. ✅ Section processing IS the core splitting algorithm
4. ✅ Avoids circular dependency with orchestrator
5. ✅ Better encapsulation and cohesion
6. ✅ Clearer API (only real node types are customizable)
7. ✅ Simpler architecture (6 classes instead of 7)

**Node splitters are for content types with specific semantics:**
- Lists have items, ordering, numbering
- Tables have rows, cells, headers
- Blockquotes have nested content wrapping
- Code has language, syntax highlighting

**Sections are the structural organizing framework, not content to be split.**

This is the final, optimal architecture combining both key insights:
1. Self-contained splitters (create child instances on-demand)
2. Sections as internal algorithm (not a separate splitter)
