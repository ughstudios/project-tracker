import { randomUUID } from "node:crypto";
import path from "node:path";
import { contentTypeForUpload, writeUploadedFile } from "@/lib/file-storage";
import { isAllowedProcessorRmaModel } from "@/lib/product-catalog";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_ISSUE_PHOTOS = 12;
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
    throw new Error(`Each photo must be 25MB or smaller.`);
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

const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData();

    const contactName = asNonEmptyString(formData.get("contactName"));
    const companyName = asNonEmptyString(formData.get("companyName"));
    const address = asNonEmptyString(formData.get("address"));
    const contactEmail = asNonEmptyString(formData.get("contactEmail")).toLowerCase();
    const phoneNumber = asNonEmptyString(formData.get("phoneNumber"));

    const processorModel = asNonEmptyString(formData.get("processorModel"));
    const firmware = asNonEmptyString(formData.get("firmware"));
    const serialNumber = asNonEmptyString(formData.get("serialNumber"));
    const purchaseNumber = asNonEmptyString(formData.get("purchaseNumber"));
    const datePurchased = asNonEmptyString(formData.get("datePurchased"));
    const issueDescription = asNonEmptyString(formData.get("issueDescription"));
    const usageEnvironment = asNonEmptyString(formData.get("usageEnvironment"));

    if (!contactName) {
      return NextResponse.json({ error: "Contact name is required." }, { status: 400 });
    }
    if (!companyName) {
      return NextResponse.json({ error: "Company name is required." }, { status: 400 });
    }
    if (address.length < 5) {
      return NextResponse.json({ error: "Please enter a complete mailing address." }, { status: 400 });
    }
    if (!contactEmail || !SIMPLE_EMAIL.test(contactEmail)) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }
    const phoneDigits = digitsOnly(phoneNumber);
    if (phoneDigits.length < 7) {
      return NextResponse.json({ error: "Please enter a valid phone number (at least 7 digits)." }, { status: 400 });
    }

    if (!processorModel || !isAllowedProcessorRmaModel(processorModel)) {
      return NextResponse.json({ error: "Select a valid processor model from the list." }, { status: 400 });
    }
    if (!firmware) {
      return NextResponse.json({ error: "Firmware version is required." }, { status: 400 });
    }
    if (!serialNumber) {
      return NextResponse.json({ error: "Serial number is required." }, { status: 400 });
    }
    if (!purchaseNumber) {
      return NextResponse.json({ error: "Purchase number is required." }, { status: 400 });
    }
    if (!datePurchased) {
      return NextResponse.json({ error: "Date purchased is required." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePurchased)) {
      return NextResponse.json({ error: "Date purchased must be a valid date." }, { status: 400 });
    }
    if (issueDescription.length < 10) {
      return NextResponse.json(
        { error: "Please describe the issue in at least a few sentences (10+ characters)." },
        { status: 400 },
      );
    }
    if (usageEnvironment.length < 10) {
      return NextResponse.json(
        { error: "Please describe the usage environment (10+ characters)." },
        { status: 400 },
      );
    }

    const issuePhotos = formData.getAll("issuePhotos").filter((entry): entry is File => entry instanceof File);
    if (issuePhotos.length > MAX_ISSUE_PHOTOS) {
      return NextResponse.json(
        { error: `You can attach at most ${MAX_ISSUE_PHOTOS} photos of the issue.` },
        { status: 400 },
      );
    }

    const submissionId = randomUUID();
    const savedFiles: SavedFile[] = [];
    for (let i = 0; i < issuePhotos.length; i += 1) {
      savedFiles.push(await saveFormFile(issuePhotos[i]!, submissionId, `issue-photo-${i + 1}`));
    }

    const payload = {
      id: submissionId,
      submittedAt: new Date().toISOString(),
      contactName,
      companyName,
      address,
      contactEmail,
      phoneNumber,
      processorModel,
      firmware,
      serialNumber,
      purchaseNumber,
      datePurchased,
      issueDescription,
      usageEnvironment,
      files: savedFiles,
    };

    await prisma.auditLog
      .create({
        data: {
          entityType: "PublicProcessorRmaRequest",
          entityId: submissionId,
          action: "CREATE",
          description: JSON.stringify(payload),
        },
      })
      .catch((error) => {
        console.error("[public-forms] failed to create processor RMA audit log", error);
      });

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
      message: "RMA request submitted. Submit again for each additional processor.",
      submissionId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit form.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
