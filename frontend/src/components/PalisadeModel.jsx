import { useMemo } from 'react'
import * as THREE from 'three'
import Part from './Part'

/**
 * Model prosedural Hyundai Palisade (generasi 1 facelift, MY2023–2024).
 *
 * Dimensi asli: P 4.995 m × L 1.975 m × T 1.750 m, wheelbase 2.900 m,
 * overhang depan ±0.95 m, ban 245/50 R20 (diameter ±0.75 m).
 *
 * Ciri desain yang direproduksi:
 *  - siluet boxy 3 baris: kap panjang & datar, kaca depan landai, atap rata, pintu belakang tegak
 *  - gril "cascading" sangat lebar, lampu depan split vertikal + DRL di tepi kap
 *  - floating roof (pilar B/C hitam) dan list krom jendela yang naik membentuk pilar D
 *  - lampu belakang vertikal berbentuk L, roof rail, cladding hitam di lengkung roda
 *  - velg 20" dual-spoke dengan cakram & kaliper yang terlihat di sela jari-jari
 *
 * Sumbu: +X = depan, +Y = atas, +Z = kanan kendaraan. Satuan meter.
 * Setiap <Part name="..."> = parts.mesh_name di database.
 */

// ---------- warna ----------
const PAINT = '#7d8b9c' // abu kebiruan metalik (cukup terang agar bentuk bodi terbaca)
const BLACK = '#0a0d12'
const CHROME = '#c7ccd3'
const GLASS = '#22324a'

// ---------- dimensi ----------
const XF = 1.55 // poros depan
const XR = -1.35 // poros belakang (wheelbase 2.90)
const WHEEL_R = 0.375
const TRACK = 0.85 // pusat roda ke sumbu tengah
const ARCH_R = 0.45
const ARCH_CY = 0.38
const BEVEL = 0.06
const BODY_DEPTH = 1.975 - 2 * BEVEL // lebar bodi bawah
const GH_DEPTH = 1.7 // lebar kabin (sedikit lebih sempit dari bodi = tumblehome)

const BODY_SIDE = BODY_DEPTH / 2 + BEVEL // z permukaan samping bodi bawah
const GH_SIDE = GH_DEPTH / 2 + BEVEL // z permukaan samping kabin

// Titik kunci profil kabin (dipakai juga untuk menempatkan kaca)
const COWL = [1.18, 1.08]
const A_TOP = [0.4, 1.66]
const ROOF_REAR = [-2.33, 1.58]
const TAIL_LOW = [-2.42, 1.1]

const WHEELS = [
  { key: 'front_left', x: XF, z: -TRACK },
  { key: 'front_right', x: XF, z: TRACK },
  { key: 'rear_left', x: XR, z: -TRACK },
  { key: 'rear_right', x: XR, z: TRACK },
]
const SIDES = [-1, 1]

// =====================================================================
// Geometri
// =====================================================================

function extrude(shape, depth) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 5,
    curveSegments: 32,
  })
  geo.translate(0, 0, -depth / 2)
  geo.computeVertexNormals()
  return geo
}

/** Bodi bawah: bumper, kap, pintu, sampai garis pinggang, dengan lengkung roda. */
function lowerBodyGeometry() {
  const s = new THREE.Shape()
  s.moveTo(-2.38, 0.4)
  s.lineTo(XR - ARCH_R, ARCH_CY)
  s.absarc(XR, ARCH_CY, ARCH_R, Math.PI, 0, true)
  s.lineTo(XF - ARCH_R, ARCH_CY)
  s.absarc(XF, ARCH_CY, ARCH_R, Math.PI, 0, true)
  s.lineTo(2.34, 0.4)
  s.quadraticCurveTo(2.44, 0.41, 2.44, 0.55) // bumper depan
  s.lineTo(2.45, 0.86) // muka depan tegak
  s.quadraticCurveTo(2.45, 0.97, 2.32, 0.99) // ujung kap
  s.lineTo(COWL[0], 1.1) // kap panjang hampir datar
  s.lineTo(-2.3, 1.13) // garis pinggang
  s.quadraticCurveTo(-2.44, 1.12, -2.45, 1.0)
  s.lineTo(-2.46, 0.55) // pintu belakang tegak
  s.quadraticCurveTo(-2.46, 0.41, -2.38, 0.4)
  return extrude(s, BODY_DEPTH)
}

