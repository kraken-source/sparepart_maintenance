import { useMemo } from 'react'
import * as THREE from 'three'
import Part from '../Part'
import { Bar, Shell, SIDES, edgePanelGeometry, extrude, tubeAlong, wheelLayout } from './kit'

/**
 * Model prosedural Hyundai Palisade generasi ke-2 (MY2026).
 *
 * Dimensi: P 5.06 m × L 1.98 m × T ±1.80 m, wheelbase 2.97 m, ban 255/45 R21 (diameter ±0.76 m).
 *
 * Ciri desain yang direproduksi dari foto referensi:
 *  - muka depan sangat tegak, kap datar & tinggi dengan ujung bersudut
 *  - gril persegi besar dengan bilah horizontal rapat
 *  - lampu depan: susunan garis LED horizontal bertumpuk + bar vertikal di sisi luar
 *  - bumper dengan list perak horizontal, intake hitam, skid plate
 *  - lengkung roda bersudut (bukan setengah lingkaran) dengan list hitam tipis
 *  - floating roof (pilar B/C hitam), list krom jendela, pilar D tebal warna bodi
 *  - list perak di bawah pintu, handle rata (flush), roof rail perak
 *  - lampu belakang bertumpuk vertikal, velg 21" multi-spoke gelap
 *
 * Sumbu: +X = depan, +Y = atas, +Z = kanan kendaraan. Satuan meter.
 * Setiap <Part name="..."> = parts.mesh_name di database.
 */

// ---------- warna ----------
const PAINT = '#e8eaed' // putih seperti foto referensi
const BLACK = '#0a0d12'
const CHROME = '#c9ced5'
const SILVER = '#a9afb7'
const GLASS = '#1a2433'
const RIM = '#4b5159'

// ---------- dimensi ----------
const XF = 1.58 // poros depan
const XR = -1.39 // poros belakang (wheelbase 2.97)
const WHEEL_R = 0.38
const TRACK = 0.855
const ARCH_R = 0.47 // setengah lebar bukaan lengkung roda
const ARCH_Y0 = 0.42 // garis bawah bodi
const ARCH_TOP = 0.87 // puncak lengkung roda
const BEVEL = 0.06
const BODY_DEPTH = 1.98 - 2 * BEVEL
const GH_DEPTH = 1.72

const BODY_SIDE = BODY_DEPTH / 2 + BEVEL
const GH_SIDE = GH_DEPTH / 2 + BEVEL
const FRONT_X = 2.47 + BEVEL // permukaan muka depan
const REAR_X = -2.47 - BEVEL // permukaan muka belakang

// Titik kunci profil kabin
const COWL = [1.2, 1.1]
const A_TOP = [0.36, 1.69]
const ROOF_REAR = [-2.43, 1.6]
const TAIL_LOW = [-2.48, 1.14]

const WHEELS = wheelLayout(XF, XR, TRACK)

// =====================================================================
// Geometri
// =====================================================================

/** Lengkung roda bersudut khas Palisade gen-2 (dipakai untuk bodi & list hitamnya). */
function addArch(path, x) {
  const R = ARCH_R
  path.lineTo(x - R, ARCH_Y0)
  path.lineTo(x - R + 0.06, ARCH_Y0 + 0.24)
  path.quadraticCurveTo(x - R + 0.12, ARCH_TOP, x - R + 0.32, ARCH_TOP)
  path.lineTo(x + R - 0.32, ARCH_TOP)
  path.quadraticCurveTo(x + R - 0.12, ARCH_TOP, x + R - 0.06, ARCH_Y0 + 0.24)
  path.lineTo(x + R, ARCH_Y0)
}

