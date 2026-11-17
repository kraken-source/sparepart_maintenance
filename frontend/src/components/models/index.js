/**
 * Komponen 3D model bawaan (memuat three.js). HANYA diimpor oleh viewer di Dashboard,
 * yang dimuat terpisah (lazy). Untuk label/jenis/kamera gunakan ./meta.js.
 */
import PalisadeModel from './PalisadeModel'
import InnovaModel from './InnovaModel'
import BeatModel from './BeatModel'

export const MODEL_COMPONENTS = {
  palisade: PalisadeModel,
  innova: InnovaModel,
  beat: BeatModel,
}