/** Kabin (greenhouse): kaca depan landai, atap rata, spoiler, kaca belakang tegak. */
function cabinGeometry() {
  const s = new THREE.Shape()
  s.moveTo(...COWL)
  s.lineTo(...A_TOP)
  s.quadraticCurveTo(0.25, 1.71, 0.0, 1.715)
  s.lineTo(-2.05, 1.7)
  s.quadraticCurveTo(-2.3, 1.69, ...ROOF_REAR)
  s.lineTo(...TAIL_LOW)
  s.lineTo(COWL[0], COWL[1])
  return extrude(s, GH_DEPTH)
}

/** Garis kaca samping (DLO) – berakhir dengan tekukan khas pilar D Palisade. */
const DLO = [
  [1.05, 1.165],
  [0.42, 1.6],
  [0.22, 1.645],
  [-2.02, 1.632],
  [-2.13, 1.42],
  [-1.98, 1.165],
]

function sideGlassGeometry() {
  const s = new THREE.Shape(DLO.map(([x, y]) => new THREE.Vector2(x, y)))
  return new THREE.ShapeGeometry(s)
}

function dloChromeGeometry() {
  const path = new THREE.CurvePath()
  const pts = [...DLO, DLO[0]].map(([x, y]) => new THREE.Vector3(x, y, 0))
  for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]))
  return new THREE.TubeGeometry(path, 160, 0.011, 6, false)
}

/**
 * Panel datar yang menempel pada sisi miring kabin (kaca depan / belakang).
 * a→b adalah tepi profil, t0..t1 bagian yang ditutup, off = jarak keluar dari profil,
 * z0/z1 = setengah lebar panel di ujung t0 / t1.
 */
function edgePanelGeometry(a, b, t0, t1, off, z0, z1) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  const n = [dy / len, -dx / len] // normal keluar untuk kontur CCW
  const p = (t) => [a[0] + dx * t + n[0] * off, a[1] + dy * t + n[1] * off]
  const [x0, y0] = p(t0)
  const [x1, y1] = p(t1)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([x0, y0, -z0, x0, y0, z0, x1, y1, z1, x0, y0, -z0, x1, y1, z1, x1, y1, -z1], 3),
  )
  geo.computeVertexNormals()
  return geo
}

/** Profil penampang ban (dibulatkan) untuk LatheGeometry. */
const TIRE_PROFILE = [
  [0.255, -0.115], [0.33, -0.122], [0.36, -0.116], [0.372, -0.092], [0.376, -0.045],
  [0.376, 0.045], [0.372, 0.092], [0.36, 0.116], [0.33, 0.122], [0.255, 0.115],
].map(([r, y]) => new THREE.Vector2(r, y))

// =====================================================================
// Komponen
// =====================================================================

function Shell({ color, metalness = 0.3, roughness = 0.5, opacity = 1, xray, side, children, ...props }) {
  return (
    <mesh castShadow {...props}>
      {children}
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
        side={side}
        transparent={xray || opacity < 1}
        opacity={xray ? 0.08 : opacity}
        depthWrite={!xray}
      />
    </mesh>
  )
}

/** Batang lurus di bidang XY antara dua titik (untuk list, rail, dsb). */
function Bar({ from, to, z, thick = 0.02, depth = 0.02, ...props }) {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  return (
    <Shell
      position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, z]}
      rotation={[0, 0, Math.atan2(dy, dx)]}
      {...props}
    >
      <boxGeometry args={[Math.hypot(dx, dy), thick, depth]} />
    </Shell>
  )
}

