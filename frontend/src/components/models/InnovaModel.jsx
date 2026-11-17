import { useMemo } from 'react'
import * as THREE from 'three'
import Part from '../Part'
import { BEVEL, Bar, Shell, SIDES, edgePanelGeometry, extrude, flatShapeGeometry, tireProfile, tubeAlong, wheelLayout } from './kit'

/**
 * Model prosedural Toyota Kijang Innova 2.5 Diesel (generasi 1, facelift ke-2, 2011–2015).
 *
 * Dimensi: P 4.585 m × L 1.775 m × T 1.750 m, wheelbase 2.750 m, overhang depan ±0.86 m,
 * ban 205/65 R15 (diameter ±0.65 m).
 *
 * Ciri desain yang direproduksi dari foto referensi:
 *  - siluet MPV: kap pendek & miring yang menyambung ke kaca depan landai, atap panjang
 *  - gril krom trapesium dengan 3 bilah horizontal tebal
 *  - lampu depan besar yang menyapu ke belakang sampai spatbor
 *  - bumper dengan intake hitam lebar, lampu kabut bulat, plat di bawah gril, lip perak
 *  - lengkung roda bulat, garis karakter di tengah pintu, side skirt (body kit)
 *  - spion krom, pilar B/C hitam, lampu belakang vertikal di sudut, spoiler atap
 *  - velg 15" perak 10 jari-jari, warna champagne metalik
 *
 * Nama <Part> sama dengan model lain sehingga status & riwayat part berlaku otomatis.
 */

// ---------- warna ----------
const PAINT = '#cbc2aa' // champagne / silver metalik
const LINE = '#aea68f' // garis karakter (sedikit lebih gelap dari cat)
const BLACK = '#0b0d11'
const CHROME = '#e2e5ea'
// Krom cermin memantulkan latar gelap sehingga tampak hitam; spion dibuat satin agar terbaca krom.
const MIRROR = { color: '#dfe2e6', metalness: 0.75, roughness: 0.22 }
const GLASS = '#1b2430'
const RIM = '#c3c8cf'

// ---------- dimensi ----------
const XF = 1.375 // poros depan
const XR = -1.375 // poros belakang (wheelbase 2.75)
const WHEEL_R = 0.325
const TRACK = 0.745
const ARCH_R = 0.4
const ARCH_CY = 0.36
const BODY_Y0 = 0.36 // garis bawah bodi
const BODY_DEPTH = 1.775 - 2 * BEVEL
const GH_DEPTH = 1.52

const BODY_SIDE = BODY_DEPTH / 2 + BEVEL
const GH_SIDE = GH_DEPTH / 2 + BEVEL
const FRONT_X = 2.175 + BEVEL
const REAR_X = -2.29 - BEVEL

// Titik kunci profil kabin
const COWL = [1.05, 1.0]
const A_TOP = [0.12, 1.62]
const ROOF_REAR = [-2.21, 1.58]
const TAIL_LOW = [-2.27, 1.07]

const WHEELS = wheelLayout(XF, XR, TRACK)
const TIRE = tireProfile(0.195, WHEEL_R, 0.205)

// =====================================================================
// Geometri
// =====================================================================

function lowerBodyGeometry() {
  const s = new THREE.Shape()
  s.moveTo(-2.22, BODY_Y0)
  s.lineTo(XR - ARCH_R, ARCH_CY)
  s.absarc(XR, ARCH_CY, ARCH_R, Math.PI, 0, true)
  s.lineTo(XF - ARCH_R, ARCH_CY)
  s.absarc(XF, ARCH_CY, ARCH_R, Math.PI, 0, true)
  s.lineTo(2.1, BODY_Y0)
  s.quadraticCurveTo(2.175, 0.38, 2.175, 0.5) // bumper depan
  s.lineTo(2.175, 0.7)
  s.quadraticCurveTo(2.17, 0.84, 2.06, 0.88) // moncong membulat
  s.lineTo(COWL[0], 1.02) // kap pendek & miring
  s.lineTo(-2.2, 1.08) // garis pinggang sedikit naik ke belakang
  s.quadraticCurveTo(-2.29, 1.08, -2.29, 0.98)
  s.lineTo(-2.29, 0.5) // pintu bagasi
  s.quadraticCurveTo(-2.29, 0.37, -2.22, BODY_Y0)
  return extrude(s, BODY_DEPTH)
}

