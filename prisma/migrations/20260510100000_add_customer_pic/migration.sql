-- CreateTable: CustomerPIC
CREATE TABLE "CustomerPIC" (
    "id"         TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "phone"      TEXT,
    "jabatan"    TEXT,
    "isActive"   BOOLEAN NOT NULL DEFAULT true,
    "notes"      TEXT,
    "deletedAt"  TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPIC_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerPIC_customerId_idx" ON "CustomerPIC"("customerId");
CREATE INDEX "CustomerPIC_customerId_isActive_idx" ON "CustomerPIC"("customerId", "isActive");

-- AddForeignKey
ALTER TABLE "CustomerPIC"
    ADD CONSTRAINT "CustomerPIC_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
