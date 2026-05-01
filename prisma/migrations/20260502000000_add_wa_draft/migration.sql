-- CreateTable
CREATE TABLE "WaDraft" (
    "id" TEXT NOT NULL,
    "rawMessage" TEXT NOT NULL,
    "customerNameHint" TEXT,
    "customerId" TEXT,
    "orderedQty" DOUBLE PRECISION,
    "deliveryDate" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaDraft_createdAt_idx" ON "WaDraft"("createdAt");

-- AddForeignKey
ALTER TABLE "WaDraft" ADD CONSTRAINT "WaDraft_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
