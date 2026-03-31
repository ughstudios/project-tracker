import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const ALLOWED_EXTENSIONS = new Set([".rcvbp", ".cbp"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, archivedAt: true },
  });
  if (!project || project.archivedAt) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required." }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: "Only .rcvbp and .cbp files are allowed." },
      { status: 400 },
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const uploadDir = path.join(process.cwd(), "public", "uploads", "projects", projectId);
  await fs.mkdir(uploadDir, { recursive: true });

  const safeBase = path.basename(file.name, ext).replace(/[^a-zA-Z0-9-_]/g, "_");
  const storedName = `${Date.now()}-${safeBase}${ext}`;
  const fullPath = path.join(uploadDir, storedName);
  await fs.writeFile(fullPath, buffer);

  const fileUrl = `/uploads/projects/${projectId}/${storedName}`;
  const attachment = await prisma.projectAttachment.create({
    data: {
      projectId,
      uploaderId: session.user.id,
      fileName: file.name,
      fileUrl,
      fileType: ext.slice(1),
      fileSize: file.size,
    },
  });

  await writeAuditLog({
    actorId: session.user.id,
    entityType: "ProjectAttachment",
    entityId: attachment.id,
    action: "UPLOAD",
    description: `${file.name} attached to project ${projectId}.`,
  });

  return NextResponse.json(attachment, { status: 201 });
}

