import {
  type Calculation,
  type Citation,
  type NemuAction,
  type NemuRequest,
  type NemuResponse,
  type ProcessContext,
  nemuRequestSchema,
  nemuResponseSchema,
} from "@nemu/contracts";

import type { AnswerGenerator, NemuUserProfile } from "./openai.js";
import type { JevDecider, JevDecision } from "./jev.js";
import { retrieveKnowledge, type KnowledgeChunk, type RankedKnowledgeChunk } from "./knowledge.js";
import {
  calculateAccommodationLumpSum,
  calculateAccountabilityDeadline,
  calculateRemainingWorkingDays,
  findMissingDocuments,
  lookupSbm,
  type SbmRow,
} from "./tools.js";

export { createJevDecider } from "./jev.js";
export type { JevDecider, JevDecision, JevDecisionInput } from "./jev.js";
export { retrieveKnowledge } from "./knowledge.js";
export type { KnowledgeChunk, RankedKnowledgeChunk } from "./knowledge.js";
export { createOpenRouterAnswerGenerator } from "./openai.js";
export type {
  AnswerGenerationInput,
  AnswerGenerator,
  GeneratedAnswer,
  NemuUserProfile,
} from "./openai.js";
export {
  calculateAccommodationLumpSum,
  calculateAccountabilityDeadline,
  calculateDailyAllowance,
  calculateRemainingWorkingDays,
  checkHotelRate,
  findMissingDocuments,
  lookupSbm,
} from "./tools.js";
export type { HotelRateCheck, SbmComponent, SbmRow } from "./tools.js";

export type NemuContext = {
  userProfile: NemuUserProfile;
  processContext?: ProcessContext;
  knowledgeChunks: readonly KnowledgeChunk[];
  sbmRows: readonly SbmRow[];
  holidays: readonly string[];
  requiredDocuments: readonly string[];
  currentDate: string;
  jevDecider: JevDecider;
  answerGenerator: AnswerGenerator;
  thresholds?: {
    domain?: number;
    injection?: number;
    click?: number;
  };
};

type ToolResults = {
  calculations: Calculation[];
  missingDocuments: string[];
  clarification?: string;
};

const CONFIRM_ACTION_PATTERN = /(?:^|\b)(kirim|submit)(?:\b|$)/iu;
const PROHIBITED_ACTION_PATTERN = /(?:^|\b)(setuju|approve|hapus|delete|bayar|pay)(?:\b|$)/iu;

