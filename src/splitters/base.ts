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

  /**
   * Check if content and raw sizes are within allowed limits
   *
   * @param contentSize - The content size (visible text without markdown formatting)
   * @param rawSize - The raw markdown size (including formatting and URLs)
   * @returns True if within both content and raw size limits
   *
   * @deprecated
   */
  // protected isWithinAllowedSize(contentSize: number, rawSize: number): boolean {
  //   // Check content size limit (for semantic chunking decisions)
  //   if (contentSize > this.maxAllowedSize) return false;

  //   // Check raw markdown size limit (for embedding model compatibility)
  //   if (this.maxRawSize && rawSize > this.maxRawSize) return false;

  //   return true;
  // }

  protected isWithinBreakpoint(node: Nodes): boolean {
    const breakpoint = this.options.breakpoints?.[node.type];
    if (!breakpoint) return false;

    const breakingSize = breakpoint.maxSize ?? 0;
    if (breakingSize === 0) return false;

    const contentSize = getContentSize(node);
    const rawSize = getRawSize(node);

    // To protect constructs regardless of chunk size, use Infinity.
    // Otherwise, cap protection at the smaller of breakingSize and maxAllowedSize.
    const effectiveBreakingSize =
      breakingSize === Infinity
        ? breakingSize
        : Math.min(breakingSize, this.maxAllowedSize);

    if (contentSize > effectiveBreakingSize) return false;

    if (this.maxRawSize && rawSize > this.maxRawSize) return false;

    return true;
  }

  abstract splitNode(node: T): Array<T>;
  abstract splitText(text: string): Array<string>;
}
