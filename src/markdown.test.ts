import type {
  Code,
  Delete,
  Emphasis,
  Heading,
  Link,
  List,
  ListItem,
  Paragraph,
  Strong,
  Table,
  Text,
} from 'mdast';
import { describe, expect, it } from 'vitest';
import {
  fromMarkdown,
  preprocessMarkdown,
  toMarkdown,
  toString,
} from './markdown';
import type { SplitterOptions } from './types';

function markdown(text: string, options: SplitterOptions): string {
  const ast = fromMarkdown(text);
  const normalized = preprocessMarkdown(ast, options);
  return toMarkdown(normalized).trim();
}

describe('Markdown', () => {
  describe('toString', () => {
    it('extracts plain text from markdown', () => {
      const ast = fromMarkdown('**Hello** world');
      expect(toString(ast)).toBe('Hello world');
    });

    it('extracts text from complex markdown', () => {
      const ast = fromMarkdown('# Title\n\n[Link](url) and `code`');
      expect(toString(ast)).toBe('TitleLink and code');
    });

    it('handles empty markdown', () => {
      const ast = fromMarkdown('');
      expect(toString(ast)).toBe('');
    });
  });

  describe('GFM', () => {
    it('should handle strikethrough text', () => {
      const markdown = '~~strikethrough~~';
      const ast = fromMarkdown(markdown);

      const paragraph = ast.children[0] as Paragraph;
      expect(paragraph.type).toBe('paragraph');
      const deleteNode = paragraph.children[0] as Delete;
      expect(deleteNode.type).toBe('delete');
      expect((deleteNode.children[0] as Text).value).toBe('strikethrough');

      const result = toMarkdown(ast);
      expect(result.trim()).toBe('~~strikethrough~~');
    });

    it('should handle tables', () => {
      const markdown = `| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |`;

      const ast = fromMarkdown(markdown);

      const table = ast.children[0] as Table;
      expect(table.type).toBe('table');
      expect(table.children).toHaveLength(2); // header + data row
      expect(table.children[0].type).toBe('tableRow');
      expect(table.children[0].children[0].type).toBe('tableCell');

      const result = toMarkdown(ast);
      expect(result).toContain('| Header 1 | Header 2 |');
      expect(result).toContain('| Cell 1   | Cell 2   |');
    });

    it('should handle task lists', () => {
      const markdown = `- [x] Completed task
- [ ] Incomplete task`;

      const ast = fromMarkdown(markdown);

      const list = ast.children[0] as List;
      expect(list.type).toBe('list');
      expect(list.children).toHaveLength(2);

      const checkedItem = list.children[0] as ListItem;
      expect(checkedItem.type).toBe('listItem');
      expect(checkedItem.checked).toBe(true);

      const uncheckedItem = list.children[1] as ListItem;
      expect(uncheckedItem.type).toBe('listItem');
      expect(uncheckedItem.checked).toBe(false);

      const result = toMarkdown(ast);
      expect(result).toContain('* [x] Completed task');
      expect(result).toContain('* [ ] Incomplete task');
    });

    it('should handle autolinks', () => {
      const markdown = 'Visit https://github.com for more info';
      const ast = fromMarkdown(markdown);

      const paragraph = ast.children[0] as Paragraph;
      expect(paragraph.type).toBe('paragraph');

      const linkNode = paragraph.children.find(
        (child) => child.type === 'link',
      ) as Link;
      expect(linkNode).toBeDefined();
      expect(linkNode.url).toBe('https://github.com');

      const result = toMarkdown(ast);
      expect(result.trim()).toBe('Visit <https://github.com> for more info');
    });

    it('should handle code blocks with language', () => {
      const markdown = `\`\`\`javascript
console.log('hello');
\`\`\``;

      const ast = fromMarkdown(markdown);

      const codeBlock = ast.children[0] as Code;
      expect(codeBlock.type).toBe('code');
      expect(codeBlock.lang).toBe('javascript');
      expect(codeBlock.value).toBe("console.log('hello');");

      const result = toMarkdown(ast);
      expect(result).toContain('```javascript');
      expect(result).toContain("console.log('hello');");
    });
  });
});

