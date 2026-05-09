-- CreateTable: Armada (pairing driver + kendaraan + helper + rayon default)
CREATE TABLE "Armada" (
    "id"           TEXT NOT NULL,
    "vehicleId"    TEXT NOT NULL,
    "driverId"     TEXT NOT NULL,
    "helperName"   TEXT,
    "rayonId"      TEXT,
    "activeStatus" BOOLEAN NOT NULL DEFAULT true,
    "notes"        TEXT,
    "deletedAt"    TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Armada_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Armada_vehicleId_idx"    ON "Armada"("vehicleId");
CREATE INDEX "Armada_driverId_idx"     ON "Armada"("driverId");
CREATE INDEX "Armada_activeStatus_idx" ON "Armada"("activeStatus");

ALTER TABLE "Armada" ADD CONSTRAINT "Armada_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Armada" ADD CONSTRAINT "Armada_driverId_fkey"  FOREIGN KEY ("driverId")  REFERENCES "Driver"("id")  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Armada" ADD CONSTRAINT "Armada_rayonId_fkey"   FOREIGN KEY ("rayonId")   REFERENCES "Rayon"("id")   ON DELETE SET NULL ON UPDATE CASCADE;
