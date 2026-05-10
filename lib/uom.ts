// ─── UOM conversion helpers ───────────────────────────────────────────────────
// unitsPerSak: berapa unit ini = 1 sak  (kg: 25 → 25 kg = 1 sak)
// Semua kalkulasi kapasitas & harga dilakukan dalam sak.

export function toSak(qty: number, unitsPerSak: number | null | undefined): number {
  const factor = unitsPerSak ?? 1
  if (factor <= 0) return qty
  return qty / factor
}

export function fromSak(sakQty: number, unitsPerSak: number | null | undefined): number {
  const factor = unitsPerSak ?? 1
  return sakQty * factor
}

/** Label display: "10 sak" / "250 kg" / "6.25 ton" */
export function fmtQty(qty: number | null | undefined, abbreviation?: string | null): string {
  if (qty == null) return '-'
  const unit = abbreviation ?? 'sak'
  // Bulatkan ke 2 desimal hanya jika perlu
  const display = Number.isInteger(qty) ? qty : parseFloat(qty.toFixed(2))
  return `${display} ${unit}`
}
