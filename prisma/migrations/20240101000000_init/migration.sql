-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR', 'DRIVER', 'SALES');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('WARUNG', 'DEPOT', 'TOKO');

-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('PREORDER', 'HOTLINE', 'CANVAS', 'ADMIN_INPUT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'CONFIRMED', 'ASSIGNED', 'LOADED', 'DELIVERED', 'PARTIAL', 'REJECTED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('WEATHER', 'CUSTOMER_CLOSED', 'ALREADY_BOUGHT', 'LATE_DELIVERY', 'REDUCED_NEED', 'OTHER');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'SICK', 'LEAVE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Rayon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coverageArea" TEXT,
    "defaultVehicleId" TEXT,
    "activeStatus" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rayon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "capacitySak" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "operationalCostPerDay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "assignedVehicleId" TEXT,
    "status" "DriverStatus" NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "rayonId" TEXT,
    "customerType" "CustomerType" NOT NULL DEFAULT 'WARUNG',
    "defaultPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "activeStatus" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetDailyStatus" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "rayonId" TEXT NOT NULL,
    "helperName" TEXT,
    "activeStatus" BOOLEAN NOT NULL DEFAULT true,
    "departureTime" TIMESTAMP(3),
    "initialLoad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingLoad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetDailyStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "rayonId" TEXT,
    "orderChannel" "OrderChannel" NOT NULL DEFAULT 'PREORDER',
    "orderType" TEXT,
    "orderedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveredQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "returnedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "additionalQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pricePerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    "notes" TEXT,
    "deliveryDate" DATE NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "deliveredQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "returnedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "returnReason" "ReturnReason",
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionPlan" (
    "id" TEXT NOT NULL,
    "productionDate" DATE NOT NULL,
    "confirmedPreorderQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedCanvasQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riskAdjustmentQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recommendedProductionQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualProductionQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseStock" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "openingStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productionIn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loadingOut" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "returnedIn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closingStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleLoad" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "loadedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "soldQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "returnedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleLoad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceProfile" (
    "id" TEXT NOT NULL,
    "customerType" "CustomerType" NOT NULL,
    "channel" "OrderChannel" NOT NULL,
    "rayonId" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "validFrom" DATE NOT NULL,
    "validUntil" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleCost" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "fuelCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "driverCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "helperCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maintenanceCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depreciationCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverAttendance" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverPerformance" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalDelivered" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReturned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "efficiencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleMaintenance" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "serviceDate" DATE NOT NULL,
    "serviceType" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plateNumber_key" ON "Vehicle"("plateNumber");

-- CreateIndex
CREATE INDEX "Customer_rayonId_idx" ON "Customer"("rayonId");

-- CreateIndex
CREATE INDEX "Customer_activeStatus_idx" ON "Customer"("activeStatus");

-- CreateIndex
CREATE INDEX "Customer_customerType_idx" ON "Customer"("customerType");

-- CreateIndex
CREATE INDEX "FleetDailyStatus_date_idx" ON "FleetDailyStatus"("date");

-- CreateIndex
CREATE INDEX "FleetDailyStatus_vehicleId_date_idx" ON "FleetDailyStatus"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "FleetDailyStatus_driverId_date_idx" ON "FleetDailyStatus"("driverId", "date");

-- CreateIndex
CREATE INDEX "FleetDailyStatus_rayonId_date_idx" ON "FleetDailyStatus"("rayonId", "date");

-- CreateIndex
CREATE INDEX "Order_deliveryDate_status_idx" ON "Order"("deliveryDate", "status");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_vehicleId_deliveryDate_idx" ON "Order"("vehicleId", "deliveryDate");

-- CreateIndex
CREATE INDEX "Order_rayonId_deliveryDate_idx" ON "Order"("rayonId", "deliveryDate");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_orderChannel_idx" ON "Order"("orderChannel");

-- CreateIndex
CREATE INDEX "DeliveryLog_orderId_idx" ON "DeliveryLog"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryLog_vehicleId_timestamp_idx" ON "DeliveryLog"("vehicleId", "timestamp");

-- CreateIndex
CREATE INDEX "DeliveryLog_driverId_timestamp_idx" ON "DeliveryLog"("driverId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionPlan_productionDate_key" ON "ProductionPlan"("productionDate");

-- CreateIndex
CREATE INDEX "ProductionPlan_productionDate_idx" ON "ProductionPlan"("productionDate");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseStock_date_key" ON "WarehouseStock"("date");

-- CreateIndex
CREATE INDEX "WarehouseStock_date_idx" ON "WarehouseStock"("date");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleLoad_vehicleId_date_key" ON "VehicleLoad"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "VehicleLoad_vehicleId_date_idx" ON "VehicleLoad"("vehicleId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PriceProfile_customerType_channel_rayonId_validFrom_key" ON "PriceProfile"("customerType", "channel", "rayonId", "validFrom");

-- CreateIndex
CREATE INDEX "PriceProfile_customerType_channel_idx" ON "PriceProfile"("customerType", "channel");

-- CreateIndex
CREATE INDEX "PriceProfile_validFrom_validUntil_idx" ON "PriceProfile"("validFrom", "validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleCost_vehicleId_date_key" ON "VehicleCost"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "VehicleCost_vehicleId_date_idx" ON "VehicleCost"("vehicleId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DriverAttendance_driverId_date_key" ON "DriverAttendance"("driverId", "date");

-- CreateIndex
CREATE INDEX "DriverAttendance_driverId_idx" ON "DriverAttendance"("driverId");

-- CreateIndex
CREATE INDEX "DriverAttendance_date_idx" ON "DriverAttendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DriverPerformance_driverId_date_key" ON "DriverPerformance"("driverId", "date");

-- CreateIndex
CREATE INDEX "DriverPerformance_driverId_date_idx" ON "DriverPerformance"("driverId", "date");

-- CreateIndex
CREATE INDEX "VehicleMaintenance_vehicleId_serviceDate_idx" ON "VehicleMaintenance"("vehicleId", "serviceDate");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_assignedVehicleId_fkey" FOREIGN KEY ("assignedVehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_rayonId_fkey" FOREIGN KEY ("rayonId") REFERENCES "Rayon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetDailyStatus" ADD CONSTRAINT "FleetDailyStatus_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetDailyStatus" ADD CONSTRAINT "FleetDailyStatus_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetDailyStatus" ADD CONSTRAINT "FleetDailyStatus_rayonId_fkey" FOREIGN KEY ("rayonId") REFERENCES "Rayon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_rayonId_fkey" FOREIGN KEY ("rayonId") REFERENCES "Rayon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryLog" ADD CONSTRAINT "DeliveryLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryLog" ADD CONSTRAINT "DeliveryLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryLog" ADD CONSTRAINT "DeliveryLog_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleLoad" ADD CONSTRAINT "VehicleLoad_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceProfile" ADD CONSTRAINT "PriceProfile_rayonId_fkey" FOREIGN KEY ("rayonId") REFERENCES "Rayon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleCost" ADD CONSTRAINT "VehicleCost_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverAttendance" ADD CONSTRAINT "DriverAttendance_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverPerformance" ADD CONSTRAINT "DriverPerformance_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleMaintenance" ADD CONSTRAINT "VehicleMaintenance_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
