-- ============================================================
-- RevenueSummary VIEW
-- Menghitung pendapatan harian per rayon dari:
--   Order (delivered/partial) + VehicleCost
--
-- Jalankan SETELAH prisma migrate dev:
--   psql $DATABASE_URL -f prisma/views.sql
-- ============================================================

DROP VIEW IF EXISTS revenue_summary;

CREATE VIEW revenue_summary AS
WITH order_agg AS (
  SELECT
    o."deliveryDate"                                        AS date,
    o."rayonId",
    r."name"                                                AS "rayonName",
    COUNT(o.id)::int                                        AS "totalOrders",
    COALESCE(SUM(o."deliveredQty"), 0)                      AS "totalDeliveredQty",
    COALESCE(SUM(o."returnedQty"),  0)                      AS "totalReturnedQty",
    COALESCE(SUM(o."deliveredQty" * o."pricePerUnit"), 0)   AS "grossRevenue",
    -- Collect distinct vehicleIds delivering in this rayon on this date
    ARRAY_AGG(DISTINCT o."vehicleId") FILTER (WHERE o."vehicleId" IS NOT NULL) AS vehicle_ids
  FROM "Order" o
  LEFT JOIN "Rayon" r ON r.id = o."rayonId"
  WHERE o.status IN ('DELIVERED', 'PARTIAL')
    AND o."deletedAt" IS NULL
  GROUP BY o."deliveryDate", o."rayonId", r."name"
),
cost_agg AS (
  SELECT
    vc."vehicleId",
    vc."date",
    (vc."fuelCost" + vc."driverCost" + vc."helperCost"
     + vc."maintenanceCost" + vc."depreciationCost")        AS total_cost
  FROM "VehicleCost" vc
)
SELECT
  -- Surrogate key: MD5 of date + rayonId so Prisma can treat it as @unique
  MD5(oa.date::text || COALESCE(oa."rayonId", '__null__')) AS id,
  oa.date,
  oa."rayonId",
  oa."rayonName",
  oa."totalOrders",
  oa."totalDeliveredQty",
  oa."totalReturnedQty",
  oa."grossRevenue",
  COALESCE(
    (SELECT SUM(ca.total_cost)
     FROM cost_agg ca
     WHERE ca."date" = oa.date
       AND ca."vehicleId" = ANY(oa.vehicle_ids)
    ), 0
  )                                                         AS "totalVehicleCost",
  oa."grossRevenue" - COALESCE(
    (SELECT SUM(ca.total_cost)
     FROM cost_agg ca
     WHERE ca."date" = oa.date
       AND ca."vehicleId" = ANY(oa.vehicle_ids)
    ), 0
  )                                                         AS "netRevenue"
FROM order_agg oa;
