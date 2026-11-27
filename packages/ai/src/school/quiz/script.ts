import type {
  QuizChoice,
  QuizDraft,
  QuizDraftQuestion,
  QuizImage,
  QuizScriptInput,
  QuizScriptQuestion,
  QuizScriptResult,
} from "@nemu/contracts/quiz";

import { base64ToBytes, type JsonCall, type LlmContent } from "../llm.js";
import { normalizeControlName } from "../safety.js";
import { readDocx } from "./docx.js";
import { extractPdfImages, type ScriptImage } from "./pdf-images.js";
import { quizTimesFrom } from "./times.js";

/**
 * F4-03 (#219): the teacher's script (PDF, Word or photo) read into a quiz. The model reads the
 * words, the choices and the key, and says which of the script's own pictures belongs to which
 * question or choice; code takes the pictures out of the file (`pdf-images.ts`), picks the
 * course section, reads the times from her words, and turns every part the model couldn't read
 * into a question for the teacher. Nemu never writes a question, a choice or a key itself.
 */

/** What the model returns (and the offline fixture writes). `null` = couldn't read it: ask. */
export type ModelQuizScript = {
  readable: boolean;
  /** The quiz's name: the script's title without the school's name ("Latihan IPAS Kelas 4A"). */
  title: string | null;
  /** The subject as the script names it ("IPAS"), to find the course section. */
  subject: string | null;
  /** The class ("4A"), or null. */
  class_name: string | null;
  questions: Array<{
    number: number;
    /** The question's words; null when they can't be read. */
    text: string | null;
    /** What the words might be, most likely first, when `text` is null. */
    text_candidates: string[];
    /** The id of the script picture shown with the question itself ("gambar-2"), or null. */
    image: string | null;
    /** The question shows a picture that isn't among the script's pictures. */
    image_missing: boolean;
    choices: Array<{
      label: string;
      text: string | null;
      text_candidates: string[];
      image: string | null;
      image_missing: boolean;
    }>;
    /** The right choice's label from the script's key ("b"); null when it has none or it's unreadable. */
    key: string | null;
  }>;
};

const CHOICE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["label", "text", "text_candidates", "image", "image_missing"],
  properties: {
    label: { type: "string" },
    text: { type: ["string", "null"] },
    text_candidates: { type: "array", items: { type: "string" } },
    image: { type: ["string", "null"] },
    image_missing: { type: "boolean" },
  },
};

const SCRIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["readable", "title", "subject", "class_name", "questions"],
  properties: {
    readable: { type: "boolean" },
    title: { type: ["string", "null"] },
    subject: { type: ["string", "null"] },
    class_name: { type: ["string", "null"] },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["number", "text", "text_candidates", "image", "image_missing", "choices", "key"],
        properties: {
          number: { type: "integer" },
          text: { type: ["string", "null"] },
          text_candidates: { type: "array", items: { type: "string" } },
          image: { type: ["string", "null"] },
          image_missing: { type: "boolean" },
          choices: { type: "array", items: CHOICE_SCHEMA },
          key: { type: ["string", "null"] },
        },
      },
    },
  },
};

const INSTRUCTIONS = `Kamu membaca naskah soal pilihan ganda buatan guru untuk dimasukkan ke Moodle.
Salin persis apa yang tertulis: teks soal, setiap pilihan (a, b, c, d …) dan kunci jawaban dari naskah.
Jangan pernah menulis, memperbaiki, atau menebak soal, pilihan, atau kunci sendiri.
- title: judul naskah tanpa nama sekolah (mis. "Latihan IPAS Kelas 4A"); subject: mata pelajaran; class_name: kelas (mis. "4A").
- Bagian yang tidak terbaca: isi null dan tulis kemungkinan bacaannya di text_candidates (paling mungkin dulu, boleh kosong).
- key: huruf pilihan yang benar menurut kunci jawaban di naskah; null kalau naskah tidak punya kunci untuk soal itu atau tidak terbaca.
- Gambar: naskah ini punya gambar-gambar yang sudah diambil dari berkasnya, masing-masing dengan id (mis. "gambar-1").
  Sebutkan id gambar yang menjadi bagian soal (image) atau bagian pilihan (choice.image). Gambar sebuah soal bisa ada di halaman berikutnya.
  Kalau soal atau pilihan memperlihatkan gambar yang tidak ada di daftar, isi image null dan image_missing true. Jangan mendeskripsikan gambar sebagai teks.
- readable false hanya kalau berkas ini sama sekali bukan naskah soal atau tidak terbaca.`;

export type QuizScriptReader = { llm: JsonCall };

