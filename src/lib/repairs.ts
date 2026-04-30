import { REPAIR_PRODUCT_OPTIONS } from "@/lib/repair-products";

export type RepairStatus = "OPEN" | "IN_PROGRESS" | "DONE";

export type RepairRow = {
  id: string;
  model: string;
  repairType: string;
  issueDescription: string;
  company: string;
  contactName: string;
  contactEmail: string;
  phoneNumber: string;
  rmaNumber: string;
  rmaFormUrl: string;
  firmware: string;
  serialNumber: string;
  purchaseNumber: string;
  datePurchased: string;
  usageEnvironment: string;
  mailingAddress: string;
  photoCount: number;
  assignedTo: string;
  repairedBy: string;
  status: RepairStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export const REPAIR_STORAGE_KEY = "issue-tracker.repairs.v1";
export const REPAIR_SEED_KEY = "issue-tracker.repairs.seeded.processor-list.v1";

export const SEEDED_REPAIRS: RepairRow[] = [];

export function makeBlankRepair(): RepairRow {
  const now = new Date().toISOString();
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `repair-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    model: REPAIR_PRODUCT_OPTIONS[0] ?? "",
    repairType: "Processor repair",
    issueDescription: "",
    company: "",
    contactName: "",
    contactEmail: "",
    phoneNumber: "",
    rmaNumber: "",
    rmaFormUrl: "",
    firmware: "",
    serialNumber: "",
    purchaseNumber: "",
    datePurchased: "",
    usageEnvironment: "",
    mailingAddress: "",
    photoCount: 0,
    assignedTo: "",
    repairedBy: "",
    status: "OPEN",
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeStatus(value: string): RepairStatus {
  if (value === "DONE" || value === "IN_PROGRESS") return value;
  return "OPEN";
}

export function mergeSeedOnce(
  existing: RepairRow[],
  seedWasApplied: boolean,
): RepairRow[] {
  if (seedWasApplied) return existing;
  const existingIds = new Set(existing.map((row) => row.id));
  return [
    ...existing,
    ...SEEDED_REPAIRS.filter((row) => !existingIds.has(row.id)),
  ];
}

export function repairUnitTotal(rows: RepairRow[]): number {
  return rows.length;
}

export function groupRepairUnits(
  rows: RepairRow[],
  key: keyof Pick<
    RepairRow,
    "company" | "assignedTo" | "repairedBy" | "status"
  >,
) {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const label = String(row[key] || "Unassigned");
    grouped.set(label, (grouped.get(label) ?? 0) + 1);
  }
  return [...grouped.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
