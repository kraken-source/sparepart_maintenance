import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import { DEFAULT_MODEL_BY_TYPE, VIEW_BY_TYPE, resolveModel } from './models/meta'
import { MODEL_COMPONENTS } from './models'
import StudioEnvironment from './StudioEnvironment'

const GltfVehicle = lazy(() => import('./GltfVehicle'))
import { PartStatusContext, overdueGlow } from './Part'
import { STATUS, useUi } from '../store'
import { useTheme } from '../theme'

/**
 * Viewer 3D kendaraan. Model diambil dari master Model 3D (vehicle.vehicle_model):
 * - model bawaan → komponen prosedural (lihat ./models)
 * - file .glb    → dimuat dari file_url; bila gagal, kembali ke model bawaan default
 * - kosong       → model bawaan default sesuai jenis kendaraan
 * Part yang lewat jadwal berkedip merah + banner peringatan di pojok kanan atas.
 *
 * Mode pratinjau (halaman master Model 3D): `model` + `type` diberikan langsung, part di `highlight`
 * diberi warna hijau, model .glb yang gagal TIDAK diganti model bawaan (dilaporkan lewat onModelError),
 * dan `onReady({ capture, meshNames })` dipanggil setelah model tampil – untuk thumbnail otomatis.
 */
export default function VehicleViewer({
  vehicle, parts, model: modelProp, type: typeProp, preview = false, highlight = null, onReady, onModelError,
}) {
  const xray = useUi((s) => s.xray)
  const toggleXray = useUi((s) => s.toggleXray)
  const selectMesh = useUi((s) => s.selectMesh)

  const statusMap = useMemo(
    () => preview
      ? Object.fromEntries((highlight ?? []).map((m) => [m, 'ok']))
      : Object.fromEntries((parts ?? []).map((p) => [p.mesh_name, p.status])),
    [parts, preview, highlight],
  )
  const overdue = useMemo(() => (preview ? [] : (parts ?? []).filter((p) => p.status === 'overdue')), [parts, preview])

  // Sudut pandang awal bisa diatur lewat URL, mis. ?view=front
  const [view, setView] = useState(() => {
    const key = new URLSearchParams(window.location.search).get('view')
    return VIEWS[key] ? { key, n: 0 } : null
  })

  const type = typeProp ?? vehicle?.type ?? 'car'
  const model = resolveModel(modelProp !== undefined ? modelProp : vehicle?.vehicle_model, type)
  const Builtin = MODEL_COMPONENTS[model.kind === 'builtin' ? model.key : DEFAULT_MODEL_BY_TYPE[type]]
  // Kamera & lantai mengikuti ukuran kendaraan (motor jauh lebih kecil dari mobil)
  const camera = VIEW_BY_TYPE[type] ?? VIEW_BY_TYPE.car
  const builtin = <Builtin xray={xray} />
  // Pratinjau: GLB yang gagal jangan disamarkan dengan model bawaan.
  const fallback = preview && model.kind === 'glb' ? null : builtin

  return (
    <div className="viewer">
      <Canvas
        shadows
        gl={{ alpha: true }}
        camera={{ position: [6, 2.6, 5], fov: 38 }}
        onPointerMissed={() => selectMesh(null)}
      >
        <hemisphereLight args={['#dbeafe', '#1e293b', 0.6]} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
        {/* Environment studio dibangun lokal (tanpa unduh HDR & tanpa loader) agar cat & krom memantulkan cahaya */}
        <StudioEnvironment />

        <group scale={camera.scale}>
          <Showroom alert={overdue.length > 0} />
        </group>

        <PartStatusContext.Provider value={statusMap}>
          <Suspense fallback={null}>
            {model.kind === 'glb' ? (
              <ModelErrorBoundary fallback={fallback} resetKey={model.url} onError={onModelError}>
                <GltfVehicle url={model.url} statusMap={statusMap} xray={xray} />
              </ModelErrorBoundary>
            ) : (
              builtin
            )}
            {/* Di dalam Suspense yang sama → baru dipasang setelah model selesai dimuat */}
            {onReady && <Snapshot key={model.kind === 'glb' ? model.url : model.key} onReady={onReady} />}
          </Suspense>
        </PartStatusContext.Provider>
        <ContactShadows position={[0, 0.002, 0]} opacity={0.6} scale={10 * camera.scale} blur={2.5} far={3 * camera.scale} />
        <OrbitControls makeDefault target={camera.target} minDistance={camera.minDistance} maxDistance={camera.maxDistance} maxPolarAngle={Math.PI / 2.05} />
        <CameraRig view={view} camera={camera} />
      </Canvas>

      <div className="viewer-toolbar">
        <button className={xray ? 'active' : ''} onClick={toggleXray} title="Tembus pandang bodi untuk melihat ruang mesin">
          {xray ? 'X-ray: ON' : 'X-ray: OFF'}
        </button>
        <div className="seg">
          {Object.entries(VIEWS).map(([key, v]) => (
            <button key={key} onClick={() => setView({ key, n: Date.now() })}>{v.label}</button>
          ))}
        </div>
      </div>

      {!preview && overdue.length > 0 && (
        <div className="overdue-alert" role="alert">
          <div className="overdue-head">
            <span className="pulse-dot" /> {overdue.length} part lewat jadwal ganti
          </div>
          <div className="overdue-chips">
            {overdue.map((p) => (
              <button key={p.id} onClick={() => selectMesh(p.mesh_name)}>{p.name}</button>
            ))}
          </div>
        </div>
      )}

      {!preview && (
        <div className="legend">
          {Object.entries(STATUS).map(([key, s]) => (
            <span key={key}>
              <i className={key === 'overdue' ? 'blink' : ''} style={{ background: s.color }} /> {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Setelah model tampil (2 frame), beri akses untuk:
 * - capture(): gambar tampilan sekarang → Blob PNG 480×300 (thumbnail). Dirender ulang lalu langsung
 *   disalin dalam tugas yang sama, jadi tidak perlu preserveDrawingBuffer (yang memperlambat viewer).
 * - meshNames(): nama semua objek di scene (untuk cek kecocokan dengan mesh_name part).
 */
function Snapshot({ onReady }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    let second
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => onReady({
        capture: (width = 480, height = 300) => {
          gl.render(scene, camera)
          const src = gl.domElement
          // potong tengah agar rasio sama dengan thumbnail (seperti object-fit: cover)
          const ratio = width / height
          let sw = src.width
          let sh = src.height
          if (sw / sh > ratio) sw = sh * ratio
          else sh = sw / ratio
          const out = document.createElement('canvas')
          out.width = width
          out.height = height
          out.getContext('2d').drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, width, height)
          return new Promise((resolve) => out.toBlob(resolve, 'image/png'))
        },
        meshNames: () => {
          const names = new Set()
          scene.traverse((o) => o.name && !o.userData.ghost && names.add(o.name))
          return [...names].sort()
        },
      }))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [onReady, gl, scene, camera])
  return null
}

/** Lantai bundar ala showroom; cincinnya ikut berdenyut merah bila ada part lewat jadwal. */
const FLOOR = {
  dark: { floor: '#111a2b', metalness: 0.6, roughness: 0.35, ring: '#0b1220' },
  light: { floor: '#d9e1ec', metalness: 0.2, roughness: 0.55, ring: '#cbd5e1' },
}

function Showroom({ alert }) {
  const theme = useTheme((s) => s.theme)
  const f = FLOOR[theme] ?? FLOOR.dark
  const ring = useRef()
  useFrame(({ clock }) => {
    if (!ring.current) return
    ring.current.emissiveIntensity = alert ? 0.3 + overdueGlow(clock.elapsedTime) * 0.6 : 0.6
  })
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, 0]} receiveShadow>
        <circleGeometry args={[4.2, 96]} />
        <meshStandardMaterial color={f.floor} metalness={f.metalness} roughness={f.roughness} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <ringGeometry args={[4.12, 4.2, 128]} />
        <meshStandardMaterial ref={ring} color={f.ring} emissive={alert ? '#ef4444' : '#3b82f6'} emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

/** Preset posisi kamera. Model menghadap +X. */
const VIEWS = {
  iso: { label: 'Default', position: [6, 2.6, 5] },
  front: { label: 'Depan', position: [7, 1.4, 0.01] },
  side: { label: 'Samping', position: [0, 1.2, 8] },
  rear: { label: 'Belakang', position: [-7, 1.6, 0.01] },
  top: { label: 'Atas', position: [0.01, 9, 0] },
}

/**
 * Memindahkan kamera ke preset (Default, Depan, …). Posisi preset dikalikan skala kendaraan,
 * dan kamera kembali ke tampilan default setiap kali ukuran kendaraan berganti (mobil ↔ motor).
 */
function CameraRig({ view, camera: cfg }) {
  const { camera, controls } = useThree()
  useEffect(() => {
    if (!controls) return
    const [x, y, z] = VIEWS[view?.key ?? 'iso'].position
    camera.position.set(x * cfg.scale, y * cfg.scale, z * cfg.scale)
    controls.target.set(...cfg.target)
    controls.update()
  }, [view, cfg, camera, controls])
  return null
}

class ModelErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }
  componentDidCatch(error) {
    console.warn('Model GLB gagal dimuat:', error.message)
    this.props.onError?.(error)
  }
  render() {
    return this.state.error ? this.props.fallback : this.props.children
  }
}
