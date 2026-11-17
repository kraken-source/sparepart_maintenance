import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Environment "studio" untuk pantulan cat, krom, dan kaca.
 *
 * Pengganti <Environment> + <Lightformer> dari drei: bidang-bidang cahaya yang sama dirender ke
 * environment map lewat PMREMGenerator bawaan three.js. Hasil visualnya setara, tetapi tanpa ikut
 * membundel loader EXR/RGBE/gainmap milik drei (±38 KB) yang memang tidak kita pakai.
 */
const FORMERS = [
  // [intensitas, posisi, rotasi, [lebar, tinggi]] – sama dengan Lightformer sebelumnya
  [2, [0, 6, 0], [Math.PI / 2, 0, 0], [12, 6]],
  [1.5, [-8, 1.5, 0], [0, Math.PI / 2, 0], [20, 1.2]],
  [1.5, [8, 1.5, 0], [0, -Math.PI / 2, 0], [20, 1.2]],
  [1, [0, 2, 9], [0, 0, 0], [10, 2]],
  [1, [0, 2, -9], [0, Math.PI, 0], [10, 2]],
]

export default function StudioEnvironment() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    const room = new THREE.Scene()
    const plane = new THREE.PlaneGeometry(1, 1)
    const materials = FORMERS.map(([intensity, position, rotation, [w, h]]) => {
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(intensity, intensity, intensity),
        side: THREE.DoubleSide,
        toneMapped: false,
      })
      const mesh = new THREE.Mesh(plane, material)
      mesh.position.set(...position)
      mesh.rotation.set(...rotation)
      mesh.scale.set(w, h, 1)
      room.add(mesh)
      return material
    })

    const pmrem = new THREE.PMREMGenerator(gl)
    const target = pmrem.fromScene(room, 0.02)
    const previous = scene.environment
    scene.environment = target.texture

    return () => {
      scene.environment = previous
      target.dispose()
      pmrem.dispose()
      plane.dispose()
      materials.forEach((m) => m.dispose())
    }
  }, [gl, scene])

  return null
}
