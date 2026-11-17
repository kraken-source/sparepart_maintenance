import axios from 'axios'

const http = axios.create({ baseURL: '/api', headers: { Accept: 'application/json' } })

export const api = {
  // --- Kendaraan ---
  vehicles: () => http.get('/vehicles').then((r) => r.data.data),
  createVehicle: (payload) => http.post('/vehicles', payload).then((r) => r.data.data),
  updateVehicle: (id, payload) => http.put(`/vehicles/${id}`, payload).then((r) => r.data.data),
  deleteVehicle: (id) => http.delete(`/vehicles/${id}`),
  partsStatus: (vehicleId) => http.get(`/vehicles/${vehicleId}/parts-status`).then((r) => r.data.data),

  // --- Part ---
  parts: () => http.get('/parts').then((r) => r.data.data),
  createPart: (payload) => http.post('/parts', payload).then((r) => r.data.data),
  updatePart: (id, payload) => http.put(`/parts/${id}`, payload).then((r) => r.data.data),
  deletePart: (id) => http.delete(`/parts/${id}`),

  // --- Catatan maintenance ---
  records: (params) => http.get('/maintenance-records', { params }).then((r) => r.data),
  createRecord: (payload) => http.post('/maintenance-records', payload).then((r) => r.data.data),
  updateRecord: (id, payload) => http.put(`/maintenance-records/${id}`, payload).then((r) => r.data.data),
  deleteRecord: (id) => http.delete(`/maintenance-records/${id}`),
}

/** Ambil pesan error validasi Laravel (422) menjadi { field: 'pesan' }. */
export function validationErrors(err) {
  const errors = err?.response?.data?.errors
  if (!errors) return { _general: errorMessage(err) }
  return Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v[0]]))
}

/** Pesan error tunggal (untuk alert, mis. gagal hapus karena masih dipakai). */
export function errorMessage(err) {
  return err?.response?.data?.message || err?.message || 'Terjadi kesalahan'
}
