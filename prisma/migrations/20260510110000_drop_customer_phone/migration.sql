-- Nomor HP dipindahkan ke CustomerPIC.phone
-- Fonnte lookup via PIC phone, bukan Customer.phone
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "phone";
