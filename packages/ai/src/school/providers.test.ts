import assert from "node:assert/strict";
import test from "node:test";

import { createOpenRouterJsonCaller } from "./llm.js";
import { isDeniedActionName, mentionsSecret, sentenceIssues } from "./safety.js";
import {
  createOpenRouterSynthesizer,
  createOpenRouterTranscriber,
  estimateWordTimings,
} from "./speech.js";

function recordingFetch(response: Response) {
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetchImplementation = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(url),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    return response.clone();
  }) as typeof fetch;
  return { requests, fetchImplementation };
}

test("structured calls deny data collection, require the schema, and parse the output", async () => {
  const { requests, fetchImplementation } = recordingFetch(
    new Response(JSON.stringify({ output_text: JSON.stringify({ ok: true }) }), { status: 200 }),
  );
  const call = createOpenRouterJsonCaller({
    apiKey: "k",
    model: "anthropic/claude-haiku-5.5",
    zdr: true,
    fetchImplementation,
  });
  const result = await call({
    instructions: "x",
    content: [
      { type: "text", text: "hi" },
      { type: "image", dataUrl: "data:image/jpeg;base64,AA" },
    ],
    schemaName: "t",
    schema: { type: "object" },
    parse: (value) => value as { ok: boolean },
  });
  assert.deepEqual(result, { ok: true });
  const body = requests[0]!.body;
  assert.equal(requests[0]!.url, "https://openrouter.ai/api/v1/responses");
  assert.deepEqual(body.provider, { require_parameters: true, data_collection: "deny", zdr: true });
  assert.equal((body.text as { format: { strict: boolean } }).format.strict, true);
  assert.equal("reasoning" in body, false);
});

test("transcription sends Indonesian audio as base64 JSON with the school glossary", async () => {
  const { requests, fetchImplementation } = recordingFetch(
    new Response(JSON.stringify({ text: " masukkan nilai UTS " })),
  );
  const transcribe = createOpenRouterTranscriber({
    apiKey: "k",
    model: "openai/whisper-large-v3-turbo",
    fetchImplementation,
  });
  assert.deepEqual(await transcribe({ base64: "UklG", format: "wav" }), {
    text: "masukkan nilai UTS",
  });
  const body = requests[0]!.body;
  assert.equal(requests[0]!.url, "https://openrouter.ai/api/v1/audio/transcriptions");
  assert.deepEqual(body.input_audio, { data: "UklG", format: "wav" });
  assert.equal(body.language, "id");
  assert.match(String(body.prompt), /AlurSekolah/u);
});

function sequenceFetch(...responses: Response[]) {
  let calls = 0;
  const fetchImplementation = (async () => {
    const response = responses[Math.min(calls, responses.length - 1)]!;
    calls += 1;
    return response.clone();
  }) as typeof fetch;
  return { fetchImplementation, calls: () => calls };
}

test("transcription retries once when the provider is busy (HTTP 429)", async () => {
  const busy = new Response(JSON.stringify({ error: { message: "Rate limited" } }), {
    status: 429,
  });
  const ok = new Response(JSON.stringify({ text: "pelan" }));
  const once = sequenceFetch(busy, ok);
  const transcribe = createOpenRouterTranscriber({
    apiKey: "k",
    model: "microsoft/mai-transcribe-2",
    fetchImplementation: once.fetchImplementation,
    retryDelayMs: 0,
  });
  assert.deepEqual(await transcribe({ base64: "UklG", format: "wav" }), { text: "pelan" });
  assert.equal(once.calls(), 2);

  const twice = sequenceFetch(busy, busy, ok);
  const giveUp = createOpenRouterTranscriber({
    apiKey: "k",
    model: "microsoft/mai-transcribe-2",
    fetchImplementation: twice.fetchImplementation,
    retryDelayMs: 0,
  });
  await assert.rejects(giveUp({ base64: "UklG", format: "wav" }), /HTTP 429/u);
  assert.equal(twice.calls(), 2);
});

test("transcription doesn't retry a request the provider refused for good", async () => {
  const refused = sequenceFetch(new Response("{}", { status: 400 }));
  const transcribe = createOpenRouterTranscriber({
    apiKey: "k",
    model: "m",
    fetchImplementation: refused.fetchImplementation,
    retryDelayMs: 0,
  });
  await assert.rejects(transcribe({ base64: "UklG", format: "wav" }), /HTTP 400/u);
  assert.equal(refused.calls(), 1);
});

test("speech returns the exact text with word timings for the highlight", async () => {
  const { requests, fetchImplementation } = recordingFetch(
    new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/mpeg" } }),
  );
  const synthesize = createOpenRouterSynthesizer({
    apiKey: "k",
    model: "m",
    voice: "v",
    fetchImplementation,
  });
  const result = await synthesize("Silakan Ibu tekan Simpan.");
  assert.equal(requests[0]!.body.speed, 0.85);
  assert.equal(result.text, "Silakan Ibu tekan Simpan.");
  assert.deepEqual(
    result.words.map((word) => word.text),
    ["Silakan", "Ibu", "tekan", "Simpan."],
  );
  assert.equal(result.timing, "estimated");
  assert.equal(result.audioBase64, "AQID");
});

test("word timings are monotonic and pause after punctuation", () => {
  const { words, durationMs } = estimateWordTimings(
    "Bukan kesalahan Ibu. Yang bisa membantu: Pak Ahmad.",
  );
  for (let index = 1; index < words.length; index += 1) {
    assert.ok(words[index]!.offsetMs >= words[index - 1]!.offsetMs + words[index - 1]!.durationMs);
  }
  const ibu = words[2]!;
  assert.equal(words[3]!.offsetMs - (ibu.offsetMs + ibu.durationMs), 500);
  assert.ok(durationMs > 0);
});

test("irreversible buttons are denied by accessible name", () => {
  for (const name of ["Simpan", "  KIRIM ", "Ajukan Izin", "Hapus data", "Submit", "OK", "Ya"]) {
    assert.ok(isDeniedActionName(name), name);
  }
  for (const name of ["Tampilkan", "Rekap Nilai", "Kelas", "Yayasan", null]) {
    assert.ok(!isDeniedActionName(name), String(name));
  }
});

test("sentences that say 'salah', ask for a secret, or run long are flagged", () => {
  assert.deepEqual(sentenceIssues("Nilai Budi salah."), ["says_salah"]);
  assert.ok(mentionsSecret("Masukkan kode OTP Ibu"));
  assert.ok(mentionsSecret("kata sandi"));
  assert.ok(!mentionsSecret("Kode kelas 4B"));
  assert.deepEqual(sentenceIssues("Bukan kesalahan Ibu. Yang bisa membantu: Pak Ahmad."), []);
});
