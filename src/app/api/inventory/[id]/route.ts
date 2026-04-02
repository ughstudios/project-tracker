import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;

  const existing = await prisma.warehouseStockLine.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Stock line not found." }, { status: 404 });
  }

  const quantity =
    body.quantity === undefined ? undefined : Number(body.quantity);
  if (quantity !== undefined && (!Number.isFinite(quantity) || quantity < 0)) {
    return NextResponse.json({ error: "Quantity must be a non-negative number." }, { status: 400 });
  }

  const firmware =
    typeof body.firmware === "string" ? body.firmware.trim() : undefined;
  const receiverVersion =
    typeof body.receiverVersion === "string" ? body.receiverVersion.trim() : undefined;
  const notes =
    body.notes === undefined
      ? undefined
      : body.notes === null
        ? null
        : String(body.notes).trim() || null;
  const location =
    body.location === undefined
      ? undefined
      : body.location === null
        ? null
        : String(body.location).trim() || null;

  const nextFirmware =
    existing.kind === "PROCESSOR" && firmware !== undefined ? firmware : undefined;
  const nextReceiverVersion =
    existing.kind === "RECEIVER_CARD" && receiverVersion !== undefined
      ? receiverVersion
      : undefined;

  const mergedFirmware = nextFirmware !== undefined ? nextFirmware : existing.firmware;
  const mergedReceiverVersion =
    nextReceiverVersion !== undefined ? nextReceiverVersion : existing.receiverVersion;

  if (nextFirmware !== undefined || nextReceiverVersion !== undefined) {
    const conflict = await prisma.warehouseStockLine.findFirst({
      where: {
        kind: existing.kind,
        model: existing.model,
        firmware: mergedFirmware,
        receiverVersion: mergedReceiverVersion,
        category: existing.category,
        NOT: { id },
      },
    });
    if (conflict) {
      return NextResponse.json(
        {
          error:
            "Another line already uses this model with the same firmware/version and category. Remove or edit that line first.",
        },
        { status: 409 },
      );
    }
  }

  const line = await prisma.warehouseStockLine.update({
    where: { id },
    data: {
      ...(quantity !== undefined ? { quantity } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(nextFirmware !== undefined ? { firmware: nextFirmware } : {}),
      ...(nextReceiverVersion !== undefined
        ? { receiverVersion: nextReceiverVersion }
        : {}),
    },
  });
  await writeAuditLog({
    actorId: session.user.id,
    entityType: "WarehouseStockLine",
    entityId: line.id,
    action: "PATCH",
    description: `Warehouse stock ${line.kind} ${line.model} updated.`,
  });
  return NextResponse.json(line);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.warehouseStockLine.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Stock line not found." }, { status: 404 });
  }

  await prisma.warehouseStockLine.delete({ where: { id } });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "WarehouseStockLine",
    entityId: id,
    action: "DELETE",
    description: `Warehouse stock line removed: ${existing.kind} ${existing.model}.`,
  });

  return NextResponse.json({ ok: true });
}
