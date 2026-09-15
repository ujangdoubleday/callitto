import ora from 'ora';
import { enhancePrompt } from '../services/enhancer.js';

export async function runPrompt(rawPrompt: string): Promise<void> {
  if (!rawPrompt.trim()) {
    throw new Error('Prompt must not be empty.');
  }

  const spinner = ora({
    text: 'Enhancing prompt...',
    isSilent: !process.stderr.isTTY,
  }).start();

  let enhancedPrompt: string;
  try {
    enhancedPrompt = await enhancePrompt(rawPrompt, (message) => {
      spinner.stop();
      console.error(message);
      spinner.start();
    });
  } finally {
    spinner.stop();
  }

  console.log(enhancedPrompt);
}
