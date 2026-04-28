import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ─── helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting seed...')

  // ── USER (admin + operator) ───────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('admin123', 10)

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@distribusipro.com' },
    update: {},
    create: {
      name: 'Administrator',
      email: 'admin@distribusipro.com',
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
    },
  })

  await prisma.user.upsert({
    where: { email: 'operator@distribusipro.com' },
    update: {},
    create: {
      name: 'Operator 1',
      email: 'operator@distribusipro.com',
      password: await bcrypt.hash('operator123', 10),
      role: 'OPERATOR',
      isActive: true,
    },
  })

  console.log(`✅ Created users (admin: ${adminUser.email})`)

  // ── RAYON (5) ─────────────────────────────────────────────────────────────
  const rayons = await Promise.all([
    prisma.rayon.create({ data: { name: 'Rayon Utara',  coverageArea: 'Kota Utara & Sekitar',  activeStatus: true } }),
    prisma.rayon.create({ data: { name: 'Rayon Selatan', coverageArea: 'Kota Selatan & Sekitar', activeStatus: true } }),
    prisma.rayon.create({ data: { name: 'Rayon Timur',  coverageArea: 'Kota Timur & Sekitar',   activeStatus: true } }),
    prisma.rayon.create({ data: { name: 'Rayon Barat',  coverageArea: 'Kota Barat & Sekitar',   activeStatus: true } }),
    prisma.rayon.create({ data: { name: 'Rayon Pusat',  coverageArea: 'Pusat Kota & Sekitar',   activeStatus: true } }),
  ])
  console.log(`✅ Created ${rayons.length} rayons`)

  // ── VEHICLE (6) ───────────────────────────────────────────────────────────
  const vehicles = await Promise.all([
    prisma.vehicle.create({ data: { plateNumber: 'B 1234 ABC', capacitySak: 200, operationalCostPerDay: 350_000, status: 'ACTIVE' } }),
    prisma.vehicle.create({ data: { plateNumber: 'B 5678 DEF', capacitySak: 250, operationalCostPerDay: 400_000, status: 'ACTIVE' } }),
    prisma.vehicle.create({ data: { plateNumber: 'B 9012 GHI', capacitySak: 180, operationalCostPerDay: 300_000, status: 'ACTIVE' } }),
    prisma.vehicle.create({ data: { plateNumber: 'B 3456 JKL', capacitySak: 300, operationalCostPerDay: 450_000, status: 'ACTIVE' } }),
    prisma.vehicle.create({ data: { plateNumber: 'B 7890 MNO', capacitySak: 220, operationalCostPerDay: 380_000, status: 'MAINTENANCE' } }),
    prisma.vehicle.create({ data: { plateNumber: 'B 1111 PQR', capacitySak: 150, operationalCostPerDay: 250_000, status: 'ACTIVE' } }),
  ])
  console.log(`✅ Created ${vehicles.length} vehicles`)

  // ── DRIVER (6) ────────────────────────────────────────────────────────────
  const drivers = await Promise.all([
    prisma.driver.create({ data: { name: 'Ahmad Suhadi',    phone: '0812-3456-7891', assignedVehicleId: vehicles[0].id, status: 'ACTIVE'   } }),
    prisma.driver.create({ data: { name: 'Budi Santoso',    phone: '0812-3456-7892', assignedVehicleId: vehicles[1].id, status: 'ACTIVE'   } }),
    prisma.driver.create({ data: { name: 'Cahyo Wibowo',    phone: '0812-3456-7893', assignedVehicleId: vehicles[2].id, status: 'ACTIVE'   } }),
    prisma.driver.create({ data: { name: 'Dedi Kurniawan',  phone: '0812-3456-7894', assignedVehicleId: vehicles[3].id, status: 'ACTIVE'   } }),
    prisma.driver.create({ data: { name: 'Eko Prasetyo',    phone: '0812-3456-7895', assignedVehicleId: null,           status: 'ON_LEAVE' } }),
    prisma.driver.create({ data: { name: 'Fajar Maulana',   phone: '0812-3456-7896', assignedVehicleId: vehicles[5].id, status: 'ACTIVE'   } }),
  ])
  console.log(`✅ Created ${drivers.length} drivers`)

  // ── CUSTOMER (20) ─────────────────────────────────────────────────────────
  const customerNames = [
    'Toko Maju Jaya',      'Warung Bu Siti',        'Depot Air Sejuk',    'Toko Berkah',
    'Warung Kopi Kenangan', 'Toko Sumber Rejeki',   'Depot Aqua',         'Warung 45',
    'Toko Baru',            'Warung Mbak Yuni',     'Depot Minuman Segar', 'Toko Lancar',
    'Warung Sedap',         'Toko Utama',            'Depot Jaya',         'Warung Rasa',
    'Toko Makmur',          'Warung Lezat',          'Depot Es Tebu',      'Toko Sentosa',
  ]
  const types: ('WARUNG' | 'DEPOT' | 'TOKO')[] = ['WARUNG', 'DEPOT', 'TOKO']

  const customers = await Promise.all(
    customerNames.map((name, i) => {
      const rayon = rayons[i % rayons.length]
      return prisma.customer.create({
        data: {
          name,
          phone:        `0813-${String(9000 + i).padStart(4, '0')}`,
          address:      `Jl. Raya ${rayon.name.split(' ')[1]} No. ${i + 1}`,
          rayonId:      rayon.id,
          customerType: types[i % 3],
          defaultPrice: 15_000 + i * 500,
          gpsLat:       -6.2  + Math.random() * 0.1,
          gpsLng:       106.8 + Math.random() * 0.1,
          activeStatus: true,
        },
      })
    })
  )
  console.log(`✅ Created ${customers.length} customers`)

  // ── ORDER + DELIVERY LOG (50) ─────────────────────────────────────────────
  const channels:      ('PREORDER' | 'HOTLINE' | 'CANVAS' | 'ADMIN_INPUT')[]                    = ['PREORDER', 'HOTLINE', 'CANVAS', 'ADMIN_INPUT']
  const statuses:      ('CREATED' | 'CONFIRMED' | 'ASSIGNED' | 'LOADED' | 'DELIVERED' | 'PARTIAL' | 'RETURNED' | 'CANCELLED')[] =
                       ['CREATED', 'CONFIRMED', 'ASSIGNED', 'LOADED', 'DELIVERED', 'PARTIAL', 'RETURNED', 'CANCELLED']
  const returnReasons: ('WEATHER' | 'CUSTOMER_CLOSED' | 'ALREADY_BOUGHT' | 'LATE_DELIVERY' | 'REDUCED_NEED')[] =
                       ['WEATHER', 'CUSTOMER_CLOSED', 'ALREADY_BOUGHT', 'LATE_DELIVERY', 'REDUCED_NEED']

  for (let i = 0; i < 50; i++) {
    const customer     = customers[i % customers.length]
    const vehicle      = vehicles[i % vehicles.length]
    const rayon        = rayons[customer.rayonId ? rayons.findIndex(r => r.id === customer.rayonId) : i % rayons.length]
    const driver       = drivers[i % drivers.length]
    const deliveryDate = daysAgo(rand(0, 29))
    const orderedQty   = rand(10, 60)
    const pricePerUnit = 15_000 + rand(0, 5_000)
    const status       = statuses[i % statuses.length]

    let deliveredQty = 0
    let returnedQty  = 0
    if (status === 'DELIVERED') {
      deliveredQty = orderedQty
    } else if (status === 'PARTIAL') {
      deliveredQty = Math.floor(orderedQty * 0.7)
      returnedQty  = orderedQty - deliveredQty
    } else if (status === 'RETURNED') {
      deliveredQty = Math.floor(orderedQty * 0.3)
      returnedQty  = orderedQty - deliveredQty
    }

    const order = await prisma.order.create({
      data: {
        customerId:   customer.id,
        vehicleId:    vehicle.id,
        rayonId:      rayon.id,
        orderChannel: channels[i % channels.length],
        orderType:    'ES_KRISTAL',
        orderedQty,
        deliveredQty,
        returnedQty,
        additionalQty: 0,
        pricePerUnit,
        status,
        notes:        i % 4 === 0 ? `Catatan pesanan #${i + 1}` : null,
        deliveryDate,
      },
    })

    if (['DELIVERED', 'PARTIAL', 'RETURNED'].includes(status)) {
      await prisma.deliveryLog.create({
        data: {
          orderId:      order.id,
          vehicleId:    vehicle.id,
          driverId:     driver.id,
          deliveredQty,
          returnedQty,
          returnReason: status === 'RETURNED' ? returnReasons[i % returnReasons.length] : null,
          timestamp:    deliveryDate,
        },
      })
    }
  }
  console.log(`✅ Created 50 orders with delivery logs`)

  // ── PRICE PROFILE ─────────────────────────────────────────────────────────
  await Promise.all([
    prisma.priceProfile.create({ data: { customerType: 'WARUNG', channel: 'PREORDER',    rayonId: null, price: 15_000, validFrom: new Date('2024-01-01'), validUntil: new Date('2026-12-31') } }),
    prisma.priceProfile.create({ data: { customerType: 'WARUNG', channel: 'HOTLINE',     rayonId: null, price: 16_000, validFrom: new Date('2024-01-01'), validUntil: new Date('2026-12-31') } }),
    prisma.priceProfile.create({ data: { customerType: 'WARUNG', channel: 'CANVAS',      rayonId: null, price: 16_500, validFrom: new Date('2024-01-01'), validUntil: new Date('2026-12-31') } }),
    prisma.priceProfile.create({ data: { customerType: 'DEPOT',  channel: 'PREORDER',    rayonId: null, price: 14_000, validFrom: new Date('2024-01-01'), validUntil: new Date('2026-12-31') } }),
    prisma.priceProfile.create({ data: { customerType: 'DEPOT',  channel: 'HOTLINE',     rayonId: null, price: 14_500, validFrom: new Date('2024-01-01'), validUntil: new Date('2026-12-31') } }),
    prisma.priceProfile.create({ data: { customerType: 'TOKO',   channel: 'PREORDER',    rayonId: null, price: 14_500, validFrom: new Date('2024-01-01'), validUntil: new Date('2026-12-31') } }),
    prisma.priceProfile.create({ data: { customerType: 'TOKO',   channel: 'ADMIN_INPUT', rayonId: null, price: 15_000, validFrom: new Date('2024-01-01'), validUntil: new Date('2026-12-31') } }),
  ])
  console.log(`✅ Created price profiles`)

  // ── FLEET DAILY STATUS (7 hari terakhir) ──────────────────────────────────
  const activeVehicles = vehicles.filter(v => v.status === 'ACTIVE')
  const activeDrivers  = drivers.filter(d => d.status === 'ACTIVE')

  for (let d = 0; d < 7; d++) {
    for (let v = 0; v < Math.min(activeVehicles.length, activeDrivers.length); v++) {
      await prisma.fleetDailyStatus.create({
        data: {
          date:         daysAgo(d),
          vehicleId:    activeVehicles[v].id,
          driverId:     activeDrivers[v].id,
          rayonId:      rayons[v % rayons.length].id,
          helperName:   `Helper ${v + 1}`,
          activeStatus: true,
          initialLoad:  rand(120, 200),
          remainingLoad: rand(0, 30),
        },
      })
    }
  }
  console.log(`✅ Created fleet daily status (7 days)`)

  // ── VEHICLE COST (10 hari terakhir, semua kendaraan aktif) ────────────────
  for (let d = 0; d < 10; d++) {
    for (const vehicle of activeVehicles) {
      await prisma.vehicleCost.create({
        data: {
          vehicleId:        vehicle.id,
          date:             daysAgo(d),
          fuelCost:         rand(120_000, 200_000),
          driverCost:       100_000,
          helperCost:       50_000,
          maintenanceCost:  rand(0, 25_000),
          depreciationCost: 30_000,
        },
      })
    }
  }
  console.log(`✅ Created vehicle costs (10 days × ${activeVehicles.length} vehicles)`)

  // ── VEHICLE LOAD (10 hari terakhir) ───────────────────────────────────────
  for (let d = 0; d < 10; d++) {
    for (const vehicle of activeVehicles) {
      const loaded   = rand(100, 200)
      const returned = rand(0, 20)
      const sold     = rand(80, loaded - returned)
      await prisma.vehicleLoad.create({
        data: {
          vehicleId:    vehicle.id,
          date:         daysAgo(d),
          loadedQty:    loaded,
          soldQty:      sold,
          returnedQty:  returned,
          remainingQty: loaded - sold - returned,
        },
      })
    }
  }
  console.log(`✅ Created vehicle loads`)

  // ── PRODUCTION PLAN (14 hari terakhir + 7 hari ke depan) ─────────────────
  for (let d = -7; d <= 14; d++) {
    const date = daysAgo(-d) // negative = future
    const preorder = rand(600, 900)
    const canvas   = rand(100, 200)
    const risk     = rand(20, 50)
    await prisma.productionPlan.upsert({
      where: { productionDate: date },
      update: {},
      create: {
        productionDate:           date,
        confirmedPreorderQty:     preorder,
        estimatedCanvasQty:       canvas,
        riskAdjustmentQty:        risk,
        recommendedProductionQty: preorder + canvas + risk,
        actualProductionQty:      d > 0 ? 0 : rand(preorder + canvas, preorder + canvas + risk + 50),
      },
    })
  }
  console.log(`✅ Created production plans`)

  // ── WAREHOUSE STOCK (14 hari terakhir) ───────────────────────────────────
  let runningStock = rand(200, 300)
  for (let d = 13; d >= 0; d--) {
    const productionIn = rand(700, 1000)
    const loadingOut   = rand(600, 900)
    const returnedIn   = rand(10, 50)
    const closing      = runningStock + productionIn - loadingOut + returnedIn
    await prisma.warehouseStock.upsert({
      where: { date: daysAgo(d) },
      update: {},
      create: {
        date:         daysAgo(d),
        openingStock: runningStock,
        productionIn,
        loadingOut,
        returnedIn,
        closingStock: closing,
      },
    })
    runningStock = closing
  }
  console.log(`✅ Created warehouse stocks`)

  // ── DRIVER ATTENDANCE (14 hari terakhir) ─────────────────────────────────
  const attStatuses: ('PRESENT' | 'ABSENT' | 'SICK' | 'LEAVE')[] = ['PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'ABSENT', 'SICK']
  for (let d = 0; d < 14; d++) {
    for (const driver of drivers) {
      await prisma.driverAttendance.create({
        data: {
          driverId: driver.id,
          date:     daysAgo(d),
          status:   attStatuses[rand(0, attStatuses.length - 1)],
        },
      })
    }
  }
  console.log(`✅ Created driver attendance (14 days)`)

  // ── DRIVER PERFORMANCE (14 hari terakhir) ────────────────────────────────
  for (let d = 0; d < 14; d++) {
    for (const driver of activeDrivers) {
      const delivered = rand(20, 60)
      const returned  = rand(0, 10)
      await prisma.driverPerformance.create({
        data: {
          driverId:       driver.id,
          date:           daysAgo(d),
          totalDelivered: delivered,
          totalReturned:  returned,
          efficiencyScore: Math.round((delivered / (delivered + returned)) * 100) / 100,
        },
      })
    }
  }
  console.log(`✅ Created driver performance (14 days)`)

  // ── VEHICLE MAINTENANCE (sample) ─────────────────────────────────────────
  const serviceTypes = ['Ganti Oli', 'Ban', 'Service Rutin', 'Rem', 'AC']
  for (let i = 0; i < vehicles.length; i++) {
    await prisma.vehicleMaintenance.create({
      data: {
        vehicleId:   vehicles[i].id,
        serviceDate: daysAgo(rand(5, 30)),
        serviceType: serviceTypes[i % serviceTypes.length],
        cost:        rand(150_000, 1_500_000),
        notes:       `Perawatan rutin ${serviceTypes[i % serviceTypes.length]}`,
      },
    })
  }
  console.log(`✅ Created vehicle maintenance records`)

  console.log('\n🎉 Seed completed successfully!')
  console.log('──────────────────────────────────')
  console.log(`   Admin login : admin@distribusipro.com / admin123`)
  console.log(`   Operator    : operator@distribusipro.com / operator123`)
  console.log('──────────────────────────────────')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
