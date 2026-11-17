import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { useAuth } from './auth'
import { useUi } from './store'
import { km } from './format'
import LoginPage from './components/LoginPage'
import Sidebar from './components/Sidebar'
import VehicleViewer from './components/VehicleViewer'
import DashboardStats from './components/DashboardStats'
import NotificationBell from './components/NotificationBell'
import ThemeToggle from './components/ThemeToggle'
import PartPanel from './components/PartPanel'
import RecordsTable from './components/RecordsTable'
import RecordForm from './components/RecordForm'
import VehiclesPage from './components/VehiclesPage'
import PartsPage from './components/PartsPage'
import ReportsPage from './components/reports/ReportsPage'

const MENU = [
  {
    title: 'Utama',
    items: [
      { key: 'dashboard', label: 'Dashboard 3D', perVehicle: true },
      { key: 'records', label: 'Catatan Maintenance', perVehicle: true },
      { key: 'reports', label: 'Laporan Biaya' },
    ],
  },
  {
    title: 'Master Data',
    items: [
      { key: 'vehicles', label: 'Kendaraan' },
      { key: 'parts', label: 'Part' },
    ],
  },
]
const PAGES = MENU.flatMap((g) => g.items)
const PAGE_KEY = 'sm_page'

/** Halaman terakhir dibuka (kenyamanan saja; aman bila localStorage tidak tersedia). */
const readPage = () => {
  try {
    const p = localStorage.getItem(PAGE_KEY)
    return PAGES.some((x) => x.key === p) ? p : 'dashboard'
  } catch {
    return 'dashboard'
  }
}

export default function App() {
  const token = useAuth((s) => s.token)
  const qc = useQueryClient()

  // Saat logout / token kedaluwarsa, buang semua cache agar data user sebelumnya tidak terlihat.
  useEffect(() => {
    if (!token) qc.clear()
  }, [token, qc])

  return token ? <MainApp /> : <LoginPage />
}

function MainApp() {
  const [page, setPageState] = useState(readPage)
  const vehicleId = useUi((s) => s.vehicleId)
  const setVehicle = useUi((s) => s.setVehicle)
  const formOpen = useUi((s) => s.formRecord !== null)

  const setPage = (p) => {
    setPageState(p)
    try {
      localStorage.setItem(PAGE_KEY, p)
    } catch {
      /* abaikan */
    }
  }

  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: api.vehicles })
  const vehicle = vehicles.data?.find((v) => v.id === vehicleId)

  // Pilih kendaraan pertama secara otomatis, juga bila kendaraan terpilih baru saja dihapus.
  useEffect(() => {
    if (!vehicles.data) return
    if (!vehicles.data.some((v) => v.id === vehicleId)) setVehicle(vehicles.data[0]?.id ?? null)
  }, [vehicleId, vehicles.data, setVehicle])

  const parts = useQuery({
    queryKey: ['parts-status', vehicleId],
    queryFn: () => api.partsStatus(vehicleId),
    enabled: !!vehicle,
  })

  if (vehicles.isError) {
    return (
      <div className="center-screen">
        <h2>Tidak dapat terhubung ke API</h2>
        <p className="muted">Pastikan backend Laravel berjalan: <code>php artisan serve</code></p>
      </div>
    )
  }

  const current = PAGES.find((p) => p.key === page)
  const noVehicle = vehicles.data && vehicles.data.length === 0

  return (
    <div className="app">
      <Sidebar groups={MENU} active={page} onSelect={setPage} />

      <div className="main">
        <header className="topbar">
          <h1 className="page-title">{current.label}</h1>
          {current.perVehicle && vehicles.data?.length > 0 && (
            <div className="vehicle-picker">
              <select value={vehicleId ?? ''} onChange={(e) => setVehicle(Number(e.target.value))}>
                {vehicles.data.map((v) => (
                  <option key={v.id} value={v.id}>{v.plate_number} – {v.brand} {v.model} {v.year ?? ''}</option>
                ))}
              </select>
              {vehicle && <span className="odo">{km(vehicle.odometer)}</span>}
            </div>
          )}
          <ThemeToggle />
          <NotificationBell onOpenDashboard={() => setPage('dashboard')} />
        </header>

        {current.perVehicle && noVehicle && (
          <div className="empty">
            <h3>Belum ada kendaraan</h3>
            <p className="muted">Tambahkan kendaraan terlebih dahulu untuk mulai mencatat maintenance.</p>
            <button className="primary" onClick={() => setPage('vehicles')}>Ke halaman Kendaraan</button>
          </div>
        )}

        {page === 'dashboard' && vehicle && (
          <main className="dashboard">
            <section className="dash-main">
              <DashboardStats vehicle={vehicle} parts={parts.data} />
              <VehicleViewer vehicle={vehicle} parts={parts.data} />
            </section>
            <PartPanel vehicle={vehicle} parts={parts.data} />
          </main>
        )}
        {page === 'records' && vehicle && <RecordsTable vehicle={vehicle} />}
        {page === 'vehicles' && (
          <VehiclesPage
            vehicles={vehicles.data}
            onOpenDashboard={(id) => { setVehicle(id); setPage('dashboard') }}
          />
        )}
        {page === 'parts' && <PartsPage />}
        {page === 'reports' && <ReportsPage vehicles={vehicles.data} />}
      </div>

      {formOpen && <RecordForm vehicles={vehicles.data} />}
    </div>
  )
}
