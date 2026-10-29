import type {
  Calculation,
  NemuAction,
  NemuGuide,
  NemuGuideStep,
  NemuRequest,
  ProcessContext,
} from "@nemu/contracts";
import { NEMU_IDS } from "@nemu/contracts/nemu-ids";

import { isConfirmActionTarget, isProhibitedActionTarget } from "./action-safety.js";
import type { JevDecision } from "./jev.js";
import { normalizeDocumentName } from "./tools.js";

export type TravelWorkflowScenario =
  | "start_travel_request"
  | "travel_request_form_guidance"
  | "accommodation_guidance"
  | "accountability_follow_up"
  | null;

export type TravelWorkflowOutputInput = {
  scenario: Exclude<TravelWorkflowScenario, null>;
  request: NemuRequest;
  calculations: readonly Calculation[];
  missingDocuments: readonly string[];
  actionsAllowed: boolean;
};

// Momen 1's steps in the form's order. A target label names the value to pick or type when Nemu
// knows it, and the field otherwise (docs/design-system.md).
const CREATE_TRAVEL_STEPS = [
  {
    id: "travel-type",
    target: NEMU_IDS.perdinForm.jenisPerjalanan,
    label: "Pilih jenis perjalanan",
  },
  {
    id: "destination-city",
    target: NEMU_IDS.perdinForm.kotaTujuan,
    label: "Isi kota tujuan",
  },
  {
    id: "assignment-letter",
    target: NEMU_IDS.perdinForm.dasarPenugasan,
    label: "Pilih surat tugas",
  },
  {
    id: "departure-date",
    target: NEMU_IDS.perdinForm.tanggalBerangkat,
    label: "Pilih tanggal berangkat",
  },
  {
    id: "return-date",
    target: NEMU_IDS.perdinForm.tanggalKembali,
    label: "Pilih tanggal kembali",
  },
  {
    id: "transport-mode",
    target: NEMU_IDS.perdinForm.modaTransport,
    label: "Pilih moda transportasi",
  },
] as const satisfies readonly NemuGuideStep[];

/**
 * Rina's trip to Makassar as the Demo App seeds it: the surat tugas she holds for it and the values
 * its "Isi formulir demo" fills in (3–5 November 2026, by plane), each written as the form shows it.
 */
const MAKASSAR_TRIP_LABELS: Readonly<Record<(typeof CREATE_TRAVEL_STEPS)[number]["id"], string>> = {
  "travel-type": "Pilih Dinas luar kota",
  "destination-city": "Isi Makassar",
  "assignment-letter": "Pilih ST-090/2026",
  "departure-date": "Pilih 3 Nov 2026",
  "return-date": "Pilih 5 Nov 2026",
  "transport-mode": "Pilih Pesawat",
};

/** The Momen 1 steps, naming each value when the question is about Rina's trip to Makassar. */
function createTravelSteps(request: NemuRequest): NemuGuideStep[] {
  const knowsTrip = /\bmakassar\b/i.test(request.prompt);
  return CREATE_TRAVEL_STEPS.map((step) =>
    knowsTrip ? { ...step, label: MAKASSAR_TRIP_LABELS[step.id] } : { ...step },
  );
}

const ACCOUNTABILITY_UPLOAD_STEPS = [
  {
    document: "surat_tugas",
    id: "upload-assignment-letter",
    target: NEMU_IDS.pertanggungjawaban.uploadSuratTugas,
    label: "Unggah surat tugas",
  },
  {
    document: "boarding_pass_pergi",
    id: "upload-outbound-boarding-pass",
    target: NEMU_IDS.pertanggungjawaban.uploadBoardingPassPergi,
    label: "Unggah boarding pass pergi",
  },
  {
    document: "laporan_perjalanan",
    id: "upload-travel-report",
    target: NEMU_IDS.pertanggungjawaban.uploadLaporanPerjalanan,
    label: "Unggah laporan perjalanan",
  },
  {
    document: "boarding_pass_pulang",
    id: "upload-return-boarding-pass",
    target: NEMU_IDS.pertanggungjawaban.uploadBoardingPassPulang,
    label: "Unggah boarding pass pulang",
  },
] as const;

const ACCOUNTABILITY_SUBMIT_STEP = {
  id: "submit-accountability",
  target: NEMU_IDS.pertanggungjawaban.kirim,
  label: "Kamu yang mengirim",
} as const satisfies NemuGuideStep;

const CREATE_TRAVEL_TARGETS = new Set<string>(CREATE_TRAVEL_STEPS.map(({ target }) => target));

