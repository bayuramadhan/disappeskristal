-- CreateTable: OrderVehicleAssignment (alokasi sak per kendaraan — split delivery)
CREATE TABLE "OrderVehicleAssignment" (
    "id"        TEXT NOT NULL,
    "orderId"   TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "qty"       DOUBLE PRECISION NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderVehicleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderVehicleAssignment_orderId_idx"          ON "OrderVehicleAssignment"("orderId");
CREATE INDEX "OrderVehicleAssignment_vehicleId_idx"        ON "OrderVehicleAssignment"("vehicleId");
CREATE INDEX "OrderVehicleAssignment_orderId_vehicleId_idx" ON "OrderVehicleAssignment"("orderId", "vehicleId");

ALTER TABLE "OrderVehicleAssignment"
  ADD CONSTRAINT "OrderVehicleAssignment_orderId_fkey"
    FOREIGN KEY ("orderId")   REFERENCES "Order"("id")   ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderVehicleAssignment"
  ADD CONSTRAINT "OrderVehicleAssignment_vehicleId_fkey"
    FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
