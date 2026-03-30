import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@example.com";
  const adminPassword = "admin123";
  const adminName = "Admin User";

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: adminName, passwordHash, role: "ADMIN" },
    create: {
      email: adminEmail,
      name: adminName,
      passwordHash,
      role: "ADMIN",
    },
  });

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
  console.log("Login: admin@example.com / admin123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
