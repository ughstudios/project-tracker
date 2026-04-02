-- CreateEnum
CREATE TYPE "WarehouseItemKind" AS ENUM ('PROCESSOR', 'RECEIVER_CARD', 'OTHER');

-- CreateTable
CREATE TABLE "WarehouseStockLine" (
    "id" TEXT NOT NULL,
    "kind" "WarehouseItemKind" NOT NULL,
    "model" TEXT NOT NULL,
    "firmware" TEXT NOT NULL DEFAULT '',
    "receiverVersion" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseStockLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WarehouseStockLine_kind_idx" ON "WarehouseStockLine"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseStockLine_kind_model_firmware_receiverVersion_category_key" ON "WarehouseStockLine"("kind", "model", "firmware", "receiverVersion", "category");
