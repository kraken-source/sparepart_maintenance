import { useMemo } from 'react'
import * as THREE from 'three'
import Part from '../Part'
import { Bar, Shell, SIDES, extrude, tireProfile } from './kit'

/**
 * Model prosedural Honda BeAT eSP 2021 (skuter matic 110 cc).
 *
 * Dimensi: P 1.877 m × L 0.669 m × T 1.069 m, wheelbase 1.256 m, tinggi jok 0.740 m,
 * ban depan 80/90-14, belakang 90/90-14 (velg 14").
 *
 * Ciri yang direproduksi: rangka step-through dengan dek kaki rata, apron/pelindung kaki,
 * lampu depan LED di batok kemudi, jok panjang, bodi belakang ramping dengan lampu belakang,
 * unit mesin + CVT di kiri (swing arm), knalpot di kanan, rem cakram depan & tromol belakang,
 * suspensi teleskopik depan dan satu shock belakang.
 *
 * Nama <Part> = parts.mesh_name untuk jenis "motorcycle" (lihat MotorcyclePartSeeder).
 * Sumbu: +X = depan, +Y = atas, +Z = kanan pengendara. Satuan meter.
 */

// ---------- warna ----------
const PAINT = '#c81e2c' // merah
const BLACK = '#111317'
const DARK = '#2b2f36'
const SILVER = '#b8bec6'
const GLASS = '#e8eef5'

// ---------- dimensi ----------
const XF = 0.628 // poros depan (wheelbase 1.256)
const XR = -0.628
const RF = 0.25 // jari-jari ban depan 80/90-14
const RR = 0.259 // jari-jari ban belakang 90/90-14
const RIM = 0.178 // velg 14"
const BEVEL = 0.025

/** Profil samping → bentuk extrude simetris terhadap z = 0. */
function profile(points, depth, bevel = BEVEL) {
  const s = new THREE.Shape()
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  s.closePath()
  return extrude(s, depth, bevel)
}

/** Persegi panjang bersudut membulat (untuk tutup CVT). */
function roundedRect(x0, y0, x1, y1, r, depth) {
  const s = new THREE.Shape()
  s.moveTo(x0 + r, y0)
  s.lineTo(x1 - r, y0)
  s.quadraticCurveTo(x1, y0, x1, y0 + r)
  s.lineTo(x1, y1 - r)
  s.quadraticCurveTo(x1, y1, x1 - r, y1)
  s.lineTo(x0 + r, y1)
  s.quadraticCurveTo(x0, y1, x0, y1 - r)
  s.lineTo(x0, y0 + r)
  s.quadraticCurveTo(x0, y0, x0 + r, y0)
  return extrude(s, depth, 0.012)
}

/** Roda 14": ban + velg cor 5 palang. Rem dipasang terpisah. */
function Wheel({ name, x, r, width }) {
  const tire = useMemo(() => tireProfile(RIM, r, width), [r, width])
  const spokes = [0, 1, 2, 3, 4].map((i) => (i * 2 * Math.PI) / 5 + Math.PI / 2)
  return (
    <group position={[x, r, 0]}>
      <Part name={name} color="#15171b" roughness={0.9} rotation={[Math.PI / 2, 0, 0]} side={THREE.DoubleSide}>
        <latheGeometry args={[tire, 40]} />
      </Part>
      <Part name={name} color={DARK} metalness={0.6} roughness={0.35} rotation={[Math.PI / 2, 0, 0]} side={THREE.DoubleSide}>
        <cylinderGeometry args={[RIM, RIM, width * 0.8, 36, 1, true]} />
      </Part>
      {SIDES.map((s) => spokes.map((a, i) => (
        <Part key={`${s}${i}`} name={name} color={DARK} metalness={0.6} roughness={0.35}
          position={[Math.cos(a) * 0.1, Math.sin(a) * 0.1, s * width * 0.3]} rotation={[0, 0, a]}>
          <boxGeometry args={[0.15, 0.028, 0.012]} />
        </Part>
      )))}
      <Part name={name} color={SILVER} metalness={0.8} roughness={0.25} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, width + 0.02, 20]} />
      </Part>
    </group>
  )
}

