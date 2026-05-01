import { prisma } from '@/lib/db'

/**
 * Upsert WarehouseStock for a given date, then recompute closingStock.
 *
 * closingStock = openingStock + productionIn - loadingOut + returnedIn + adjustment
 *
 * If the record doesn't exist yet, openingStock is copied from the previous
 * day's closingStock automatically.
 */
export async function syncWarehouseStock(
  date: Date,
  delta: {
    productionIn?: number
    loadingOut?:  number
    returnedIn?:  number
  },
) {
  const existing = await prisma.warehouseStock.findUnique({ where: { date } })

  if (existing) {
    // update returns post-increment values, use them directly for closingStock
    const updated = await prisma.warehouseStock.update({
      where: { date },
      data: {
        productionIn: { increment: delta.productionIn ?? 0 },
        loadingOut:   { increment: delta.loadingOut   ?? 0 },
        returnedIn:   { increment: delta.returnedIn   ?? 0 },
      },
    })
    return prisma.warehouseStock.update({
      where: { date },
      data: {
        closingStock:
          updated.openingStock +
          updated.productionIn -
          updated.loadingOut   +
          updated.returnedIn   +
          updated.adjustment,
      },
    })
  }

  // No record yet — carry over yesterday's closingStock as openingStock
  const yesterday = new Date(date)
  yesterday.setDate(yesterday.getDate() - 1)
  const prev = await prisma.warehouseStock.findUnique({ where: { date: yesterday } })
  const openingStock = prev?.closingStock ?? 0

  const productionIn = delta.productionIn ?? 0
  const loadingOut   = delta.loadingOut   ?? 0
  const returnedIn   = delta.returnedIn   ?? 0

  return prisma.warehouseStock.create({
    data: {
      date,
      openingStock,
      productionIn,
      loadingOut,
      returnedIn,
      adjustment:   0,
      closingStock: openingStock + productionIn - loadingOut + returnedIn,
    },
  })
}

/**
 * Apply a manual adjustment to today's (or any date's) WarehouseStock.
 * Creates the record first if it doesn't exist.
 */
export async function applyWarehouseAdjustment(
  date: Date,
  adjustment: number,
  notes?: string,
) {
  await syncWarehouseStock(date, {}) // ensure record exists

  const updated = await prisma.warehouseStock.update({
    where: { date },
    data: {
      adjustment:      { increment: adjustment },
      adjustmentNotes: notes ?? undefined,
    },
  })

  return prisma.warehouseStock.update({
    where: { date },
    data: {
      closingStock:
        updated.openingStock +
        updated.productionIn -
        updated.loadingOut   +
        updated.returnedIn   +
        updated.adjustment,
    },
  })
}
