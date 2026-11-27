import { bytesToBase64 } from "../llm.js";
import type { ScriptImage } from "./pdf-images.js";

/**
 * F4-03: a Word script (.docx) read in code: its paragraphs as text, each picture where it sits
 * as "[gambar-N]", and the pictures themselves (PNG or JPEG) taken out of `word/media` as they
 * are. Word's own list numbering is written out ("1.", "a.") so the model sees the labels the
 * teacher sees. Other picture formats (EMF, WMF) are left out, and a question that needs one is
 * asked.
 */

export type DocxScript = { text: string; images: ScriptImage[] };

const ZIP_ROOT = "Root Entry/";

function entities(text: string): string {
  return text
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&#(\d+);/gu, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/gu, "&");
}

function size(bytes: Uint8Array): { width: number; height: number; mime: string } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length > 24 && view.getUint32(0) === 0x89504e47)
    return { width: view.getUint32(16), height: view.getUint32(20), mime: "image/png" };
  if (bytes.length > 4 && view.getUint16(0) === 0xffd8) {
    for (let at = 2; at + 9 < bytes.length;) {
      const marker = view.getUint16(at);
      if (marker >= 0xffc0 && marker <= 0xffcf && ![0xffc4, 0xffc8, 0xffcc].includes(marker))
        return {
          height: view.getUint16(at + 5),
          width: view.getUint16(at + 7),
          mime: "image/jpeg",
        };
      at += 2 + view.getUint16(at + 2);
    }
  }
  return null;
}

export async function readDocx(bytes: Uint8Array): Promise<DocxScript> {
  const { CFB } = await import("xlsx");
  const zip = CFB.read(bytes, { type: "array" }) as {
    FullPaths: string[];
    FileIndex: Array<{ content: Uint8Array | number[] }>;
  };
  const file = (path: string) => {
    const index = zip.FullPaths.indexOf(`${ZIP_ROOT}${path}`);
    return index < 0 ? null : new Uint8Array(zip.FileIndex[index]!.content);
  };
  const utf8 = (path: string) => {
    const content = file(path);
    return content ? new TextDecoder().decode(content) : "";
  };
  const document = utf8("word/document.xml");
  if (!document) throw new Error("Not a Word document");

  const targets = new Map(
    [...utf8("word/_rels/document.xml.rels").matchAll(/<Relationship\b[^>]*>/gu)].map(([tag]) => [
      tag.match(/\bId="([^"]+)"/u)?.[1] ?? "",
      (tag.match(/\bTarget="([^"]+)"/u)?.[1] ?? "").replace(/^\/?(word\/)?/u, ""),
    ]),
  );
  const images: ScriptImage[] = [];
  const imageFor = new Map<string, string>();
  const picture = (relation: string): string => {
    const known = imageFor.get(relation);
    if (known) return known;
    const content = file(`word/${targets.get(relation) ?? ""}`);
    const found = content ? size(content) : null;
    if (!content || !found) return "[gambar yang tidak bisa diambil]";
    const id = `gambar-${images.length + 1}`;
    images.push({
      id,
      page: null,
      width: found.width,
      height: found.height,
      dataUrl: `data:${found.mime};base64,${bytesToBase64(content)}`,
    });
    imageFor.set(relation, id);
    return `[${id}]`;
  };

  // numId → abstractNumId → each level's format ("decimal", "lowerLetter" …), word/numbering.xml.
  const numbering = utf8("word/numbering.xml");
  const abstractOf = new Map(
    [
      ...numbering.matchAll(
        /<w:num\b[^>]*w:numId="(\d+)"[^>]*>\s*<w:abstractNumId w:val="(\d+)"/gu,
      ),
    ].map(([, num, abstract]) => [num!, abstract!]),
  );
  const formats = new Map<string, string>();
  for (const [body, abstract] of numbering.matchAll(
    /<w:abstractNum\b[^>]*w:abstractNumId="(\d+)"[\s\S]*?<\/w:abstractNum>/gu,
  ))
    for (const [, level, format] of body.matchAll(
      /<w:lvl\b[^>]*w:ilvl="(\d+)"[\s\S]*?<w:numFmt w:val="(\w+)"/gu,
    ))
      formats.set(`${abstract}:${level}`, format!);
  const label = (numId: string, level: number, count: number) => {
    const format = formats.get(`${abstractOf.get(numId)}:${level}`);
    if (format === "upperLetter") return String.fromCharCode(64 + count);
    if (format === "lowerLetter" || (!format && level > 0)) return String.fromCharCode(96 + count);
    return String(count);
  };

  const counters = new Map<string, number[]>();
  const lines: string[] = [];
  for (const [paragraph] of document.matchAll(/<w:p\b[\s\S]*?<\/w:p>/gu)) {
    let line = "";
    for (const [token] of paragraph.matchAll(
      /<w:t\b[^>]*>[^<]*<\/w:t>|<w:tab\/>|<w:br\/>|r:embed="[^"]+"|<v:imagedata\b[^>]*>/gu,
    )) {
      if (token.startsWith("<w:t")) line += entities(token.replace(/<[^>]+>/gu, ""));
      else if (token === "<w:tab/>") line += " ";
      else if (token === "<w:br/>") line += "\n";
      else line += ` ${picture(token.match(/r:(?:embed|id)="([^"]+)"/u)?.[1] ?? "")} `;
    }
    const numId = paragraph.match(/<w:numId w:val="(\d+)"/u)?.[1];
    if (numId && numId !== "0") {
      const level = Number(paragraph.match(/<w:ilvl w:val="(\d+)"/u)?.[1] ?? 0);
      const count = counters.get(numId) ?? [];
      count[level] = (count[level] ?? 0) + 1;
      count.length = level + 1;
      counters.set(numId, count);
      line = `${label(numId, level, count[level]!)}. ${line}`;
    }
    lines.push(line.replace(/[ \t]+/gu, " ").trim());
  }
  return {
    text: lines
      .join("\n")
      .replace(/\n{3,}/gu, "\n\n")
      .trim(),
    images,
  };
}