function cabinGeometry() {
  const s = new THREE.Shape()
  s.moveTo(...COWL)
  s.lineTo(...A_TOP) // kaca depan landai khas MPV
  s.quadraticCurveTo(0.0, 1.69, -0.2, 1.69)
  s.lineTo(-1.95, 1.675) // atap panjang
  s.quadraticCurveTo(-2.18, 1.67, ...ROOF_REAR)
  s.lineTo(...TAIL_LOW)
  s.lineTo(COWL[0], COWL[1])
  return extrude(s, GH_DEPTH)
}

/** Garis kaca samping: 3 baris jendela sampai kaca segitiga belakang. */
const DLO = [
  [0.97, 1.075],
  [0.2, 1.585],
  [0.04, 1.625],
  [-1.85, 1.615],
  [-2.07, 1.55],
  [-2.13, 1.09],
]

/** Velg 15" perak 10 jari-jari + ban 205/65 + rem. */
function Wheel({ wheelKey, x, z }) {
  const out = Math.sign(z)
  const tireName = `tire_${wheelKey}`
  const brakeName = `brake_${wheelKey}`
  const spokes = Array.from({ length: 10 }, (_, i) => (i * 2 * Math.PI) / 10 + Math.PI / 2)

  return (
    <group position={[x, WHEEL_R, z]}>
      <Part name={tireName} color="#16181c" roughness={0.9} rotation={[Math.PI / 2, 0, 0]} side={THREE.DoubleSide}>
        <latheGeometry args={[TIRE, 48]} />
      </Part>
      <Part name={tireName} color="#3b3f45" metalness={0.6} roughness={0.4} rotation={[Math.PI / 2, 0, 0]} side={THREE.DoubleSide}>
        <cylinderGeometry args={[0.195, 0.195, 0.19, 40, 1, true]} />
      </Part>
      <Part name={tireName} color={RIM} metalness={0.9} roughness={0.2} position={[0, 0, out * 0.088]}>
        <torusGeometry args={[0.19, 0.012, 8, 48]} />
      </Part>
      {spokes.map((a, i) => (
        <Part
          key={i}
          name={tireName}
          color={RIM}
          metalness={0.9}
          roughness={0.25}
          position={[Math.cos(a) * 0.11, Math.sin(a) * 0.11, out * 0.082]}
          rotation={[0, 0, a]}
        >
          <boxGeometry args={[0.16, 0.03, 0.02]} />
        </Part>
      ))}
      <Part name={tireName} color={RIM} metalness={0.9} roughness={0.2} position={[0, 0, out * 0.088]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.03, 24]} />
      </Part>

      <Part name={brakeName} color="#8b9099" metalness={0.8} roughness={0.35} position={[0, 0, out * 0.025]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.022, 40]} />
      </Part>
      <Part name={brakeName} color="#4b5563" roughness={0.5} position={[-0.1, 0.06, out * 0.048]} rotation={[0, 0, Math.PI / 3]}>
        <boxGeometry args={[0.06, 0.13, 0.05]} />
      </Part>
    </group>
  )
}

