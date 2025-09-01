'use client';

import {
  CharacterTextSplitter,
  MarkdownTextSplitter,
  RecursiveCharacterTextSplitter,
  type TextSplitter,
} from '@langchain/textsplitters';
import { chunkdown, getContentSize } from 'chunkdown/splitter';
import type { MouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

interface ChunkVisualizerProps {
  text: string;
  chunkSize: number;
  splitterType?: 'markdown' | 'character' | 'langchain-markdown';
  maxOverflowRatio?: number;
  langchainSplitterType?: 'markdown' | 'character' | 'sentence';
}

function ChunkVisualizer({
  text,
  chunkSize,
  splitterType = 'markdown',
  maxOverflowRatio = 1.5,
  langchainSplitterType = 'markdown',
}: ChunkVisualizerProps) {
  const [chunks, setChunks] = useState<string[]>([]);
  const [stats, setStats] = useState({
    inputCharacters: 0,
    inputContentLength: 0,
    outputCharacters: 0,
    outputContentLength: 0,
    numberOfChunks: 0,
    avgChunkSize: 0,
    avgContentSize: 0,
    minChunkSize: 0,
    minContentSize: 0,
    maxChunkSize: 0,
    maxContentSize: 0,
  });

  // Selection tooltip state
  const [selection, setSelection] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const visualizationRef = useRef<HTMLDivElement>(null);

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  // Use the provided chunk size directly
  const effectiveChunkSize = chunkSize;

  // Generate colors for chunks
  const generateColors = (count: number): string[] => {
    const colors = [
      'bg-blue-200 text-black',
      'bg-green-200 text-black',
      'bg-yellow-200 text-black',
      'bg-pink-200 text-black',
      'bg-purple-200 text-black',
      'bg-indigo-200 text-black',
      'bg-red-200 text-black',
      'bg-orange-200 text-black',
      'bg-teal-200 text-black',
      'bg-cyan-200 text-black',
    ];

    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(colors[i % colors.length]);
    }
    return result;
  };

  useEffect(() => {
    const splitText = async () => {
      if (!text.trim()) {
        setChunks([]);
        setStats({
          inputCharacters: 0,
          inputContentLength: 0,
          outputCharacters: 0,
          outputContentLength: 0,
          numberOfChunks: 0,
          avgChunkSize: 0,
          avgContentSize: 0,
          minChunkSize: 0,
          minContentSize: 0,
          maxChunkSize: 0,
          maxContentSize: 0,
        });
        return;
      }

      try {
        let newChunks: string[];

        if (splitterType === 'character') {
          // Simple character-based splitting
          newChunks = [];
          for (let i = 0; i < text.length; i += effectiveChunkSize) {
            newChunks.push(text.slice(i, i + effectiveChunkSize));
          }
        } else if (splitterType === 'langchain-markdown') {
          // LangChain splitters based on type
          let splitter: TextSplitter;

          if (langchainSplitterType === 'markdown') {
            splitter = new MarkdownTextSplitter({
              chunkSize: effectiveChunkSize,
              chunkOverlap: 0,
            });
          } else if (langchainSplitterType === 'character') {
            splitter = new CharacterTextSplitter({
              chunkSize: effectiveChunkSize,
              chunkOverlap: 0,
            });
          } else {
            // sentence
            splitter = new RecursiveCharacterTextSplitter({
              chunkSize: effectiveChunkSize,
              chunkOverlap: 0,
              separators: ['\n\n', '\n', '. ', '! ', '? ', ' ', ''],
            });
          }

          newChunks = await splitter.splitText(text);
        } else {
          const splitter = chunkdown({
            chunkSize: effectiveChunkSize,
            maxOverflowRatio: maxOverflowRatio,
          });
          newChunks = splitter.splitText(text);
        }

        setChunks(newChunks);

        // Input stats
        const inputChars = text.length;
        const inputContentLength = getContentSize(text);

        // Calculate stats for each chunk
        const chunkStats = newChunks.map((chunk) => ({
          chars: chunk.length,
          content: getContentSize(chunk),
        }));

        // Output stats (sum of chunks)
        const outputChars = chunkStats.reduce(
          (sum, stat) => sum + stat.chars,
          0,
        );
        const outputContentLength = chunkStats.reduce(
          (sum, stat) => sum + stat.content,
          0,
        );

        const numChunks = newChunks.length;

        // Calculate min/max/avg for both char and content lengths
        const chunkChars = chunkStats.map((s) => s.chars);
        const chunkContent = chunkStats.map((s) => s.content);

        const avgChunkSize =
          numChunks > 0 ? Math.round((outputChars / numChunks) * 10) / 10 : 0;
        const avgContentSize =
          numChunks > 0
            ? Math.round((outputContentLength / numChunks) * 10) / 10
            : 0;

        const minChunkSize = numChunks > 0 ? Math.min(...chunkChars) : 0;
        const minContentSize = numChunks > 0 ? Math.min(...chunkContent) : 0;

        const maxChunkSize = numChunks > 0 ? Math.max(...chunkChars) : 0;
        const maxContentSize = numChunks > 0 ? Math.max(...chunkContent) : 0;

        setStats({
          inputCharacters: inputChars,
          inputContentLength: inputContentLength,
          outputCharacters: outputChars,
          outputContentLength: outputContentLength,
          numberOfChunks: numChunks,
          avgChunkSize: avgChunkSize,
          avgContentSize: avgContentSize,
          minChunkSize: minChunkSize,
          minContentSize: minContentSize,
          maxChunkSize: maxChunkSize,
          maxContentSize: maxContentSize,
        });
      } catch (error) {
        console.error('Error splitting text:', error);
        setChunks([]);
        setStats({
          inputCharacters: 0,
          inputContentLength: 0,
          outputCharacters: 0,
          outputContentLength: 0,
          numberOfChunks: 0,
          avgChunkSize: 0,
          avgContentSize: 0,
          minChunkSize: 0,
          minContentSize: 0,
          maxChunkSize: 0,
          maxContentSize: 0,
        });
      }
    };

    splitText();
  }, [
    text,
    effectiveChunkSize,
    splitterType,
    maxOverflowRatio,
    langchainSplitterType,
  ]);

  const colors = generateColors(chunks.length);

  // Handle text selection
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setSelection(null);
      return;
    }

    const selectedText = selection.toString();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Use viewport coordinates for fixed positioning
    const x = rect.left + rect.width / 2;
    const y = rect.top - 10; // 10px above selection

    setSelection({
      text: selectedText,
      x,
      y,
    });
  };

  // Clear selection when clicking outside
  const handleMouseDown = (e: MouseEvent) => {
    // Check if clicking on the tooltip itself
    const target = e.target as HTMLElement;
    if (!target.closest('.selection-tooltip')) {
      setSelection(null);
    }
  };

  // Monitor for selection changes globally
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setSelection(null);
      }
    };

    // Listen for selection changes
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  // Handle tooltip hover
  const handleTooltipMouseEnter = (e: MouseEvent, text: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      text,
      x: rect.left + rect.width / 2,
      y: rect.top - 8, // Position above the element
    });
  };

  const handleTooltipMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <div className="w-full">
      {/* Stats */}
      <div className="p-3 bg-gray-50 rounded-lg mb-4">
        <h4 className="text-sm font-medium text-black mb-3">Statistics</h4>

        <div className="grid grid-cols-3 gap-4 text-center">
          {/* Input Length */}
          <div>
            <div className="mb-2">
              <div
                className="text-xs text-black underline decoration-dotted decoration-gray-400 cursor-help mb-1"
                onMouseEnter={(e) =>
                  handleTooltipMouseEnter(
                    e,
                    'Original text length with markdown formatting, number in parentheses is content size without formatting',
                  )
                }
                onMouseLeave={handleTooltipMouseLeave}
              >
                Input Length
              </div>
              <div className="font-bold text-black">
                {stats.inputCharacters}{' '}
                <span className="text-gray-500">
                  ({stats.inputContentLength})
                </span>
              </div>
            </div>
          </div>

          {/* Output Length */}
          <div>
            <div className="mb-2">
              <div
                className="text-xs text-black underline decoration-dotted decoration-gray-400 cursor-help mb-1"
                onMouseEnter={(e) =>
                  handleTooltipMouseEnter(
                    e,
                    'Combined length of all chunks with markdown formatting, number in parentheses is content size without formatting',
                  )
                }
                onMouseLeave={handleTooltipMouseLeave}
              >
                Output Length
              </div>
              <div className="font-bold text-black">
                {stats.outputCharacters}{' '}
                <span className="text-gray-500">
                  ({stats.outputContentLength})
                </span>
              </div>
            </div>
          </div>

          {/* Number of Chunks */}
          <div>
            <div className="mb-2">
              <div
                className="text-xs text-black underline decoration-dotted decoration-gray-400 cursor-help mb-1"
                onMouseEnter={(e) =>
                  handleTooltipMouseEnter(
                    e,
                    'How many chunks the text was split into',
                  )
                }
                onMouseLeave={handleTooltipMouseLeave}
              >
                Number of Chunks
              </div>
              <div className="font-bold text-black text-lg">
                {stats.numberOfChunks}
              </div>
            </div>
          </div>

          {/* Min Size */}
          <div>
            <div className="mb-2">
              <div
                className="text-xs text-black underline decoration-dotted decoration-gray-400 cursor-help mb-1"
                onMouseEnter={(e) =>
                  handleTooltipMouseEnter(
                    e,
                    'Smallest chunk length with markdown formatting, number in parentheses is content size without formatting',
                  )
                }
                onMouseLeave={handleTooltipMouseLeave}
              >
                Min Size
              </div>
              <div className="font-bold text-black">
                {stats.minChunkSize}{' '}
                <span className="text-gray-500">({stats.minContentSize})</span>
              </div>
            </div>
          </div>

          {/* Max Size */}
          <div>
            <div className="mb-2">
              <div
                className="text-xs text-black underline decoration-dotted decoration-gray-400 cursor-help mb-1"
                onMouseEnter={(e) =>
                  handleTooltipMouseEnter(
                    e,
                    'Largest chunk length with markdown formatting, number in parentheses is content size without formatting',
                  )
                }
                onMouseLeave={handleTooltipMouseLeave}
              >
                Max Size
              </div>
              <div className="font-bold text-black">
                {stats.maxChunkSize}{' '}
                <span className="text-gray-500">({stats.maxContentSize})</span>
              </div>
            </div>
          </div>

          {/* Avg Size */}
          <div>
            <div className="mb-2">
              <div
                className="text-xs text-black underline decoration-dotted decoration-gray-400 cursor-help mb-1"
                onMouseEnter={(e) =>
                  handleTooltipMouseEnter(
                    e,
                    'Average chunk length with markdown formatting, number in parentheses is content size without formatting',
                  )
                }
                onMouseLeave={handleTooltipMouseLeave}
              >
                Avg Size
              </div>
              <div className="font-bold text-black">
                {stats.avgChunkSize}{' '}
                <span className="text-gray-500">({stats.avgContentSize})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chunk Visualization */}
      <div
        ref={visualizationRef}
        className="border rounded-lg p-4 bg-gray-50 min-h-[200px] relative"
        onMouseUp={handleMouseUp}
        onMouseDown={handleMouseDown}
      >
        {chunks.length > 0 ? (
          <div className="leading-relaxed text-sm font-mono">
            {chunks.map((chunk, index) => (
              <span
                key={`${index}`}
                className={`${colors[index]} px-1 py-0.5`}
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {chunk}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-gray-400 text-center py-8">
            Enter some text to see the chunks visualization
          </div>
        )}

        {/* Selection Tooltip */}
        {selection && (
          <div
            className="selection-tooltip fixed z-50 bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none"
            style={{
              left: `${selection.x}px`,
              top: `${selection.y}px`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="whitespace-nowrap">
              {selection.text.length} chars ({getContentSize(selection.text)}{' '}
              content)
            </div>
            <div
              className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full"
              style={{
                width: 0,
                height: 0,
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
                borderTop: '4px solid rgb(17 24 39)',
              }}
            />
          </div>
        )}
      </div>

      {/* Stats Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg pointer-events-none max-w-48 text-center"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translate(-50%, -100%)', // Position fully above the element
          }}
        >
          <div className="leading-tight">{tooltip.text}</div>
          <div
            className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full"
            style={{
              width: 0,
              height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: '4px solid rgb(17 24 39)',
            }}
          />
        </div>
      )}
    </div>
  );
}

export default ChunkVisualizer;
