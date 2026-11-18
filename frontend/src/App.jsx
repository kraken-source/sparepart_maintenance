import { Suspense, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { useAuth, useIsAdmin } from './auth'
import { useUi } from './store'
import { km, vehicleLabel } from './format'
import LoginPage from './components/LoginPage'
import Sidebar, { Icon } from './components/Sidebar'
import { VehicleViewer, Viewer3DBoundary, preload3D } from './lazy3d'
import DashboardStats from './components/DashboardStats'
import NotificationBell from './components/NotificationBell'
import ThemeToggle from './components/ThemeToggle'
import PartPanel from './components/PartPanel'
import RecordsTable from './components/RecordsTable'
import RecordForm from './components/RecordForm'
import VehiclesPage from './components/VehiclesPage'
import PartsPage from './components/PartsPage'
import ReportsPage from './components/reports/ReportsPage'
import UsersPage from './components/users/UsersPage'
import FuelPage from './components/fuel/FuelPage'
import FuelTypesPage from './components/fuel/FuelTypesPage'
import VehicleModelsPage from './components/vehicle-models/VehicleModelsPage'

const MENU = [
  {
    title: 'Utama',
    items: [
      { key: 'dashboard', label: 'Dashboard 3D', perVehicle: true },
      { key: 'records', label: 'Catatan Maintenance', perVehicle: true },
      { key: 'fuel', label: 'Bahan Bakar', perVehicle: true },
      { key: 'reports', label: 'Laporan Biaya' },
    ],
  },
  {
    title: 'Master Data',
    items: [
      { key: 'vehicles', label: 'Kendaraan' },
      { key: 'parts', label: 'Part' },
      { key: 'fuelTypes', label: 'Jenis BBM' },
      { key: 'models3d', label: 'Model 3D' },
    ],
  },
  {
    title: 'Pengaturan',
    items: [{ key: 'users', label: 'Pengguna', adminOnly: true }],
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
  useEffect(() => preload3D(), [])
  const [page, setPageState] = useState(readPage)
  const vehicleId = useUi((s) => s.vehicleId)
  const setVehicle = useUi((s) => s.setVehicle)
  const formOpen = useUi((s) => s.formRecord !== null)
  const isAdmin = useIsAdmin()
  const userLoaded = useAuth((s) => !!s.user)

  const [navOpen, setNavOpen] = useState(false)
  const setPage = (p) => {
    setNavOpen(false)
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

  // Menu & halaman khusus admin disembunyikan dari user biasa (API juga menolaknya: 403).
  const menu = MENU.map((g) => ({ ...g, items: g.items.filter((i) => !i.adminOnly || isAdmin) })).filter((g) => g.items.length)
  const requested = PAGES.find((p) => p.key === page)
  const activePage = requested.adminOnly && !isAdmin ? (userLoaded ? 'dashboard' : null) : page
  const current = PAGES.find((p) => p.key === activePage) ?? requested
  const noVehicle = vehicles.data && vehicles.data.length === 0

  return (
    <div className="app">
      <Sidebar groups={menu} active={activePage} onSelect={setPage} open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="main">
        <header className="topbar">
          {/* Layar HP: sidebar disembunyikan, dibuka lewat tombol menu ini */}
          <button className="icon-btn menu-btn" onClick={() => setNavOpen(true)} aria-label="Buka menu" title="Menu">
            <Icon name="menu" />
          </button>
          <h1 className="page-title">{current.label}</h1>
          {current.perVehicle && vehicles.data?.length > 0 && (
            <div className="vehicle-picker">
              <select value={vehicleId ?? ''} onChange={(e) => setVehicle(Number(e.target.value))}>
                {vehicles.data.map((v) => (
                  <option key={v.id} value={v.id}>{vehicleLabel(v, { withOwner: isAdmin, withYear: true })}</option>
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
            <p className="muted">Tambahkan kendaraan Anda terlebih dahulu untuk mulai mencatat maintenance.</p>
            <button className="primary" onClick={() => setPage('vehicles')}>Ke halaman Kendaraan</button>
          </div>
        )}

        {activePage === 'dashboard' && vehicle && (
          <main className="dashboard">
            <section className="dash-main">
              <DashboardStats vehicle={vehicle} parts={parts.data} onOpenFuel={() => setPage('fuel')} />
              <Viewer3DBoundary>
                <Suspense fallback={<div className="viewer viewer-loading"><span>Memuat model 3D…</span></div>}>
                  <VehicleViewer vehicle={vehicle} parts={parts.data} />
                </Suspense>
              </Viewer3DBoundary>
            </section>
            <PartPanel vehicle={vehicle} parts={parts.data} />
          </main>
        )}
        {activePage === 'records' && vehicle && <RecordsTable vehicle={vehicle} />}
        {activePage === 'fuel' && vehicle && <FuelPage key={vehicle.id} vehicle={vehicle} />}
        {activePage === 'fuelTypes' && <FuelTypesPage />}
        {activePage === 'models3d' && <VehicleModelsPage />}
        {activePage === 'vehicles' && (
          <VehiclesPage
            vehicles={vehicles.data}
            onOpenDashboard={(id) => { setVehicle(id); setPage('dashboard') }}
          />
        )}
        {activePage === 'parts' && <PartsPage />}
        {activePage === 'reports' && <ReportsPage vehicles={vehicles.data} />}
        {activePage === 'users' && <UsersPage />}
      </div>

      {formOpen && <RecordForm vehicles={vehicles.data} />}
    </div>
  )
}
