import { getGoogleAccessToken, readGoogleServiceAccount } from "@/lib/google/sheets-client";

export type GeminiGenerateRequest = {
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  generationConfig?: Record<string, unknown>;
};

export type GeminiGenerateResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string; status?: string; code?: number };
};

const defaultModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

export function getGeminiModel(): string {
  return defaultModel;
}

export function getGeminiApiKey(): string {
  return process.env.GEMINI_API_KEY?.trim()
    || process.env.GOOGLE_API_KEY?.trim()
    || process.env.GOOGLE_AI_API_KEY?.trim()
    || process.env.GOOGLE_GEMINI_API_KEY?.trim()
    || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()
    || process.env.GEMINI_KEY?.trim()
    || "";
}

export function readGeminiVertexProjectId(): string | null {
  const explicit = process.env.GEMINI_VERTEX_PROJECT?.trim();
  if (explicit) return explicit;

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!serviceAccountJson) return null;

  try {
    return (JSON.parse(serviceAccountJson) as { project_id?: string }).project_id?.trim() || null;
  } catch {
    return null;
  }
}

export function getGeminiVertexLocation(): string {
  return process.env.GEMINI_VERTEX_LOCATION?.trim() || "europe-west1";
}

function geminiProviderMode(): "vertex" | "ai-studio" | "auto" {
  const mode = process.env.GEMINI_PROVIDER?.trim().toLowerCase();
  if (mode === "vertex") return "vertex";
  if (mode === "ai-studio" || mode === "aistudio" || mode === "studio") return "ai-studio";
  return "auto";
}

export function canUseGeminiVertex(): boolean {
  return Boolean(readGeminiVertexProjectId() && readGoogleServiceAccount());
}

function isGeoBlockedError(status: number, body: string): boolean {
  return status === 400 && /location is not supported|FAILED_PRECONDITION/i.test(body);
}

export function formatGeminiError(status: number, body: string): Error {
  if (isGeoBlockedError(status, body)) {
    return new Error(
      "Gemini AI Studio недоступен из региона сервера (RU). "
      + "Включите Vertex AI API в Google Cloud и используйте service account "
      + "(GEMINI_PROVIDER=vertex или оставьте auto — подхватит GOOGLE_SERVICE_ACCOUNT_JSON). "
      + "Либо задайте GEMINI_API_BASE_URL на прокси в EU/US."
    );
  }

  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    const message = parsed.error?.message?.trim();
    if (message) return new Error(`Gemini вернул ошибку ${status}: ${message}`);
  } catch {
    // Keep raw body fallback below.
  }

  return new Error(`Gemini вернул ошибку ${status}: ${body.slice(0, 500)}`);
}

export function extractGeminiText(payload: GeminiGenerateResponse): string {
  return payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
}

async function callGeminiViaVertex(model: string, body: GeminiGenerateRequest): Promise<GeminiGenerateResponse> {
  const projectId = readGeminiVertexProjectId();
  if (!projectId || !readGoogleServiceAccount()) {
    throw new Error(
      "Vertex Gemini не настроен: нужны GOOGLE_SERVICE_ACCOUNT_JSON (с project_id) "
      + "и роль Vertex AI User, либо GEMINI_VERTEX_PROJECT."
    );
  }

  const location = getGeminiVertexLocation();
  const accessToken = await getGoogleAccessToken("https://www.googleapis.com/auth/cloud-platform");
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw formatGeminiError(response.status, responseText);
  }

  return JSON.parse(responseText) as GeminiGenerateResponse;
}

async function callGeminiViaAiStudio(model: string, body: GeminiGenerateRequest): Promise<GeminiGenerateResponse> {
  const key = getGeminiApiKey();
  if (!key) {
    throw new Error("Gemini API key не найден. Добавьте GEMINI_API_KEY в .env.local.");
  }

  const baseUrl = process.env.GEMINI_API_BASE_URL?.trim().replace(/\/$/, "")
    || "https://generativelanguage.googleapis.com/v1beta";
  const url = `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw formatGeminiError(response.status, responseText);
  }

  return JSON.parse(responseText) as GeminiGenerateResponse;
}

export async function callGeminiGenerateContent(
  body: GeminiGenerateRequest,
  model = getGeminiModel()
): Promise<GeminiGenerateResponse> {
  const mode = geminiProviderMode();

  if (mode === "vertex") {
    return callGeminiViaVertex(model, body);
  }

  if (mode === "ai-studio") {
    return callGeminiViaAiStudio(model, body);
  }

  // auto: AI Studio first, Vertex fallback on geo block
  try {
    return await callGeminiViaAiStudio(model, body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const geoBlocked = /location is not supported|FAILED_PRECONDITION|недоступен из региона/i.test(message);
    if (geoBlocked && canUseGeminiVertex()) {
      return callGeminiViaVertex(model, body);
    }
    throw error;
  }
}