function normalizedTask(processContext: ProcessContext | undefined): {
  activeTask: string;
  status: string;
} {
  return {
    activeTask: processContext?.active_task
      ? normalizeDocumentName(processContext.active_task)
      : "",
    status: processContext?.status ? normalizeDocumentName(processContext.status) : "",
  };
}

export function resolveTravelWorkflowScenario(
  request: NemuRequest,
  processContext: ProcessContext | undefined,
  decision: JevDecision,
): TravelWorkflowScenario {
  const { activeTask, status } = normalizedTask(processContext);
  const visibleElementIds = new Set(
    request.elements.filter((element) => element.visible).map((element) => element.nemu_id),
  );
  const elementIds = new Set(request.elements.map((element) => element.nemu_id));

  if (
    decision.intent === "start_travel_request" &&
    new URL(request.url).pathname === "/perdin/baru" &&
    request.elements.some((element) => CREATE_TRAVEL_TARGETS.has(element.nemu_id))
  ) {
    return "travel_request_form_guidance";
  }

  if (
    decision.intent === "start_travel_request" &&
    visibleElementIds.has(NEMU_IDS.shell.menuAjukanPerjalananDinas)
  ) {
    return "start_travel_request";
  }

  if (
    activeTask === "isi rencana" &&
    (visibleElementIds.has(NEMU_IDS.perdinForm.lodgingNotHotel) ||
      visibleElementIds.has(NEMU_IDS.perdinForm.lodgingAmount))
  ) {
    return "accommodation_guidance";
  }

  const hasAccountabilityProcess =
    activeTask === "pertanggungjawaban" || status === "pertanggungjawaban";
  const hasAccountabilityTaskLink = elementIds.has(NEMU_IDS.task.pertanggungjawaban);
  const hasAccountabilityControl =
    ACCOUNTABILITY_UPLOAD_STEPS.some(({ target }) => elementIds.has(target)) ||
    elementIds.has(NEMU_IDS.pertanggungjawaban.kirim);
  if (
    (hasAccountabilityProcess && (hasAccountabilityTaskLink || hasAccountabilityControl)) ||
    (hasAccountabilityTaskLink && decision.intent === "accountability_question")
  ) {
    return "accountability_follow_up";
  }

  return null;
}

export function travelWorkflowGuidance(
  scenario: TravelWorkflowScenario,
  request: NemuRequest,
): readonly string[] {
  if (scenario === "start_travel_request") {
    return [
      "Treat this as a new travel request. Do not ask whether it refers to an existing process.",
    ];
  }
  if (scenario === "travel_request_form_guidance") {
    return [
      "Guide the user through the six initial travel request fields in page order, from travel type through transport mode.",
      "The form is already open. Do not tell the user to open the travel request menu again.",
    ];
  }
  if (scenario === "accommodation_guidance") {
    return [
      "The amount is offered through a user-confirmed fill action. Never claim it is filled automatically.",
    ];
  }
  if (scenario === "accountability_follow_up") {
    const finalControl = request.elements.find(
      (element) => element.nemu_id === NEMU_IDS.pertanggungjawaban.kirim,
    );
    return finalControl
      ? [`Refer to the final control using its exact current label: "${finalControl.label}".`]
      : [];
  }
  return [];
}

function currentStep(steps: readonly NemuGuideStep[], request: NemuRequest): number {
  const elementIds = new Set(request.elements.map((element) => element.nemu_id));
  const index = steps.findIndex((step) => elementIds.has(step.target));
  return index < 0 ? 1 : index + 1;
}

