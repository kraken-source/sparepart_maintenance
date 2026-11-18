/** Helper modul bahan bakar (tanpa React, agar mudah dites). */

export const FUEL_GROUPS = { gasoline: 'Bensin', diesel: 'Diesel' }

/** Nama kategori biaya BBM di Laporan Biaya (sama dengan CostReportService::FUEL_CATEGORY). */
export const FUEL_CATEGORY = 'Bahan Bakar'

/** Label RON (bensin) / CN (angka setana, diesel). */
export const ratingLabel = (t) => (t?.rating ? `${t.group === 'diesel' ? 'CN' : 'RON'} ${t.rating}` : '')

const num = (n, digits) => Number(n).toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** 11,6 km/L */
export const kmPerLiter = (n) => (n == null ? '-' : `${num(n, 1)} km/L`)

/** 40,25 L (tanpa ",00" bila bulat) */
export const liter = (n) => (n == null ? '-' : `${Number(n).toLocaleString('id-ID', { maximumFractionDigits: 2 })} L`)

/** Rp 865/km */
export const rupiahPerKm = (n) => (n == null ? '-' : `Rp ${Math.round(n).toLocaleString('id-ID')}/km`)

/** Penjelasan status pengisian dari server (FuelEconomyService). */
export const FUEL_STATUS = {
  baseline: 'Titik awal',
  partial: 'Isi sebagian · dihitung saat isi penuh berikutnya',
  unusable: 'Tidak bisa dihitung (belum ada isi penuh sebelumnya)',
  invalid: 'Tidak wajar (odometer tidak bertambah)',
}

export const AMOUNT_FIELDS = ['liters', 'price_per_liter', 'total_cost']

const filled = (v) => v !== '' && v != null && Number(v) > 0

/**
 * "Isi dua dari tiga": dari dua kolom yang PALING TERAKHIR diisi user, hitung kolom ketiga.
 * touched = urutan kolom yang diubah user (terakhir di belakang).
 * Mengembalikan { values, computed } – computed = nama kolom yang dihitung (atau null).
 * Rumus sama dengan backend (FuelLogRequest::payload).
 */
export function deriveAmounts(values, touched) {
  // Kolom yang sedang diketik tidak pernah dihitung otomatis: bila dikosongkan (mau diketik ulang),
  // jangan langsung diisi lagi dari dua kolom lain – tunggu sampai ada isinya.
  const editing = touched.at(-1)
  if (AMOUNT_FIELDS.includes(editing) && !filled(values[editing])) return { values, computed: null }

  const sources = [...touched].reverse().filter((k) => AMOUNT_FIELDS.includes(k) && filled(values[k])).slice(0, 2)
  if (sources.length < 2) return { values, computed: null }

  const target = AMOUNT_FIELDS.find((k) => !sources.includes(k))
  const liters = Number(values.liters)
  const price = Number(values.price_per_liter)
  const total = Number(values.total_cost)
  const result = {
    liters: () => Math.round((total / price) * 100) / 100,
    total_cost: () => Math.round(liters * price),
    price_per_liter: () => Math.round(total / liters),
  }[target]()

  return { values: { ...values, [target]: String(result) }, computed: target }
}

/** Pindahkan kolom ke urutan paling akhir (paling baru diubah). */
export const touch = (touched, field) => [...touched.filter((k) => k !== field), field]