function lowerBodyGeometry() {
  const s = new THREE.Shape()
  s.moveTo(-2.4, ARCH_Y0)
  addArch(s, XR)
  addArch(s, XF)
  s.lineTo(2.4, ARCH_Y0)
  s.quadraticCurveTo(2.47, 0.43, 2.47, 0.55) // bumper depan
  s.lineTo(2.47, 1.0) // muka depan tegak
  s.quadraticCurveTo(2.47, 1.07, 2.38, 1.08) // ujung kap bersudut
  s.lineTo(COWL[0], 1.13) // kap datar
  s.lineTo(-2.32, 1.16) // garis pinggang
  s.quadraticCurveTo(-2.47, 1.15, -2.47, 1.03)
  s.lineTo(-2.47, 0.55) // pintu bagasi tegak
  s.quadraticCurveTo(-2.47, 0.43, -2.4, ARCH_Y0)
  return extrude(s, BODY_DEPTH)
}

function cabinGeometry() {
  const s = new THREE.Shape()
  s.moveTo(...COWL)
  s.lineTo(...A_TOP)
  s.quadraticCurveTo(0.22, 1.74, 0.0, 1.74)
  s.lineTo(-2.12, 1.735)
  s.quadraticCurveTo(-2.4, 1.73, ...ROOF_REAR)
  s.lineTo(...TAIL_LOW)
  s.lineTo(COWL[0], COWL[1])
  return extrude(s, GH_DEPTH)
}

/** Garis kaca samping (DLO). */
const DLO = [
  [1.08, 1.19],
  [0.43, 1.64],
  [0.26, 1.675],
  [-1.98, 1.668],
  [-2.13, 1.58],
  [-2.16, 1.19],
]

function sideGlassGeometry() {
  return new THREE.ShapeGeometry(new THREE.Shape(DLO.map(([x, y]) => new THREE.Vector2(x, y))))
}

/** List hitam tipis di tepi lengkung roda. */
function archTrimGeometry(x) {
  const p = new THREE.Path()
  p.moveTo(x - ARCH_R, ARCH_Y0)
  addArch(p, x)
  const pts = p.getPoints(16).map((v) => [v.x, v.y])
  return tubeAlong(pts, 0.022)
}

/** Penampang ban 255/45 R21 untuk LatheGeometry. */
const TIRE_PROFILE = [
  [0.27, -0.12], [0.335, -0.128], [0.364, -0.122], [0.376, -0.097], [0.38, -0.05],
  [0.38, 0.05], [0.376, 0.097], [0.364, 0.122], [0.335, 0.128], [0.27, 0.12],
].map(([r, y]) => new THREE.Vector2(r, y))

// =====================================================================
// Komponen
// =====================================================================

/** Velg 21" multi-spoke gelap + ban + rem. */
function Wheel({ wheelKey, x, z }) {
  const out = Math.sign(z)
  const tireName = `tire_${wheelKey}`
  const brakeName = `brake_${wheelKey}`
  const SPOKES = 20
  const spokes = Array.from({ length: SPOKES }, (_, i) => (i * 2 * Math.PI) / SPOKES)

  return (
    <group position={[x, WHEEL_R, z]}>
      <Part name={tireName} color="#15171b" roughness={0.9} rotation={[Math.PI / 2, 0, 0]} side={THREE.DoubleSide}>
        <latheGeometry args={[TIRE_PROFILE, 56]} />
      </Part>
      {/* barrel velg */}
      <Part name={tireName} color="#24282e" metalness={0.6} roughness={0.4} rotation={[Math.PI / 2, 0, 0]} side={THREE.DoubleSide}>
        <cylinderGeometry args={[0.27, 0.27, 0.23, 48, 1, true]} />
      </Part>
      {/* bibir velg */}
      <Part name={tireName} color={RIM} metalness={0.85} roughness={0.25} position={[0, 0, out * 0.105]}>
        <torusGeometry args={[0.262, 0.012, 8, 64]} />
      </Part>
      {/* jari-jari tipis, sedikit berpilin */}
      {spokes.map((a, i) => (
        <Part
          key={i}
          name={tireName}
          color={i % 2 ? RIM : '#6b727b'}
          metalness={0.85}
          roughness={0.3}
          position={[Math.cos(a) * 0.16, Math.sin(a) * 0.16, out * 0.098]}
          rotation={[0, 0, a + 0.18]}
        >
          <boxGeometry args={[0.21, 0.016, 0.018]} />
        </Part>
      ))}
      <Part name={tireName} color={BLACK} metalness={0.6} roughness={0.3} position={[0, 0, out * 0.102]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.03, 24]} />
      </Part>

      {/* Rem: cakram + kaliper */}
      <Part name={brakeName} color="#8b9099" metalness={0.8} roughness={0.35} position={[0, 0, out * 0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.025, 48]} />
      </Part>
      <Part name={brakeName} color="#1f2937" roughness={0.4} position={[-0.145, 0.085, out * 0.058]} rotation={[0, 0, Math.PI / 3]}>
        <boxGeometry args={[0.07, 0.18, 0.055]} />
      </Part>
    </group>
  )
}

