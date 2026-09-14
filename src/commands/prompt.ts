import { getApiKey } from '../utils/config.js';

export function runPrompt(rawPrompt: string): void {
  if (!rawPrompt.trim()) {
    throw new Error('Prompt must not be empty.');
  }

  getApiKey();
  console.log('Ready.');
}
