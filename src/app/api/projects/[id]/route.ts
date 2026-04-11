import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { TABS_PROJECT_DETAIL } from "@/lib/employee-nav";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { prisma } from "@/lib/prisma";
import { isPrivilegedAdmin } from "@/lib/roles";
import { NextResponse } from "next/server";

type ProcessorIn = { model?: string; firmware?: string; quantity?: number };
type ReceiverIn = { model?: string; version?: string; quantity?: number };
type OtherIn = { category?: string; model?: string; quantity?: number };

function buildProductLabel(
  processors: Array<{ model: string }>,
  receivers: Array<{ model: string }>,
  others: Array<{ model: string }>,
) {
  const selectedModels = [
    ...processors.map((p) => p.model),
    ...receivers.map((r) => r.model),
    ...others.map((o) => o.model),
  ];
  const uniqueModels = Array.from(new Set(selectedModels)).filter(Boolean);
  if (uniqueModels.length === 0) return "Custom Project";
  if (uniqueModels.length <= 3) return uniqueModels.join(" + ");
  return `${uniqueModels.slice(0, 3).join(" + ")} +${uniqueModels.length - 3} more`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_PROJECT_DETAIL);
  if (denied) return denied;

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      customer: true,
      processorConfigs: { orderBy: { createdAt: "asc" } },
      receiverCardConfigs: { orderBy: { createdAt: "asc" } },
      otherProductConfigs: { orderBy: { createdAt: "asc" } },
      attachments: { orderBy: { createdAt: "desc" } },
      notes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
      issues: {
        where: { archivedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, status: true },
      },
    },
  });

  if (!project || project.archivedAt) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  return NextResponse.json(project, {
    headers: { "Cache-Control": "private, no-store, must-revalidate" },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_PROJECT_DETAIL);
  if (denied) return denied;

  const { id } = await params;
  const body = (await request.json()) as {
    archive?: boolean;
    name?: string;
    customerId?: string;
    processorConfigs?: ProcessorIn[];
    receiverCardConfigs?: ReceiverIn[];
    otherProductConfigs?: OtherIn[];
  };

  if (body.archive === true) {
    if (!isPrivilegedAdmin(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const archivedProject = await prisma.project.update({
      where: { id },
      data: { archivedAt: new Date() },
      select: { id: true, name: true },
    });
    await writeAuditLog({
      actorId: session.user.id,
      entityType: "Project",
      entityId: archivedProject.id,
      action: "ARCHIVE",
      description: `Project "${archivedProject.name}" archived.`,
    });
    return NextResponse.json({ ok: true });
  }

  const name = body.name?.trim() ?? "";
  const customerId = body.customerId?.trim() ?? "";
  if (!name || !customerId) {
    return NextResponse.json(
      { error: "Project name and customer are required." },
      { status: 400 },
    );
  }

  const processorConfigs = (body.processorConfigs ?? [])
    .map((item) => ({
      model: (item.model ?? "").trim(),
      firmware: (item.firmware ?? "").trim(),
      quantity: Number(item.quantity ?? 0),
    }))
    .filter((item) => item.model && item.quantity > 0);

  const receiverCardConfigs = (body.receiverCardConfigs ?? [])
    .map((item) => ({
      model: (item.model ?? "").trim(),
      version: (item.version ?? "").trim(),
      quantity: Number(item.quantity ?? 0),
    }))
    .filter((item) => item.model && item.quantity > 0);

  const otherProductConfigs = (body.otherProductConfigs ?? [])
    .map((item) => ({
      category: (item.category ?? "").trim(),
      model: (item.model ?? "").trim(),
      quantity: Number(item.quantity ?? 0),
    }))
    .filter((item) => item.category && item.model && item.quantity > 0);

  const product = buildProductLabel(processorConfigs, receiverCardConfigs, otherProductConfigs);

  const project = await prisma.project.update({
    where: { id },
    data: {
      name,
      customerId,
      product,
      processorConfigs: { deleteMany: {}, create: processorConfigs },
      receiverCardConfigs: { deleteMany: {}, create: receiverCardConfigs },
      otherProductConfigs: { deleteMany: {}, create: otherProductConfigs },
    },
    include: {
      customer: true,
      processorConfigs: true,
      receiverCardConfigs: true,
      otherProductConfigs: true,
      attachments: true,
      notes: {
        include: { author: { select: { id: true, name: true, email: true } } },
      },
      issues: { select: { id: true, title: true, status: true } },
    },
  });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "Project",
    entityId: project.id,
    action: "UPDATE",
    description: `Project "${project.name}" edited from project details page.`,
  });

  return NextResponse.json(project);
}

