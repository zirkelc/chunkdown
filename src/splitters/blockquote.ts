import type { Blockquote, Root } from 'mdast';
import { fromMarkdown, toMarkdown } from '../markdown';
import { getContentSize } from '../size';
import { AbstractNodeSplitter } from './base';
import { MarkdownTreeSplitter } from './tree';

export class BlockquoteSplitter extends AbstractNodeSplitter<Blockquote> {
  splitText(text: string): Array<string> {
    const tree = fromMarkdown(text);
    const blockquote = tree.children[0];
    if (blockquote.type !== 'blockquote') {
      throw new Error('Text is not a blockquote');
    }
    const chunks = this.splitNode(blockquote);
    return chunks.map((chunk) => toMarkdown(chunk).trim());
  }

  splitNode(blockquote: Blockquote): Array<Blockquote> {
    const subBlockquotes: Array<Blockquote> = [];

    for (const subBlockquote of this.splitBlockquote(blockquote)) {
      subBlockquotes.push(subBlockquote);
    }

    return subBlockquotes;
  }

  private *splitBlockquote(blockquote: Blockquote): Generator<Blockquote> {
    let subBlockquote: Blockquote = { ...blockquote, children: [] };
    let subBlockquoteSize = 0;

    for (const block of blockquote.children) {
      const blockNode = { ...blockquote, children: [block] };
      const blockSize = getContentSize(blockNode);

      /**
       * If the current sub-blockquote is too large, yield it and start a new sub-blockquote
       */
      if (subBlockquoteSize + blockSize > this.maxAllowedSize) {
        if (subBlockquote.children.length > 0) {
          yield subBlockquote;
        }

        subBlockquote = { ...blockquote, children: [] };
        subBlockquoteSize = 0;
      }

      /**
       * If the current block is too large, split it and yield the chunks
       */
      if (blockSize > this.maxAllowedSize) {
        for (const subBlock of this.splitBlock(blockquote, block)) {
          yield subBlock;
        }

        subBlockquote = { ...blockquote, children: [] };
        subBlockquoteSize = 0;

        continue;
      }

      /**
       * If the current block fits, add it to the sub-blockquote
       */
      subBlockquote.children.push(block);
      subBlockquoteSize += blockSize;
    }

    /**
     * If there are any remaining blocks in the sub-blockquote, yield it
     */
    if (subBlockquote.children.length > 0) {
      yield subBlockquote;
    }
  }

  private *splitBlock(
    blockquote: Blockquote,
    block: Blockquote['children'][0],
  ): Generator<Blockquote> {
    /**
     * Convert the block to a tree
     */
    const blockTree: Root = { type: 'root', children: [block] };

    /**
     * Split the block tree into chunks
     */
    const treeSplitter = new MarkdownTreeSplitter(this.options);
    const blockChunks = treeSplitter.splitNode(blockTree);

    /**
     * Wrap each chunk back into blockquote and yield it
     */
    for (const chunk of blockChunks) {
      if (!('children' in chunk) || chunk.children.length === 0) {
        continue;
      }
      const subBlockquote: Blockquote = {
        ...blockquote,
        children: chunk.children as Blockquote['children'],
      };
      yield subBlockquote;
    }
  }
}
