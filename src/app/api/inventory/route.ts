import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { TABS_INVENTORY } from "@/lib/employee-nav-shared";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { prisma } from "@/lib/prisma";
import type { WarehouseItemKind } from "@/generated/prisma";
import { NextResponse } from "next/server";

function isWarehouseKind(k: string): k is WarehouseItemKind {
  return k === "PROCESSOR" || k === "RECEIVER_CARD" || k === "OTHER";
}

function normalizeLine(input: {
  kind?: string;
  model?: string;
  firmware?: string;
  receiverVersion?: string;
  category?: string;
  quantity?: number;
  notes?: string | null;
  location?: string | null;
}) {
  const rawKind = input.kind?.trim().toUpperCase() ?? "";
  const kind = isWarehouseKind(rawKind) ? rawKind : undefined;
  const model = (input.model ?? "").trim();
  const firmware = (input.firmware ?? "").trim();
  const receiverVersion = (input.receiverVersion ?? "").trim();
  const category = (input.category ?? "").trim();
  const quantity = Number(input.quantity ?? 0);
  const notes =
    input.notes === undefined || input.notes === null
      ? null
      : String(input.notes).trim() || null;
  const location =
    input.location === undefined || input.location === null
      ? null
      : String(input.location).trim() || null;
  return { kind, model, firmware, receiverVersion, category, quantity, notes, location };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_INVENTORY);
  if (denied) return denied;

  const lines = await prisma.warehouseStockLine.findMany({
    orderBy: [{ kind: "asc" }, { model: "asc" }, { firmware: "asc" }, { receiverVersion: "asc" }],
  });

  return NextResponse.json(lines);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_INVENTORY);
  if (denied) return denied;

  const body = (await request.json()) as Record<string, unknown>;
  const n = normalizeLine({
    kind: typeof body.kind === "string" ? body.kind : undefined,
    model: typeof body.model === "string" ? body.model : undefined,
    firmware: typeof body.firmware === "string" ? body.firmware : undefined,
    receiverVersion: typeof body.receiverVersion === "string" ? body.receiverVersion : undefined,
    category: typeof body.category === "string" ? body.category : undefined,
    quantity: typeof body.quantity === "number" ? body.quantity : Number(body.quantity),
    notes:
      body.notes === undefined
        ? undefined
        : body.notes === null
          ? null
          : typeof body.notes === "string"
            ? body.notes
            : undefined,
    location:
      body.location === undefined
        ? undefined
        : body.location === null
          ? null
          : typeof body.location === "string"
            ? body.location
            : undefined,
  });

  if (!n.kind) {
    return NextResponse.json(
      { error: "kind must be PROCESSOR, RECEIVER_CARD, or OTHER." },
      { status: 400 },
    );
  }
  if (!n.model) {
    return NextResponse.json({ error: "Model is required." }, { status: 400 });
  }
  if (n.kind === "OTHER" && !n.category) {
    return NextResponse.json(
      { error: "Category is required for other products." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(n.quantity) || n.quantity < 0) {
    return NextResponse.json({ error: "Quantity must be a non-negative number." }, { status: 400 });
  }

  const line = await prisma.warehouseStockLine.upsert({
    where: {
      kind_model_firmware_receiverVersion_category: {
        kind: n.kind,
        model: n.model,
        firmware: n.kind === "PROCESSOR" ? n.firmware : "",
        receiverVersion: n.kind === "RECEIVER_CARD" ? n.receiverVersion : "",
        category: n.kind === "OTHER" ? n.category : "",
      },
    },
    create: {
      kind: n.kind,
      model: n.model,
      firmware: n.kind === "PROCESSOR" ? n.firmware : "",
      receiverVersion: n.kind === "RECEIVER_CARD" ? n.receiverVersion : "",
      category: n.kind === "OTHER" ? n.category : "",
      quantity: n.quantity,
      notes: n.notes,
      location: n.location,
    },
    update: {
      quantity: n.quantity,
      notes: n.notes,
      location: n.location,
      ...(n.kind === "PROCESSOR" ? { firmware: n.firmware } : {}),
      ...(n.kind === "RECEIVER_CARD" ? { receiverVersion: n.receiverVersion } : {}),
      ...(n.kind === "OTHER" ? { category: n.category, model: n.model } : {}),
    },
  });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "WarehouseStockLine",
    entityId: line.id,
    action: "UPSERT",
    description: `Warehouse stock ${line.kind} ${line.model} qty=${line.quantity}.`,
  });

  return NextResponse.json(line, { status: 201 });
}
