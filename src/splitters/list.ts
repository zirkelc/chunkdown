import type { List, ListItem, Nodes, Root, RootContent } from 'mdast';
import { createTree } from '../ast';
import { fromMarkdown, toMarkdown } from '../markdown';
import { getContentSize } from '../size';
import type { ComplexSplitRule, SplitRule, SplitterOptions } from '../types';
import { AbstractNodeSplitter } from './base';
import { TreeSplitter } from './tree';

/**
 * List splitter
 */
export class ListSplitter extends AbstractNodeSplitter<List> {
  private splitRule: ComplexSplitRule<List> | undefined;

  constructor(options: SplitterOptions) {
    super(options);

    this.splitRule = this.splitRules.list;
  }

  splitText(text: string): Array<string> {
    const tree = fromMarkdown(text);
    const list = tree.children[0];
    if (list.type !== 'list') {
      throw new Error('Text is not a list');
    }
    const chunks = this.splitNode(list);
    return chunks.map((chunk) => toMarkdown(chunk).trim());
  }

  splitNode(node: List): Array<Nodes> {
    const nodes: Array<Nodes> = [];

    for (const subList of this.splitList(node)) {
      nodes.push(subList);
    }

    return nodes;
  }

  private *splitList(list: List): Generator<Nodes> {
    if (!this.canSplitNode(list)) {
      yield list;
      return;
    }

    let subList: List = { ...list, children: [] };
    let subListSize = 0;
    const listOriginalStart = list.start || 1;
    let listItemIndex = 0;

    for (const listItem of list.children) {
      const listItemSize = getContentSize(listItem);

      /**
       * If the current sublist is too large, yield it and start a new sublist
       */
      if (subListSize + listItemSize > this.maxAllowedSize) {
        if (subList.children.length > 0) {
          if (list.ordered) {
            subList.start = listOriginalStart + listItemIndex;
          }

          yield subList;

          /**
           * Sub list items are all added to the same sub list, so we need to increment the list item index by the number of items in the sub list
           */
          listItemIndex += subList.children.length;
        }

        subList = { ...list, children: [] };
        subListSize = 0;
      }

      /**
       * If the current list item is too large, split it and yield the chunks
       */
      if (listItemSize > this.maxAllowedSize) {
        subList = { ...list, children: [] };
        subListSize = listItemSize;

        if (list.ordered) {
          subList.start = listOriginalStart + listItemIndex;
        }

        for (const subListItem of this.splitListItem(subList, listItem)) {
          yield subListItem;
        }

        subList = { ...list, children: [] };
        subListSize = 0;
        /**
         * Sub list items are all added to the same sub list, so we need to increment the list item index by 1
         */
        listItemIndex += 1;

        continue;
      }

      /**
       * If the current list item fits, add it to the sublist
       */
      subList.children.push(listItem);
      subListSize += listItemSize;
    }

    /**
     * If there are any remaining items in the sublist, yield it
     */
    if (subList.children.length > 0) {
      if (list.ordered) {
        subList.start = listOriginalStart + listItemIndex;
      }
      yield subList;
    }
  }

  private *splitListItem(list: List, listItem: ListItem): Generator<Nodes> {
    /**
     * Convert the list item to a tree
     */
    const listItemTree: Root = { type: 'root', children: listItem.children };

    /**
     * Split the list item tree into chunks
     */
    const treeSplitter = new TreeSplitter(this.options);
    const listItemChunks = treeSplitter.splitNode(listItemTree);

    for (let i = 0; i < listItemChunks.length; i++) {
      const chunk = listItemChunks[i];

      if (!('children' in chunk) || chunk.children.length === 0) {
        continue;
      }

      /**
       * Wrap the first chunk back into list item and yield it.
       * The remaining chunks are yielded as is.
       */
      if (i === 0) {
        const subListItem: ListItem = {
          ...listItem,
          children: chunk.children as ListItem['children'],
        };
        const subList: List = {
          ...list,
          children: [subListItem],
        };
        yield subList;
      } else {
        yield createTree(chunk);
      }

      // if (this.splitRule.strategy === 'extend-list-metadata') {
      //   const subListItem: ListItem = {
      //     ...listItem,
      //     children: chunk.children as ListItem['children'],
      //   };
      //   const subList: List = {
      //     ...list,
      //     children: [subListItem],
      //   };
      //   yield subList;
      // } else {
      //   if (chunk.type === 'root') {
      //     yield chunk;
      //   } else {
      //     yield { type: 'root', children: [chunk] };
      //   }
      // }
    }
  }
}
