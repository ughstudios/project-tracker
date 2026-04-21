/**
 * Canonical product groups for the in-app catalog (Projects, Inventory, public forms).
 * Keep in sync with employee-facing `/api/products`.
 */
export const PRODUCT_GROUPS: Array<{ group: string; items: string[] }> = [
  {
    group: "U Series",
    items: ["U15", "U6", "U9"],
  },
  {
    group: "X100 Pro",
    items: ["X100 Pro 4U", "X100 Pro 2U", "X100 Pro 7U"],
  },
  {
    group: "Z Series",
    items: ["Z8t", "Z6 Pro G2", "Z5", "Z4 Pro", "Z3"],
  },
  {
    group: "VX Series",
    items: ["VX20", "VX12F", "VX10", "VX6"],
  },
  {
    group: "DS Series",
    items: ["DS40", "DS20", "DS420", "DS410"],
  },
  {
    group: "S Series",
    items: ["S20", "S6F", "S20F", "S4", "S6"],
  },
  {
    group: "Fiber converters",
    items: ["H10FN", "H10FIX", "H10FIX-5G"],
  },
  {
    group: "Media servers",
    items: ["CS16K", "CS20K-8K Pro"],
  },
  {
    group: "Cloud players",
    items: ["A800", "A500", "A200", "A100", "A4K", "A2K", "C3 Pro"],
  },
  {
    group: "CM Series",
    items: ["CM2KS", "CM4KS"],
  },
  {
    group: "AX Series",
    items: ["AX08", "AX06", "AX6K"],
  },
  {
    group: "Calibration systems",
    items: ["Mica 310 Pro", "Mica 310B", "CCM6000"],
  },
  {
    group: "Receiver cards",
    items: [
      "5G Series - HC5",
      "5G Series - RV5000",
      "K10",
      "K5+",
      "K8",
      "E320 Pro",
      "E120",
      "E80",
      "5A-75E",
      "5A-75B",
    ],
  },
];

/** Processor lines on the Projects wizard use these controller series only. */
export const PROCESSOR_PROJECT_GROUP_NAMES = new Set([
  "U Series",
  "X100 Pro",
  "Z Series",
  "VX Series",
  "DS Series",
  "S Series",
]);

/** Flat list of processor models shown on Projects → processors (same as inventory processor picker). */
export function listProcessorModelsForProjects(): string[] {
  return PRODUCT_GROUPS.filter((g) => PROCESSOR_PROJECT_GROUP_NAMES.has(g.group)).flatMap((g) => g.items);
}

const processorRmaModelSet = new Set(listProcessorModelsForProjects());

export function isAllowedProcessorRmaModel(model: string): boolean {
  return processorRmaModelSet.has(model.trim());
}