/** Susunan garis lampu bertumpuk (signature lampu Palisade gen-2). */
function StackedLamp({ name, x, z, ys, width, barHeight, color, outerZ }) {
  const mat = { color, metalness: 0.2, roughness: 0.12 }
  return (
    <>
      {ys.map((y) => (
        <Part key={y} name={name} {...mat} position={[x, y, z]}>
          <boxGeometry args={[0.03, 0.026, width]} />
        </Part>
      ))}
      <Part name={name} {...mat} position={[x, (ys[0] + ys[ys.length - 1]) / 2, outerZ]}>
        <boxGeometry args={[0.03, barHeight, 0.024]} />
      </Part>
    </>
  )
}

export default function PalisadeModel({ xray }) {
  const geo = useMemo(
    () => ({
      lower: lowerBodyGeometry(),
      cabin: cabinGeometry(),
      sideGlass: sideGlassGeometry(),
      dloChrome: tubeAlong(DLO, 0.011, true),
      archFront: archTrimGeometry(XF),
      archRear: archTrimGeometry(XR),
      windshield: edgePanelGeometry(COWL, A_TOP, 0.04, 0.97, BEVEL + 0.006, 0.82, 0.76),
      rearGlass: edgePanelGeometry(ROOF_REAR, TAIL_LOW, 0.05, 0.5, BEVEL + 0.006, 0.72, 0.74),
    }),
    [],
  )

  const paint = { xray, color: PAINT, metalness: 0.25, roughness: 0.3 }
  const black = { xray, color: BLACK, metalness: 0.2, roughness: 0.55 }
  const gloss = { xray, color: BLACK, metalness: 0.4, roughness: 0.12 }
  const chrome = { xray, color: CHROME, metalness: 0.95, roughness: 0.15 }
  const silver = { xray, color: SILVER, metalness: 0.8, roughness: 0.3 }
  const glass = { xray, color: GLASS, metalness: 0.6, roughness: 0.08, opacity: 0.93, side: THREE.DoubleSide }

  const fx = FRONT_X + 0.005 // tempel di muka depan
  const rx = REAR_X - 0.005 // tempel di muka belakang

  return (
    <group>
      {/* =================== BODI (tidak bisa diklik) =================== */}
      <Shell {...paint} geometry={geo.lower} />
      <Shell {...paint} geometry={geo.cabin} />
      <Shell {...glass} geometry={geo.windshield} />
      <Shell {...glass} geometry={geo.rearGlass} />

      {SIDES.map((s) => (
        <group key={s}>
          {/* Kaca samping, list krom, pilar B & C hitam (floating roof) */}
          <Shell {...glass} geometry={geo.sideGlass} position={[0, 0, s * (GH_SIDE + 0.003)]} />
          <Shell {...chrome} geometry={geo.dloChrome} position={[0, 0, s * (GH_SIDE + 0.006)]} />
          {[0.07, -1.0].map((x) => (
            <Shell key={x} {...gloss} position={[x, 1.42, s * (GH_SIDE + 0.005)]}>
              <boxGeometry args={[0.08, 0.47, 0.004]} />
            </Shell>
          ))}

          {/* Spion warna bodi */}
          <Shell {...paint} position={[1.04, 1.24, s * 1.05]}>
            <boxGeometry args={[0.22, 0.13, 0.18]} />
          </Shell>
          <Shell {...black} position={[1.08, 1.19, s * 0.97]}>
            <boxGeometry args={[0.12, 0.05, 0.07]} />
          </Shell>

          {/* Garis pintu */}
          {[1.12, 0.05].map((x) => (
            <Shell key={x} {...black} position={[x, 0.8, s * (BODY_SIDE + 0.002)]}>
              <boxGeometry args={[0.006, 0.66, 0.004]} />
            </Shell>
          ))}
          <Shell {...black} position={[-0.95, 1.01, s * (BODY_SIDE + 0.002)]}>
            <boxGeometry args={[0.006, 0.28, 0.004]} />
          </Shell>
          {/* Handle pintu flush */}
          {[0.42, -0.6].map((x) => (
            <Shell key={x} {...gloss} position={[x, 1.06, s * (BODY_SIDE + 0.004)]}>
              <boxGeometry args={[0.16, 0.022, 0.006]} />
            </Shell>
          ))}

          {/* Dinding rumah roda: menutup pandangan tembus ke roda di sisi seberang */}
          {[XF, XR].map((x) => (
            <Shell key={x} xray={xray} color="#050608" roughness={0.9} position={[x, (ARCH_Y0 + ARCH_TOP) / 2, s * 0.6]}>
              <boxGeometry args={[ARCH_R * 2, ARCH_TOP - ARCH_Y0 + 0.02, 0.02]} />
            </Shell>
          ))}

          {/* List hitam lengkung roda */}
          <Shell {...black} geometry={geo.archFront} position={[0, 0, s * (BODY_SIDE - 0.01)]} />
          <Shell {...black} geometry={geo.archRear} position={[0, 0, s * (BODY_SIDE - 0.01)]} />

          {/* Sill: hitam bawah + list perak */}
          <Shell {...black} position={[(XF + XR) / 2 + 0.02, 0.44, s * (BODY_SIDE - 0.004)]}>
            <boxGeometry args={[XF - XR - 2 * ARCH_R - 0.04, 0.06, 0.03]} />
          </Shell>
          <Shell {...silver} position={[(XF + XR) / 2 + 0.02, 0.49, s * (BODY_SIDE + 0.004)]}>
            <boxGeometry args={[XF - XR - 2 * ARCH_R - 0.06, 0.025, 0.01]} />
          </Shell>

          {/* Roof rail perak */}
          <Bar {...silver} from={[0.2, 1.835]} to={[-2.0, 1.825]} z={s * 0.7} thick={0.035} depth={0.035} />
          {[0.15, -1.95].map((x) => (
            <Shell key={x} {...silver} position={[x, 1.81, s * 0.7]}>
              <boxGeometry args={[0.12, 0.04, 0.04]} />
            </Shell>
          ))}
        </group>
      ))}

      {/* ---------- Muka depan ---------- */}
      {/* Gril besar + bilah horizontal rapat */}
      <Shell {...gloss} position={[fx, 0.8, 0]}>
        <boxGeometry args={[0.03, 0.4, 1.1]} />
      </Shell>
      {Array.from({ length: 8 }, (_, i) => 0.63 + i * 0.048).map((y) => (
        <Shell key={y} {...chrome} position={[fx + 0.016, y, 0]}>
          <boxGeometry args={[0.012, 0.014, 1.06]} />
        </Shell>
      ))}
      {/* Rumah lampu hitam di kiri-kanan gril */}
      {SIDES.map((s) => (
        <Shell key={s} {...gloss} position={[fx, 0.8, s * 0.76]}>
          <boxGeometry args={[0.03, 0.4, 0.34]} />
        </Shell>
      ))}
      {/* Bumper: list perak, intake hitam, plat, skid plate */}
      <Shell {...silver} position={[fx + 0.004, 0.58, 0]}>
        <boxGeometry args={[0.025, 0.03, 1.86]} />
      </Shell>
      <Shell {...black} position={[fx, 0.48, 0]}>
        <boxGeometry args={[0.03, 0.13, 1.5]} />
      </Shell>
      <Shell xray={xray} color="#f3f4f6" roughness={0.6} position={[fx + 0.018, 0.49, 0]}>
        <boxGeometry args={[0.012, 0.11, 0.42]} />
      </Shell>
      <Shell {...silver} position={[fx - 0.01, 0.42, 0]}>
        <boxGeometry args={[0.03, 0.03, 1.0]} />
      </Shell>

      {/* ---------- Muka belakang ---------- */}
      <Shell {...gloss} position={[rx, 1.05, 0]}>
        <boxGeometry args={[0.015, 0.05, 1.15]} />
      </Shell>
      <Shell {...black} position={[rx, 0.48, 0]}>
        <boxGeometry args={[0.03, 0.12, 1.7]} />
      </Shell>
      <Shell {...silver} position={[rx - 0.004, 0.56, 0]}>
        <boxGeometry args={[0.02, 0.025, 1.6]} />
      </Shell>
      <Shell xray={xray} color="#f3f4f6" roughness={0.6} position={[rx - 0.004, 0.78, 0]}>
        <boxGeometry args={[0.012, 0.15, 0.5]} />
      </Shell>

      {/* =================== PARTS (bisa diklik) =================== */}

      {WHEELS.map((w) => (
        <Wheel key={w.key} wheelKey={w.key} x={w.x} z={w.z} />
      ))}

      {SIDES.map((s) => (
        <group key={s}>
          {/* Lampu depan: 5 garis LED bertumpuk + bar vertikal luar */}
          <StackedLamp
            name={s < 0 ? 'headlight_left' : 'headlight_right'}
            x={fx + 0.017}
            z={s * 0.765}
            outerZ={s * 0.925}
            ys={[0.66, 0.725, 0.79, 0.855, 0.92]}
            width={0.29}
            barHeight={0.3}
            color="#f1f5f9"
          />
          {/* Lampu belakang: 4 garis bertumpuk + bar vertikal luar */}
          <StackedLamp
            name={s < 0 ? 'taillight_left' : 'taillight_right'}
            x={rx - 0.017}
            z={s * 0.8}
            outerZ={s * 0.925}
            ys={[0.93, 0.995, 1.06, 1.125]}
            width={0.22}
            barHeight={0.24}
            color="#9f1239"
          />
        </group>
      ))}

      {/* Wiper di pangkal kaca depan */}
      {[-0.32, 0.26].map((z) => (
        <Part key={z} name="wiper" color={BLACK} position={[1.19, 1.2, z]} rotation={[0, 0.12, 0]}>
          <boxGeometry args={[0.025, 0.02, 0.64]} />
        </Part>
      ))}

      {/* Ruang mesin – aktifkan X-ray untuk melihat */}
      <Part name="engine_oil" color="#4b5563" metalness={0.5} position={[1.85, 0.78, 0]}>
        <boxGeometry args={[0.65, 0.42, 0.8]} />
      </Part>
      <Part name="battery" color="#111827" position={[2.0, 0.88, -0.62]}>
        <boxGeometry args={[0.28, 0.2, 0.18]} />
      </Part>
      <Part name="air_filter" color="#6b7280" position={[2.0, 0.92, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.24, 24]} />
      </Part>
      <Part name="coolant" color="#38bdf8" roughness={0.2} position={[2.28, 0.88, 0.38]}>
        <boxGeometry args={[0.14, 0.16, 0.14]} />
      </Part>
    </group>
  )
}
