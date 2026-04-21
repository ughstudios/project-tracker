export type PublicFormCardId = "calibration" | "rma";

export type PublicFormCard = {
  id: PublicFormCardId;
  href: string;
  status: "live" | "coming-soon";
};

export const PUBLIC_FORM_CARDS: readonly PublicFormCard[] = [
  {
    id: "calibration",
    href: "/forms/calibration",
    status: "live",
  },
  {
    id: "rma",
    href: "/forms/rma",
    status: "live",
  },
];

export function getPublicFormCardById(id: PublicFormCardId): PublicFormCard | undefined {
  return PUBLIC_FORM_CARDS.find((form) => form.id === id);
}
