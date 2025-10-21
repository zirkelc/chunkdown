import type { Blockquote, List, Node, Nodes, RootContent, Table } from 'mdast';
import {
  createHierarchicalAST,
  flattenHierarchicalAST,
  type HierarchicalRoot,
  isSection,
  type Section,
} from './ast';
import { fromMarkdown, toMarkdown, toString } from './markdown';

// TODO add option to merge sections: parent-children, siblings, orphaned sections (root-level section without parents)
// maybe only if chunk.size < options.chunkSize * 0.5
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
  /**
   * Optional maximum raw markdown length (characters) for embedding model compatibility.
   * If set, chunks will be further split when their raw markdown exceeds this limit.
   * Useful for embedding models with character limits (e.g., 7000 for OpenAI text-embedding-3-large).
   * If undefined, defaults to chunkSize * maxOverflowRatio * 4 for reasonable safety.
   */
  maxRawSize?: number;
  /**
   * Optional breakpoints for controlling when specific node types can be split.
   * If not provided, uses the exported `breakpoints` defaults.
   * If provided, completely replaces all defaults (merge manually if needed).
   * If maxSize is not set or is 0, the node type has no special protection and can always be split.
   *
   * @example Replace all defaults with custom breakpoints
   * ```typescript
   * {
   *   link: { maxSize: 100 },
   *   emphasis: { maxSize: 50 },
   * }
   * ```
   *
   * @example Merge with defaults to override specific breakpoints
   * ```typescript
   * import { breakpoints } from 'chunkdown';
   *
   * {
   *   ...breakpoints,
   *   link: { maxSize: 100 },
   *   emphasis: { maxSize: 50 },
   * }
   * ```
   */
  breakpoints?: Partial<Breakpoints>;
};

export type Breakpoints = {
  [node: Node['type']]: Breakpoint;
};

export type Breakpoint = {
  maxSize?: number;
  // TODO breakmode and onBreak callback for custom behavior
  // breakMode?: 'keep' | 'clean' | 'extend';
  // onBreak?: (node: Node) => Array<Node>;
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
 * Text boundary with position, type, and priority information
 * Used for intelligent text splitting based on document structure and semantic patterns
 */
type Boundary = {
  position: number;
  type: string;
  priority: number;
};

/**
 * Calculate the content size of markdown content or AST node
 * Uses the actual text content without markdown formatting characters
 *
 * @param input - The markdown text or AST node to measure
 * @returns The size of the actual text content (without formatting)
 */
export const getContentSize = (input: string | Nodes): number => {
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

export const getRawSize = (input: string | Nodes): number => {
  if (!input) return 0;

  // If input is a string, return its length directly
  if (typeof input === 'string') {
    return input.length;
  }

  // If input is an AST node, use the position to calculate raw size
  if (
    input.position?.start?.offset !== undefined &&
    input.position?.end?.offset !== undefined
  ) {
    return input.position.end.offset - input.position.start.offset;
  }

  // Fallback: convert AST back to markdown and measure length
  const markdown = toMarkdown(input);
  return markdown.length;
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

  // Get heading text length if it exists (not a orphaned section)
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
      if (markdown) {
        super.push(markdown);
      }
    }
    return this.length;
  }
}

/**
 * Default breakpoints for protecting markdown constructs based on content length.
 * Constructs shorter than these values will be protected from splitting.
 *
 * Note: Finite maxSize values are automatically capped at maxAllowedSize (chunkSize * maxOverflowRatio).
 * Use Infinity to protect constructs regardless of chunk size.
 *
 * @example Protect constructs with finite limits (auto-capped)
 * ```typescript
 * chunkdown({
 *   chunkSize: 500,
 *   maxOverflowRatio: 1.5,
 *   breakpoints: {
 *     ...defaultBreakpoints,
 *     strong: { maxSize: 50 },  // Protected up to min(50, 750)
 *   }
 * });
 * ```
 *
 * @example Protect constructs regardless of size
 * ```typescript
 * chunkdown({
 *   chunkSize: 100,
 *   breakpoints: {
 *     ...defaultBreakpoints,
 *     link: { maxSize: Infinity },  // Never split links
 *   }
 * });
 * ```
 */
