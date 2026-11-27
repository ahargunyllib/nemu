import type {
  QuizDraft,
  QuizDraftQuestion,
  QuizImage,
  QuizScriptAnswer,
  QuizScriptQuestion,
} from "@nemu/contracts/quiz";

/**
 * F4-03: the draft read from the script (`script.ts`) plus the teacher's answers, as Moodle XML
 * that Bank soal › Impor accepts: one multiple-choice question per script question, named
 * "Soal 01" and onwards, with the script's own pictures embedded, in the draft's category.
 * The settings follow the team's expected file (`infra/setup/f4-2/`): one grade each, choices in
 * the script's order, labelled a, b, c.
 */

export const SKIP_QUESTION = "Lewati soal ini";

/**
 * Her answers applied: a word she gave, a key she picked, a section; a question she chose to skip
 * is left out and named in `skipped`. A picture she will add later stays as an empty image, so the
 * F4-1 check points at it afterwards. Unanswered questions throw: nothing is filled in by Nemu.
 */
export function applyQuizAnswers(
  draft: QuizDraft,
  questions: readonly QuizScriptQuestion[],
  answers: readonly QuizScriptAnswer[],
): { draft: QuizDraft; skipped: number[] } {
  const byId = new Map(answers.map((answer) => [answer.questionId, answer.answer.trim()]));
  const skipped = new Set<number>();
  const next: QuizDraft = structuredClone(draft);
  const soal = (number: number) => next.questions.find((question) => question.number === number);
  for (const question of questions) {
    const answer = byId.get(question.id);
    if (!answer) throw new Error(`No answer for ${question.id}`);
    switch (question.kind) {
      case "section":
        next.section = answer;
        break;
      case "text": {
        const target = soal(question.soal);
        if (!target) break;
        if (question.choice === null) target.text = answer;
        else if (target.choices[question.choice]) target.choices[question.choice]!.text = answer;
        break;
      }
      case "key": {
        const target = soal(question.soal);
        const index = answer.toLowerCase().charCodeAt(0) - 97;
        if (target && index >= 0 && index < target.choices.length) target.key = index;
        else throw new Error(`"${answer}" is no choice of soal ${question.soal}`);
        break;
      }
      case "image": {
        if (answer === SKIP_QUESTION) {
          skipped.add(question.soal);
          break;
        }
        const target = soal(question.soal);
        if (!target) break;
        const missing = `gambar-belum-ada-${question.soal}${question.choice === null ? "" : `-${String.fromCharCode(97 + question.choice)}`}.png`;
        const placeholder = {
          name: missing,
          alt: "Gambar belum dipasang",
          width: 1,
          height: 1,
          dataUrl: "",
        };
        if (question.choice === null) target.image = placeholder;
        else if (target.choices[question.choice])
          target.choices[question.choice]!.image = placeholder;
        break;
      }
    }
  }
  next.questions = next.questions.filter((question) => !skipped.has(question.number));
  return { draft: next, skipped: [...skipped].sort((a, b) => a - b) };
}

function escapeText(text: string): string {
  return text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
}

function escapeAttribute(text: string): string {
  return escapeText(text).replace(/"/gu, "&quot;");
}

/** HTML inside CDATA; "]]>" can't appear there, so it is split. */
function cdata(html: string): string {
  return `<![CDATA[${html.replace(/\]\]>/gu, "]]]]><![CDATA[>")}]]>`;
}

function imageHtml(image: QuizImage): string {
  return `<img src="@@PLUGINFILE@@/${escapeAttribute(image.name)}" alt="${escapeAttribute(image.alt)}" width="${image.width}" height="${image.height}">`;
}

/** The picture's bytes, or none for one she will add later (Moodle then shows it as missing). */
function fileElement(image: QuizImage, indent: string): string {
  const base64 = image.dataUrl.split(",", 2)[1] ?? "";
  if (!base64) return "";
  return `\n${indent}<file name="${escapeAttribute(image.name)}" path="/" encoding="base64">${base64}</file>`;
}

function paragraph(text: string, image: QuizImage | null): string {
  const parts = [text ? escapeText(text) : "", image ? imageHtml(image) : ""].filter(Boolean);
  return `<p>${parts.join("<br>")}</p>`;
}

function questionXml(question: QuizDraftQuestion, pad: number): string {
  if (question.key === null) throw new Error(`Soal ${question.number} has no key`);
  const answers = question.choices
    .map((choice, index) => {
      const fraction = index === question.key ? 100 : 0;
      return `    <answer fraction="${fraction}" format="html">
      <text>${cdata(paragraph(choice.text, choice.image))}</text>${choice.image ? fileElement(choice.image, "      ") : ""}
      <feedback format="html"><text></text></feedback>
    </answer>`;
    })
    .join("\n");
  return `  <question type="multichoice">
    <name><text>Soal ${String(question.number).padStart(pad, "0")}</text></name>
    <questiontext format="html">
      <text>${cdata(paragraph(question.text, question.image))}</text>${question.image ? fileElement(question.image, "      ") : ""}
    </questiontext>
    <generalfeedback format="html"><text></text></generalfeedback>
    <defaultgrade>1.0000000</defaultgrade>
    <penalty>0.3333333</penalty>
    <hidden>0</hidden>
    <idnumber></idnumber>
    <single>true</single>
    <shuffleanswers>false</shuffleanswers>
    <answernumbering>abc</answernumbering>
    <showstandardinstruction>0</showstandardinstruction>
    <correctfeedback format="html"><text>Jawaban benar.</text></correctfeedback>
    <partiallycorrectfeedback format="html"><text>Sebagian benar.</text></partiallycorrectfeedback>
    <incorrectfeedback format="html"><text>Jawaban belum benar.</text></incorrectfeedback>
${answers}
  </question>`;
}

/** The quiz as Moodle XML, ready for Bank soal › Impor. */
export function moodleXml(draft: QuizDraft): string {
  const pad = Math.max(2, String(Math.max(0, ...draft.questions.map((q) => q.number))).length);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${escapeText(draft.name).replace(/--/gu, "- -")}: dibuat Nemu dari naskah guru. -->
<quiz>
  <question type="category">
    <category><text>${escapeText(draft.category)}</text></category>
    <info format="html"><text></text></info>
  </question>
${draft.questions.map((question) => questionXml(question, pad)).join("\n")}
</quiz>
`;
}

/** "Latihan IPAS Kelas 4A.xml": the name the teacher sees in the file picker. */
export function quizFileName(draft: QuizDraft): string {
  const safe = draft.name
    .replace(/[\\/:*?"<>|]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return `${safe || "Kuis"}.xml`;
}
