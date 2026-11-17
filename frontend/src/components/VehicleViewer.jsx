import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { BUILTIN_MODELS, DEFAULT_MODEL, resolveModel } from './models'
import { PartStatusContext, overdueGlow } from './Part'
import { STATUS, useUi } from '../store'
import { useTheme } from '../theme'

/**
 * Viewer 3D kendaraan.
 * - vehicle.model_3d_url = "builtin:<key>" → model prosedural bawaan (lihat ./models).
 * - Berisi URL file .glb → model GLB; bila gagal dimuat, kembali ke model bawaan default.
 * - Kosong → model bawaan default.
 * - Part yang lewat jadwal berkedip merah + banner peringatan di pojok kanan atas.
 */
export default function VehicleViewer({ vehicle, parts }) {
  const xray = useUi((s) => s.xray)
  const toggleXray = useUi((s) => s.toggleXray)
  const selectMesh = useUi((s) => s.selectMesh)

  const statusMap = useMemo(
    () => Object.fromEntries((parts ?? []).map((p) => [p.mesh_name, p.status])),
    [parts],
  )
  const overdue = useMemo(() => (parts ?? []).filter((p) => p.status === 'overdue'), [parts])

  // Sudut pandang awal bisa diatur lewat URL, mis. ?view=front
  const [view, setView] = useState(() => {
    const key = new URLSearchParams(window.location.search).get('view')
    return VIEWS[key] ? { key, n: 0 } : null
  })

  const model = resolveModel(vehicle?.model_3d_url)
  const Builtin = BUILTIN_MODELS[model.kind === 'builtin' ? model.key : DEFAULT_MODEL].Component
  const fallback = <Builtin xray={xray} />

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
        {/* Environment studio dibangun lokal (tanpa unduh HDR) agar cat & krom memantulkan cahaya */}
        <Environment resolution={256} frames={1}>
          <Lightformer intensity={2} rotation-x={Math.PI / 2} position={[0, 6, 0]} scale={[12, 6, 1]} />
          <Lightformer intensity={1.5} rotation-y={Math.PI / 2} position={[-8, 1.5, 0]} scale={[20, 1.2, 1]} />
          <Lightformer intensity={1.5} rotation-y={-Math.PI / 2} position={[8, 1.5, 0]} scale={[20, 1.2, 1]} />
          <Lightformer intensity={1} position={[0, 2, 9]} scale={[10, 2, 1]} />
          <Lightformer intensity={1} rotation-y={Math.PI} position={[0, 2, -9]} scale={[10, 2, 1]} />
        </Environment>

        <Showroom alert={overdue.length > 0} />

        <PartStatusContext.Provider value={statusMap}>
          <Suspense fallback={null}>
            {model.kind === 'glb' ? (
              <ModelErrorBoundary fallback={fallback} resetKey={model.url}>
                <GltfVehicle url={model.url} statusMap={statusMap} xray={xray} />
              </ModelErrorBoundary>
            ) : (
              fallback
            )}
          </Suspense>
        </PartStatusContext.Provider>
        <ContactShadows position={[0, 0.002, 0]} opacity={0.6} scale={10} blur={2.5} far={3} />
        <OrbitControls makeDefault target={[0, 0.8, 0]} minDistance={3} maxDistance={12} maxPolarAngle={Math.PI / 2.05} />
        <CameraRig view={view} />
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

      {overdue.length > 0 && (
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

      <div className="legend">
        {Object.entries(STATUS).map(([key, s]) => (
          <span key={key}>
            <i className={key === 'overdue' ? 'blink' : ''} style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
    </div>
  )
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

/** Memindahkan kamera ke preset saat tombol sudut pandang ditekan. */
function CameraRig({ view }) {
  const { camera, controls } = useThree()
  useEffect(() => {
    if (!view || !controls) return
    camera.position.set(...VIEWS[view.key].position)
    controls.target.set(0, 0.8, 0)
    controls.update()
  }, [view, camera, controls])
  return null
}

/** Memuat model .glb dan mewarnai mesh yang namanya terdaftar sebagai part. */
function GltfVehicle({ url, statusMap, xray }) {
  const { scene } = useGLTF(url)
  const selectedMesh = useUi((s) => s.selectedMesh)
  const selectMesh = useUi((s) => s.selectMesh)
  const model = useMemo(() => scene.clone(true), [scene])
  const blinking = useRef([]) // material part yang lewat jadwal
  const ghosts = useRef([]) // material bayangan merah yang menembus bodi

  // Cari nama part dari mesh yang diklik atau parent-nya (GLB sering bertingkat).
  const partNameOf = (obj) => {
    for (let o = obj; o; o = o.parent) if (statusMap[o.name] !== undefined) return o.name
    return null
  }

  useLayoutEffect(() => {
    const list = []
    const ghostMats = []

    // Buang bayangan dari render sebelumnya (status bisa berubah).
    const old = []
    model.traverse((o) => o.userData.ghost && old.push(o))
    old.forEach((g) => {
      g.parent.remove(g)
      g.material.dispose()
    })

    model.traverse((o) => {
      if (!o.isMesh || o.userData.ghost) return
      if (!o.userData.cloned) {
        o.material = o.material.clone()
        o.userData.cloned = true
      }
      const part = partNameOf(o)
      if (part) {
        const status = statusMap[part]
        o.material.emissive = new THREE.Color(STATUS[status]?.color ?? '#000')
        o.material.emissiveIntensity = part === selectedMesh ? 1.1 : status && status !== 'unknown' ? 0.3 : 0
        if (status === 'overdue') {
          if (part !== selectedMesh) list.push(o.material)
          // Bayangan merah menembus bodi, sebagai anak mesh agar transformnya ikut.
          const mat = new THREE.MeshBasicMaterial({ color: '#ff2d2d', transparent: true, opacity: 0.4, depthTest: false, depthWrite: false })
          const g = new THREE.Mesh(o.geometry, mat)
          g.userData.ghost = true
          g.renderOrder = 10
          g.raycast = () => {}
          o.add(g)
          ghostMats.push(mat)
        }
      } else {
        o.material.transparent = xray
        o.material.opacity = xray ? 0.1 : 1
        o.material.depthWrite = !xray
      }
    })
    blinking.current = list
    ghosts.current = ghostMats
  })

  useFrame(({ clock }) => {
    const glow = overdueGlow(clock.elapsedTime)
    for (const m of blinking.current) m.emissiveIntensity = glow
    for (const m of ghosts.current) m.opacity = 0.08 + (glow / 1.65) * 0.6
  })

  return (
    <primitive
      object={model}
      onClick={(e) => {
        const part = partNameOf(e.object)
        if (part) {
          e.stopPropagation()
          selectMesh(part)
        }
      }}
    />
  )
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
    console.warn('Model GLB gagal dimuat, memakai model prosedural:', error.message)
  }
  render() {
    return this.state.error ? this.props.fallback : this.props.children
  }
}
