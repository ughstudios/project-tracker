import isoCountries from "./data/iso-3166-countries.json";

export type IsoCountryRow = { code: string; name: string };

/** Sentinel value for country `<select>` when the customer types a country not in the ISO list. */
export const MAILING_ADDRESS_COUNTRY_OTHER = "OTHER" as const;

const rows = isoCountries as IsoCountryRow[];

const byCode = new Map(rows.map((r) => [r.code, r.name]));

export const mailingAddressCountryOptions: readonly IsoCountryRow[] = [
  ...rows,
  { code: MAILING_ADDRESS_COUNTRY_OTHER, name: "Other (enter country name below)" },
];

export type MailingAddressPayload = {
  line1: string;
  line2?: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  countryCode: string;
  /** ISO English name, or free text when `countryCode` is `OTHER`. */
  countryName: string;
};

export function isKnownIsoCountryCode(code: string): boolean {
  return byCode.has(code);
}

export function countryDisplayNameForCode(code: string): string | undefined {
  return byCode.get(code);
}
