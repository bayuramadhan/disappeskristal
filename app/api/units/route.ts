import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api/auth'
import { apiSuccess, apiError, apiServerError } from '@/lib/api/response'
import { z } from 'zod'

const unitSchema = z.object({
  name:         z.string().min(1).max(50),
  abbreviation: z.string().min(1).max(10),
  unitsPerSak:  z.number().positive(),
  isActive:     z.boolean().optional(),
})

// ─── GET /api/units ───────────────────────────────────────────────────────────
export async function GET() {
  try {
    const units = await prisma.unit.findMany({
      orderBy: [{ isBase: 'desc' }, { name: 'asc' }],
    })
    return apiSuccess(units)
  } catch (err) {
    return apiServerError(err)
  }
}

// ─── POST /api/units ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error
  if (user.role !== 'ADMIN') return apiError('Akses ditolak', 403)

  try {
    const body   = await req.json()
    const parsed = unitSchema.safeParse(body)
    if (!parsed.success) return apiError('Validasi gagal', 400, parsed.error.flatten().fieldErrors)

    const existing = await prisma.unit.findUnique({ where: { abbreviation: parsed.data.abbreviation } })
    if (existing) return apiError('Singkatan unit sudah dipakai', 409)

    const unit = await prisma.unit.create({ data: parsed.data })
    return apiSuccess(unit, 'Unit berhasil ditambahkan')
  } catch (err) {
    return apiServerError(err)
  }
}