export default function BeatModel({ xray }) {
  const geo = useMemo(
    () => ({
      // Penutup depan ramping (khas BeAT) – lebih sempit dari pelindung kaki
      front: profile([[0.34, 0.40], [0.46, 0.41], [0.585, 0.55], [0.57, 0.80], [0.50, 0.89], [0.36, 0.885], [0.34, 0.70]], 0.15, 0.03),
      // Pelindung kaki: panel lebar menghadap pengendara
      legShield: profile([[0.28, 0.40], [0.35, 0.38], [0.37, 0.87], [0.31, 0.87]], 0.3, 0.02),
      // Batok kemudi (tempat lampu depan LED)
      handleCover: profile([[0.32, 0.93], [0.55, 0.925], [0.585, 0.97], [0.52, 1.025], [0.37, 1.03], [0.32, 0.99]], 0.24, 0.02),
      // Bodi belakang / cover samping
      rear: profile([[0.04, 0.34], [0.11, 0.50], [0.03, 0.64], [-0.30, 0.665], [-0.70, 0.695], [-0.88, 0.70], [-0.955, 0.645], [-0.92, 0.575], [-0.36, 0.555], [-0.20, 0.43], [-0.02, 0.36]], 0.22),
      // Jok panjang
      seat: profile([[0.05, 0.635], [-0.05, 0.715], [-0.30, 0.73], [-0.62, 0.742], [-0.80, 0.738], [-0.865, 0.712], [-0.80, 0.69], [-0.30, 0.67], [0.03, 0.645]], 0.2, 0.02),
      // Tutup CVT (kiri)
      cvt: roundedRect(-0.66, 0.19, -0.02, 0.39, 0.09, 0.06),
    }),
    [],
  )

  const paint = { xray, color: PAINT, metalness: 0.45, roughness: 0.3 }
  const black = { xray, color: BLACK, metalness: 0.2, roughness: 0.6 }
  const silver = { xray, color: SILVER, metalness: 0.85, roughness: 0.25 }
  const forkTop = [0.43, 0.72]

  return (
    <group>
      {/* =================== BODI (tidak bisa diklik) =================== */}
      <Shell {...paint} geometry={geo.front} />
      <Shell {...black} geometry={geo.legShield} roughness={0.7} />
      <Shell {...paint} geometry={geo.rear} />
      <Shell {...black} geometry={geo.seat} roughness={0.8} />
      <Shell {...paint} geometry={geo.handleCover} />
      {/* panel hitam bawah batok & garis aksen bodi */}
      <Shell {...black} position={[0.45, 0.915, 0]}><boxGeometry args={[0.2, 0.02, 0.22]} /></Shell>
      {SIDES.map((s) => (
        <group key={s}>
          <Bar {...black} from={[-0.15, 0.47]} to={[-0.85, 0.625]} z={s * 0.137} thick={0.012} depth={0.004} />
          <Bar xray={xray} color="#f3f4f6" from={[-0.2, 0.5]} to={[-0.82, 0.645]} z={s * 0.137} thick={0.008} depth={0.004} />
        </group>
      ))}

      {/* Dek kaki (step-through) + terowongan rangka */}
      <Shell {...black} position={[0.11, 0.32, 0]}><boxGeometry args={[0.44, 0.04, 0.3]} /></Shell>
      <Shell {...paint} position={[0.11, 0.27, 0]}><boxGeometry args={[0.4, 0.07, 0.22]} /></Shell>

      {/* Suspensi depan teleskopik + spakbor depan */}
      {SIDES.map((s) => (
        <Bar key={s} {...silver} from={[XF, RF]} to={forkTop} z={s * 0.07} thick={0.032} depth={0.032} />
      ))}
      <Shell {...paint} position={[XF, RF, 0]} rotation={[0, 0, 0.55]}>
        <torusGeometry args={[RF + 0.035, 0.03, 8, 24, 1.7]} />
      </Shell>

      {/* Setang, grip, spion */}
      <Shell xray={xray} color={DARK} metalness={0.6} position={[0.4, 0.99, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.62, 12]} />
      </Shell>
      {SIDES.map((s) => (
        <group key={s}>
          <Shell {...black} position={[0.4, 0.99, s * 0.28]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.019, 0.019, 0.11, 12]} />
          </Shell>
          <Bar {...black} from={[0.41, 1.0]} to={[0.385, 1.055]} z={s * 0.215} thick={0.01} depth={0.01} />
          <Shell {...black} position={[0.385, 1.06, s * 0.245]} scale={[0.4, 0.55, 1]}>
            <sphereGeometry args={[0.06, 16, 12]} />
          </Shell>
        </group>
      ))}

      {/* Knalpot (kanan) */}
      <Shell {...black} position={[-0.5, 0.33, 0.15]} rotation={[0, 0, Math.PI / 2 - 0.12]}>
        <cylinderGeometry args={[0.05, 0.045, 0.42, 20]} />
      </Shell>
      <Shell {...silver} position={[-0.47, 0.36, 0.2]} rotation={[0, 0, -0.12]}><boxGeometry args={[0.3, 0.06, 0.01]} /></Shell>
      <Bar {...black} from={[0.08, 0.22]} to={[-0.28, 0.3]} z={0.1} thick={0.028} depth={0.028} />

      {/* Shock belakang (kiri) */}
      <Bar {...silver} from={[-0.6, 0.38]} to={[-0.74, 0.6]} z={-0.12} thick={0.04} depth={0.04} />

      {/* Spakbor belakang + plat nomor */}
      <Shell {...black} position={[XR, RR, 0]} rotation={[0, 0, 1.6]}>
        <torusGeometry args={[RR + 0.04, 0.025, 8, 20, 1.3]} />
      </Shell>
      <Shell {...black} position={[-0.95, 0.5, 0]} rotation={[0, 0, -0.25]}><boxGeometry args={[0.02, 0.12, 0.22]} /></Shell>
      <Shell xray={xray} color="#f3f4f6" position={[-0.965, 0.48, 0]} rotation={[0, 0, -0.25]}><boxGeometry args={[0.005, 0.09, 0.19]} /></Shell>
      {/* Behel belakang */}
      <Bar {...silver} from={[-0.78, 0.755]} to={[-0.93, 0.7]} z={0} thick={0.02} depth={0.18} />

      {/* =================== PARTS (bisa diklik) =================== */}

      <Wheel name="tire_front" x={XF} r={RF} width={0.08} />
      <Wheel name="tire_rear" x={XR} r={RR} width={0.09} />

      {/* Rem depan cakram (kiri) */}
      <group position={[XF, RF, -0.058]}>
        <Part name="brake_front" color="#9ca3af" metalness={0.8} roughness={0.3} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.095, 0.095, 0.006, 32]} />
        </Part>
        <Part name="brake_front" color="#1f2937" position={[-0.07, 0.06, -0.012]} rotation={[0, 0, 0.7]}>
          <boxGeometry args={[0.035, 0.07, 0.03]} />
        </Part>
      </group>

      {/* Rem belakang tromol (tutup tromol di kanan) */}
      <group position={[XR, RR, 0.06]}>
        <Part name="brake_rear" color="#6b7280" metalness={0.7} roughness={0.4} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.03, 28]} />
        </Part>
        <Part name="brake_rear" color={DARK} position={[0.06, 0.06, 0.02]} rotation={[0, 0, -0.6]}>
          <boxGeometry args={[0.02, 0.09, 0.012]} />
        </Part>
      </group>

      {/* Unit mesin + CVT (kiri) */}
      <Part name="cvt_belt" color={DARK} metalness={0.4} roughness={0.5} geometry={geo.cvt} position={[0, 0, -0.13]} />
      <Part name="cvt_roller" color="#4b5563" metalness={0.5} roughness={0.4} position={[-0.09, 0.29, -0.17]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.025, 28]} />
      </Part>
      <Part name="gear_oil" color={SILVER} metalness={0.8} roughness={0.3} position={[-0.56, 0.215, -0.172]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.03, 6]} />
      </Part>
      <Part name="air_filter" color="#374151" position={[-0.32, 0.45, -0.1]}>
        <boxGeometry args={[0.26, 0.09, 0.09]} />
      </Part>
      <Part name="engine_oil" color="#4b5563" metalness={0.5} position={[0.0, 0.26, 0]}>
        <boxGeometry args={[0.22, 0.15, 0.18]} />
      </Part>
      <Part name="engine_oil" color="#facc15" position={[-0.05, 0.31, 0.1]}>
        <cylinderGeometry args={[0.015, 0.015, 0.03, 12]} />
      </Part>
      <Part name="spark_plug" color="#e5e7eb" metalness={0.6} position={[0.14, 0.31, 0.03]} rotation={[0, 0, -0.5]}>
        <cylinderGeometry args={[0.012, 0.012, 0.06, 10]} />
      </Part>
      <Part name="battery" color="#0f172a" position={[0.2, 0.27, 0]}>
        <boxGeometry args={[0.11, 0.07, 0.1]} />
      </Part>

      {/* Minyak rem: tabung master rem di setang kanan */}
      <Part name="brake_fluid" color="#1f2937" position={[0.41, 1.018, 0.165]}>
        <boxGeometry args={[0.04, 0.025, 0.05]} />
      </Part>

      {/*
        Lampu depan LED di muka batok kemudi. Ditempel di sisi miring depan-bawah batok
        (titik (0.55,0.925)→(0.585,0.97)), digeser keluar sejauh bevel agar terlihat.
      */}
      <Part name="headlight" color={GLASS} metalness={0.3} roughness={0.08} position={[0.592, 0.93, 0]} rotation={[0, 0, -0.66]}>
        <boxGeometry args={[0.016, 0.055, 0.19]} />
      </Part>
      <Part name="headlight" color={SILVER} metalness={0.9} roughness={0.15} position={[0.596, 0.928, 0]} rotation={[0, 0, -0.66]}>
        <boxGeometry args={[0.008, 0.012, 0.15]} />
      </Part>
      {/* Lampu sein depan (aksesori bodi) di penutup depan */}
      {SIDES.map((s) => (
        <Shell key={s} xray={xray} color="#f59e0b" metalness={0.2} roughness={0.2} position={[0.6, 0.72, s * 0.07]} rotation={[0, 0, -0.1]}>
          <boxGeometry args={[0.012, 0.03, 0.05]} />
        </Shell>
      ))}

      {/* Lampu belakang */}
      <Part name="taillight" color="#b91c1c" metalness={0.2} roughness={0.15} position={[-0.952, 0.64, 0]} rotation={[0, 0, -0.55]}>
        <boxGeometry args={[0.03, 0.05, 0.13]} />
      </Part>
    </group>
  )
}
