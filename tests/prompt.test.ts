import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { runPrompt } from '../src/commands/prompt.js';
import { enhancePrompt } from '../src/services/enhancer.js';

const { spinner } = vi.hoisted(() => ({
  spinner: { start: vi.fn(), stop: vi.fn() },
}));

vi.mock('ora', () => ({ default: vi.fn(() => spinner) }));
vi.mock('../src/services/enhancer.js', () => ({ enhancePrompt: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  spinner.start.mockReturnValue(spinner);
  vi.mocked(enhancePrompt).mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

test('prints only the enhanced prompt and preserves raw input for the service', async () => {
  const raw = 'yoo refactor @filename\ntanpa ubah API';
  const enhanced = '## Context\nRefactor @filename.';
  vi.mocked(enhancePrompt).mockResolvedValue(enhanced);
  await runPrompt(raw);
  expect(enhancePrompt).toHaveBeenCalledExactlyOnceWith(
    raw,
    expect.any(Function),
  );
  expect(console.log).toHaveBeenCalledExactlyOnceWith(enhanced);
  expect(console.error).not.toHaveBeenCalled();
  expect(spinner.stop).toHaveBeenCalledTimes(1);
});

test('rejects blank input before calling the service', async () => {
  await expect(runPrompt(' \n\t ')).rejects.toThrow(
    'Prompt must not be empty.',
  );
  expect(enhancePrompt).not.toHaveBeenCalled();
  expect(console.log).not.toHaveBeenCalled();
  expect(spinner.start).not.toHaveBeenCalled();
});

test('propagates service failures without printing a result', async () => {
  const error = new Error('Gemini usage limit reached. Try again later.');
  vi.mocked(enhancePrompt).mockRejectedValue(error);
  await expect(runPrompt('refactor ini')).rejects.toBe(error);
  expect(console.log).not.toHaveBeenCalled();
  expect(spinner.stop).toHaveBeenCalledTimes(1);
});

test.each([false, true])(
  'prints fallback notices to stderr and cleans up the spinner (failure: %s)',
  async (fails) => {
    const message = 'primary: HTTP 429. Trying backup next.';
    vi.mocked(enhancePrompt).mockImplementation(async (_raw, onFallback) => {
      onFallback?.(message);
      if (fails) throw new Error('All Gemini models failed.');
      return 'enhanced prompt';
    });

    const result = runPrompt('refactor ini');
    if (fails) {
      await expect(result).rejects.toThrow('All Gemini models failed.');
      expect(console.log).not.toHaveBeenCalled();
    } else {
      await result;
      expect(console.log).toHaveBeenCalledExactlyOnceWith('enhanced prompt');
    }
    expect(console.error).toHaveBeenCalledExactlyOnceWith(message);
    expect(spinner.start).toHaveBeenCalledTimes(2);
    expect(spinner.stop).toHaveBeenCalledTimes(2);
    expect(spinner.stop.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(console.error).mock.invocationCallOrder[0]!,
    );
    expect(vi.mocked(console.error).mock.invocationCallOrder[0]).toBeLessThan(
      spinner.start.mock.invocationCallOrder[1]!,
    );
    expect(spinner.start.mock.invocationCallOrder[1]).toBeLessThan(
      spinner.stop.mock.invocationCallOrder[1]!,
    );
  },
);