function Wheel({ wheelKey, x, z }) {
  const out = Math.sign(z)
  const tireName = `tire_${wheelKey}`
  const brakeName = `brake_${wheelKey}`
  const spokes = []
  for (let i = 0; i < 5; i++) {
    const base = (i * 2 * Math.PI) / 5 + Math.PI / 2
    for (const d of [-0.09, 0.09]) spokes.push(base + d)
  }

  return (
    <group position={[x, WHEEL_R, z]}>
      {/* Ban + velg = satu part "tire" */}
      <Part name={tireName} color="#16181d" roughness={0.9} rotation={[Math.PI / 2, 0, 0]} side={THREE.DoubleSide}>
        <latheGeometry args={[TIRE_PROFILE, 56]} />
      </Part>
      <Part name={tireName} color="#3a3f47" metalness={0.6} roughness={0.4} rotation={[Math.PI / 2, 0, 0]} side={THREE.DoubleSide}>
        <cylinderGeometry args={[0.255, 0.255, 0.22, 40, 1, true]} />
      </Part>
      <Part name={tireName} color={CHROME} metalness={0.9} roughness={0.2} position={[0, 0, out * 0.1]}>
        <torusGeometry args={[0.248, 0.012, 8, 56]} />
      </Part>
      {spokes.map((a, i) => (
        <Part
          key={i}
          name={tireName}
          color={CHROME}
          metalness={0.9}
          roughness={0.25}
          position={[Math.cos(a) * 0.15, Math.sin(a) * 0.15, out * 0.095]}
          rotation={[0, 0, a]}
        >
          <boxGeometry args={[0.19, 0.026, 0.02]} />
        </Part>
      ))}
      <Part name={tireName} color={CHROME} metalness={0.9} roughness={0.2} position={[0, 0, out * 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.03, 24]} />
      </Part>

      {/* Rem: cakram + kaliper, terlihat di sela jari-jari velg */}
      <Part name={brakeName} color="#8b9099" metalness={0.8} roughness={0.35} position={[0, 0, out * 0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.025, 40]} />
      </Part>
      <Part name={brakeName} color="#b91c1c" roughness={0.4} position={[-0.13, 0.075, out * 0.055]} rotation={[0, 0, Math.PI / 3]}>
        <boxGeometry args={[0.07, 0.17, 0.055]} />
      </Part>
    </group>
  )
}

