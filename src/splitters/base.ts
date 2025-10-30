import type { Nodes } from 'mdast';
import { type ChunkdownOptions, getContentSize, getRawSize } from '../splitter';
import type { NodeSplitter } from './interface';

export abstract class AbstractNodeSplitter<T extends Nodes = Nodes>
  implements NodeSplitter<T>
{
  protected options: ChunkdownOptions;
  protected chunkSize: number;
  protected maxAllowedSize: number;
  protected maxRawSize: number | undefined;

  constructor(options: ChunkdownOptions) {
    this.options = options;

    this.chunkSize = options.chunkSize;
    this.maxAllowedSize = options.chunkSize * options.maxOverflowRatio;
    this.maxRawSize = options.maxRawSize;
  }

  abstract splitNode(node: T): Array<T>;
  abstract splitText(text: string): Array<string>;
}
