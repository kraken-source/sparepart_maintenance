import PalisadeModel from './PalisadeModel'
import InnovaModel from './InnovaModel'

/**
 * Model 3D bawaan. Disimpan di kolom vehicles.model_3d_url sebagai "builtin:<key>".
 * Nilai lain dianggap URL file .glb; kosong = model default.
 */
export const BUILTIN_MODELS = {
  palisade: { label: 'Hyundai Palisade 2026', Component: PalisadeModel },
  innova: { label: 'Toyota Kijang Innova 2012', Component: InnovaModel },
}
export const DEFAULT_MODEL = 'palisade'
const PREFIX = 'builtin:'

/** Uraikan model_3d_url → { kind: 'builtin', key } atau { kind: 'glb', url }. */
export function resolveModel(value) {
  if (value?.startsWith(PREFIX)) {
    const key = value.slice(PREFIX.length)
    return { kind: 'builtin', key: BUILTIN_MODELS[key] ? key : DEFAULT_MODEL }
  }
  if (value) return { kind: 'glb', url: value }
  return { kind: 'builtin', key: DEFAULT_MODEL }
}

export const builtinValue = (key) => PREFIX + key

/** Label singkat untuk tabel kendaraan. */
export function modelLabel(value) {
  const m = resolveModel(value)
  return m.kind === 'builtin' ? BUILTIN_MODELS[m.key].label : 'File .glb'
}
