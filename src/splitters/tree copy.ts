import type { Blockquote, List, Nodes, Root, RootContent, Table } from 'mdast';
import {
  createHierarchicalAST,
  flattenHierarchicalAST,
  type HierarchicalRoot,
  isSection,
  type Section,
} from '../ast';
import { fromMarkdown, toMarkdown } from '../markdown';
import {
  type ChunkdownOptions,
  getContentSize,
  getSectionSize,
} from '../splitter';
import { AbstractNodeSplitter } from './base';
import { BlockquoteSplitter } from './blockquote';
import type { NodeSplitter } from './interface';
import { ListSplitter } from './list';
import { TableSplitter } from './table';
import { TextSplitter } from './text';

export class MarkdownTreeSplitter extends AbstractNodeSplitter {
  private nodeSplitters: Map<string, NodeSplitter>;
  private textSplitter: TextSplitter;

  constructor(options: ChunkdownOptions) {
    super(options);
    this.nodeSplitters = new Map<string, NodeSplitter>([
      ['list', new ListSplitter(options)],
      ['table', new TableSplitter(options)],
      ['blockquote', new BlockquoteSplitter(options)],
    ]);
    this.textSplitter = new TextSplitter(options);
  }
  splitText(text: string): string[] {
    const node = fromMarkdown(text);
    const chunks = this.splitNode(node);
    return chunks
      .map((chunk) => toMarkdown(chunk).trim())
      .filter((chunk) => chunk.length > 0);
  }

  splitNode(node: Nodes): Nodes[] {
    // Transform to hierarchical AST
    const hierarchicalAST = createHierarchicalAST(node);

    // Process hierarchical AST to generate initial chunks
    return this.processHierarchicalAST(hierarchicalAST);
  }

