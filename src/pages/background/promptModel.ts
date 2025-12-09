/**
 * Chrome Prompt API utilities
 * Uses the built-in LanguageModel API (Gemini Nano) for prompts
 */

// Availability status types (same as Summarizer)
export type PromptModelAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

/**
 * Get the detailed availability status of the Prompt API (LanguageModel)
 */
export async function getPromptModelAvailability(): Promise<PromptModelAvailability> {
  if (!('LanguageModel' in self)) {
    console.log('LanguageModel (Prompt API) not available in this browser');
    return 'unavailable';
  }
  
  try {
    const availability = await (self as any).LanguageModel.availability();
    console.log('LanguageModel availability:', availability);
    return availability as PromptModelAvailability;
  } catch (error) {
    console.error('Error checking LanguageModel availability:', error);
    return 'unavailable';
  }
}

/**
 * Check if the Prompt API is available
 */
export async function isPromptModelAvailable(): Promise<boolean> {
  const availability = await getPromptModelAvailability();
  return availability !== 'unavailable';
}

/**
 * Trigger the prompt model download
 * Returns a promise that resolves when download is complete
 */
export async function triggerPromptModelDownload(
  onProgress?: (progress: number) => void
): Promise<boolean> {
  if (!('LanguageModel' in self)) {
    throw new Error('LanguageModel (Prompt API) not available in this browser');
  }

  try {
    const availability = await getPromptModelAvailability();
    if (availability === 'unavailable') {
      throw new Error('LanguageModel is not available on this device');
    }
    if (availability === 'available') {
      console.log('LanguageModel already available');
      return true;
    }

    console.log('Triggering LanguageModel download...');
    
    // Create a session to trigger the download
    await (self as any).LanguageModel.create({
      monitor(m: any) {
        m.addEventListener('downloadprogress', (e: any) => {
          const progress = e.loaded * 100;
          console.log(`LanguageModel download: ${progress.toFixed(1)}%`);
          onProgress?.(progress);
        });
      }
    });

    console.log('LanguageModel download complete');
    return true;
  } catch (error) {
    console.error('Failed to download LanguageModel:', error);
    throw error;
  }
}

/**
 * Get model parameters
 */
export async function getPromptModelParams(): Promise<{
  defaultTopK: number;
  maxTopK: number;
  defaultTemperature: number;
  maxTemperature: number;
} | null> {
  if (!('LanguageModel' in self)) {
    return null;
  }

  try {
    const params = await (self as any).LanguageModel.params();
    return params;
  } catch (error) {
    console.error('Error getting LanguageModel params:', error);
    return null;
  }
}
