import type { Heading, Node, Nodes, Root, RootContent } from 'mdast';

/**
 * Section node type for hierarchical AST
 * Represents a heading with its associated content and nested subsections
 * Shadow sections (heading = undefined) are used for orphaned content
 */
export interface Section extends Node {
  type: 'section';
  depth: number;
  heading: Heading | undefined;
  children: (RootContent | Section)[];
}

/**
 * Hierarchical AST root that can contain sections or regular content
 */
export interface HierarchicalRoot extends Node {
  type: 'root';
  children: (RootContent | Section)[];
}

/**
 * Transform a flat mdast AST into a hierarchical structure where headings
 * contain their associated content and nested subsections.
 *
 * Algorithm:
 * 1. Process nodes sequentially
 * 2. When encountering a heading, create a new section
 * 3. Collect following content until next heading of same/higher level
 * 4. Recursively process nested subsections for lower-level headings
 *
 * @param ast - The flat mdast AST to transform
 * @returns Hierarchical AST with section nodes
 *
 * @example
 * ```typescript
 * const flatAST = fromMarkdown('# Title\n\nRootContent\n\n## Subtitle\n\nMore content');
 * const hierarchicalAST = createHierarchicalAST(flatAST);
 *
 * // Result structure:
 * // {
 * //   type: 'root',
 * //   children: [{
 * //     type: 'section',
 * //     depth: 1,
 * //     heading: { type: 'heading', depth: 1, ... },
 * //     children: [
 * //       { type: 'paragraph', ... }, // "RootContent"
 * //       {
 * //         type: 'section',
 * //         depth: 2,
 * //         heading: { type: 'heading', depth: 2, ... },
 * //         children: [
 * //           { type: 'paragraph', ... } // "More content"
 * //         ]
 * //       }
 * //     ]
 * //   }]
 * // }
 * ```
 */
export const createHierarchicalAST = (node: Nodes): HierarchicalRoot => {
  if (!('children' in node) || node.children.length === 0) {
    if (node.type === 'root') {
      return { type: 'root', children: node.children };
    }
    return { type: 'root', children: [node] };
  }

  /**
   * Transform nodes into hierarchical sections using a simple iterative approach
   */
  const transformToSections = (
    nodes: RootContent[],
  ): (RootContent | Section)[] => {
    const result: (RootContent | Section)[] = [];
    let i = 0;

    while (i < nodes.length) {
      const node = nodes[i];

      if (node.type === 'heading') {
        // Start a new section
        const section: Section = {
          type: 'section',
          depth: node.depth,
          heading: node,
          children: [],
        };

        // Collect all content until we hit a heading of same or higher level or a thematic break
        i++; // Move past the heading
        while (i < nodes.length) {
          const nextNode = nodes[i];

          if (nextNode.type === 'heading' && nextNode.depth <= node.depth) {
            // Found a heading at same or higher level - stop collecting
            break;
          }

          if (nextNode.type === 'thematicBreak') {
            // Found a thematic break - stop collecting content for this section
            // The thematic break will be handled as standalone content
            break;
          }

          // Add this content to the section
          section.children.push(nextNode);
          i++;
        }

        // Now recursively process the collected children to handle nested headings
        // Filter out only RootContent nodes for recursive processing
        const contentNodes = section.children.filter(
          (child): child is RootContent => !isSection(child),
        );
        section.children = transformToSections(contentNodes);

        result.push(section);
      } else if (node.type === 'thematicBreak') {
        // Thematic breaks are standalone content that act as section boundaries
        result.push(node);
        i++;
      } else {
        // Regular non-heading content
        result.push(node);
        i++;
      }
    }

    return result;
  };

  const sections = transformToSections(
    node.type === 'root' ? node.children : [node],
  );

  return {
    type: 'root',
    children: sections,
  };
};

/**
 * Check if a node is a Section
 */
export const isSection = (node: Node): node is Section => {
  return node?.type === 'section';
};

/**
 * Utility to get all headings from a hierarchical AST in document order
 */
export const getAllHeadings = (ast: HierarchicalRoot): Heading[] => {
  const headings: Heading[] = [];

  const traverse = (nodes: (RootContent | Section)[]) => {
    for (const node of nodes) {
      if (isSection(node)) {
        if (node.heading) {
          headings.push(node.heading);
        }
        traverse(node.children);
      }
    }
  };

  traverse(ast.children);
  return headings;
};

/**
 * Utility to convert hierarchical AST back to flat structure (for testing/debugging)
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
