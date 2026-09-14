import { ApiError, GoogleGenAI } from '@google/genai';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { enhancePrompt } from '../src/services/enhancer.js';

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
  vi.stubEnv('CALLITTO_API_KEY', '  test-secret-key  ');
  vi.stubEnv('CALLITTO_MODEL', undefined);
  generateContent.mockReset();
  generateContent.mockResolvedValue({
    text: '  ## Context\nRefactor @filename.\n',
    candidates: [{ finishReason: 'STOP' }],
  });
});

afterEach(() => vi.unstubAllEnvs());

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
    config: {
      systemInstruction:
        "You are an Expert AI Prompt Engineer and a Senior Software Architect. Translate the casual Indonesian user intent into a highly optimized, professional English prompt designed for an advanced AI coding assistant. Reorganize it using a framework: Context, Objective, Requirements, Expected Output, and Guidelines. Embed 'senior-level' instructions requiring clean code, modularity, and best practices. DO NOT answer the prompt; ONLY output the enhanced prompt. Keep placeholders like @filename intact.",
    },
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
  [401, 'Gemini access denied. Check your API key and permissions.'],
  [403, 'Gemini access denied. Check your API key and permissions.'],
  [404, 'Gemini model unavailable. Check CALLITTO_MODEL.'],
  [429, 'Gemini usage limit reached. Try again later.'],
  [500, 'Gemini request failed. Check your connection and try again.'],
])(
  'maps HTTP %i without exposing the provider message',
  async (status, message) => {
    generateContent.mockRejectedValue(
      new ApiError({
        status,
        message: 'test-secret-key private provider body',
      }),
    );
    await expect(enhancePrompt('refactor ini')).rejects.toThrow(
      new Error(message),
    );
    expect(generateContent).toHaveBeenCalledTimes(1);
  },
);

test.each(['connection failed', 'request timed out'])(
  'sanitizes network failure: %s',
  async (message) => {
    generateContent.mockRejectedValue(new Error(`${message}: test-secret-key`));
    await expect(enhancePrompt('refactor ini')).rejects.toThrow(
      new Error('Gemini request failed. Check your connection and try again.'),
    );
  },
);

test('sanitizes client initialization errors too', async () => {
  vi.mocked(GoogleGenAI).mockImplementationOnce(function () {
    throw new Error('test-secret-key');
  });
  await expect(enhancePrompt('refactor ini')).rejects.toThrow(
    new Error('Gemini request failed. Check your connection and try again.'),
  );
});
