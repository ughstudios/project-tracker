export type PublicFormId = "calibration" | "rma";

export type PublicFormDefinition = {
  id: PublicFormId;
  title: string;
  description: string;
  href: string;
  status: "live" | "coming-soon";
};

export const PUBLIC_FORMS: readonly PublicFormDefinition[] = [
  {
    id: "calibration",
    title: "Calibration Request Form",
    description: "Share screen details, hardware configs, and reference photos for calibration scheduling.",
    href: "/forms/calibration",
    status: "live",
  },
  {
    id: "rma",
    title: "RMA Request Form",
    description: "Collect issue details, serials, and shipment info for returns and replacements.",
    href: "/forms/rma",
    status: "coming-soon",
  },
];

export function getPublicFormById(id: PublicFormId): PublicFormDefinition | undefined {
  return PUBLIC_FORMS.find((form) => form.id === id);
}
