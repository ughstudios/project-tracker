import { del, head, put } from "@vercel/blob";
import { PrismaClient } from "@/generated/prisma";
import { getBlobStoreAccess } from "@/lib/blob-access";
import { isLikelyVercelBlobUrl } from "@/lib/blob-url-utils";
import { maybeConvertHeicForBlobUpload } from "@/lib/heic-blob-convert";

function getBlobReadWriteToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || undefined;
}

async function deleteBlobUrlQuiet(fileUrl: string, token: string): Promise<void> {
  if (!isLikelyVercelBlobUrl(fileUrl)) return;
  try {
    await del(fileUrl, { token });
  } catch {
    /* already gone or inaccessible */
  }
}

export function pathnameFromVercelBlobUrl(fileUrl: string): string {
  const u = new URL(fileUrl);
  let urlPath = u.pathname.replace(/^\/+/, "");
  try {
    urlPath = decodeURIComponent(urlPath.replace(/\+/g, "%20"));
  } catch {
    throw new Error("Invalid blob URL path.");
  }
  return urlPath;
}

async function fetchBlobBuffer(fileUrl: string, token: string): Promise<Buffer> {
  const res = await fetch(fileUrl, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new Error(`Blob GET failed (${res.status}).`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export function isHeicAttachmentCandidate(fileName: string, fileType: string): boolean {
  const ft = fileType.toLowerCase();
  if (ft === "heic" || ft === "heif") return true;
  return /\.(heic|heif)$/i.test(fileName.trim());
}

function displayNameAfterHeicConversion(originalName: string): string {
  const n = originalName.trim() || "image";
  if (/\.(heic|heif)$/i.test(n)) return n.replace(/\.(heic|heif)$/i, ".jpg");
  return n.toLowerCase().endsWith(".jpg") ? n : `${n}.jpg`;
}

type AttachmentKind = "issue" | "thread" | "project" | "customer";

type AttachmentRow = {
  kind: AttachmentKind;
  id: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
};

const heicWhere = {
  OR: [
    { fileType: { in: ["heic", "heif"] } },
    { fileName: { endsWith: ".heic", mode: "insensitive" as const } },
    { fileName: { endsWith: ".heif", mode: "insensitive" as const } },
  ],
};

const attachmentSelect = {
  id: true,
  fileUrl: true,
  fileName: true,
  fileType: true,
  fileSize: true,
  createdAt: true,
} as const;

async function loadCandidateRows(prisma: PrismaClient, limit?: number): Promise<AttachmentRow[]> {
  const [issues, threads, projects, customers] = await Promise.all([
    prisma.issueAttachment.findMany({
      where: heicWhere,
      select: attachmentSelect,
      orderBy: { createdAt: "asc" },
    }),
    prisma.issueThreadAttachment.findMany({
      where: heicWhere,
      select: attachmentSelect,
      orderBy: { createdAt: "asc" },
    }),
    prisma.projectAttachment.findMany({
      where: heicWhere,
      select: attachmentSelect,
      orderBy: { createdAt: "asc" },
    }),
    prisma.customerAttachment.findMany({
      where: heicWhere,
      select: attachmentSelect,
      orderBy: { createdAt: "asc" },
    }),
  ]);

  type RowWithMeta = AttachmentRow & { createdAt: Date };
  const merged: RowWithMeta[] = [
    ...issues.map((r) => ({ kind: "issue" as const, ...r })),
    ...threads.map((r) => ({ kind: "thread" as const, ...r })),
    ...projects.map((r) => ({ kind: "project" as const, ...r })),
    ...customers.map((r) => ({ kind: "customer" as const, ...r })),
  ];

  const filtered = merged.filter((r) => isHeicAttachmentCandidate(r.fileName, r.fileType));
  filtered.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const capped =
    limit !== undefined ? filtered.slice(0, Math.max(0, limit)) : filtered;
  return capped.map((r) => ({
    kind: r.kind,
    id: r.id,
    fileUrl: r.fileUrl,
    fileName: r.fileName,
    fileType: r.fileType,
    fileSize: r.fileSize,
  }));
}

async function updateRow(
  prisma: PrismaClient,
  row: AttachmentRow,
  data: { fileUrl: string; fileName: string; fileType: string; fileSize: number },
): Promise<void> {
  switch (row.kind) {
    case "issue":
      await prisma.issueAttachment.update({ where: { id: row.id }, data });
      return;
    case "thread":
      await prisma.issueThreadAttachment.update({ where: { id: row.id }, data });
      return;
    case "project":
      await prisma.projectAttachment.update({ where: { id: row.id }, data });
      return;
    case "customer":
      await prisma.customerAttachment.update({ where: { id: row.id }, data });
      return;
  }
}

export type HeicMigrationSummary = {
  examined: number;
  converted: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  errors: { id: string; kind: AttachmentKind; message: string }[];
};

export async function runHeicAttachmentMigration(options: {
  dryRun: boolean;
  limit?: number;
}): Promise<HeicMigrationSummary> {
  const token = getBlobReadWriteToken();
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set.");
  }

  const prisma = new PrismaClient();
  const summary: HeicMigrationSummary = {
    examined: 0,
    converted: 0,
    skipped: 0,
    failed: 0,
    dryRun: options.dryRun,
    errors: [],
  };

  try {
    const rows = await loadCandidateRows(prisma, options.limit);
    summary.examined = rows.length;

    for (const row of rows) {
      try {
        if (!isLikelyVercelBlobUrl(row.fileUrl)) {
          summary.skipped++;
          continue;
        }

        let contentType = "image/heic";
        try {
          const meta = await head(row.fileUrl, { token });
          if (meta.contentType) contentType = meta.contentType;
        } catch {
          /* fall back */
        }

        const pathname = pathnameFromVercelBlobUrl(row.fileUrl);
        const buffer = await fetchBlobBuffer(row.fileUrl, token);
        const converted = await maybeConvertHeicForBlobUpload({
          buffer,
          pathname,
          contentType,
        });

        if (!converted.heicConverted) {
          summary.skipped++;
          continue;
        }

        if (options.dryRun) {
          summary.converted++;
          continue;
        }

        const blob = await put(converted.pathname, converted.buffer, {
          access: getBlobStoreAccess(),
          token,
          contentType: converted.contentType,
          addRandomSuffix: false,
        });

        const newFileName = displayNameAfterHeicConversion(row.fileName);
        const newData = {
          fileUrl: blob.url,
          fileName: newFileName,
          fileType: "jpg",
          fileSize: converted.buffer.length,
        };

        await updateRow(prisma, row, newData);
        await deleteBlobUrlQuiet(row.fileUrl, token);
        summary.converted++;
      } catch (e) {
        summary.failed++;
        summary.errors.push({
          id: row.id,
          kind: row.kind,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  return summary;
}
