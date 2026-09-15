export function getApiKey(): string {
  const apiKey = process.env.CALLITTO_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('Set CALLITTO_API_KEY before running Callitto.');
  }

  return apiKey;
}

export function getModel(): string {
  return process.env.CALLITTO_MODEL?.trim() || 'gemini-3.8-flash';
}

export function getModels(): string[] {
  const fallbacks = (
    process.env.CALLITTO_FALLBACK_MODELS ??
    'gemini-2.5-flash,gemini-2.5-flash-lite'
  )
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);

  return [...new Set([getModel(), ...fallbacks])];
}
