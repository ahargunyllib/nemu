import type {
  GradeEntry,
  GradeSheetReading,
  VerificationAnswer,
  VerificationPlan,
  VerificationQuestion,
} from "@nemu/contracts/school";

import { parseGradeValue } from "./reading.js";

/**
 * F1-06: one question per screen, only for doubtful digits, names spelled differently, and S/I/A.
 * Options are never pre-selected; they are listed in ascending order.
 */

const ABSENCE_WORD = { S: "sakit", I: "izin", A: "alpa" } as const;

function displayName(row: GradeSheetReading["rows"][number]): string {
  return row.rosterName ?? row.nameRaw;
}

function digitOptions(readings: {
  a: string | null;
  b: string | null;
  reread: string | null;
}): string[] {
  const values = new Set<number>();
  for (const reading of [readings.a, readings.b, readings.reread]) {
    const value = parseGradeValue(reading);
    if (value !== null) values.add(value);
  }
  return [...values].sort((left, right) => left - right).map(String);
}

export function nameQuestionId(line: number): string {
  return `name-${line}`;
}

export function cellQuestionId(line: number, column: string): string {
  return `cell-${line}-${column}`;
}

export function buildVerificationPlan(reading: GradeSheetReading): VerificationPlan {
  const questions: VerificationQuestion[] = [];
  let accepted = 0;
  let blanks = 0;

  for (const row of reading.rows) {
    let asked = false;
    if (row.nameStatus !== "auto") {
      asked = true;
      questions.push({
        id: nameQuestionId(row.line),
        kind: "name",
        line: row.line,
        nameRaw: row.nameRaw,
        prompt: `"${row.nameRaw}" di buku itu siapa?`,
        options: row.candidates.slice(0, row.nameStatus === "ask" ? 2 : 3),
        box: row.nameBox,
      });
    }
    for (const cell of row.cells) {
      if (cell.confidence === "high") {
        if (cell.status === "blank") blanks += 1;
        continue;
      }
      asked = true;
      if (cell.status === "S" || cell.status === "I" || cell.status === "A") {
        questions.push({
          id: cellQuestionId(row.line, cell.column),
          kind: "absence",
          line: row.line,
          column: cell.column,
          studentName: displayName(row),
          code: cell.status,
          prompt: `${displayName(row)}: ${cell.status} (${ABSENCE_WORD[cell.status]}). Nilai dikosongkan?`,
          options: ["Kosongkan"],
          box: cell.bbox,
        });
        continue;
      }
      const options = digitOptions(cell.readings);
      questions.push({
        id: cellQuestionId(row.line, cell.column),
        kind: "digit",
        line: row.line,
        column: cell.column,
        studentName: displayName(row),
        prompt: options.length
          ? `Nilai ${displayName(row)}: ${options.join(" atau ")}?`
          : `Nilai ${displayName(row)} berapa?`,
        options,
        box: cell.bbox,
      });
    }
    if (!asked) accepted += 1;
  }

  const source = reading.source === "excel" ? "di file" : "di buku";
  const blankNote = blanks ? ` ${blanks} nilai kosong ${source}.` : "";
  return {
    questions,
    acceptedCount: accepted,
    acceptedSentence: `${accepted} nilai lain sudah cocok.${blankNote}`,
  };
}

export type ApplyAnswersResult =
  | { status: "ok"; column: string; entries: GradeEntry[] }
  | { status: "unresolved"; lines: number[] };

/**
 * Turns the reading plus the teacher's answers into one entry per student. A name answered "none"
 * drops that line; a student assigned twice, or any open question, leaves the result unresolved.
 */
export function applyAnswers(
  reading: GradeSheetReading,
  answers: readonly VerificationAnswer[],
): ApplyAnswersResult {
  const byId = new Map(answers.map((answer) => [answer.questionId, answer.answer.trim()]));
  const plan = buildVerificationPlan(reading);
  const open = plan.questions
    .filter((question) => !byId.has(question.id))
    .map((question) => question.line);
  if (open.length) return { status: "unresolved", lines: [...new Set(open)] };

  const column = reading.rows[0]?.cells[0]?.column ?? reading.columns.at(-1)?.key ?? "";
  const entries: GradeEntry[] = [];
  const seen = new Map<string, number>();
  const conflicts = new Set<number>();

  for (const row of reading.rows) {
    let studentId = row.studentId;
    let name = row.rosterName;
    if (row.nameStatus !== "auto") {
      const answer = byId.get(nameQuestionId(row.line))!;
      if (answer === "none") continue;
      const candidate = row.candidates.find((option) => option.studentId === answer);
      studentId = answer;
      name =
        candidate?.name ??
        reading.unmatchedStudents.find((student) => student.studentId === answer)?.name ??
        null;
    }
    if (!studentId || !name) {
      conflicts.add(row.line);
      continue;
    }
    const previous = seen.get(studentId);
    if (previous !== undefined) {
      conflicts.add(previous);
      conflicts.add(row.line);
    }
    seen.set(studentId, row.line);

    const cell = row.cells[0];
    if (!cell) continue;
    let value = cell.value;
    let status = cell.status;
    if (cell.confidence !== "high") {
      const answer = byId.get(cellQuestionId(row.line, cell.column))!;
      if (/^(kosongkan|blank|kosong)$/iu.test(answer)) {
        value = null;
        status =
          cell.status === "S" || cell.status === "I" || cell.status === "A" ? cell.status : "blank";
      } else {
        const parsed = parseGradeValue(answer);
        if (parsed === null) {
          conflicts.add(row.line);
          continue;
        }
        value = parsed;
        status = "value";
      }
    }
    entries.push({
      studentId,
      name,
      value: status === "value" ? value : null,
      status,
      remedial: false,
    });
  }

  if (conflicts.size) return { status: "unresolved", lines: [...conflicts].sort((a, b) => a - b) };
  return { status: "ok", column, entries };
}