export default function PalisadeModel({ xray }) {
  const geo = useMemo(
    () => ({
      lower: lowerBodyGeometry(),
      cabin: cabinGeometry(),
      sideGlass: sideGlassGeometry(),
      dloChrome: dloChromeGeometry(),
      windshield: edgePanelGeometry(COWL, A_TOP, 0.04, 0.97, BEVEL + 0.006, 0.8, 0.73),
      rearGlass: edgePanelGeometry(ROOF_REAR, TAIL_LOW, 0.06, 0.5, BEVEL + 0.006, 0.7, 0.72),
    }),
    [],
  )

  const paint = { xray, color: PAINT, metalness: 0.55, roughness: 0.32 }
  const black = { xray, color: BLACK, metalness: 0.2, roughness: 0.6 }
  const chrome = { xray, color: CHROME, metalness: 0.95, roughness: 0.15 }
  const glass = { xray, color: GLASS, metalness: 0.6, roughness: 0.08, opacity: 0.92, side: THREE.DoubleSide }

  return (
    <group>
      {/* =================== BODI (tidak bisa diklik) =================== */}
      <Shell {...paint} geometry={geo.lower} />
      <Shell {...paint} geometry={geo.cabin} />

      {/* Kaca depan & belakang */}
      <Shell {...glass} geometry={geo.windshield} />
      <Shell {...glass} geometry={geo.rearGlass} />

      {SIDES.map((s) => (
        <group key={s}>
          {/* Kaca samping + list krom (floating roof) */}
          <Shell {...glass} geometry={geo.sideGlass} position={[0, 0, s * (GH_SIDE + 0.003)]} />
          <Shell {...chrome} geometry={geo.dloChrome} position={[0, 0, s * (GH_SIDE + 0.006)]} />
          {/* Pilar B & C hitam */}
          {[0.05, -0.98].map((x) => (
            <Shell key={x} {...black} roughness={0.15} position={[x, 1.4, s * (GH_SIDE + 0.005)]}>
              <boxGeometry args={[0.08, 0.47, 0.004]} />
            </Shell>
          ))}

          {/* Spion */}
          <Shell {...paint} position={[1.02, 1.2, s * 1.04]}>
            <boxGeometry args={[0.2, 0.13, 0.17]} />
          </Shell>
          <Shell {...black} position={[1.06, 1.15, s * 0.96]}>
            <boxGeometry args={[0.12, 0.05, 0.06]} />
          </Shell>

          {/* Garis pintu & handle krom */}
          {[1.08, 0.03].map((x) => (
            <Shell key={x} {...black} position={[x, 0.8, s * (BODY_SIDE + 0.002)]}>
              <boxGeometry args={[0.006, 0.62, 0.004]} />
            </Shell>
          ))}
          <Shell {...black} position={[-0.95, 0.99, s * (BODY_SIDE + 0.002)]}>
            <boxGeometry args={[0.006, 0.26, 0.004]} />
          </Shell>
          {[0.32, -0.72].map((x) => (
            <Shell key={x} {...chrome} position={[x, 1.03, s * (BODY_SIDE + 0.006)]}>
              <boxGeometry args={[0.13, 0.025, 0.012]} />
            </Shell>
          ))}

          {/* Cladding hitam lengkung roda & side sill */}
          {[XF, XR].map((x) => (
            <Shell key={x} {...black} position={[x, ARCH_CY, s * (BODY_SIDE - 0.01)]}>
              <torusGeometry args={[ARCH_R + 0.02, 0.035, 8, 40, Math.PI]} />
            </Shell>
          ))}
          <Shell {...black} position={[(XF + XR) / 2 + 0.1, 0.4, s * (BODY_SIDE - 0.005)]}>
            <boxGeometry args={[XF - XR - 2 * ARCH_R - 0.1, 0.09, 0.03]} />
          </Shell>

          {/* Roof rail + kaki */}
          <Bar {...black} metalness={0.6} from={[0.15, 1.8]} to={[-1.95, 1.785]} z={s * 0.66} thick={0.035} depth={0.035} />
          {[0.1, -1.9].map((x) => (
            <Shell key={x} {...black} position={[x, 1.765, s * 0.66]}>
              <boxGeometry args={[0.1, 0.05, 0.04]} />
            </Shell>
          ))}
        </group>
      ))}

      {/* ---------- Muka depan ---------- */}
      {/* Gril cascading lebar */}
      <Shell {...black} metalness={0.5} roughness={0.35} position={[2.512, 0.7, 0]}>
        <boxGeometry args={[0.03, 0.42, 1.1]} />
      </Shell>
      {[0.53, 0.6, 0.67, 0.74, 0.81, 0.87].map((y, i) => (
        <Shell key={y} {...chrome} position={[2.53, y, 0]}>
          <boxGeometry args={[0.012, 0.012, 1.04 - i * 0.03]} />
        </Shell>
      ))}
      <Bar {...chrome} from={[2.53, 0.49]} to={[2.53, 0.91]} z={-0.555} thick={0.02} depth={0.02} />
      <Bar {...chrome} from={[2.53, 0.49]} to={[2.53, 0.91]} z={0.555} thick={0.02} depth={0.02} />
      <Shell {...chrome} position={[2.53, 0.915, 0]}>
        <boxGeometry args={[0.02, 0.02, 1.13]} />
      </Shell>
      {/* Intake bawah & skid plate */}
      <Shell {...black} position={[2.505, 0.43, 0]}>
        <boxGeometry args={[0.035, 0.11, 1.35]} />
      </Shell>
      <Shell {...chrome} roughness={0.35} position={[2.5, 0.37, 0]}>
        <boxGeometry args={[0.03, 0.035, 0.9]} />
      </Shell>

      {/* ---------- Muka belakang ---------- */}
      <Shell {...chrome} position={[-2.525, 1.0, 0]}>
        <boxGeometry args={[0.012, 0.022, 1.0]} />
      </Shell>
      <Shell {...black} position={[-2.52, 0.45, 0]}>
        <boxGeometry args={[0.035, 0.13, 1.65]} />
      </Shell>
      <Shell xray={xray} color="#e5e7eb" roughness={0.6} position={[-2.528, 0.8, 0]}>
        <boxGeometry args={[0.015, 0.14, 0.48]} />
      </Shell>

      {/* =================== PARTS (bisa diklik) =================== */}

      {WHEELS.map((w) => (
        <Wheel key={w.key} wheelKey={w.key} x={w.x} z={w.z} />
      ))}

      {SIDES.map((s) => {
        const head = s < 0 ? 'headlight_left' : 'headlight_right'
        const tail = s < 0 ? 'taillight_left' : 'taillight_right'
        const lamp = { color: '#e8eef5', metalness: 0.3, roughness: 0.1 }
        const red = { color: '#9f1239', metalness: 0.2, roughness: 0.15 }
        return (
          <group key={s}>
            {/* Lampu depan: unit vertikal di sisi gril + DRL di tepi kap + DRL vertikal luar */}
            <Part name={head} {...lamp} position={[2.513, 0.7, s * 0.71]}>
              <boxGeometry args={[0.035, 0.36, 0.13]} />
            </Part>
            <Part name={head} {...lamp} position={[2.5, 0.945, s * 0.72]}>
              <boxGeometry args={[0.035, 0.03, 0.32]} />
            </Part>
            <Part name={head} {...lamp} position={[2.505, 0.74, s * 0.865]}>
              <boxGeometry args={[0.035, 0.4, 0.03]} />
            </Part>

            {/* Lampu belakang: vertikal di sudut + sayap horizontal ke tengah (bentuk L) */}
            <Part name={tail} {...red} position={[-2.525, 0.93, s * 0.86]}>
              <boxGeometry args={[0.035, 0.34, 0.08]} />
            </Part>
            <Part name={tail} {...red} position={[-2.525, 1.07, s * 0.69]}>
              <boxGeometry args={[0.035, 0.055, 0.28]} />
            </Part>
          </group>
        )
      })}

      {/* Wiper di pangkal kaca depan */}
      {[-0.32, 0.26].map((z) => (
        <Part key={z} name="wiper" color={BLACK} position={[1.17, 1.17, z]} rotation={[0, 0.12, 0]}>
          <boxGeometry args={[0.025, 0.02, 0.62]} />
        </Part>
      ))}

      {/* Ruang mesin – aktifkan X-ray untuk melihat */}
      <Part name="engine_oil" color="#4b5563" metalness={0.5} position={[1.8, 0.72, 0]}>
        <boxGeometry args={[0.65, 0.4, 0.8]} />
      </Part>
      <Part name="battery" color="#111827" position={[1.95, 0.82, -0.62]}>
        <boxGeometry args={[0.28, 0.2, 0.18]} />
      </Part>
      <Part name="air_filter" color="#6b7280" position={[1.98, 0.86, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.24, 24]} />
      </Part>
      <Part name="coolant" color="#38bdf8" roughness={0.2} position={[2.25, 0.82, 0.38]}>
        <boxGeometry args={[0.14, 0.16, 0.14]} />
      </Part>
    </group>
  )
}
