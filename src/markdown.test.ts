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
import { fromMarkdown, toMarkdown } from './markdown.js';

describe('Markdown', () => {
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

  describe('Normalization', () => {
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
});
