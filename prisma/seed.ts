import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "password123";

const DEPARTMENTS = [
  { code: "MIOP", name: "Mining & Operation", color: "#3b82f6" },
  { code: "HSE", name: "Health, Safety & Environment", color: "#ef4444" },
  { code: "MPMA", name: "Mineral Product Management", color: "#10b981" },
];

const USERS = [
  { username: "MIOP", email: "miop@aspire.id", role: "MIOP" },
  { username: "HSE", email: "hse@aspire.id", role: "HSE" },
  { username: "MPMA", email: "mpma@aspire.id", role: "MPMA" },
];

async function main() {
  for (const d of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name, color: d.color },
      create: d,
    });
  }

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: { email: u.email, role: u.role, passwordHash: hash },
      create: { ...u, passwordHash: hash },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
