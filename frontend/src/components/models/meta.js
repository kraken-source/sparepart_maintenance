/**
 * Data model 3D TANPA komponen 3D (tidak mengimpor three.js), supaya halaman Kendaraan, Part,
 * dan form bisa memakai label/jenis tanpa ikut memuat library 3D (±900 KB).
 * Komponen 3D-nya ada di ./index.js dan hanya dimuat oleh viewer di Dashboard.
 */

/** Jenis kendaraan yang didukung (sama dengan Vehicle::TYPES di backend). */
export const VEHICLE_TYPES = { car: 'Mobil', motorcycle: 'Sepeda motor' }

/**
 * Pengaturan kamera per ukuran kendaraan. Posisi preset kamera (Depan, Samping, …) dikalikan `scale`.
 * Mobil ±5 m, motor ±1,9 m.
 */
const CAR_VIEW = { scale: 1, target: [0, 0.8, 0], minDistance: 3, maxDistance: 12 }
const MOTORCYCLE_VIEW = { scale: 0.42, target: [0, 0.55, 0], minDistance: 1.1, maxDistance: 5 }
export const VIEW_BY_TYPE = { car: CAR_VIEW, motorcycle: MOTORCYCLE_VIEW }

/**
 * Model 3D bawaan. Disimpan di kolom vehicles.model_3d_url sebagai "builtin:<key>".
 * Nilai lain dianggap URL file .glb; kosong = model default untuk jenis kendaraannya.
 */
export const BUILTIN_MODELS = {
  palisade: { label: 'Hyundai Palisade 2026', type: 'car', view: CAR_VIEW },
  innova: { label: 'Toyota Kijang Innova 2012', type: 'car', view: CAR_VIEW },
  beat: { label: 'Honda BeAT eSP 2021', type: 'motorcycle', view: MOTORCYCLE_VIEW },
}
export const DEFAULT_MODEL_BY_TYPE = { car: 'palisade', motorcycle: 'beat' }
export const DEFAULT_MODEL = DEFAULT_MODEL_BY_TYPE.car
const PREFIX = 'builtin:'

/** Model bawaan yang cocok untuk satu jenis kendaraan. */
export const modelsForType = (type) => Object.entries(BUILTIN_MODELS).filter(([, m]) => m.type === type)

/**
 * Uraikan model_3d_url → { kind: 'builtin', key } atau { kind: 'glb', url }.
 * Bawaan yang tidak cocok dengan jenis kendaraan diganti default jenis tsb.
 */
export function resolveModel(value, type = 'car') {
  const fallback = DEFAULT_MODEL_BY_TYPE[type] ?? DEFAULT_MODEL
  if (value?.startsWith(PREFIX)) {
    const key = value.slice(PREFIX.length)
    return { kind: 'builtin', key: BUILTIN_MODELS[key]?.type === type ? key : fallback }
  }
  if (value) return { kind: 'glb', url: value }
  return { kind: 'builtin', key: fallback }
}

export const builtinValue = (key) => PREFIX + key

/** Label singkat untuk tabel kendaraan. */
export function modelLabel(value, type = 'car') {
  const m = resolveModel(value, type)
  return m.kind === 'builtin' ? BUILTIN_MODELS[m.key].label : 'File .glb'
}
