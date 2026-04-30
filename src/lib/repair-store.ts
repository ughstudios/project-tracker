import { prisma } from "@/lib/prisma";
import { parseProcessorRmaSubmission, type ProcessorRmaPayload } from "@/lib/pending-customer-request-payload";
import { isAllowedRepairProductName, normalizeRepairProductName } from "@/lib/repair-products";
import { SEEDED_REPAIRS, type RepairRow, type RepairStatus, normalizeStatus } from "@/lib/repairs";

type DbRepairRow = {
  id: string;
  quantity: number;
  model: string;
  repair_type: string;
  issue_description: string;
  company: string;
  contact_name: string;
  contact_email: string;
  phone_number: string;
  rma_number: string;
  rma_form_url: string;
  firmware: string;
  serial_number: string;
  purchase_number: string;
  date_purchased: string;
  usage_environment: string;
  mailing_address: string;
  photo_count: number;
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
  const photoLines = payload.files.map((file) => `- ${file.originalName}: ${file.storagePath}`);
  return [
    `Public RMA submission ${payload.id}`,
    `Submitted: ${payload.submittedAt}`,
    `Contact: ${payload.contactName}`,
    `Email: ${payload.contactEmail}`,
    `Phone: ${payload.phoneNumber}`,
    photoLines.length > 0 ? `Photos:\n${photoLines.join("\n")}` : "Photos: none",
    payload.attachmentWarnings?.length ? `Attachment warnings:\n${payload.attachmentWarnings.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function mailingAddressText(payload: ProcessorRmaPayload): string {
  if (payload.mailingAddress) {
    return [
      payload.mailingAddress.line1,
      payload.mailingAddress.line2,
      `${payload.mailingAddress.city}, ${payload.mailingAddress.stateProvince} ${payload.mailingAddress.postalCode}`,
      payload.mailingAddress.countryName,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return payload.address ?? "";
}

function toRepairRow(row: DbRepairRow): RepairRow {
  return {
    id: row.id,
    quantity: row.quantity,
    model: normalizeRepairProductName(row.model),
    repairType: row.repair_type,
    issueDescription: row.issue_description || row.repair_type,
    company: row.company,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    phoneNumber: row.phone_number,
    rmaNumber: row.rma_number,
    rmaFormUrl: row.rma_form_url,
    firmware: row.firmware,
    serialNumber: row.serial_number,
    purchaseNumber: row.purchase_number,
    datePurchased: row.date_purchased,
    usageEnvironment: row.usage_environment,
    mailingAddress: row.mailing_address,
    photoCount: row.photo_count,
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
      issue_description TEXT NOT NULL DEFAULT '',
      company TEXT NOT NULL DEFAULT '',
      contact_name TEXT NOT NULL DEFAULT '',
      contact_email TEXT NOT NULL DEFAULT '',
      phone_number TEXT NOT NULL DEFAULT '',
      rma_number TEXT NOT NULL DEFAULT '',
      rma_form_url TEXT NOT NULL DEFAULT '',
      firmware TEXT NOT NULL DEFAULT '',
      serial_number TEXT NOT NULL DEFAULT '',
      purchase_number TEXT NOT NULL DEFAULT '',
      date_purchased TEXT NOT NULL DEFAULT '',
      usage_environment TEXT NOT NULL DEFAULT '',
      mailing_address TEXT NOT NULL DEFAULT '',
      photo_count INTEGER NOT NULL DEFAULT 0,
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
  for (const column of [
    "issue_description TEXT NOT NULL DEFAULT ''",
    "contact_name TEXT NOT NULL DEFAULT ''",
    "contact_email TEXT NOT NULL DEFAULT ''",
    "phone_number TEXT NOT NULL DEFAULT ''",
    "firmware TEXT NOT NULL DEFAULT ''",
    "serial_number TEXT NOT NULL DEFAULT ''",
    "purchase_number TEXT NOT NULL DEFAULT ''",
    "date_purchased TEXT NOT NULL DEFAULT ''",
    "usage_environment TEXT NOT NULL DEFAULT ''",
    "mailing_address TEXT NOT NULL DEFAULT ''",
    "photo_count INTEGER NOT NULL DEFAULT 0",
  ]) {
    await prisma.$executeRawUnsafe(`ALTER TABLE processor_repairs ADD COLUMN IF NOT EXISTS ${column}`);
  }

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
      id, quantity, model, repair_type, issue_description, company, rma_number, rma_form_url,
      assigned_to, repaired_by, status, notes, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz, $14::timestamptz)
      ON CONFLICT (id) DO NOTHING
      `,
      row.id,
      row.quantity,
      row.model,
      row.repairType,
      row.issueDescription,
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

async function assertEmployeeName(employee: string): Promise<string> {
  const trimmed = employee.trim();
  if (!trimmed) return "";
  const user = await prisma.user.findFirst({
    where: {
      approvalStatus: "APPROVED",
      OR: [{ name: trimmed }, { email: trimmed }],
    },
    select: { name: true, email: true },
  });
  if (!user) {
    throw new Error("Repaired By must be selected from approved employees.");
  }
  return user.name || user.email;
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
      id, quantity, model, repair_type, issue_description, company, contact_name, contact_email,
      phone_number, rma_number, rma_form_url, firmware, serial_number, purchase_number,
      date_purchased, usage_environment, mailing_address, photo_count,
      assigned_to, repaired_by, status, notes, created_at, updated_at
    )
    VALUES ($1, 1, $2, 'Processor RMA', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, '', '', 'OPEN', $17, $18::timestamptz, NOW())
    ON CONFLICT (id) DO UPDATE SET
      model = EXCLUDED.model,
      repair_type = EXCLUDED.repair_type,
      issue_description = EXCLUDED.issue_description,
      company = EXCLUDED.company,
      contact_name = EXCLUDED.contact_name,
      contact_email = EXCLUDED.contact_email,
      phone_number = EXCLUDED.phone_number,
      rma_number = EXCLUDED.rma_number,
      rma_form_url = COALESCE(NULLIF(EXCLUDED.rma_form_url, ''), processor_repairs.rma_form_url),
      firmware = EXCLUDED.firmware,
      serial_number = EXCLUDED.serial_number,
      purchase_number = EXCLUDED.purchase_number,
      date_purchased = EXCLUDED.date_purchased,
      usage_environment = EXCLUDED.usage_environment,
      mailing_address = EXCLUDED.mailing_address,
      photo_count = EXCLUDED.photo_count,
      notes = EXCLUDED.notes,
      archived_at = NULL
    `,
    processorRmaRepairId(payload.id),
    model,
    payload.issueDescription,
    customer.name,
    payload.contactName,
    payload.contactEmail,
    payload.phoneNumber,
    payload.id.slice(0, 8),
    rmaFormUrl,
    payload.firmware,
    payload.serialNumber,
    payload.purchaseNumber,
    payload.datePurchased,
    payload.usageEnvironment,
    mailingAddressText(payload),
    payload.files.length,
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
  const repairedBy = await assertEmployeeName(row.repairedBy);
  const inserted = await prisma.$queryRawUnsafe<DbRepairRow[]>(
    `
    INSERT INTO processor_repairs (
      id, quantity, model, repair_type, issue_description, company, contact_name, contact_email,
      phone_number, rma_number, rma_form_url, firmware, serial_number, purchase_number,
      date_purchased, usage_environment, mailing_address, photo_count,
      assigned_to, repaired_by, status, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
    RETURNING *
    `,
    row.id,
    row.quantity,
    model,
    row.repairType,
    row.issueDescription,
    company,
    row.contactName,
    row.contactEmail,
    row.phoneNumber,
    row.rmaNumber,
    row.rmaFormUrl,
    row.firmware,
    row.serialNumber,
    row.purchaseNumber,
    row.datePurchased,
    row.usageEnvironment,
    row.mailingAddress,
    row.photoCount,
    "",
    repairedBy,
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
  const repairedBy = patch.repairedBy !== undefined ? await assertEmployeeName(next.repairedBy) : next.repairedBy;

  const updated = await prisma.$queryRawUnsafe<DbRepairRow[]>(
    `
    UPDATE processor_repairs
    SET quantity = $2,
        model = $3,
        repair_type = $4,
        issue_description = $5,
        company = $6,
        contact_name = $7,
        contact_email = $8,
        phone_number = $9,
        rma_number = $10,
        firmware = $11,
        serial_number = $12,
        purchase_number = $13,
        date_purchased = $14,
        usage_environment = $15,
        mailing_address = $16,
        photo_count = $17,
        assigned_to = '',
        repaired_by = $18,
        status = $19,
        notes = $20,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    id,
    Math.max(0, Math.trunc(next.quantity || 0)),
    model,
    next.repairType,
    next.issueDescription,
    company,
    next.contactName,
    next.contactEmail,
    next.phoneNumber,
    next.rmaNumber,
    next.firmware,
    next.serialNumber,
    next.purchaseNumber,
    next.datePurchased,
    next.usageEnvironment,
    next.mailingAddress,
    next.photoCount,
    repairedBy,
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