/** The file's bytes, from its data URL. */
export function fileBytes(dataUrl: string): Uint8Array {
  return base64ToBytes(dataUrl.split(",", 2)[1] ?? "");
}

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function scriptKind(input: QuizScriptInput): "pdf" | "docx" | "photo" | null {
  const { mimeType, name } = input.file;
  if (mimeType === "application/pdf" || /\.pdf$/iu.test(name)) return "pdf";
  if (mimeType === DOCX || /\.docx$/iu.test(name)) return "docx";
  if (mimeType.startsWith("image/")) return "photo";
  return null;
}

/**
 * What the model sees and the script's own pictures: a PDF as a file plus its embedded images, a
 * Word file as its text (read in code) plus its images, a photo as itself. Null for a file Nemu
 * can't read (an old .doc).
 */
export async function scriptSource(
  input: QuizScriptInput,
): Promise<{ content: LlmContent[]; images: ScriptImage[] } | null> {
  const kind = scriptKind(input);
  const bytes = fileBytes(input.file.dataUrl);
  const named: LlmContent = { type: "text", text: `Berkas naskah: ${input.file.name}` };
  if (kind === "pdf") {
    const images = await extractPdfImages(bytes).catch(() => []);
    const file: LlmContent = {
      type: "file",
      dataUrl: input.file.dataUrl,
      filename: input.file.name,
    };
    return { content: scriptContent([named, file], images), images };
  }
  if (kind === "docx") {
    const word = await readDocx(bytes).catch(() => null);
    if (!word?.text) return null;
    const text: LlmContent = {
      type: "text",
      text: `Isi naskah (berkas Word; [gambar-N] menandai tempat gambar):\n${word.text}`,
    };
    return { content: scriptContent([named, text], word.images), images: word.images };
  }
  if (kind === "photo")
    return { content: [named, { type: "image", dataUrl: input.file.dataUrl }], images: [] };
  return null;
}

/** The script, then each picture by id. */
function scriptContent(content: LlmContent[], images: readonly ScriptImage[]): LlmContent[] {
  for (const image of images) {
    content.push({
      type: "text",
      text: `${image.id}${image.page ? ` (halaman ${image.page})` : ""}, ${image.width}×${image.height}:`,
    });
    content.push({ type: "image", dataUrl: image.dataUrl });
  }
  return content;
}

/** The schema carries no array limits (Gemini refuses them as too many states), so code does. */
function parseModelScript(value: unknown): ModelQuizScript {
  const script = value as ModelQuizScript;
  if (typeof script !== "object" || script === null || !Array.isArray(script.questions))
    throw new Error("The script reading has no questions");
  return {
    ...script,
    questions: script.questions.slice(0, 200).map((question) => ({
      ...question,
      text_candidates: question.text_candidates.slice(0, 3),
      choices: question.choices.slice(0, 10),
    })),
  };
}

function letter(index: number): string {
  return String.fromCharCode(97 + index);
}

/** "IPAS" → the course section named IPAS; null when no section, or more than one, fits. */
export function matchSection(
  sections: readonly string[],
  ...names: (string | null)[]
): string | null {
  for (const name of names) {
    if (!name) continue;
    const wanted = normalizeControlName(name);
    const exact = sections.filter((section) => normalizeControlName(section) === wanted);
    if (exact.length === 1) return exact[0]!;
    const words = new Set(wanted.split(" "));
    const within = sections.filter((section) => {
      const own = normalizeControlName(section);
      return own.length > 0 && own.split(" ").every((word) => words.has(word));
    });
    if (within.length === 1) return within[0]!;
  }
  return null;
}

/** "Latihan IPAS Kelas 4A – SDIT Nusantara" → "Latihan IPAS Kelas 4A". */
function quizName(title: string | null, fileName: string): string {
  const named = (title ?? "").split(/\s+[–—-]\s+/u)[0]!.trim();
  return named || fileName.replace(/\.[^.]+$/u, "").trim() || "Kuis";
}

function imageFor(
  id: string | null,
  images: ReadonlyMap<string, ScriptImage>,
  name: string,
  alt: string,
): QuizImage | null {
  const image = id ? images.get(id) : undefined;
  if (!image) return null;
  const extension = image.dataUrl.startsWith("data:image/jpeg") ? "jpg" : "png";
  return {
    name: `${name}.${extension}`,
    alt,
    width: image.width,
    height: image.height,
    dataUrl: image.dataUrl,
  };
}

const IMAGE_OPTIONS = ["Lewati soal ini", "Gambarnya saya pasang nanti"];

