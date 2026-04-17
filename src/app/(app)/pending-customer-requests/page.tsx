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

type SubmissionPayload = {
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

const CALIBRATION_LABELS: Record<string, string> = {
  "single-layer": "Single layer calibration",
  "double-layer": "Double layer calibration",
  "low-chip-brightness": "Low chip brightness calibration",
  "grayscale-infibit": "Grayscale refinement + infibit",
};

function parseSubmission(description: string): SubmissionPayload | null {
  try {
    const parsed = JSON.parse(description) as Partial<SubmissionPayload>;
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

function calibrationLabel(id: string): string {
  return CALIBRATION_LABELS[id] ?? id;
}

export default async function PendingCustomerRequestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const logs = await prisma.auditLog.findMany({
    where: {
      entityType: "PublicCalibrationRequest",
      action: "CREATE",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      description: true,
    },
    take: 200,
  });

  const submissions = logs
    .map((log) => ({
      auditId: log.id,
      createdAt: log.createdAt,
      payload: parseSubmission(log.description),
    }))
    .filter((row): row is { auditId: string; createdAt: Date; payload: SubmissionPayload } => row.payload !== null);

  return (
    <section className="space-y-4">
      <div className="panel-surface rounded-xl p-5">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Pending Customer Requests</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Customer calibration forms waiting for sales review.
        </p>
      </div>

      <div className="space-y-3">
        {submissions.length === 0 ? (
          <div className="panel-surface rounded-xl p-5">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">No pending customer requests yet.</p>
          </div>
        ) : (
          submissions.map(({ auditId, createdAt, payload }) => (
            <article key={auditId} className="panel-surface rounded-xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    Request {payload.id.slice(0, 8)}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Submitted {new Date(payload.submittedAt).toLocaleString()} (queued {createdAt.toLocaleString()})
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  Pending
                </span>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Screen details
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
                    <li>Resolution: {payload.screenResolution || "-"}</li>
                    <li>Controllers: {payload.controllerCount || 0}</li>
                    <li>Screen type: {payload.screenType || "-"}</li>
                  </ul>
                </div>

                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Calibration requested
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-200">
                    {payload.calibrationTypes.length === 0 ? (
                      <li>-</li>
                    ) : (
                      payload.calibrationTypes.map((type) => <li key={`${payload.id}:${type}`}>{calibrationLabel(type)}</li>)
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
                    {payload.controllerConfigs.length === 0 ? (
                      <li>-</li>
                    ) : (
                      payload.controllerConfigs.map((item, idx) => (
                        <li key={`${payload.id}:controller:${idx}`}>
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
                    {payload.receiverCardConfigs.length === 0 ? (
                      <li>-</li>
                    ) : (
                      payload.receiverCardConfigs.map((item, idx) => (
                        <li key={`${payload.id}:receiver:${idx}`}>
                          {item.model} | FW {item.firmware} | Qty {item.quantity}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Uploaded photos ({payload.files.length})
                </p>
                {payload.files.length === 0 ? (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No files in request.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {payload.files.map((file, idx) => (
                      <li key={`${payload.id}:file:${idx}`}>
                        <a
                          className="link-accent underline"
                          href={attachmentBlobHref(file.storagePath)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {file.originalName}
                        </a>
                        <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                          ({file.field}, {Math.round((file.size ?? 0) / 1024)} KB)
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
