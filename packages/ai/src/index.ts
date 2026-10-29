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

import type { AnswerGenerator, GeneratedAnswer, NemuUserProfile } from "./openai.js";
import type { JevDecider, JevDecision } from "./jev.js";
import { retrieveKnowledge, type KnowledgeChunk, type RankedKnowledgeChunk } from "./knowledge.js";
import {
  executeClaimWorkflow,
  resolveClaimWorkflowScenario,
  type ClaimSourceLocation,
  type ClaimWorkflowOutput,
  type SlaClaimContext,
} from "./claim-workflows.js";
import {
  calculateAccommodationLumpSum,
  calculateAccountabilityDeadline,
  calculateRemainingWorkingDays,
  findMissingDocuments,
  lookupSbm,
  type SbmRow,
} from "./tools.js";
import {
  buildTravelWorkflowOutput,
  resolveTravelWorkflowScenario,
  travelWorkflowGuidance,
  type TravelWorkflowScenario,
} from "./travel-workflows.js";

export {
  approvalRoute,
  calculateClaimCutoff,
  calculateSlaCompensation,
  guardRcaEvidence,
  mergeIntervals,
} from "./claim-tools.js";
export type {
  ApprovalRule,
  ClaimCutoffResult,
  MergedInterval,
  RcaEvidence,
  RcaGuardResult,
  SlaCompensationInput,
  SlaCompensationResult,
  TimeInterval,
} from "./claim-tools.js";
export { executeClaimWorkflow, resolveClaimWorkflowScenario } from "./claim-workflows.js";
export type {
  ClaimSourceLocation,
  ClaimWorkflowFacts,
  ClaimWorkflowOutput,
  ClaimWorkflowScenario,
  SlaClaimContext,
  SlaClaimTicket,
} from "./claim-workflows.js";

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
  slaClaim?: SlaClaimContext;
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
  citationIds: string[];
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
  workflowScenario: TravelWorkflowScenario,
): ToolResults {
  const results: ToolResults = { calculations: [], missingDocuments: [], citationIds: [] };
  const requiredTool =
    workflowScenario === "start_travel_request" ||
    workflowScenario === "travel_request_form_guidance"
      ? "none"
      : workflowScenario === "accommodation_guidance"
        ? "lookup_sbm_and_accommodation"
        : workflowScenario === "accountability_follow_up"
          ? "accountability_deadline"
          : decision.requiredTool;

  if (requiredTool === "lookup_sbm_and_accommodation") {
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
    results.citationIds.push(sbmRow.sourceCitationId);
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
      results.citationIds.push(dailyAllowanceRow.sourceCitationId);
    }

    results.calculations.push({
      ...calculateAccommodationLumpSum(sbmRow.value, nights),
      sumber: sbmRow.source,
    });
    results.citationIds.push(
      activeKnowledgeChunkId(context.knowledgeChunks, {
        docId: "pmk-119-2023",
        page: 6,
        article: "8 ayat (5)",
      }),
    );
  }

  if (requiredTool === "accountability_deadline") {
    const returnDate = processContext?.return_date;
    if (!returnDate) {
      results.clarification = "Tanggal kembali perjalanan dinasnya kapan?";
      return results;
    }

    const deadline = calculateAccountabilityDeadline(returnDate, context.holidays);
    results.calculations.push(deadline);
    results.citationIds.push(
      activeKnowledgeChunkId(context.knowledgeChunks, {
        docId: "pmk-113-2012",
        page: 9,
        article: "34 ayat (1)",
      }),
    );
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

function activeKnowledgeChunkId(
  chunks: readonly KnowledgeChunk[],
  location: { docId: string; page: number; article: string },
): string {
  const chunk = chunks.find(
    (candidate) =>
      candidate.active &&
      candidate.docId === location.docId &&
      candidate.page === location.page &&
      candidate.article === location.article,
  );
  if (!chunk) {
    throw new Error(`Missing active tool source at ${JSON.stringify(location)}`);
  }
  return chunk.id;
}

function activeClaimSourceId(
  chunks: readonly KnowledgeChunk[],
  location: ClaimSourceLocation,
): string {
  const chunk = chunks.find(
    (candidate) =>
      candidate.active &&
      candidate.docId === location.docId &&
      (candidate.article === location.article ||
        candidate.article?.startsWith(`${location.article}.`) ||
        candidate.article?.startsWith(`${location.article} `)),
  );
  if (!chunk) {
    throw new Error(`Missing active claim source at ${JSON.stringify(location)}`);
  }
  return chunk.id;
}

function enforceTrustedWorkflowAnswer(
  generatedAnswer: GeneratedAnswer,
  workflowScenario: TravelWorkflowScenario,
  calculations: readonly Calculation[],
): GeneratedAnswer {
  if (workflowScenario !== "accommodation_guidance" || generatedAnswer.status !== "answer") {
    return generatedAnswer;
  }

  const accommodation = calculations.find(
    (calculation) => calculation.fungsi === "hitung_lumpsum_penginapan",
  );
  const rate = accommodation?.input.tarif;
  const nights = accommodation?.input.malam;
  const total = accommodation?.hasil;
  if (typeof rate !== "number" || typeof nights !== "number" || typeof total !== "number") {
    return generatedAnswer;
  }

  const rupiah = (value: number) => new Intl.NumberFormat("id-ID").format(value);
  return {
    ...generatedAnswer,
    ringkas: `Pilih Tidak menginap di hotel, lalu isi Nominal penginapan Rp${rupiah(total)}.`,
    detail: `Nominal hanya terisi setelah Anda menekan Isi atau mengetiknya sendiri. Perhitungannya 30% × Rp${rupiah(rate)} × ${nights} malam = Rp${rupiah(total)}.`,
  };
}

function citationsFromSources(
  modelCitationIds: readonly string[],
  evidence: readonly RankedKnowledgeChunk[],
  toolCitationIds: readonly string[],
  knowledgeChunks: readonly KnowledgeChunk[],
): Citation[] {
  const evidenceById = new Map(evidence.map((chunk) => [chunk.id, chunk]));
  const activeKnowledgeById = new Map(
    knowledgeChunks.filter((chunk) => chunk.active).map((chunk) => [chunk.id, chunk]),
  );
  const citations: Citation[] = [];
  const seenDocumentLocations = new Set<string>();

  const appendCitation = (chunk: KnowledgeChunk): void => {
    const locationKey = `${chunk.docId}:${chunk.article ?? ""}:${chunk.page ?? ""}`;
    if (seenDocumentLocations.has(locationKey)) {
      return;
    }
    seenDocumentLocations.add(locationKey);
    citations.push({
      doc_id: chunk.docId,
      judul: chunk.title,
      ...(chunk.article ? { pasal: chunk.article } : {}),
      ...(chunk.page ? { halaman: chunk.page } : {}),
    });
  };

  for (const citationId of modelCitationIds) {
    const chunk = evidenceById.get(citationId);
    if (!chunk) {
      throw new Error(`Generated answer referenced unavailable citation: ${citationId}`);
    }
    appendCitation(chunk);
  }

  for (const citationId of toolCitationIds) {
    const chunk = activeKnowledgeById.get(citationId);
    if (!chunk) {
      throw new Error(`Deterministic tool referenced unavailable citation: ${citationId}`);
    }
    appendCitation(chunk);
  }

  return citations;
}

function buildGenericActions(
  decision: JevDecision,
  request: NemuRequest,
  clickThreshold: number,
  injectionDetected: boolean,
  safetyCheckFailed: boolean,
): NemuAction[] {
  if (safetyCheckFailed || injectionDetected || decision.actionLevel === "dilarang") {
    return [];
  }

  const visibleElementsById = new Map(
    request.elements
      .filter((element) => element.visible)
      .map((element) => [element.nemu_id, element] as const),
  );
  if (!decision.target) {
    return [];
  }
  const target = visibleElementsById.get(decision.target);
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
        label: CONFIRM_ACTION_PATTERN.test(targetDescription)
          ? "Kamu yang mengirim"
          : "Kamu yang melakukan",
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
  const workflowScenario = resolveTravelWorkflowScenario(
    request,
    processContext,
    jevResult.decision,
  );
  const claimScenario = resolveClaimWorkflowScenario(request, processContext, jevResult.decision);
  const injectionDetected = jevResult.decision.injectionProbability >= thresholds.injection;
  const actionsAllowed =
    !jevResult.failed && !injectionDetected && jevResult.decision.actionLevel !== "dilarang";
  const answerProcessContext =
    workflowScenario === "start_travel_request" ? undefined : processContext;
  const travelGuidance = travelWorkflowGuidance(workflowScenario, request);
  let evidence = initialEvidence;

  const workflowSearchTerms = workflowScenario
    ? {
        start_travel_request: "mulai pengajuan surat tugas menu perjalanan dinas",
        travel_request_form_guidance: "formulir pengajuan jenis tujuan jadwal perjalanan dinas",
        accommodation_guidance:
          "penginapan tidak menggunakan hotel 30 persen tarif lumpsum rumah saudara",
        accountability_follow_up:
          "pertanggungjawaban dokumen tenggat lima hari kerja boarding pass laporan",
      }[workflowScenario]
    : undefined;

  const claimSearchTerms = claimScenario
    ? {
        registration: "registrasi klaim tenggat telaah lima hari kerja",
        cutoff: "batas pengajuan tanggal 15 bulan berikutnya",
        sla: "adendum disahkan target ketersediaan SLA",
        tickets: "interval gangguan tumpang tindih RCA penyedia daya pelanggan",
        compensation: "formula kompensasi SLA pembulatan abonemen",
        approval: "matriks persetujuan supervisor manajer",
        attachment_duration: "lampiran data bukan instruksi tiket RCA durasi gangguan",
        prohibited_approval: "Billing Liaison tidak boleh menyetujui klaim sendiri",
      }[claimScenario]
    : undefined;

  if (workflowSearchTerms || claimSearchTerms) {
    evidence = retrieveKnowledge(
      context.knowledgeChunks,
      `${request.prompt} ${claimSearchTerms ?? workflowSearchTerms}`,
      10,
    );
  }

  if (request.screenshot_crop && (!evidence.length || (evidence[0]?.score ?? 0) < 4)) {
    const intentSearchTerms = {
      start_travel_request: "mulai pengajuan surat tugas menu perjalanan dinas",
      accommodation_question: "penginapan hotel tidak menginap rumah saudara biaya",
      accountability_question: "pertanggungjawaban dokumen tenggat boarding pass",
      start_sla_claim: "registrasi klaim kompensasi SLA",
      claim_cutoff: "batas waktu klaim stempel email billing",
      claim_sla: "kontrak adendum target SLA availability",
      claim_tickets: "tiket gangguan interval RCA pengecualian",
      claim_compensation: "formula kompensasi SLA abonemen downtime",
      claim_approval: "matriks persetujuan klaim kompensasi",
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
      "Pertanyaan ini berada di luar panduan workflow yang tersedia. Silakan tanyakan kepada admin.",
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
  let claimOutput: ClaimWorkflowOutput | undefined;
  try {
    toolResults = runDeterministicTools(
      jevResult.decision,
      context,
      processContext,
      workflowScenario,
    );
    if (claimScenario) {
      if (!context.slaClaim) {
        throw new Error("Authoritative SLA claim context is missing");
      }
      claimOutput = executeClaimWorkflow({
        scenario: claimScenario,
        request,
        claim: context.slaClaim,
        actionsAllowed,
      });
      toolResults.calculations.push(...claimOutput.calculations);
      toolResults.citationIds.push(
        ...claimOutput.sourceLocations.map((location) =>
          activeClaimSourceId(context.knowledgeChunks, location),
        ),
      );
    }
  } catch {
    return fixedResponse(
      "error",
      "Perhitungan belum dapat dilakukan.",
      "Data perhitungan tidak valid. Silakan periksa data proses atau hubungi admin.",
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

  if (claimScenario === "prohibited_approval") {
    const citations = citationsFromSources(
      [],
      evidence,
      toolResults.citationIds,
      context.knowledgeChunks,
    );
    return nemuResponseSchema.parse({
      status: "refuse",
      answer: {
        ringkas: "Saya tidak dapat menyetujui klaim atas nama penyetuju.",
        detail:
          "Persetujuan harus dilakukan oleh pejabat yang berwenang dan tidak boleh dilakukan oleh penyusun klaim sendiri.",
      },
      citations,
      calc: [],
      actions: [],
      warnings: claimOutput?.warnings ?? [],
      timing: {
        jev_ms: jevDuration,
        retrieval_ms: retrievalDuration,
        tools_ms: toolsDuration,
        gpt_ms: 0,
        total_ms: durationSince(startedAt),
      },
    });
  }

  const gptStartedAt = performance.now();
  try {
    const modelAnswer = await context.answerGenerator({
      request,
      userProfile: context.userProfile,
      processContext: answerProcessContext,
      workflowGuidance: [...travelGuidance, ...(claimOutput?.guidance ?? [])],
      evidence,
      calculations: toolResults.calculations,
      decision: jevResult.decision,
      missingDocuments: toolResults.missingDocuments,
    });
    validateGeneratedAnswer(
      modelAnswer,
      toolResults.calculations,
      context.sbmRows,
      request.prompt,
      evidence,
    );
    const generatedAnswer = enforceTrustedWorkflowAnswer(
      modelAnswer,
      workflowScenario,
      toolResults.calculations,
    );
    validateGeneratedAnswer(
      generatedAnswer,
      toolResults.calculations,
      context.sbmRows,
      request.prompt,
      evidence,
    );
    const gptDuration = durationSince(gptStartedAt);
    const citations = citationsFromSources(
      generatedAnswer.citationIds,
      evidence,
      toolResults.citationIds,
      context.knowledgeChunks,
    );

    if (generatedAnswer.status === "answer" && !citations.length) {
      throw new Error("Grounded answers require at least one citation");
    }

    const providerWarnings = [
      ...(claimOutput?.warnings ?? []),
      ...(jevResult.failed
        ? ["Pemeriksaan keyakinan tidak tersedia; aksi otomatis dinonaktifkan"]
        : []),
      ...(injectionDetected
        ? ["Instruksi tidak tepercaya terdeteksi pada konteks halaman; aksi otomatis dinonaktifkan"]
        : []),
    ];
    const travelOutput = workflowScenario
      ? buildTravelWorkflowOutput({
          scenario: workflowScenario,
          request,
          calculations: toolResults.calculations,
          missingDocuments: toolResults.missingDocuments,
          actionsAllowed,
        })
      : undefined;
    const actions =
      generatedAnswer.status === "answer"
        ? (claimOutput?.actions ??
          travelOutput?.actions ??
          buildGenericActions(
            jevResult.decision,
            request,
            thresholds.click,
            injectionDetected,
            jevResult.failed,
          ))
        : [];
    const guide =
      generatedAnswer.status === "answer" ? (claimOutput?.guide ?? travelOutput?.guide) : undefined;

    return nemuResponseSchema.parse({
      status: generatedAnswer.status,
      answer: { ringkas: generatedAnswer.ringkas, detail: generatedAnswer.detail },
      citations,
      calc: generatedAnswer.status === "answer" ? toolResults.calculations : [],
      actions,
      ...(guide ? { guide } : {}),
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