export default function InnovaModel({ xray }) {
  const geo = useMemo(
    () => ({
      lower: lowerBodyGeometry(),
      cabin: cabinGeometry(),
      sideGlass: flatShapeGeometry(DLO),
      dloTrim: tubeAlong(DLO, 0.012, true),
      windshield: edgePanelGeometry(COWL, A_TOP, 0.04, 0.97, BEVEL + 0.006, 0.7, 0.66),
      rearGlass: edgePanelGeometry(ROOF_REAR, TAIL_LOW, 0.06, 0.62, BEVEL + 0.006, 0.64, 0.66),
    }),
    [],
  )

  const paint = { xray, color: PAINT, metalness: 0.55, roughness: 0.3 }
  const line = { xray, color: LINE, metalness: 0.5, roughness: 0.35 }
  const black = { xray, color: BLACK, metalness: 0.2, roughness: 0.55 }
  const gloss = { xray, color: BLACK, metalness: 0.4, roughness: 0.15 }
  const chrome = { xray, color: CHROME, metalness: 0.95, roughness: 0.12 }
  const glass = { xray, color: GLASS, metalness: 0.6, roughness: 0.08, opacity: 0.93, side: THREE.DoubleSide }

  const fx = FRONT_X
  const rx = REAR_X

  return (
    <group>
      {/* =================== BODI (tidak bisa diklik) =================== */}
      <Shell {...paint} geometry={geo.lower} />
      <Shell {...paint} geometry={geo.cabin} />
      <Shell {...glass} geometry={geo.windshield} />
      <Shell {...glass} geometry={geo.rearGlass} />

      {SIDES.map((s) => (
        <group key={s}>
          {/* Kaca samping, list hitam, pilar B & C hitam */}
          <Shell {...glass} geometry={geo.sideGlass} position={[0, 0, s * (GH_SIDE + 0.003)]} />
          <Shell {...black} geometry={geo.dloTrim} position={[0, 0, s * (GH_SIDE + 0.005)]} />
          {[-0.12, -1.17].map((x) => (
            <Shell key={x} {...gloss} position={[x, 1.34, s * (GH_SIDE + 0.005)]}>
              <boxGeometry args={[0.09, 0.5, 0.004]} />
            </Shell>
          ))}

          {/* Spion krom */}
          <Shell xray={xray} {...MIRROR} position={[0.9, 1.13, s * 0.93]}>
            <boxGeometry args={[0.2, 0.12, 0.16]} />
          </Shell>
          <Shell {...black} position={[0.95, 1.08, s * 0.86]}>
            <boxGeometry args={[0.12, 0.05, 0.06]} />
          </Shell>

          {/* Garis pintu & handle krom */}
          {[0.96, -0.12].map((x) => (
            <Shell key={x} {...black} position={[x, 0.72, s * (BODY_SIDE + 0.002)]}>
              <boxGeometry args={[0.006, 0.62, 0.004]} />
            </Shell>
          ))}
          <Shell {...black} position={[-1.15, 0.92, s * (BODY_SIDE + 0.002)]}>
            <boxGeometry args={[0.006, 0.3, 0.004]} />
          </Shell>
          {[0.55, -0.62].map((x) => (
            <Shell key={x} {...chrome} position={[x, 0.98, s * (BODY_SIDE + 0.006)]}>
              <boxGeometry args={[0.13, 0.03, 0.012]} />
            </Shell>
          ))}

          {/* Garis karakter di tengah pintu, sedikit naik ke belakang */}
          <Bar {...line} from={[1.95, 0.8]} to={[-2.24, 0.845]} z={s * (BODY_SIDE + 0.003)} thick={0.014} depth={0.006} />

          {/* Side skirt (body kit) */}
          <Shell {...paint} position={[(XF + XR) / 2, 0.4, s * (BODY_SIDE + 0.005)]}>
            <boxGeometry args={[XF - XR - 2 * ARCH_R - 0.06, 0.08, 0.04]} />
          </Shell>

          {/* Dinding rumah roda */}
          {[XF, XR].map((x) => (
            <Shell key={x} xray={xray} color="#050608" roughness={0.9} position={[x, ARCH_CY + ARCH_R / 2, s * 0.52]}>
              <boxGeometry args={[ARCH_R * 2, ARCH_R + 0.05, 0.02]} />
            </Shell>
          ))}
        </group>
      ))}

      {/* ---------- Muka depan ---------- */}
      {/* Gril krom trapesium, condong ke belakang mengikuti moncong */}
      <group position={[fx - 0.02, 0.755, 0]} rotation={[0, 0, 0.3]}>
        <Shell {...gloss}>
          <boxGeometry args={[0.03, 0.17, 0.84]} />
        </Shell>
        {[-0.05, 0, 0.05].map((y) => (
          <Shell key={y} {...chrome} position={[0.02, y, 0]}>
            <boxGeometry args={[0.02, 0.028, 0.8 - Math.abs(y) * 0.6]} />
          </Shell>
        ))}
        <Shell {...chrome} position={[0.018, 0.088, 0]}>
          <boxGeometry args={[0.02, 0.018, 0.88]} />
        </Shell>
        <Shell {...chrome} position={[0.018, -0.088, 0]}>
          <boxGeometry args={[0.02, 0.016, 0.76]} />
        </Shell>
      </group>
      {/* Plat nomor di bawah gril */}
      <Shell xray={xray} color="#15171b" roughness={0.6} position={[fx + 0.01, 0.6, 0]}>
        <boxGeometry args={[0.012, 0.11, 0.44]} />
      </Shell>
      {/* Intake hitam lebar + lip perak */}
      <Shell {...black} position={[fx + 0.002, 0.465, 0]}>
        <boxGeometry args={[0.03, 0.1, 1.15]} />
      </Shell>
      <Shell {...chrome} roughness={0.3} position={[fx - 0.01, 0.385, 0]}>
        <boxGeometry args={[0.03, 0.022, 1.4]} />
      </Shell>
      {/* Lampu kabut bulat */}
      {SIDES.map((s) => (
        <group key={s}>
          <Shell {...black} position={[fx + 0.002, 0.47, s * 0.66]}>
            <boxGeometry args={[0.03, 0.1, 0.16]} />
          </Shell>
          <Shell xray={xray} color="#eef2f6" metalness={0.3} roughness={0.1} position={[fx + 0.014, 0.47, s * 0.66]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.04, 0.04, 0.012, 24]} />
          </Shell>
        </group>
      ))}

      {/* ---------- Muka belakang ---------- */}
      <Shell xray={xray} color="#15171b" roughness={0.6} position={[rx - 0.006, 0.78, 0]}>
        <boxGeometry args={[0.012, 0.13, 0.42]} />
      </Shell>
      <Shell {...chrome} position={[rx - 0.006, 0.89, 0]}>
        <boxGeometry args={[0.012, 0.03, 0.62]} />
      </Shell>
      <Shell {...black} position={[rx, 0.42, 0]}>
        <boxGeometry args={[0.03, 0.06, 1.5]} />
      </Shell>
      {/* Spoiler atap */}
      <Shell {...paint} position={[-2.15, 1.715, 0]} rotation={[0, 0, -0.08]}>
        <boxGeometry args={[0.24, 0.04, 1.38]} />
      </Shell>

      {/* =================== PARTS (bisa diklik) =================== */}

      {WHEELS.map((w) => (
        <Wheel key={w.key} wheelKey={w.key} x={w.x} z={w.z} />
      ))}

      {SIDES.map((s) => {
        const head = s < 0 ? 'headlight_left' : 'headlight_right'
        const tail = s < 0 ? 'taillight_left' : 'taillight_right'
        const lens = { color: '#e3e9f0', metalness: 0.4, roughness: 0.08 }
        return (
          <group key={s}>
            {/*
              Lampu depan besar: lensa depan mengisi sudut dari tepi gril sampai ujung bodi,
              condong mengikuti moncong, lalu menyapu ke belakang di spatbor.
            */}
            <group position={[fx - 0.03, 0.775, s * 0.66]} rotation={[0, s * 0.22, 0.3]}>
              <Part name={head} {...lens}>
                <boxGeometry args={[0.05, 0.17, 0.36]} />
              </Part>
              {/* reflektor ganda di dalam lensa */}
              {[-0.07, 0.06].map((dz) => (
                <Part key={dz} name={head} color={CHROME} metalness={0.7} roughness={0.15} position={[0.026, -0.005, s * dz]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.045, 0.045, 0.01, 24]} />
                </Part>
              ))}
            </group>
            <Part name={head} {...lens} position={[1.95, 0.84, s * (BODY_SIDE + 0.004)]} rotation={[0, 0, -0.12]}>
              <boxGeometry args={[0.44, 0.1, 0.03]} />
            </Part>

            {/* Lampu belakang vertikal di sudut */}
            <Part name={tail} color="#a3122a" metalness={0.2} roughness={0.15} position={[rx - 0.006, 0.84, s * 0.76]}>
              <boxGeometry args={[0.035, 0.36, 0.13]} />
            </Part>
            <Part name={tail} color="#e5e7eb" metalness={0.2} roughness={0.15} position={[rx - 0.01, 0.78, s * 0.76]}>
              <boxGeometry args={[0.03, 0.06, 0.11]} />
            </Part>
          </group>
        )
      })}

      {/* Wiper di pangkal kaca depan */}
      {[-0.3, 0.24].map((z) => (
        <Part key={z} name="wiper" color={BLACK} position={[1.04, 1.1, z]} rotation={[0, 0.12, 0]}>
          <boxGeometry args={[0.025, 0.02, 0.58]} />
        </Part>
      ))}

      {/* Ruang mesin (2KD-FTV diesel) – aktifkan X-ray untuk melihat */}
      <Part name="engine_oil" color="#4b5563" metalness={0.5} position={[1.55, 0.62, 0]}>
        <boxGeometry args={[0.6, 0.38, 0.7]} />
      </Part>
      <Part name="battery" color="#111827" position={[1.75, 0.74, -0.55]}>
        <boxGeometry args={[0.25, 0.18, 0.17]} />
      </Part>
      <Part name="air_filter" color="#6b7280" position={[1.72, 0.78, 0.52]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.22, 24]} />
      </Part>
      <Part name="coolant" color="#38bdf8" roughness={0.2} position={[1.98, 0.72, 0.35]}>
        <boxGeometry args={[0.13, 0.15, 0.13]} />
      </Part>
    </group>
  )
}
