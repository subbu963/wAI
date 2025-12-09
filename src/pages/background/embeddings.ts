import { pipeline, FeatureExtractionPipeline } from '@huggingface/transformers';

// Model: mixedbread-ai/mxbai-embed-large-v1 outputs 1024-dimensional embeddings
const MODEL_NAME = 'mixedbread-ai/mxbai-embed-large-v1';

// Query prompt for retrieval tasks (as recommended by the model)
const QUERY_PROMPT = 'Represent this sentence for searching relevant passages: ';

let extractor: FeatureExtractionPipeline | null = null;
let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

/**
 * Get or initialize the feature extraction pipeline.
 * Uses singleton pattern to avoid loading the model multiple times.
 */
async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (extractor) return extractor;
  
  if (!extractorPromise) {
    console.log('[Embeddings] Loading model:', MODEL_NAME);
    extractorPromise = pipeline('feature-extraction', MODEL_NAME).then((result) => {
      extractor = result;
      console.log('[Embeddings] Model loaded successfully');
      return result;
    });
  }
  
  return extractorPromise;
}

/**
 * Generate embedding for a single text string (for documents/content).
 * Returns a 1024-dimensional vector.
 */
async function computeEmbedding(text: string): Promise<number[]> {
  console.log('[Embeddings] Computing embedding for text:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
  const startTime = performance.now();
  const ext = await getExtractor();
  const output = await ext(text, { pooling: 'cls', normalize: true });
  const embedding = Array.from(output.data as Float32Array);
  console.log(`[Embeddings] Embedding computed in ${(performance.now() - startTime).toFixed(2)}ms`);
  return embedding;
}

/**
 * Generate embedding for a query (for search).
 * Uses the recommended query prompt for retrieval tasks.
 * Returns a 1024-dimensional vector.
 */
async function computeQueryEmbedding(query: string): Promise<number[]> {
  console.log('[Embeddings] Computing query embedding for:', query.substring(0, 100) + (query.length > 100 ? '...' : ''));
  const startTime = performance.now();
  const ext = await getExtractor();
  const output = await ext(QUERY_PROMPT + query, { pooling: 'cls', normalize: true });
  const embedding = Array.from(output.data as Float32Array);
  console.log(`[Embeddings] Query embedding computed in ${(performance.now() - startTime).toFixed(2)}ms`);
  return embedding;
}

// Message types for embedding requests
export type EmbeddingMessageType = 
  | { type: 'GENERATE_EMBEDDING'; text: string }
  | { type: 'GENERATE_QUERY_EMBEDDING'; query: string }
  | { type: 'GENERATE_EMBEDDINGS'; texts: string[] };

export type EmbeddingResponseType = 
  | { success: true; embedding: number[] }
  | { success: true; embeddings: number[][] }
  | { success: false; error: string };

/**
 * Initialize the message listener for embedding requests.
 * Call this in the background script.
 */
export function initEmbeddingMessageHandler(): void {
  chrome.runtime.onMessage.addListener((message: EmbeddingMessageType, _sender, sendResponse) => {
    if (message.type === 'GENERATE_EMBEDDING') {
      computeEmbedding(message.text)
        .then(embedding => sendResponse({ success: true, embedding }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep the message channel open for async response
    }
    
    if (message.type === 'GENERATE_QUERY_EMBEDDING') {
      computeQueryEmbedding(message.query)
        .then(embedding => sendResponse({ success: true, embedding }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }
    
    if (message.type === 'GENERATE_EMBEDDINGS') {
      Promise.all(message.texts.map(text => computeEmbedding(text)))
        .then(embeddings => sendResponse({ success: true, embeddings }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }
    
    return false;
  });
  
  console.log('[Embeddings] Message handler initialized');
  
  // Pre-load the model
  getExtractor().catch(error => {
    console.error('[Embeddings] Failed to pre-load model:', error);
  });
}

// ============================================================================
// Client-side API (for use in Panel, Newtab, etc.)
// These functions send messages to the background script
// ============================================================================

/**
 * Generate embedding for a single text string (for documents/content).
 * Sends a message to the background script.
 * Returns a 1024-dimensional vector.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'GENERATE_EMBEDDING', text } as EmbeddingMessageType,
      (response: EmbeddingResponseType) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response.success && 'embedding' in response) {
          resolve(response.embedding);
        } else if (!response.success) {
          reject(new Error(response.error));
        }
      }
    );
  });
}

/**
 * Generate embedding for a query (for search).
 * Uses the recommended query prompt for retrieval tasks.
 * Returns a 1024-dimensional vector.
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'GENERATE_QUERY_EMBEDDING', query } as EmbeddingMessageType,
      (response: EmbeddingResponseType) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response.success && 'embedding' in response) {
          resolve(response.embedding);
        } else if (!response.success) {
          reject(new Error(response.error));
        }
      }
    );
  });
}

/**
 * Generate embeddings for multiple text strings.
 * Returns an array of 1024-dimensional vectors.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'GENERATE_EMBEDDINGS', texts } as EmbeddingMessageType,
      (response: EmbeddingResponseType) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response.success && 'embeddings' in response) {
          resolve(response.embeddings);
        } else if (!response.success) {
          reject(new Error(response.error));
        }
      }
    );
  });
}
