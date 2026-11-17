import * as THREE from 'three'

/**
 * Perkakas bersama untuk model kendaraan prosedural.
 * Konvensi sumbu: +X = depan, +Y = atas, +Z = kanan kendaraan. Satuan meter.
 */

export const BEVEL = 0.06

/** Extrude profil samping (bidang XY) selebar `depth`, sudut dibulatkan, berpusat di z = 0. */
export function extrude(shape, depth, bevel = BEVEL) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 5,
    curveSegments: 24,
  })
  geo.translate(0, 0, -depth / 2)
  geo.computeVertexNormals()
  return geo
}

/** Bentuk datar dari daftar titik [x, y]. */
export function flatShapeGeometry(points) {
  return new THREE.ShapeGeometry(new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y))))
}

/** Tabung tipis mengikuti daftar titik 2D (di bidang XY, z = 0). */
export function tubeAlong(points2d, radius, closed = false) {
  const pts = (closed ? [...points2d, points2d[0]] : points2d).map(([x, y]) => new THREE.Vector3(x, y, 0))
  const path = new THREE.CurvePath()
  for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]))
  return new THREE.TubeGeometry(path, pts.length * 12, radius, 6, false)
}

/**
 * Panel datar yang menempel pada sisi miring kabin (kaca depan / belakang).
 * a→b adalah tepi profil, t0..t1 bagian yang ditutup, off = jarak keluar dari profil,
 * z0/z1 = setengah lebar panel di ujung t0 / t1.
 */
export function edgePanelGeometry(a, b, t0, t1, off, z0, z1) {
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

/** Profil penampang ban untuk LatheGeometry: rimR = jari-jari velg, r = jari-jari luar, w = lebar. */
export function tireProfile(rimR, r, w) {
  const h = w / 2
  return [
    [rimR, -h * 0.94], [rimR + (r - rimR) * 0.55, -h], [r - 0.012, -h * 0.9], [r - 0.004, -h * 0.72], [r, -h * 0.35],
    [r, h * 0.35], [r - 0.004, h * 0.72], [r - 0.012, h * 0.9], [rimR + (r - rimR) * 0.55, h], [rimR, h * 0.94],
  ].map(([x, y]) => new THREE.Vector2(x, y))
}

/** Mesh bodi (bukan part). Menjadi transparan pada mode X-ray. */
export function Shell({ color, metalness = 0.3, roughness = 0.5, opacity = 1, xray, side, children, ...props }) {
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

/** Batang lurus di bidang XY antara dua titik (list, rail, garis karakter, dsb). */
export function Bar({ from, to, z, thick = 0.02, depth = 0.02, ...props }) {
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

export const SIDES = [-1, 1]

/** Daftar roda standar dengan nama part yang sama untuk semua model. */
export const wheelLayout = (xf, xr, track) => [
  { key: 'front_left', x: xf, z: -track },
  { key: 'front_right', x: xf, z: track },
  { key: 'rear_left', x: xr, z: -track },
  { key: 'rear_right', x: xr, z: track },
]
