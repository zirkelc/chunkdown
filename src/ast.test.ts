import { fromMarkdown } from 'mdast-util-from-markdown';
import { describe, expect, it } from 'vitest';
import {
  createHierarchicalAST,
  flattenHierarchicalAST,
  getAllHeadings,
  type HierarchicalRoot,
  isSection,
  type Section,
} from './ast';

const createAST = (markdown: string) => {
  const ast = fromMarkdown(markdown);
  return createHierarchicalAST(ast);
};

// Helper to get section at path (e.g., [0, 1] = first child, second child)
const getSection = (result: HierarchicalRoot, path: number[]): Section => {
  let current: HierarchicalRoot | Section = result;
  for (const index of path) {
    current = current.children[index] as Section;
  }
  return current as Section;
};

describe('createHierarchicalAST', () => {
  describe('Basic functionality', () => {
    it('handles empty AST', () => {
      const result = createAST('');
      expect(result.type).toBe('root');
      expect(result.children.length).toBe(0);
    });

    it('handles content without headings', () => {
      const result = createAST('Just text.\n\nAnother paragraph.');
      expect(result.children.length).toBe(2);
      expect(result.children[0].type).toBe('paragraph');
      expect(result.children[1].type).toBe('paragraph');
    });

    it('creates section for single heading', () => {
      const result = createAST('# Title\n\nContent here.');
      expect(result.children.length).toBe(1);

      const section = result.children[0] as Section;
      expect(isSection(section)).toBe(true);
      expect(section.depth).toBe(1);
      expect(section.heading?.depth).toBe(1);
      expect(section.children.length).toBe(1);
      expect(section.children[0].type).toBe('paragraph');
    });

    it('handles content before first heading', () => {
      const result = createAST('Intro text.\n\n# Heading\n\nContent.');
      expect(result.children.length).toBe(2);
      expect(result.children[0].type).toBe('paragraph');
      expect(isSection(result.children[1])).toBe(true);
    });
  });

  describe('Section nesting', () => {
    it('creates nested sections for different depths', () => {
      const result = createAST(
        '# Main\n\nMain content.\n\n## Sub\n\nSub content.\n\n### Deep\n\nDeep content.',
      );

      const main = getSection(result, [0]);
      expect(main.depth).toBe(1);
      expect(main.children.length).toBe(2);
      expect(main.children[0].type).toBe('paragraph');

      const sub = getSection(result, [0, 1]);
      expect(sub.depth).toBe(2);
      expect(sub.children.length).toBe(2);

      const deep = getSection(result, [0, 1, 1]);
      expect(deep.depth).toBe(3);
      expect(deep.children.length).toBe(1);
    });

    it('handles multiple sections at same level', () => {
      const result = createAST(
        '# First\n\nContent 1.\n\n# Second\n\nContent 2.',
      );
      expect(result.children.length).toBe(2);

      const first = getSection(result, [0]);
      const second = getSection(result, [1]);
      expect(first.depth).toBe(1);
      expect(second.depth).toBe(1);
      expect(first.children.length).toBe(1);
      expect(second.children.length).toBe(1);
    });

    it('handles heading level jumps', () => {
      const result = createAST(
        '# Title\n\nContent.\n\n### Deep\n\nDeep content.',
      );

      const main = getSection(result, [0]);
      expect(main.children.length).toBe(2);

      const deep = getSection(result, [0, 1]);
      expect(deep.depth).toBe(3);
    });

    it('handles complex sibling sections', () => {
      const result = createAST(
        '# Ch1\n\nIntro.\n\n## S1.1\n\nContent.\n\n## S1.2\n\nMore.\n\n# Ch2\n\nSecond.',
      );
      expect(result.children.length).toBe(2);

      const ch1 = getSection(result, [0]);
      expect(ch1.children.length).toBe(3); // intro + 2 subsections

      const s11 = getSection(result, [0, 1]);
      const s12 = getSection(result, [0, 2]);
      expect(s11.depth).toBe(2);
      expect(s12.depth).toBe(2);
    });
  });

  describe('Thematic breaks', () => {
    it('treats thematic breaks as section boundaries', () => {
      const result = createAST(
        '# Section\n\nBefore break.\n\n---\n\nAfter break.',
      );
      expect(result.children.length).toBe(3);

      const section = getSection(result, [0]);
      expect(section.children.length).toBe(1); // only content before break
      expect(result.children[1].type).toBe('thematicBreak');
      expect(result.children[2].type).toBe('paragraph');
    });

    it('handles multiple thematic breaks', () => {
      const result = createAST(
        '# Title\n\nContent.\n\n---\n\nMiddle.\n\n---\n\nEnd.',
      );
      expect(result.children.length).toBe(5); // section, break, paragraph, break, paragraph
      expect(result.children[1].type).toBe('thematicBreak');
      expect(result.children[3].type).toBe('thematicBreak');
    });
  });

  describe('Edge cases', () => {
    it('handles empty sections', () => {
      const result = createAST('# Empty\n\n# Another\n\nWith content.');
      expect(result.children.length).toBe(2);

      const empty = getSection(result, [0]);
      const withContent = getSection(result, [1]);
      expect(empty.children.length).toBe(0);
      expect(withContent.children.length).toBe(1);
    });

    it('handles consecutive headings', () => {
      const result = createAST('# First\n\n# Second\n\n# Third\n\nContent.');
      expect(result.children.length).toBe(3);

      const first = getSection(result, [0]);
      const second = getSection(result, [1]);
      const third = getSection(result, [2]);
      expect(first.children.length).toBe(0);
      expect(second.children.length).toBe(0);
      expect(third.children.length).toBe(1);
    });

    it('handles extreme nesting levels', () => {
      const result = createAST(
        '# L1\n\n## L2\n\n### L3\n\n#### L4\n\n##### L5\n\n###### L6\n\nDeep content.',
      );

      const l6 = getSection(result, [0, 0, 0, 0, 0, 0]);
      expect(l6.depth).toBe(6);
      expect(l6.children.length).toBe(1);
    });

    it('handles mixed content types in sections', () => {
      const result = createAST(
        '# Title\n\nParagraph.\n\n- List item\n\n```\ncode\n```\n\n> Quote',
      );

      const section = getSection(result, [0]);
      expect(section.children.length).toBe(4);
      expect(section.children[0].type).toBe('paragraph');
      expect(section.children[1].type).toBe('list');
      expect(section.children[2].type).toBe('code');
      expect(section.children[3].type).toBe('blockquote');
    });
  });
});

