import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import {
  apiSuccess, apiCreated, apiError, apiServerError,
  parsePagination, makeMeta,
} from '@/lib/api/response'
import { customerSchema, customerLocationSchema } from '@/lib/validations'

const locationInclude = {
  rayon: { select: { id: true, name: true } },
}

// ─── GET /api/customers ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const sp           = req.nextUrl.searchParams
    const { page, limit, skip } = parsePagination(sp)

    const rayonId      = sp.get('rayonId')
    const customerType = sp.get('customerType')
    const activeStatus = sp.get('activeStatus')
    const search       = sp.get('search')

    const where: Record<string, unknown> = { deletedAt: null }

    if (customerType) where.customerType = customerType
    if (activeStatus !== null && activeStatus !== undefined) {
      where.activeStatus = activeStatus === 'true'
    }

    // rayonId filter → via locations
    if (rayonId) {
      where.locations = { some: { rayonId, deletedAt: null } }
    }

    if (search) {
      where.OR = [
        { name:  { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { locations: { some: {
          deletedAt: null,
          OR: [
            { namaLokasi: { contains: search, mode: 'insensitive' } },
            { alamat:     { contains: search, mode: 'insensitive' } },
          ],
        }}},
      ]
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { name: 'asc' },
        include: {
          locations: {
            where:   { deletedAt: null },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
            include: locationInclude,
          },
          _count: { select: { orders: true } },
        },
      }),
      prisma.customer.count({ where }),
    ])

    return apiSuccess(customers, undefined, makeMeta(page, limit, total))
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── POST /api/customers ──────────────────────────────────────────────────────
// Body: { ...customerFields, location: { namaLokasi, alamat, rayonId, ... } }
export async function POST(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const body = await req.json()

    const customerParsed = customerSchema.safeParse(body)
    if (!customerParsed.success) {
      return apiError('Validasi customer gagal', 400, customerParsed.error.flatten().fieldErrors)
    }

    // Lokasi pertama wajib ada
    const locParsed = customerLocationSchema.safeParse(body.location ?? {
      namaLokasi: customerParsed.data.name,
    })
    if (!locParsed.success) {
      return apiError('Validasi lokasi gagal', 400, locParsed.error.flatten().fieldErrors)
    }

    const customer = await prisma.customer.create({
      data: {
        ...customerParsed.data,
        customerType: customerParsed.data.customerType as any,
        locations: {
          create: {
            ...locParsed.data,
            isDefault: true,
          },
        },
      },
      include: {
        locations: {
          where:   { deletedAt: null },
          include: locationInclude,
        },
      },
    })

    return apiCreated(customer, 'Customer berhasil ditambahkan')
  } catch (err) {
    return apiServerError(err)
  }
}
