const DEFAULT_MAX_RESPONSE_BYTES = 1_000_000;

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel("Provider response exceeded the configured size limit");
      throw new Error("Provider response is too large");
    }

    parts.push(decoder.decode(value, { stream: true }));
  }

  parts.push(decoder.decode());
  return parts.join("");
}

// OpenRouter reports why a request failed as `{ error: { message } }`; keep that
// reason so the Chat Log and Worker logs say more than the status code.
function providerErrorDetail(responseText: string): string | undefined {
  try {
    const body = JSON.parse(responseText) as { error?: { message?: unknown } | string };
    const message = typeof body.error === "string" ? body.error : body.error?.message;
    if (typeof message === "string" && message.trim()) return message.trim();
  } catch {
    // Not JSON; fall back to the raw text below.
  }
  return responseText.trim().slice(0, 300) || undefined;
}

export async function fetchJson(
  url: string,
  init: RequestInit,
  options: {
    fetchImplementation?: typeof fetch;
    maxResponseBytes?: number;
    timeoutMs?: number;
  } = {},
): Promise<unknown> {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;
    let responseText: string;
    try {
      response = await fetchImplementation(url, { ...init, signal: controller.signal });
      responseText = await readBoundedText(
        response,
        options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
      );
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`Provider request timed out after ${timeoutMs}ms`, { cause: error });
      }
      throw error;
    }

    if (!response.ok) {
      const detail = providerErrorDetail(responseText);
      throw new Error(
        `Provider request failed with HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
      );
    }

    try {
      return JSON.parse(responseText) as unknown;
    } catch {
      throw new Error("Provider returned invalid JSON");
    }
  } finally {
    clearTimeout(timeout);
  }
}
