import { prisma } from "@/lib/prisma";
import { parseProcessorRmaSubmission, type ProcessorRmaPayload } from "@/lib/pending-customer-request-payload";
import { isAllowedRepairProductName, normalizeRepairProductName } from "@/lib/repair-products";
import { SEEDED_REPAIRS, type RepairRow, type RepairStatus, normalizeStatus } from "@/lib/repairs";

type DbRepairRow = {
  id: string;
  quantity: number;
  model: string;
  repair_type: string;
  company: string;
  rma_number: string;
  rma_form_url: string;
  assigned_to: string;
  repaired_by: string;
  status: string;
  notes: string;
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
};

const seedKey = "processor-repair-seed-2026-04-29";

function processorRmaRepairId(submissionId: string): string {
  return `rma-${submissionId}`;
}

function processorRmaNotes(payload: ProcessorRmaPayload): string {
  const mailing = payload.mailingAddress
    ? [
        payload.mailingAddress.line1,
        payload.mailingAddress.line2,
        `${payload.mailingAddress.city}, ${payload.mailingAddress.stateProvince} ${payload.mailingAddress.postalCode}`,
        payload.mailingAddress.countryName,
      ]
        .filter(Boolean)
        .join("\n")
    : payload.address;
  const photoLines = payload.files.map((file) => `- ${file.originalName}: ${file.storagePath}`);
  return [
    `Public RMA submission ${payload.id}`,
    `Submitted: ${payload.submittedAt}`,
    `Contact: ${payload.contactName}`,
    `Email: ${payload.contactEmail}`,
    `Phone: ${payload.phoneNumber}`,
    mailing ? `Mailing address:\n${mailing}` : "",
    `Firmware: ${payload.firmware || "-"}`,
    `Serial: ${payload.serialNumber || "-"}`,
    `Purchase number: ${payload.purchaseNumber || "-"}`,
    `Date purchased: ${payload.datePurchased || "-"}`,
    `Issue:\n${payload.issueDescription || "-"}`,
    `Usage environment:\n${payload.usageEnvironment || "-"}`,
    photoLines.length > 0 ? `Photos:\n${photoLines.join("\n")}` : "Photos: none",
    payload.attachmentWarnings?.length ? `Attachment warnings:\n${payload.attachmentWarnings.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function toRepairRow(row: DbRepairRow): RepairRow {
  return {
    id: row.id,
    quantity: row.quantity,
    model: normalizeRepairProductName(row.model),
    repairType: row.repair_type,
    company: row.company,
    rmaNumber: row.rma_number,
    rmaFormUrl: row.rma_form_url,
    assignedTo: row.assigned_to,
    repairedBy: row.repaired_by,
    status: normalizeStatus(row.status),
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function ensureRepairTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS processor_repairs (
      id TEXT PRIMARY KEY,
      quantity INTEGER NOT NULL DEFAULT 1,
      model TEXT NOT NULL DEFAULT '',
      repair_type TEXT NOT NULL DEFAULT '',
      company TEXT NOT NULL DEFAULT '',
      rma_number TEXT NOT NULL DEFAULT '',
      rma_form_url TEXT NOT NULL DEFAULT '',
      assigned_to TEXT NOT NULL DEFAULT '',
      repaired_by TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'OPEN',
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      archived_at TIMESTAMPTZ
    )
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE processor_repairs
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS app_seed_markers (
      seed_key TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function seedRepairsOnce() {
  await ensureRepairTables();
  const markers = await prisma.$queryRawUnsafe<Array<{ seed_key: string }>>(
    `SELECT seed_key FROM app_seed_markers WHERE seed_key = $1 LIMIT 1`,
    seedKey,
  );
  if (markers.length > 0) return;

  for (const row of SEEDED_REPAIRS) {
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO processor_repairs (
        id, quantity, model, repair_type, company, rma_number, rma_form_url,
        assigned_to, repaired_by, status, notes, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamptz, $13::timestamptz)
      ON CONFLICT (id) DO NOTHING
      `,
      row.id,
      row.quantity,
      row.model,
      row.repairType,
      row.company,
      row.rmaNumber,
      row.rmaFormUrl,
      row.assignedTo,
      row.repairedBy,
      row.status,
      row.notes,
      row.createdAt,
      row.updatedAt,
    );
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO app_seed_markers (seed_key) VALUES ($1) ON CONFLICT (seed_key) DO NOTHING`,
    seedKey,
  );
}

async function assertRepairProduct(model: string): Promise<string> {
  const normalized = normalizeRepairProductName(model);
  if (!normalized || !isAllowedRepairProductName(normalized)) {
    throw new Error("Processor must be selected from the product catalog.");
  }
  return normalized;
}

async function assertCustomerName(company: string): Promise<string> {
  const trimmed = company.trim();
  if (!trimmed) return "";
  const customer = await prisma.customer.findFirst({
    where: { name: trimmed, archivedAt: null },
    select: { name: true },
  });
  if (!customer) {
    throw new Error("Company must be selected from Customers.");
  }
  return customer.name;
}

export async function upsertProcessorRmaRepair(payload: ProcessorRmaPayload, rmaFormUrl = "") {
  await ensureRepairTables();
  const model = await assertRepairProduct(payload.processorModel);
  const customer = await prisma.customer.upsert({
    where: { name: payload.companyName },
    update: { archivedAt: null },
    create: { name: payload.companyName },
    select: { name: true },
  });
  await prisma.$executeRawUnsafe(
    `
    INSERT INTO processor_repairs (
      id, quantity, model, repair_type, company, rma_number, rma_form_url,
      assigned_to, repaired_by, status, notes, created_at, updated_at
    )
    VALUES ($1, 1, $2, 'Processor RMA', $3, $4, $5, '', '', 'OPEN', $6, $7::timestamptz, NOW())
    ON CONFLICT (id) DO UPDATE SET
      model = EXCLUDED.model,
      repair_type = EXCLUDED.repair_type,
      company = EXCLUDED.company,
      rma_number = EXCLUDED.rma_number,
      rma_form_url = COALESCE(NULLIF(EXCLUDED.rma_form_url, ''), processor_repairs.rma_form_url),
      notes = EXCLUDED.notes,
      archived_at = NULL
    `,
    processorRmaRepairId(payload.id),
    model,
    customer.name,
    payload.id.slice(0, 8),
    rmaFormUrl,
    processorRmaNotes(payload),
    payload.submittedAt,
  );
}

export async function migratePendingProcessorRmasToRepairs(): Promise<number> {
  await ensureRepairTables();
  const tickets = await prisma.publicCustomerRequest.findMany({
    where: { kind: "PROCESSOR_RMA" },
    select: { submissionId: true, sourceAuditLogId: true },
  });
  if (tickets.length === 0) return 0;

  let moved = 0;
  for (const ticket of tickets) {
    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "CREATE",
        entityType: "PublicProcessorRmaRequest",
        OR: [
          ...(ticket.sourceAuditLogId ? [{ id: ticket.sourceAuditLogId }] : []),
          { entityId: ticket.submissionId },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    if (!audit) continue;
    const payload = parseProcessorRmaSubmission(audit.description);
    if (!payload) continue;

    await upsertProcessorRmaRepair(
      payload,
      `/uploads/public-form-submissions/${payload.id}/submission.json`,
    );
    await prisma.publicCustomerRequest.delete({ where: { submissionId: ticket.submissionId } });
    moved += 1;
  }
  return moved;
}

export async function listRepairs(): Promise<RepairRow[]> {
  await migratePendingProcessorRmasToRepairs();
  await seedRepairsOnce();
  const rows = await prisma.$queryRawUnsafe<DbRepairRow[]>(`
    SELECT *
    FROM processor_repairs
    WHERE archived_at IS NULL
    ORDER BY created_at ASC, id ASC
  `);
  return rows.map(toRepairRow);
}

export async function createRepair(row: RepairRow): Promise<RepairRow> {
  await ensureRepairTables();
  const model = await assertRepairProduct(row.model);
  const company = await assertCustomerName(row.company);
  const inserted = await prisma.$queryRawUnsafe<DbRepairRow[]>(
    `
    INSERT INTO processor_repairs (
      id, quantity, model, repair_type, company, rma_number, rma_form_url,
      assigned_to, repaired_by, status, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
    `,
    row.id,
    row.quantity,
    model,
    row.repairType,
    company,
    row.rmaNumber,
    row.rmaFormUrl,
    row.assignedTo,
    row.repairedBy,
    row.status,
    row.notes,
  );
  return toRepairRow(inserted[0]);
}

export async function updateRepair(id: string, patch: Partial<RepairRow>): Promise<RepairRow | null> {
  await ensureRepairTables();
  const current = await prisma.$queryRawUnsafe<DbRepairRow[]>(`SELECT * FROM processor_repairs WHERE id = $1 LIMIT 1`, id);
  if (current.length === 0) return null;
  const row = toRepairRow(current[0]);
  const next = { ...row, ...patch, status: patch.status ? normalizeStatus(patch.status) : row.status };
  const model = await assertRepairProduct(next.model);
  const company = await assertCustomerName(next.company);

  const updated = await prisma.$queryRawUnsafe<DbRepairRow[]>(
    `
    UPDATE processor_repairs
    SET quantity = $2,
        model = $3,
        repair_type = $4,
        company = $5,
        rma_number = $6,
        assigned_to = $7,
        repaired_by = $8,
        status = $9,
        notes = $10,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    id,
    Math.max(0, Math.trunc(next.quantity || 0)),
    model,
    next.repairType,
    company,
    next.rmaNumber,
    next.assignedTo,
    next.repairedBy,
    next.status,
    next.notes,
  );
  return toRepairRow(updated[0]);
}

export async function archiveRepair(id: string) {
  await ensureRepairTables();
  await prisma.$executeRawUnsafe(
    `
    UPDATE processor_repairs
    SET archived_at = COALESCE(archived_at, NOW()),
        updated_at = NOW()
    WHERE id = $1
    `,
    id,
  );
}

export function isRepairStatus(value: unknown): value is RepairStatus {
  return value === "OPEN" || value === "IN_PROGRESS" || value === "DONE";
}
