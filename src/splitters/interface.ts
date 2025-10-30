import type { Nodes } from 'mdast';

export interface NodeSplitter<T extends Nodes = Nodes> {
  splitText(text: string): Array<string>;
  splitNode(node: T): Array<T>;
}
