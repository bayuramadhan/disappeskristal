import { NextResponse } from 'next/server'

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  meta?: PaginationMeta
}

export function apiSuccess<T>(
  data: T,
  message?: string,
  meta?: PaginationMeta,
  status = 200,
) {
  return NextResponse.json<ApiResponse<T>>(
    { success: true, data, message, meta },
    { status },
  )
}

export function apiCreated<T>(data: T, message = 'Berhasil dibuat') {
  return apiSuccess(data, message, undefined, 201)
}

export function apiError(message: string, status = 400, data?: unknown) {
  return NextResponse.json<ApiResponse>(
    { success: false, message, data: data ?? null },
    { status },
  )
}

export function apiNotFound(resource = 'Resource') {
  return apiError(`${resource} tidak ditemukan`, 404)
}

export function apiUnauthorized() {
  return apiError('Tidak terautentikasi', 401)
}

export function apiServerError(err: unknown) {
  const message =
    err instanceof Error ? err.message : 'Internal server error'
  console.error('[API Error]', err)
  return apiError(message, 500)
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export function parsePagination(searchParams: URLSearchParams) {
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
  const skip  = (page - 1) * limit
  return { page, limit, skip }
}

export function makeMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function parseDate(value: string | null, fallback: Date): Date {
  if (!value) return fallback
  const d = new Date(value)
  return isNaN(d.getTime()) ? fallback : d
}

export function todayDate(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function tomorrowDate(): Date {
  const d = todayDate()
  d.setDate(d.getDate() + 1)
  return d
}
