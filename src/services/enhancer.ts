import { ApiError, FinishReason, GoogleGenAI } from '@google/genai';
import { getApiKey, getModels } from '../utils/config.js';

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

type ModelFailure = {
  message: string;
  retryable: boolean;
  backoff?: boolean;
};

function classifyRequestError(error: unknown): ModelFailure {
  if (error instanceof ApiError) {
    const status = error.status;
    const backoff =
      status === 408 || status === 429 || (status >= 500 && status < 600);
    let message = `Gemini request rejected (HTTP ${status}). Check your request and configuration.`;
    if (status === 401 || status === 403) {
      message = `Gemini access denied (HTTP ${status}). Check your API key and permissions.`;
    } else if (status === 404) {
      message =
        'Gemini model unavailable (HTTP 404). Check CALLITTO_MODEL and CALLITTO_FALLBACK_MODELS.';
    } else if (status === 429) {
      message = 'Gemini usage limit reached (HTTP 429). Try again later.';
    } else if (backoff) {
      message = `Gemini request temporarily failed (HTTP ${status}). Try again later.`;
    }
    return { message, retryable: status === 404 || backoff, backoff };
  }

  return {
    message: 'Gemini request failed. Check your connection and try again.',
    retryable: true,
  };
}

async function generateWithModel(
  ai: GoogleGenAI,
  model: string,
  rawPrompt: string,
): Promise<string | ModelFailure> {
  try {
    const response = await ai.models.generateContent({
      model,
      contents: rawPrompt,
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });

    const finishReason = response.candidates?.[0]?.finishReason;
    if (
      response.promptFeedback?.blockReason ||
      (finishReason &&
        [
          FinishReason.SAFETY,
          FinishReason.RECITATION,
          FinishReason.BLOCKLIST,
          FinishReason.PROHIBITED_CONTENT,
          FinishReason.SPII,
          FinishReason.IMAGE_SAFETY,
          FinishReason.IMAGE_PROHIBITED_CONTENT,
          FinishReason.IMAGE_RECITATION,
        ].includes(finishReason))
    ) {
      return {
        message: 'Gemini returned a blocked response.',
        retryable: false,
      };
    }
    if (finishReason && finishReason !== FinishReason.STOP) {
      return {
        message: 'Gemini returned an incomplete response.',
        retryable: true,
      };
    }

    const text = response.text?.trim();
    return (
      text || { message: 'Gemini returned an empty response.', retryable: true }
    );
  } catch (error) {
    // provider errors can contain credentials; retain only safe classifications.
    return classifyRequestError(error);
  }
}

export async function enhancePrompt(
  rawPrompt: string,
  onFallback?: (message: string) => void,
): Promise<string> {
  const apiKey = getApiKey();
  const models = getModels();
  const modelLabel = (model: string) =>
    model
      .replaceAll(apiKey, 'REDACTED')
      .replace(/[^a-zA-Z0-9._/-]/g, '?')
      .slice(0, 120);
  let ai: GoogleGenAI;
  try {
    ai = new GoogleGenAI({
      apiKey,
      enterprise: false,
      httpOptions: {
        timeout: 60_000,
        retryOptions: { attempts: 1 },
      },
    });
  } catch {
    // do not attach the provider error: it may contain credentials.
    throw new Error(
      'Gemini request failed. Check your connection and try again.',
    );
  }

  const failures: string[] = [];
  let delay = 1_000;
  for (const [index, model] of models.entries()) {
    const result = await generateWithModel(ai, model, rawPrompt);
    if (typeof result === 'string') return result;

    failures.push(`${modelLabel(model)}: ${result.message}`);
    if (!result.retryable) {
      throw new Error(`Gemini execution stopped. ${failures.join(' ')}`);
    }

    const nextModel = models[index + 1];
    if (nextModel) {
      onFallback?.(
        `${modelLabel(model)}: ${result.message} Trying ${modelLabel(nextModel)} next.`,
      );
      if (result.backoff) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = 2_000;
      }
    }
  }

  throw new Error(`All Gemini models failed. ${failures.join(' ')}`);
}
