import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

/** Normalized email used for the first real super-admin after zero-reset. */
const TARGET_EMAIL = "dreamteamfc@proton.me";
const TARGET_DISPLAY_NAME = "Dream Team FC";

async function main() {
  const existing = await prisma.user.findFirst({
    where: { email: { equals: TARGET_EMAIL, mode: "insensitive" } },
    select: {
      id: true,
      email: true,
      role: true,
      authUserId: true,
      displayName: true
    }
  });

  if (!existing) {
    const created = await prisma.user.create({
      data: {
        email: TARGET_EMAIL,
        displayName: TARGET_DISPLAY_NAME,
        role: UserRole.USER
      },
      select: {
        id: true,
        email: true,
        role: true,
        authUserId: true,
        displayName: true
      }
    });
    console.log("CREATED_USER:", JSON.stringify(created, null, 2));
    console.log("NEXT: fai login su /login con questa email, poi riesegui con --promote");
    return;
  }

  const promote = process.argv.includes("--promote");

  if (!promote) {
    console.log("EXISTING:", JSON.stringify(existing, null, 2));
    if (!existing.authUserId) {
      console.log("WAITING_LOGIN: authUserId ancora null — fai login su /login");
      return;
    }
    console.log("READY_TO_PROMOTE: riesegui con --promote");
    return;
  }

  if (!existing.authUserId) {
    throw new Error(
      "Impossibile promuovere: authUserId assente. Fai prima login su /login."
    );
  }

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: { role: UserRole.ADMIN },
    select: {
      id: true,
      email: true,
      role: true,
      authUserId: true,
      displayName: true
    }
  });

  console.log("PROMOTED_ADMIN:", JSON.stringify(updated, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
