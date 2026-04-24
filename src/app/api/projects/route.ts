import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { TABS_PROJECT_DETAIL } from "@/lib/employee-nav-shared";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_PROJECT_DETAIL);
  if (denied) return denied;

  const projects = await prisma.project.findMany({
    where: { archivedAt: null, customer: { archivedAt: null } },
    orderBy: { name: "asc" },
    include: {
      customer: true,
      manager: { select: { id: true, name: true, email: true } },
      processorConfigs: {
        orderBy: { createdAt: "asc" },
      },
      receiverCardConfigs: {
        orderBy: { createdAt: "asc" },
      },
      otherProductConfigs: {
        orderBy: { createdAt: "asc" },
      },
      attachments: {
        orderBy: { createdAt: "desc" },
      },
      notes: {
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      },
      issues: {
        where: { archivedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, status: true },
      },
      _count: {
        select: { issues: { where: { archivedAt: null } } },
      },
    },
  });

  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_PROJECT_DETAIL);
  if (denied) return denied;

  const body = (await request.json()) as {
    name?: string;
    customerId?: string;
    managerId?: string | null;
    processorConfigs?: Array<{ model?: string; firmware?: string; quantity?: number }>;
    receiverCardConfigs?: Array<{ model?: string; version?: string; quantity?: number }>;
    otherProductConfigs?: Array<{ category?: string; model?: string; quantity?: number }>;
  };
  const name = body.name?.trim() ?? "";
  const customerId = body.customerId?.trim() ?? "";
  const managerId = body.managerId?.trim() || null;

  if (!name || !customerId) {
    return NextResponse.json(
      { error: "Project name and customer are required." },
      { status: 400 },
    );
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, archivedAt: true },
  });
  if (!customer || customer.archivedAt) {
    return NextResponse.json({ error: "Selected customer not found." }, { status: 404 });
  }

  if (managerId) {
    const manager = await prisma.user.findFirst({
      where: { id: managerId, approvalStatus: "APPROVED" },
      select: { id: true },
    });
    if (!manager) {
      return NextResponse.json({ error: "Selected manager not found." }, { status: 404 });
    }
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

  const selectedModels = [
    ...processorConfigs.map((p) => p.model),
    ...receiverCardConfigs.map((r) => r.model),
    ...otherProductConfigs.map((o) => o.model),
  ];
  const uniqueModels = Array.from(new Set(selectedModels)).filter(Boolean);
  const product =
    uniqueModels.length === 0
      ? "Custom Project"
      : uniqueModels.length <= 3
        ? uniqueModels.join(" + ")
        : `${uniqueModels.slice(0, 3).join(" + ")} +${uniqueModels.length - 3} more`;

  const project = await prisma.project.upsert({
    where: { name },
    update: {
      product,
      customerId,
      managerId,
      archivedAt: null,
      processorConfigs: {
        deleteMany: {},
        create: processorConfigs,
      },
      receiverCardConfigs: {
        deleteMany: {},
        create: receiverCardConfigs,
      },
      otherProductConfigs: {
        deleteMany: {},
        create: otherProductConfigs,
      },
    },
    create: {
      name,
      product,
      customerId,
      managerId,
      processorConfigs: {
        create: processorConfigs,
      },
      receiverCardConfigs: {
        create: receiverCardConfigs,
      },
      otherProductConfigs: {
        create: otherProductConfigs,
      },
    },
    include: {
      customer: true,
      manager: { select: { id: true, name: true, email: true } },
      processorConfigs: true,
      receiverCardConfigs: true,
      otherProductConfigs: true,
      attachments: true,
      notes: {
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      },
      issues: {
        where: { archivedAt: null },
        select: { id: true, title: true, status: true },
      },
      _count: {
        select: { issues: { where: { archivedAt: null } } },
      },
    },
  });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "Project",
    entityId: project.id,
    action: "UPSERT",
    description: `Project "${project.name}" created/updated with wizard config.`,
  });

  return NextResponse.json(project, { status: 201 });
}
