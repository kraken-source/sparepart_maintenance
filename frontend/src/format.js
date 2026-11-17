export const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
export const km = (n) => (n == null ? '-' : Number(n).toLocaleString('id-ID') + ' km')
export const tanggal = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

export const ACTIONS = { replace: 'Ganti', repair: 'Perbaikan', inspect: 'Pengecekan' }

/** "B 1234 PLS – Hyundai Palisade 2024" (+ " · Pemilik" untuk admin yang melihat kendaraan semua user). */
export function vehicleLabel(v, { withOwner = false, withYear = false } = {}) {
  const base = `${v.plate_number} – ${v.brand} ${v.model}${withYear && v.year ? ` ${v.year}` : ''}`
  return withOwner && v.owner ? `${base} · ${v.owner.name}` : base
}

/** Ubah '' menjadi null dan string angka menjadi Number untuk field numerik. */
export const toNumberOrNull = (v) => (v === '' || v == null ? null : Number(v))

/** "10.000 km / 6 bulan" – usia pakai dari catatan (bulan) atau default part (hari). */
export function lifeText({ life_km, life_months, life_days }) {
  const parts = [
    life_km && km(life_km),
    life_months && `${life_months} bulan`,
    life_days && `${life_days} hari`,
  ].filter(Boolean)
  return parts.length ? parts.join(' / ') : 'Sesuai kondisi'
}

/** "Sisa 1.200 km · 30 hari" atau "Lewat 400 km · 30 hari". */
export function remainingText({ remaining_km, remaining_days }) {
  const late = (remaining_km ?? 1) <= 0 || (remaining_days ?? 1) <= 0
  const parts = [
    remaining_km != null && km(Math.abs(remaining_km)),
    remaining_days != null && `${Math.abs(remaining_days)} hari`,
  ].filter(Boolean)
  return parts.length ? `${late ? 'Lewat' : 'Sisa'} ${parts.join(' · ')}` : ''
}

/**
 * Tambah bulan tanpa "meluber" ke bulan berikutnya (31 Jan + 1 bulan = 28/29 Feb),
 * sama seperti Carbon::addMonthsNoOverflow di backend. Input & output "YYYY-MM-DD".
 */
export function addMonths(isoDate, months) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const target = new Date(y, m - 1 + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d, lastDay))
  return target.toLocaleDateString('sv-SE')
}
