import { readFile } from "node:fs/promises";

import { chunkKnowledgeDocument } from "./knowledge-chunking.mjs";

function sectionOf(text) {
  return text.match(/^#{1,6}\s+(.+)$/mu)?.[1]?.trim() ?? null;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [columns, ...values] = rows;
  if (!columns) throw new Error("CSV has no header row");
  return values.map((record, rowIndex) => {
    if (record.length !== columns.length) {
      throw new Error(
        `CSV row ${rowIndex + 2} has ${record.length} fields; expected ${columns.length}`,
      );
    }
    return Object.fromEntries(columns.map((column, index) => [column, record[index]]));
  });
}

async function readCsv(dataRoot, path) {
  return parseCsv(await readFile(new URL(path, dataRoot), "utf8"));
}

function numberField(record, field, source) {
  const value = Number(record[field]);
  if (!Number.isFinite(value)) throw new Error(`Invalid number ${source}.${field}`);
  return value;
}

function approvalRulesFromMatrix(markdown, userRows) {
  const userByRole = new Map(userRows.map((user) => [user.peran, user.nama]));
  return markdown
    .split(/\r?\n/u)
    .filter((line) => /^\|\s*\d+\s*\|/u.test(line))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    )
    .map(([row, band, approvers]) => {
      if (!row || !band || !approvers) throw new Error("Invalid MP-BILL-02 approval row");
      const rupiah = band.match(/Rp([\d.]+)/u)?.[1];
      if (!rupiah) throw new Error(`Approval band has no rupiah threshold: ${band}`);
      const threshold = Number(rupiah.replaceAll(".", ""));
      const minimumAmount = /Di atas/iu.test(band) ? threshold + 1 : threshold;
      const roles = approvers.split(/,\s*lalu\s*/iu);
      return {
        id: `MP-BILL-02-${row}`,
        workspaceId: "W-TELKO",
        minimumAmount,
        approvers: roles.map((role) => {
          const name = userByRole.get(role);
          if (!name) throw new Error(`No telco user holds approval role: ${role}`);
          return `${name} (${role})`;
        }),
      };
    });
}

export async function buildTravelWorkspaceSeed(dataRoot) {
  const registry = JSON.parse(
    await readFile(new URL("01_knowledge_rag/document_registry.json", dataRoot), "utf8"),
  );
  const documents = [];
  const chunks = [];
  const sourcePaths = [];

  for (const document of registry) {
    const markdown = await readFile(new URL(document.berkas, dataRoot), "utf8");
    const fileName = document.berkas.split("/").at(-1);
    if (!fileName) throw new Error(`Knowledge source has no file name: ${document.berkas}`);
    const version = document.berlaku_untuk ?? document.berlaku_mulai ?? "1.0";
    sourcePaths.push(document.berkas);
    documents.push({
      id: document.doc_id,
      title: document.judul,
      version,
      isActive: document.status === "aktif",
      status: "ready",
      failureReason: null,
      format: "md",
      fileName,
      contentType: "text/markdown",
      sizeBytes: Buffer.byteLength(markdown),
      storageKey: `seed/travel/${fileName}`,
    });
    chunks.push(
      ...chunkKnowledgeDocument(document, markdown).map((chunk, sequence) => ({
        id: chunk.id,
        documentId: document.doc_id,
        article: chunk.article ?? null,
        section: sectionOf(chunk.text),
        page: chunk.page ?? null,
        sequence,
        text: chunk.text,
      })),
    );
  }

  return { documents, chunks, sourcePaths };
}

