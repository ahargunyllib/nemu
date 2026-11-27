function chunkBase(document, text, id, page, article) {
  return {
    id: `${document.doc_id}-${id}`,
    docId: document.doc_id,
    title: document.judul,
    version: document.berlaku_untuk ?? document.berlaku_mulai ?? "1.0",
    ...(article ? { article } : {}),
    ...(page ? { page } : {}),
    active: document.status === "aktif",
    text,
  };
}

function hasSubstantiveText(text) {
  return text.replace(/^```(?:text)?\s*$/gmu, "").trim().length > 0;
}

const NUMBERED_POINT = /^(\d{1,2}(?:\.\d{1,2})+)\.?\s+\p{L}/u;
const NUMBERED_HEADING = /^(\d{1,2})\.\s+\p{Lu}/u;

/** "5.1 Guru: menilai. 5.2 Wali kelas: …" → one line per point, when a PDF run them together. */
function splitInlinePoints(line) {
  return line.split(/(?<=[.;:])\s+(?=\d{1,2}(?:\.\d{1,2})+\s+\p{Lu})/u);
}

/**
 * Deterministically splits a Markdown knowledge source at page, article, or guide boundaries.
 * Numbered points ("3.2 Kriteria …") are points of their own: the article of a document without
 * Pasal headings ("3.2"), or a decimal ayat inside a Pasal ("3 ayat 3.2").
 */
export function chunkKnowledgeDocument(document, markdown) {
  const rawLines = markdown.split(/\r?\n/u);
  const hasNumberedPoints = rawLines.some((line) => NUMBERED_POINT.test(line.trim()));
  const lines = hasNumberedPoints ? rawLines.flatMap(splitInlinePoints) : rawLines;
  const hasPageMarkers = lines.some((line) => /^\[Halaman \d+(?:-\d+)?\]\s*$/u.test(line.trim()));
  const hasLegalHeadings = lines.some((line) =>
    /^(?:#{1,6}\s+)?Pasal\s+\d+[A-Z]?(?:[.\s].*)?$/iu.test(line.trim()),
  );
  const hasGuideHeadings = lines.some((line) => /^##\s+/u.test(line.trim()));
  const splitGuideSections = !hasPageMarkers && !hasLegalHeadings && hasGuideHeadings;
  const chunks = [];
  const usedIds = new Map();
  let currentLines = [];
  let page;
  let article;
  let paragraph;
  let section = 0;
  let headingLine;

  function flush() {
    const text = currentLines.join("\n").trim();
    currentLines = [];
    if (!text || !hasSubstantiveText(text) || (splitGuideSections && section === 0)) {
      return;
    }

    const legalLocation = article
      ? paragraph
        ? paragraph.includes(".")
          ? `${article} ayat ${paragraph}`
          : `${article} ayat (${paragraph})`
        : article
      : undefined;
    const baseId = page
      ? `page-${page}${article ? `-pasal-${article.toLowerCase()}` : ""}${paragraph ? `-ayat-${paragraph.toLowerCase()}` : ""}`
      : article
        ? `pasal-${article.toLowerCase()}${paragraph ? `-ayat-${paragraph.toLowerCase()}` : ""}`
        : splitGuideSections && section
          ? `section-${section}`
          : "document";
    const occurrence = (usedIds.get(baseId) ?? 0) + 1;
    usedIds.set(baseId, occurrence);
    const id = occurrence === 1 ? baseId : `${baseId}-${occurrence}`;

    chunks.push(chunkBase(document, text, id, page, legalLocation));
  }

  for (const line of lines) {
    const trimmed = line.trim();
    const pageMatch = trimmed.match(/^\[Halaman (\d+)(?:-\d+)?\]\s*$/u);
    if (pageMatch) {
      flush();
      page = Number(pageMatch[1]);
      continue;
    }

    if (/^LAMPIRAN\s+(?:[IVXLCDM]+|\d+)$/iu.test(trimmed)) {
      flush();
      article = undefined;
      paragraph = undefined;
      currentLines.push(line);
      continue;
    }

    const articleMatch = trimmed.match(/^(?:#{1,6}\s+)?Pasal\s+(\d+[A-Z]?)(?:[.\s].*)?$/iu);
    if (articleMatch) {
      flush();
      article = articleMatch[1].toUpperCase();
      paragraph = undefined;
      headingLine = trimmed;
      currentLines.push(line);
      continue;
    }

    const pointMatch = hasNumberedPoints ? trimmed.match(NUMBERED_POINT) : null;
    if (pointMatch) {
      const onlyHeading =
        currentLines.filter((candidate) => candidate.trim()).length === 1 &&
        headingLine === currentLines.find((candidate) => candidate.trim())?.trim();
      if (!onlyHeading) flush();
      if (hasLegalHeadings && article) paragraph = pointMatch[1];
      else article = pointMatch[1];
      currentLines.push(line);
      continue;
    }

    if (hasNumberedPoints && !hasLegalHeadings && NUMBERED_HEADING.test(trimmed)) {
      flush();
      article = trimmed.match(NUMBERED_HEADING)[1];
      paragraph = undefined;
      headingLine = trimmed;
      currentLines.push(line);
      continue;
    }

    const previousLine = currentLines.findLast((candidate) => candidate.trim().length > 0)?.trim();
    const isWrappedReference = previousLine ? /\bayat$/iu.test(previousLine) : false;
    const paragraphMatch =
      article && !isWrappedReference ? trimmed.match(/^\((\d+[A-Z]?)\)(?:\s|$)/iu) : null;
    if (paragraphMatch) {
      flush();
      paragraph = paragraphMatch[1].toLowerCase();
      currentLines.push(line);
      continue;
    }

    if (splitGuideSections && /^##\s+/u.test(trimmed)) {
      flush();
      section += 1;
    }
    currentLines.push(line);
  }

  flush();
  return chunks;
}
