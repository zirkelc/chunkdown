import type { Heading, Node, Nodes, Root, RootContent } from 'mdast';

/**
 * Section node type for hierarchical AST
 * Represents a heading with its associated content and nested subsections
 * Orphaned sections (heading = undefined and depth = 0) are used to wrap non-section content.
 */
export interface Section extends Node {
  type: 'section';
  depth: number;
  heading: Heading | undefined;
  children: (RootContent | Section)[];
}

/**
 * Hierarchical AST root that contains only sections.
 * All non-section content is wrapped in orphaned sections.
 */
export interface HierarchicalRoot extends Node {
  type: 'root';
  children: Section[];
}

/**
 * Hierarchical nodes that can be either a node or a section.
 */
export type HierarchicalNodes = Nodes | Section;

/**
 * Transform a flat mdast AST into a hierarchical structure where headings
 * contain their associated content and nested subsections.
 */
export const createHierarchicalAST = (root: Root): HierarchicalRoot => {
  /**
   * Transform nodes into hierarchical sections using a simple iterative approach
   * Groups consecutive non-section children into orphaned sections (depth 0, heading undefined)
   */
  const transform = (nodes: RootContent[]): (RootContent | Section)[] => {
    const result: (RootContent | Section)[] = [];
    let i = 0;

    while (i < nodes.length) {
      const node = nodes[i];

      if (node.type === 'heading') {
        /**
         * Start a new section
         */
        const section: Section = {
          type: 'section',
          depth: node.depth,
          heading: node,
          children: [],
        };

        /**
         * Move past the heading
         */
        i++;

        /**
         * Collect all content until we hit a heading of same or higher level or a thematic break
         */
        while (i < nodes.length) {
          const nextNode = nodes[i];

          if (nextNode.type === 'heading' && nextNode.depth <= node.depth) {
            /**
             * Found a heading at same or higher level - stop collecting
             */
            break;
          }

          if (nextNode.type === 'thematicBreak') {
            /**
             * Found a thematic break - stop collecting content for this section
             * Thematic break will be handled as standalone content
             */
            break;
          }

          /**
           * Add this content to the section
           */
          section.children.push(nextNode);
          i++;
        }

        /**
         * Now recursively process the collected children to handle nested headings
         * Filter out only RootContent nodes for recursive processing
         */
        const contentNodes = section.children.filter(
          (child): child is RootContent => !isSection(child),
        );
        section.children = transform(contentNodes);

        result.push(section);
      } else if (node.type === 'thematicBreak') {
        /**
         * Thematic breaks are standalone content that act as section boundaries
         */
        result.push(node);
        i++;
      } else {
        /**
         * Regular non-heading content
         */
        result.push(node);
        i++;
      }
    }

    return result;
  };

  const sections = transform(root.children);

  /**
   * Group consecutive non-section children into orphaned sections
   */
  const groupedSections: Section[] = [];
  let orphanedContent: RootContent[] = [];

  for (const child of sections) {
    if (isSection(child)) {
      /**
       * If we have accumulated orphaned content, create an orphaned section
       */
      if (orphanedContent.length > 0) {
        const orphanedSection: Section = {
          type: 'section',
          depth: 0,
          heading: undefined,
          children: orphanedContent,
        };
        groupedSections.push(orphanedSection);
        orphanedContent = [];
      }
      /**
       * Add the regular section
       */
      groupedSections.push(child);
    } else {
      /**
       * Add orphaned content
       */
      orphanedContent.push(child);
    }
  }

  /**
   * Add any remaining orphaned content to the grouped sections
   */
  if (orphanedContent.length > 0) {
    const orphanedSection: Section = {
      type: 'section',
      depth: 0,
      heading: undefined,
      children: orphanedContent,
    };
    groupedSections.push(orphanedSection);
  }

  return {
    type: 'root',
    children: groupedSections,
  };
};

/**
 * Check if a node is a Section
 */
export const isSection = (node: Node): node is Section => {
  return node?.type === 'section';
};

/**
 * Create a root node from a single node or an array of nodes.
 * If the node is already a root node, it is returned as is.
 * If the node is an array of nodes, a root node is created with the nodes as children.
 */
export const createTree = (nodes: Nodes | Array<Nodes>): Root => {
  if (Array.isArray(nodes)) {
    return {
      type: 'root',
      children: nodes as RootContent[],
    };
  }

  if (nodes.type === 'root') {
    return nodes;
  }

  return createTree([nodes]);
};

/**
 * Create a section node from a partial section.
 */
export const createSection = (section: Partial<Section>): Section => {
  return {
    type: 'section',
    depth: section.depth ?? 0,
    heading: section.heading,
    children: section.children ?? [],
  };
};

/**
 * Convert hierarchical AST back to flat structure
 */
export const flattenHierarchicalAST = (ast: HierarchicalRoot): Root => {
  const flatten = (nodes: (RootContent | Section)[]): RootContent[] => {
    const result: RootContent[] = [];

    for (const node of nodes) {
      if (isSection(node)) {
        if (node.heading) {
          result.push(node.heading);
        }
        result.push(...flatten(node.children));
      } else {
        result.push(node);
      }
    }

    return result;
  };

  return {
    type: 'root',
    children: flatten(ast.children),
  };
};
