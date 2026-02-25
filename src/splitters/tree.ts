import type { Heading, Nodes, Root, RootContent } from 'mdast';
import {
  createHierarchicalAST,
  createSection,
  createTree,
  flattenHierarchicalAST,
  type HierarchicalNodes,
  type HierarchicalRoot,
  isSection,
  type Section,
} from '../ast';
import { fromMarkdown, toMarkdown } from '../markdown';
import { getContentSize, getSectionSize } from '../size';
import type { SplitterOptions } from '../types';
import { AbstractNodeSplitter } from './base';
import { BlockquoteSplitter } from './blockquote';
import { CodeSplitter } from './code';
import type { NodeSplitter } from './interface';
import { ListSplitter } from './list';
import { TableSplitter } from './table';
import { TextSplitter } from './text';

export class TreeSplitter extends AbstractNodeSplitter<Root> {
  private nodeSplitters: Map<string, NodeSplitter>;
  private textSplitter: TextSplitter;

  constructor(options: SplitterOptions) {
    super(options);

    /**
     * Initialize node splitters
     */
    this.nodeSplitters = new Map<string, NodeSplitter>([
      ['list', new ListSplitter(options)],
      ['table', new TableSplitter(options)],
      ['blockquote', new BlockquoteSplitter(options)],
      ['code', new CodeSplitter(options)],
    ]);

    /**
     * Text splitter for inline content
     */
    this.textSplitter = new TextSplitter(options);
  }

  splitText(text: string): string[] {
    const node = fromMarkdown(text);
    const chunks = this.splitNode(node);
    return chunks.map((chunk) => toMarkdown(chunk).trim()).filter((chunk) => chunk.length > 0);
  }

  splitNode(node: Root): Array<Nodes> {
    /**
     * Create a tree from the root node
     * If the node is already a root node, it is returned as is.
     */
    const root = createTree(node);

    /**
     * Create a hierarchical AST from the root node
     */
    const hierachicalRoot = createHierarchicalAST(root);

    /**
     * Split the hierarchical AST into chunks
     */
    const chunks: Nodes[] = [];
    for (const chunk of this.splitTree(hierachicalRoot)) {
      /**
       * If the chunk is a section, flatten it to a root node
       * Otherwise, return the chunk as is
       */
      if (isSection(chunk)) {
        const root = flattenHierarchicalAST({
          type: 'root',
          children: [chunk],
        });
        root.data = { ...root.data, breadcrumbs: chunk.data?.breadcrumbs };
        chunks.push(root);
      } else {
        chunks.push(chunk);
      }
    }
    return chunks;
  }

  /**
   * Main generator that splits hierarchical AST into chunks
   * All children are sections (including orphaned sections created by createHierarchicalAST)
   */
  private *splitTree(hierarchicalAST: HierarchicalRoot, breadcrumbs: Heading[] = []): Generator<HierarchicalNodes> {
    for (const section of hierarchicalAST.children) {
      const sectionSize = getSectionSize(section);

      /**
       * If the section fits within the allowed size, yield it and continue to the next section
       * Breadcrumbs only contain ancestors (not the section's own heading, since it's in the chunk text)
       */
      if (sectionSize <= this.maxAllowedSize) {
        section.data = { ...section.data, breadcrumbs };
        yield section;
        continue;
      }

      /**
       * If the section is too large, split it down intelligently
       */
      yield* this.splitHierarchicalSection(section, breadcrumbs);
    }
  }

