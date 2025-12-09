/**
 * Chrome Summarizer API utilities
 * Uses the built-in Summarizer API with summary of summaries strategy for long texts
 */

// Maximum characters per chunk (approximately 750 tokens)
const CHUNK_SIZE = 3000;
// Overlap between chunks for context preservation
const CHUNK_OVERLAP = 200;

/**
 * Check if the Summarizer API is available
 */
export async function isSummarizerAvailable(): Promise<boolean> {
  if (!('Summarizer' in self)) {
    console.log('Summarizer API not available in this browser');
    return false;
  }
  
  try {
    const availability = await (self as any).Summarizer.availability();
    console.log('Summarizer availability:', availability);
    return availability !== 'unavailable';
  } catch (error) {
    console.error('Error checking summarizer availability:', error);
    return false;
  }
}

/**
 * Create a summarizer instance with download progress monitoring
 */
async function createSummarizer(options?: {
  type?: 'key-points' | 'tldr' | 'teaser' | 'headline';
  length?: 'short' | 'medium' | 'long';
  format?: 'markdown' | 'plain-text';
  sharedContext?: string;
  onDownloadProgress?: (progress: number) => void;
}): Promise<any> {
  const { type = 'key-points', length = 'medium', format = 'markdown', sharedContext, onDownloadProgress } = options || {};
  
  const summarizer = await (self as any).Summarizer.create({
    type,
    length,
    format,
    sharedContext,
    monitor(m: any) {
      m.addEventListener('downloadprogress', (e: any) => {
        const progress = e.loaded * 100;
        console.log(`Summarizer model download: ${progress.toFixed(1)}%`);
        onDownloadProgress?.(progress);
      });
    }
  });
  
  return summarizer;
}

/**
 * Split text into chunks for processing
 * Uses a simple approach that splits on paragraph boundaries when possible
 */
function splitText(text: string, chunkSize: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): string[] {
  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = Math.min(startIndex + chunkSize, text.length);
    
    // If not at the end, try to find a good split point
    if (endIndex < text.length) {
      // Try to split at paragraph boundary
      const paragraphBreak = text.lastIndexOf('\n\n', endIndex);
      if (paragraphBreak > startIndex + chunkSize / 2) {
        endIndex = paragraphBreak;
      } else {
        // Try to split at sentence boundary
        const sentenceBreak = text.lastIndexOf('. ', endIndex);
        if (sentenceBreak > startIndex + chunkSize / 2) {
          endIndex = sentenceBreak + 1; // Include the period
        } else {
          // Try to split at word boundary
          const wordBreak = text.lastIndexOf(' ', endIndex);
          if (wordBreak > startIndex + chunkSize / 2) {
            endIndex = wordBreak;
          }
        }
      }
    }

    chunks.push(text.slice(startIndex, endIndex).trim());
    
    // Move start index with overlap
    startIndex = endIndex - overlap;
    if (startIndex < endIndex && startIndex > 0) {
      // Find the start of the next sentence/paragraph for cleaner chunks
      const nextBreak = text.indexOf('\n', startIndex);
      if (nextBreak > startIndex && nextBreak < startIndex + overlap) {
        startIndex = nextBreak + 1;
      }
    }
    
    // Avoid infinite loop
    if (startIndex <= 0 || startIndex >= text.length - 10) {
      startIndex = endIndex;
    }
  }

  return chunks.filter(chunk => chunk.length > 0);
}

/**
 * Summarize text using the Chrome Summarizer API
 * Implements "summary of summaries" strategy for long texts
 */
