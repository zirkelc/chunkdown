import type {
  Definition,
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
import type { SplitterOptions } from './types';

export { toString } from 'mdast-util-to-string';

// TODO store content size calculations in the node data
declare module 'mdast' {
  interface Data {
    /**
     * Content size of the node
     */
    size?: number;
  }
}

export const fromMarkdown = (value: Value): Root => {
  return mdastFromMarkdown(value, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
};

export const toMarkdown = (tree: Nodes): string => {
  return mdastToMarkdown(tree, {
    extensions: [gfmToMarkdown()],
  });
};

/**
 * Normalize a markdown tree based on the provided splitter options.
 */
export function normalizeMarkdown(tree: Root, options: SplitterOptions): Root {
  // Check if reference normalization is needed
  const linkRule = options.rules?.link;
  const imageRule = options.rules?.image;

  const shouldNormalizeLinks = linkRule?.style === 'inline';
  const shouldNormalizeImages = imageRule?.style === 'inline';

  // If no normalizations are needed, return tree as-is
  if (!shouldNormalizeLinks && !shouldNormalizeImages) {
    return tree;
  }

  // Apply reference normalization
  return normalizeReferences(tree, {
    links: shouldNormalizeLinks ?? false,
    images: shouldNormalizeImages ?? false,
  });
}

/**
 * Options for normalizing reference-style links and images
 */
interface NormalizeReferencesOptions {
  /**
   * Whether to normalize reference-style links to inline links
   */
  links: boolean;
  /**
   * Whether to normalize reference-style images to inline images
   */
  images: boolean;
}

/**
 * Normalize reference-style links and images to inline style.
 *
 * This function:
 * 1. Collects all definition nodes (link/image reference definitions)
 * 2. Transforms linkReference nodes into link nodes
 * 3. Transforms imageReference nodes into image nodes
 * 4. Removes definition nodes from the tree
 *
 * @param tree - The mdast tree to normalize
 * @param options - Options to control which references to normalize
 * @returns The normalized tree
 */
function normalizeReferences(
  tree: Root,
  options: NormalizeReferencesOptions,
): Root {
  // Step 1: Collect all definitions into a map
  const definitions = new Map<string, Definition>();

  visit(tree, 'definition', (node: Definition) => {
    // Identifiers are case-insensitive per CommonMark spec
    const id = node.identifier.toLowerCase();
    definitions.set(id, node);
  });

  // Track which definitions are used for normalization
  const usedDefinitions = new Set<string>();

  // Step 2: Transform linkReference -> link
  if (options.links) {
    visit(tree, 'linkReference', (node: LinkReference, index, parent) => {
      const id = node.identifier.toLowerCase();
      const def = definitions.get(id);

      if (def && parent && typeof index === 'number') {
        const link: Link = {
          type: 'link',
          url: def.url,
          title: def.title,
          children: node.children,
          position: node.position,
        };
        (parent as Parent).children[index] = link;
        usedDefinitions.add(id);
      }
    });
  }

  // Step 3: Transform imageReference -> image
  if (options.images) {
    visit(tree, 'imageReference', (node: ImageReference, index, parent) => {
      const id = node.identifier.toLowerCase();
      const def = definitions.get(id);

      if (def && parent && typeof index === 'number') {
        const image: Image = {
          type: 'image',
          url: def.url,
          title: def.title,
          alt: node.alt,
          position: node.position,
        };
        (parent as Parent).children[index] = image;
        usedDefinitions.add(id);
      }
    });
  }

  // Step 4: Remove definition nodes that were used for normalization
  // Only remove definitions that we actually normalized
  if (usedDefinitions.size > 0) {
    tree.children = tree.children.filter((node) => {
      if (node.type !== 'definition') return true;
      const id = node.identifier.toLowerCase();
      return !usedDefinitions.has(id);
    });
  }

  return tree;
}