describe('Normalization', () => {
  describe('List Markers', () => {
    it('should normalize list markers', () => {
      const dashList = '- Item 1\n- Item 2';
      const asteriskList = '* Item 1\n* Item 2';
      const plusList = '+ Item 1\n+ Item 2';

      const dashAst = fromMarkdown(dashList);
      const asteriskAst = fromMarkdown(asteriskList);
      const plusAst = fromMarkdown(plusList);

      // All should parse to the same AST structure
      expect(dashAst.children[0].type).toBe('list');
      expect(asteriskAst.children[0].type).toBe('list');
      expect(plusAst.children[0].type).toBe('list');

      // All should normalize to the same output format
      const dashResult = toMarkdown(dashAst);
      const asteriskResult = toMarkdown(asteriskAst);
      const plusResult = toMarkdown(plusAst);

      expect(dashResult).toBe(asteriskResult);
      expect(asteriskResult).toBe(plusResult);
      expect(dashResult).toContain('* Item 1');
      expect(dashResult).toContain('* Item 2');
    });
  });

  describe('Formatting', () => {
    it('should normalize strong/bold formatting', () => {
      const doubleAsterisk = '**bold text**';
      const doubleUnderscore = '__bold text__';

      const asteriskAst = fromMarkdown(doubleAsterisk);
      const underscoreAst = fromMarkdown(doubleUnderscore);

      // Both should parse to 'strong' nodes
      const asteriskStrong = (asteriskAst.children[0] as Paragraph)
        .children[0] as Strong;
      const underscoreStrong = (underscoreAst.children[0] as Paragraph)
        .children[0] as Strong;

      expect(asteriskStrong.type).toBe('strong');
      expect(underscoreStrong.type).toBe('strong');
      expect((asteriskStrong.children[0] as Text).value).toBe('bold text');
      expect((underscoreStrong.children[0] as Text).value).toBe('bold text');

      // Both should normalize to the same output
      const asteriskResult = toMarkdown(asteriskAst);
      const underscoreResult = toMarkdown(underscoreAst);

      expect(asteriskResult).toBe(underscoreResult);
      expect(asteriskResult.trim()).toBe('**bold text**');
    });

    it('should normalize emphasis/italic formatting', () => {
      const singleAsterisk = '*italic text*';
      const singleUnderscore = '_italic text_';

      const asteriskAst = fromMarkdown(singleAsterisk);
      const underscoreAst = fromMarkdown(singleUnderscore);

      // Both should parse to 'emphasis' nodes
      const asteriskEmphasis = (asteriskAst.children[0] as Paragraph)
        .children[0] as Emphasis;
      const underscoreEmphasis = (underscoreAst.children[0] as Paragraph)
        .children[0] as Emphasis;

      expect(asteriskEmphasis.type).toBe('emphasis');
      expect(underscoreEmphasis.type).toBe('emphasis');
      expect((asteriskEmphasis.children[0] as Text).value).toBe('italic text');
      expect((underscoreEmphasis.children[0] as Text).value).toBe(
        'italic text',
      );

      // Both should normalize to the same output
      const asteriskResult = toMarkdown(asteriskAst);
      const underscoreResult = toMarkdown(underscoreAst);

      expect(asteriskResult).toBe(underscoreResult);
      expect(asteriskResult.trim()).toBe('*italic text*');
    });
  });

  describe('Headings', () => {
    it('should normalize heading formats', () => {
      const hashHeading = '# Heading 1';
      const underlineHeading = 'Heading 1\n=========';

      const hashAst = fromMarkdown(hashHeading);
      const underlineAst = fromMarkdown(underlineHeading);

      // Both should parse to 'heading' nodes with depth 1
      const hashHeadingNode = hashAst.children[0] as Heading;
      const underlineHeadingNode = underlineAst.children[0] as Heading;

      expect(hashHeadingNode.type).toBe('heading');
      expect(underlineHeadingNode.type).toBe('heading');
      expect(hashHeadingNode.depth).toBe(1);
      expect(underlineHeadingNode.depth).toBe(1);

      // Both should normalize to the same output
      const hashResult = toMarkdown(hashAst);
      const underlineResult = toMarkdown(underlineAst);

      expect(hashResult).toBe(underlineResult);
      expect(hashResult.trim()).toBe('# Heading 1');
    });
  });

  describe('Code Blocks', () => {
    it('should normalize code block formatting', () => {
      const fencedCode = '```\ncode\n```';
      const indentedCode = '    code';

      const fencedAst = fromMarkdown(fencedCode);
      const indentedAst = fromMarkdown(indentedCode);

      // Both should parse to 'code' nodes
      const fencedCodeBlock = fencedAst.children[0] as Code;
      const indentedCodeBlock = indentedAst.children[0] as Code;

      expect(fencedCodeBlock.type).toBe('code');
      expect(indentedCodeBlock.type).toBe('code');
      expect(fencedCodeBlock.value).toBe('code');
      expect(indentedCodeBlock.value).toBe('code');

      // Both should normalize to the same output (fenced format)
      const fencedResult = toMarkdown(fencedAst);
      const indentedResult = toMarkdown(indentedAst);

      expect(fencedResult).toBe(indentedResult);
      expect(fencedResult.trim()).toBe('```\ncode\n```');
    });
  });

  describe('Horizontal Rules', () => {
    it('should normalize horizontal rule formats', () => {
      const dashes = '---';
      const asterisks = '***';
      const underscores = '___';

      const dashAst = fromMarkdown(dashes);
      const asteriskAst = fromMarkdown(asterisks);
      const underscoreAst = fromMarkdown(underscores);

      // All should parse to 'thematicBreak' nodes
      expect(dashAst.children[0].type).toBe('thematicBreak');
      expect(asteriskAst.children[0].type).toBe('thematicBreak');
      expect(underscoreAst.children[0].type).toBe('thematicBreak');

      // All should normalize to the same output
      const dashResult = toMarkdown(dashAst);
      const asteriskResult = toMarkdown(asteriskAst);
      const underscoreResult = toMarkdown(underscoreAst);

      expect(dashResult).toBe(asteriskResult);
      expect(asteriskResult).toBe(underscoreResult);
      expect(dashResult.trim()).toBe('***');
    });
  });

  describe('Reference Style', () => {
    it('normalizes reference-style links when style is "inline"', () => {
      const text = 'Check [this link][ref].\n\n[ref]: https://example.com';
      const options: SplitterOptions = {
        chunkSize: 100,
        maxOverflowRatio: 2,
        rules: { link: { style: 'inline' } },
      };
      const result = markdown(text, options);

      expect(result).toContain('[this link](https://example.com)');
      expect(result).not.toContain('[ref]:');
    });

    it('normalizes reference-style images when style is "inline"', () => {
      const text = 'See ![image][img].\n\n[img]: /path/to/image.png';
      const options: SplitterOptions = {
        chunkSize: 100,
        maxOverflowRatio: 2,
        rules: { image: { style: 'inline' } },
      };
      const result = markdown(text, options);

      expect(result).toContain('![image](/path/to/image.png)');
      expect(result).not.toContain('[img]:');
    });

    it('preserves reference-style links when style is "preserve"', () => {
      const text = 'Check [this link][ref].\n\n[ref]: https://example.com';
      const options: SplitterOptions = {
        chunkSize: 100,
        maxOverflowRatio: 2,
        rules: { link: { style: 'preserve' } },
      };
      const result = markdown(text, options);

      expect(result).toContain('[this link][ref]');
      expect(result).toContain('[ref]: https://example.com');
    });

    it('preserves reference-style images when style is "preserve"', () => {
      const text = 'See ![image][img].\n\n[img]: /path/to/image.png';
      const options: SplitterOptions = {
        chunkSize: 100,
        maxOverflowRatio: 2,
        rules: { image: { style: 'preserve' } },
      };
      const result = markdown(text, options);

      expect(result).toContain('![image][img]');
      expect(result).toContain('[img]: /path/to/image.png');
    });

    it('preserves reference-style links when style is undefined', () => {
      const text = 'Check [this link][ref].\n\n[ref]: https://example.com';
      const options: SplitterOptions = {
        chunkSize: 100,
        maxOverflowRatio: 2,
        rules: { link: { style: undefined } },
      };
      const result = markdown(text, options);

      expect(result).toContain('[this link][ref]');
      expect(result).toContain('[ref]: https://example.com');
    });

    it('preserves reference-style images when style is undefined', () => {
      const text = 'See ![image][img].\n\n[img]: /path/to/image.png';
      const options: SplitterOptions = {
        chunkSize: 100,
        maxOverflowRatio: 2,
        rules: { image: { style: undefined } },
      };
      const result = markdown(text, options);

      expect(result).toContain('![image][img]');
      expect(result).toContain('[img]: /path/to/image.png');
    });

    it('preserves references when no rules specified', () => {
      const text = 'Check [link][ref].\n\n[ref]: https://example.com';
      const options: SplitterOptions = {
        chunkSize: 100,
        maxOverflowRatio: 2,
      };
      const result = markdown(text, options);

      // Without rules, no normalization should happen
      expect(result).toContain('[link][ref]');
      expect(result).toContain('[ref]: https://example.com');
    });

    it('normalizes only links when configured (using preserve)', () => {
      const text = `[Link][1] and ![Image][2]

[1]: /link.html
[2]: /image.png`;
      const options: SplitterOptions = {
        chunkSize: 100,
        maxOverflowRatio: 2,
        rules: {
          link: { style: 'inline' },
          image: { style: 'preserve' },
        },
      };
      const result = markdown(text, options);

      expect(result).toContain('[Link](/link.html)');
      expect(result).toContain('![Image][2]');
      expect(result).toContain('[2]: /image.png');
      expect(result).not.toContain('[1]:');
    });

    it('normalizes only images when configured (using preserve)', () => {
      const text = `[Link][1] and ![Image][2]

[1]: /link.html
[2]: /image.png`;
      const options: SplitterOptions = {
        chunkSize: 100,
        maxOverflowRatio: 2,
        rules: {
          link: { style: 'preserve' },
          image: { style: 'inline' },
        },
      };
      const result = markdown(text, options);

      expect(result).toContain('[Link][1]');
      expect(result).toContain('![Image](/image.png)');
      expect(result).toContain('[1]: /link.html');
      expect(result).not.toContain('[2]:');
    });

    it('normalizes only links when configured (using undefined)', () => {
      const text = `[Link][1] and ![Image][2]

[1]: /link.html
[2]: /image.png`;
      const options: SplitterOptions = {
        chunkSize: 100,
        maxOverflowRatio: 2,
        rules: {
          link: { style: 'inline' },
          image: { style: undefined },
        },
      };
      const result = markdown(text, options);

      expect(result).toContain('[Link](/link.html)');
      expect(result).toContain('![Image][2]');
      expect(result).toContain('[2]: /image.png');
      expect(result).not.toContain('[1]:');
    });

    it('normalizes only images when configured (using undefined)', () => {
      const text = `[Link][1] and ![Image][2]

[1]: /link.html
[2]: /image.png`;
      const options: SplitterOptions = {
        chunkSize: 100,
        maxOverflowRatio: 2,
        rules: {
          link: { style: undefined },
          image: { style: 'inline' },
        },
      };
      const result = markdown(text, options);

      expect(result).toContain('[Link][1]');
      expect(result).toContain('![Image](/image.png)');
      expect(result).toContain('[1]: /link.html');
      expect(result).not.toContain('[2]:');
    });

    it('handles titles in reference definitions', () => {
      const text =
        'Check [link][ref].\n\n[ref]: https://example.com "Example Title"';
      const options: SplitterOptions = {
        chunkSize: 100,
        maxOverflowRatio: 2,
        rules: { link: { style: 'inline' } },
      };
      const result = markdown(text, options);

      expect(result).toContain('[link](https://example.com "Example Title")');
    });

    it('handles shortcut references', () => {
      const text = 'Check [example].\n\n[example]: https://example.com';
      const options: SplitterOptions = {
        chunkSize: 100,
        maxOverflowRatio: 2,
        rules: { link: { style: 'inline' } },
      };
      const result = markdown(text, options);

      expect(result).toContain('[example](https://example.com)');
    });

    it('handles collapsed references', () => {
      const text = 'Check [example][].\n\n[example]: https://example.com';
      const options: SplitterOptions = {
        chunkSize: 100,
        maxOverflowRatio: 2,
        rules: { link: { style: 'inline' } },
      };
      const result = markdown(text, options);

      expect(result).toContain('[example](https://example.com)');
    });

    it('handles case-insensitive reference identifiers', () => {
      const text = 'Check [Link][REF].\n\n[ref]: https://example.com';
      const options: SplitterOptions = {
        chunkSize: 100,
        maxOverflowRatio: 2,
        rules: { link: { style: 'inline' } },
      };
      const result = markdown(text, options);

      expect(result).toContain('[Link](https://example.com)');
    });

    it('handles unused definitions when normalizing', () => {
      const text = `Check [used][1].

[1]: https://example.com
[2]: https://unused.com`;
      const options: SplitterOptions = {
        chunkSize: 100,
        maxOverflowRatio: 2,
        rules: { link: { style: 'inline' } },
      };
      const result = markdown(text, options);

      expect(result).toContain('[used](https://example.com)');
      expect(result).not.toContain('[1]:');
      // Unused definitions are preserved in the output
      expect(result).toContain('[2]: https://unused.com');
    });

    it('handles reference without matching definition', () => {
      const text = 'Check [link][missing].';
      const options: SplitterOptions = {
        chunkSize: 100,
        maxOverflowRatio: 2,
        rules: { link: { style: 'inline' } },
      };
      const result = markdown(text, options);

      // When definition is missing, markdown preserves the reference
      // as-is since there's nothing to normalize
      expect(result).toContain('Check');
      expect(result).toContain('link');
      expect(result).toContain('missing');
    });

    it('handles mixed inline and reference-style links', () => {
      const text = `Check [inline](https://inline.com) and [reference][ref].

[ref]: https://reference.com`;
      const options: SplitterOptions = {
        chunkSize: 200,
        maxOverflowRatio: 2,
        rules: { link: { style: 'inline' } },
      };
      const result = markdown(text, options);

      expect(result).toContain('[inline](https://inline.com)');
      expect(result).toContain('[reference](https://reference.com)');
      expect(result).not.toContain('[ref]:');
    });

    it('returns tree as-is when no normalization is needed', () => {
      const text = 'Regular [inline link](https://example.com).';
      const options: SplitterOptions = {
        chunkSize: 100,
        maxOverflowRatio: 2,
      };
      const result = markdown(text, options);

      // Tree should be unchanged
      expect(result).toBe('Regular [inline link](https://example.com).');
    });
  });
});

