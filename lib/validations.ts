import { z } from 'zod'

// ==================== AUTH ====================

export const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
})

export const registerSchema = z
  .object({
    name: z.string().min(2, 'Nama minimal 2 karakter'),
    email: z.string().email('Email tidak valid'),
    password: z.string().min(6, 'Password minimal 6 karakter'),
    confirmPassword: z.string(),
    role: z.enum(['ADMIN', 'OPERATOR', 'DRIVER', 'SALES']).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Password tidak cocok',
    path: ['confirmPassword'],
  })

// ==================== RAYON ====================

export const rayonSchema = z.object({
  name: z.string().min(2, 'Nama rayon minimal 2 karakter'),
  coverageArea: z.string().optional(),
  activeStatus: z.boolean().default(true),
})

// ==================== KENDARAAN ====================

export const vehicleSchema = z.object({
  plateNumber: z.string().min(1, 'Nomor plat wajib diisi'),
  capacitySak: z.number().min(0).default(0),
  operationalCostPerDay: z.number().min(0).default(0),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).optional(),
})

// ==================== DRIVER ====================

export const driverSchema = z.object({
  name: z.string().min(2, 'Nama driver minimal 2 karakter'),
  phone: z.string().optional(),
  assignedVehicleId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE']).optional(),
})

// ==================== PELANGGAN ====================

export const customerSchema = z.object({
  name: z.string().min(2, 'Nama customer minimal 2 karakter'),
  phone: z.string().optional(),
  address: z.string().optional(),
  rayonId: z.string().optional(),
  customerType: z.enum(['WARUNG', 'DEPOT', 'TOKO']),
  defaultPrice: z.number().min(0).default(0),
  notes: z.string().optional(),
  gpsLat: z.number().optional(),
  gpsLng: z.number().optional(),
})

// ==================== PESANAN ====================

export const orderSchema = z.object({
  customerId: z.string().min(1, 'Customer wajib dipilih'),
  vehicleId: z.string().optional(),
  rayonId: z.string().optional(),
  orderChannel: z.enum(['PREORDER', 'HOTLINE', 'CANVAS', 'ADMIN_INPUT']),
  orderType: z.string().optional(),
  orderedQty: z.number().min(1, 'Jumlah minimal 1'),
  pricePerUnit: z.number().min(0, 'Harga tidak boleh negatif'),
  deliveryDate: z.string().min(1, 'Tanggal pengiriman wajib diisi'),
  notes: z.string().optional(),
})

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'CREATED',
    'CONFIRMED',
    'ASSIGNED',
    'LOADED',
    'DELIVERED',
    'PARTIAL',
    'REJECTED',
    'RETURNED',
    'CANCELLED',
  ]),
  deliveredQty: z.number().min(0).optional(),
  returnedQty: z.number().min(0).optional(),
  returnReason: z
    .enum(['WEATHER', 'CUSTOMER_CLOSED', 'ALREADY_BOUGHT', 'LATE_DELIVERY', 'REDUCED_NEED', 'OTHER'])
    .optional(),
})

// ==================== ARMADA HARIAN ====================

export const fleetDailyStatusSchema = z.object({
  date: z.string().min(1, 'Tanggal wajib diisi'),
  vehicleId: z.string().min(1, 'Kendaraan wajib dipilih'),
  driverId: z.string().min(1, 'Driver wajib dipilih'),
  rayonId: z.string().min(1, 'Rayon wajib dipilih'),
  helperName: z.string().optional(),
  initialLoad: z.number().min(0).default(0),
})

// ==================== PRODUKSI ====================

export const productionPlanSchema = z.object({
  productionDate: z.string().min(1, 'Tanggal produksi wajib diisi'),
  confirmedPreorderQty: z.number().min(0).default(0),
  estimatedCanvasQty: z.number().min(0).default(0),
  riskAdjustmentQty: z.number().min(0).default(0),
  actualProductionQty: z.number().min(0).default(0),
})

export const warehouseStockSchema = z.object({
  date: z.string().min(1, 'Tanggal wajib diisi'),
  openingStock: z.number().min(0).default(0),
  productionIn: z.number().min(0).default(0),
  loadingOut: z.number().min(0).default(0),
  returnedIn: z.number().min(0).default(0),
})

// ==================== KEUANGAN ====================

export const priceProfileSchema = z.object({
  customerType: z.enum(['WARUNG', 'DEPOT', 'TOKO']),
  channel: z.enum(['PREORDER', 'HOTLINE', 'CANVAS', 'ADMIN_INPUT']),
  rayonId: z.string().optional(),
  price: z.number().min(0, 'Harga tidak boleh negatif'),
  validFrom: z.string().min(1, 'Tanggal mulai wajib diisi'),
  validUntil: z.string().min(1, 'Tanggal akhir wajib diisi'),
})

export const vehicleCostSchema = z.object({
  vehicleId: z.string().min(1, 'Kendaraan wajib dipilih'),
  date: z.string().min(1, 'Tanggal wajib diisi'),
  fuelCost: z.number().min(0).default(0),
  driverCost: z.number().min(0).default(0),
  helperCost: z.number().min(0).default(0),
  maintenanceCost: z.number().min(0).default(0),
  depreciationCost: z.number().min(0).default(0),
})

// ==================== SDM ====================

export const driverAttendanceSchema = z.object({
  driverId: z.string().min(1, 'Driver wajib dipilih'),
  date: z.string().min(1, 'Tanggal wajib diisi'),
  status: z.enum(['PRESENT', 'ABSENT', 'SICK', 'LEAVE']),
})

// ==================== DELIVERY LOG ====================

export const deliveryLogSchema = z.object({
  orderId:      z.string().min(1, 'Order wajib dipilih'),
  vehicleId:    z.string().min(1, 'Kendaraan wajib dipilih'),
  driverId:     z.string().min(1, 'Driver wajib dipilih'),
  deliveredQty: z.number().min(0),
  returnedQty:  z.number().min(0).default(0),
  returnReason: z
    .enum(['WEATHER', 'CUSTOMER_CLOSED', 'ALREADY_BOUGHT', 'LATE_DELIVERY', 'REDUCED_NEED', 'OTHER'])
    .optional(),
  timestamp: z.string().optional(),
})

// ==================== FLEET UPDATE ====================

export const updateFleetStatusSchema = z.object({
  remainingLoad: z.number().min(0).optional(),
  departureTime: z.string().optional(),
  activeStatus:  z.boolean().optional(),
})

// ==================== TYPES ====================

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type RayonInput = z.infer<typeof rayonSchema>
export type VehicleInput = z.infer<typeof vehicleSchema>
export type DriverInput = z.infer<typeof driverSchema>
export type CustomerInput = z.infer<typeof customerSchema>
export type OrderInput = z.infer<typeof orderSchema>
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>
export type FleetDailyStatusInput = z.infer<typeof fleetDailyStatusSchema>
export type ProductionPlanInput = z.infer<typeof productionPlanSchema>
export type WarehouseStockInput = z.infer<typeof warehouseStockSchema>
export type PriceProfileInput = z.infer<typeof priceProfileSchema>
export type VehicleCostInput = z.infer<typeof vehicleCostSchema>
export type DriverAttendanceInput    = z.infer<typeof driverAttendanceSchema>
export type DeliveryLogInput         = z.infer<typeof deliveryLogSchema>
export type UpdateFleetStatusInput   = z.infer<typeof updateFleetStatusSchema>
