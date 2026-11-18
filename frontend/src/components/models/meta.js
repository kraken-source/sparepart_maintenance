/**
 * Data model 3D TANPA komponen 3D (tidak mengimpor three.js), supaya halaman Kendaraan, Part,
 * dan form bisa memakai label/jenis tanpa ikut memuat library 3D (±900 KB).
 * Komponen 3D-nya ada di ./index.js dan hanya dimuat oleh viewer.
 *
 * Daftar model ada di master "Model 3D" (tabel vehicle_models). Setiap kendaraan menunjuk satu
 * model master (vehicle.vehicle_model):
 *  - source "builtin" → model prosedural di kode, dipilih lewat builtin_key (palisade/innova/beat)
 *  - source "glb"     → file .glb yang di-upload admin, dimuat dari file_url
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

/** Model bawaan yang ada di kode (kunci = builtin_key di master; sama dengan VehicleModel::BUILTINS). */
export const BUILTIN_MODELS = {
  palisade: { label: 'Hyundai Palisade 2026', type: 'car' },
  innova: { label: 'Toyota Kijang Innova 2012', type: 'car' },
  beat: { label: 'Honda BeAT eSP 2021', type: 'motorcycle' },
}
export const DEFAULT_MODEL_BY_TYPE = { car: 'palisade', motorcycle: 'beat' }

/**
 * Model master → { kind: 'builtin', key } atau { kind: 'glb', url }.
 * Kosong, atau model bawaan yang jenisnya tidak cocok → model bawaan default jenis kendaraan tsb.
 */
export function resolveModel(model, type = 'car') {
  const fallback = { kind: 'builtin', key: DEFAULT_MODEL_BY_TYPE[type] ?? DEFAULT_MODEL_BY_TYPE.car }
  if (!model) return fallback
  if (model.source === 'glb') return model.file_url ? { kind: 'glb', url: model.file_url } : fallback
  return BUILTIN_MODELS[model.builtin_key]?.type === type ? { kind: 'builtin', key: model.builtin_key } : fallback
}

/** Nama model untuk ditampilkan (kosong → nama model default jenisnya). */
export function modelLabel(model, type = 'car') {
  return model?.name ?? BUILTIN_MODELS[DEFAULT_MODEL_BY_TYPE[type] ?? 'palisade'].label
}

/**
 * Kecocokan objek di model 3D dengan master Part: part mana yang bisa diklik (nama objek = mesh_name).
 * @returns {{ matched: object[], missing: object[] }}
 */
export function partCoverage(parts, meshNames) {
  const names = new Set(meshNames ?? [])
  const matched = []
  const missing = []
  for (const p of parts ?? []) (names.has(p.mesh_name) ? matched : missing).push(p)
  return { matched, missing }
}
