-- CreateTable Unit
CREATE TABLE "Unit" (
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "unitsPerSak"  DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isBase"       BOOLEAN NOT NULL DEFAULT false,
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Unit_abbreviation_key" ON "Unit"("abbreviation");
CREATE INDEX "Unit_isActive_idx" ON "Unit"("isActive");

-- Seed unit dasar
INSERT INTO "Unit" ("id", "name", "abbreviation", "unitsPerSak", "isBase", "isActive", "updatedAt")
VALUES
  ('unit_sak', 'Sak',      'sak', 1,  true,  true, CURRENT_TIMESTAMP),
  ('unit_kg',  'Kilogram', 'kg',  25, false, true, CURRENT_TIMESTAMP),
  ('unit_ton', 'Ton',      'ton', 40, false, true, CURRENT_TIMESTAMP);

-- Add uomId to Order
ALTER TABLE "Order" ADD COLUMN "uomId" TEXT;
ALTER TABLE "Order"
    ADD CONSTRAINT "Order_uomId_fkey"
    FOREIGN KEY ("uomId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add uomId to WaDraft
ALTER TABLE "WaDraft" ADD COLUMN "uomId" TEXT;
ALTER TABLE "WaDraft"
    ADD CONSTRAINT "WaDraft_uomId_fkey"
    FOREIGN KEY ("uomId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
