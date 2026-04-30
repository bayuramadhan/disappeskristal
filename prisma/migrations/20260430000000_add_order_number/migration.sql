-- AlterTable: add orderNumber column
ALTER TABLE "Order" ADD COLUMN "orderNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
