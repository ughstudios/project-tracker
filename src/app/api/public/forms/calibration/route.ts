import { randomUUID } from "node:crypto";
import path from "node:path";
import { contentTypeForUpload, writeUploadedFile } from "@/lib/file-storage";
import { NextResponse } from "next/server";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

type SavedFile = {
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

function cleanName(fileName: string): string {
  const parsed = path.parse(fileName || "upload");
  const safeBase = parsed.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60) || "upload";
  const safeExt = parsed.ext.replace(/[^a-zA-Z0-9.]/g, "").slice(0, 12) || ".bin";
  return `${safeBase}${safeExt}`;
}

async function saveFormFile(file: File, submissionId: string, field: string): Promise<SavedFile> {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error(`Unsupported file format in ${field}.`);
  }
  if (file.size <= 0) {
    throw new Error(`Empty file in ${field}.`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`File in ${field} exceeds 25MB.`);
  }

  const safeName = cleanName(file.name);
  const storedName = `${field}-${randomUUID()}-${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const localDir = path.join(process.cwd(), "data", "public-form-submissions", submissionId);
  const write = await writeUploadedFile({
    buffer: bytes,
    blobPathname: `public-form-submissions/${submissionId}/${storedName}`,
    localDir,
    publicUrlDir: `/uploads/public-form-submissions/${submissionId}`,
    fileName: storedName,
    contentType: file.type || contentTypeForUpload(file),
  });

  return {
    field,
    originalName: file.name,
    storedName,
    mimeType: file.type,
    size: file.size,
    storagePath: write.fileUrl,
  };
}

function asNonEmptyString(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parseHardwareConfigList(raw: FormDataEntryValue | null): HardwareConfig[] | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const normalized = parsed
      .map((item) => {
        if (typeof item !== "object" || item == null) return null;
        const record = item as Record<string, unknown>;
        const model = typeof record.model === "string" ? record.model.trim() : "";
        const firmware = typeof record.firmware === "string" ? record.firmware.trim() : "";
        const quantity = Number(record.quantity ?? 0);
        if (!model || !firmware || !Number.isFinite(quantity) || quantity < 1) return null;
        return {
          model,
          firmware,
          quantity: Math.floor(quantity),
        };
      })
      .filter((item): item is HardwareConfig => item !== null);
    return normalized;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const calibrationTypes = formData
      .getAll("calibrationTypes")
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);

    if (calibrationTypes.length === 0) {
      return NextResponse.json({ error: "At least one calibration option is required." }, { status: 400 });
    }

    const screenResolution = asNonEmptyString(formData.get("screenResolution"));
    const controllerCountRaw = asNonEmptyString(formData.get("controllerCount"));
    const screenType = asNonEmptyString(formData.get("screenType"));

    if (!screenResolution || !controllerCountRaw || !screenType) {
      return NextResponse.json(
        { error: "Screen resolution, controller count, and screen type are required." },
        { status: 400 },
      );
    }

    const controllerConfigs = parseHardwareConfigList(formData.get("controllerConfigs"));
    if (!controllerConfigs || controllerConfigs.length === 0) {
      return NextResponse.json(
        { error: "At least one controller with model, firmware, and quantity is required." },
        { status: 400 },
      );
    }

    const receiverCardConfigs = parseHardwareConfigList(formData.get("receiverCardConfigs"));
    if (!receiverCardConfigs || receiverCardConfigs.length === 0) {
      return NextResponse.json(
        { error: "At least one receiver with model, firmware, and quantity is required." },
        { status: 400 },
      );
    }

    const controllerCount = Number.parseInt(controllerCountRaw, 10);
    if (!Number.isFinite(controllerCount) || controllerCount < 1) {
      return NextResponse.json({ error: "Controller count must be at least 1." }, { status: 400 });
    }

    const computedControllerCount = controllerConfigs.reduce((sum, item) => sum + item.quantity, 0);
    if (controllerCount !== computedControllerCount) {
      return NextResponse.json(
        { error: "Controller count must match selected controller quantities." },
        { status: 400 },
      );
    }

    const screenPhoto = formData.get("screenPhoto");
    if (!(screenPhoto instanceof File)) {
      return NextResponse.json({ error: "A screen photo is required." }, { status: 400 });
    }

    const extraScreenPhotos = formData.getAll("screenPhotosExtra").filter((entry): entry is File => entry instanceof File);
    if (extraScreenPhotos.length !== 3) {
      return NextResponse.json({ error: "Exactly 3 separate screen photos are required." }, { status: 400 });
    }

    const environmentPhotos = formData
      .getAll("workEnvironmentPhotos")
      .filter((entry): entry is File => entry instanceof File);
    if (environmentPhotos.length === 0) {
      return NextResponse.json(
        { error: "At least one work-environment photo is required." },
        { status: 400 },
      );
    }

    const submissionId = randomUUID();
    const savedFiles: SavedFile[] = [];
    savedFiles.push(await saveFormFile(screenPhoto, submissionId, "screen-photo"));
    for (const file of extraScreenPhotos) {
      savedFiles.push(await saveFormFile(file, submissionId, "screen-photo-extra"));
    }
    for (const file of environmentPhotos) {
      savedFiles.push(await saveFormFile(file, submissionId, "work-environment"));
    }

    const payload = {
      id: submissionId,
      submittedAt: new Date().toISOString(),
      calibrationTypes,
      screenResolution,
      controllerCount,
      screenType,
      controllerConfigs,
      receiverCardConfigs,
      files: savedFiles,
    };

    const localDir = path.join(process.cwd(), "data", "public-form-submissions", submissionId);
    await writeUploadedFile({
      buffer: Buffer.from(JSON.stringify(payload, null, 2), "utf8"),
      blobPathname: `public-form-submissions/${submissionId}/submission.json`,
      localDir,
      publicUrlDir: `/uploads/public-form-submissions/${submissionId}`,
      fileName: "submission.json",
      contentType: "application/json",
    });

    return NextResponse.json({
      ok: true,
      message: "Form submitted successfully. Thank you.",
      submissionId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit form.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