  /**
   * Splits a hierarchical section, deciding whether to keep it together or break it down.
   * Uses hierarchical approach with merging optimization to maximize chunk utilization
   */
  private *splitHierarchicalSection(section: Section, breadcrumbs: Heading[] = []): Generator<HierarchicalNodes> {
    /**
     * Build breadcrumbs for this section's content
     */
    const currentBreadcrumbs = section.heading ? [...breadcrumbs, section.heading] : breadcrumbs;

    /**
     * Separate immediate content from nested sections
     */
    const immediateContent: RootContent[] = [];
    const nestedSections: Section[] = [];

    for (const child of section.children) {
      if (isSection(child)) {
        nestedSections.push(child);
      } else {
        immediateContent.push(child);
      }
    }

    /**
     * Create parent section with immediate content if it exists
     */
    const parentSection: Section | null =
      immediateContent.length > 0 || section.heading
        ? createSection({
            depth: section.depth,
            heading: section.heading,
            children: immediateContent,
          })
        : null;

    /**
     * If no nested sections, just process the parent
     * Pass ancestors only (breadcrumbs); splitSection handles adding section heading for content-only chunks
     */
    if (nestedSections.length === 0) {
      if (parentSection) {
        yield* this.splitSection(parentSection, breadcrumbs);
      }
      return;
    }

    /**
     * Try to merge parent with as many child sections as possible
     */
    const parentSize = parentSection ? getSectionSize(parentSection) : 0;

    if (parentSection && parentSize <= this.maxAllowedSize) {
      /**
       * Find consecutive child sections that can merge with parent
       */
      let accumulatedSize = parentSize;
      let mergeCount = 0;

      for (const childSection of nestedSections) {
        const childSize = getSectionSize(childSection);
        if (accumulatedSize + childSize <= this.maxAllowedSize) {
          mergeCount++;
          accumulatedSize += childSize;
        } else {
          break; // Stop at first child that doesn't fit
        }
      }

      /**
       * If we can merge some children with parent, do it
       * Breadcrumbs only contain ancestors (the merged section has its heading in the text)
       */
      if (mergeCount > 0) {
        const mergedSection = createSection({
          ...parentSection,
          children: [...parentSection.children, ...nestedSections.slice(0, mergeCount)],
        });

        mergedSection.data = {
          ...mergedSection.data,
          breadcrumbs,
        };
        yield mergedSection;

        /**
         * Process remaining child sections
         */
        const remainingSections = nestedSections.slice(mergeCount);
        if (remainingSections.length > 0) {
          yield* this.mergeSiblingSections(remainingSections, currentBreadcrumbs);
        }
        return;
      }
    }

    /**
     * Parent couldn't be merged with children - process separately
     * Pass ancestors only (breadcrumbs); splitSection handles adding section heading for content-only chunks
     */
    if (parentSection) {
      yield* this.splitSection(parentSection, breadcrumbs);
    }

    /**
     * Process all child sections through sibling merging
     */
    yield* this.mergeSiblingSections(nestedSections, currentBreadcrumbs);
  }

  /**
   * Splits section content with grouping to maximize chunk utilization
   * Works for both regular sections (with heading) and orphaned sections (without heading)
   *
   * Breadcrumb logic:
   * - If chunk contains the section's heading → breadcrumbs = ancestors only
   * - If chunk does NOT contain the heading (content split from heading) → breadcrumbs = ancestors + section heading
   */
  private *splitSection(section: Section, breadcrumbs: Heading[] = []): Generator<HierarchicalNodes> {
    /**
     * Extract immediate content (non-section children)
     */
    const contentItems: RootContent[] = [];
    for (const child of section.children) {
      if (!isSection(child)) {
        contentItems.push(child);
      }
    }

    /**
     * Handle empty sections
     */
    if (contentItems.length === 0) {
      if (section.heading) {
        yield* this.splitSubNode(section.heading, breadcrumbs);
      }
      return;
    }

    /**
     * Breadcrumbs for content-only chunks (when heading is split from content)
     */
    const contentBreadcrumbs = section.heading ? [...breadcrumbs, section.heading] : breadcrumbs;

    let currentItems: Nodes[] = [];
    let currentItemsSize = 0;

    /**
     * Start with heading if it exists
     */
    if (section.heading) {
      currentItems.push(section.heading);
      currentItemsSize = getContentSize(section.heading);
    }

    for (const item of contentItems) {
      const itemSize = getContentSize(item);
      const potentialSize = currentItemsSize + itemSize;

      if (potentialSize <= this.maxAllowedSize) {
        currentItems.push(item);
        currentItemsSize = potentialSize;
      } else {
        /**
         * Item doesn't fit - yield current group and handle this item
         */
        if (currentItems.length > 0) {
          const tree = createTree(currentItems);
          tree.data = {
            ...tree.data,
            breadcrumbs: currentItems[0] === section.heading ? breadcrumbs : contentBreadcrumbs,
          };
          yield tree;
          currentItems = [];
          currentItemsSize = 0;
        }

        if (itemSize <= this.maxAllowedSize) {
          currentItems = [item];
          currentItemsSize = itemSize;
        } else {
          yield* this.splitSubNode(item, contentBreadcrumbs);
        }
      }
    }

    /**
     * Yield final group
     */
    if (currentItems.length > 0) {
      const tree = createTree(currentItems);
      tree.data = {
        ...tree.data,
        breadcrumbs: currentItems[0] === section.heading ? breadcrumbs : contentBreadcrumbs,
      };
      yield tree;
    }
  }

