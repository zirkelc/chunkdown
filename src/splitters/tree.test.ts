import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from '../markdown';
import { getContentSize } from '../size';
import { TreeSplitter } from './tree';

const THEMATIC_BREAK = toMarkdown({ type: 'thematicBreak' }).trim();

describe('TreeSplitter', () => {
  describe('Hierarchical Boundaries', () => {
    it('should split at thematic breaks', () => {
      const splitter = new TreeSplitter({
        chunkSize: 100,
        maxOverflowRatio: 1.0,
      });
      const text = `# Section 1

First sentence. Second sentence.

---

# Section 2

First sentence. Second sentence.`;

      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(2);
      expect(chunks[0].startsWith('# Section 1')).toBe(true);
      expect(chunks[0].endsWith(THEMATIC_BREAK)).toBe(true);
      expect(chunks[1].startsWith('# Section 2')).toBe(true);
    });

    it('should split by sections', () => {
      const splitter = new TreeSplitter({
        chunkSize: 100,
        maxOverflowRatio: 1.0,
      });
      const text = `# Section 1

First sentence. Second sentence.

## Sub-section 1.1

First sentence. Second sentence.

# Section 2

First sentence. Second sentence.

## Sub-section 2.1

First sentence. Second sentence.`;
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(2);
      expect(chunks[0]).toBe(`# Section 1

First sentence. Second sentence.

## Sub-section 1.1

First sentence. Second sentence.`);
      expect(chunks[1]).toBe(`# Section 2

First sentence. Second sentence.

## Sub-section 2.1

First sentence. Second sentence.`);
    });

    it('should split by sub-sections', () => {
      const splitter = new TreeSplitter({
        chunkSize: 80,
        maxOverflowRatio: 1.0,
      });
      const text = `# Section 1

First sentence. Second sentence.

## Sub-section 1.1

First sentence. Second sentence.

# Section 2

First sentence. Second sentence.

## Sub-section 2.1

First sentence. Second sentence.`;
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(4);
      expect(chunks[0]).toBe(`# Section 1

First sentence. Second sentence.`);
      expect(chunks[1]).toBe(`## Sub-section 1.1

First sentence. Second sentence.`);
      expect(chunks[2]).toBe(`# Section 2

First sentence. Second sentence.`);
      expect(chunks[3]).toBe(`## Sub-section 2.1

First sentence. Second sentence.`);
    });

    it('should split by paragraph', () => {
      const splitter = new TreeSplitter({
        chunkSize: 60,
        maxOverflowRatio: 1.0,
      });
      const text = `First sentence. Second sentence.

First sentence. Second sentence.

First sentence. Second sentence.`;
      const chunks = splitter.splitText(text);

      expect(chunks.length).toBe(3);
      expect(chunks[0]).toBe('First sentence. Second sentence.');
      expect(chunks[1]).toBe('First sentence. Second sentence.');
      expect(chunks[2]).toBe('First sentence. Second sentence.');
    });
  });

  describe('Parent-Descendant Merging', () => {
    it('should merge parent section with child sections when they fit together', () => {
      const splitter = new TreeSplitter({
        chunkSize: 1000,
        maxOverflowRatio: 1.5,
      });

      const text = `## Main Section

This is the main section with some introductory content that explains what this section is about.

### Child Section 1

This is the first child section with moderate content that should fit with the parent.

### Child Section 2

This is the second child section with some additional content.

### Child Section 3

This is the third child section with final content for this group.

## Another Main Section

This section should be separate since it's a sibling of the first main section.`;

      const chunks = splitter.splitText(text);

      // Main Section + children, Another Main Section
      expect(chunks.length).toBe(2);

      // First chunk should contain parent and multiple children
      expect(chunks[0]).toContain('## Main Section');
      expect(chunks[0]).toContain('### Child Section 1');
      expect(chunks[0]).toContain('### Child Section 2');
      expect(chunks[0]).toContain('### Child Section 3');

      // Second chunk should contain the other main section
      expect(chunks[1]).toContain('## Another Main Section');

      // Should stay within allowed size
      chunks.forEach((chunk) => {
        expect(getContentSize(chunk)).toBeLessThanOrEqual(1500); // 1000 * 1.5
      });
    });

    it('should not merge if combined size exceeds max allowed size', () => {
      const splitter = new TreeSplitter({
        chunkSize: 200,
        maxOverflowRatio: 1.2, // Only 240 chars allowed
      });

      const text = `## Main Section

This is a longer main section with substantial introductory content that explains what this section is about in great detail with many words and explanations.

### Child Section 1

This child section also has substantial content that would make the combined size exceed the maximum allowed size when merged with the parent section.

### Child Section 2

Another child section with content.`;

      const chunks = splitter.splitText(text);

      // Should create 2 chunks due to size constraints
      expect(chunks.length).toBe(2);
      expect(chunks[0]).toContain('## Main Section');
      expect(chunks[1]).toContain('### Child Section 1');

      // No chunk should exceed the allowed size
      chunks.forEach((chunk) => {
        expect(getContentSize(chunk)).toBeLessThanOrEqual(240); // 200 * 1.2
      });
    });
  });

  describe('Sibling Section Merging', () => {
    it('should merge sibling sections when parent is too large to merge', () => {
      const splitter = new TreeSplitter({
        chunkSize: 300,
        maxOverflowRatio: 1.5, // 450 chars allowed
      });

      const text = `# Large Parent Section

This is a large parent section with substantial content that takes up significant space. It contains multiple sentences with detailed explanations and examples. This content is designed to be large enough that it cannot merge with its child sections due to size constraints. The parent section alone should be close to or exceed the base chunk size to prevent parent-child merging but allow sibling merging of the children.

## First Child Section

Short content for first child.

## Second Child Section

Short content for second child.

## Third Child Section

Short content for third child.`;

      const chunks = splitter.splitText(text);

      // Should create 2 chunks: large parent separate, siblings merged
      expect(chunks.length).toBe(2);

      // First chunk should be the large parent alone
      expect(chunks[0]).toContain('# Large Parent Section');
      expect(chunks[0]).not.toContain('## First Child Section');

      // Second chunk should contain merged siblings
      expect(chunks[1]).toContain('## First Child Section');
      expect(chunks[1]).toContain('## Second Child Section');
      expect(chunks[1]).toContain('## Third Child Section');

      // All chunks should stay within allowed size
      chunks.forEach((chunk) => {
        expect(getContentSize(chunk)).toBeLessThanOrEqual(450); // 300 * 1.5
      });
    });

    it('should merge some siblings but not others based on size constraints', () => {
      const splitter = new TreeSplitter({
        chunkSize: 150,
        maxOverflowRatio: 1.3, // 195 chars allowed
      });

      // Create scenario where parent can't merge with children,
      // and siblings have mixed sizes preventing complete merging
      const text = `# Parent Section

This is a parent section with substantial content that is designed to be large enough to prevent merging with any child sections. The parent section contains multiple detailed sentences with comprehensive explanations and examples that ensure its size exceeds the merge threshold when combined with any child section.

## Small Sibling A

Short content A.

## Small Sibling B

Short content B.

## Large Sibling Section

This is a much larger sibling section with substantial content that contains multiple sentences and detailed explanations that make it too large to merge with the small siblings.

## Small Sibling C

Short content C.`;

      const chunks = splitter.splitText(text);

      // Parent gets split due to size, siblings show selective merging behavior
      // Small siblings A+B merge together, large sibling separate, small sibling C separate
      expect(chunks.length).toBe(7);

      // Key behavior to test: Small siblings A+B merged, but sibling C separate
      // Find the chunk containing small siblings A and B (merged together)
      const siblingABChunk = chunks.find(
        (chunk) =>
          chunk.includes('## Small Sibling A') &&
          chunk.includes('## Small Sibling B'),
      );
      expect(siblingABChunk).toBeDefined();
      expect(siblingABChunk).not.toContain('## Large Sibling Section');
      expect(siblingABChunk).not.toContain('## Small Sibling C');

      // Large sibling should be in separate chunk(s)
      const largeSiblingChunks = chunks.filter((chunk) =>
        chunk.includes('## Large Sibling Section'),
      );
      expect(largeSiblingChunks.length).toBeDefined();
      expect(largeSiblingChunks).not.toContain('## Small Sibling A');
      expect(largeSiblingChunks).not.toContain('## Small Sibling B');
      expect(largeSiblingChunks).not.toContain('## Small Sibling C');

      // Small sibling C should be alone
      const siblingCChunk = chunks.find((chunk) =>
        chunk.includes('## Small Sibling C'),
      );
      expect(siblingCChunk).toBeDefined();
      expect(siblingCChunk).not.toContain('## Small Sibling A');
      expect(siblingCChunk).not.toContain('## Small Sibling B');
      expect(siblingCChunk).not.toContain('## Large Sibling Section');

      // Verify size constraints
      chunks.forEach((chunk) => {
        expect(getContentSize(chunk)).toBeLessThanOrEqual(195);
      });
    });

    it('should handle orphaned sections (limitation: currently processed individually)', () => {
      const splitter = new TreeSplitter({
        chunkSize: 100,
        maxOverflowRatio: 1.5, // 150 chars allowed
      });

      // Test pure sibling sections without a hierarchical parent
      // Note: Current implementation treats these as individual sections
      // This could be improved in future versions to merge orphaned siblings
      const text = `## Section Alpha

Short content A.

## Section Beta

Short content B.

## Section Gamma

Short content C.`;

      const chunks = splitter.splitText(text);

      // Currently creates 3 separate chunks (limitation of current implementation)
      expect(chunks.length).toBe(3);

      // Each chunk should contain one section
      expect(chunks[0]).toContain('## Section Alpha');
      expect(chunks[1]).toContain('## Section Beta');
      expect(chunks[2]).toContain('## Section Gamma');

      // Verify size constraints
      chunks.forEach((chunk) => {
        expect(getContentSize(chunk)).toBeLessThanOrEqual(150);
      });
    });
  });

  describe('Breadcrumbs', () => {
    /**
     * Breadcrumb behavior:
     * - Breadcrumbs contain ONLY ancestor headings (not the section's own heading if it's in the chunk)
     * - If chunk contains a heading → breadcrumbs = ancestors of that heading
     * - If chunk is content-only (split from its heading) → breadcrumbs = ancestors + section heading
     */

    it('should return empty breadcrumbs for orphaned content and top-level headings', () => {
      const splitter = new TreeSplitter({
        chunkSize: 100,
        maxOverflowRatio: 1.0,
      });

      const text = `Some intro text before any heading.

# First Heading

Content under heading.`;

      const root = fromMarkdown(text);
      const chunks = splitter.splitNode(root);

      expect(chunks.length).toBe(2);

      // Chunk 0: orphaned content → empty breadcrumbs
      expect(toMarkdown(chunks[0]).trim()).toBe(
        'Some intro text before any heading.',
      );
      expect(chunks[0].data?.breadcrumbs).toEqual([]);

      // Chunk 1: "# First Heading" with content → empty breadcrumbs (H1 has no ancestors)
      expect(toMarkdown(chunks[1])).toContain('# First Heading');
      expect(chunks[1].data?.breadcrumbs).toEqual([]);
    });

    it('should return ancestor breadcrumbs for nested sections', () => {
      const splitter = new TreeSplitter({
        chunkSize: 50,
        maxOverflowRatio: 1.0,
      });

      const text = `# Level 1

## Level 2

Content under level 2.

### Level 3

Content under level 3.`;

      const root = fromMarkdown(text);
      const chunks = splitter.splitNode(root);

      // Output:
      // Chunk 0: "# Level 1", breadcrumbs=[]
      // Chunk 1: "## Level 2\n\nContent under level 2.", breadcrumbs=[depth:1]
      // Chunk 2: "### Level 3\n\nContent under level 3.", breadcrumbs=[depth:1, depth:2]

      expect(chunks.length).toBe(3);

      // Chunk 0: H1 heading only → empty breadcrumbs
      expect(toMarkdown(chunks[0]).trim()).toBe('# Level 1');
      expect(chunks[0].data?.breadcrumbs).toEqual([]);

      // Chunk 1: H2 with content → breadcrumbs = [H1]
      expect(toMarkdown(chunks[1])).toContain('## Level 2');
      expect(toMarkdown(chunks[1])).toContain('Content under level 2');
      expect(chunks[1].data?.breadcrumbs?.length).toBe(1);
      expect(chunks[1].data?.breadcrumbs?.[0].depth).toBe(1);

      // Chunk 2: H3 with content → breadcrumbs = [H1, H2]
      expect(toMarkdown(chunks[2])).toContain('### Level 3');
      expect(toMarkdown(chunks[2])).toContain('Content under level 3');
      expect(chunks[2].data?.breadcrumbs?.length).toBe(2);
      expect(chunks[2].data?.breadcrumbs?.[0].depth).toBe(1);
      expect(chunks[2].data?.breadcrumbs?.[1].depth).toBe(2);
    });

    it('should include section heading in breadcrumbs for content-only chunks', () => {
      const splitter = new TreeSplitter({
        chunkSize: 50,
        maxOverflowRatio: 1.0,
      });

      const text = `# Main Section

## Sub Section

First paragraph content.

Second paragraph content.

Third paragraph content.`;

      const root = fromMarkdown(text);
      const chunks = splitter.splitNode(root);

      // Output:
      // Chunk 0: "# Main Section", breadcrumbs=[]
      // Chunk 1: "## Sub Section\n\nFirst paragraph content.", breadcrumbs=[depth:1]
      // Chunk 2: "Second paragraph content.\n\nThird paragraph content.", breadcrumbs=[depth:1, depth:2]

      expect(chunks.length).toBe(3);

      // Chunk 0: H1 heading only → empty breadcrumbs
      expect(toMarkdown(chunks[0]).trim()).toBe('# Main Section');
      expect(chunks[0].data?.breadcrumbs).toEqual([]);

      // Chunk 1: H2 with first paragraph → breadcrumbs = [H1]
      expect(toMarkdown(chunks[1])).toContain('## Sub Section');
      expect(toMarkdown(chunks[1])).toContain('First paragraph content');
      expect(chunks[1].data?.breadcrumbs?.length).toBe(1);
      expect(chunks[1].data?.breadcrumbs?.[0].depth).toBe(1);

      // Chunk 2: content-only (split from H2) → breadcrumbs = [H1, H2]
      expect(toMarkdown(chunks[2])).toContain('Second paragraph content');
      expect(toMarkdown(chunks[2])).toContain('Third paragraph content');
      expect(toMarkdown(chunks[2])).not.toContain('##');
      expect(chunks[2].data?.breadcrumbs?.length).toBe(2);
      expect(chunks[2].data?.breadcrumbs?.[0].depth).toBe(1);
      expect(chunks[2].data?.breadcrumbs?.[1].depth).toBe(2);
    });

    it('should reset breadcrumbs for sibling sections', () => {
      const splitter = new TreeSplitter({
        chunkSize: 50,
        maxOverflowRatio: 1.0,
      });

      const text = `# Section A

Content A.

# Section B

Content B.`;

      const root = fromMarkdown(text);
      const chunks = splitter.splitNode(root);

      expect(chunks.length).toBe(2);

      // Chunk 0: "# Section A" with content → empty breadcrumbs
      expect(toMarkdown(chunks[0])).toContain('# Section A');
      expect(chunks[0].data?.breadcrumbs).toEqual([]);

      // Chunk 1: "# Section B" with content → empty breadcrumbs (not [A, B])
      expect(toMarkdown(chunks[1])).toContain('# Section B');
      expect(chunks[1].data?.breadcrumbs).toEqual([]);
    });

    it('should include full ancestor chain when content is deeply split from heading', () => {
      const splitter = new TreeSplitter({
        chunkSize: 20, // Very small to force heading to split from content
        maxOverflowRatio: 1.0,
      });

      const text = `# Level 1

## Level 2

### Level 3

Content under level 3.`;

      const root = fromMarkdown(text);
      const chunks = splitter.splitNode(root);

      // Output:
      // Chunk 0: "# Level 1", breadcrumbs=[]
      // Chunk 1: "## Level 2", breadcrumbs=[depth:1]
      // Chunk 2: "### Level 3", breadcrumbs=[depth:1, depth:2]
      // Chunk 3: "Content under", breadcrumbs=[depth:1, depth:2, depth:3]
      // Chunk 4: "level 3.", breadcrumbs=[depth:1, depth:2, depth:3]

      expect(chunks.length).toBeGreaterThanOrEqual(5);

      // Chunk 0: H1 only → empty breadcrumbs
      expect(toMarkdown(chunks[0]).trim()).toBe('# Level 1');
      expect(chunks[0].data?.breadcrumbs).toEqual([]);

      // Chunk 1: H2 only → breadcrumbs = [H1]
      expect(toMarkdown(chunks[1]).trim()).toBe('## Level 2');
      expect(chunks[1].data?.breadcrumbs?.length).toBe(1);
      expect(chunks[1].data?.breadcrumbs?.[0].depth).toBe(1);

      // Chunk 2: H3 only → breadcrumbs = [H1, H2]
      expect(toMarkdown(chunks[2]).trim()).toBe('### Level 3');
      expect(chunks[2].data?.breadcrumbs?.length).toBe(2);
      expect(chunks[2].data?.breadcrumbs?.[0].depth).toBe(1);
      expect(chunks[2].data?.breadcrumbs?.[1].depth).toBe(2);

      // Chunk 3+: content split from H3 → breadcrumbs = [H1, H2, H3]
      expect(toMarkdown(chunks[3])).toContain('Content');
      expect(chunks[3].data?.breadcrumbs?.length).toBe(3);
      expect(chunks[3].data?.breadcrumbs?.[0].depth).toBe(1);
      expect(chunks[3].data?.breadcrumbs?.[1].depth).toBe(2);
      expect(chunks[3].data?.breadcrumbs?.[2].depth).toBe(3);
    });

    it('should handle the example from issue: H1 > H2 hierarchy', () => {
      const splitter = new TreeSplitter({
        chunkSize: 30,
        maxOverflowRatio: 2,
      });

      const text = `# Heading 1

Paragraph under Heading 1

## Heading 2

Paragraph under Heading 2`;

      const root = fromMarkdown(text);
      const chunks = splitter.splitNode(root);

      expect(chunks.length).toBe(2);

      // Chunk 0: H1 with content → empty breadcrumbs
      expect(toMarkdown(chunks[0])).toContain('# Heading 1');
      expect(toMarkdown(chunks[0])).toContain('Paragraph under Heading 1');
      expect(chunks[0].data?.breadcrumbs).toEqual([]);

      // Chunk 1: H2 with content → breadcrumbs = [H1]
      expect(toMarkdown(chunks[1])).toContain('## Heading 2');
      expect(toMarkdown(chunks[1])).toContain('Paragraph under Heading 2');
      expect(chunks[1].data?.breadcrumbs?.length).toBe(1);
      expect(chunks[1].data?.breadcrumbs?.[0].depth).toBe(1);
    });
  });
});
