-- CreateTable
CREATE TABLE "BlobRelayUpload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "totalSize" INTEGER NOT NULL,
    "received" INTEGER NOT NULL DEFAULT 0,
    "nextChunkSeq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlobRelayUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlobRelayChunk" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlobRelayChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlobRelayUpload_userId_createdAt_idx" ON "BlobRelayUpload"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BlobRelayChunk_sessionId_idx" ON "BlobRelayChunk"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "BlobRelayChunk_sessionId_seq_key" ON "BlobRelayChunk"("sessionId", "seq");

-- AddForeignKey
ALTER TABLE "BlobRelayChunk" ADD CONSTRAINT "BlobRelayChunk_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BlobRelayUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
