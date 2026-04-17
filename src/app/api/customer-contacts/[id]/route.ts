import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { TABS_CUSTOMER_DETAIL } from "@/lib/employee-nav-shared";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type ContactPayload = {
  customerId?: string;
  name?: string;
  email?: string;
  phone?: string;
  title?: string;
  notes?: string;
};

function clean(value: unknown, maxLength = 500): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function readPayload(request: Request): Promise<ContactPayload | null> {
  try {
    return (await request.json()) as ContactPayload;
  } catch {
    return null;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_CUSTOMER_DETAIL);
  if (denied) return denied;

  const { id } = await params;
  const body = await readPayload(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const existing = await prisma.customerContact.findUnique({
    where: { id },
    include: { customer: { select: { id: true, name: true, archivedAt: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  const nextCustomerId = clean(body.customerId, 200) || existing.customerId;
  const nextName = clean(body.name, 200);
  if (!nextName) {
    return NextResponse.json({ error: "Contact name is required." }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({
    where: { id: nextCustomerId },
    select: { id: true, name: true, archivedAt: true },
  });
  if (!customer || customer.archivedAt) {
    return NextResponse.json({ error: "Selected customer not found." }, { status: 404 });
  }

  const contact = await prisma.customerContact.update({
    where: { id },
    data: {
      customerId: nextCustomerId,
      name: nextName,
      email: clean(body.email, 320).toLowerCase(),
      phone: clean(body.phone, 80),
      title: clean(body.title, 160),
      notes: clean(body.notes, 2000),
    },
    include: { customer: { select: { id: true, name: true } } },
  });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "CustomerContact",
    entityId: contact.id,
    action: "UPDATE",
    description:
      existing.customerId === nextCustomerId
        ? `Contact "${contact.name}" updated for customer "${customer.name}".`
        : `Contact "${contact.name}" moved from "${existing.customer.name}" to "${customer.name}".`,
  });

  return NextResponse.json(contact);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_CUSTOMER_DETAIL);
  if (denied) return denied;

  const { id } = await params;
  const contact = await prisma.customerContact.findUnique({
    where: { id },
    include: { customer: { select: { name: true } } },
  });
  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  await prisma.customerContact.delete({ where: { id } });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "CustomerContact",
    entityId: contact.id,
    action: "DELETE",
    description: `Contact "${contact.name}" removed from customer "${contact.customer.name}".`,
  });

  return NextResponse.json({ ok: true });
}
