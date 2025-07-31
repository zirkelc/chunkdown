import { fromMarkdown } from 'mdast-util-from-markdown';
import { toMarkdown } from 'mdast-util-to-markdown';
import { toString } from 'mdast-util-to-string';
import type { RootContent } from 'mdast';
import { 
  createHierarchicalAST, 
  isSection, 
  type Section, 
  type HierarchicalRoot 
} from './hierarchical-ast';

interface MarkdownSplitterOptions {
  chunkSize: number;
  /**
   * Maximum overflow ratio for preserving semantic units.
   * - 1.0 = strict size limits, no overflow allowed
   * - >1.0 = allow overflow to preserve semantic coherence
   * For example, 1.5 means allow chunks up to 50% larger than chunkSize
   * to keep semantic units (sections, lists, code blocks) together.
   * @default 1.0
   */
  maxOverflowRatio?: number;
}

/**
 * Hierarchical Markdown Text Splitter with Semantic Awareness
 *
 * This splitter intelligently breaks markdown text into chunks using a hierarchical approach
 * that preserves document structure and semantic relationships:
 * 
 * 1. Parse markdown into an Abstract Syntax Tree (AST) using mdast
 * 2. Transform flat AST into hierarchical sections (headings contain their content)
 * 3. Apply top-down chunking with intelligent overflow for semantic preservation
 * 4. Fall back to text-based splitting only for oversized content
 * 5. Preserve original markdown formatting throughout the process
 *
 * Key Features:
 * - **Hierarchical Structure**: Understands document organization and heading relationships
 * - **Semantic Preservation**: Keeps related content together when possible
 * - **Soft Size Limits**: Allows controlled overflow to maintain coherence
 * - **Content-Type Awareness**: Makes smart decisions for code blocks, tables, lists
 *
 * Chunking Strategy:
 * 1. **Keep Complete Sections**: Preserve heading + content + subsections when they fit
 * 2. **Intelligent Breaking**: Split at natural boundaries while maintaining relationships
 * 3. **Controlled Overflow**: Allow exceeding target size to preserve semantic units
 * 4. **Text Fallback**: Use sentence/punctuation/word splitting only as last resort
 *
 * @example
 * ```typescript
 * // Basic usage with strict size limits
 * const splitter = createMarkdownSplitter({ chunkSize: 100 });
 *
 * // With semantic preservation (allows 50% overflow)
 * const flexibleSplitter = createMarkdownSplitter({ 
 *   chunkSize: 100, 
 *   maxOverflowRatio: 1.5 
 * });
 *
 * // Hierarchical section preservation
 * const chunks = splitter.splitText(`
 * # Main Topic
 * Introduction to the topic.
 * 
 * ## Subtopic
 * Detailed information about the subtopic.
 * `);
 * // Result: Sections kept together based on size and overflow settings
 * ```
 */
