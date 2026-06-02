import { csvRow } from "@/lib/csv";
import { formatDateTimeUtc } from "@/lib/report-dates";
import type { RepairRow, RepairStatus } from "@/lib/repairs";

const statusLabels: Record<RepairStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

function formatIsoDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatDateTimeUtc(date);
}

const REPAIRED_PRODUCT_COLUMNS: Array<{
  header: string;
  cell: (row: RepairRow) => string | number;
}> = [
  { header: "Product", cell: (row) => row.model },
  { header: "Serial #", cell: (row) => row.serialNumber },
  { header: "Company", cell: (row) => row.company },
  { header: "RMA #", cell: (row) => row.rmaNumber },
  { header: "Contact name", cell: (row) => row.contactName },
  { header: "Contact email", cell: (row) => row.contactEmail },
  { header: "Phone", cell: (row) => row.phoneNumber },
  { header: "Firmware", cell: (row) => row.firmware },
  { header: "Purchase #", cell: (row) => row.purchaseNumber },
  { header: "Date purchased", cell: (row) => row.datePurchased },
  { header: "Issue description", cell: (row) => row.issueDescription },
  { header: "Broken parts / components", cell: (row) => row.brokenParts },
  { header: "Solution notes", cell: (row) => row.notes },
  { header: "Repaired by", cell: (row) => row.repairedBy },
  { header: "Status", cell: (row) => statusLabels[row.status] },
  { header: "Created", cell: (row) => formatIsoDateTime(row.createdAt) },
  { header: "Last updated", cell: (row) => formatIsoDateTime(row.updatedAt) },
  { header: "RMA form", cell: (row) => row.rmaFormUrl },
  { header: "Usage environment", cell: (row) => row.usageEnvironment },
  { header: "Mailing address", cell: (row) => row.mailingAddress },
  { header: "Photo count", cell: (row) => row.photoCount },
];

export function repairedProductsToCsv(rows: RepairRow[]): string {
  const lines = [
    csvRow(REPAIRED_PRODUCT_COLUMNS.map((column) => column.header)),
  ];
  for (const row of rows) {
    lines.push(
      csvRow(REPAIRED_PRODUCT_COLUMNS.map((column) => column.cell(row))),
    );
  }
  return lines.join("");
}
