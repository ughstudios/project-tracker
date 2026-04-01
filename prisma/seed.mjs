import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

const DANIEL_EMAIL = "daniel.gleason@lednets.com";
const DEMO_ADMIN_EMAIL = "admin@example.com";
const DEMO_ADMIN_PASSWORD = "admin123";

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

  const demoAdminHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    update: {
      name: "Admin User",
      passwordHash: demoAdminHash,
      role: "EMPLOYEE",
      approvalStatus: "APPROVED",
    },
    create: {
      email: DEMO_ADMIN_EMAIL,
      name: "Admin User",
      passwordHash: demoAdminHash,
      role: "EMPLOYEE",
      approvalStatus: "APPROVED",
    },
  });
  console.log(`Ensured ${DEMO_ADMIN_EMAIL} as EMPLOYEE (password: ${DEMO_ADMIN_PASSWORD}).`);

  const deleted = await prisma.user.deleteMany({
    where: { email: "employee1@example.com" },
  });
  if (deleted.count > 0) {
    console.log("Removed demo user employee1@example.com.");
  }

  console.log("Seed complete.");
  console.log(`Admin login: ${DANIEL_EMAIL}`);
  console.log(`Demo employee (not admin): ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
