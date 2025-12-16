import type { Code, Nodes } from 'mdast';
import { fromMarkdown, toMarkdown } from '../markdown';
import type { SplitterOptions } from '../types';
import { AbstractNodeSplitter } from './base';
import { TextSplitter } from './text';

/**
 * Code block splitter
 */
export class CodeSplitter extends AbstractNodeSplitter<Code> {
  private textSplitter: TextSplitter;

  constructor(options: SplitterOptions) {
    super(options);
    this.textSplitter = new TextSplitter(options);
  }

  splitText(text: string): Array<string> {
    const tree = fromMarkdown(text);
    const code = tree.children[0];
    if (code.type !== 'code') {
      throw new Error('Text is not a code block');
    }
    const chunks = this.splitNode(code);
    return chunks.map((chunk) => toMarkdown(chunk).trim());
  }

  splitNode(code: Code): Array<Nodes> {
    /**
     * If code block cannot be split, yield it as-is
     */
    if (!this.canSplitNode(code)) {
      return [code];
    }

    // TODO implement language-specific splitting
    // code.lang can be used to determine the language of the code block

    /**
     * Delegate to text splitter for splitting code content
     */
    return this.textSplitter.splitNode(code);
  }
}
