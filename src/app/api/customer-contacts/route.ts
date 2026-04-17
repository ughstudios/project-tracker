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

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_CUSTOMER_DETAIL);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId")?.trim() ?? "";

  const contacts = await prisma.customerContact.findMany({
    where: customerId
      ? { customerId, customer: { archivedAt: null } }
      : { customer: { archivedAt: null } },
    orderBy: [{ name: "asc" }, { createdAt: "desc" }],
    include: { customer: { select: { id: true, name: true } } },
  });

  return NextResponse.json(contacts);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await guardEmployeeNavApi(session, TABS_CUSTOMER_DETAIL);
  if (denied) return denied;

  const body = await readPayload(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const customerId = clean(body.customerId, 200);
  const name = clean(body.name, 200);
  const email = clean(body.email, 320).toLowerCase();
  const phone = clean(body.phone, 80);
  const title = clean(body.title, 160);
  const notes = clean(body.notes, 2000);

  if (!customerId || !name) {
    return NextResponse.json(
      { error: "Customer and contact name are required." },
      { status: 400 },
    );
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, archivedAt: true },
  });
  if (!customer || customer.archivedAt) {
    return NextResponse.json({ error: "Selected customer not found." }, { status: 404 });
  }

  const contact = await prisma.customerContact.create({
    data: { customerId, name, email, phone, title, notes },
    include: { customer: { select: { id: true, name: true } } },
  });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "CustomerContact",
    entityId: contact.id,
    action: "CREATE",
    description: `Contact "${contact.name}" added to customer "${customer.name}".`,
  });

  return NextResponse.json(contact, { status: 201 });
}
