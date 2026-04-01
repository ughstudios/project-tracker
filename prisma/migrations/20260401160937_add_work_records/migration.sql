-- CreateTable
CREATE TABLE "public"."WorkRecord" (
    "id" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "WorkRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkRecord_userId_workDate_idx" ON "public"."WorkRecord"("userId", "workDate");

-- AddForeignKey
ALTER TABLE "public"."WorkRecord" ADD CONSTRAINT "WorkRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