  /**
   * Splits individual nodes, delegating to specialized splitters when needed
   */
  private *splitSubNode(node: Nodes, breadcrumbs: Heading[] = []): Generator<Nodes> {
    const contentSize = getContentSize(node);

    if (contentSize <= this.maxAllowedSize) {
      node.data = { ...node.data, breadcrumbs };
      yield node;
    } else {
      /**
       * Get the appropriate splitter for the node type
       */
      const splitter = this.nodeSplitters.get(node.type);

      /**
       * If the splitter exists, split the node and yield the result.
       * Otherwise, split the node using the text splitter.
       */
      if (splitter) {
        for (const chunk of splitter.splitNode(node)) {
          chunk.data = { ...chunk.data, breadcrumbs };
          yield chunk;
        }
      } else {
        for (const chunk of this.textSplitter.splitNode(node)) {
          chunk.data = { ...chunk.data, breadcrumbs };
          yield chunk;
        }
      }
    }
  }

  /**
   * Merges sibling sections by grouping consecutive sections that fit within allowed size
   * Groups siblings at the same hierarchical level to maximize chunk utilization
   */
  private *mergeSiblingSections(sections: Section[], breadcrumbs: Heading[] = []): Generator<HierarchicalNodes> {
    let siblings: Section[] = [];
    let siblingsSize = 0;
    /**
     * Depth of the siblings' parent section.
     * Use -1 because we are merging sections at the same hierarchical level.
     */
    const siblingsDepth = Math.max(1, sections[0].depth) - 1;

    for (const section of sections) {
      const sectionSize = getSectionSize(section);

      /**
       * If section is too large by itself, yield current group and process section separately
       */
      if (sectionSize > this.maxAllowedSize) {
        /**
         * Yield accumulated group if any
         */
        if (siblings.length > 0) {
          const groupSection = createSection({
            depth: siblingsDepth,
            children: siblings,
          });
          groupSection.data = {
            ...groupSection.data,
            breadcrumbs,
          };
          yield groupSection;
        }

        yield* this.splitHierarchicalSection(section, breadcrumbs);

        siblings = [];
        siblingsSize = 0;
        continue;
      }

      /**
       * If adding this section would exceed limit, yield current group first
       */
      const combinedSize = siblingsSize + sectionSize;
      if (siblings.length > 0 && combinedSize > this.maxAllowedSize) {
        const groupSection = createSection({
          depth: siblingsDepth,
          children: siblings,
        });
        groupSection.data = {
          ...groupSection.data,
          breadcrumbs,
        };
        yield groupSection;

        siblings = [];
        siblingsSize = 0;
      }

      siblings.push(section);
      siblingsSize += sectionSize;
    }

    /**
     * Yield remaining group
     */
    if (siblings.length > 0) {
      const groupSection = createSection({
        depth: siblingsDepth,
        children: siblings,
      });
      groupSection.data = {
        ...groupSection.data,
        breadcrumbs,
      };
      yield groupSection;
    }
  }
}
