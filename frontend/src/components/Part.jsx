import { createContext, useContext, useState } from 'react'
import { STATUS, useUi } from '../store'

/** Map mesh_name -> status part ('ok' | 'due_soon' | 'overdue' | 'unknown'). */
export const PartStatusContext = createContext({})

/**
 * Mesh part yang bisa diklik. Status maintenance ditampilkan lewat warna emissive,
 * sehingga warna asli part tetap terlihat.
 */
export default function Part({ name, color, metalness = 0.1, roughness = 0.5, side, children, ...props }) {
  const statusMap = useContext(PartStatusContext)
  const selected = useUi((s) => s.selectedMesh === name)
  const selectMesh = useUi((s) => s.selectMesh)
  const [hovered, setHovered] = useState(false)

  const status = statusMap[name]
  const glow = STATUS[status]?.color ?? '#000000'
  // Part tanpa data tidak diberi warna status agar warna aslinya (mis. lampu merah) tetap terlihat.
  const tinted = status && status !== 'unknown'
  const intensity = selected ? 1.1 : hovered ? 0.7 : tinted ? 0.3 : 0

  return (
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
        color={color}
        emissive={glow}
        emissiveIntensity={intensity}
        metalness={metalness}
        roughness={roughness}
        side={side}
      />
    </mesh>
  )
}
