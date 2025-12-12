import type {
  Definition,
  Heading,
  Image,
  ImageReference,
  Link,
  LinkReference,
  Nodes,
  Parent,
  Root,
} from 'mdast';
import {
  fromMarkdown as mdastFromMarkdown,
  type Value,
} from 'mdast-util-from-markdown';
import { gfmFromMarkdown, gfmToMarkdown } from 'mdast-util-gfm';
import { toMarkdown as mdastToMarkdown } from 'mdast-util-to-markdown';
import { gfm } from 'micromark-extension-gfm';
import { visit } from 'unist-util-visit';
import type {
  NodeRules,
  NodeTransform,
  SplitterOptions,
  TransformContext,
} from './types';

export { toString } from 'mdast-util-to-string';

// TODO store content size calculations in the node data
declare module 'mdast' {
  interface Data {
    /**
     * Content size of the node
     */
    size?: number;
    /**
     * Breadcrumbs - ancestor headings for hierarchical context
     */
    breadcrumbs?: Heading[];
  }
}

export const fromMarkdown = (value: Value): Root => {
  return mdastFromMarkdown(value, {
    extensions: [gfm()],

    mdastExtensions: [
      // https://github.com/syntax-tree/mdast-util-gfm-table
      gfmFromMarkdown(),
    ],
  });
};

export const toMarkdown = (tree: Nodes): string => {
  return mdastToMarkdown(tree, {
    // Always use resource links [text](url) instead of autolinks <url>
    resourceLink: true,
    extensions: [
      // https://github.com/syntax-tree/mdast-util-gfm-table
      gfmToMarkdown({
        // Disable delimiter alignment in tables to save useless characters
        tablePipeAlign: false,
      }),
    ],
  });
};

/**
 * Apply transform functions to nodes in the tree based on configured rules.
 * Transforms are applied in a single pass through the tree.
 */
function applyTransformations(tree: Root, rules: NodeRules): Root {
  // Collect transforms that are defined (filter out undefined transforms)
  const transformerMap = new Map<string, NodeTransform<any>>();

  for (const [type, rule] of Object.entries(rules)) {
    if (rule?.transform) {
      transformerMap.set(type, rule.transform);
    }
  }

  // If no transforms are defined, return the tree as-is
  if (transformerMap.size === 0) {
    return tree;
  }

  // If formatting transform is defined, add it to strong, emphasis, and delete
  if (transformerMap.has('formatting')) {
    const formatting = transformerMap.get('formatting')!;
    transformerMap.set('strong', transformerMap.get('strong') ?? formatting);
    transformerMap.set(
      'emphasis',
      transformerMap.get('emphasis') ?? formatting,
    );
    transformerMap.set('delete', transformerMap.get('delete') ?? formatting);
    transformerMap.delete('formatting');
  }

  const nodes = Array.from(transformerMap.keys());

  // Apply transforms using visit
  visit(tree, nodes, (node, index, parent) => {
    // Check if we have a transform for this node type
    const transform = transformerMap.get(node.type);

    if (transform && parent && typeof index === 'number') {
      // Create context
      const context: TransformContext = {
        parent,
        index,
        root: tree,
      };

      // Apply transform
      const result = transform(node as any, context);

      if (result) {
        // Replace the node with the transformed version
        parent.children[index] = result;
      }

      if (result === null) {
        // Remove the node directly
        parent.children.splice(index, 1);
        // Return index to re-visit this position since we removed a node
        return index;
      }

      // undefined means keep the node unchanged
    }
  });

  return tree;
}

/**
 * Preprocess a markdown tree based on the provided splitter options.
 */
export function preprocessMarkdown(tree: Root, options: SplitterOptions): Root {
  // Make a mutable copy of the tree for transformations
  let normalizedTree = tree;

  if (options.rules) {
    // Apply reference normalization first
    normalizedTree = normalizeReferences(normalizedTree, options.rules);

    // Apply transforms after style normalization
    normalizedTree = applyTransformations(normalizedTree, options.rules);
  }

  return normalizedTree;
}

/**
 * Normalize reference-style links and images to inline style.
 */
function normalizeReferences(tree: Root, rules: NodeRules): Root {
  // Build array of node types to visit based on options
  const nodeTypes: string[] = [];
  if (rules.link?.style === 'inline') nodeTypes.push('linkReference');
  if (rules.image?.style === 'inline') nodeTypes.push('imageReference');

  if (nodeTypes.length === 0) {
    // If nothing to normalize, return early
    return tree;
  }

  // Collect all definitions into a map
  const definitions = new Map<string, Definition>();

  visit(tree, 'definition', (node) => {
    // Identifiers are case-insensitive per CommonMark spec
    const id = node.identifier.toLowerCase();
    definitions.set(id, node);
  });

  if (definitions.size === 0) {
    // If no definitions found, nothing to normalize
    return tree;
  }

  // Track which definitions are used for normalization
  const usedDefinitions = new Set<string>();

  // Single visit for all reference transformations
  visit(tree, nodeTypes, (node, index, parent) => {
    if (!parent || typeof index !== 'number') return;

    // Type guard to ensure we have a reference node
    if (node.type === 'linkReference') {
      const linkRef = node as LinkReference;
      const id = linkRef.identifier.toLowerCase();
      const def = definitions.get(id);

      if (def && rules.link?.style === 'inline') {
        const link: Link = {
          type: 'link',
          url: def.url,
          title: def.title,
          children: linkRef.children,
          position: linkRef.position,
        };
        parent.children[index] = link;
        usedDefinitions.add(id);
      }
    } else if (node.type === 'imageReference') {
      const imageRef = node as ImageReference;
      const id = imageRef.identifier.toLowerCase();
      const def = definitions.get(id);

      if (def && rules.image?.style === 'inline') {
        const image: Image = {
          type: 'image',
          url: def.url,
          title: def.title,
          alt: imageRef.alt,
          position: imageRef.position,
        };
        parent.children[index] = image;
        usedDefinitions.add(id);
      }
    }
  });

  if (usedDefinitions.size > 0) {
    // Remove definition nodes that were used for normalization
    // Only remove definitions that we actually normalized
    tree.children = tree.children.filter((node) => {
      if (node.type !== 'definition') return true;
      const id = node.identifier.toLowerCase();
      return !usedDefinitions.has(id);
    });
  }

  return tree;
}
