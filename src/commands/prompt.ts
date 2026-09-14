import { enhancePrompt } from '../services/enhancer.js';

export async function runPrompt(rawPrompt: string): Promise<void> {
  if (!rawPrompt.trim()) {
    throw new Error('Prompt must not be empty.');
  }

  const enhancedPrompt = await enhancePrompt(rawPrompt);
  console.log(enhancedPrompt);
}
