'use client';

import React, { useState, useEffect } from 'react';
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Node } from 'mdast';
import { createHierarchicalAST, type Section, type HierarchicalRoot, isSection } from '@text-splitter/core';

interface ASTVisualizerProps {
  text: string;
}

interface TreeNodeProps {
  node: Node | Section;
  depth: number;
  isLast?: boolean;
  parentPath?: string;
  collapseAll?: boolean;
}

const nodeColors: Record<string, string> = {
  root: 'text-gray-600',
  heading: 'text-blue-600',
  paragraph: 'text-green-600',
  text: 'text-gray-700',
  code: 'text-purple-600',
  inlineCode: 'text-purple-500',
  list: 'text-orange-600',
  listItem: 'text-orange-500',
  blockquote: 'text-indigo-600',
  thematicBreak: 'text-red-600',
  emphasis: 'text-pink-600',
  strong: 'text-pink-700',
  link: 'text-cyan-600',
  image: 'text-teal-600',
  html: 'text-yellow-600',
  break: 'text-gray-500',
};

const TreeNode: React.FC<TreeNodeProps> = ({ node, depth, isLast, parentPath = '', collapseAll = false }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = (
    (isSection(node) && node.children && node.children.length > 0) ||
    ('children' in node && node.children && node.children.length > 0)
  );
  const nodePath = `${parentPath}/${node.type}`;
  
  // Apply collapse all state
  useEffect(() => {
    setIsExpanded(!collapseAll);
  }, [collapseAll]);
  
  const getNodeLabel = () => {
    if (isSection(node)) {
      // Handle Section node
      const headingText = node.heading.children
        ?.map((child: any) => child.value || '')
        .join('') || '';
      const truncated = headingText.length > 40 ? headingText.substring(0, 40) + '...' : headingText;
      return `Section: "${truncated}" (h${node.depth})`;
    }
    
    // Handle regular mdast nodes
    let label = node.type;
    
    // Add additional info based on node type
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
    }
    
    return label;
  };

  const getPositionInfo = () => {
    if (!node.position) return '';
    const { start, end } = node.position;
    return ` [${start.line}:${start.column}-${end.line}:${end.column}]`;
  };

  const colorClass = isSection(node) ? 'text-purple-700' : (nodeColors[node.type] || 'text-gray-600');
  
  return (
    <div className="select-none">
      <div className="flex items-center hover:bg-gray-100 px-1 rounded">
        {/* Indentation and tree lines */}
        <span 
          className="inline-block text-gray-400" 
          style={{ width: `${depth * 20}px` }}
        >
          {depth > 0 && (
            <span className="inline-block w-full text-right pr-2">
              {isLast ? '└' : '├'}
            </span>
          )}
        </span>
        
        {/* Expand/collapse button */}
        {hasChildren && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-4 h-4 mr-1 text-gray-500 hover:text-gray-700 flex items-center justify-center"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}
        {!hasChildren && <span className="w-4 h-4 mr-1" />}
        
        {/* Node info */}
        <span className={`text-xs ${colorClass} font-medium`}>
          {getNodeLabel()}
        </span>
        
        {/* Position info */}
        <span className="text-xs text-gray-400 ml-2">
          {getPositionInfo()}
        </span>
      </div>
      
      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {(isSection(node) ? node.children : node.children!).map((child, index) => (
            <TreeNode
              key={`${nodePath}-${index}`}
              node={child}
              depth={depth + 1}
              isLast={index === (isSection(node) ? node.children : node.children!).length - 1}
              parentPath={nodePath}
              collapseAll={collapseAll}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ASTVisualizer: React.FC<ASTVisualizerProps> = ({ text }) => {
  const [ast, setAst] = useState<Node | null>(null);
  const [hierarchicalAst, setHierarchicalAst] = useState<HierarchicalRoot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapseAll, setCollapseAll] = useState(false);
  const [viewMode, setViewMode] = useState<'ast' | 'section'>('ast');

  // Parse the markdown text to AST
  useEffect(() => {
    if (!text.trim()) {
      setAst(null);
      setHierarchicalAst(null);
      setError(null);
      return;
    }

    try {
      const tree = fromMarkdown(text);
      const hierarchical = createHierarchicalAST(tree);
      setAst(tree);
      setHierarchicalAst(hierarchical);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse markdown');
      setAst(null);
      setHierarchicalAst(null);
    }
  }, [text]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-black">
          Markdown {viewMode === 'ast' ? 'AST' : 'Sections'}
        </h3>
        <div className="flex gap-2">
          {(ast || hierarchicalAst) && (
            <>
              <button
                onClick={() => setViewMode(viewMode === 'ast' ? 'section' : 'ast')}
                className="text-xs px-2 py-1 bg-blue-200 hover:bg-blue-300 rounded text-black"
              >
                {viewMode === 'ast' ? 'Section View' : 'AST View'}
              </button>
              <button
                onClick={() => setCollapseAll(!collapseAll)}
                className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-black"
              >
                {collapseAll ? 'Expand All' : 'Collapse All'}
              </button>
            </>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-auto bg-white border rounded-lg p-3">
        {error ? (
          <div className="text-red-600 text-sm">
            Error parsing markdown: {error}
          </div>
        ) : viewMode === 'ast' && ast ? (
          <TreeNode node={ast} depth={0} collapseAll={collapseAll} />
        ) : viewMode === 'section' && hierarchicalAst ? (
          <TreeNode node={hierarchicalAst} depth={0} collapseAll={collapseAll} />
        ) : (
          <div className="text-gray-400 text-sm">
            Enter some markdown text to see the {viewMode === 'ast' ? 'AST' : 'section hierarchy'}
          </div>
        )}
      </div>
    </div>
  );
};

export default ASTVisualizer;