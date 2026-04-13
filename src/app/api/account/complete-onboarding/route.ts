import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  await prisma.user.updateMany({
    where: { id: session.user.id, onboardingCompletedAt: null },
    data: { onboardingCompletedAt: now },
  });

  return NextResponse.json({ ok: true });
}