  protected processHierarchicalAST = (
    hierarchicalAST: HierarchicalRoot,
  ): Array<Nodes> => {
    const chunks: Nodes[] = [];

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
        const sectionChunks = this.processHierarchicalSection(child);
        chunks.push(...sectionChunks);
      } else {
        // This shouldn't happen anymore, but keep as fallback
        chunks.push(child);
      }
    }

    return chunks;
  };

  protected processHierarchicalSection(section: Section): Array<Nodes> {
    const sectionSize = getSectionSize(section);

    // Case 1: Section fits within both content and raw size limits - keep it together
    if (sectionSize <= this.maxAllowedSize) {
      return [this.convertSectionToNodes(section)];
    }

    // Case 2: Section too large - need to break it down intelligently
    return this.breakDownSection(section);
  }

  /**
   * Process section content with intelligent grouping to maximize chunk utilization
   * Works for both regular sections (with heading) and orphaned sections (without heading)
   *
   * @param section - The section to process (can be regular or orphaned)
   * @returns Array of markdown chunks with maximized utilization
   */
  protected processSection(section: Section): Array<Nodes> {
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
      const headingSize = getContentSize(section.heading);

      if (headingSize <= this.maxAllowedSize) {
        return [section.heading];
      } else {
        return this.processNode(section.heading);
      }
    } else if (contentItems.length === 0 && !section.heading) {
      // Empty orphaned section
      return [];
    }

    const chunks: Nodes[] = [];
    let currentItems: Nodes[] = [];

    // Start with heading if it exists
    if (section.heading) {
      currentItems.push(section.heading);
    }

    const flushCurrentItems = () => {
      if (currentItems.length > 0) {
        const itemsTree: Root = {
          type: 'root',
          children: currentItems as RootContent[],
        };
        chunks.push(itemsTree);
        currentItems = [];
      }
    };

    for (const item of contentItems) {
      // Calculate size if this item were added to current group
      const testItemsTree: Root = {
        type: 'root',
        children: [...currentItems, item] as RootContent[],
      };
      const testItemsSize = getContentSize(testItemsTree);

      // if (this.isWithinAllowedSize(testItemsSize, testItemsMarkdown.length)) {
      if (testItemsSize <= this.maxAllowedSize) {
        // Item fits - add to current group to maximize utilization
        currentItems.push(item);
      } else {
        // Item doesn't fit - flush current group and handle this item
        flushCurrentItems();

        // Check if item alone fits within soft limits
        const itemSize = getContentSize(item);

        if (itemSize <= this.maxAllowedSize) {
          // Item fits alone - start new group with it
          currentItems = [item];
        } else {
          // Item too large even alone - needs text splitting
          chunks.push(...this.processNode(item));
        }
      }
    }

    // Flush final group
    flushCurrentItems();

    return chunks;
  }

  protected processNode(node: Nodes): Array<Nodes> {
    const chunks: Nodes[] = [];
    const contentSize = getContentSize(node);

    if (contentSize <= this.maxAllowedSize) {
      chunks.push(node);
    } else {
      const splitter = this.nodeSplitters.get(node.type);
      if (splitter) {
        chunks.push(...splitter.splitNode(node));
      } else {
        // Not a container - fall back to text splitting
        chunks.push(...this.textSplitter.splitNode(node));
      }
    }

    return chunks;
  }

  /**
   * Break down a large section intelligently using hierarchical approach with merging optimization
   * Tries to merge related sections when they fit within allowed size limits
   *
   * @param section - The section to break down
   * @returns Array of markdown chunks optimized for space utilization
   */
  protected breakDownSection(section: Section): Array<Nodes> {
    const chunks: Nodes[] = [];

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
    const optimizedChunks = this.mergeParentWithDescendants(
      parentSection,
      nestedSections,
    );

    chunks.push(...optimizedChunks);
    return chunks;
  }

  /**
   * Merge parent section with its descendants when beneficial for space utilization
   * Uses intelligent merging to maximize chunk utilization while preserving semantic relationships
   *
   * @param parentSection - The parent section (with heading and immediate content)
   * @param nestedSections - Array of nested child sections
   * @returns Array of optimized markdown chunks
   */
  protected mergeParentWithDescendants(
    parentSection: Section | null,
    nestedSections: Section[],
  ): Array<Nodes> {
    const chunks: Nodes[] = [];

    // If no nested sections, just process the parent if it exists
    if (nestedSections.length === 0) {
      if (parentSection) {
        chunks.push(...this.processSection(parentSection));
      }
      return chunks;
    }

    // Calculate parent section size if it exists
    const parentSize = parentSection ? getSectionSize(parentSection) : 0;
    let mergedWithParent = false;

    // Strategy 1: Try to merge parent section with child sections
    if (parentSection) {
      if (parentSize <= this.maxAllowedSize) {
        const candidateSections: Section[] = [];
        let accumulatedSize = parentSize;

        // Find consecutive child sections that can merge with parent
        for (const childSection of nestedSections) {
          const childSize = getSectionSize(childSection);
          const combinedSize = accumulatedSize + childSize;

          if (combinedSize <= this.maxAllowedSize) {
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

          chunks.push(this.convertSectionToNodes(mergedSection));
          mergedWithParent = true;

          // Process remaining child sections that didn't merge with parent
          const remainingSections = nestedSections.slice(
            candidateSections.length,
          );
          if (remainingSections.length > 0) {
            const remainingChunks =
              this.mergeSiblingSections(remainingSections);
            chunks.push(...remainingChunks);
          }
        }
      }
    }

    // Strategy 2: If parent couldn't be merged or doesn't exist, process sections separately
    if (!mergedWithParent) {
      // Add parent section as separate chunk if it exists
      if (parentSection) {
        chunks.push(...this.processSection(parentSection));
      }

      // Optimize child sections through sibling merging
      if (nestedSections.length > 0) {
        const siblingChunks = this.mergeSiblingSections(nestedSections);
        chunks.push(...siblingChunks);
      }
    }

    return chunks;
  }

  /**
   * Merge sibling sections by grouping consecutive sections that fit within allowed size
   * Groups siblings at the same hierarchical level for better space utilization
   *
   * @param sections - Array of sibling sections to merge
   * @returns Array of optimized markdown chunks
   */
  protected mergeSiblingSections(sections: Section[]): Array<Nodes> {
    const chunks: Nodes[] = [];
    let currentGroup: Section[] = [];
    let currentGroupSize = 0;

    const flushCurrentGroup = () => {
      if (currentGroup.length === 0) return;

      if (currentGroup.length === 1) {
        // Single section - process normally
        const sectionChunks = this.processHierarchicalSection(currentGroup[0]);
        chunks.push(...sectionChunks);
      } else {
        // Multiple sections - merge them into a orphaned section
        const mergedSection: Section = {
          type: 'section',
          depth: 0, // Orphaned section depth
          heading: undefined,
          children: currentGroup,
        };

        chunks.push(this.convertSectionToNodes(mergedSection));
      }

      currentGroup = [];
      currentGroupSize = 0;
    };

    for (const section of sections) {
      const sectionSize = getSectionSize(section);

      // Check if section fits within allowed size by itself
      if (sectionSize > this.maxAllowedSize) {
        // Section is too large - flush current group and process this section separately
        flushCurrentGroup();
        const sectionChunks = this.processHierarchicalSection(section);
        chunks.push(...sectionChunks);
        continue;
      }

      // Check if adding this section to current group would exceed allowed size
      const combinedSize = currentGroupSize + sectionSize;
      if (currentGroup.length > 0 && combinedSize > this.maxAllowedSize) {
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
  }

  private convertSectionToNodes(section: Section): Nodes {
    return flattenHierarchicalAST({
      type: 'root',
      children: [section],
    });
  }
}
