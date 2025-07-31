'use client';

import React, { useState, useEffect } from 'react';
import { createMarkdownSplitter } from '@text-splitter/core';
import { MarkdownTextSplitter } from '@langchain/textsplitters';

interface ChunkVisualizerProps {
  text: string;
  title: string;
  initialChunkSize: number;
  globalChunkSize: number;
  splitterType?: 'markdown' | 'character' | 'langchain-markdown';
}

const ChunkVisualizer: React.FC<ChunkVisualizerProps> = ({ text, title, initialChunkSize, globalChunkSize, splitterType = 'markdown' }) => {
  const [chunkSize, setChunkSize] = useState(initialChunkSize);
  const [isOverridden, setIsOverridden] = useState(false);
  const [chunks, setChunks] = useState<string[]>([]);
  const [stats, setStats] = useState({
    totalCharacters: 0,
    numberOfChunks: 0,
    avgChunkSize: 0,
    minChunkSize: 0,
    maxChunkSize: 0
  });

  // Use global chunk size unless overridden
  const effectiveChunkSize = isOverridden ? chunkSize : globalChunkSize;

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
      'bg-cyan-200 text-black'
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
        setStats({ totalCharacters: 0, numberOfChunks: 0, avgChunkSize: 0, minChunkSize: 0, maxChunkSize: 0 });
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
          // LangChain MarkdownTextSplitter
          const splitter = new MarkdownTextSplitter({
            chunkSize: effectiveChunkSize,
            chunkOverlap: 0
          });
          newChunks = await splitter.splitText(text);
        } else {
          // Custom Markdown splitter
          const splitter = createMarkdownSplitter({ chunkSize: effectiveChunkSize, maxOverflowRatio: 1.5 });
          newChunks = splitter.splitText(text);
        }
        
        setChunks(newChunks);
        
        const totalChars = text.length;
        const numChunks = newChunks.length;
        const avgChunkSize = numChunks > 0 ? Math.round(totalChars / numChunks * 10) / 10 : 0;
        const minChunkSize = Math.min(...newChunks.map(chunk => chunk.length));
        const maxChunkSize = Math.max(...newChunks.map(chunk => chunk.length));
        
        setStats({
          totalCharacters: totalChars,
          numberOfChunks: numChunks,
          avgChunkSize: avgChunkSize,
          minChunkSize: minChunkSize,
          maxChunkSize: maxChunkSize
        });
      } catch (error) {
        console.error('Error splitting text:', error);
        setChunks([]);
        setStats({ totalCharacters: 0, numberOfChunks: 0, avgChunkSize: 0, minChunkSize: 0, maxChunkSize: 0 });
      }
    };

    splitText();
  }, [text, effectiveChunkSize, splitterType]);

  const colors = generateColors(chunks.length);

  return (
    <div className="w-full">
      {/* Title */}
      <h3 className="text-lg font-bold mb-3 text-black">{title}</h3>
      
      {/* Controls */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label htmlFor={`chunk-size-${title}`} className="text-sm font-medium text-black">
            Chunk Size: {effectiveChunkSize} {!isOverridden && <span className="text-gray-500 text-xs">(global)</span>}
          </label>
          <button
            onClick={() => {
              if (isOverridden) {
                setIsOverridden(false);
              } else {
                setChunkSize(globalChunkSize);
                setIsOverridden(true);
              }
            }}
            className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-black"
          >
            {isOverridden ? 'Use Global' : 'Override'}
          </button>
        </div>
        
        {isOverridden && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <input
                id={`chunk-size-${title}`}
                type="range"
                min="1"
                max="2000"
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <input
                type="number"
                min="1"
                max="2000"
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                className="w-16 px-1 py-1 border border-gray-300 rounded text-xs text-black"
              />
            </div>
            <div className="flex justify-between text-xs text-black">
              <span>1</span>
              <span>2000</span>
            </div>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-black">{stats.totalCharacters}</div>
            <div className="text-xs text-black">Total Characters</div>
          </div>
          <div>
            <div className="text-lg font-bold text-black">{stats.numberOfChunks}</div>
            <div className="text-xs text-black">Number of chunks</div>
          </div>
          <div>
            <div className="text-lg font-bold text-black">{stats.minChunkSize}</div>
            <div className="text-xs text-black">Min chunk size</div>
          </div>
          <div>
            <div className="text-lg font-bold text-black">{stats.maxChunkSize}</div>
            <div className="text-xs text-black">Max chunk size</div>
          </div>
          <div>
            <div className="text-lg font-bold text-black">{stats.avgChunkSize}</div>
            <div className="text-xs text-black">Average chunk size</div>
          </div>
        </div>
      </div>

      {/* Chunk Visualization */}
      <div className="border rounded-lg p-4 bg-gray-50 min-h-[200px]">
        {chunks.length > 0 ? (
          <div className="leading-relaxed text-sm font-mono">
            {chunks.map((chunk, index) => (
              <span
                key={index}
                className={`${colors[index]} px-1 py-0.5`}
                style={{ 
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
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
      </div>
    </div>
  );
};

export default ChunkVisualizer;