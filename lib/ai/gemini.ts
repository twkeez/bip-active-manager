import { getGeminiConfig } from "@/lib/env";

type GeminiTextPart = { text: string };
type GeminiInlineDataPart = { inlineData: { mimeType: string; data: string } };
type GeminiPart = GeminiTextPart | GeminiInlineDataPart;

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
};

type GeminiModelListResponse = {
  models?: Array<{
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
};

function normalizeModelName(model: string) {
  const trimmed = model.trim();
  if (!trimmed) return "gemini-1.5-flash";
  return trimmed.startsWith("models/") ? trimmed.slice("models/".length) : trimmed;
}

async function callGeminiGenerateContent(
  apiKey: string,
  model: string,
  parts: GeminiPart[],
  options?: { maxOutputTokens?: number; temperature?: number },
) {
  const normalized = normalizeModelName(model);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalized)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts,
        },
      ],
      generationConfig: {
        temperature: options?.temperature ?? 0.4,
        maxOutputTokens: options?.maxOutputTokens ?? 700,
      },
    }),
    cache: "no-store",
  });
  return { response, normalizedModel: normalized };
}

function isTextGeminiModel(name: string) {
  const lower = name.toLowerCase();
  if (/-tts\b|preview-tts|text-to-speech|audio/i.test(lower)) return false;
  if (/embedding|embed-/i.test(lower)) return false;
  if (/imagen|image-generation|veo|aqa/i.test(lower)) return false;
  if (/gemini-(1\.5|2\.[05])-(flash|pro)/i.test(lower)) return true;
  return /^gemini-\d/i.test(lower) && !/preview/i.test(lower);
}

function textModelPriority(name: string) {
  const lower = name.toLowerCase();
  if (lower === "gemini-2.5-flash") return 0;
  if (lower === "gemini-2.0-flash") return 1;
  if (/gemini-2\.5-flash/.test(lower)) return 2;
  if (/gemini-2\.0-flash/.test(lower)) return 3;
  if (/gemini-1\.5-flash/.test(lower)) return 4;
  if (/gemini-1\.5-pro/.test(lower)) return 5;
  return 99;
}

async function listGenerateContentModels(apiKey: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return [];
  const payload = (await response.json()) as GeminiModelListResponse;
  return (payload.models ?? [])
    .filter((model) =>
      (model.supportedGenerationMethods ?? []).includes("generateContent"),
    )
    .map((model) => (model.name ?? "").replace(/^models\//, ""))
    .filter(Boolean)
    .filter(isTextGeminiModel);
}

async function pickFallbackModels(apiKey: string, exclude: string) {
  const availableModels = await listGenerateContentModels(apiKey);
  return availableModels
    .filter((name) => name !== exclude)
    .sort((a, b) => textModelPriority(a) - textModelPriority(b));
}

function isModalityMismatchError(status: number, body: string) {
  return (
    status === 400 &&
    body.includes("response modalities") &&
    body.includes("TEXT")
  );
}

function isRetryableGeminiStatus(status: number) {
  return status === 429 || status === 503 || status === 502;
}

async function readGeminiText(response: Response) {
  const payload = (await response.json()) as GeminiResponse;
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => ("text" in part ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }
  return text;
}

export async function generateGeminiContent(
  parts: GeminiPart[],
  options?: { maxOutputTokens?: number; temperature?: number },
) {
  const { apiKey, model } = getGeminiConfig();
  const triedModels = new Set<string>();
  const primary = normalizeModelName(model);
  const queue = isTextGeminiModel(primary)
    ? [primary]
    : ["gemini-2.5-flash", "gemini-1.5-flash"];

  const fallbacks = await pickFallbackModels(apiKey, queue[0]!);
  for (const fallback of fallbacks) {
    if (!queue.includes(fallback)) queue.push(fallback);
  }

  let lastError = "Gemini request failed.";

  for (const candidateModel of queue) {
    if (triedModels.has(candidateModel)) continue;
    triedModels.add(candidateModel);

    let { response, normalizedModel } = await callGeminiGenerateContent(
      apiKey,
      candidateModel,
      parts,
      options,
    );

    if (response.status === 404) {
      continue;
    }

    if (response.ok) {
      return readGeminiText(response);
    }

    const body = await response.text();
    lastError = `Gemini API failed (${response.status}) on model ${normalizedModel}: ${body}`;

    if (isModalityMismatchError(response.status, body)) {
      continue;
    }

    if (!isRetryableGeminiStatus(response.status)) {
      break;
    }
  }

  throw new Error(lastError);
}

export async function generateGeminiText(prompt: string) {
  return generateGeminiContent([{ text: prompt }]);
}
