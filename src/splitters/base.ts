import type { Nodes } from 'mdast';
import { getContentSize } from '../size';
import type { ComplexSplitRules, NodeRules, SplitterOptions } from '../types';
import type { NodeSplitter } from './interface';

/**
 * Abstract base class for node splitters
 */
export abstract class AbstractNodeSplitter<NODE extends Nodes = Nodes>
  implements NodeSplitter<NODE>
{
  protected options: SplitterOptions;
  protected chunkSize: number;
  protected maxAllowedSize: number;
  protected maxRawSize: number | undefined;
  protected splitRules: ComplexSplitRules;

  constructor(options: SplitterOptions) {
    this.options = options;

    this.chunkSize = options.chunkSize;
    this.maxAllowedSize = options.chunkSize * options.maxOverflowRatio;
    this.maxRawSize = options.maxRawSize;

    /**
     * Normalize all split rules from SimpleSplitRule to ComplexSplitRule
     */
    this.splitRules = {};
    if (options.rules) {
      for (const nodeType in options.rules) {
        const key = nodeType as keyof NodeRules;
        const nodeRule = options.rules[key];
        if (nodeRule?.split) {
          if (nodeRule.split === 'never-split') {
            this.splitRules[key] = {
              rule: 'never-split',
            };
          } else if (nodeRule.split === 'allow-split') {
            this.splitRules[key] = {
              rule: 'allow-split',
            };
          } else {
            this.splitRules[key] = nodeRule.split;
          }
        }
      }
    }
  }

  /**
   * Check if a node can be split based on its split rule
   */
  protected canSplitNode(node: Nodes): boolean {
    let splitRule = this.splitRules[node.type as keyof ComplexSplitRules];

    /**
     * Formatting nodes can also be configured with the formatting split rule
     */
    if (
      !splitRule &&
      (node.type === 'strong' ||
        node.type === 'emphasis' ||
        node.type === 'delete')
    ) {
      splitRule = this.splitRules.formatting;
    }

    /**
     * No rule defaults to allow splitting
     */
    if (!splitRule) return true;

    /**
     * Never split the node even if it exceeds the size limit
     */
    if (splitRule.rule === 'never-split') {
      return false;
    }

    /**
     * Allow splitting the node
     */
    if (splitRule.rule === 'allow-split') {
      return true;
    }

    /**
     * Protected the node up to the size limit
     */
    if (splitRule.rule === 'size-split') {
      const contentSize = getContentSize(node);
      return contentSize > splitRule.size;
    }

    /**
     * Default to allow splitting
     */
    return true;
  }

  /**
   * Split a node into an array of nodes
   */
  abstract splitNode(node: NODE): Array<Nodes>;

  /**
   * Split a text into an array of text chunks
   */
  abstract splitText(text: string): Array<string>;
}
