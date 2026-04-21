import { auth } from "@/auth";
import { attachmentBlobHref } from "@/lib/attachment-blob-href";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

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

type CalibrationSubmissionPayload = {
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

type ProcessorRmaPayload = {
  id: string;
  submittedAt: string;
  contactName: string;
  companyName: string;
  address: string;
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
};

type PendingRow =
  | { kind: "calibration"; auditId: string; createdAt: Date; payload: CalibrationSubmissionPayload }
  | { kind: "processor-rma"; auditId: string; createdAt: Date; payload: ProcessorRmaPayload };

const CALIBRATION_LABELS: Record<string, string> = {
  "single-layer": "Single layer calibration",
  "double-layer": "Double layer calibration",
  "low-chip-brightness": "Low chip brightness calibration",
  "grayscale-infibit": "Grayscale refinement + infibit",
};

function parseCalibrationSubmission(description: string): CalibrationSubmissionPayload | null {
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

function parseProcessorRmaSubmission(description: string): ProcessorRmaPayload | null {
  try {
    const parsed = JSON.parse(description) as Partial<ProcessorRmaPayload>;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.id || !parsed.submittedAt) return null;
    return {
      id: String(parsed.id),
      submittedAt: String(parsed.submittedAt),
      contactName: String(parsed.contactName ?? ""),
      companyName: String(parsed.companyName ?? ""),
      address: String(parsed.address ?? ""),
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
    };
  } catch {
    return null;
  }
}

function calibrationLabel(id: string): string {
  return CALIBRATION_LABELS[id] ?? id;
}

function FileList({ submissionId, files }: { submissionId: string; files: SavedFile[] }) {
  if (files.length === 0) {
    return <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No files in request.</p>;
  }
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {files.map((file, idx) => (
        <li key={`${submissionId}:file:${idx}`}>
          <a className="link-accent underline" href={attachmentBlobHref(file.storagePath)} target="_blank" rel="noreferrer">
            {file.originalName}
          </a>
          <span className="ml-2 text-zinc-500 dark:text-zinc-400">
            ({file.field}, {Math.round((file.size ?? 0) / 1024)} KB)
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function PendingCustomerRequestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const logs = await prisma.auditLog.findMany({
    where: {
      action: "CREATE",
      entityType: { in: ["PublicCalibrationRequest", "PublicProcessorRmaRequest"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      description: true,
      entityType: true,
    },
    take: 200,
  });

  const submissions: PendingRow[] = [];
  for (const log of logs) {
    if (log.entityType === "PublicCalibrationRequest") {
      const payload = parseCalibrationSubmission(log.description);
      if (payload) submissions.push({ kind: "calibration", auditId: log.id, createdAt: log.createdAt, payload });
    } else if (log.entityType === "PublicProcessorRmaRequest") {
      const payload = parseProcessorRmaSubmission(log.description);
      if (payload) submissions.push({ kind: "processor-rma", auditId: log.id, createdAt: log.createdAt, payload });
    }
  }

  return (
    <section className="space-y-4">
      <div className="panel-surface rounded-xl p-5">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Pending Customer Requests</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Public calibration requests and per-processor RMA submissions waiting for review.
        </p>
      </div>

      <div className="space-y-3">
        {submissions.length === 0 ? (
          <div className="panel-surface rounded-xl p-5">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">No pending customer requests yet.</p>
          </div>
        ) : (
          submissions.map((row) =>
            row.kind === "calibration" ? (
              <article key={row.auditId} className="panel-surface rounded-xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      Calibration · {row.payload.id.slice(0, 8)}
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Submitted {new Date(row.payload.submittedAt).toLocaleString()} (queued {row.createdAt.toLocaleString()})
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
                      Calibration
                    </span>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      Pending
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Screen details
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
                      <li>Resolution: {row.payload.screenResolution || "-"}</li>
                      <li>Screen type: {row.payload.screenType || "-"}</li>
                    </ul>
                  </div>

                  <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Calibration requested
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-200">
                      {row.payload.calibrationTypes.length === 0 ? (
                        <li>-</li>
                      ) : (
                        row.payload.calibrationTypes.map((type) => (
                          <li key={`${row.payload.id}:${type}`}>{calibrationLabel(type)}</li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Controller configs
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
                      {row.payload.controllerConfigs.length === 0 ? (
                        <li>-</li>
                      ) : (
                        row.payload.controllerConfigs.map((item, idx) => (
                          <li key={`${row.payload.id}:controller:${idx}`}>
                            {item.model} | FW {item.firmware} | Qty {item.quantity}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>

                  <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Receiver configs
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
                      {row.payload.receiverCardConfigs.length === 0 ? (
                        <li>-</li>
                      ) : (
                        row.payload.receiverCardConfigs.map((item, idx) => (
                          <li key={`${row.payload.id}:receiver:${idx}`}>
                            {item.model} | FW {item.firmware} | Qty {item.quantity}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Uploaded photos ({row.payload.files.length})
                  </p>
                  <FileList submissionId={row.payload.id} files={row.payload.files} />
                </div>
              </article>
            ) : (
              <article key={row.auditId} className="panel-surface rounded-xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      Processor RMA · {row.payload.id.slice(0, 8)}
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Submitted {new Date(row.payload.submittedAt).toLocaleString()} (queued {row.createdAt.toLocaleString()})
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-900 dark:bg-sky-900/40 dark:text-sky-200">
                      Processor RMA
                    </span>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      Pending
                    </span>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Contact
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
                    <li>Name: {row.payload.contactName || "-"}</li>
                    <li>Company: {row.payload.companyName || "-"}</li>
                    <li>
                      Email:{" "}
                      {row.payload.contactEmail ? (
                        <a className="link-accent underline" href={`mailto:${row.payload.contactEmail}`}>
                          {row.payload.contactEmail}
                        </a>
                      ) : (
                        "-"
                      )}
                    </li>
                    <li>
                      Phone:{" "}
                      {row.payload.phoneNumber ? (
                        <a className="link-accent underline" href={`tel:${row.payload.phoneNumber.replace(/\s/g, "")}`}>
                          {row.payload.phoneNumber}
                        </a>
                      ) : (
                        "-"
                      )}
                    </li>
                  </ul>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Address
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-200">
                    {row.payload.address || "-"}
                  </p>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Product
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
                      <li>Model: {row.payload.processorModel || "-"}</li>
                      <li>Firmware: {row.payload.firmware || "-"}</li>
                      <li>Serial: {row.payload.serialNumber || "-"}</li>
                    </ul>
                  </div>
                  <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Purchase
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
                      <li>Purchase number: {row.payload.purchaseNumber || "-"}</li>
                      <li>Date purchased: {row.payload.datePurchased || "-"}</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Issue
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-200">
                    {row.payload.issueDescription || "-"}
                  </p>
                </div>

                <div className="mt-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Usage environment
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-200">
                    {row.payload.usageEnvironment || "-"}
                  </p>
                </div>

                <div className="mt-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Photos ({row.payload.files.length})
                  </p>
                  <FileList submissionId={row.payload.id} files={row.payload.files} />
                </div>
              </article>
            ),
          )
        )}
      </div>
    </section>
  );
}
