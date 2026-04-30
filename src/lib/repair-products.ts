import { PRODUCT_GROUPS } from "@/lib/product-catalog";

const REPAIR_ONLY_PRODUCTS = ["C7", "X16", "X2M", "X4E", "Z4"];
const EXCLUDED_REPAIR_PRODUCT_GROUPS = new Set(["Receiver cards"]);

const PRODUCT_NAME_ALIASES = new Map<string, string>([
  ["c3 pro", "C3 Pro"],
  ["h10fn", "H10FN"],
  ["h10", "H10FN"],
  ["z4pro", "Z4 Pro"],
  ["z4 pro", "Z4 Pro"],
  ["z4pros", "Z4 Pro"],
  ["z4 old", "Z4"],
  ["z4(old)", "Z4"],
  ["z5", "Z5"],
  ["z6", "Z6"],
  ["z8", "Z8t"],
  ["x2m", "X2M"],
  ["x4e", "X4E"],
  ["x16", "X16"],
  ["c7", "C7"],
]);

export const REPAIR_PRODUCT_OPTIONS = [
  ...new Set([
    ...PRODUCT_GROUPS.filter(
      (group) => !EXCLUDED_REPAIR_PRODUCT_GROUPS.has(group.group),
    ).flatMap((group) => group.items),
    ...REPAIR_ONLY_PRODUCTS,
  ]),
].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const allowedRepairProductSet = new Set(REPAIR_PRODUCT_OPTIONS);

function productKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeRepairProductName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const direct = REPAIR_PRODUCT_OPTIONS.find(
    (option) => option.toLowerCase() === trimmed.toLowerCase(),
  );
  if (direct) return direct;
  return PRODUCT_NAME_ALIASES.get(productKey(trimmed)) ?? trimmed;
}

export function isAllowedRepairProductName(value: string): boolean {
  return allowedRepairProductSet.has(normalizeRepairProductName(value));
}
