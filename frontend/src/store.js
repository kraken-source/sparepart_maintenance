import { create } from 'zustand'

export const useUi = create((set) => ({
  vehicleId: null,
  selectedMesh: null, // mesh_name part yang sedang dipilih di 3D / list
  xray: false,
  formRecord: null, // null = form tertutup, {} = tambah, {id,...} = edit

  setVehicle: (vehicleId) => set({ vehicleId, selectedMesh: null }),
  selectMesh: (selectedMesh) => set({ selectedMesh }),
  toggleXray: () => set((s) => ({ xray: !s.xray })),
  openForm: (formRecord = {}) => set({ formRecord }),
  closeForm: () => set({ formRecord: null }),
}))

export const STATUS = {
  ok: { label: 'Aman', color: '#22c55e' },
  due_soon: { label: 'Segera', color: '#f59e0b' },
  overdue: { label: 'Lewat jadwal', color: '#ef4444' },
  unknown: { label: 'Belum ada data', color: '#94a3b8' },
}