describe('isSection', () => {
  it('correctly identifies section nodes', () => {
    const result = createAST('# Title\n\nContent.');
    const section = result.children[0] as Section;

    expect(isSection(section)).toBe(true);
    expect(isSection(section.children[0])).toBe(false);
  });
});

describe('getAllHeadings', () => {
  it('extracts headings in document order', () => {
    const result = createAST('# First\n\n## Second\n\n### Third\n\n## Fourth');
    const headings = getAllHeadings(result);

    expect(headings.length).toBe(4);
    expect(headings[0].depth).toBe(1);
    expect(headings[1].depth).toBe(2);
    expect(headings[2].depth).toBe(3);
    expect(headings[3].depth).toBe(2);
  });

  it('handles empty AST', () => {
    const result = createAST('');
    const headings = getAllHeadings(result);
    expect(headings.length).toBe(0);
  });

  it('handles AST without headings', () => {
    const result = createAST('Just text.\n\nMore text.');
    const headings = getAllHeadings(result);
    expect(headings.length).toBe(0);
  });
});

describe('flattenHierarchicalAST', () => {
  it('converts hierarchical back to flat structure', () => {
    const original = fromMarkdown('# Title\n\nContent.\n\n## Sub\n\nMore.');
    const hierarchical = createHierarchicalAST(original);
    const flattened = flattenHierarchicalAST(hierarchical);

    expect(flattened.type).toBe('root');
    expect(flattened.children.length).toBe(4); // h1, p, h2, p
    expect(flattened.children[0].type).toBe('heading');
    expect(flattened.children[1].type).toBe('paragraph');
    expect(flattened.children[2].type).toBe('heading');
    expect(flattened.children[3].type).toBe('paragraph');
  });

  it('preserves content order with thematic breaks', () => {
    const hierarchical = createAST('# Title\n\nContent.\n\n---\n\nAfter.');
    const flattened = flattenHierarchicalAST(hierarchical);

    expect(flattened.children.length).toBe(4);
    expect(flattened.children[0].type).toBe('heading');
    expect(flattened.children[1].type).toBe('paragraph');
    expect(flattened.children[2].type).toBe('thematicBreak');
    expect(flattened.children[3].type).toBe('paragraph');
  });
});