describe('Transform', () => {
  it('transforms nodes when transform returns modified node', () => {
    const text =
      'Visit [our site](https://example.com/very/long/path/to/page).';
    const options: SplitterOptions = {
      chunkSize: 100,
      maxOverflowRatio: 2,
      rules: {
        link: {
          transform: (node) => {
            if (node.url.length > 30) {
              return {
                ...node,
                url: 'https://example.com',
              };
            }
            return undefined;
          },
        },
      },
    };
    const result = markdown(text, options);

    expect(result).toContain('[our site](https://example.com)');
    expect(result).not.toContain('/very/long/path/to/page');
  });

  it('removes nodes when transform returns null', () => {
    const text = `Check [docs](https://example.com) and [tracking](https://tracking.com/pixel).`;
    const options: SplitterOptions = {
      chunkSize: 100,
      maxOverflowRatio: 2,
      rules: {
        link: {
          transform: (node) => {
            if (node.url.includes('tracking')) {
              return null; // Remove tracking links
            }
            return undefined;
          },
        },
      },
    };
    const result = markdown(text, options);

    expect(result).toContain('[docs](https://example.com)');
    expect(result).not.toContain('[tracking](https://tracking.com/pixel)');
  });

  it('leaves nodes unchanged when transform returns undefined', () => {
    const text = 'Visit [our site](https://example.com).';
    const options: SplitterOptions = {
      chunkSize: 100,
      maxOverflowRatio: 2,
      rules: {
        link: {
          transform: (node) => {
            return undefined;
          },
        },
      },
    };
    const result = markdown(text, options);

    expect(result).toContain('[our site](https://example.com)');
  });

  it('applies transforms after style normalization', () => {
    const text =
      'Check [reference][ref].\n\n[ref]: https://example.com/very/long/url';
    const options: SplitterOptions = {
      chunkSize: 100,
      maxOverflowRatio: 2,
      rules: {
        link: {
          style: 'inline', // First normalize to inline
          transform: (node) => {
            // Then truncate long URLs
            if (node.url.length > 25) {
              return {
                ...node,
                url: 'https://example.com/',
              };
            }
            return undefined;
          },
        },
      },
    };
    const result = markdown(text, options);

    // Should be inline and truncated
    expect(result).toContain('[reference](https://example.com/)');
    expect(result).not.toContain('[ref]:');
  });

  it('handles multiple node type transforms', () => {
    const text = `Visit [site](https://tracking.com) and see ![](https://cdn.com/img.jpg).`;
    const options: SplitterOptions = {
      chunkSize: 100,
      maxOverflowRatio: 2,
      rules: {
        link: {
          transform: (node) => {
            if (node.url.includes('tracking')) {
              return null; // Remove tracking links
            }
            return undefined;
          },
        },
        image: {
          transform: (node) => {
            return {
              ...node,
              alt: 'alt text', // Add default alt text
            };
          },
        },
      },
    };
    const result = markdown(text, options);

    expect(result).not.toContain('[site](https://tracking.com)');
    expect(result).toContain('![alt text](https://cdn.com/img.jpg)');
  });
});
