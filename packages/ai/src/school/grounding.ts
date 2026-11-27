import { z } from "zod";

import type { GroundedAnswer, SourceCitation } from "@nemu/contracts/school";

import { retrieveKnowledge, type KnowledgeChunk } from "../knowledge.js";
import type { JsonCall } from "./llm.js";
import { mentionsSecret, NOT_IN_GUIDE_SENTENCE } from "./safety.js";

/**
 * F3-04/F3-07: rules and procedures come only from the school's active knowledge. The model must
 * quote the chunk it relies on, and code checks every quote against the chunk text; an answer with
 * no verifiable quote becomes "Belum ada di panduan sekolah." (AI_TECHNICAL_PRD §4.3).
 */

export function normalizeForQuote(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/gu, "")
    .toLocaleLowerCase("id-ID")
    .replace(/[“”"'‘’]/gu, "")
    .replace(/[^\p{L}\p{N}%.,:;/()-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

/** A quote counts only if it is a substring of the chunk (after normalizing) and not trivially short. */
export function quoteIsInChunk(quote: string, chunk: Pick<KnowledgeChunk, "text">): boolean {
  const normalizedQuote = normalizeForQuote(quote);
  if (normalizedQuote.split(" ").length < 3) return false;
  return normalizeForQuote(chunk.text).includes(normalizedQuote);
}

export function toCitation(chunk: KnowledgeChunk, quote: string): SourceCitation {
  return {
    chunkId: chunk.id,
    docId: chunk.docId,
    title: chunk.title,
    page: chunk.page ?? null,
    article: chunk.article ?? null,
    quote,
  };
}

const modelAnswerSchema = z.object({
  status: z.enum(["answered", "not_in_guide"]),
  answer: z.string(),
  citations: z.array(z.object({ chunk_id: z.string(), quote: z.string() })),
});

const MODEL_ANSWER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "answer", "citations"],
  properties: {
    status: { type: "string", enum: ["answered", "not_in_guide"] },
    answer: { type: "string" },
    citations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["chunk_id", "quote"],
        properties: { chunk_id: { type: "string" }, quote: { type: "string" } },
      },
    },
  },
} as const;

const GROUNDED_INSTRUCTIONS = `Kamu Nemu, pendamping administrasi untuk guru. Jawab HANYA dari potongan panduan sekolah yang diberikan.
- Jika potongan tidak menjawab pertanyaan secara langsung, status "not_in_guide". Jangan memakai pengetahuan umum untuk aturan atau prosedur.
- Jawaban: satu atau dua kalimat pendek (maks. 30 kata), bahasa awam, sapa dengan "Ibu"/"Bapak" bila perlu. Jangan pernah memakai kata "salah".
- Sebutkan setiap ketentuan dari poin yang menjawab: angka, batas waktu, dan keterangan yang harus ditulis, dengan kata-kata panduan.
- Untuk setiap fakta, kutip kalimat persis dari potongan (quote) beserta chunk_id-nya. Kutipan harus disalin kata per kata.
- Jangan pernah meminta kata sandi atau kode apa pun.`;

export type AnswerGroundedInput = {
  question: string;
  chunks: readonly KnowledgeChunk[];
  /** Whole-workspace context when it is small; otherwise the top retrieved chunks. */
  maxChunks?: number;
};

export async function answerGrounded(
  deps: { llm: JsonCall },
  input: AnswerGroundedInput,
): Promise<GroundedAnswer> {
  const active = input.chunks.filter((chunk) => chunk.active);
  const limit = input.maxChunks ?? 8;
  const context =
    active.length <= limit ? active : retrieveKnowledge(active, input.question, limit);
  if (!context.length) return { status: "not_in_guide", answer: NOT_IN_GUIDE_SENTENCE };

  const response = await deps.llm({
    instructions: GROUNDED_INSTRUCTIONS,
    content: [
      {
        type: "text",
        text: JSON.stringify({
          pertanyaan: input.question,
          potongan_panduan: context.map((chunk) => ({
            chunk_id: chunk.id,
            judul: chunk.title,
            halaman: chunk.page ?? null,
            poin: chunk.article ?? null,
            teks: chunk.text,
          })),
        }),
      },
    ],
    schemaName: "grounded_answer",
    schema: MODEL_ANSWER_JSON_SCHEMA,
    parse: (value) => modelAnswerSchema.parse(value),
    maxOutputTokens: 600,
  });

  return verifyGroundedAnswer(response, context);
}

/** Pure: keeps only citations whose quote is really in the cited active chunk. */
export function verifyGroundedAnswer(
  response: z.infer<typeof modelAnswerSchema>,
  context: readonly KnowledgeChunk[],
): GroundedAnswer {
  if (response.status !== "answered" || mentionsSecret(response.answer)) {
    return { status: "not_in_guide", answer: NOT_IN_GUIDE_SENTENCE };
  }
  const byId = new Map(context.map((chunk) => [chunk.id, chunk]));
  const citations = response.citations.flatMap((citation) => {
    const chunk = byId.get(citation.chunk_id);
    return chunk && chunk.active && quoteIsInChunk(citation.quote, chunk)
      ? [toCitation(chunk, citation.quote)]
      : [];
  });
  if (!citations.length || !response.answer.trim()) {
    return { status: "not_in_guide", answer: NOT_IN_GUIDE_SENTENCE };
  }
  return { status: "answered", answer: response.answer.trim(), citations };
}
