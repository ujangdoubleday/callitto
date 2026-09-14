import { ApiError, FinishReason, GoogleGenAI } from '@google/genai';
import { getApiKey, getModel } from '../utils/config.js';

export const SYSTEM_INSTRUCTION =
  "You are an Expert AI Prompt Engineer and a Senior Software Architect. Translate the casual Indonesian user intent into a highly optimized, professional English prompt designed for an advanced AI coding assistant. Reorganize it using a framework: Context, Objective, Requirements, Expected Output, and Guidelines. Embed 'senior-level' instructions requiring clean code, modularity, and best practices. DO NOT answer the prompt; ONLY output the enhanced prompt. Keep placeholders like @filename intact.";

export async function enhancePrompt(rawPrompt: string): Promise<string> {
  const apiKey = getApiKey();
  let response;

  try {
    const ai = new GoogleGenAI({
      apiKey,
      enterprise: false,
      httpOptions: {
        timeout: 60_000,
        retryOptions: { attempts: 1 },
      },
    });

    response = await ai.models.generateContent({
      model: getModel(),
      contents: rawPrompt,
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });
  } catch (error) {
    /* eslint-disable preserve-caught-error -- Provider errors may contain credentials. */
    if (error instanceof ApiError) {
      switch (error.status) {
        case 401:
        case 403:
          throw new Error(
            'Gemini access denied. Check your API key and permissions.',
          );
        case 404:
          throw new Error('Gemini model unavailable. Check CALLITTO_MODEL.');
        case 429:
          throw new Error('Gemini usage limit reached. Try again later.');
      }
    }
    throw new Error(
      'Gemini request failed. Check your connection and try again.',
    );
    /* eslint-enable preserve-caught-error */
  }

  const finishReason = response.candidates?.[0]?.finishReason;
  if (
    response.promptFeedback?.blockReason ||
    (finishReason && finishReason !== FinishReason.STOP)
  ) {
    throw new Error('Gemini returned a blocked or incomplete response.');
  }

  const text = response.text?.trim();
  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  return text;
}
