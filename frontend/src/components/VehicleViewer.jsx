import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import PalisadeModel from './PalisadeModel'
import { PartStatusContext } from './Part'
import { STATUS, useUi } from '../store'

/**
 * Viewer 3D kendaraan.
 * - Jika vehicle.model_3d_url berisi file .glb yang valid → model GLB dipakai.
 * - Jika kosong / gagal dimuat → fallback ke model prosedural Palisade.
 */
export default function VehicleViewer({ vehicle, parts }) {
  const xray = useUi((s) => s.xray)
  const toggleXray = useUi((s) => s.toggleXray)
  const selectMesh = useUi((s) => s.selectMesh)

  const statusMap = useMemo(
    () => Object.fromEntries((parts ?? []).map((p) => [p.mesh_name, p.status])),
    [parts],
  )

  // Sudut pandang awal bisa diatur lewat URL, mis. ?view=front
  const [view, setView] = useState(() => {
    const key = new URLSearchParams(window.location.search).get('view')
    return VIEWS[key] ? { key, n: 0 } : null
  })

  const fallback = <PalisadeModel xray={xray} />

  return (
    <div className="viewer">
      <Canvas shadows camera={{ position: [6, 2.6, 5], fov: 38 }} onPointerMissed={() => selectMesh(null)}>
        <color attach="background" args={['#0b1220']} />
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
        <PartStatusContext.Provider value={statusMap}>
          <Suspense fallback={null}>
            {vehicle?.model_3d_url ? (
              <ModelErrorBoundary fallback={fallback} resetKey={vehicle.model_3d_url}>
                <GltfVehicle url={vehicle.model_3d_url} statusMap={statusMap} xray={xray} />
              </ModelErrorBoundary>
            ) : (
              fallback
            )}
          </Suspense>
        </PartStatusContext.Provider>
        <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={10} blur={2.5} far={3} />
        <OrbitControls makeDefault target={[0, 0.8, 0]} minDistance={3} maxDistance={12} maxPolarAngle={Math.PI / 2.05} />
        <CameraRig view={view} />
      </Canvas>

      <div className="viewer-toolbar">
        <button className={xray ? 'active' : ''} onClick={toggleXray}>
          {xray ? 'X-ray: ON' : 'X-ray: OFF'}
        </button>
        {Object.entries(VIEWS).map(([key, v]) => (
          <button key={key} onClick={() => setView({ key, n: Date.now() })}>{v.label}</button>
        ))}
      </div>

      <div className="legend">
        {Object.entries(STATUS).map(([key, s]) => (
          <span key={key}>
            <i style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
    </div>
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

  // Cari nama part dari mesh yang diklik atau parent-nya (GLB sering bertingkat).
  const partNameOf = (obj) => {
    for (let o = obj; o; o = o.parent) if (statusMap[o.name] !== undefined) return o.name
    return null
  }

  useLayoutEffect(() => {
    model.traverse((o) => {
      if (!o.isMesh) return
      if (!o.userData.cloned) {
        o.material = o.material.clone()
        o.userData.cloned = true
      }
      const part = partNameOf(o)
      if (part) {
        o.material.emissive = new THREE.Color(STATUS[statusMap[part]]?.color ?? '#000')
        o.material.emissiveIntensity = part === selectedMesh ? 1.1 : 0.35
      } else {
        o.material.transparent = xray
        o.material.opacity = xray ? 0.1 : 1
        o.material.depthWrite = !xray
      }
    })
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