export async function buildTelcoWorkspaceSeed(dataRoot) {
  const registry = JSON.parse(
    await readFile(new URL("05_telco/document_registry.json", dataRoot), "utf8"),
  );
  const documents = [];
  const chunks = [];
  const sourcePaths = [];
  const markdownByDocumentId = new Map();

  for (const document of registry) {
    if (document.berkas.includes("06_test-case")) {
      throw new Error(`Evaluator-only source cannot be indexed: ${document.berkas}`);
    }
    const markdown = await readFile(new URL(document.berkas, dataRoot), "utf8");
    markdownByDocumentId.set(document.doc_id, markdown);
    const fileName = document.berkas.split("/").at(-1);
    if (!fileName) throw new Error(`Knowledge source has no file name: ${document.berkas}`);
    sourcePaths.push(document.berkas);
    documents.push({
      id: document.doc_id,
      workspaceId: "W-TELKO",
      title: document.judul,
      version: document.versi,
      isActive: document.status === "aktif",
      status: "ready",
      failureReason: null,
      format: "md",
      fileName,
      contentType: "text/markdown",
      sizeBytes: Buffer.byteLength(markdown),
      storageKey: `seed/telco/${fileName}`,
    });
    chunks.push(
      ...chunkKnowledgeDocument(
        {
          ...document,
          berlaku_untuk: document.versi,
        },
        markdown,
      ).map((chunk, sequence) => ({
        id: chunk.id,
        documentId: document.doc_id,
        article: chunk.article ?? null,
        section: sectionOf(chunk.text),
        page: chunk.page ?? null,
        sequence,
        text: chunk.text,
      })),
    );
  }

  const [claimRows, serviceRows, invoiceRows, ticketRows, rcaRows, userRows] = await Promise.all([
    readCsv(dataRoot, "05_telco/03_data/claims.csv"),
    readCsv(dataRoot, "05_telco/03_data/services.csv"),
    readCsv(dataRoot, "05_telco/03_data/invoices.csv"),
    readCsv(dataRoot, "05_telco/03_data/tickets.csv"),
    readCsv(dataRoot, "05_telco/03_data/rca.csv"),
    readCsv(dataRoot, "05_telco/03_data/users.csv"),
  ]);
  const seed = JSON.parse(await readFile(new URL("05_telco/03_data/seed.json", dataRoot), "utf8"));
  const approvalMatrix = markdownByDocumentId.get("MP-BILL-02-v1.0");
  if (!approvalMatrix) throw new Error("Active approval matrix MP-BILL-02-v1.0 is missing");

  return {
    workspace: {
      id: "W-TELKO",
      name: "Klaim Kompensasi SLA",
      domain: "telco_sla",
      demoDate: seed.demo_clock.slice(0, 10),
    },
    documents,
    chunks,
    sourcePaths,
    claims: claimRows.map((record) => ({
      id: record.claim_id,
      workspaceId: "W-TELKO",
      fixture: record.fixture,
      customer: record.pelanggan,
      letterNumber: record.nomor_surat,
      serviceId: record.service_id,
      period: record.periode,
      letterDate: record.tanggal_surat,
      receivedAt: record.diterima,
      claimedMinutes: Math.round(numberField(record, "jam_diklaim", "claims.csv") * 60),
      invoiceId: record.invoice_disebut,
      notes: record.catatan,
    })),
    services: serviceRows.map((record) => ({
      id: record.service_id,
      workspaceId: "W-TELKO",
      customer: record.pelanggan,
      location: record.lokasi,
      product: record.produk,
      bandwidthMbps: numberField(record, "bandwidth_mbps", "services.csv"),
      monthlyFeeIdr: numberField(record, "abonemen_idr", "services.csv"),
      contractId: record.kontrak_id,
      addendumId: record.adendum_id || null,
      baseSlaBasisPoints: Math.round(numberField(record, "sla_dasar_persen", "services.csv") * 100),
      effectiveSlaBasisPoints: Math.round(
        numberField(record, "sla_berlaku_persen", "services.csv") * 100,
      ),
      activeSince: record.aktif_sejak,
    })),
    invoices: invoiceRows.map((record) => ({
      id: record.invoice_id,
      workspaceId: "W-TELKO",
      serviceId: record.service_id,
      period: record.periode,
      monthlyFeeIdr: numberField(record, "abonemen_sebelum_ppn_idr", "invoices.csv"),
      otherTaxBaseIdr: numberField(record, "dpp_nilai_lain_idr", "invoices.csv"),
      vatIdr: numberField(record, "ppn_12_persen_idr", "invoices.csv"),
      totalIdr: numberField(record, "total_idr", "invoices.csv"),
      issuedOn: record.terbit,
      status: record.status,
    })),
    tickets: ticketRows.map((record) => ({
      id: record.ticket_id,
      workspaceId: "W-TELKO",
      serviceId: record.service_id,
      startedAt: record.mulai,
      recoveredAt: record.pulih,
      durationMinutes: Math.round(numberField(record, "durasi_jam", "tickets.csv") * 60),
      cause: record.penyebab,
      rcaId: record.rca_id || null,
      rcaStatus: record.rca_status,
      reporter: record.pelapor,
      summary: record.ringkasan,
    })),
    rcas: rcaRows.map((record) => ({
      id: record.rca_id,
      workspaceId: "W-TELKO",
      ticketIds: record.tiket.split(";").map((ticket) => ticket.trim()),
      cause: record.penyebab,
      status: record.status,
      approvedBy: record.disahkan_oleh,
      approvedOn: record.tanggal_sah,
      description: record.uraian,
    })),
    users: userRows.map((record) => ({
      id: record.user_id,
      workspaceId: "W-TELKO",
      name: record.nama,
      role: record.peran,
      joinedOn: record.bergabung,
      email: record.email,
    })),
    approvalRules: approvalRulesFromMatrix(approvalMatrix, userRows),
    tasks: seed.tasks.map((task) => ({
      id: task.task_id,
      workspaceId: seed.workspace_id,
      claimId: task.claim_id,
      name: task.name,
      assigneeId: task.assignee,
      createdAt: task.created,
      reviewDueOn: task.due_telaah,
      status: task.status,
    })),
    demoClock: seed.demo_clock,
    loginUserId: seed.login_user,
  };
}

