-- ============================================================
-- Migration: Multi-Location Customer
-- Setiap customer bisa punya banyak toko/lokasi pengiriman
-- ============================================================

-- 1. Buat tabel CustomerLocation
CREATE TABLE "CustomerLocation" (
    "id"           TEXT NOT NULL,
    "customerId"   TEXT NOT NULL,
    "namaLokasi"   TEXT NOT NULL,
    "alamat"       TEXT,
    "rayonId"      TEXT,
    "gpsLat"       DOUBLE PRECISION,
    "gpsLng"       DOUBLE PRECISION,
    "isDefault"    BOOLEAN NOT NULL DEFAULT true,
    "activeStatus" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt"    TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerLocation_pkey" PRIMARY KEY ("id")
);

-- 2. Index
CREATE INDEX "CustomerLocation_customerId_idx"  ON "CustomerLocation"("customerId");
CREATE INDEX "CustomerLocation_rayonId_idx"     ON "CustomerLocation"("rayonId");
CREATE INDEX "CustomerLocation_isDefault_idx"   ON "CustomerLocation"("isDefault");

-- 3. FK CustomerLocation → Customer & Rayon
ALTER TABLE "CustomerLocation"
    ADD CONSTRAINT "CustomerLocation_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerLocation"
    ADD CONSTRAINT "CustomerLocation_rayonId_fkey"
    FOREIGN KEY ("rayonId") REFERENCES "Rayon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Migrasi data: setiap Customer lama → 1 default CustomerLocation
INSERT INTO "CustomerLocation" (
    "id", "customerId", "namaLokasi", "alamat", "rayonId",
    "gpsLat", "gpsLng", "isDefault", "activeStatus", "createdAt", "updatedAt"
)
SELECT
    'loc_' || "id",          -- id baru
    "id",                    -- customerId
    "name",                  -- namaLokasi = nama customer (default)
    "address",               -- alamat
    "rayonId",               -- rayonId
    "gpsLat",
    "gpsLng",
    true,                    -- isDefault
    "activeStatus",
    "createdAt",
    "updatedAt"
FROM "Customer"
WHERE "deletedAt" IS NULL;

-- 5. Tambah kolom deliveryLocationId ke Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryLocationId" TEXT;

-- 6. Isi deliveryLocationId dari customer lama (pakai default location yang baru dibuat)
UPDATE "Order" o
SET "deliveryLocationId" = 'loc_' || o."customerId"
WHERE o."deliveryLocationId" IS NULL
  AND EXISTS (
      SELECT 1 FROM "CustomerLocation" cl
      WHERE cl."id" = 'loc_' || o."customerId"
  );

-- 7. FK Order → CustomerLocation
CREATE INDEX "Order_deliveryLocationId_idx" ON "Order"("deliveryLocationId");

ALTER TABLE "Order"
    ADD CONSTRAINT "Order_deliveryLocationId_fkey"
    FOREIGN KEY ("deliveryLocationId") REFERENCES "CustomerLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 8. Tambah deliveryLocationId ke WaDraft
ALTER TABLE "WaDraft" ADD COLUMN IF NOT EXISTS "deliveryLocationId" TEXT;

ALTER TABLE "WaDraft"
    ADD CONSTRAINT "WaDraft_deliveryLocationId_fkey"
    FOREIGN KEY ("deliveryLocationId") REFERENCES "CustomerLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 9. Hapus kolom lama dari Customer (sudah ada di CustomerLocation)
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "address";
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "rayonId";
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "gpsLat";
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "gpsLng";
ALTER TABLE "Customer" DROP INDEX IF EXISTS "Customer_rayonId_idx";
