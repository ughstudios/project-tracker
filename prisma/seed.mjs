import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

const DANIEL_EMAIL = "daniel.gleason@lednets.com";
const LEGACY_ADMIN_EMAIL = "admin@example.com";

async function main() {
  let daniel = await prisma.user.findUnique({ where: { email: DANIEL_EMAIL } });

  if (!daniel) {
    const initialPassword = process.env.SEED_ADMIN_PASSWORD ?? "please-change-me";
    const passwordHash = await bcrypt.hash(initialPassword, 10);
    daniel = await prisma.user.create({
      data: {
        email: DANIEL_EMAIL,
        name: "Daniel Gleason",
        passwordHash,
        role: "ADMIN",
        approvalStatus: "APPROVED",
      },
    });
    console.log(`Created ${DANIEL_EMAIL} as ADMIN (password from SEED_ADMIN_PASSWORD or default "please-change-me").`);
  } else {
    await prisma.user.update({
      where: { id: daniel.id },
      data: { role: "ADMIN", approvalStatus: "APPROVED" },
    });
    console.log(`Updated ${DANIEL_EMAIL} to ADMIN.`);
  }

  const legacyAdmin = await prisma.user.findUnique({ where: { email: LEGACY_ADMIN_EMAIL } });
  if (legacyAdmin) {
    await prisma.issue.updateMany({
      where: { reporterId: legacyAdmin.id },
      data: { reporterId: daniel.id },
    });
    await prisma.issue.updateMany({
      where: { assigneeId: legacyAdmin.id },
      data: { assigneeId: null },
    });
    await prisma.issueThreadEntry.updateMany({
      where: { authorId: legacyAdmin.id },
      data: { authorId: daniel.id },
    });
    await prisma.projectNote.updateMany({
      where: { authorId: legacyAdmin.id },
      data: { authorId: daniel.id },
    });
    await prisma.user.delete({ where: { id: legacyAdmin.id } });
    console.log(`Removed legacy account ${LEGACY_ADMIN_EMAIL} (data reassigned to ${DANIEL_EMAIL} where needed).`);
  }

  await prisma.user.upsert({
    where: { email: "employee1@example.com" },
    update: {},
    create: {
      email: "employee1@example.com",
      name: "Employee One",
      passwordHash: await bcrypt.hash("employee123", 10),
      role: "EMPLOYEE",
    },
  });

  console.log("Seed complete.");
  console.log(`Admin login: ${DANIEL_EMAIL}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
