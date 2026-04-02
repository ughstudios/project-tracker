import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

const DANIEL_EMAIL = "daniel.gleason@lednets.com";

async function removeAdminExampleUser() {
  const demo = await prisma.user.findUnique({ where: { email: "admin@example.com" } });
  if (!demo) return;

  const replacement =
    (await prisma.user.findUnique({ where: { email: DANIEL_EMAIL } })) ??
    (await prisma.user.findFirst({
      where: { id: { not: demo.id } },
      orderBy: { createdAt: "asc" },
    }));

  if (replacement) {
    await prisma.issue.updateMany({ where: { assigneeId: demo.id }, data: { assigneeId: null } });
    await prisma.issue.updateMany({
      where: { reporterId: demo.id },
      data: { reporterId: replacement.id },
    });
    await prisma.issueThreadEntry.updateMany({
      where: { authorId: demo.id },
      data: { authorId: replacement.id },
    });
    await prisma.projectNote.updateMany({
      where: { authorId: demo.id },
      data: { authorId: replacement.id },
    });
  }

  try {
    await prisma.user.delete({ where: { id: demo.id } });
    console.log("Removed user admin@example.com.");
  } catch (e) {
    console.error("Could not remove admin@example.com:", e?.message ?? e);
  }
}

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
        role: "SUPER_ADMIN",
        approvalStatus: "APPROVED",
      },
    });
    console.log(
      `Created ${DANIEL_EMAIL} as SUPER_ADMIN (password from SEED_ADMIN_PASSWORD or default "please-change-me").`,
    );
  } else {
    await prisma.user.update({
      where: { id: daniel.id },
      data: { role: "SUPER_ADMIN", approvalStatus: "APPROVED" },
    });
    console.log(`Updated ${DANIEL_EMAIL} to SUPER_ADMIN.`);
  }

  await removeAdminExampleUser();

  const deleted = await prisma.user.deleteMany({
    where: { email: "employee1@example.com" },
  });
  if (deleted.count > 0) {
    console.log("Removed demo user employee1@example.com.");
  }

  const promoted = await prisma.user.updateMany({
    where: { role: "ADMIN" },
    data: { role: "SUPER_ADMIN" },
  });
  if (promoted.count > 0) {
    console.log(
      `Promoted ${promoted.count} user(s) from Admin to Super admin (legacy ADMIN tier).`,
    );
  }

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
