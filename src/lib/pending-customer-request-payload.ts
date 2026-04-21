import type { MailingAddressPayload } from "@/lib/mailing-address";

export type SavedFile = {
  field: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  storagePath: string;
};

type HardwareConfig = {
  model: string;
  firmware: string;
  quantity: number;
};

export type CalibrationSubmissionPayload = {
  id: string;
  submittedAt: string;
  calibrationTypes: string[];
  screenResolution: string;
  controllerCount: number;
  screenType: string;
  controllerConfigs: HardwareConfig[];
  receiverCardConfigs: HardwareConfig[];
  files: SavedFile[];
};

export type ProcessorRmaPayload = {
  id: string;
  submittedAt: string;
  contactName: string;
  companyName: string;
  mailingAddress?: MailingAddressPayload;
  address?: string;
  contactEmail: string;
  phoneNumber: string;
  processorModel: string;
  firmware: string;
  serialNumber: string;
  purchaseNumber: string;
  datePurchased: string;
  issueDescription: string;
  usageEnvironment: string;
  files: SavedFile[];
  attachmentWarnings?: string[];
};

function parseMailingAddressFromSubmission(raw: unknown): MailingAddressPayload | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const line1 = typeof o.line1 === "string" ? o.line1.trim() : "";
  const city = typeof o.city === "string" ? o.city.trim() : "";
  const stateProvince = typeof o.stateProvince === "string" ? o.stateProvince.trim() : "";
  const postalCode = typeof o.postalCode === "string" ? o.postalCode.trim() : "";
  const countryCode = typeof o.countryCode === "string" ? o.countryCode.trim() : "";
  const countryName = typeof o.countryName === "string" ? o.countryName.trim() : "";
  if (!line1 || !city || !stateProvince || !postalCode || !countryCode || !countryName) return undefined;
  const line2Raw = typeof o.line2 === "string" ? o.line2.trim() : "";
  return {
    line1,
    ...(line2Raw ? { line2: line2Raw } : {}),
    city,
    stateProvince,
    postalCode,
    countryCode,
    countryName,
  };
}

export function parseCalibrationSubmission(description: string): CalibrationSubmissionPayload | null {
  try {
    const parsed = JSON.parse(description) as Partial<CalibrationSubmissionPayload>;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.id || !parsed.submittedAt) return null;
    return {
      id: String(parsed.id),
      submittedAt: String(parsed.submittedAt),
      calibrationTypes: Array.isArray(parsed.calibrationTypes)
        ? parsed.calibrationTypes.map((x) => String(x))
        : [],
      screenResolution: String(parsed.screenResolution ?? ""),
      controllerCount: Number(parsed.controllerCount ?? 0),
      screenType: String(parsed.screenType ?? ""),
      controllerConfigs: Array.isArray(parsed.controllerConfigs)
        ? parsed.controllerConfigs
            .map((item) => ({
              model: String(item?.model ?? ""),
              firmware: String(item?.firmware ?? ""),
              quantity: Number(item?.quantity ?? 0),
            }))
            .filter((item) => item.model && item.firmware && item.quantity > 0)
        : [],
      receiverCardConfigs: Array.isArray(parsed.receiverCardConfigs)
        ? parsed.receiverCardConfigs
            .map((item) => ({
              model: String(item?.model ?? ""),
              firmware: String(item?.firmware ?? ""),
              quantity: Number(item?.quantity ?? 0),
            }))
            .filter((item) => item.model && item.firmware && item.quantity > 0)
        : [],
      files: Array.isArray(parsed.files)
        ? parsed.files
            .map((file) => ({
              field: String(file?.field ?? ""),
              originalName: String(file?.originalName ?? ""),
              storedName: String(file?.storedName ?? ""),
              mimeType: String(file?.mimeType ?? ""),
              size: Number(file?.size ?? 0),
              storagePath: String(file?.storagePath ?? ""),
            }))
            .filter((file) => file.storagePath && file.originalName)
        : [],
    };
  } catch {
    return null;
  }
}

export function parseProcessorRmaSubmission(description: string): ProcessorRmaPayload | null {
  try {
    const parsed = JSON.parse(description) as Partial<ProcessorRmaPayload>;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.id || !parsed.submittedAt) return null;
    return {
      id: String(parsed.id),
      submittedAt: String(parsed.submittedAt),
      contactName: String(parsed.contactName ?? ""),
      companyName: String(parsed.companyName ?? ""),
      mailingAddress: parseMailingAddressFromSubmission(parsed.mailingAddress),
      address: typeof parsed.address === "string" ? parsed.address : undefined,
      contactEmail: String(parsed.contactEmail ?? ""),
      phoneNumber: String(parsed.phoneNumber ?? ""),
      processorModel: String(parsed.processorModel ?? ""),
      firmware: String(parsed.firmware ?? ""),
      serialNumber: String(parsed.serialNumber ?? ""),
      purchaseNumber: String(parsed.purchaseNumber ?? ""),
      datePurchased: String(parsed.datePurchased ?? ""),
      issueDescription: String(parsed.issueDescription ?? ""),
      usageEnvironment: String(parsed.usageEnvironment ?? ""),
      files: Array.isArray(parsed.files)
        ? parsed.files
            .map((file) => ({
              field: String(file?.field ?? ""),
              originalName: String(file?.originalName ?? ""),
              storedName: String(file?.storedName ?? ""),
              mimeType: String(file?.mimeType ?? ""),
              size: Number(file?.size ?? 0),
              storagePath: String(file?.storagePath ?? ""),
            }))
            .filter((file) => file.storagePath && file.originalName)
        : [],
      attachmentWarnings: Array.isArray(parsed.attachmentWarnings)
        ? parsed.attachmentWarnings.map((w) => String(w)).filter(Boolean)
        : undefined,
    };
  } catch {
    return null;
  }
}