function accommodationAmount(calculations: readonly Calculation[]): number | undefined {
  const value = calculations.find(
    (calculation) => calculation.fungsi === "hitung_lumpsum_penginapan",
  )?.hasil;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function formatRupiah(value: number): string {
  return `Rp${value.toLocaleString("id-ID")}`;
}

function accountabilitySteps(missingDocuments: readonly string[]): NemuGuideStep[] {
  const missing = new Set(missingDocuments.map(normalizeDocumentName));
  return [
    ...ACCOUNTABILITY_UPLOAD_STEPS.filter(({ document }) =>
      missing.has(normalizeDocumentName(document)),
    ).map(({ id, target, label }) => ({ id, target, label })),
    ACCOUNTABILITY_SUBMIT_STEP,
  ];
}

export function buildTravelWorkflowOutput({
  scenario,
  request,
  calculations,
  missingDocuments,
  actionsAllowed,
}: TravelWorkflowOutputInput): { guide: NemuGuide; actions: NemuAction[] } | undefined {
  const elementsById = new Map(request.elements.map((element) => [element.nemu_id, element]));
  const visibleElementsById = new Map(
    request.elements
      .filter((element) => element.visible)
      .map((element) => [element.nemu_id, element]),
  );

  if (scenario === "start_travel_request") {
    const guide: NemuGuide = {
      id: "travel-request:create",
      steps: createTravelSteps(request),
      current_step: 1,
    };
    const menu = visibleElementsById.get(NEMU_IDS.shell.menuAjukanPerjalananDinas);
    return {
      guide,
      actions:
        actionsAllowed && menu && !isProhibitedActionTarget(menu)
          ? [
              {
                type: "click",
                target: menu.nemu_id,
                level: "jalan_sendiri",
                label: "Buka formulir",
              },
            ]
          : [],
    };
  }

  if (scenario === "travel_request_form_guidance") {
    const steps = createTravelSteps(request);
    const actions: NemuAction[] = actionsAllowed
      ? steps.flatMap((step) => {
          const element = elementsById.get(step.target);
          return element && !isProhibitedActionTarget(element)
            ? [
                {
                  type: "highlight" as const,
                  target: step.target,
                  level: "arahkan" as const,
                  label: step.label,
                },
              ]
            : [];
        })
      : [];
    // The dates and the transport mode render only while the form's Jadwal tab is open, so point
    // at the tab instead.
    const scheduleTab = elementsById.get(NEMU_IDS.perdinForm.tabJadwal);
    if (
      actionsAllowed &&
      !elementsById.has(NEMU_IDS.perdinForm.tanggalBerangkat) &&
      scheduleTab &&
      !isProhibitedActionTarget(scheduleTab)
    ) {
      actions.push({
        type: "highlight",
        target: NEMU_IDS.perdinForm.tabJadwal,
        level: "arahkan",
        label: "Buka tab Jadwal",
      });
    }
    return {
      guide: {
        id: "travel-request:create",
        steps,
        current_step: currentStep(steps, request),
      },
      actions,
    };
  }

  if (scenario === "accommodation_guidance") {
    const amount = accommodationAmount(calculations);
    if (amount === undefined) {
      return undefined;
    }
    const amountLabel = `Isi ${formatRupiah(amount)}`;
    const steps: NemuGuideStep[] = [
      {
        id: "choose-non-hotel",
        target: NEMU_IDS.perdinForm.lodgingNotHotel,
        label: "Pilih: tidak menginap",
      },
      {
        id: "fill-accommodation-amount",
        target: NEMU_IDS.perdinForm.lodgingAmount,
        label: amountLabel,
      },
    ];
    const actions: NemuAction[] = [];
    const lodgingChoice = visibleElementsById.get(NEMU_IDS.perdinForm.lodgingNotHotel);
    if (actionsAllowed && lodgingChoice && !isProhibitedActionTarget(lodgingChoice)) {
      actions.push({
        type: "highlight",
        target: NEMU_IDS.perdinForm.lodgingNotHotel,
        level: "arahkan",
        label: steps[0]?.label ?? "Pilih: tidak menginap",
      });
    }
    const lodgingAmount = visibleElementsById.get(NEMU_IDS.perdinForm.lodgingAmount);
    if (actionsAllowed && lodgingAmount && !isProhibitedActionTarget(lodgingAmount)) {
      actions.push({
        type: "fill",
        target: NEMU_IDS.perdinForm.lodgingAmount,
        level: "konfirmasi",
        label: amountLabel,
        value: String(amount),
      });
    }
    return {
      guide: {
        id: "travel-request:accommodation",
        steps,
        current_step: currentStep(steps, request),
      },
      actions,
    };
  }

  const steps = accountabilitySteps(missingDocuments);
  const task = visibleElementsById.get(NEMU_IDS.task.pertanggungjawaban);
  const actions: NemuAction[] = [];
  if (actionsAllowed && task && !isProhibitedActionTarget(task)) {
    actions.push({
      type: "click",
      target: task.nemu_id,
      level: "jalan_sendiri",
      label: "Buka Pertanggungjawaban",
    });
  } else if (actionsAllowed) {
    for (const step of steps) {
      const element = elementsById.get(step.target);
      if (!element || isProhibitedActionTarget(element)) continue;
      if (step.target === NEMU_IDS.pertanggungjawaban.kirim) {
        if (!isConfirmActionTarget(element)) continue;
        actions.push({
          type: "confirm",
          target: element.nemu_id,
          level: "konfirmasi",
          label: "Kamu yang mengirim",
        });
      } else {
        actions.push({
          type: "highlight",
          target: element.nemu_id,
          level: "arahkan",
          label: step.label,
        });
      }
    }
  }

  return {
    guide: {
      id: "travel-request:accountability",
      steps,
      current_step: currentStep(steps, request),
    },
    actions,
  };
}
