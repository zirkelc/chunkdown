import type { Blockquote, List, Node, Nodes, RootContent, Table } from 'mdast';
import {
  createHierarchicalAST,
  flattenHierarchicalAST,
  type HierarchicalRoot,
  isSection,
  type Section,
} from './ast';
import { fromMarkdown, toMarkdown, toString } from './markdown';

export type ChunkdownOptions = {
  /**
   * Preferred chunk size.
   * Content size will be calculated using the actual text content without markdown formatting characters.
   * That means the raw text length of each chunk will be usually greater than the `chunkSize`.
   */
  chunkSize: number;
  /**
   * Maximum overflow ratio for preserving semantic units.
   * - 1.0 = strict size limits, no overflow allowed
   * - >1.0 = allow overflow to preserve semantic coherence
   * For example, 1.5 means allow chunks up to 50% larger than chunkSize
   * to keep semantic units (sections, lists, code blocks) together.
   */
  maxOverflowRatio: number;
};

// TODO
type Breakpoints = {
  [node: Node['type']]: Breakpoint;
};

// TODO
type Breakpoint =
  | number
  | {
      size: number;
      breakMode?: 'keep' | 'clean' | 'extend';
      onBreak?: (node: Node) => void;
    };

/**
 * Represents a protected range in the text that should not be split
 * Contains the start and end positions and the type of the protected content
 */
type ProtectedRange = {
  start: number;
  end: number;
  type: string;
};

/**
 * Represents a structural boundary in the document
 * Used to identify natural breaking points in the text
 */
type StructuralBoundary = {
  position: number;
  type: string;
  priority: number;
};

/**
 * Represents a sentence with its position information
 * Used for sentence-level text splitting
 */
type SentenceInfo = {
  text: string;
  start: number;
  end: number;
};

/**
 * Calculate the content size of markdown content or AST node
 * Uses the actual text content without markdown formatting characters
 *
 * @param input - The markdown text or AST node to measure
 * @returns The size of the actual text content (without formatting)
 */
export const getContentSize = (input: string | Node): number => {
  if (!input) return 0;

  // If input is a string, parse it first
  if (typeof input === 'string') {
    const ast = fromMarkdown(input);
    return getContentSize(ast);
  }

  // If input is already an AST node, extract text directly
  const plainText = toString(input);
  return plainText.length;
};

/**
 * Calculate the total content length of a hierarchical section
 * including its heading, immediate content, and all nested subsections
 *
 * @param section - The section to measure
 * @returns The total content length
 */
export const getSectionSize = (section: Section): number => {
  let totalLength = 0;

  // Get heading text length if it exists (not a shadow section)
  if (section.heading) {
    totalLength = getContentSize(section.heading);
  }

  // Add length of all children (content and nested sections)
  for (const child of section.children) {
    if (isSection(child)) {
      // Recursively calculate nested section size
      totalLength += getSectionSize(child);
    } else {
      // Get text length directly from child node
      totalLength += getContentSize(child);
    }
  }

  return totalLength;
};

/**
 * Convert a hierarchical section back to markdown format
 * Handles the conversion of Section nodes which aren't native mdast nodes
 *
 * @param section - The section to convert
 * @returns Markdown string representation
 */
const convertSectionToMarkdown = (section: Section): string => {
  const flattened = flattenHierarchicalAST({
    type: 'root',
    children: [section],
  });

  return toMarkdown(flattened);
};

// TODO
class Chunks extends Array<string> {
  override push(...items: Array<string | Nodes>): number {
    for (const item of items) {
      const markdown = typeof item === 'string' ? item : toMarkdown(item);
      const trimmed = markdown.trim();
      if (trimmed) {
        super.push(trimmed);
      }
    }
    return this.length;
  }
}

/**
 * Hierarchical Markdown Text Splitter with Semantic Awareness
 *
 * This splitter intelligently breaks markdown text into chunks using a hierarchical approach
 * that preserves document structure and semantic relationships:
 *
 * 1. Parse markdown into an Abstract Syntax Tree (AST) using mdast
 * 2. Transform flat AST into hierarchical sections (headings contain their content)
 * 3. Apply top-down chunking with intelligent overflow for semantic preservation
 * 4. Fall back to text-based splitting only for oversized content
 * 5. Preserve original markdown formatting throughout the process
 */
