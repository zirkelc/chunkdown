'use client';

import {
  createHierarchicalAST,
  type HierarchicalRoot,
  isSection,
  type Section,
} from 'chunkdown/ast';
import { fromMarkdown } from 'chunkdown/markdown';
import type { Node, Parent, RootContent } from 'mdast';
import { useEffect, useState } from 'react';

interface ASTVisualizerProps {
  text: string;
  collapseAll?: boolean;
  onCollapseAllChange?: (collapsed: boolean) => void;
}

interface TreeNodeProps {
  node: Node | Parent | RootContent | Section;
  depth: number;
  isLast?: boolean;
  parentPath?: string;
  collapseAll?: boolean;
}

const nodeColors: Record<string, string> = {
  root: 'text-gray-700',
  heading: 'text-blue-600',
  paragraph: 'text-green-600',
  text: 'text-gray-600',
  code: 'text-purple-600',
  inlineCode: 'text-purple-500',
  list: 'text-orange-600',
  listItem: 'text-orange-500',
  blockquote: 'text-indigo-600',
  thematicBreak: 'text-red-500',
  emphasis: 'text-pink-600',
  strong: 'text-pink-700',
  link: 'text-cyan-600',
  image: 'text-teal-600',
  html: 'text-yellow-600',
  break: 'text-gray-400',
  table: 'text-emerald-600',
  tableRow: 'text-emerald-500',
  tableCell: 'text-emerald-400',
  delete: 'text-red-600',
};

function TreeNode({
  node,
  depth,
  isLast,
  parentPath = '',
  collapseAll = false,
}: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren =
    (isSection(node) && node.children && node.children.length > 0) ||
    ('children' in node && node.children && node.children.length > 0);
  const nodePath = `${parentPath}/${node.type}`;

  // Apply collapse all state (but not to root node at depth 0)
  useEffect(() => {
    if (depth > 0) {
      setIsExpanded(!collapseAll);
    }
  }, [collapseAll, depth]);

  const getNodeLabel = () => {
    if (isSection(node)) {
      // Handle Section node
      const headingText =
        node.heading?.children
          ?.map((child) => ('value' in child ? child.value : ''))
          .join('') || '';
      const truncated =
        headingText.length > 40
          ? `${headingText.substring(0, 40)}...`
          : headingText;
      return `Section: "${truncated}" (h${node.depth})`;
    }

    // Start with node type - this ensures all node types are always shown
    let label = node.type;

    // Add type-specific information
    if (node.type === 'heading' && 'depth' in node) {
      label += ` (h${node.depth})`;
    } else if (node.type === 'code' && 'lang' in node && node.lang) {
      label += ` (${node.lang})`;
    } else if (node.type === 'list' && 'ordered' in node) {
      label += node.ordered ? ' (ordered)' : ' (unordered)';
    } else if (node.type === 'text' && 'value' in node) {
      const text = node.value;
      const truncated = text.length > 50 ? text.substring(0, 50) + '...' : text;
      label += `: "${truncated.replace(/\n/g, '\\n')}"`;
    } else if (node.type === 'inlineCode' && 'value' in node) {
      label += `: \`${node.value}\``;
    } else if (node.type === 'link' && 'url' in node) {
      label += `: ${node.url}`;
    } else if (node.type === 'table' && 'children' in node && node.children) {
      const rows = node.children.length;
      const firstRow = node.children[0];
      const cols =
        firstRow && 'children' in firstRow && firstRow.children
          ? firstRow.children.length
          : 0;
      label += ` (${rows}×${cols})`;
    } else if (
      node.type === 'tableRow' &&
      'children' in node &&
      node.children
    ) {
      label += ` (${node.children.length} cells)`;
    } else {
      // For any unknown node types, try to add useful info if available
      if ('value' in node && typeof node.value === 'string') {
        const text = node.value;
        const truncated =
          text.length > 30 ? text.substring(0, 30) + '...' : text;
        label += `: "${truncated}"`;
      } else if ('url' in node && typeof node.url === 'string') {
        label += `: ${node.url}`;
      } else if ('alt' in node && typeof node.alt === 'string') {
        label += `: "${node.alt}"`;
      } else if ('depth' in node && typeof node.depth === 'number') {
        label += ` (depth ${node.depth})`;
      } else if ('lang' in node && typeof node.lang === 'string' && node.lang) {
        label += ` (${node.lang})`;
      } else if ('ordered' in node && typeof node.ordered === 'boolean') {
        label += node.ordered ? ' (ordered)' : ' (unordered)';
      }
    }

    return label;
  };

  const colorClass = isSection(node)
    ? 'text-purple-700'
    : nodeColors[node.type] || 'text-slate-600';

  return (
    <div className="select-none">
      <div
        className="group flex items-center hover:bg-gray-50 py-0.5 transition-colors duration-150"
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        {/* Expand/collapse icon */}
        <div className="flex items-center mr-2">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-4 h-4 text-gray-500 hover:text-gray-700 flex items-center justify-center"
            >
              {isExpanded ? '−' : '+'}
            </button>
          ) : (
            <div className="w-4 h-4"></div>
          )}
        </div>

        {/* Node content */}
        <div className="flex-1 min-w-0">
          <span className={`text-sm ${colorClass} font-normal`}>
            {getNodeLabel()}
          </span>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {(isSection(node) ? node.children : node.children!).map(
            (child, index) => {
              const children = isSection(node) ? node.children : node.children!;
              const isLastChild = index === children.length - 1;

              return (
                <TreeNode
                  key={`${nodePath}-${
                    // biome-ignore lint/suspicious/noArrayIndexKey: ok
                    index
                  }`}
                  node={child}
                  depth={depth + 1}
                  isLast={isLastChild}
                  parentPath={nodePath}
                  collapseAll={collapseAll}
                />
              );
            },
          )}
        </div>
      )}
    </div>
  );
}

function ASTVisualizer({
  text,
  collapseAll = false,
  onCollapseAllChange,
}: ASTVisualizerProps) {
  const [hierarchicalAst, setHierarchicalAst] =
    useState<HierarchicalRoot | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Parse the markdown text to AST
  useEffect(() => {
    if (!text.trim()) {
      setHierarchicalAst(null);
      setError(null);
      return;
    }

    try {
      const tree = fromMarkdown(text);
      const hierarchical = createHierarchicalAST(tree);
      setHierarchicalAst(hierarchical);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse markdown');
      setHierarchicalAst(null);
    }
  }, [text]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto bg-white border rounded-lg p-2 text-sm">
        {error ? (
          <div className="text-red-600 text-sm">
            Error parsing markdown: {error}
          </div>
        ) : hierarchicalAst ? (
          <TreeNode
            node={hierarchicalAst}
            depth={0}
            collapseAll={collapseAll}
          />
        ) : (
          <div className="text-gray-400 text-sm">
            Enter some markdown text to see the hierarchy
          </div>
        )}
      </div>
    </div>
  );
}

export default ASTVisualizer;
