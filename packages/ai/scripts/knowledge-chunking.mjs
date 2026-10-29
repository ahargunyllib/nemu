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

/** Deterministically splits a Markdown knowledge source at page, article, or guide boundaries. */
export function chunkKnowledgeDocument(document, markdown) {
  const lines = markdown.split(/\r?\n/u);
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

  function flush() {
    const text = currentLines.join("\n").trim();
    currentLines = [];
    if (!text || !hasSubstantiveText(text) || (splitGuideSections && section === 0)) {
      return;
    }

    const legalLocation = article
      ? paragraph
        ? `${article} ayat (${paragraph})`
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
