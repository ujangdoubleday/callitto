import { ApiError, GoogleGenAI } from '@google/genai';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { SYSTEM_INSTRUCTION, enhancePrompt } from '../src/services/enhancer.js';
import { getModels } from '../src/utils/config.js';

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock('@google/genai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@google/genai')>()),
  GoogleGenAI: vi.fn(
    class {
      models = { generateContent };
    },
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.stubEnv('CALLITTO_API_KEY', '  test-secret-key  ');
  vi.stubEnv('CALLITTO_MODEL', undefined);
  vi.stubEnv('CALLITTO_FALLBACK_MODELS', undefined);
  generateContent.mockReset();
  generateContent.mockResolvedValue({
    text: '  ## Context\nRefactor @filename.\n',
    candidates: [{ finishReason: 'STOP' }],
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

test('sends the exact instruction and raw prompt, returning only trimmed text', async () => {
  const prompt = 'yoo, refactor @filename\ntanpa mengubah API';
  await expect(enhancePrompt(prompt)).resolves.toBe(
    '## Context\nRefactor @filename.',
  );
  expect(GoogleGenAI).toHaveBeenCalledWith({
    apiKey: 'test-secret-key',
    enterprise: false,
    httpOptions: { timeout: 60_000, retryOptions: { attempts: 1 } },
  });
  expect(generateContent).toHaveBeenCalledExactlyOnceWith({
    model: 'gemini-3.8-flash',
    contents: prompt,
    config: { systemInstruction: SYSTEM_INSTRUCTION },
  });
});

test.each([
  ['  another-model  ', 'another-model'],
  ['', 'gemini-3.8-flash'],
  [' \t ', 'gemini-3.8-flash'],
])('resolves model setting %j', async (setting, model) => {
  vi.stubEnv('CALLITTO_MODEL', setting);
  await enhancePrompt('refactor ini');
  expect(generateContent).toHaveBeenCalledWith(
    expect.objectContaining({ model }),
  );
});

test('rejects missing configuration before creating a client', async () => {
  vi.stubEnv('CALLITTO_API_KEY', undefined);
  await expect(enhancePrompt('refactor ini')).rejects.toThrow(
    'Set CALLITTO_API_KEY',
  );
  expect(GoogleGenAI).not.toHaveBeenCalled();
});

test.each([
  [{}, 'empty'],
  [{ text: '' }, 'empty'],
  [{ text: ' \n ' }, 'empty'],
  [
    { text: 'partial', candidates: [{ finishReason: 'MAX_TOKENS' }] },
    'incomplete',
  ],
  [{ text: 'blocked', candidates: [{ finishReason: 'SAFETY' }] }, 'blocked'],
  [{ text: 'blocked', promptFeedback: { blockReason: 'SAFETY' } }, 'blocked'],
])('rejects unusable response %j', async (response, message) => {
  generateContent.mockResolvedValue(response);
  await expect(enhancePrompt('refactor ini')).rejects.toThrow(message);
});

test.each([
  [400, 'Gemini request rejected', 1],
  [401, 'Gemini access denied', 1],
  [403, 'Gemini access denied', 1],
  [404, 'Gemini model unavailable', 3],
  [408, 'Gemini request temporarily failed', 3],
  [422, 'Gemini request rejected', 1],
  [429, 'Gemini usage limit reached', 3],
  [500, 'Gemini request temporarily failed', 3],
  [503, 'Gemini request temporarily failed', 3],
])(
  'maps HTTP %i without exposing the provider message',
  async (status, message, attempts) => {
    generateContent.mockRejectedValue(
      new ApiError({
        status,
        message: 'test-secret-key private provider body',
      }),
    );
    const notice = vi.fn();
    const result = enhancePrompt('private prompt', notice);
    const checks = Promise.all([
      expect(result).rejects.toThrow(message),
      expect(result).rejects.toThrow(`HTTP ${status}`),
      expect(result).rejects.not.toThrow('test-secret-key'),
      expect(result).rejects.not.toThrow('private provider body'),
      expect(result).rejects.not.toThrow('private prompt'),
      expect(result).rejects.not.toHaveProperty('cause'),
    ]);
    await Promise.all([checks, vi.runAllTimersAsync()]);
    expect(generateContent).toHaveBeenCalledTimes(attempts);
    expect(notice).toHaveBeenCalledTimes(attempts - 1);
    expect(JSON.stringify(notice.mock.calls)).not.toMatch(
      /test-secret-key|private provider body|private prompt/,
    );
  },
);

test.each(['connection failed', 'request timed out'])(
  'sanitizes network failure: %s',
  async (message) => {
    generateContent.mockRejectedValue(new Error(`${message}: test-secret-key`));
    await expect(enhancePrompt('refactor ini')).rejects.toThrow(
      'Gemini request failed. Check your connection and try again.',
    );
    expect(generateContent).toHaveBeenCalledTimes(3);
  },
);

test('sanitizes client initialization errors too', async () => {
  vi.mocked(GoogleGenAI).mockImplementationOnce(function () {
    throw new Error('test-secret-key');
  });
  await expect(enhancePrompt('refactor ini')).rejects.toThrow(
    new Error('Gemini request failed. Check your connection and try again.'),
  );
  expect(GoogleGenAI).toHaveBeenCalledTimes(1);
  expect(generateContent).not.toHaveBeenCalled();
});

test.each([
  [
    undefined,
    ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  ],
  ['', ['gemini-3.8-flash']],
  [' , \t, ', ['gemini-3.8-flash']],
  [
    ' backup-b, gemini-3.8-flash, backup-a, backup-b, ',
    ['gemini-3.8-flash', 'backup-b', 'backup-a'],
  ],
])('resolves ordered backups from %j', (setting, models) => {
  vi.stubEnv('CALLITTO_FALLBACK_MODELS', setting);
  expect(getModels()).toEqual(models);
});

test('keeps a custom primary first and removes it from the backups', () => {
  vi.stubEnv('CALLITTO_MODEL', '  backup-a  ');
  vi.stubEnv('CALLITTO_FALLBACK_MODELS', 'backup-b, backup-a, backup-b');
  expect(getModels()).toEqual(['backup-a', 'backup-b']);
});

test.each([404, 408, 429, 500, 503])(
  'recovers from HTTP %i with the first backup',
  async (status) => {
    generateContent.mockRejectedValueOnce(
      new ApiError({ status, message: 'private provider body' }),
    );
    const notice = vi.fn();
    const result = enhancePrompt('raw @filename', notice);
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe('## Context\nRefactor @filename.');
    expect(GoogleGenAI).toHaveBeenCalledTimes(1);
    expect(generateContent.mock.calls).toEqual([
      [
        {
          model: 'gemini-3.8-flash',
          contents: 'raw @filename',
          config: { systemInstruction: SYSTEM_INSTRUCTION },
        },
      ],
      [
        {
          model: 'gemini-2.5-flash',
          contents: 'raw @filename',
          config: { systemInstruction: SYSTEM_INSTRUCTION },
        },
      ],
    ]);
    expect(notice).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('Trying gemini-2.5-flash next.'),
    );
  },
);

test.each([
  new TypeError('fetch failed: test-secret-key'),
  new DOMException('test-secret-key', 'TimeoutError'),
  new Error('unexpected SDK failure: test-secret-key'),
  'test-secret-key',
])('recovers from a request rejection: %s', async (error) => {
  generateContent.mockRejectedValueOnce(error);
  await expect(enhancePrompt('refactor ini')).resolves.toBe(
    '## Context\nRefactor @filename.',
  );
  expect(generateContent).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

test.each([
  {},
  { text: ' \t ' },
  { text: 'partial', candidates: [{ finishReason: 'MAX_TOKENS' }] },
  { text: 'partial', candidates: [{ finishReason: 'OTHER' }] },
])('falls back on unusable output: %j', async (response) => {
  generateContent.mockResolvedValueOnce(response);
  await expect(enhancePrompt('refactor ini')).resolves.toBe(
    '## Context\nRefactor @filename.',
  );
  expect(generateContent).toHaveBeenCalledTimes(2);
});

test.each([
  'SAFETY',
  'RECITATION',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
  'IMAGE_SAFETY',
  'IMAGE_PROHIBITED_CONTENT',
  'IMAGE_RECITATION',
])('does not switch around a content block: %s', async (finishReason) => {
  generateContent.mockResolvedValueOnce({
    text: 'blocked',
    candidates: [{ finishReason }],
  });
  const notice = vi.fn();
  await expect(enhancePrompt('refactor ini', notice)).rejects.toThrow(
    'blocked',
  );
  expect(generateContent).toHaveBeenCalledTimes(1);
  expect(notice).not.toHaveBeenCalled();
});

test('stops on prompt blocks even if output appears usable', async () => {
  generateContent.mockResolvedValueOnce({
    text: 'blocked',
    promptFeedback: { blockReason: 'SAFETY' },
  });
  await expect(enhancePrompt('refactor ini')).rejects.toThrow('blocked');
  expect(generateContent).toHaveBeenCalledTimes(1);
});

test('bounds backoff at two seconds and never waits after the final model', async () => {
  vi.stubEnv('CALLITTO_FALLBACK_MODELS', 'backup-a,backup-b,backup-c');
  generateContent.mockRejectedValue(
    new ApiError({ status: 429, message: 'quota' }),
  );
  const notice = vi.fn();
  const result = expect(enhancePrompt('refactor ini', notice)).rejects.toThrow(
    'All Gemini models failed.',
  );
  await vi.advanceTimersByTimeAsync(0);
  expect(generateContent).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(999);
  expect(generateContent).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(generateContent).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1_999);
  expect(generateContent).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  expect(generateContent).toHaveBeenCalledTimes(3);
  await vi.advanceTimersByTimeAsync(2_000);
  expect(generateContent).toHaveBeenCalledTimes(4);
  await result;
  expect(notice).toHaveBeenCalledTimes(3);
  expect(vi.getTimerCount()).toBe(0);
});

test('reports every failure in order, including a terminal error after fallback', async () => {
  generateContent
    .mockRejectedValueOnce(new ApiError({ status: 404, message: 'private' }))
    .mockRejectedValueOnce(new ApiError({ status: 403, message: 'private' }));
  await expect(enhancePrompt('refactor ini')).rejects.toThrow(
    /Gemini execution stopped\. gemini-3\.8-flash: .*HTTP 404.*gemini-2\.5-flash: .*HTTP 403/,
  );
  expect(generateContent).toHaveBeenCalledTimes(2);
});

test('summarizes mixed failures after exhausting the model list', async () => {
  generateContent
    .mockRejectedValueOnce(new ApiError({ status: 404, message: 'private' }))
    .mockResolvedValueOnce({ text: ' ' })
    .mockRejectedValueOnce(new Error('test-secret-key'));
  await expect(enhancePrompt('refactor ini')).rejects.toThrow(
    /All Gemini models failed\. gemini-3\.8-flash: .*HTTP 404.*gemini-2\.5-flash: .*empty.*gemini-2\.5-flash-lite: .*request failed/,
  );
  expect(generateContent).toHaveBeenCalledTimes(3);
});

test('redacts credentials and control characters in diagnostic model labels', async () => {
  vi.stubEnv('CALLITTO_MODEL', 'model-test-secret-key\n\u001b[31m');
  vi.stubEnv('CALLITTO_FALLBACK_MODELS', 'backup-test-secret-key\n\u001b[31m');
  generateContent.mockResolvedValue({ text: '' });
  const notice = vi.fn();
  const result = enhancePrompt('private prompt', notice);
  await expect(result).rejects.not.toThrow('test-secret-key');
  await expect(result).rejects.not.toThrow('\n');
  await expect(result).rejects.not.toThrow('\u001b');
  expect(notice).toHaveBeenCalledExactlyOnceWith(
    expect.stringContaining('REDACTED'),
  );
  const messages = notice.mock.calls.flat().join('');
  expect(messages).not.toContain('test-secret-key');
  expect(messages).not.toContain('private prompt');
  expect(messages).not.toContain('\n');
  expect(messages).not.toContain('\u001b');
});

test('does not delay or notify when fallback is disabled', async () => {
  vi.stubEnv('CALLITTO_FALLBACK_MODELS', '');
  generateContent.mockRejectedValue(
    new ApiError({ status: 429, message: 'quota' }),
  );
  const notice = vi.fn();
  await expect(enhancePrompt('refactor ini', notice)).rejects.toThrow(
    'All Gemini models failed.',
  );
  expect(generateContent).toHaveBeenCalledTimes(1);
  expect(notice).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