function sqlValue(value) {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "object") return `'${JSON.stringify(value).replaceAll("'", "''")}'`;
  return `'${String(value).replaceAll("'", "''")}'`;
}

function insertStatements(table, columns, records, batchSize = 100) {
  const statements = [];
  for (let start = 0; start < records.length; start += batchSize) {
    const batch = records.slice(start, start + batchSize);
    const values = batch
      .map((record) => `(${columns.map((column) => sqlValue(record[column])).join(", ")})`)
      .join(",\n  ");
    statements.push(
      `INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(", ")}) VALUES\n  ${values};`,
    );
  }
  return statements;
}

export function renderTravelWorkspaceSeedSql(seed) {
  const documents = seed.documents.map((document) => ({
    id: document.id,
    title: document.title,
    version: document.version,
    is_active: document.isActive,
    status: document.status,
    failure_reason: document.failureReason,
    format: document.format,
    file_name: document.fileName,
    content_type: document.contentType,
    size_bytes: document.sizeBytes,
    storage_key: document.storageKey,
  }));
  const chunks = seed.chunks.map((chunk) => ({
    id: chunk.id,
    document_id: chunk.documentId,
    article: chunk.article,
    section: chunk.section,
    page: chunk.page,
    sequence: chunk.sequence,
    text: chunk.text,
  }));
  const statements = [
    "-- Travel knowledge from data/01_knowledge_rag/document_registry.json.",
    "-- Generated by packages/ai/scripts/generate-workspace-seed.mjs; do not edit by hand.",
    ...insertStatements(
      "knowledge_document",
      [
        "id",
        "title",
        "version",
        "is_active",
        "status",
        "failure_reason",
        "format",
        "file_name",
        "content_type",
        "size_bytes",
        "storage_key",
      ],
      documents,
    ),
    ...insertStatements(
      "knowledge_chunk",
      ["id", "document_id", "article", "section", "page", "sequence", "text"],
      chunks,
    ),
  ];
  return `${statements.join("\n--> statement-breakpoint\n")}\n`;
}

