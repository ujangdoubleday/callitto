import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { runPrompt } from '../src/commands/prompt.js';
import { enhancePrompt } from '../src/services/enhancer.js';

vi.mock('../src/services/enhancer.js', () => ({ enhancePrompt: vi.fn() }));

beforeEach(() => {
  vi.mocked(enhancePrompt).mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

test('prints only the enhanced prompt and preserves raw input for the service', async () => {
  const raw = 'yoo refactor @filename\ntanpa ubah API';
  const enhanced = '## Context\nRefactor @filename.';
  vi.mocked(enhancePrompt).mockResolvedValue(enhanced);
  await runPrompt(raw);
  expect(enhancePrompt).toHaveBeenCalledExactlyOnceWith(raw);
  expect(console.log).toHaveBeenCalledExactlyOnceWith(enhanced);
});

test('rejects blank input before calling the service', async () => {
  await expect(runPrompt(' \n\t ')).rejects.toThrow(
    'Prompt must not be empty.',
  );
  expect(enhancePrompt).not.toHaveBeenCalled();
  expect(console.log).not.toHaveBeenCalled();
});

test('propagates service failures without printing a result', async () => {
  const error = new Error('Gemini usage limit reached. Try again later.');
  vi.mocked(enhancePrompt).mockRejectedValue(error);
  await expect(runPrompt('refactor ini')).rejects.toBe(error);
  expect(console.log).not.toHaveBeenCalled();
});
