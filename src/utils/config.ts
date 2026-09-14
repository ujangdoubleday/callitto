export function getApiKey(): string {
  const apiKey = process.env.CALLITTO_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('Set CALLITTO_API_KEY before running Callitto.');
  }

  return apiKey;
}
