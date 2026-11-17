import { createContext, useContext, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { STATUS, useUi } from '../store'

/** Map mesh_name -> status part ('ok' | 'due_soon' | 'overdue' | 'unknown'). */
export const PartStatusContext = createContext({})

const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Intensitas cahaya peringatan untuk part yang lewat jadwal: berdenyut ±1x per detik.
 * Bila user meminta animasi dikurangi, cukup menyala terang tanpa berkedip.
 */
export function overdueGlow(time) {
  if (reduceMotion) return 1
  const wave = (Math.sin(time * Math.PI * 2) + 1) / 2 // 0..1, periode 1 detik
  return 0.05 + wave * wave * 1.6 // dikuadratkan agar "kedip" lebih tegas
}

/**
 * Mesh part yang bisa diklik. Status maintenance ditampilkan lewat warna emissive,
 * sehingga warna asli part tetap terlihat. Part yang lewat jadwal berkedip merah.
 */
export default function Part({ name, color, metalness = 0.1, roughness = 0.5, side, children, ...props }) {
  const statusMap = useContext(PartStatusContext)
  const selected = useUi((s) => s.selectedMesh === name)
  const selectMesh = useUi((s) => s.selectMesh)
  const [hovered, setHovered] = useState(false)
  const material = useRef()
  const ghost = useRef()

  const status = statusMap[name]
  const overdue = status === 'overdue'
  const blinking = overdue && !selected && !hovered
  // Part tanpa data tidak diberi warna status agar warna aslinya (mis. lampu merah) tetap terlihat.
  const tinted = status && status !== 'unknown'
  const glow = STATUS[status]?.color ?? '#000000'
  const intensity = selected ? 1.1 : hovered ? 0.7 : tinted ? 0.3 : 0

  useFrame(({ clock }) => {
    const g = overdueGlow(clock.elapsedTime)
    if (blinking && material.current) material.current.emissiveIntensity = g
    if (ghost.current) ghost.current.opacity = 0.08 + (g / 1.65) * 0.6
  })

  return (
    <>
    {/*
      Bayangan merah yang menembus bodi (depthTest off) agar part yang lewat jadwal tetap
      terlihat berkedip walaupun tertutup kap mesin, roda, dsb.
    */}
    {overdue && (
      <mesh {...props} renderOrder={10} raycast={() => null}>
        {children}
        <meshBasicMaterial ref={ghost} color="#ff2d2d" transparent opacity={0.4} depthTest={false} depthWrite={false} />
      </mesh>
    )}
    <mesh
      name={name}
      castShadow
      {...props}
      onClick={(e) => {
        e.stopPropagation()
        selectMesh(name)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = 'auto'
      }}
    >
      {children}
      <meshStandardMaterial
        ref={material}
        color={color}
        emissive={glow}
        emissiveIntensity={intensity}
        metalness={metalness}
        roughness={roughness}
        side={side}
      />
    </mesh>
    </>
  )
}
