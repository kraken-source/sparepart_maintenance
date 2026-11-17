import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { useUi } from './store'
import { km } from './format'
import VehicleViewer from './components/VehicleViewer'
import PartPanel from './components/PartPanel'
import RecordsTable from './components/RecordsTable'
import RecordForm from './components/RecordForm'
import VehiclesPage from './components/VehiclesPage'
import PartsPage from './components/PartsPage'

const TABS = [
  { key: 'dashboard', label: 'Dashboard 3D', perVehicle: true },
  { key: 'records', label: 'Catatan Maintenance', perVehicle: true },
  { key: 'vehicles', label: 'Kendaraan' },
  { key: 'parts', label: 'Part' },
]

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const vehicleId = useUi((s) => s.vehicleId)
  const setVehicle = useUi((s) => s.setVehicle)
  const formOpen = useUi((s) => s.formRecord !== null)

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

  const current = TABS.find((t) => t.key === tab)
  const noVehicle = vehicles.data && vehicles.data.length === 0

  return (
    <div className="app">
      <header className="topbar">
        <strong className="brand">Sparepart Maintenance</strong>
        {current.perVehicle && vehicles.data?.length > 0 && (
          <>
            <select value={vehicleId ?? ''} onChange={(e) => setVehicle(Number(e.target.value))}>
              {vehicles.data.map((v) => (
                <option key={v.id} value={v.id}>{v.plate_number} – {v.brand} {v.model} {v.year ?? ''}</option>
              ))}
            </select>
            {vehicle && <span className="muted">Odometer: {km(vehicle.odometer)}</span>}
          </>
        )}
        <nav>
          {TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {current.perVehicle && noVehicle && (
        <div className="empty">
          <h3>Belum ada kendaraan</h3>
          <p className="muted">Tambahkan kendaraan terlebih dahulu untuk mulai mencatat maintenance.</p>
          <button className="primary" onClick={() => setTab('vehicles')}>Ke halaman Kendaraan</button>
        </div>
      )}

      {tab === 'dashboard' && vehicle && (
        <main className="dashboard">
          <VehicleViewer vehicle={vehicle} parts={parts.data} />
          <PartPanel vehicle={vehicle} parts={parts.data} />
        </main>
      )}
      {tab === 'records' && vehicle && <RecordsTable vehicle={vehicle} />}
      {tab === 'vehicles' && (
        <VehiclesPage
          vehicles={vehicles.data}
          onOpenDashboard={(id) => { setVehicle(id); setTab('dashboard') }}
        />
      )}
      {tab === 'parts' && <PartsPage />}

      {formOpen && <RecordForm vehicles={vehicles.data} />}
    </div>
  )
}
