// Shared Gemini caller for all paraplanner agents. Provider-abstracted: every
// agent narrates deterministic numbers through this one function, so swapping
// to Claude later is a single-file change. The IRON RULE lives with callers:
// prompts must only ask the LLM to narrate, never to compute.

// flash-lite has separate (and roomier) free-tier quota than flash — the
// funnel engine's extraction step already relies on it staying available.
const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface GeminiOptions {
  temperature?: number;
  /** total attempts (default 3) with linear backoff */
  attempts?: number;
}

async function callOnce<T>(
  prompt: string,
  responseSchema: unknown,
  apiKey: string,
  temperature: number,
): Promise<T> {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
        temperature,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`,
    );
  }
  const j = await res.json();
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(
      `Gemini empty response, finishReason=${
        j.candidates?.[0]?.finishReason ?? "n/a"
      }`,
    );
  }
  return JSON.parse(text) as T;
}

/** Structured-output Gemini call with retry/backoff; throws on final failure. */
export async function callGeminiJson<T>(
  prompt: string,
  responseSchema: unknown,
  apiKey: string,
  opts: GeminiOptions = {},
): Promise<T> {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  const attempts = opts.attempts ?? 3;
  const temperature = opts.temperature ?? 0.3;
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await callOnce<T>(prompt, responseSchema, apiKey, temperature);
    } catch (e) {
      lastErr = e;
      if (attempt < attempts - 1) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}
