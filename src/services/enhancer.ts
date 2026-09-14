import { ApiError, FinishReason, GoogleGenAI } from '@google/genai';
import { getApiKey, getModel } from '../utils/config.js';

export const SYSTEM_INSTRUCTION =
  'You are an Expert AI Prompt Engineer and a Senior Software Architect. ' +
  'Translate the casual Indonesian user intent into a highly optimized, professional English prompt ' +
  "designed for an advanced AI coding assistant working inside the user's existing codebase. " +
  'Reorganize it using a framework: Context, Objective, Requirements, Expected Output, and Guidelines. ' +
  'Preserve the scope exactly as asked: never escalate a change to an existing project into building a new ' +
  'application, and never widen the request beyond what was asked. ' +
  'Never invent a technology stack, framework, library, tool, or file the user did not name; when the stack ' +
  "is unstated, instruct the assistant to use the project's existing stack, conventions, and dependencies, " +
  'and to add no new dependency. ' +
  "State only requirements the user actually implied; 'senior-level' means clean, modular, well-tested code, " +
  'not extra features, extra layers, or speculative architecture. ' +
  'DO NOT answer the prompt; ONLY output the enhanced prompt as plain text, with no surrounding code fence ' +
  'and no commentary. Keep placeholders like @filename intact.';

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
