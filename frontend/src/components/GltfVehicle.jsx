import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { overdueGlow } from './Part'
import { STATUS, useUi } from '../store'

/*
 * Dimuat terpisah (lazy) hanya bila kendaraan memakai file .glb, karena loader GLTF/Meshopt/DRACO
 * menambah ±70 KB yang tidak diperlukan model bawaan.
 */

/** Memuat model .glb dan mewarnai mesh yang namanya terdaftar sebagai part. */
export default function GltfVehicle({ url, statusMap, xray }) {
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
        if (o.material.transparent !== xray) o.material.needsUpdate = true // wajib agar perubahan transparan diterapkan
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