/** The model's reading → the draft and the questions for the teacher; never a guess. */
export function assembleQuizScript(
  input: QuizScriptInput,
  model: ModelQuizScript,
  images: readonly ScriptImage[],
  honorific = "Bu",
): QuizScriptResult {
  if (!model.readable || model.questions.length === 0)
    return {
      status: "unreadable",
      message: `Nemu tidak menemukan soal di berkas ini, ${honorific}.`,
    };
  const byId = new Map(images.map((image) => [image.id, image]));
  const asks: QuizScriptQuestion[] = [];
  const pad = Math.max(2, String(Math.max(...model.questions.map((q) => q.number))).length);

  const questions: QuizDraftQuestion[] = [...model.questions]
    .sort((a, b) => a.number - b.number)
    .map((read) => {
      const soal = read.number;
      const stem = `soal-${String(soal).padStart(pad, "0")}`;
      if (read.text === null)
        asks.push({
          id: `text-${soal}`,
          kind: "text",
          soal,
          choice: null,
          prompt: `Kalimat soal ${soal} tidak terbaca. Bunyinya apa, ${honorific}?`,
          options: read.text_candidates.slice(0, 3),
        });
      const image = imageFor(read.image, byId, stem, `Gambar soal ${soal}`);
      if (read.image_missing || (read.image && !image))
        asks.push({
          id: `image-${soal}`,
          kind: "image",
          soal,
          choice: null,
          prompt: `Gambar soal ${soal} tidak bisa Nemu ambil dari naskah. Lanjut bagaimana, ${honorific}?`,
          options: IMAGE_OPTIONS,
        });
      const choices: QuizChoice[] = read.choices.map((choice, index) => {
        const label = letter(index);
        if (choice.text === null && !choice.image && !choice.image_missing)
          asks.push({
            id: `text-${soal}-${label}`,
            kind: "text",
            soal,
            choice: index,
            prompt: `Pilihan ${label} soal ${soal} tidak terbaca. Bunyinya apa, ${honorific}?`,
            options: choice.text_candidates.slice(0, 3),
          });
        const picture = imageFor(choice.image, byId, `${stem}-${label}`, `Gambar (${label})`);
        if (choice.image_missing || (choice.image && !picture))
          asks.push({
            id: `image-${soal}-${label}`,
            kind: "image",
            soal,
            choice: index,
            prompt: `Gambar pilihan ${label} soal ${soal} tidak bisa Nemu ambil dari naskah. Lanjut bagaimana, ${honorific}?`,
            options: IMAGE_OPTIONS,
          });
        return { text: choice.text ?? "", image: picture };
      });
      const keyIndex = read.key
        ? choices.findIndex((_, index) => letter(index) === read.key!.trim().toLowerCase()[0])
        : -1;
      if (keyIndex < 0)
        asks.push({
          id: `key-${soal}`,
          kind: "key",
          soal,
          prompt: `Kunci jawaban soal ${soal} tidak ada di naskah. Yang benar yang mana, ${honorific}?`,
          options: choices.slice(0, 3).map((_, index) => letter(index)),
        });
      return {
        number: soal,
        text: read.text ?? "",
        image,
        choices,
        key: keyIndex >= 0 ? keyIndex : null,
      };
    });

  const name = quizName(model.title, input.file.name);
  const section = matchSection(input.sections, model.subject, name);
  if (!section && input.sections.length > 0) {
    // The quiz's own subject first, then the course's other sections (Umum last).
    const options = [...input.sections.slice(1), input.sections[0]!].slice(0, 3);
    if (options.length >= 2)
      asks.push({
        id: "section",
        kind: "section",
        prompt: `Kuis ini masuk ke bagian mana, ${honorific}?`,
        options,
      });
  }
  const times = quizTimesFrom(input.utterance, input.today);
  const folder = [model.subject, model.class_name].filter(Boolean).join(" ");
  const draft: QuizDraft = {
    name,
    section: section ?? (input.sections.length === 1 ? input.sections[0]! : null),
    category: `$course$/top/${folder ? `${folder}/` : ""}${name}`,
    opens: times.opens,
    closes: times.closes,
    questions,
  };
  return { status: "ok", draft, questions: asks };
}

/** The pipeline: pictures out of the file, one model reading, then code (`assembleQuizScript`). */
export async function readQuizScript(
  reader: QuizScriptReader,
  input: QuizScriptInput,
): Promise<QuizScriptResult> {
  const source = await scriptSource(input);
  if (!source)
    return {
      status: "unreadable",
      message: `Nemu belum bisa membaca berkas ini, Bu. Kirim naskahnya sebagai PDF, Word (.docx) atau foto, ya.`,
    };
  const { content, images } = source;
  const model = await reader.llm({
    instructions: INSTRUCTIONS,
    content,
    schemaName: "quiz_script",
    schema: SCRIPT_SCHEMA,
    parse: parseModelScript,
    maxOutputTokens: 12_000,
  });
  return assembleQuizScript(input, model, images);
}
