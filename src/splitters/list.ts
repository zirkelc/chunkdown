import type { List, ListItem, Nodes, Root } from 'mdast';
import { fromMarkdown, toMarkdown } from '../markdown';
import { getContentSize } from '../size';
import type { ChunkdownOptions } from '../splitter';
import { AbstractNodeSplitter } from './base';
import { MarkdownTreeSplitter } from './tree';

export class ListSplitter extends AbstractNodeSplitter<List> {
  splitText(text: string): Array<string> {
    const tree = fromMarkdown(text);
    const list = tree.children[0];
    if (list.type !== 'list') {
      throw new Error('Text is not a list');
    }
    const chunks = this.splitNode(list);
    return chunks.map((chunk) => toMarkdown(chunk).trim());
  }

  splitNode(node: List): Array<List> {
    const subLists: Array<List> = [];

    for (const subList of this.splitList(node)) {
      subLists.push(subList);
    }

    return subLists;
  }

  private *splitList(list: List): Generator<List> {
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

  private *splitListItem(list: List, listItem: ListItem): Generator<List> {
    /**
     * Convert the list item to a tree
     */
    const listItemTree: Root = { type: 'root', children: listItem.children };

    /**
     * Split the list item tree into chunks
     */
    const treeSplitter = new MarkdownTreeSplitter(this.options);
    const listItemChunks = treeSplitter.splitNode(listItemTree);

    /**
     * Wrap each chunk back into list and yield it
     */
    for (const chunk of listItemChunks) {
      if (!('children' in chunk) || chunk.children.length === 0) {
        continue;
      }
      const subListItem: ListItem = {
        ...listItem,
        children: chunk.children as ListItem['children'],
      };
      const subList: List = {
        ...list,
        children: [subListItem],
      };
      yield subList;
    }
  }
}
