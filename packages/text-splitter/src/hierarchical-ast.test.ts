import { describe, expect, it } from 'vitest';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { 
  createHierarchicalAST, 
  isSection, 
  getAllHeadings, 
  flattenHierarchicalAST,
  type Section 
} from './hierarchical-ast';

describe('createHierarchicalAST', () => {
  describe('Basic Functionality', () => {
    it('should handle empty AST', () => {
      const ast = fromMarkdown('');
      const result = createHierarchicalAST(ast);
      
      expect(result.type).toBe('root');
      expect(result.children).toEqual([]);
    });


    it('should handle content without headings', () => {
      const ast = fromMarkdown('Just some text.\n\nAnother paragraph.');
      const result = createHierarchicalAST(ast);
      
      expect(result.children).toHaveLength(2);
      expect(result.children[0].type).toBe('paragraph');
      expect(result.children[1].type).toBe('paragraph');
    });

    it('should create section for single heading with content', () => {
      const ast = fromMarkdown('# Title\n\nSome content here.');
      const result = createHierarchicalAST(ast);
      
      expect(result.children).toHaveLength(1);
      expect(isSection(result.children[0])).toBe(true);
      
      const section = result.children[0] as Section;
      expect(section.type).toBe('section');
      expect(section.depth).toBe(1);
      expect(section.heading.type).toBe('heading');
      expect(section.heading.depth).toBe(1);
      expect(section.children).toHaveLength(1);
      expect(section.children[0].type).toBe('paragraph');
    });

    it('should handle multiple sections at same level', () => {
      const ast = fromMarkdown('# First\n\nContent 1.\n\n# Second\n\nContent 2.');
      const result = createHierarchicalAST(ast);
      
      expect(result.children).toHaveLength(2);
      expect(isSection(result.children[0])).toBe(true);
      expect(isSection(result.children[1])).toBe(true);
      
      const section1 = result.children[0] as Section;
      const section2 = result.children[1] as Section;
      
      expect(section1.depth).toBe(1);
      expect(section2.depth).toBe(1);
      expect(section1.children).toHaveLength(1);
      expect(section2.children).toHaveLength(1);
    });
  });

  describe('Nested Hierarchies', () => {
    it('should create nested sections for different heading levels', () => {
      const markdown = `# Main Title

Main content here.

## Subtitle

Subtitle content.

### Sub-subtitle

Deep content.`;

      const ast = fromMarkdown(markdown);
      const result = createHierarchicalAST(ast);
      
      expect(result.children).toHaveLength(1);
      
      const mainSection = result.children[0] as Section;
      expect(mainSection.depth).toBe(1);
      expect(mainSection.children).toHaveLength(2); // paragraph + nested section
      
      // First child should be the main content paragraph
      expect(mainSection.children[0].type).toBe('paragraph');
      
      // Second child should be the nested section
      expect(isSection(mainSection.children[1])).toBe(true);
      const subSection = mainSection.children[1] as Section;
      expect(subSection.depth).toBe(2);
      expect(subSection.children).toHaveLength(2); // paragraph + nested section
      
      // Check deeply nested section
      expect(isSection(subSection.children[1])).toBe(true);
      const deepSection = subSection.children[1] as Section;
      expect(deepSection.depth).toBe(3);
      expect(deepSection.children).toHaveLength(1);
    });

    it('should handle complex nesting with multiple subsections', () => {
      const markdown = `# Chapter 1

Chapter intro.

## Section 1.1

Section content.

## Section 1.2

More section content.

### Subsection 1.2.1

Subsection content.

# Chapter 2

Second chapter.`;

      const ast = fromMarkdown(markdown);
      const result = createHierarchicalAST(ast);
      
      expect(result.children).toHaveLength(2);
      
      const chapter1 = result.children[0] as Section;
      expect(chapter1.depth).toBe(1);
      expect(chapter1.children).toHaveLength(3); // intro + 2 sections
      
      const section11 = chapter1.children[1] as Section;
      const section12 = chapter1.children[2] as Section;
      expect(section11.depth).toBe(2);
      expect(section12.depth).toBe(2);
      
      // Section 1.2 should have nested subsection
      expect(section12.children).toHaveLength(2); // content + subsection
      expect(isSection(section12.children[1])).toBe(true);
      
      const chapter2 = result.children[1] as Section;
      expect(chapter2.depth).toBe(1);
    });

    it('should handle heading level jumps (h1 -> h3)', () => {
      const markdown = `# Title

Content.

### Deep Section

Deep content.`;

      const ast = fromMarkdown(markdown);
      const result = createHierarchicalAST(ast);
      
      expect(result.children).toHaveLength(1);
      
      const mainSection = result.children[0] as Section;
      expect(mainSection.children).toHaveLength(2);
      
      const deepSection = mainSection.children[1] as Section;
      expect(deepSection.depth).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle content before first heading', () => {
      const markdown = `Some intro content.

Another paragraph.

# First Heading

Heading content.`;

      const ast = fromMarkdown(markdown);
      const result = createHierarchicalAST(ast);
      
      expect(result.children).toHaveLength(3); // 2 paragraphs + 1 section
      expect(result.children[0].type).toBe('paragraph');
      expect(result.children[1].type).toBe('paragraph');
      expect(isSection(result.children[2])).toBe(true);
    });

    it('should handle heading without content', () => {
      const markdown = `# Empty Heading

# Another Heading

Some content.`;

      const ast = fromMarkdown(markdown);
      const result = createHierarchicalAST(ast);
      
      expect(result.children).toHaveLength(2);
      
      const emptySection = result.children[0] as Section;
      expect(emptySection.children).toHaveLength(0);
      
      const contentSection = result.children[1] as Section;
      expect(contentSection.children).toHaveLength(1);
    });

    it('should handle mixed content types', () => {
      const markdown = `# Title

Regular paragraph.

- List item 1
- List item 2

\`\`\`javascript
code block
\`\`\`

> Blockquote text

## Subsection

More content.`;

      const ast = fromMarkdown(markdown);
      const result = createHierarchicalAST(ast);
      
      expect(result.children).toHaveLength(1);
      
      const section = result.children[0] as Section;
      expect(section.children).toHaveLength(5); // paragraph, list, code, blockquote, subsection
      
      expect(section.children[0].type).toBe('paragraph');
      expect(section.children[1].type).toBe('list');
      expect(section.children[2].type).toBe('code');
      expect(section.children[3].type).toBe('blockquote');
      expect(isSection(section.children[4])).toBe(true);
    });

    it('should handle only headings without content', () => {
      const markdown = `# First

## Second

### Third`;

      const ast = fromMarkdown(markdown);
      const result = createHierarchicalAST(ast);
      
      expect(result.children).toHaveLength(1);
      
      const mainSection = result.children[0] as Section;
      expect(mainSection.children).toHaveLength(1);
      
      const subSection = mainSection.children[0] as Section;
      expect(subSection.children).toHaveLength(1);
      
      const deepSection = subSection.children[0] as Section;
      expect(deepSection.children).toHaveLength(0);
    });
  });

  describe('Utility Functions', () => {
    it('isSection should correctly identify section nodes', () => {
      const ast = fromMarkdown('# Title\n\nContent.');
      const result = createHierarchicalAST(ast);
      
      expect(isSection(result.children[0])).toBe(true);
      
      const section = result.children[0] as Section;
      expect(isSection(section.children[0])).toBe(false); // paragraph
    });

    it('getAllHeadings should extract headings in document order', () => {
      const markdown = `# First

## Second

### Third

## Fourth`;

      const ast = fromMarkdown(markdown);
      const result = createHierarchicalAST(ast);
      const headings = getAllHeadings(result);
      
      expect(headings).toHaveLength(4);
      expect(headings[0].depth).toBe(1); // First
      expect(headings[1].depth).toBe(2); // Second
      expect(headings[2].depth).toBe(3); // Third
      expect(headings[3].depth).toBe(2); // Fourth
    });

    it('flattenHierarchicalAST should convert back to flat structure', () => {
      const markdown = `# Title

Content.

## Subtitle

More content.`;

      const ast = fromMarkdown(markdown);
      const hierarchical = createHierarchicalAST(ast);
      const flattened = flattenHierarchicalAST(hierarchical);
      
      expect(flattened.type).toBe('root');
      expect(flattened.children).toHaveLength(4); // h1, paragraph, h2, paragraph
      expect(flattened.children[0].type).toBe('heading');
      expect(flattened.children[1].type).toBe('paragraph');
      expect(flattened.children[2].type).toBe('heading');
      expect(flattened.children[3].type).toBe('paragraph');
    });
  });

  describe('Complex Real-World Examples', () => {
    it('should handle API documentation structure', () => {
      const markdown = `# API Documentation

Welcome to our API.

## Authentication

All requests require auth.

### API Keys

Use bearer tokens.

### OAuth

OAuth flow description.

## Endpoints

Available endpoints.

### GET /users

Get user list.

#### Parameters

- limit: number
- offset: number

#### Response

JSON response format.

### POST /users

Create new user.

## Rate Limiting

Rate limit information.`;

      const ast = fromMarkdown(markdown);
      const result = createHierarchicalAST(ast);
      
      expect(result.children).toHaveLength(1); // Main API Documentation section
      
      const apiSection = result.children[0] as Section;
      expect(apiSection.depth).toBe(1);
      expect(apiSection.children).toHaveLength(4); // intro + 3 main sections
      
      // Check Authentication section
      const authSection = apiSection.children[1] as Section;
      expect(authSection.depth).toBe(2);
      expect(authSection.children).toHaveLength(3); // content + 2 subsections
      
      // Check Endpoints section with nested structure
      const endpointsSection = apiSection.children[2] as Section;
      expect(endpointsSection.depth).toBe(2);
      expect(endpointsSection.children).toHaveLength(3); // content + 2 endpoint sections
      
      // Check GET /users section
      const getUsersSection = endpointsSection.children[1] as Section;
      expect(getUsersSection.depth).toBe(3);
      expect(getUsersSection.children).toHaveLength(3); // content + Parameters + Response
    });
  });

  describe('Integration and Standalone Usage', () => {
    it('should work as a standalone function without side effects', () => {
      const markdown1 = `# First Document\n\nContent 1.\n\n## Section\n\nMore content.`;
      const markdown2 = `# Second Document\n\nDifferent content.`;
      
      const ast1 = fromMarkdown(markdown1);
      const ast2 = fromMarkdown(markdown2);
      
      // Process first document
      const result1 = createHierarchicalAST(ast1);
      
      // Process second document - should not be affected by first
      const result2 = createHierarchicalAST(ast2);
      
      // Verify each result independently
      expect(result1.children).toHaveLength(1);
      expect(result2.children).toHaveLength(1);
      
      const section1 = result1.children[0] as Section;
      const section2 = result2.children[0] as Section;
      
      expect((section1.heading.children?.[0] as any)?.value).toContain('First Document');
      expect((section2.heading.children?.[0] as any)?.value).toContain('Second Document');
      
      // First document should have nested section, second should not
      expect(section1.children).toHaveLength(2); // content + nested section
      expect(section2.children).toHaveLength(1); // just content
    });

    it('should be ready for integration with text splitter', () => {
      const markdown = `# API Guide\n\nIntroduction text.\n\n## Authentication\n\nAuth details.\n\n### API Keys\n\nKey info.\n\n## Endpoints\n\nEndpoint info.`;
      
      const ast = fromMarkdown(markdown);
      const hierarchical = createHierarchicalAST(ast);
      
      // Verify structure suitable for text splitting
      expect(hierarchical.type).toBe('root');
      expect(hierarchical.children).toHaveLength(1);
      
      const mainSection = hierarchical.children[0] as Section;
      expect(mainSection.depth).toBe(1);
      expect(mainSection.children).toHaveLength(3); // intro + 2 main sections
      
      // Should be able to traverse and convert back to markdown format if needed
      const flattened = flattenHierarchicalAST(hierarchical);
      expect(flattened.children).toHaveLength(8); // h1, p, h2, p, h3, p, h2, p
      
      // Should preserve all content
      expect(flattened.children.filter(n => n.type === 'heading')).toHaveLength(4);
      expect(flattened.children.filter(n => n.type === 'paragraph')).toHaveLength(4);
    });
  });
});