export const createMarkdownSplitter = (options: MarkdownSplitterOptions) => {
  const { 
    chunkSize,
    maxOverflowRatio = 1.0
  } = options;

  /**
   * Calculate the semantic text length of markdown content
   * Uses the actual text content without markdown formatting characters
   * 
   * @param markdownText - The markdown text to measure
   * @returns The length of the actual text content (without formatting)
   */
  const getTextLength = (markdownText: string): number => {
    if (!markdownText) return 0;
    
    // Parse markdown to AST and extract plain text
    const ast = fromMarkdown(markdownText);
    const plainText = toString(ast);
    
    return plainText.length;
  };

  /**
   * Calculate the total semantic text length of a hierarchical section
   * including its heading, immediate content, and all nested subsections
   * 
   * @param section - The section to measure
   * @returns The total semantic text length
   */
  const calculateSectionSize = (section: Section): number => {
    // Get heading text length
    const headingText = toString(section.heading);
    let totalLength = headingText.length;

    // Add length of all children (content and nested sections)
    for (const child of section.children) {
      if (isSection(child)) {
        // Recursively calculate nested section size
        totalLength += calculateSectionSize(child);
      } else {
        // Convert child back to markdown and get its text length
        const childMarkdown = toMarkdown(child);
        totalLength += getTextLength(childMarkdown);
      }
    }

    return totalLength;
  };

  /**
   * Check if a size is within the soft limit (target size + allowed overflow)
   * 
   * @param size - The size to check
   * @param targetSize - The target chunk size
   * @returns True if within soft limit
   */
  const isWithinSoftLimit = (size: number, targetSize: number): boolean => {
    const softLimit = targetSize * maxOverflowRatio;
    return size <= softLimit;
  };

  /**
   * Determine if overflow should be allowed for better semantic preservation
   * Uses content-type-specific logic to make intelligent decisions
   * 
   * @param section - The section being considered for overflow
   * @param currentSize - Current size of the content
   * @returns True if overflow should be allowed
   */
  const shouldAllowOverflow = (section: Section, currentSize: number): boolean => {
    // Don't allow overflow if maxOverflowRatio is 1.0 (strict size limits)
    if (maxOverflowRatio <= 1.0) {
      return false;
    }

    // Don't allow overflow if we're already at max ratio
    if (!isWithinSoftLimit(currentSize, chunkSize)) {
      return false;
    }

    // Analyze content types to make smarter overflow decisions
    const contentTypes = analyzeContentTypes(section.children);
    
    // Always allow overflow for complete sections with these content types
    if (contentTypes.hasCodeBlocks || contentTypes.hasTables || contentTypes.hasLists) {
      return true;
    }
    
    // Allow overflow for sections with only a few elements to maintain coherence
    if (section.children.length <= 3) {
      return true;
    }
    
    // Allow overflow for sections that are only slightly over the limit
    const overflowRatio = currentSize / chunkSize;
    if (overflowRatio <= 1.2) { // 20% overflow threshold for small overages
      return true;
    }
    
    // Default: allow overflow for complete sections to preserve semantic coherence
    return true;
  };

  /**
   * Analyze the types of content in a section to inform overflow decisions
   * 
   * @param children - The child nodes to analyze
   * @returns Object describing the content types present
   */
  const analyzeContentTypes = (children: (RootContent | Section)[]): {
    hasCodeBlocks: boolean;
    hasTables: boolean;
    hasLists: boolean;
    hasImages: boolean;
    hasComplexFormatting: boolean;
    paragraphCount: number;
  } => {
    let hasCodeBlocks = false;
    let hasTables = false;
    let hasLists = false;
    let hasImages = false;
    let hasComplexFormatting = false;
    let paragraphCount = 0;

    const analyzeNode = (node: RootContent | Section): void => {
      if (isSection(node)) {
        // Recursively analyze nested sections
        node.children.forEach(analyzeNode);
        return;
      }

      switch (node.type) {
        case 'code':
          hasCodeBlocks = true;
          break;
        case 'table':
          hasTables = true;
          break;
        case 'list':
          hasLists = true;
          break;
        case 'paragraph':
          paragraphCount++;
          // Check for images or complex formatting within paragraph
          if ('children' in node) {
            for (const child of node.children) {
              if (child.type === 'image') {
                hasImages = true;
              }
              if (child.type === 'link' || child.type === 'strong' || child.type === 'emphasis') {
                hasComplexFormatting = true;
              }
            }
          }
          break;
        case 'blockquote':
          hasComplexFormatting = true;
          // Analyze blockquote children
          if ('children' in node) {
            node.children.forEach(analyzeNode);
          }
          break;
      }
    };

    children.forEach(analyzeNode);

    return {
      hasCodeBlocks,
      hasTables,  
      hasLists,
      hasImages,
      hasComplexFormatting,
      paragraphCount
    };
  };

  /**
   * Convert a hierarchical section back to markdown format
   * Handles the conversion of Section nodes which aren't native mdast nodes
   * 
   * @param section - The section to convert
   * @returns Markdown string representation
   */
  const convertSectionToMarkdown = (section: Section): string => {
    const rootContentChildren: RootContent[] = [section.heading];
    
    // Convert section children to RootContent, flattening nested sections
    const flattenSection = (children: (RootContent | Section)[]): RootContent[] => {
      const result: RootContent[] = [];
      
      for (const child of children) {
        if (isSection(child)) {
          // Recursively flatten nested sections
          result.push(child.heading);
          result.push(...flattenSection(child.children));
        } else {
          result.push(child);
        }
      }
      
      return result;
    };
    
    rootContentChildren.push(...flattenSection(section.children));
    
    return toMarkdown({
      type: 'root',
      children: rootContentChildren
    });
  };

  /**
   * Process a hierarchical section using top-down approach with soft limits
   * Tries to keep entire sections together, falls back to intelligent breaking
   * 
   * @param section - The section to process
   * @param protectedRanges - Pre-computed protected ranges from AST
   * @returns Array of markdown chunks
   */
  const processHierarchicalSection = (section: Section, protectedRanges: Array<{start: number, end: number, type: string}>): string[] => {
    const sectionSize = calculateSectionSize(section);
    
    // Case 1: Section fits within target size - keep it together
    if (sectionSize <= chunkSize) {
      const sectionMarkdown = convertSectionToMarkdown(section);
      return [sectionMarkdown.trim()];
    }
    
    // Case 2: Section exceeds target but within soft limit and overflow allowed
    if (shouldAllowOverflow(section, sectionSize) && isWithinSoftLimit(sectionSize, chunkSize)) {
      const sectionMarkdown = convertSectionToMarkdown(section);
      return [sectionMarkdown.trim()];
    }
    
    // Case 3: Section too large - need to break it down intelligently
    return breakDownSection(section, protectedRanges);
  };

  /**
   * Break down a large section intelligently using hierarchical approach
   * Keeps heading with immediate content, processes subsections separately
   * 
   * @param section - The section to break down
   * @param protectedRanges - Pre-computed protected ranges from AST
   * @returns Array of markdown chunks
   */
  const breakDownSection = (section: Section, protectedRanges: Array<{start: number, end: number, type: string}>): string[] => {
    const chunks: string[] = [];
    
    // Separate immediate content from nested sections
    const immediateContent: (RootContent | Section)[] = [];
    const nestedSections: Section[] = [];
    
    for (const child of section.children) {
      if (isSection(child)) {
        nestedSections.push(child);
      } else {
        immediateContent.push(child);
      }
    }
    
    // Process heading and immediate content more intelligently
    if (immediateContent.length > 0) {
      // Try to keep heading with immediate content, but be smart about grouping
      const contentNodes = immediateContent.filter((child): child is RootContent => !isSection(child));
      
      // First, try to keep heading with all content together
      const headingWithAllContent = [section.heading, ...contentNodes];
      const allContentMarkdown = toMarkdown({
        type: 'root',
        children: headingWithAllContent
      });
      const allContentSize = getTextLength(allContentMarkdown);
      
      if (allContentSize <= chunkSize || 
          (shouldAllowOverflow(section, allContentSize) && isWithinSoftLimit(allContentSize, chunkSize))) {
        // Keep heading with all immediate content together
        chunks.push(allContentMarkdown.trim());
      } else {
        // Too large - try to keep heading with first content item, then process others separately
        const headingWithFirst = [section.heading, contentNodes[0]];
        const firstContentMarkdown = toMarkdown({
          type: 'root',
          children: headingWithFirst
        });
        const firstContentSize = getTextLength(firstContentMarkdown);
        
        if (firstContentSize <= chunkSize || isWithinSoftLimit(firstContentSize, chunkSize)) {
          // Keep heading with first content item
          chunks.push(firstContentMarkdown.trim());
          
          // Process remaining content items individually
          for (let i = 1; i < contentNodes.length; i++) {
            const contentMarkdown = toMarkdown(contentNodes[i]);
            const contentSize = getTextLength(contentMarkdown);
            
            if (contentSize <= chunkSize || isWithinSoftLimit(contentSize, chunkSize)) {
              chunks.push(contentMarkdown.trim());
            } else {
              // Content too large - fall back to text splitting
              const contentAST = fromMarkdown(contentMarkdown.trim());
              const contentProtectedRanges = extractProtectedRangesFromAST(contentAST);
              const fallbackChunks = splitLongText(contentMarkdown.trim(), chunkSize, contentProtectedRanges, 0, contentAST);
              chunks.push(...fallbackChunks);
            }
          }
        } else {
          // Even heading + first content is too large - just add heading separately
          const headingMarkdown = toMarkdown(section.heading);
          chunks.push(headingMarkdown.trim());
          
          // Process all content items individually  
          for (const contentNode of contentNodes) {
            const contentMarkdown = toMarkdown(contentNode);
            const contentSize = getTextLength(contentMarkdown);
            
            if (contentSize <= chunkSize || isWithinSoftLimit(contentSize, chunkSize)) {
              chunks.push(contentMarkdown.trim());
            } else {
              // Content too large - fall back to text splitting
              const contentAST = fromMarkdown(contentMarkdown.trim());
              const contentProtectedRanges = extractProtectedRangesFromAST(contentAST);
              const fallbackChunks = splitLongText(contentMarkdown.trim(), chunkSize, contentProtectedRanges, 0, contentAST);
              chunks.push(...fallbackChunks);
            }
          }
        }
      }
    } else {
      // No immediate content - just add the heading
      const headingMarkdown = toMarkdown(section.heading);
      chunks.push(headingMarkdown.trim());
    }
    
    // Process nested sections recursively
    for (const nestedSection of nestedSections) {
      const nestedChunks = processHierarchicalSection(nestedSection, protectedRanges);
      chunks.push(...nestedChunks);
    }
    
    return chunks;
  };

  /**
   * Process hierarchical AST using top-down approach
   * 
   * @param hierarchicalAST - The hierarchical AST to process
   * @param protectedRanges - Pre-computed protected ranges from AST
   * @returns Array of markdown chunks
   */
  const processHierarchicalAST = (hierarchicalAST: HierarchicalRoot, protectedRanges: Array<{start: number, end: number, type: string}>): string[] => {
    const chunks: string[] = [];
    
    for (const child of hierarchicalAST.children) {
      if (isSection(child)) {
        // Process section hierarchically
        const sectionChunks = processHierarchicalSection(child, protectedRanges);
        chunks.push(...sectionChunks);
      } else {
        // Regular content - convert to markdown and check size
        const contentMarkdown = toMarkdown(child);
        if (getTextLength(contentMarkdown) <= chunkSize) {
          chunks.push(contentMarkdown.trim());
        } else {
          // Content too large - fall back to text splitting
          // Need to recalculate protected ranges for the converted markdown
          const contentAST = fromMarkdown(contentMarkdown.trim());
          const contentProtectedRanges = extractProtectedRangesFromAST(contentAST);
          const fallbackChunks = splitLongText(contentMarkdown.trim(), chunkSize, contentProtectedRanges);
          chunks.push(...fallbackChunks);
        }
      }
    }
    
    return chunks;
  };


  /**
   * Extract protected ranges from markdown AST nodes
   * Uses mdast position information to identify constructs that should never be split
   * 
   * @param ast - Parsed mdast AST with position information
   * @returns Array of protected ranges that must stay together
   */
  const extractProtectedRangesFromAST = (ast: import('mdast').Root): Array<{start: number, end: number, type: string}> => {
    const ranges: Array<{start: number, end: number, type: string}> = [];
    
    /**
     * Recursively traverse AST nodes to find inline constructs that need protection
     */
    const traverse = (node: any): void => {
      // Only protect nodes that have position information
      if (!node.position?.start?.offset || node.position?.end?.offset === undefined) {
        // Still traverse children even if this node lacks position info
        if (node.children && Array.isArray(node.children)) {
          node.children.forEach(traverse);
        }
        return;
      }

      const start = node.position.start.offset;
      const end = node.position.end.offset;

      // Protect inline markdown constructs that should never be split
      switch (node.type) {
        case 'link':
          ranges.push({ start, end, type: 'link' });
          break;
        case 'image':
          ranges.push({ start, end, type: 'image' });
          break;
        case 'inlineCode':
          ranges.push({ start, end, type: 'inline-code' });
          break;
        case 'linkReference':
          ranges.push({ start, end, type: 'link-reference' });
          break;
        case 'imageReference':
          ranges.push({ start, end, type: 'image-reference' });
          break;
        // Optional: protect emphasis and strong for consistency
        case 'emphasis':
          ranges.push({ start, end, type: 'emphasis' });
          break;
        case 'strong':
          ranges.push({ start, end, type: 'strong' });
          break;
        // Protect other inline constructs that could be problematic if split
        case 'delete':
          ranges.push({ start, end, type: 'delete' });
          break;
      }

      // Recursively traverse children
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(traverse);
      }
    };

    // Start traversal from the root
    traverse(ast);
    
    // Sort by start position for efficient processing
    return ranges.sort((a, b) => a.start - b.start);
  };

  /**
   * Adjust protected ranges for a substring operation
   * When working with substrings, the protected ranges need to be recalculated
   * 
   * @param protectedRanges - Original protected ranges
   * @param substringStart - Start position of the substring in the original text
   * @param substringEnd - End position of the substring in the original text
   * @returns Adjusted protected ranges for the substring
   */
  const adjustProtectedRangesForSubstring = (
    protectedRanges: Array<{start: number, end: number, type: string}>, 
    substringStart: number, 
    substringEnd: number
  ): Array<{start: number, end: number, type: string}> => {
    const adjustedRanges: Array<{start: number, end: number, type: string}> = [];
    
    for (const range of protectedRanges) {
      // Only include ranges that intersect with the substring
      if (range.end > substringStart && range.start < substringEnd) {
        // Adjust the range positions relative to the substring
        const adjustedRange = {
          start: Math.max(0, range.start - substringStart),
          end: Math.min(substringEnd - substringStart, range.end - substringStart),
          type: range.type
        };
        
        // Only include valid ranges (where start < end)
        if (adjustedRange.start < adjustedRange.end) {
          adjustedRanges.push(adjustedRange);
        }
      }
    }
    
    return adjustedRanges;
  };

  /**
   * Check if a split position would break a markdown construct
   * 
   * @param position - The proposed split position
   * @param protectedRanges - Pre-computed protected ranges from AST
   * @returns True if the split would break markdown formatting
   */
  const wouldBreakMarkdown = (position: number, protectedRanges: Array<{start: number, end: number, type: string}>): boolean => {
    for (const range of protectedRanges) {
      if (position > range.start && position < range.end) {
        return true; // Split would occur inside a protected construct
      }
    }
    
    return false;
  };

  /**
   * Find structural boundaries in text (list items, headings, paragraphs)
   * 
   * @param text - The text to analyze
   * @returns Array of structural boundary positions with their types and priority scores
   */
  /**
   * Extract structural boundaries from markdown AST nodes using position information
   * This replaces regex-based parsing with proper AST node analysis
   * 
   * @param ast - Parsed mdast AST with position information
   * @returns Array of structural boundaries with proper priority hierarchy
   */
  const extractStructuralBoundariesFromAST = (ast: import('mdast').Root): Array<{position: number, type: string, priority: number}> => {
    const boundaries: Array<{position: number, type: string, priority: number}> = [];
    
    /**
     * Recursively traverse AST nodes to find structural boundaries
     */
    const traverse = (node: any): void => {
      // Only process nodes that have position information
      if (!node.position?.start?.offset || node.position?.end?.offset === undefined) {
        // Still traverse children even if this node lacks position info
        if (node.children && Array.isArray(node.children)) {
          node.children.forEach(traverse);
        }
        return;
      }

      const start = node.position.start.offset;
      
      // Extract structural boundaries based on node type with proper priority hierarchy
      switch (node.type) {
        case 'heading':
          boundaries.push({
            position: start,
            type: 'heading',
            priority: 10 // Highest priority - major document structure
          });
          break;
          
        case 'thematicBreak': // Horizontal rules (---, ***, ___)
          boundaries.push({
            position: start,
            type: 'thematic-break',
            priority: 8
          });
          break;
          
        case 'code': // Code blocks
          boundaries.push({
            position: start,
            type: 'code-block',
            priority: 7
          });
          break;
          
        case 'blockquote':
          boundaries.push({
            position: start,
            type: 'blockquote',
            priority: 6
          });
          break;
          
        case 'paragraph':
          // Only add paragraph boundaries if they're not the first node
          // and there's meaningful separation (empty line before)
          if (start > 0) {
            boundaries.push({
              position: start,
              type: 'paragraph',
              priority: 5
            });
          }
          break;
          
        case 'list':
          boundaries.push({
            position: start,
            type: 'list',
            priority: 4 // List container boundary
          });
          break;
          
        case 'listItem':
          boundaries.push({
            position: start,
            type: 'list-item',
            priority: 3 // Individual list items within lists
          });
          break;
      }
      
      // Recursively process children
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(traverse);
      }
    };

    traverse(ast);
    
    // Sort boundaries by position for consistent processing
    return boundaries.sort((a, b) => a.position - b.position);
  };

  /**
   * Find the nearest safe split position that won't break markdown
   * Prioritizes structural boundaries over sentence boundaries
   * 
   * @param text - The text to split
   * @param targetPosition - The desired split position
   * @param protectedRanges - Pre-computed protected ranges from AST
   * @param searchDirection - 'backward' or 'forward' from target
   * @param ast - Optional AST for structural boundary detection (if available)
   * @returns Safe split position, or -1 if none found
   */
  const findSafeSplitPosition = (text: string, targetPosition: number, protectedRanges: Array<{start: number, end: number, type: string}>, searchDirection: 'backward' | 'forward' = 'backward', ast?: import('mdast').Root): number => {
    // Find all structural boundaries in the text
    let structuralBoundaries: Array<{position: number, type: string, priority: number}> = [];
    
    if (ast) {
      // Use AST-based boundary detection if available
      structuralBoundaries = extractStructuralBoundariesFromAST(ast);
    } else {
      // Fall back to parsing text if no AST available
      const tempAST = fromMarkdown(text);
      structuralBoundaries = extractStructuralBoundariesFromAST(tempAST);
    }
    
    // Helper function to check if a position is a sentence boundary
    const isSentenceBoundary = (pos: number): boolean => {
      if (pos === 0 || pos === text.length) return true;
      
      // Check for whitespace
      if (/\s/.test(text[pos]) || /\s/.test(text[pos - 1])) return true;
      
      // Check for sentence-ending punctuation followed by space
      if (pos > 1 && /[.!?]/.test(text[pos - 1]) && /\s/.test(text[pos])) return true;
      
      // Don't split after periods that might be in URLs or abbreviations
      if (pos > 0 && text[pos - 1] === '.') {
        // Check if it's likely part of a URL (e.g., "./path" or "example.com")
        if (pos < text.length && (text[pos] === '/' || /[a-zA-Z0-9]/.test(text[pos]))) return false;
        // Check if it's likely an abbreviation (e.g., "e.g.")
        if (pos > 1 && /[a-zA-Z]/.test(text[pos - 2])) return false;
      }
      
      return false;
    };
    
    // Helper function to score a boundary position
    const scoreBoundary = (pos: number): number => {
      if (wouldBreakMarkdown(pos, protectedRanges)) return -1; // Invalid
      
      let score = 0;
      const distance = Math.abs(pos - targetPosition);
      
      // Check if it's a structural boundary (highest priority)
      const structuralBoundary = structuralBoundaries.find(b => Math.abs(b.position - pos) <= 2);
      if (structuralBoundary) {
        score += structuralBoundary.priority * 100; // Heavily weight structural boundaries
      }
      // Check if it's a sentence boundary (medium priority)
      else if (isSentenceBoundary(pos)) {
        score += 50;
      }
      // Whitespace boundaries (low priority)
      else if (/\s/.test(text[pos]) || (pos > 0 && /\s/.test(text[pos - 1]))) {
        score += 10;
      }
      
      // Subtract distance penalty (prefer closer positions)
      score -= distance * 0.1;
      
      return score;
    };
    
    // Find the best boundary within a reasonable search range
    // Use a larger search range to ensure we find structural boundaries
    const searchRange = Math.min(200, text.length); // Search up to 200 chars in each direction
    let bestPosition = -1;
    let bestScore = -1;
    
    const startPos = Math.max(0, targetPosition - searchRange);
    const endPos = Math.min(text.length, targetPosition + searchRange);
    
    // Search both directions, but prioritize the requested direction
    const positions = [];
    
    if (searchDirection === 'backward') {
      // Search backward first, then forward
      for (let pos = targetPosition; pos >= startPos; pos--) {
        positions.push(pos);
      }
      for (let pos = targetPosition + 1; pos <= endPos; pos++) {
        positions.push(pos);
      }
    } else {
      // Search forward first, then backward
      for (let pos = targetPosition; pos <= endPos; pos++) {
        positions.push(pos);
      }
      for (let pos = targetPosition - 1; pos >= startPos; pos--) {
        positions.push(pos);
      }
    }
    
    // Score all positions and find the best one
    for (const pos of positions) {
      const score = scoreBoundary(pos);
      if (score > bestScore) {
        bestScore = score;
        bestPosition = pos;
      }
    }
    
    return bestPosition;
  };

  /**
   * Split text into sentences while preserving markdown constructs
   * This prevents sentence splitting from breaking links, images, etc.
   * 
   * @param text - Text to split into sentences
   * @param protectedRanges - Pre-computed protected ranges from AST
   * @returns Array of sentences with their positions in the original text
   */
  const splitIntoMarkdownAwareSentences = (text: string, protectedRanges: Array<{start: number, end: number, type: string}>): Array<{text: string, start: number, end: number}> => {
    
    // Find all potential sentence boundaries (periods, exclamation marks, question marks)
    const sentenceBoundaries: number[] = [];
    const sentenceEndRegex = /[.!?]/g;
    let match;
    
    while ((match = sentenceEndRegex.exec(text)) !== null) {
      sentenceBoundaries.push(match.index + 1); // Position after the punctuation
    }
    
    // Filter out boundaries that would break protected ranges
    const safeBoundaries = sentenceBoundaries.filter(boundary => {
      for (const range of protectedRanges) {
        if (boundary > range.start && boundary < range.end) {
          return false; // This boundary would break a protected range
        }
      }
      return true;
    });
    
    // Split at safe boundaries and track positions
    const sentences: Array<{text: string, start: number, end: number}> = [];
    let start = 0;
    
    for (const boundary of safeBoundaries) {
      const sentence = text.substring(start, boundary);
      const trimmedSentence = sentence.trim();
      if (trimmedSentence) {
        // Find the actual start position after trimming
        const leadingWhitespace = sentence.match(/^\s*/)?.[0].length || 0;
        const actualStart = start + leadingWhitespace;
        sentences.push({
          text: trimmedSentence,
          start: actualStart,
          end: actualStart + trimmedSentence.length
        });
      }
      start = boundary;
    }
    
    // Add remaining text
    if (start < text.length) {
      const remaining = text.substring(start);
      const trimmedRemaining = remaining.trim();
      if (trimmedRemaining) {
        const leadingWhitespace = remaining.match(/^\s*/)?.[0].length || 0;
        const actualStart = start + leadingWhitespace;
        sentences.push({
          text: trimmedRemaining,
          start: actualStart,
          end: actualStart + trimmedRemaining.length
        });
      }
    }
    
    return sentences.length > 0 ? sentences : [{text: text.trim(), start: 0, end: text.trim().length}];
  };

  /**
   * Split text that exceeds chunk size using markdown-aware hierarchical breaking points
   *
   * Uses a progressive approach that respects markdown formatting:
   * 1. Try splitting by sentences (. ! ?) while preserving markdown constructs
   * 2. If sentences are too long, split by punctuation (, ; :) with markdown awareness
   * 3. As last resort, split by word boundaries but never inside markdown constructs
   *
   * @param text - The text to split
   * @param maxSize - Maximum size for each chunk
   * @param protectedRanges - Pre-computed protected ranges from AST
   * @param originalOffset - Offset of this text in the original document (for protected range adjustment)
   * @param ast - Optional AST for structural boundary detection (if available)
   * @returns Array of text chunks, each within the size limit and preserving markdown formatting
   */
  const splitLongText = (text: string, maxSize: number, protectedRanges: Array<{start: number, end: number, type: string}>, originalOffset: number = 0, ast?: import('mdast').Root): string[] => {
    const textLength = getTextLength(text);
    
    // Check if text fits within target size
    if (textLength <= maxSize) return [text];
    
    // Check if text fits within overflow allowance - if so, keep it together
    const maxAllowedSize = maxSize * maxOverflowRatio;
    if (textLength <= maxAllowedSize) return [text];

    const chunks: string[] = [];
    let currentChunk = '';

    // Define minimum chunk size to prevent small fragments (20% of target size)
    const minChunkSize = Math.floor(maxSize * 0.2);

    // Step 1: Check for structural boundaries first (headings, paragraphs, lists)
    // These should take priority over sentence boundaries
    let structuralBoundaries: Array<{position: number, type: string, priority: number}> = [];
    
    if (ast) {
      // Use AST-based boundary detection if available
      structuralBoundaries = extractStructuralBoundariesFromAST(ast);
    } else {
      // Fall back to parsing text if no AST available
      const tempAST = fromMarkdown(text);
      structuralBoundaries = extractStructuralBoundariesFromAST(tempAST);
    }
    
    // If we have structural boundaries, prioritize them over sentence boundaries
    // Look for the best structural boundary within the text
    const suitableStructuralBoundary = structuralBoundaries.find(boundary => {
      // Skip the boundary at position 0 (start of text)
      if (boundary.position === 0) return false;
      
      // Check if this boundary would break a protected range (critical fix!)
      const wouldBreakProtectedRange = protectedRanges.some(range => 
        boundary.position > range.start && boundary.position < range.end
      );
      if (wouldBreakProtectedRange) return false;
      
      // Calculate what the first chunk size would be
      const firstChunkSize = getTextLength(text.substring(0, boundary.position).trim());
      
      // Accept if it's reasonable (between 30% and 150% of target size)
      // This allows for some flexibility while still preferring structural splits
      return firstChunkSize >= maxSize * 0.3 && firstChunkSize <= maxSize * 1.5;
    });
    
    if (suitableStructuralBoundary) {
      // Split at the structural boundary
      const firstChunk = text.substring(0, suitableStructuralBoundary.position).trim();
      const remainingText = text.substring(suitableStructuralBoundary.position);
      
      if (firstChunk) {
        chunks.push(firstChunk);
        
        // Recursively process the remaining text
        if (remainingText.trim()) {
          chunks.push(...splitLongText(remainingText, maxSize, protectedRanges, originalOffset + suitableStructuralBoundary.position, ast));
        }
        
        return chunks;
      }
    }
    
    // Step 2: Fall back to sentence boundaries if no structural boundary works
    // We need to use markdown-aware sentence splitting to avoid breaking links/images
    const sentences = splitIntoMarkdownAwareSentences(text, protectedRanges);

    for (let i = 0; i < sentences.length; i++) {
      const sentenceInfo = sentences[i];
      const sentenceText = sentenceInfo.text;
      if (!sentenceText) continue;

      const sentenceLength = getTextLength(sentenceText);
      const currentChunkLength = getTextLength(currentChunk);

      if (currentChunk.length === 0) {
        // Starting with a new sentence - check if it fits alone
        if (sentenceLength > maxSize) {
          // Sentence is too long - use markdown-aware splitting with correct offset
          const sentenceOffset = originalOffset + sentenceInfo.start;
          chunks.push(...splitTextWithMarkdownAwareness(sentenceText, maxSize, protectedRanges, sentenceOffset, ast));
        } else {
          currentChunk = sentenceText;
        }
      } else if (currentChunkLength + 1 + sentenceLength <= maxSize) {
        // Current sentence fits with existing chunk - combine them
        currentChunk += ` ${sentenceText}`;
      } else {
        // Current sentence doesn't fit
        // Check if we should allow overflow to prevent small fragments
        const isLastSentence = i === sentences.length - 1;
        const nextSentenceWouldBeTiny = isLastSentence || (sentences[i + 1] && getTextLength(sentences[i + 1].text) < minChunkSize);
        const currentChunkTooSmall = currentChunkLength < minChunkSize;
        const combinedLength = currentChunkLength + 1 + sentenceLength;
        const overflowAcceptable = combinedLength <= maxSize * maxOverflowRatio;

        if ((currentChunkTooSmall || nextSentenceWouldBeTiny) && overflowAcceptable) {
          // Allow overflow to prevent tiny fragments
          currentChunk += ` ${sentenceText}`;
        } else {
          // Save current chunk and start new one
          chunks.push(currentChunk);
          
          if (sentenceLength > maxSize) {
            // New sentence is too long - use markdown-aware splitting with correct offset
            const sentenceOffset = originalOffset + sentenceInfo.start;
            chunks.push(...splitTextWithMarkdownAwareness(sentenceText, maxSize, protectedRanges, sentenceOffset, ast));
            currentChunk = '';
          } else {
            currentChunk = sentenceText;
          }
        }
      }
    }

    if (currentChunk) chunks.push(currentChunk);

    return chunks;
  };

  /**
   * Split oversized text with markdown construct awareness
   * This function handles the complex case where even individual sentences are too large
   * 
   * @param text - Text to split (known to exceed maxSize)
   * @param maxSize - Maximum chunk size
   * @param protectedRanges - Pre-computed protected ranges from AST
   * @param originalTextOffset - Offset in the original text for protected range adjustment
   * @param ast - Optional AST for structural boundary detection (if available)
   * @returns Array of chunks that respect markdown boundaries
   */
  const splitTextWithMarkdownAwareness = (text: string, maxSize: number, protectedRanges: Array<{start: number, end: number, type: string}>, originalTextOffset: number = 0, ast?: import('mdast').Root): string[] => {
    const chunks: string[] = [];
    let remaining = text;
    let currentOffset = originalTextOffset;

    while (remaining.length > 0 && getTextLength(remaining) > maxSize) {
      // Find approximate position based on semantic text length
      let targetCharPosition = remaining.length;
      
      // Parse remaining text to find where semantic length reaches maxSize
      const remainingAst = fromMarkdown(remaining);
      const remainingPlainText = toString(remainingAst);
      
      // If the plain text is shorter than maxSize, we need to find the right character position
      if (remainingPlainText.length > maxSize) {
        // Estimate the character position based on ratio
        const ratio = maxSize / remainingPlainText.length;
        targetCharPosition = Math.floor(remaining.length * ratio);
      }
      
      // Ensure we don't exceed bounds
      targetCharPosition = Math.min(targetCharPosition, remaining.length - 1);

      // Adjust protected ranges for the current substring position
      const adjustedRanges = adjustProtectedRangesForSubstring(
        protectedRanges, 
        currentOffset, 
        currentOffset + remaining.length
      );
      
      // Find a safe split position that won't break markdown
      let splitPosition = findSafeSplitPosition(remaining, targetCharPosition, adjustedRanges, 'backward', ast);
      
      if (splitPosition === -1 || splitPosition === 0) {
        // No safe backward position found, try forward
        splitPosition = findSafeSplitPosition(remaining, targetCharPosition, adjustedRanges, 'forward', ast);
      }

      if (splitPosition === -1 || splitPosition === 0) {
        // Still no safe position - check for protected ranges
        if (adjustedRanges.length > 0 && adjustedRanges[0].start === 0) {
          // If we have a protected range at the start, split after it
          splitPosition = adjustedRanges[0].end;
        } else {
          // Try to find any word boundary
          let pos = Math.min(targetCharPosition, remaining.length - 1);
          while (pos > 0 && !/\s/.test(remaining[pos])) {
            pos--;
          }
          splitPosition = pos > 0 ? pos : remaining.indexOf(' ');
          
          if (splitPosition === -1) {
            // No spaces - take the whole thing
            chunks.push(remaining);
            break;
          }
        }
      }

      // Make the split
      const chunk = remaining.substring(0, splitPosition).trim();
      if (chunk) {
        chunks.push(chunk);
      }
      
      // Update for next iteration
      remaining = remaining.substring(splitPosition).trim();
      currentOffset += splitPosition;
    }

    // Add any remaining text
    if (remaining.trim()) {
      chunks.push(remaining.trim());
    }

    return chunks;
  };

  /**
   * Main text splitting function using hierarchical AST processing
   *
   * Process overview:
   * 1. Parse markdown text into AST using mdast-util-from-markdown
   * 2. Transform to hierarchical sections for semantic understanding
   * 3. Apply top-down chunking with soft limits and overflow logic
   * 4. Fall back to text-based splitting for oversized content
   *
   * @param text - The markdown text to split
   * @returns Array of text chunks with preserved markdown formatting and section relationships
   */
  const splitText = (text: string): string[] => {
    // Handle empty or whitespace-only input
    if (!text || !text.trim()) return [];

    // Step 1: Parse markdown text into Abstract Syntax Tree
    // This gives us semantic understanding of the document structure
    const tree = fromMarkdown(text);

    // Step 2: Extract protected ranges from AST to prevent splitting markdown constructs
    const protectedRanges = extractProtectedRangesFromAST(tree);

    // Step 3: Transform to hierarchical AST and use semantic-aware processing
    const hierarchicalAST = createHierarchicalAST(tree);
    return processHierarchicalAST(hierarchicalAST, protectedRanges);
  };

  // Return the configured splitter with the splitText function
  return { splitText };
};
