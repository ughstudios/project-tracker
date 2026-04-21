import { auth } from "@/auth";
import { attachmentBlobHref } from "@/lib/attachment-blob-href";
import {
  parseCalibrationSubmission,
  parseProcessorRmaSubmission,
  type CalibrationSubmissionPayload,
  type ProcessorRmaPayload,
  type SavedFile,
} from "@/lib/pending-customer-request-payload";
import { autoArchiveClosedPublicCustomerRequests } from "@/lib/public-customer-request-auto-archive";
import { prisma } from "@/lib/prisma";
import { PendingCustomerRequestStaffPanel } from "@/components/pending-customer-request-staff-panel";
import { redirect } from "next/navigation";

const CALIBRATION_LABELS: Record<string, string> = {
  "single-layer": "Single layer calibration",
  "double-layer": "Double layer calibration",
  "low-chip-brightness": "Low chip brightness calibration",
  "grayscale-infibit": "Grayscale refinement + infibit",
};

function calibrationLabel(id: string): string {
  return CALIBRATION_LABELS[id] ?? id;
}

function statusBadgeClass(status: string): string {
  if (status === "CLOSED") {
    return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200";
  }
  if (status === "IN_PROGRESS") {
    return "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200";
  }
  return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
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

type TicketWithThread = {
  submissionId: string;
  status: string;
  closedAt: Date | null;
  threadEntries: Array<{
    id: string;
    content: string;
    createdAt: Date;
    author: { name: string | null; email: string | null };
  }>;
};

type RowCalibration = {
  kind: "calibration";
  ticket: TicketWithThread;
  createdAt: Date;
  payload: CalibrationSubmissionPayload;
};

type RowRma = {
  kind: "processor-rma";
  ticket: TicketWithThread;
  createdAt: Date;
  payload: ProcessorRmaPayload;
};

type PendingRow = RowCalibration | RowRma;

export default async function PendingCustomerRequestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await autoArchiveClosedPublicCustomerRequests();

  const tickets = await prisma.publicCustomerRequest.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      threadEntries: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, email: true } } },
      },
    },
  });

  const audits = await prisma.auditLog.findMany({
    where: {
      action: "CREATE",
      entityId: { in: tickets.map((t) => t.submissionId) },
      entityType: { in: ["PublicCalibrationRequest", "PublicProcessorRmaRequest"] },
    },
  });
  const auditByEntityId = new Map(audits.map((a) => [a.entityId, a]));

  const submissions: PendingRow[] = [];
  for (const ticket of tickets) {
    const audit = auditByEntityId.get(ticket.submissionId);
    if (!audit) continue;
    if (ticket.kind === "CALIBRATION" && audit.entityType !== "PublicCalibrationRequest") continue;
    if (ticket.kind === "PROCESSOR_RMA" && audit.entityType !== "PublicProcessorRmaRequest") continue;

    const ticketView: TicketWithThread = {
      submissionId: ticket.submissionId,
      status: ticket.status,
      closedAt: ticket.closedAt,
      threadEntries: ticket.threadEntries,
    };

    if (ticket.kind === "CALIBRATION") {
      const payload = parseCalibrationSubmission(audit.description);
      if (payload) {
        submissions.push({
          kind: "calibration",
          ticket: ticketView,
          createdAt: audit.createdAt,
          payload,
        });
      }
    } else {
      const payload = parseProcessorRmaSubmission(audit.description);
      if (payload) {
        submissions.push({
          kind: "processor-rma",
          ticket: ticketView,
          createdAt: audit.createdAt,
          payload,
        });
      }
    }
  }

  return (
    <section className="space-y-4">
      <div className="panel-surface rounded-xl p-5">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Pending Customer Requests</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Public calibration requests and per-processor RMA submissions. Use status, thread, and archive like issues.
          Closed items auto-archive after 24 hours.
        </p>
      </div>

      <div className="space-y-3">
        {submissions.length === 0 ? (
          <div className="panel-surface rounded-xl p-5">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">No pending customer requests yet.</p>
          </div>
        ) : (
          submissions.map((row) => {
            const threadProps = row.ticket.threadEntries.map((e) => ({
              id: e.id,
              content: e.content,
              createdAt: e.createdAt.toISOString(),
              author: { name: e.author.name, email: e.author.email },
            }));
            const staffPanel = (
              <PendingCustomerRequestStaffPanel
                key={`${row.ticket.submissionId}-${row.ticket.status}-${row.ticket.threadEntries.length}`}
                submissionId={row.ticket.submissionId}
                initialStatus={row.ticket.status}
                initialClosedAtIso={row.ticket.closedAt?.toISOString() ?? null}
                initialThread={threadProps}
              />
            );

            return row.kind === "calibration" ? (
              <article key={row.ticket.submissionId} className="panel-surface rounded-xl p-5">
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
                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-semibold",
                        statusBadgeClass(row.ticket.status),
                      ].join(" ")}
                    >
                      {row.ticket.status === "IN_PROGRESS"
                        ? "In progress"
                        : row.ticket.status === "CLOSED"
                          ? "Closed"
                          : "Pending"}
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

                {staffPanel}
              </article>
            ) : (
              <article key={row.ticket.submissionId} className="panel-surface rounded-xl p-5">
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
                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-semibold",
                        statusBadgeClass(row.ticket.status),
                      ].join(" ")}
                    >
                      {row.ticket.status === "IN_PROGRESS"
                        ? "In progress"
                        : row.ticket.status === "CLOSED"
                          ? "Closed"
                          : "Pending"}
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
                    Mailing address
                  </p>
                  {row.payload.mailingAddress ? (
                    <address className="mt-1 not-italic whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-200">
                      {row.payload.mailingAddress.line1}
                      {row.payload.mailingAddress.line2 ? `\n${row.payload.mailingAddress.line2}` : ""}
                      {`\n${row.payload.mailingAddress.city}, ${row.payload.mailingAddress.stateProvince} ${row.payload.mailingAddress.postalCode}`}
                      {`\n${row.payload.mailingAddress.countryName}`}
                    </address>
                  ) : row.payload.address ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-200">
                      {row.payload.address}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">-</p>
                  )}
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

                {row.payload.attachmentWarnings && row.payload.attachmentWarnings.length > 0 ? (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                      Attachment notes (submitted without these files)
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 whitespace-pre-line">
                      {row.payload.attachmentWarnings.map((w, i) => (
                        <li key={`${row.payload.id}:warn:${i}`}>{w}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {staffPanel}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