function durationSince(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function fixedResponse(
  status: "clarify" | "refuse" | "error",
  ringkas: string,
  detail: string,
  startedAt: number,
): NemuResponse {
  return nemuResponseSchema.parse({
    status,
    answer: { ringkas, detail },
    citations: [],
    calc: [],
    actions: [],
    warnings: [],
    timing: { total_ms: durationSince(startedAt) },
  });
}

function fallbackDecision(): JevDecision {
  return {
    intent: "unclear",
    intentConfidence: 0,
    withinDomainProbability: 1,
    injectionProbability: 0,
    requiredTool: "none",
    actionLevel: "arahkan",
    actionConfidence: 0,
    target: null,
    targetConfidence: 0,
  };
}

function runDeterministicTools(
  decision: JevDecision,
  context: NemuContext,
  processContext: ProcessContext | undefined,
): ToolResults {
  const results: ToolResults = { calculations: [], missingDocuments: [] };

  if (decision.requiredTool === "lookup_sbm_and_accommodation") {
    const province = processContext?.destination_province;
    const nights = processContext?.nights;

    if (!province) {
      results.clarification = "Provinsi tujuan perjalanan dinasnya apa?";
      return results;
    }
    if (nights === undefined) {
      results.clarification = "Berapa malam kamu menginap di tempat tujuan?";
      return results;
    }

    const sbmRow = lookupSbm(context.sbmRows, province, "hotel", context.userProfile.grade);
    if (!sbmRow) {
      results.clarification = "Golongan atau tarif SBM untuk tujuan tersebut belum tersedia.";
      return results;
    }

    results.calculations.push({
      fungsi: "lookup_sbm",
      input: { provinsi: province, komponen: "hotel", golongan: context.userProfile.grade },
      hasil: sbmRow.value,
      sumber: sbmRow.source,
    });
    const dailyAllowanceRow = lookupSbm(
      context.sbmRows,
      province,
      "uang_harian",
      context.userProfile.grade,
    );
    if (dailyAllowanceRow) {
      const days = nights !== undefined ? nights + 1 : 3;
      results.calculations.push({
        fungsi: "uang_harian",
        input: { provinsi: province, tarif: dailyAllowanceRow.value, hari: days },
        hasil: dailyAllowanceRow.value * days,
        sumber: dailyAllowanceRow.source,
      });
    }

    results.calculations.push({
      ...calculateAccommodationLumpSum(sbmRow.value, nights),
      sumber: sbmRow.source,
    });
  }

  if (decision.requiredTool === "accountability_deadline") {
    const returnDate = processContext?.return_date;
    if (!returnDate) {
      results.clarification = "Tanggal kembali perjalanan dinasnya kapan?";
      return results;
    }

    const deadline = calculateAccountabilityDeadline(returnDate, context.holidays);
    results.calculations.push(deadline);
    if (typeof deadline.hasil === "string") {
      results.calculations.push(
        calculateRemainingWorkingDays(context.currentDate, deadline.hasil, context.holidays),
      );
    }
    results.missingDocuments = findMissingDocuments(
      context.requiredDocuments,
      processContext?.uploaded_documents ?? [],
    );
  }

  return results;
}

function citationsFromEvidence(
  citationIds: readonly string[],
  evidence: readonly RankedKnowledgeChunk[],
): Citation[] {
  const evidenceById = new Map(evidence.map((chunk) => [chunk.id, chunk]));
  const citations: Citation[] = [];
  const seenDocumentLocations = new Set<string>();

  for (const citationId of citationIds) {
    const chunk = evidenceById.get(citationId);
    if (!chunk) {
      throw new Error(`Generated answer referenced unavailable citation: ${citationId}`);
    }

    const locationKey = `${chunk.docId}:${chunk.article ?? ""}:${chunk.page ?? ""}`;
    if (seenDocumentLocations.has(locationKey)) {
      continue;
    }
    seenDocumentLocations.add(locationKey);
    citations.push({
      doc_id: chunk.docId,
      judul: chunk.title,
      ...(chunk.article ? { pasal: chunk.article } : {}),
      ...(chunk.page ? { halaman: chunk.page } : {}),
    });
  }

  return citations;
}

function buildActions(
  decision: JevDecision,
  request: NemuRequest,
  clickThreshold: number,
  injectionDetected: boolean,
): NemuAction[] {
  if (injectionDetected || !decision.target || decision.actionLevel === "dilarang") {
    return [];
  }

  const target = request.elements.find(
    (element) => element.visible && element.nemu_id === decision.target,
  );
  if (!target) {
    return [];
  }

  const targetDescription = `${target.nemu_id} ${target.label}`;
  if (PROHIBITED_ACTION_PATTERN.test(targetDescription)) {
    return [];
  }

  if (CONFIRM_ACTION_PATTERN.test(targetDescription) || decision.actionLevel === "konfirmasi") {
    return [
      {
        type: "confirm",
        target: target.nemu_id,
        level: "konfirmasi",
        label: "Kamu yang melakukan",
      },
    ];
  }

  const mayClick =
    !injectionDetected &&
    decision.actionLevel === "jalan_sendiri" &&
    decision.actionConfidence >= clickThreshold &&
    decision.targetConfidence >= clickThreshold;

  if (mayClick) {
    return [
      {
        type: "click",
        target: target.nemu_id,
        level: "jalan_sendiri",
        label: "Buka ini",
      },
    ];
  }

  return [
    {
      type: "highlight",
      target: target.nemu_id,
      level: "arahkan",
      label: "Periksa ini",
    },
  ];
}

function parseRupiahAmount(rawAmount: string): number | undefined {
  const normalized = rawAmount.replace(/\s/gu, "").split(",", 1)[0]?.replace(/\./gu, "");
  if (!normalized || !/^\d+$/u.test(normalized)) {
    return undefined;
  }
  const amount = Number(normalized);
  return Number.isSafeInteger(amount) ? amount : undefined;
}

function collectTrustedNumbers(
  calculations: readonly Calculation[],
  sbmRows?: readonly SbmRow[],
  prompt?: string,
  evidence?: readonly RankedKnowledgeChunk[],
): Set<number> {
  const trustedNumbers = new Set<number>();
  for (const calculation of calculations) {
    if (typeof calculation.hasil === "number") {
      trustedNumbers.add(calculation.hasil);
    }
    for (const value of Object.values(calculation.input)) {
      if (typeof value === "number") {
        trustedNumbers.add(value);
      }
    }
  }
  for (const row of sbmRows ?? []) {
    trustedNumbers.add(row.value);
  }
  if (prompt) {
    for (const match of prompt.matchAll(/Rp\s*([\d.]+(?:,\d{1,2})?)/giu)) {
      const amount = parseRupiahAmount(match[1] ?? "");
      if (amount !== undefined) {
        trustedNumbers.add(amount);
      }
    }
  }
  if (evidence) {
    for (const chunk of evidence) {
      for (const match of chunk.text.matchAll(/Rp\s*([\d.]+(?:,\d{1,2})?)/giu)) {
        const amount = parseRupiahAmount(match[1] ?? "");
        if (amount !== undefined) {
          trustedNumbers.add(amount);
        }
      }
    }
  }
  return trustedNumbers;
}

function validateGeneratedAnswer(
  generatedAnswer: Awaited<ReturnType<AnswerGenerator>>,
  calculations: readonly Calculation[],
  sbmRows?: readonly SbmRow[],
  prompt?: string,
  evidence?: readonly RankedKnowledgeChunk[],
): void {
  const answerText = `${generatedAnswer.ringkas} ${generatedAnswer.detail}`;
  const trustedNumbers = collectTrustedNumbers(calculations, sbmRows, prompt, evidence);

  for (const match of answerText.matchAll(/Rp\s*([\d.]+(?:,\d{1,2})?)/giu)) {
    const amount = parseRupiahAmount(match[1] ?? "");
    if (amount === undefined || !trustedNumbers.has(amount)) {
      throw new Error(`Generated answer contains an untrusted rupiah amount: ${match[0]}`);
    }
  }

  const questionCount = (answerText.match(/\?/gu) ?? []).length;
  if (questionCount > 1) {
    throw new Error("Generated answer asks more than one question");
  }
}

export async function runNemu(
  untrustedRequest: NemuRequest,
  context: NemuContext,
): Promise<NemuResponse> {
  const startedAt = performance.now();
  const request = nemuRequestSchema.parse(untrustedRequest);
  const processContext = context.processContext ?? request.process_context;
  const thresholds = {
    domain: context.thresholds?.domain ?? 0.5,
    injection: context.thresholds?.injection ?? 0.7,
    click: context.thresholds?.click ?? 0.8,
  };

  const jevStartedAt = performance.now();
  const jevPromise = context.jevDecider({
    prompt: request.prompt,
    url: request.url,
    elements: request.elements,
    processContext,
  });

  const retrievalStartedAt = performance.now();
  const retrievalPromise = Promise.resolve(
    retrieveKnowledge(context.knowledgeChunks, request.prompt, 5),
  );

  const [jevResult, initialEvidence] = await Promise.all([
    jevPromise
      .then((decision) => ({ decision, failed: false as const }))
      .catch(() => ({ decision: fallbackDecision(), failed: true as const })),
    retrievalPromise,
  ]);
  const jevDuration = durationSince(jevStartedAt);
  const retrievalDuration = durationSince(retrievalStartedAt);
  let evidence = initialEvidence;

  if (request.screenshot_crop && (!evidence.length || (evidence[0]?.score ?? 0) < 4)) {
    const intentSearchTerms = {
      start_travel_request: "mulai pengajuan surat tugas menu perjalanan dinas",
      accommodation_question: "penginapan hotel tidak menginap rumah saudara biaya",
      accountability_question: "pertanggungjawaban dokumen tenggat boarding pass",
      unsupported: "",
      unclear: "perjalanan dinas panduan aplikasi",
    }[jevResult.decision.intent];
    evidence = retrieveKnowledge(
      context.knowledgeChunks,
      `${request.prompt} ${intentSearchTerms}`,
      5,
    );
  }

  if (
    !jevResult.failed &&
    (jevResult.decision.withinDomainProbability < thresholds.domain ||
      (jevResult.decision.intent === "unsupported" &&
        jevResult.decision.withinDomainProbability < 0.8))
  ) {
    return fixedResponse(
      "refuse",
      "Belum ada di sumber instansi.",
      "Pertanyaan ini berada di luar panduan perjalanan dinas. Silakan tanyakan kepada admin.",
      startedAt,
    );
  }

  if (!evidence.length) {
    return fixedResponse(
      "refuse",
      "Belum ada di sumber instansi.",
      "Saya tidak menemukan sumber aktif yang mendukung jawaban ini. Silakan tanyakan kepada admin.",
      startedAt,
    );
  }

  const toolsStartedAt = performance.now();
  let toolResults: ToolResults;
  try {
    toolResults = runDeterministicTools(jevResult.decision, context, processContext);
  } catch {
    return fixedResponse(
      "error",
      "Perhitungan belum dapat dilakukan.",
      "Data perhitungan tidak valid. Silakan periksa data perjalanan atau hubungi admin.",
      startedAt,
    );
  }
  const toolsDuration = durationSince(toolsStartedAt);

  if (toolResults.clarification) {
    return fixedResponse(
      "clarify",
      toolResults.clarification,
      "Saya membutuhkan satu informasi ini sebelum melanjutkan.",
      startedAt,
    );
  }

  const gptStartedAt = performance.now();
  try {
    const generatedAnswer = await context.answerGenerator({
      request,
      userProfile: context.userProfile,
      processContext,
      evidence,
      calculations: toolResults.calculations,
      decision: jevResult.decision,
      missingDocuments: toolResults.missingDocuments,
    });
    validateGeneratedAnswer(
      generatedAnswer,
      toolResults.calculations,
      context.sbmRows,
      request.prompt,
      evidence,
    );
    const gptDuration = durationSince(gptStartedAt);
    const citations = citationsFromEvidence(generatedAnswer.citationIds, evidence);

    if (generatedAnswer.status === "answer" && !citations.length) {
      throw new Error("Grounded answers require at least one citation");
    }

    const injectionDetected = jevResult.decision.injectionProbability >= thresholds.injection;
    const providerWarnings = [
      ...(jevResult.failed
        ? ["Pemeriksaan keyakinan tidak tersedia; aksi otomatis dinonaktifkan"]
        : []),
      ...(injectionDetected
        ? ["Instruksi tidak tepercaya terdeteksi pada konteks halaman; aksi otomatis dinonaktifkan"]
        : []),
    ];
    const actions =
      generatedAnswer.status === "answer"
        ? buildActions(jevResult.decision, request, thresholds.click, injectionDetected)
        : [];

    return nemuResponseSchema.parse({
      status: generatedAnswer.status,
      answer: { ringkas: generatedAnswer.ringkas, detail: generatedAnswer.detail },
      citations,
      calc: toolResults.calculations,
      actions,
      warnings: [...generatedAnswer.warnings, ...providerWarnings],
      timing: {
        jev_ms: jevDuration,
        retrieval_ms: retrievalDuration,
        tools_ms: toolsDuration,
        gpt_ms: gptDuration,
        total_ms: durationSince(startedAt),
      },
    });
  } catch {
    return fixedResponse(
      "error",
      "Nemu belum dapat menjawab.",
      "Layanan jawaban sedang bermasalah. Silakan coba lagi tanpa mengirim atau mengubah data.",
      startedAt,
    );
  }
}