export const chunkdown = (options: ChunkdownOptions) => {
  const { chunkSize, maxOverflowRatio } = options;
  const maxAllowedSize = chunkSize * maxOverflowRatio;

  /**
   * Breakpoints for protecting markdown constructs based on content length
   * Constructs shorter than these values will be protected from splitting
   */
  const BREAKPOINTS: Breakpoints = {
    link: Number.POSITIVE_INFINITY,
    image: Number.POSITIVE_INFINITY,
    emphasis: Math.min(30, maxAllowedSize),
    strong: Math.min(30, maxAllowedSize),
    delete: Math.min(30, maxAllowedSize),
    heading: Math.min(80, maxAllowedSize),
    inlineCode: Math.min(100, maxAllowedSize),
  };

  /**
   * Check if a size is within the soft limit (target size + allowed overflow)
   *
   * @param size - The size to check
   * @param targetSize - The target chunk size
   * @returns True if within soft limit
   */
  const isWithinAllowedSize = (size: number): boolean => {
    return size <= maxAllowedSize;
  };

  /**
   * Check if a node is within its protection breakpoint
   *
   * @param node - The AST node to check
   * @returns true if the node is within its breakpoint, false otherwise
   */
  const isWithinBreakpoint = (node: Node): boolean => {
    const breakpoint = BREAKPOINTS[node.type];
    if (!breakpoint) return false;

    const breakingSize =
      typeof breakpoint === 'object' ? breakpoint.size : breakpoint;
    const contentSize = getContentSize(node);
    return contentSize <= breakingSize;
  };

  /**
   * Process a hierarchical section using top-down approach with soft limits
   * Tries to keep entire sections together, falls back to intelligent breaking
   *
   * @param section - The section to process
   * @param protectedRanges - Pre-computed protected ranges from AST
   * @returns Array of markdown chunks
   */
  const processHierarchicalSection = (
    section: Section,
    protectedRanges: ProtectedRange[],
  ): string[] => {
    const sectionSize = getSectionSize(section);

    // Case 1: Section fits within soft limit - keep it together
    if (isWithinAllowedSize(sectionSize)) {
      const sectionMarkdown = convertSectionToMarkdown(section);
      return [sectionMarkdown.trim()];
    }

    // Case 2: Section too large - need to break it down intelligently
    return breakDownSection(section, protectedRanges);
  };

  /**
   * Process a single content node that may be too large for a chunk
   * Handles lists specially by trying to split by items first
   *
   * @param contentNode - The content node to process
   * @returns Array of markdown chunks
   */
  const processLargeContentNode = (contentNode: RootContent): string[] => {
    const chunks: string[] = [];
    const contentSize = getContentSize(contentNode);

    if (isWithinAllowedSize(contentSize)) {
      const contentMarkdown = toMarkdown(contentNode);
      chunks.push(contentMarkdown.trim());
    } else {
      // Content too large - check if it's a container that can be split by items
      if (
        (contentNode.type === 'list' ||
          contentNode.type === 'table' ||
          contentNode.type === 'blockquote') &&
        contentNode.children
      ) {
        // Try to split container by items
        const containerChunks = processContainerItems(contentNode);
        chunks.push(...containerChunks);
      } else {
        // Not a container - fall back to text splitting
        const contentMarkdown = toMarkdown(contentNode);
        const contentAST = fromMarkdown(contentMarkdown.trim());
        const contentProtectedRanges =
          extractProtectedRangesFromAST(contentAST);
        const fallbackChunks = splitLongText(
          contentMarkdown.trim(),
          contentProtectedRanges,
          0,
          contentAST,
        );
        chunks.push(...fallbackChunks);
      }
    }

    return chunks;
  };

  /**
   * Process section content with intelligent grouping to maximize chunk utilization
   * Works for both regular sections (with heading) and shadow sections (without heading)
   *
   * @param section - The section to process (can be regular or shadow)
   * @returns Array of markdown chunks with maximized utilization
   */
  const processSection = (section: Section): string[] => {
    // Extract immediate content (non-section children)
    const contentItems: RootContent[] = [];
    for (const child of section.children) {
      if (!isSection(child)) {
        contentItems.push(child);
      }
    }

    // Handle empty sections
    if (contentItems.length === 0 && section.heading) {
      // Only heading - check if it fits
      const headingMarkdown = toMarkdown(section.heading);
      const headingSize = getContentSize(headingMarkdown);

      if (isWithinAllowedSize(headingSize)) {
        return [headingMarkdown.trim()];
      } else {
        return processLargeContentNode(section.heading);
      }
    } else if (contentItems.length === 0 && !section.heading) {
      // Empty shadow section
      return [];
    }

    const chunks: string[] = [];
    let currentItems: RootContent[] = [];

    // Start with heading if it exists
    if (section.heading) {
      currentItems.push(section.heading);
    }

    const flushCurrentItems = () => {
      if (currentItems.length > 0) {
        const itemsMarkdown = toMarkdown({
          type: 'root',
          children: currentItems,
        });
        const trimmedMarkdown = itemsMarkdown.trim();
        if (trimmedMarkdown) {
          chunks.push(trimmedMarkdown);
        }
        currentItems = [];
      }
    };

    for (const item of contentItems) {
      // Calculate size if this item were added to current group
      const testItems = [...currentItems, item];
      const testItemsMarkdown = toMarkdown({
        type: 'root',
        children: testItems,
      });
      const testItemsSize = getContentSize(testItemsMarkdown);

      if (isWithinAllowedSize(testItemsSize)) {
        // Item fits - add to current group to maximize utilization
        currentItems.push(item);
      } else {
        // Item doesn't fit - flush current group and handle this item
        flushCurrentItems();

        // Check if item alone fits within soft limits
        const itemMarkdown = toMarkdown(item);
        const itemSize = getContentSize(itemMarkdown);

        if (isWithinAllowedSize(itemSize)) {
          // Item fits alone - start new group with it
          currentItems = [item];
        } else {
          // Item too large even alone - needs text splitting
          chunks.push(...processLargeContentNode(item));
        }
      }
    }

    // Flush final group
    flushCurrentItems();

    return chunks;
  };

  /**
   * Break down a large section intelligently using hierarchical approach with merging optimization
   * Tries to merge related sections when they fit within allowed size limits
   *
   * @param section - The section to break down
   * @param protectedRanges - Pre-computed protected ranges from AST
   * @returns Array of markdown chunks optimized for space utilization
   */
  const breakDownSection = (
    section: Section,
    protectedRanges: ProtectedRange[],
  ): string[] => {
    const chunks: string[] = [];

    // Separate immediate content from nested sections
    const immediateContent: RootContent[] = [];
    const nestedSections: Section[] = [];

    for (const child of section.children) {
      if (isSection(child)) {
        nestedSections.push(child);
      } else {
        immediateContent.push(child);
      }
    }

    // Create parent section with immediate content if it exists
    let parentSection: Section | null = null;
    if (immediateContent.length > 0 || section.heading) {
      parentSection = {
        type: 'section',
        depth: section.depth,
        heading: section.heading,
        children: immediateContent,
      };
    }

    // Try to optimize chunks by merging related sections
    const optimizedChunks = mergeParentWithDescendants(
      parentSection,
      nestedSections,
      protectedRanges,
    );

    chunks.push(...optimizedChunks);
    return chunks;
  };

  /**
   * Merge parent section with its descendants when beneficial for space utilization
   * Uses intelligent merging to maximize chunk utilization while preserving semantic relationships
   *
   * @param parentSection - The parent section (with heading and immediate content)
   * @param nestedSections - Array of nested child sections
   * @param protectedRanges - Pre-computed protected ranges from AST
   * @returns Array of optimized markdown chunks
   */
  const mergeParentWithDescendants = (
    parentSection: Section | null,
    nestedSections: Section[],
    protectedRanges: ProtectedRange[],
  ): string[] => {
    const chunks: string[] = [];

    // If no nested sections, just process the parent if it exists
    if (nestedSections.length === 0) {
      if (parentSection) {
        chunks.push(...processSection(parentSection));
      }
      return chunks;
    }

    // Calculate parent section size if it exists
    const parentSize = parentSection ? getSectionSize(parentSection) : 0;
    let mergedWithParent = false;

    // Strategy 1: Try to merge parent section with child sections
    if (parentSection && isWithinAllowedSize(parentSize)) {
      const candidateSections: Section[] = [];
      let accumulatedSize = parentSize;

      // Find consecutive child sections that can merge with parent
      for (const childSection of nestedSections) {
        const childSize = getSectionSize(childSection);
        const combinedSize = accumulatedSize + childSize;

        if (isWithinAllowedSize(combinedSize)) {
          candidateSections.push(childSection);
          accumulatedSize = combinedSize;
        } else {
          break; // Stop at first child that doesn't fit
        }
      }

      // If we found sections to merge with parent, create merged section
      if (candidateSections.length > 0) {
        const mergedSection: Section = {
          type: 'section',
          depth: parentSection.depth,
          heading: parentSection.heading,
          children: [...parentSection.children, ...candidateSections],
        };

        const mergedChunk = convertSectionToMarkdown(mergedSection);
        chunks.push(mergedChunk.trim());
        mergedWithParent = true;

        // Process remaining child sections that didn't merge with parent
        const remainingSections = nestedSections.slice(
          candidateSections.length,
        );
        if (remainingSections.length > 0) {
          const remainingChunks = mergeSiblingSections(
            remainingSections,
            protectedRanges,
          );
          chunks.push(...remainingChunks);
        }
      }
    }

    // Strategy 2: If parent couldn't be merged or doesn't exist, process sections separately
    if (!mergedWithParent) {
      // Add parent section as separate chunk if it exists
      if (parentSection) {
        chunks.push(...processSection(parentSection));
      }

      // Optimize child sections through sibling merging
      if (nestedSections.length > 0) {
        const siblingChunks = mergeSiblingSections(
          nestedSections,
          protectedRanges,
        );
        chunks.push(...siblingChunks);
      }
    }

    return chunks;
  };

  /**
   * Merge sibling sections by grouping consecutive sections that fit within allowed size
   * Groups siblings at the same hierarchical level for better space utilization
   *
   * @param sections - Array of sibling sections to merge
   * @param protectedRanges - Pre-computed protected ranges from AST
   * @returns Array of optimized markdown chunks
   */
  const mergeSiblingSections = (
    sections: Section[],
    protectedRanges: ProtectedRange[],
  ): string[] => {
    const chunks: string[] = [];
    let currentGroup: Section[] = [];
    let currentGroupSize = 0;

    const flushCurrentGroup = () => {
      if (currentGroup.length === 0) return;

      if (currentGroup.length === 1) {
        // Single section - process normally
        const sectionChunks = processHierarchicalSection(
          currentGroup[0],
          protectedRanges,
        );
        chunks.push(...sectionChunks);
      } else {
        // Multiple sections - merge them into a shadow section
        const mergedSection: Section = {
          type: 'section',
          depth: 0, // Shadow section depth
          heading: undefined,
          children: currentGroup,
        };

        const mergedChunk = convertSectionToMarkdown(mergedSection);
        chunks.push(mergedChunk.trim());
      }

      currentGroup = [];
      currentGroupSize = 0;
    };

    for (const section of sections) {
      const sectionSize = getSectionSize(section);

      // Check if section fits within allowed size by itself
      if (!isWithinAllowedSize(sectionSize)) {
        // Section is too large - flush current group and process this section separately
        flushCurrentGroup();
        const sectionChunks = processHierarchicalSection(
          section,
          protectedRanges,
        );
        chunks.push(...sectionChunks);
        continue;
      }

      // Check if adding this section to current group would exceed allowed size
      const combinedSize = currentGroupSize + sectionSize;
      if (currentGroup.length > 0 && !isWithinAllowedSize(combinedSize)) {
        // Doesn't fit - flush current group and start new one
        flushCurrentGroup();
      }

      // Add section to current group
      currentGroup.push(section);
      currentGroupSize += sectionSize;
    }

    // Flush final group
    flushCurrentGroup();

    return chunks;
  };

  /**
   * Process a container (list, table, or blockquote) by trying to keep individual items together
   * This handles lists, tables, and blockquotes using a generic approach
   *
   * @param container - The container node (list, table, or blockquote)
   * @returns Array of markdown chunks
   */
  const processContainerItems = <TContainer extends List | Table | Blockquote>(
    container: TContainer,
  ): string[] => {
    const chunks: string[] = [];
    let currentItems: Array<(typeof container.children)[0]> = [];
    let currentSize = 0;
    let firstItemIndex = 0; // Track the index of the first item in current chunk

    const setListStart = (list: List) => {
      const originalStart = list.start || 1;
      const itemNumber = originalStart + firstItemIndex;
      list.start = itemNumber;
    };

    // Helper to flush accumulated items
    const flushCurrentItems = () => {
      if (currentItems.length > 0) {
        const currentItemsGroup = {
          ...container,
          children: currentItems,
        };

        // For ordered lists, calculate the correct start number
        if (currentItemsGroup.type === 'list' && currentItemsGroup.ordered) {
          setListStart(currentItemsGroup);
        }

        const currentItemsMarkdown = toMarkdown(currentItemsGroup);
        chunks.push(currentItemsMarkdown.trim());
        firstItemIndex += currentItems.length; // Update index for next chunk
        currentItems = [];
        currentSize = 0;
      }
    };

    const items = container.children;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemNode = {
        ...container,
        children: [item],
      };
      // const itemMarkdown = toMarkdown({
      //   ...container,
      //   children: [item],
      // } as TContainer);
      const itemSize = getContentSize(itemNode);

      // Special handling for keeping first item with second item (e.g., table header + separator)
      if (container.type === 'table' && i === 0 && items.length > 1) {
        // For the first item, try to include it with the second item if possible
        const secondRowMarkdown = toMarkdown({
          ...container,
          children: [item, items[1]],
        } as TContainer);
        const combinedSize = getContentSize(secondRowMarkdown);

        if (isWithinAllowedSize(combinedSize)) {
          // Keep first item with second item
          currentItems = [item, items[1]];
          currentSize = combinedSize;
          i++; // Skip the next iteration since we processed two items
          continue;
        }
      }

      // Check if this single item exceeds chunk size but is within soft limit
      if (itemSize > chunkSize && isWithinAllowedSize(itemSize)) {
        flushCurrentItems();

        // For ordered lists, ensure correct numbering
        if (itemNode.type === 'list' && itemNode.ordered) {
          setListStart(itemNode);
        }

        const itemMarkdown = toMarkdown(itemNode).trim();
        chunks.push(itemMarkdown);
        firstItemIndex += 1; // Increment for this processed item
      } else if (itemSize > chunkSize && !isWithinAllowedSize(itemSize)) {
        // Item is too large even with overflow - need to split it
        flushCurrentItems();

        // For ordered lists, preserve the correct numbering for the first chunk
        if (itemNode.type === 'list' && itemNode.ordered) {
          setListStart(itemNode);
        }

        // Parse AST from trimmed markdown to extract the correct protected ranges
        const itemMarkdown = toMarkdown(itemNode).trim();
        const itemAST = fromMarkdown(itemMarkdown);
        const itemProtectedRanges = extractProtectedRangesFromAST(itemAST);
        const itemChunks = splitLongText(
          itemMarkdown,
          itemProtectedRanges,
          0,
          itemAST,
        );
        chunks.push(...itemChunks);
        firstItemIndex += 1; // Increment for this processed item
      } else if (!isWithinAllowedSize(currentSize + itemSize)) {
        // Adding this item would exceed allowed size (including overflow)
        flushCurrentItems();

        // Start new chunk with this item
        currentItems = [item];
        currentSize = itemSize;
      } else {
        // Add item to current chunk
        currentItems.push(item);
        currentSize += itemSize;
      }
    }

    // Flush any remaining items
    flushCurrentItems();

    return chunks;
  };

  /**
   * Process hierarchical AST using top-down approach
   *
   * @param hierarchicalAST - The hierarchical AST to process
   * @param protectedRanges - Pre-computed protected ranges from AST
   * @returns Array of markdown chunks
   */
  const processHierarchicalAST = (
    hierarchicalAST: HierarchicalRoot,
    protectedRanges: ProtectedRange[],
  ): string[] => {
    const chunks: string[] = [];

    // Group consecutive non-section children into shadow sections
    const groupedChildren: (Section | RootContent)[] = [];
    let currentOrphanedContent: RootContent[] = [];

    for (const child of hierarchicalAST.children) {
      if (isSection(child)) {
        // If we have accumulated orphaned content, create a shadow section
        if (currentOrphanedContent.length > 0) {
          const shadowSection: Section = {
            type: 'section',
            depth: 0,
            heading: undefined,
            children: currentOrphanedContent,
          };
          groupedChildren.push(shadowSection);
          currentOrphanedContent = [];
        }
        // Add the regular section
        groupedChildren.push(child);
      } else {
        // Accumulate orphaned content
        currentOrphanedContent.push(child);
      }
    }

    // Don't forget any remaining orphaned content at the end
    if (currentOrphanedContent.length > 0) {
      const shadowSection: Section = {
        type: 'section',
        depth: 0,
        heading: undefined,
        children: currentOrphanedContent,
      };
      groupedChildren.push(shadowSection);
    }

    // Now process all children (both regular and shadow sections)
    // TODO: Future enhancement - merge orphaned sibling sections at root level
    // const sections = groupedChildren.filter(isSection);
    // if (sections.length > 1) {
    //   // Multiple sibling sections at root level - apply sibling merging logic
    //   const mergedChunks = mergeSiblingSections(sections, protectedRanges);
    //   chunks.push(...mergedChunks);
    // } else {
    // Single section or non-section content - process individually
    for (const child of groupedChildren) {
      if (isSection(child)) {
        // Process both regular and shadow sections using the same logic
        const sectionChunks = processHierarchicalSection(
          child,
          protectedRanges,
        );
        chunks.push(...sectionChunks);
      } else {
        // This shouldn't happen anymore, but keep as fallback
        const contentMarkdown = toMarkdown(child);
        chunks.push(contentMarkdown.trim());
      }
    }
    // }

    return chunks;
  };

  /**
   * Extract protected ranges from markdown AST nodes
   * Uses mdast position information to identify constructs that should never be split
   *
   * @param ast - Parsed mdast AST with position information
   * @returns Array of protected ranges that must stay together
   */
  const extractProtectedRangesFromAST = (ast: Node): ProtectedRange[] => {
    const ranges: ProtectedRange[] = [];

    /**
     * Recursively traverse AST nodes to find inline constructs that need protection
     */
    const traverse = (node: Node): void => {
      // Only protect nodes that have position information
      if (
        !node.position?.start?.offset ||
        node.position?.end?.offset === undefined
      ) {
        // Still traverse children even if this node lacks position info
        if ('children' in node && Array.isArray(node.children)) {
          node.children.forEach(traverse);
        }
        return;
      }

      const start = node.position.start.offset;
      const end = node.position.end.offset;

      // Protect inline markdown constructs that should never be split
      // For constructs like links, we want to protect the entire construct
      // but allow splitting between different constructs
      switch (node.type) {
        case 'link':
        case 'linkReference':
        case 'image':
        case 'imageReference':
        case 'inlineCode':
        case 'emphasis':
        case 'strong':
        case 'delete':
        case 'heading':
          if (isWithinBreakpoint(node)) {
            ranges.push({ start, end, type: node.type });
          }
          break;
      }

      // Recursively traverse children
      if ('children' in node && Array.isArray(node.children)) {
        node.children.forEach(traverse);
      }
    };

    // Start traversal from the root
    traverse(ast);

    // Sort by start position and merge only truly overlapping ranges
    const sortedRanges = ranges.sort((a, b) => a.start - b.start);
    const mergedRanges: ProtectedRange[] = [];

    for (const range of sortedRanges) {
      const lastMerged = mergedRanges[mergedRanges.length - 1];

      if (lastMerged && range.start < lastMerged.end) {
        // Only merge truly overlapping ranges (not adjacent ones)
        lastMerged.end = Math.max(lastMerged.end, range.end);
        lastMerged.type = `${lastMerged.type}+${range.type}`;
      } else {
        // Non-overlapping range - add it as separate range
        mergedRanges.push(range);
      }
    }

    return mergedRanges;
  };

  /**
   * Adjust protected ranges for a substring operation
   * When working with substrings, the protected ranges need to be recalculated
   *
   * @param protectedRanges - Original protected ranges
   * @param substringStart - Start position of the substring in the original text
   * @param substringEnd - End position of the substring in the original text
   * @returns Adjusted protected ranges for the substring
   */
  const adjustProtectedRangesForSubstring = (
    protectedRanges: ProtectedRange[],
    substringStart: number,
    substringEnd: number,
  ): ProtectedRange[] => {
    const adjustedRanges: ProtectedRange[] = [];

    for (const range of protectedRanges) {
      // Only include ranges that intersect with the substring
      if (range.end > substringStart && range.start < substringEnd) {
        // Adjust the range positions relative to the substring
        const adjustedRange = {
          start: Math.max(0, range.start - substringStart),
          end: Math.min(
            substringEnd - substringStart,
            range.end - substringStart,
          ),
          type: range.type,
        };

        // Only include valid ranges (where start < end)
        if (adjustedRange.start < adjustedRange.end) {
          adjustedRanges.push(adjustedRange);
        }
      }
    }

    return adjustedRanges;
  };

  /**
   * Extract structural boundaries from markdown AST nodes using position information
   * This replaces regex-based parsing with proper AST node analysis
   *
   * @param ast - Parsed mdast AST with position information
   * @returns Array of structural boundaries with proper priority hierarchy
   */
  const extractStructuralBoundariesFromAST = (
    ast: Node,
  ): StructuralBoundary[] => {
    const boundaries: StructuralBoundary[] = [];

    /**
     * Recursively traverse AST nodes to find structural boundaries
     */
    const traverse = (node: Node): void => {
      // Only process nodes that have position information
      if (
        !node.position?.start?.offset ||
        node.position?.end?.offset === undefined
      ) {
        // Still traverse children even if this node lacks position info
        if ('children' in node && Array.isArray(node.children)) {
          node.children.forEach(traverse);
        }
        return;
      }

      const start = node.position.start.offset;

      // Extract structural boundaries based on node type with proper priority hierarchy
      switch (node.type) {
        case 'heading':
          boundaries.push({
            position: start,
            type: node.type,
            priority: 10, // Highest priority - major document structure
          });
          break;

        case 'thematicBreak': // Horizontal rules (---, ***, ___)
          boundaries.push({
            position: start,
            type: node.type,
            priority: 8,
          });
          break;

        case 'code': // Code blocks
          boundaries.push({
            position: start,
            type: node.type,
            priority: 7,
          });
          break;

        case 'blockquote':
          boundaries.push({
            position: start,
            type: node.type,
            priority: 6,
          });
          break;

        case 'paragraph':
          // Only add paragraph boundaries if they're not the first node
          // and there's meaningful separation (empty line before)
          if (start > 0) {
            boundaries.push({
              position: start,
              type: node.type,
              priority: 5,
            });
          }
          break;

        case 'list':
          boundaries.push({
            position: start,
            type: node.type,
            priority: 4, // List container boundary
          });
          break;

        case 'listItem':
          boundaries.push({
            position: start,
            type: node.type,
            priority: 3, // Individual list items within lists
          });
          break;

        case 'table':
          boundaries.push({
            position: start,
            type: node.type,
            priority: 4, // Table container boundary (same as lists)
          });
          break;

        case 'tableRow':
          boundaries.push({
            position: start,
            type: node.type,
            priority: 3, // Individual table rows within tables (same as listItem)
          });
          break;
      }

      // Recursively process children
      if ('children' in node && Array.isArray(node.children)) {
        node.children.forEach(traverse);
      }
    };

    traverse(ast);

    // Sort boundaries by position for consistent processing
    return boundaries.sort((a, b) => a.position - b.position);
  };

  /**
   * Split text at specified boundaries while preserving markdown constructs
   * This prevents splitting from breaking links, images, etc.
   *
   * @param text - Text to split
   * @param protectedRanges - Pre-computed protected ranges from AST
   * @param boundaryRegex - Regex pattern for boundaries (e.g., /[.!?]/g for sentences, /[,;]/g for sub-sentences)
   * @returns Array of text segments with their positions in the original text
   */
  const splitIntoMarkdownAwareBoundaries = (
    text: string,
    protectedRanges: ProtectedRange[],
    boundaryRegex: RegExp,
  ): SentenceInfo[] => {
    // Find all potential boundaries using the provided regex
    const boundaries: number[] = [];
    let match = boundaryRegex.exec(text);
    while (match) {
      boundaries.push(match.index + 1); // Position after the punctuation
      match = boundaryRegex.exec(text);
    }

    // Filter out boundaries that would break protected ranges
    const safeBoundaries = boundaries.filter((boundary) => {
      for (const range of protectedRanges) {
        if (boundary > range.start && boundary < range.end) {
          return false; // This boundary would break a protected range
        }
      }
      return true;
    });

    // Split at safe boundaries and track positions
    const segments: SentenceInfo[] = [];
    let start = 0;

    for (const boundary of safeBoundaries) {
      const segment = text.substring(start, boundary);
      const trimmedSegment = segment.trim();
      if (trimmedSegment) {
        // Find the actual start position after trimming
        const leadingWhitespace = segment.match(/^\s*/)?.[0].length || 0;
        const actualStart = start + leadingWhitespace;
        segments.push({
          text: trimmedSegment,
          start: actualStart,
          end: actualStart + trimmedSegment.length,
        });
      }
      start = boundary;
    }

    // Add remaining text
    if (start < text.length) {
      const remaining = text.substring(start);
      const trimmedRemaining = remaining.trim();
      if (trimmedRemaining) {
        const leadingWhitespace = remaining.match(/^\s*/)?.[0].length || 0;
        const actualStart = start + leadingWhitespace;
        segments.push({
          text: trimmedRemaining,
          start: actualStart,
          end: actualStart + trimmedRemaining.length,
        });
      }
    }

    return segments.length > 0
      ? segments
      : [{ text: text.trim(), start: 0, end: text.trim().length }];
  };

  /**
   * Split text that exceeds chunk size using markdown-aware hierarchical breaking points
   *
   * Uses a progressive approach that respects markdown formatting:
   * 1. Try splitting at structural boundaries (headings, paragraphs, lists) first
   * 2. Fall back to sentence boundaries (. ! ?) while preserving markdown constructs
   * 3. As last resort, split by word boundaries but never inside markdown constructs
   *
   * @param text - The text to split
   * @param protectedRanges - Pre-computed protected ranges from AST
   * @param originalOffset - Offset of this text in the original document (for protected range adjustment)
   * @param ast - Optional AST for structural boundary detection (if available)
   * @returns Array of text chunks, each within the size limit and preserving markdown formatting
   */
  const splitLongText = (
    text: string,
    protectedRanges: ProtectedRange[],
    originalOffset: number = 0,
    ast?: Node,
  ): string[] => {
    const textLength = getContentSize(text);

    // Check if text fits within target size
    if (textLength <= chunkSize) return [text];

    // Check if text fits within overflow allowance - if so, keep it together
    const maxAllowedSize = chunkSize * maxOverflowRatio;
    if (textLength <= maxAllowedSize) return [text];

    const chunks: string[] = [];
    let currentChunk = '';

    // Define minimum sizes to prevent small fragments
    const minSentenceChunkSize = chunkSize * 0.2; // For sentence-level splitting
    const minStructuralChunkSize = chunkSize * 0.3; // For structural boundary selection

    // Step 1: Check for structural boundaries first (headings, paragraphs, lists)
    // These should take priority over sentence boundaries
    // Use AST-based boundary detection if available
    // Fall back to parsing text if no AST available
    const structuralBoundaries = extractStructuralBoundariesFromAST(
      ast ?? fromMarkdown(text),
    );

    // If we have structural boundaries, prioritize them over sentence boundaries
    // Look for the best structural boundary within the text
    const suitableStructuralBoundary = structuralBoundaries.find((boundary) => {
      // Skip the boundary at position 0 (start of text)
      if (boundary.position === 0) return false;

      // Check if this boundary would break a protected range (critical fix!)
      const wouldBreakProtectedRange = protectedRanges.some(
        (range) =>
          boundary.position > range.start && boundary.position < range.end,
      );
      if (wouldBreakProtectedRange) return false;

      // Calculate what the first chunk size would be
      const firstChunkSize = getContentSize(
        text.substring(0, boundary.position).trim(),
      );

      // Accept if it's reasonable (between 30% minimum and user's overflow allowance)
      // This allows for flexibility while still preferring structural splits
      return (
        firstChunkSize >= minStructuralChunkSize &&
        firstChunkSize <= maxAllowedSize
      );
    });

    if (suitableStructuralBoundary) {
      // Split at the structural boundary
      const firstChunk = text
        .substring(0, suitableStructuralBoundary.position)
        .trim();
      const remainingText = text.substring(suitableStructuralBoundary.position);

      if (firstChunk) {
        chunks.push(firstChunk);

        // Recursively process the remaining text
        if (remainingText.trim()) {
          // Note: We pass undefined for ast to force reparsing of the remaining text
          // This ensures structural boundaries are found correctly in the remaining portion
          chunks.push(
            ...splitLongText(
              remainingText,
              protectedRanges,
              originalOffset + suitableStructuralBoundary.position,
            ),
          );
        }

        return chunks;
      }
    }

    // Step 2: Fall back to sentence boundaries if no structural boundary works
    // We need to use markdown-aware sentence splitting to avoid breaking links/images
    const sentences = splitIntoMarkdownAwareBoundaries(
      text,
      protectedRanges,
      /[.!?]/g,
    );

    /**
     * Helper function to process oversized sentences with comma/semicolon splitting
     * Handles the common logic for splitting sentences that exceed maxAllowedSize
     */
    const processOversizedSentence = (
      sentenceText: string,
      sentenceProtectedRanges: ProtectedRange[],
      sentenceOffset: number,
    ): string[] => {
      const sentenceChunks: string[] = [];

      // Try splitting at commas/semicolons first
      const subSentences = splitIntoMarkdownAwareBoundaries(
        sentenceText,
        sentenceProtectedRanges,
        /[,;]/g,
      );

      if (subSentences.length > 1) {
        // Process sub-sentences with same chunking logic as sentences
        let subCurrentChunk = '';

        for (const subSentenceInfo of subSentences) {
          const subSentenceText = subSentenceInfo.text;
          if (!subSentenceText) continue;

          const subSentenceLength = getContentSize(subSentenceText);
          const subCurrentChunkLength = getContentSize(subCurrentChunk);

          if (subCurrentChunk.length === 0) {
            if (subSentenceLength <= maxAllowedSize) {
              subCurrentChunk = subSentenceText;
            } else {
              // Sub-sentence too large - fall back to word splitting
              sentenceChunks.push(
                ...splitTextAroundProtectedRanges(
                  subSentenceText,
                  sentenceProtectedRanges,
                  sentenceOffset + subSentenceInfo.start,
                ),
              );
            }
          } else if (
            subCurrentChunkLength + 1 + subSentenceLength <=
            chunkSize
          ) {
            subCurrentChunk += ` ${subSentenceText}`;
          } else {
            sentenceChunks.push(subCurrentChunk);
            if (subSentenceLength <= maxAllowedSize) {
              subCurrentChunk = subSentenceText;
            } else {
              sentenceChunks.push(
                ...splitTextAroundProtectedRanges(
                  subSentenceText,
                  sentenceProtectedRanges,
                  sentenceOffset + subSentenceInfo.start,
                ),
              );
              subCurrentChunk = '';
            }
          }
        }

        if (subCurrentChunk) {
          sentenceChunks.push(subCurrentChunk);
        }
      } else {
        // No comma/semicolon boundaries found - fall back to word splitting
        sentenceChunks.push(
          ...splitTextAroundProtectedRanges(
            sentenceText,
            sentenceProtectedRanges,
            sentenceOffset,
          ),
        );
      }

      return sentenceChunks;
    };

    for (let i = 0; i < sentences.length; i++) {
      const sentenceInfo = sentences[i];
      const sentenceText = sentenceInfo.text;
      if (!sentenceText) continue;

      const sentenceLength = getContentSize(sentenceText);
      const currentChunkLength = getContentSize(currentChunk);

      if (currentChunk.length === 0) {
        // Starting with a new sentence - check if it fits within overflow allowance
        if (sentenceLength > maxAllowedSize) {
          // Sentence exceeds overflow allowance - use helper to process with comma/semicolon splitting
          const sentenceOffset = originalOffset + sentenceInfo.start;
          const sentenceProtectedRanges = adjustProtectedRangesForSubstring(
            protectedRanges,
            sentenceOffset,
            sentenceOffset + sentenceText.length,
          );

          const sentenceChunks = processOversizedSentence(
            sentenceText,
            sentenceProtectedRanges,
            sentenceOffset,
          );
          chunks.push(...sentenceChunks);
        } else {
          // Sentence fits within overflow allowance - keep it whole
          currentChunk = sentenceText;
        }
      } else if (currentChunkLength + 1 + sentenceLength <= chunkSize) {
        // Current sentence fits with existing chunk - combine them
        currentChunk += ` ${sentenceText}`;
      } else {
        // Current sentence doesn't fit
        // Check if we should allow overflow to prevent small fragments
        const isLastSentence = i === sentences.length - 1;
        const nextSentenceWouldBeTiny =
          isLastSentence ||
          (sentences[i + 1] &&
            getContentSize(sentences[i + 1].text) < minSentenceChunkSize);
        const currentChunkTooSmall = currentChunkLength < minSentenceChunkSize;
        const combinedLength = currentChunkLength + 1 + sentenceLength;
        const overflowAcceptable = combinedLength <= maxAllowedSize;

        if (
          (currentChunkTooSmall || nextSentenceWouldBeTiny) &&
          overflowAcceptable
        ) {
          // Allow overflow to prevent tiny fragments
          currentChunk += ` ${sentenceText}`;
        } else {
          // Save current chunk and start new one
          chunks.push(currentChunk);

          if (sentenceLength > maxAllowedSize) {
            // New sentence exceeds overflow allowance - use helper to process with comma/semicolon splitting
            const sentenceOffset = originalOffset + sentenceInfo.start;
            const sentenceProtectedRanges = adjustProtectedRangesForSubstring(
              protectedRanges,
              sentenceOffset,
              sentenceOffset + sentenceText.length,
            );

            const sentenceChunks = processOversizedSentence(
              sentenceText,
              sentenceProtectedRanges,
              sentenceOffset,
            );
            chunks.push(...sentenceChunks);
            currentChunk = '';
          } else {
            // New sentence fits within overflow allowance - keep it whole
            currentChunk = sentenceText;
          }
        }
      }
    }

    if (currentChunk) chunks.push(currentChunk);

    return chunks;
  };

  /**
   * Split text while absolutely preserving protected constructs (links, images, etc.)
   * Protected constructs are never broken, regardless of chunk size limits
   *
   * @param text - Text to split
   * @param protectedRanges - Pre-computed protected ranges from AST
   * @param originalTextOffset - Offset in the original text for protected range adjustment
   * @returns Array of chunks that never break markdown constructs
   */
  const splitTextAroundProtectedRanges = (
    text: string,
    protectedRanges: ProtectedRange[],
    originalTextOffset: number = 0,
  ): string[] => {
    // Helper function to split text by words while respecting size limits
    const splitByWords = (textToSplit: string): string[] => {
      const words = textToSplit.split(/\s+/).filter((word) => word.trim());
      const chunks: string[] = [];
      let currentChunk = '';

      for (const word of words) {
        const testChunk = currentChunk ? `${currentChunk} ${word}` : word;
        if (getContentSize(testChunk) <= chunkSize || !currentChunk) {
          currentChunk = testChunk;
        } else {
          chunks.push(currentChunk);
          currentChunk = word;
        }
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }

      return chunks;
    };

    // Adjust protected ranges to be relative to this text
    const adjustedRanges = adjustProtectedRangesForSubstring(
      protectedRanges,
      originalTextOffset,
      originalTextOffset + text.length,
    );

    if (adjustedRanges.length === 0) {
      // No protected ranges in this text - use normal word boundary splitting
      return splitByWords(text);
    }

    // Protected ranges exist - split around them while preserving them absolutely
    const chunks: string[] = [];
    let currentPosition = 0;

    for (let i = 0; i < adjustedRanges.length; i++) {
      const range = adjustedRanges[i];

      // Process text before this protected range with normal chunking
      if (currentPosition < range.start) {
        const beforeText = text.substring(currentPosition, range.start).trim();
        if (beforeText) {
          chunks.push(...splitByWords(beforeText));
        }
      }

      // Add the protected range as a single chunk (never break it)
      const protectedText = text.substring(range.start, range.end);
      chunks.push(protectedText);

      currentPosition = range.end;
    }

    // Process any remaining text after the last protected range
    if (currentPosition < text.length) {
      const afterText = text.substring(currentPosition).trim();
      if (afterText) {
        chunks.push(...splitByWords(afterText));
      }
    }

    return chunks.filter((chunk) => chunk.trim());
  };

  /**
   * Main text splitting function using hierarchical AST processing
   *
   * Process overview:
   * 1. Parse markdown text into AST using mdast-util-from-markdown
   * 2. Transform to hierarchical sections for semantic understanding
   * 3. Apply top-down chunking with soft limits and overflow logic
   * 4. Fall back to text-based splitting for oversized content
   *
   * @param text - The markdown text to split
   * @returns Array of text chunks with preserved markdown formatting and section relationships
   */
  const splitText = (text: string): string[] => {
    // Handle empty or whitespace-only input
    if (!text || !text.trim()) return [];

    // Step 1: Parse markdown text into Abstract Syntax Tree
    // This gives us semantic understanding of the document structure
    const tree = fromMarkdown(text);

    // Step 2: Extract protected ranges from AST to prevent splitting markdown constructs
    const protectedRanges = extractProtectedRangesFromAST(tree);

    // Step 3: Transform to hierarchical AST and use semantic-aware processing
    const hierarchicalAST = createHierarchicalAST(tree);
    return processHierarchicalAST(hierarchicalAST, protectedRanges);
  };

  return { splitText };
};