export const defaultBreakpoints: Breakpoints = {
  link: { maxSize: Infinity },
  image: { maxSize: Infinity },
  emphasis: { maxSize: 30 },
  strong: { maxSize: 30 },
  delete: { maxSize: 30 },
  heading: { maxSize: 80 },
  inlineCode: { maxSize: 100 },
};

/**
 * Hierarchical Markdown Text Splitter with Semantic Awareness
 *
 * This splitter intelligently breaks markdown text into chunks using a hierarchical approach
 * that preserves document structure and semantic relationships.
 */
export const chunkdown = (options: ChunkdownOptions) => {
  const {
    chunkSize,
    maxOverflowRatio,
    maxRawSize,
    breakpoints: userBreakpoints,
  } = options;
  const maxAllowedSize = chunkSize * maxOverflowRatio;

  const breakpoints = userBreakpoints ?? defaultBreakpoints;

  /**
   * Check if content and raw sizes are within allowed limits
   *
   * @param contentSize - The content size (visible text without markdown formatting)
   * @param rawSize - The raw markdown size (including formatting and URLs)
   * @returns True if within both content and raw size limits
   */
  const isWithinAllowedSize = (
    contentSize: number,
    rawSize: number,
  ): boolean => {
    // Check content size limit (for semantic chunking decisions)
    if (contentSize > maxAllowedSize) return false;

    // Check raw markdown size limit (for embedding model compatibility)
    if (maxRawSize && rawSize > maxRawSize) return false;

    return true;
  };

  /**
   * Check if a node is within its protection breakpoint
   *
   * @param node - The AST node to check
   * @returns true if the node is within its breakpoint, false otherwise
   */
  const isWithinBreakpoint = (node: Nodes): boolean => {
    const breakpoint = breakpoints[node.type];
    if (!breakpoint) return false;

    const breakingSize = breakpoint.maxSize ?? 0;
    if (breakingSize === 0) return false;

    const contentSize = getContentSize(node);
    const rawSize = getRawSize(node);

    // To protect constructs regardless of chunk size, use Infinity.
    // Otherwise, cap protection at the smaller of breakingSize and maxAllowedSize.
    const effectiveBreakingSize =
      breakingSize === Infinity
        ? breakingSize
        : Math.min(breakingSize, maxAllowedSize);

    if (contentSize > effectiveBreakingSize) return false;

    if (maxRawSize && rawSize > maxRawSize) return false;

    return true;
  };

  /**
   * Process a hierarchical section using top-down approach with soft limits
   * Tries to keep entire sections together, falls back to intelligent breaking
   *
   * @param section - The section to process
   * @returns Array of markdown chunks
   */
  const processHierarchicalSection = (section: Section): string[] => {
    const sectionSize = getSectionSize(section);
    const sectionMarkdown = convertSectionToMarkdown(section);

    // Case 1: Section fits within both content and raw size limits - keep it together
    if (isWithinAllowedSize(sectionSize, sectionMarkdown.length)) {
      return [sectionMarkdown];
    }

    // Case 2: Section too large - need to break it down intelligently
    return breakDownSection(section);
  };

  /**
   * Process a single content node that may be too large for a chunk
   * Handles lists specially by trying to split by items first
   *
   * @param contentNode - The content node to process
   * @returns Array of markdown chunks
   */
  const processLargeContentNode = (contentNode: Nodes): string[] => {
    const chunks: string[] = [];
    const contentSize = getContentSize(contentNode);
    const contentMarkdown = toMarkdown(contentNode);

    if (isWithinAllowedSize(contentSize, contentMarkdown.length)) {
      chunks.push(contentMarkdown);
    } else {
      // Content too large - check if it's a container that can be split by items
      if (
        (contentNode.type === 'list' ||
          contentNode.type === 'table' ||
          contentNode.type === 'blockquote') &&
        contentNode.children
      ) {
        // Try to split container by items
        chunks.push(...processContainerItems(contentNode));
      } else {
        // Not a container - fall back to text splitting
        chunks.push(...splitLongText(contentMarkdown));
      }
    }

    return chunks;
  };

  /**
   * Process section content with intelligent grouping to maximize chunk utilization
   * Works for both regular sections (with heading) and orphaned sections (without heading)
   *
   * @param section - The section to process (can be regular or orphaned)
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

      if (isWithinAllowedSize(headingSize, headingMarkdown.length)) {
        return [headingMarkdown];
      } else {
        return processLargeContentNode(section.heading);
      }
    } else if (contentItems.length === 0 && !section.heading) {
      // Empty orphaned section
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
        if (itemsMarkdown) {
          chunks.push(itemsMarkdown);
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

      if (isWithinAllowedSize(testItemsSize, testItemsMarkdown.length)) {
        // Item fits - add to current group to maximize utilization
        currentItems.push(item);
      } else {
        // Item doesn't fit - flush current group and handle this item
        flushCurrentItems();

        // Check if item alone fits within soft limits
        const itemMarkdown = toMarkdown(item);
        const itemSize = getContentSize(itemMarkdown);

        if (isWithinAllowedSize(itemSize, itemMarkdown.length)) {
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
   * @returns Array of markdown chunks optimized for space utilization
   */
  const breakDownSection = (section: Section): string[] => {
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
   * @returns Array of optimized markdown chunks
   */
  const mergeParentWithDescendants = (
    parentSection: Section | null,
    nestedSections: Section[],
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
    if (parentSection) {
      const parentMarkdown = convertSectionToMarkdown(parentSection);
      if (isWithinAllowedSize(parentSize, parentMarkdown.length)) {
        const candidateSections: Section[] = [];
        let accumulatedSize = parentSize;

        // Find consecutive child sections that can merge with parent
        for (const childSection of nestedSections) {
          const childSize = getSectionSize(childSection);
          const combinedSize = accumulatedSize + childSize;

          // Create a temporary merged section to check raw size
          const tempMergedSection: Section = {
            type: 'section',
            depth: parentSection.depth,
            heading: parentSection.heading,
            children: [
              ...parentSection.children,
              ...candidateSections,
              childSection,
            ],
          };
          const tempMergedMarkdown =
            convertSectionToMarkdown(tempMergedSection);

          if (isWithinAllowedSize(combinedSize, tempMergedMarkdown.length)) {
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
          chunks.push(mergedChunk);
          mergedWithParent = true;

          // Process remaining child sections that didn't merge with parent
          const remainingSections = nestedSections.slice(
            candidateSections.length,
          );
          if (remainingSections.length > 0) {
            const remainingChunks = mergeSiblingSections(remainingSections);
            chunks.push(...remainingChunks);
          }
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
        const siblingChunks = mergeSiblingSections(nestedSections);
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
   * @returns Array of optimized markdown chunks
   */
  const mergeSiblingSections = (sections: Section[]): string[] => {
    const chunks: string[] = [];
    let currentGroup: Section[] = [];
    let currentGroupSize = 0;

    const flushCurrentGroup = () => {
      if (currentGroup.length === 0) return;

      if (currentGroup.length === 1) {
        // Single section - process normally
        const sectionChunks = processHierarchicalSection(currentGroup[0]);
        chunks.push(...sectionChunks);
      } else {
        // Multiple sections - merge them into a orphaned section
        const mergedSection: Section = {
          type: 'section',
          depth: 0, // Orphaned section depth
          heading: undefined,
          children: currentGroup,
        };

        const mergedChunk = convertSectionToMarkdown(mergedSection);
        chunks.push(mergedChunk);
      }

      currentGroup = [];
      currentGroupSize = 0;
    };

    for (const section of sections) {
      const sectionSize = getSectionSize(section);
      const sectionMarkdown = convertSectionToMarkdown(section);

      // Check if section fits within allowed size by itself
      if (!isWithinAllowedSize(sectionSize, sectionMarkdown.length)) {
        // Section is too large - flush current group and process this section separately
        flushCurrentGroup();
        const sectionChunks = processHierarchicalSection(section);
        chunks.push(...sectionChunks);
        continue;
      }

      // Check if adding this section to current group would exceed allowed size
      const combinedSize = currentGroupSize + sectionSize;
      // Create temporary merged section to check raw size
      const tempMergedSection: Section = {
        type: 'section',
        depth: 0, // Orphaned section depth
        heading: undefined,
        children: [...currentGroup, section],
      };
      const tempMergedMarkdown = convertSectionToMarkdown(tempMergedSection);

      if (
        currentGroup.length > 0 &&
        !isWithinAllowedSize(combinedSize, tempMergedMarkdown.length)
      ) {
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
        chunks.push(currentItemsMarkdown);
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
      const itemSize = getContentSize(itemNode);

      // Special handling for keeping first item with second item (e.g., table header + separator)
      if (container.type === 'table' && i === 0 && items.length > 1) {
        // For the first item, try to include it with the second item if possible
        const secondRowMarkdown = toMarkdown({
          ...container,
          children: [item, items[1]],
        } as TContainer);
        const combinedSize = getContentSize(secondRowMarkdown);

        if (isWithinAllowedSize(combinedSize, secondRowMarkdown.length)) {
          // Keep first item with second item
          currentItems = [item, items[1]];
          currentSize = combinedSize;
          i++; // Skip the next iteration since we processed two items
          continue;
        }
      }

      // Check if this single item exceeds chunk size
      if (itemSize > chunkSize) {
        // Item is too large
        flushCurrentItems();

        // For ordered lists, ensure correct numbering
        if (itemNode.type === 'list' && itemNode.ordered) {
          setListStart(itemNode);
        }

        const itemNodeMarkdown = toMarkdown(itemNode);
        if (isWithinAllowedSize(itemSize, itemNodeMarkdown.length)) {
          // Item is within allowed size - add as its own chunk
          chunks.push(itemNodeMarkdown);
        } else {
          // Item too large even with overflow - fall back to text splitting
          chunks.push(...splitLongText(itemNodeMarkdown));
        }

        firstItemIndex += 1; // Increment for this processed item
      } else {
        // Create temporary container to check combined raw size
        const tempContainer = {
          ...container,
          children: [...currentItems, item],
        };
        const tempMarkdown = toMarkdown(tempContainer);

        if (isWithinAllowedSize(currentSize + itemSize, tempMarkdown.length)) {
          // Add item to current chunk
          currentItems.push(item);
          currentSize += itemSize;
        } else {
          // Adding this item would exceed allowed size (including overflow)
          flushCurrentItems();

          // Start new chunk with this item
          currentItems = [item];
          currentSize = itemSize;
        }
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
   * @returns Array of markdown chunks
   */
  const processHierarchicalAST = (
    hierarchicalAST: HierarchicalRoot,
  ): string[] => {
    const chunks: string[] = [];

    // Group consecutive non-section children into orphaned sections
    const groupedChildren: (Section | RootContent)[] = [];
    let currentOrphanedContent: RootContent[] = [];

    for (const child of hierarchicalAST.children) {
      if (isSection(child)) {
        // If we have accumulated orphaned content, create a orphaned section
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
        // Add the regular section
        groupedChildren.push(child);
      } else {
        // Accumulate orphaned content
        currentOrphanedContent.push(child);
      }
    }

    // Don't forget any remaining orphaned content at the end
    if (currentOrphanedContent.length > 0) {
      const orphanedSection: Section = {
        type: 'section',
        depth: 0,
        heading: undefined,
        children: currentOrphanedContent,
      };
      groupedChildren.push(orphanedSection);
    }

    // Now process all children (both regular and orphaned sections)
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
        // Process both regular and orphaned sections using the same logic
        const sectionChunks = processHierarchicalSection(child);
        chunks.push(...sectionChunks);
      } else {
        // This shouldn't happen anymore, but keep as fallback
        const contentMarkdown = toMarkdown(child);
        chunks.push(contentMarkdown);
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
  const extractProtectedRangesFromAST = (ast: Nodes): ProtectedRange[] => {
    const ranges: ProtectedRange[] = [];

    /**
     * Recursively traverse AST nodes to find inline constructs that need protection
     */
    const traverse = (node: Nodes): void => {
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
   * Find all semantic boundaries with text-based pattern matching
   * Since structural boundaries are handled by hierarchical AST processing,
   * this function only identifies semantic text boundaries for fine-grained splitting
   *
   * @param text - The text to analyze
   * @param protectedRanges - Ranges that should not be split
   * @returns Array of boundaries sorted by priority (desc), then position (asc)
   */
  const extractSemanticBoundaries = (
    text: string,
    protectedRanges: ProtectedRange[],
  ): Boundary[] => {
    let priority = 0;
    const boundaryPatterns = [
      // Period followed by newline (very strong sentence boundary)
      // Example: "First sentence.\nSecond sentence." → splits after period
      {
        regex: /\.(?=\n)/g,
        type: 'period_before_newline',
        priority: priority++,
      },
      // Period followed by whitespace and uppercase letter (strong sentence boundary)
      // Example: "Hello world. The sun is shining" → splits after "world."
      // Excludes list items like "1. Item", "a. Item", "i. Item" with negative lookbehind
      {
        regex: /(?<!^\s*(?:\d+|[a-zA-Z]+|[ivxlcdmIVXLCDM]+))\.\s+(?=[A-Z])/g,
        type: 'period_before_uppercase',
        priority: priority++,
      },

      // Question marks or exclamation marks followed by space or end of string
      // Example: "Really? Yes!" → splits after "?" and "!"
      {
        regex: /[?!]+(?=\s|$)/g,
        type: 'question_exclamation',
        priority: priority++,
      },

      // Period NOT followed by lowercase, another period, or digit (avoids abbreviations)
      // Example: "End." but NOT "e.g. example" or "U.S.A." or "3.14"
      // Excludes list items like "1. Item", "a. Item", "i. Item" with negative lookbehind
      {
        regex:
          /(?<!^\s*(?:\d+|[a-zA-Z]+|[ivxlcdmIVXLCDM]+))\.(?!\s*[a-z])(?!\s*\.)(?!\s*\d)/g,
        type: 'period_safe',
        priority: priority++,
      },

      // Colon or semicolon followed by space (major clause separators)
      // Example: "Note: this is important; very important" → splits after ":" and ";"
      { regex: /[:;](?=\s)/g, type: 'colon_semicolon', priority: priority++ },

      // Complete bracket pairs (parentheses, square brackets, curly braces)
      // Example: "Hello (world) there" → splits after ")" regardless of what follows
      {
        regex: /\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g,
        type: 'bracket_pairs',
        priority: priority++,
      },

      // Complete quote pairs (various quote styles)
      // Example: 'He said "hello".' → splits after closing quote regardless of what follows
      {
        regex: /"[^"]*"|'[^']*'|`[^`]*`|´[^´]*´|'[^']*'|'[^']*'/g,
        type: 'quote_pairs',
        priority: priority++,
      },

      // Single linebreak (line boundaries within paragraphs)
      // Example: "First line\nSecond line" → splits at linebreak
      { regex: /\n/g, type: 'line_break', priority: priority++ },

      // Comma followed by space (minor clause separator)
      // Example: "apples, oranges, bananas" → splits after each comma
      { regex: /,(?=\s)/g, type: 'comma', priority: priority++ },

      // Em dash, en dash, or hyphen surrounded by spaces
      // Example: "Paris – the city of lights – is beautiful" → splits at dashes
      { regex: /\s[–—-]\s/g, type: 'dashes', priority: priority++ },

      // Ellipsis (three or more consecutive periods)
      // Example: "Wait... what happened..." → splits at "..."
      { regex: /\.{3,}/g, type: 'ellipsis', priority: priority++ },

      // ANY period as fallback (catches edge cases, but may split abbreviations)
      // Example: "etc." or "End" → splits at period (use with caution)
      { regex: /\./g, type: 'period_fallback', priority: priority++ },

      // One or more whitespace characters (lowest priority word separator)
      // Example: "hello   world" → splits between words at spaces
      { regex: /\s+/g, type: 'whitespace', priority: priority++ },
    ];

    // Add maxRawSize boundary as last resort if defined
    if (maxRawSize !== undefined) {
      boundaryPatterns.push({
        regex: new RegExp(`.{1,${maxRawSize}}(?=\\s|$)|.{${maxRawSize}}`, 'g'),
        type: 'max_raw_size',
        priority: priority++,
      });
    }

    const boundaries: Boundary[] = [];

    // Find all semantic boundaries for each pattern
    for (const pattern of boundaryPatterns) {
      const regex = new RegExp(pattern.regex.source, 'g');
      let match: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: regex.exec assignment in while condition
      while ((match = regex.exec(text)) !== null) {
        const position = match.index + match[0].length;

        // Check if boundary is within a protected range
        const isProtected = protectedRanges.some(
          (range) => position > range.start && position < range.end,
        );

        // Only add boundary if not protected
        if (!isProtected) {
          boundaries.push({
            position,
            type: pattern.type,
            priority: pattern.priority,
          });
        }
      }
    }

    // Sort by priority (ascending), then by position (ascending)
    // This gives us the highest priority boundaries first, in positional order
    return boundaries.sort((a, b) =>
      a.priority !== b.priority
        ? a.priority - b.priority
        : a.position - b.position,
    );
  };

  /**
   * Adjust boundary positions for a substring operation
   * @param boundaries - Original boundaries
   * @param substringStart - Start position of substring in original text
   * @param substringEnd - End position of substring in original text
   * @returns Boundaries adjusted for the substring
   */
  const adjustBoundariesForSubstring = (
    boundaries: Boundary[],
    substringStart: number,
    substringEnd: number,
  ): Boundary[] => {
    return boundaries
      .filter((b) => b.position > substringStart && b.position <= substringEnd)
      .map((b) => ({ ...b, position: b.position - substringStart }));
  };

  /**
   * Recursively split text using boundary priority hierarchy
   * Iterates through distinct priority levels (each semantic boundary type has unique priority)
   * Each recursive call uses only boundaries with lower or equal priority than current level
   *
   * @param text - The text to split
   * @param boundaries - Available boundaries sorted by priority desc, position asc
   * @param protectedRanges - Pre-computed protected ranges from AST
   * @param originalOffset - Offset of this text in the original document
   * @returns Array of text chunks
   */
  const splitLongTextRecursive = (
    text: string,
    boundaries: Boundary[],
    protectedRanges: ProtectedRange[],
    originalOffset: number = 0,
  ): string[] => {
    const textSize = getContentSize(text);

    // Base cases: text fits within limits
    if (isWithinAllowedSize(textSize, text.length)) {
      return [text];
    }

    // If no boundaries available, return as single chunk (protected)
    if (boundaries.length === 0) {
      return [text];
    }

    for (const boundary of boundaries) {
      // Get all boundaries at this priority level (should be same type)
      const currentBoundaries = boundaries.filter(
        (b) => b.priority === boundary.priority,
      );

      // Get positions within current text bounds (exclude start and end positions)
      const validPositions = currentBoundaries
        .map((b) => b.position)
        .filter((pos) => pos > 0 && pos < text.length)
        .sort((a, b) => a - b);

      if (validPositions.length === 0) continue;

      // Generalized boundary selection strategy:
      // Length=1 => [0], Length=2 => [0,1], Length=3 => [1], Length=4 => [1,2], etc.
      const mid = Math.floor(validPositions.length / 2);
      const middlePositions =
        validPositions.length % 2 === 1
          ? [mid] // Odd length: try exact middle
          : [mid - 1, mid]; // Even length: try both middle positions

      // Evaluate all middle position candidates to find the best one
      const positionCandidates = middlePositions
        .map((index) => {
          const position = validPositions[index];
          const firstPart = text.substring(0, position);
          const secondPart = text.substring(position);
          const firstPartSize = getContentSize(firstPart);
          const secondPartSize = getContentSize(secondPart);
          const bothWithinLimits =
            isWithinAllowedSize(firstPartSize, firstPart.length) &&
            isWithinAllowedSize(secondPartSize, secondPart.length);
          const distance = Math.abs(firstPartSize - secondPartSize);

          return {
            position,
            firstPart,
            secondPart,
            firstPartSize,
            secondPartSize,
            bothWithinLimits,
            distance,
          };
        })
        .sort((a, b) => {
          // Primary: bothWithinLimits
          if (a.bothWithinLimits && !b.bothWithinLimits) return -1;
          if (!a.bothWithinLimits && b.bothWithinLimits) return 1;

          // Secondary: distance (smaller is better)
          return a.distance - b.distance;
        });

      const bestCandidate = positionCandidates[0];

      const { position, firstPart, secondPart, firstPartSize, secondPartSize } =
        bestCandidate;

      // Calculate actual positions for boundary adjustments
      const firstPartActualStart = 0;
      const firstPartActualEnd = position;
      const secondPartActualStart = position;
      const secondPartActualEnd = text.length;

      const chunks: string[] = [];
      // Priority is ascending, so lower or equal priority boundaries for next level
      const lowerPriorityBoundaries = boundaries.filter(
        (b) => b.priority >= boundary.priority,
      );

      // Recursively process first part if needed
      if (isWithinAllowedSize(firstPartSize, firstPart.length)) {
        chunks.push(firstPart);
      } else {
        const firstPartRanges = adjustProtectedRangesForSubstring(
          protectedRanges,
          originalOffset,
          originalOffset + position,
        );
        const firstPartBoundaries = adjustBoundariesForSubstring(
          lowerPriorityBoundaries,
          firstPartActualStart,
          firstPartActualEnd,
        );
        chunks.push(
          ...splitLongTextRecursive(
            firstPart,
            firstPartBoundaries,
            firstPartRanges,
            originalOffset,
          ),
        );
      }

      // Recursively process second part if needed
      if (isWithinAllowedSize(secondPartSize, secondPart.length)) {
        chunks.push(secondPart);
      } else {
        const secondPartRanges = adjustProtectedRangesForSubstring(
          protectedRanges,
          originalOffset + position,
          originalOffset + text.length,
        );
        const secondPartBoundaries = adjustBoundariesForSubstring(
          lowerPriorityBoundaries,
          secondPartActualStart,
          secondPartActualEnd,
        );
        chunks.push(
          ...splitLongTextRecursive(
            secondPart,
            secondPartBoundaries,
            secondPartRanges,
            originalOffset + secondPartActualStart,
          ),
        );
      }

      // Return the chunks created from this valid split
      return chunks;
    }

    // Return text as single chunk
    return [text];
  };

  /**
   * Main text splitting function using recursive boundary priority approach
   *
   * @param text - The text to split
   * @returns Array of text chunks
   */
  const splitLongText = (text: string): string[] => {
    // Re-parse the text to get fresh AST with positions relative to this text
    // This ensures protected ranges are correctly positioned for the extracted content
    const ast = fromMarkdown(text);
    const protectedRanges = extractProtectedRangesFromAST(ast);
    const allBoundaries = extractSemanticBoundaries(text, protectedRanges);

    return splitLongTextRecursive(text, allBoundaries, protectedRanges);
  };

  /**
   * Split markdown text using hierarchical AST processing
   *
   * @param text - The markdown text to split
   * @returns Array of text chunks
   */
  const splitText = (text: string): string[] => {
    // Handle empty or whitespace-only input
    if (!text || !text.trim()) return [];

    // Parse markdown text into Abstract Syntax Tree
    const tree = fromMarkdown(text);

    // Transform to hierarchical AST
    const hierarchicalAST = createHierarchicalAST(tree);

    // Process hierarchical AST to generate initial chunks
    const rawChunks = processHierarchicalAST(hierarchicalAST);

    // Final trimming and filtering to ensure clean output
    return rawChunks
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 0);
  };

  return { splitText };
};