export async function summarizeText(
  text: string,
  options?: {
    type?: 'key-points' | 'tldr' | 'teaser' | 'headline';
    length?: 'short' | 'medium' | 'long';
    format?: 'markdown' | 'plain-text';
    context?: string;
    onProgress?: (message: string) => void;
    onDownloadProgress?: (progress: number) => void;
  }
): Promise<string> {
  const { type = 'key-points', length = 'medium', format = 'markdown', context, onProgress, onDownloadProgress } = options || {};
  
  const startTime = performance.now();
  console.log(`[Summarizer] Starting summarization, text length: ${text.length} chars`);
  onProgress?.('Checking summarizer availability...');
  
  // Check availability
  const available = await isSummarizerAvailable();
  if (!available) {
    throw new Error('Chrome Summarizer API is not available. Please ensure you are using Chrome 138+ with the required hardware.');
  }
  
  onProgress?.('Creating summarizer...');
  
  // Create summarizer for individual chunks (use tldr for intermediate summaries)
  const chunkSummarizer = await createSummarizer({
    type: 'tldr',
    length: 'long',
    format: 'plain-text',
    sharedContext: context || 'This is part of a larger document being summarized.',
    onDownloadProgress,
  });
  
  // Split text into chunks
  const chunks = splitText(text);
  console.log(`[Summarizer] Split into ${chunks.length} chunks`);
  
  if (chunks.length === 1) {
    // Text is short enough to summarize directly with final settings
    onProgress?.('Summarizing...');
    const finalSummarizer = await createSummarizer({
      type,
      length,
      format,
      sharedContext: context,
      onDownloadProgress,
    });
    
    const summary = await finalSummarizer.summarize(chunks[0], {
      context: context || undefined,
    });
    
    const elapsed = performance.now() - startTime;
    console.log(`[Summarizer] Completed in ${elapsed.toFixed(0)}ms`);
    
    return summary;
  }
  
  // Use summary of summaries strategy for long texts
  onProgress?.(`Processing ${chunks.length} sections...`);
  
  // Summarize each chunk
  const chunkSummaries: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(`Summarizing section ${i + 1} of ${chunks.length}...`);
    console.log(`[Summarizer] Summarizing chunk ${i + 1}/${chunks.length}, length: ${chunks[i].length}`);
    
    const chunkSummary = await chunkSummarizer.summarize(chunks[i], {
      context: `This is section ${i + 1} of ${chunks.length} from the document.`,
    });
    chunkSummaries.push(chunkSummary);
  }
  
  // Combine chunk summaries
  let combinedSummaries = chunkSummaries.join('\n\n');
  console.log(`[Summarizer] Combined summaries length: ${combinedSummaries.length}`);
  
  // Recursively summarize if combined summaries are still too long
  let recursionCount = 0;
  const maxRecursions = 5; // Prevent infinite recursion
  
  while (combinedSummaries.length > CHUNK_SIZE && recursionCount < maxRecursions) {
    recursionCount++;
    onProgress?.(`Condensing summary (pass ${recursionCount})...`);
    console.log(`[Summarizer] Recursive pass ${recursionCount}, length: ${combinedSummaries.length}`);
    
    const subChunks = splitText(combinedSummaries);
    const subSummaries: string[] = [];
    
    for (let i = 0; i < subChunks.length; i++) {
      const subSummary = await chunkSummarizer.summarize(subChunks[i], {
        context: `This is a summary being condensed, part ${i + 1} of ${subChunks.length}.`,
      });
      subSummaries.push(subSummary);
    }
    
    combinedSummaries = subSummaries.join('\n\n');
  }
  
  // Final summarization with user's preferred settings
  onProgress?.('Generating final summary...');
  const finalSummarizer = await createSummarizer({
    type,
    length,
    format,
    sharedContext: context || 'This is a summary of multiple sections from a document.',
    onDownloadProgress,
  });
  
  const finalSummary = await finalSummarizer.summarize(combinedSummaries, {
    context: context || 'Please provide a cohesive summary combining all the information.',
  });
  
  const elapsed = performance.now() - startTime;
  console.log(`[Summarizer] Completed in ${elapsed.toFixed(0)}ms after ${recursionCount} recursive passes`);
  
  return finalSummary;
}

/**
 * Summarize a note including its name, text, and all content items
 */
export async function summarizeNote(
  note: {
    name: string;
    note: string | null;
    contents: Array<{ text: string; url?: string }>;
  },
  options?: {
    type?: 'key-points' | 'tldr' | 'teaser' | 'headline';
    length?: 'short' | 'medium' | 'long';
    format?: 'markdown' | 'plain-text';
    onProgress?: (message: string) => void;
    onDownloadProgress?: (progress: number) => void;
  }
): Promise<string> {
  // Combine note content
  const parts: string[] = [];
  
  if (note.name) {
    parts.push(`Title: ${note.name}`);
  }
  
  if (note.note) {
    parts.push(`Notes: ${note.note}`);
  }
  
  if (note.contents.length > 0) {
    parts.push('Content items:');
    note.contents.forEach((content, index) => {
      parts.push(`${index + 1}. ${content.text}`);
      if (content.url) {
        parts.push(`   Source: ${content.url}`);
      }
    });
  }
  
  const fullText = parts.join('\n');
  
  return summarizeText(fullText, {
    ...options,
    context: `This is a note titled "${note.name}" containing collected information and snippets.`,
  });
}
