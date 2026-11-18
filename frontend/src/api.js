import axios from 'axios'
import { useAuth } from './auth'

const http = axios.create({ baseURL: '/api', headers: { Accept: 'application/json' } })

// Sisipkan token di setiap request.
http.interceptors.request.use((config) => {
  const token = useAuth.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Token kedaluwarsa / dicabut → kembali ke halaman login.
http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && useAuth.getState().token) useAuth.getState().clear()
    return Promise.reject(err)
  },
)

export const api = {
  // --- Auth ---
  login: (payload) => http.post('/login', payload).then((r) => r.data),
  me: () => http.get('/me').then((r) => r.data.data),
  logout: () => http.post('/logout'),
  changePassword: (payload) => http.put('/me/password', payload).then((r) => r.data),

  // --- Pengguna (khusus admin) ---
  users: () => http.get('/users').then((r) => r.data.data),
  createUser: (payload) => http.post('/users', payload).then((r) => r.data.data),
  updateUser: (id, payload) => http.put(`/users/${id}`, payload).then((r) => r.data.data),
  deleteUser: (id) => http.delete(`/users/${id}`),

  // --- Kendaraan ---
  vehicles: () => http.get('/vehicles').then((r) => r.data.data),
  createVehicle: (payload) => http.post('/vehicles', payload).then((r) => r.data.data),
  updateVehicle: (id, payload) => http.put(`/vehicles/${id}`, payload).then((r) => r.data.data),
  deleteVehicle: (id) => http.delete(`/vehicles/${id}`),
  partsStatus: (vehicleId) => http.get(`/vehicles/${vehicleId}/parts-status`).then((r) => r.data.data),
  vehicleSummary: (vehicleId) => http.get(`/vehicles/${vehicleId}/summary`).then((r) => r.data.data),

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

  // --- Master model 3D (ubah khusus admin) ---
  vehicleModels: () => http.get('/vehicle-models').then((r) => r.data.data),
  /** payload: { name, vehicle_type, notes, is_active, file?: File, thumbnail?: Blob } → multipart */
  createVehicleModel: (payload) => http.post('/vehicle-models', toForm(payload)).then((r) => r.data.data),
  // PHP tidak membaca file pada PUT multipart → kirim POST + _method=PUT (method spoofing Laravel)
  updateVehicleModel: (id, payload) => http.post(`/vehicle-models/${id}`, toForm({ ...payload, _method: 'PUT' })).then((r) => r.data.data),
  deleteVehicleModel: (id) => http.delete(`/vehicle-models/${id}`),
  /** Simpan thumbnail hasil tangkapan 3D (+ nama objek untuk model bawaan). */
  saveModelThumbnail: (id, thumbnail, meshNames) => {
    const form = toForm({ thumbnail })
    meshNames?.forEach((n) => form.append('mesh_names[]', n))
    return http.post(`/vehicle-models/${id}/thumbnail`, form).then((r) => r.data.data)
  },

  // --- Bahan bakar ---
  fuelTypes: () => http.get('/fuel-types').then((r) => r.data.data),
  createFuelType: (payload) => http.post('/fuel-types', payload).then((r) => r.data.data),
  updateFuelType: (id, payload) => http.put(`/fuel-types/${id}`, payload).then((r) => r.data.data),
  deleteFuelType: (id) => http.delete(`/fuel-types/${id}`),
  /** Riwayat pengisian + ringkasan konsumsi satu kendaraan. */
  fuelLogs: (vehicleId) => http.get('/fuel-logs', { params: { vehicle_id: vehicleId } }).then((r) => r.data.data),
  createFuelLog: (payload) => http.post('/fuel-logs', payload).then((r) => r.data.data),
  updateFuelLog: (id, payload) => http.put(`/fuel-logs/${id}`, payload).then((r) => r.data.data),
  deleteFuelLog: (id) => http.delete(`/fuel-logs/${id}`),

  // --- Laporan biaya ---
  costReport: (params) => http.get('/reports/costs', { params }).then((r) => r.data.data),
  /** Unduh file Excel: ambil sebagai blob (perlu token) lalu picu download di browser. */
  exportCostReport: async (params) => {
    const res = await http.get('/reports/costs/export', { params, responseType: 'blob' })
    const name = /filename="?([^";]+)"?/.exec(res.headers['content-disposition'] ?? '')?.[1] ?? 'laporan-biaya.xlsx'
    const url = URL.createObjectURL(res.data)
    const a = Object.assign(document.createElement('a'), { href: url, download: name })
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return name
  },

  // --- Notifikasi di aplikasi ---
  notifications: () => http.get('/notifications').then((r) => r.data),
  markNotificationRead: (id) => http.post(`/notifications/${id}/read`),
  markAllNotificationsRead: () => http.post('/notifications/read-all'),
  checkDueNow: () => http.post('/notifications/check').then((r) => r.data),

  // --- Lampiran (foto nota / bukti servis) ---
  uploadAttachments: (recordId, files) => {
    const form = new FormData()
    files.forEach((f) => form.append('files[]', f))
    return http.post(`/maintenance-records/${recordId}/attachments`, form).then((r) => r.data.data)
  },
  /** File lampiran sebagai Blob (perlu token, jadi tidak bisa langsung dipakai di <img src>). */
  attachmentBlob: (id) => http.get(`/attachments/${id}`, { responseType: 'blob' }).then((r) => r.data),
  deleteAttachment: (id) => http.delete(`/attachments/${id}`),
}

/** Objek → FormData (untuk upload). null/undefined dilewati, boolean → 1/0, Blob tanpa nama diberi nama. */
function toForm(payload) {
  const form = new FormData()
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue
    if (value instanceof Blob) form.append(key, value, value.name ?? `${key}.png`)
    else form.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value))
  }
  return form
}

/** Ambil pesan error validasi Laravel (422) menjadi { field: 'pesan' }. */
export function validationErrors(err) {
  const errors = err?.response?.data?.errors
  if (!errors) return { _general: errorMessage(err) }
  return Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v[0]]))
}

/**
 * Pesan error tunggal dalam Bahasa Indonesia (untuk alert, mis. gagal hapus karena masih dipakai).
 * Pesan dari server sudah berbahasa Indonesia; pesan bawaan axios ("Network Error",
 * "Request failed with status code …") diganti agar seragam.
 */
export function errorMessage(err) {
  const res = err?.response
  if (!res) return 'Tidak dapat terhubung ke server. Periksa koneksi atau pastikan backend berjalan.'
  const message = typeof res.data?.message === 'string' ? res.data.message : null
  if (message) return message
  if (res.status >= 500) return 'Terjadi kesalahan pada server. Silakan coba lagi.'
  return `Permintaan gagal (kode ${res.status}).`
}
