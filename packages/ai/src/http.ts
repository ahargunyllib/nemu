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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);

  try {
    const response = await fetchImplementation(url, { ...init, signal: controller.signal });
    const responseText = await readBoundedText(
      response,
      options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
    );

    if (!response.ok) {
      throw new Error(`Provider request failed with HTTP ${response.status}`);
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
