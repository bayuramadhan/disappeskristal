-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('ORDER_ASSIGNED', 'ORDER_UNASSIGNED', 'DELIVERY_LOGGED', 'FLEET_UPDATED');

-- AlterTable: CustomerLocation default fix (CustomerPIC not yet created at this point — moved to add_customer_pic)
ALTER TABLE "CustomerLocation" ALTER COLUMN "isDefault" SET DEFAULT false,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "userName" TEXT,
    "userEmail" TEXT,
    "action" "ActivityAction" NOT NULL,
    "vehicleId" TEXT,
    "orderId" TEXT,
    "date" TIMESTAMP(3),
    "meta" JSONB,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_date_idx" ON "ActivityLog"("date");

-- CreateIndex
CREATE INDEX "ActivityLog_timestamp_idx" ON "ActivityLog"("timestamp");

-- CreateIndex
CREATE INDEX "ActivityLog_vehicleId_idx" ON "ActivityLog"("vehicleId");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
