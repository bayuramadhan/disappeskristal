-- AlterTable
ALTER TABLE "WarehouseStock" ADD COLUMN "adjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "adjustmentNotes" TEXT;