export function renderTelcoWorkspaceSeedSql(seed) {
  const documents = seed.documents.map((document) => ({
    id: document.id,
    workspace_id: document.workspaceId,
    title: document.title,
    version: document.version,
    is_active: document.isActive,
    status: document.status,
    failure_reason: document.failureReason,
    format: document.format,
    file_name: document.fileName,
    content_type: document.contentType,
    size_bytes: document.sizeBytes,
    storage_key: document.storageKey,
  }));
  const chunks = seed.chunks.map((chunk) => ({
    id: chunk.id,
    document_id: chunk.documentId,
    article: chunk.article,
    section: chunk.section,
    page: chunk.page,
    sequence: chunk.sequence,
    text: chunk.text,
  }));
  const mapColumns = (records, columns) =>
    records.map((record) => Object.fromEntries(columns.map(([sql, key]) => [sql, record[key]])));
  const statements = [
    "-- Telco SLA workspace from data/05_telco; evaluator-only files are deliberately excluded.",
    "-- Generated by packages/ai/scripts/generate-workspace-seed.mjs; do not edit by hand.",
    ...insertStatements(
      "workspace",
      ["id", "name", "domain", "demo_date"],
      [
        {
          id: "W-TRAVEL",
          name: "Perjalanan Dinas",
          domain: "travel",
          demo_date: "2026-11-06",
        },
        seed.workspace,
      ].map((record) => ({ ...record, demo_date: record.demo_date ?? record.demoDate })),
    ),
    ...insertStatements(
      "knowledge_document",
      [
        "id",
        "workspace_id",
        "title",
        "version",
        "is_active",
        "status",
        "failure_reason",
        "format",
        "file_name",
        "content_type",
        "size_bytes",
        "storage_key",
      ],
      documents,
    ),
    ...insertStatements(
      "knowledge_chunk",
      ["id", "document_id", "article", "section", "page", "sequence", "text"],
      chunks,
    ),
  ];
  const tables = [
    [
      "telco_claim",
      seed.claims,
      [
        ["id", "id"],
        ["workspace_id", "workspaceId"],
        ["fixture", "fixture"],
        ["customer", "customer"],
        ["letter_number", "letterNumber"],
        ["service_id", "serviceId"],
        ["period", "period"],
        ["letter_date", "letterDate"],
        ["received_at", "receivedAt"],
        ["claimed_minutes", "claimedMinutes"],
        ["invoice_id", "invoiceId"],
        ["notes", "notes"],
      ],
    ],
    [
      "telco_service",
      seed.services,
      [
        ["id", "id"],
        ["workspace_id", "workspaceId"],
        ["customer", "customer"],
        ["location", "location"],
        ["product", "product"],
        ["bandwidth_mbps", "bandwidthMbps"],
        ["monthly_fee_idr", "monthlyFeeIdr"],
        ["contract_id", "contractId"],
        ["addendum_id", "addendumId"],
        ["base_sla_basis_points", "baseSlaBasisPoints"],
        ["effective_sla_basis_points", "effectiveSlaBasisPoints"],
        ["active_since", "activeSince"],
      ],
    ],
    [
      "telco_invoice",
      seed.invoices,
      [
        ["id", "id"],
        ["workspace_id", "workspaceId"],
        ["service_id", "serviceId"],
        ["period", "period"],
        ["monthly_fee_idr", "monthlyFeeIdr"],
        ["other_tax_base_idr", "otherTaxBaseIdr"],
        ["vat_idr", "vatIdr"],
        ["total_idr", "totalIdr"],
        ["issued_on", "issuedOn"],
        ["status", "status"],
      ],
    ],
    [
      "telco_ticket",
      seed.tickets,
      [
        ["id", "id"],
        ["workspace_id", "workspaceId"],
        ["service_id", "serviceId"],
        ["started_at", "startedAt"],
        ["recovered_at", "recoveredAt"],
        ["duration_minutes", "durationMinutes"],
        ["cause", "cause"],
        ["rca_id", "rcaId"],
        ["rca_status", "rcaStatus"],
        ["reporter", "reporter"],
        ["summary", "summary"],
      ],
    ],
    [
      "telco_rca",
      seed.rcas,
      [
        ["id", "id"],
        ["workspace_id", "workspaceId"],
        ["ticket_ids", "ticketIds"],
        ["cause", "cause"],
        ["status", "status"],
        ["approved_by", "approvedBy"],
        ["approved_on", "approvedOn"],
        ["description", "description"],
      ],
    ],
    [
      "telco_user",
      seed.users,
      [
        ["id", "id"],
        ["workspace_id", "workspaceId"],
        ["name", "name"],
        ["role", "role"],
        ["joined_on", "joinedOn"],
        ["email", "email"],
      ],
    ],
    [
      "telco_task",
      seed.tasks,
      [
        ["id", "id"],
        ["workspace_id", "workspaceId"],
        ["claim_id", "claimId"],
        ["name", "name"],
        ["assignee_id", "assigneeId"],
        ["created_at", "createdAt"],
        ["review_due_on", "reviewDueOn"],
        ["status", "status"],
      ],
    ],
    [
      "telco_approval_rule",
      seed.approvalRules,
      [
        ["id", "id"],
        ["workspace_id", "workspaceId"],
        ["minimum_amount", "minimumAmount"],
        ["approvers", "approvers"],
      ],
    ],
  ];
  for (const [table, records, columns] of tables) {
    statements.push(
      ...insertStatements(
        table,
        columns.map(([sql]) => sql),
        mapColumns(records, columns),
      ),
    );
  }
  statements.push(
    ...insertStatements(
      "user",
      [
        "id",
        "name",
        "email",
        "email_verified",
        "golongan",
        "unit",
        "province",
        "role",
        "workspace_id",
      ],
      [
        {
          id: seed.loginUserId,
          name: "Dimas Pratama",
          email: "dimas@nemu.demo",
          email_verified: true,
          golongan: "–",
          unit: "Billing Operations",
          province: "DKI Jakarta",
          role: "billing_liaison",
          workspace_id: seed.workspace.id,
        },
      ],
    ),
    "INSERT INTO `account` (`id`, `account_id`, `provider_id`, `user_id`, `password`, `updated_at`) VALUES\n" +
      "  ('dimas-credential', 'U-101', 'credential', 'U-101', '49e9b86fb953e6d5f6c48e1f42bf0eb4:d2156e273c62a12a359b08c866156b0fec64dc702481bfd5d54ffa35d0f788c9f4ff2474bd9b90de891e8252070baf68a4914aff81734fd3a4969ced1719fe06', cast(unixepoch('subsecond') * 1000 as integer));",
  );
  return `${statements.join("\n--> statement-breakpoint\n")}\n`;
}
